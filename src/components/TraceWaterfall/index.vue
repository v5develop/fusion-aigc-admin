<template>
  <div class="tw" :style="rootStyle">
    <!-- 头部：整体状态、总耗时、失败摘要、卡点、排查提示 -->
    <div class="tw-header">
      <a-space wrap :size="[12, 4]">
        <TraceTag :tone="overallTone">{{ t(`creationTask.spans.overall.${overall}`) }}</TraceTag>
        <span class="tw-meta">
          {{ t('creationTask.spans.total') }}:
          <b>{{ formatDuration(totalMs) }}</b>
        </span>
        <span class="tw-meta">{{
          t('creationTask.spans.count', { n: data.spans?.length || 0 })
        }}</span>
        <span v-if="data.startedAt" class="tw-meta">
          {{ t('creationTask.spans.startedAt') }}: {{ formatDateTime(data.startedAt) }}
        </span>
        <span v-if="!data.terminal && overall !== 'empty'" class="tw-meta tw-meta--live">
          <LoadingOutlined /> {{ t('creationTask.spans.live') }}
        </span>
      </a-space>
      <a-alert
        v-if="data.eventsTruncated"
        class="tw-alert"
        type="warning"
        show-icon
        :message="t('creationTask.spans.eventsTruncated')"
      />
      <a-alert
        v-if="failingNode"
        class="tw-alert"
        type="error"
        show-icon
        :message="`${failingNode.span.label || failingNode.span.key}`"
        :description="failureText(failingNode.span) || t('creationTask.spans.noMessage')"
      >
        <template #action>
          <a-button size="small" @click="locate(failingNode.span.id)">{{
            t('creationTask.spans.locate')
          }}</a-button>
        </template>
      </a-alert>
      <a-alert
        v-else-if="stuckNode"
        class="tw-alert"
        type="warning"
        show-icon
        :message="
          t('creationTask.spans.stuckBanner', { name: stuckNode.span.label || stuckNode.span.key })
        "
      >
        <template #action>
          <a-button size="small" @click="locate(stuckNode.span.id)">{{
            t('creationTask.spans.locate')
          }}</a-button>
        </template>
      </a-alert>
      <ul v-if="showHints && data.hints?.length" class="tw-hints">
        <li v-for="(h, i) in data.hints" :key="i">
          {{ h.text }}
          <TraceTag v-if="h.manualSection" tone="blue" style="margin-left: 8px">{{
            t('creationTask.diagnosis.manual', { section: h.manualSection })
          }}</TraceTag>
        </li>
      </ul>
    </div>

    <a-empty v-if="!rows.length" :description="t('creationTask.spans.empty')" />
    <template v-else>
      <div class="tw-toolbar">
        <a-button size="small" type="link" @click="expandAll">{{
          t('creationTask.spans.expandAll')
        }}</a-button>
        <a-button size="small" type="link" @click="collapseAll">{{
          t('creationTask.spans.collapseAll')
        }}</a-button>
        <span class="tw-legend">
          <span v-for="s in legend" :key="s" class="tw-legend__item">
            <i :style="{ background: statusColor(s, isDark) }" />{{ t(`creationTask.spans.status.${s}`) }}
          </span>
          <span v-if="criticalSet.size" class="tw-legend__item">
            <i class="tw-legend__crit" />{{ t('latency.criticalPath') }}
          </span>
        </span>
      </div>
      <div
        ref="viewport"
        class="tw-viewport"
        :style="{ maxHeight: `${VIEW_H}px` }"
        @scroll.passive="onScroll"
      >
        <div class="tw-inner">
          <div class="tw-axis">
            <div class="tw-left tw-axis__label">{{ t('creationTask.spans.spanCol') }}</div>
            <div class="tw-right tw-axis__ticks">
              <span
                v-for="tk in ticks"
                :key="tk.pct"
                class="tw-tick"
                :style="{ left: `${tk.pct}%` }"
                :class="{ 'tw-tick--last': tk.pct === 100 }"
                >{{ tk.label }}</span
              >
            </div>
          </div>
          <div class="tw-body" :style="{ height: `${rows.length * ROW_H}px` }">
            <div
              v-for="item in windowRows"
              :key="item.row.node.span.id"
              class="tw-row"
              :class="{
                'tw-row--failing': item.row.node.span.id === data.failingSpanId,
                'tw-row--stuck': item.row.node.span.id === data.stuckSpanId,
                'tw-row--selected': item.row.node.span.id === selectedId,
                'tw-row--critical': criticalSet.has(item.row.node.span.id),
                'tw-row--focus': item.row.node.span.id === focusedId,
              }"
              :style="{ top: `${item.index * ROW_H}px`, height: `${ROW_H}px` }"
              @click="select(item.row.node.span.id)"
            >
              <div class="tw-left">
                <span class="tw-indent" :style="{ width: `${item.row.depth * 16}px` }" />
                <span
                  v-if="item.row.hasChildren"
                  class="tw-toggle"
                  @click.stop="toggle(item.row.node.span.id)"
                >
                  <CaretRightOutlined v-if="item.row.collapsed" />
                  <CaretDownOutlined v-else />
                </span>
                <span v-else class="tw-toggle" />
                <span class="tw-status-icon">
                  <CheckCircleFilled
                    v-if="item.row.node.status === 'ok'"
                    :style="{ color: statusColor('ok', isDark) }"
                  />
                  <LoadingOutlined
                    v-else-if="item.row.node.status === 'running'"
                    :style="{ color: statusColor('running', isDark) }"
                  />
                  <CloseCircleFilled
                    v-else-if="isBad(item.row.node.status)"
                    :style="{ color: statusColor('failed', isDark) }"
                  />
                  <StopOutlined
                    v-else-if="item.row.node.status === 'cancelled'"
                    :style="{ color: statusColor('cancelled', isDark) }"
                  />
                  <MinusCircleOutlined
                    v-else-if="item.row.node.status === 'skipped'"
                    :style="{ color: statusColor('skipped', isDark) }"
                  />
                  <ClockCircleOutlined v-else :style="{ color: statusColor('pending', isDark) }" />
                </span>
                <TraceTag class="tw-svc" :tone="serviceTone(item.row.node.service)">{{
                  t(`creationTask.spans.service.${item.row.node.service}`)
                }}</TraceTag>
                <span class="tw-label" :title="item.row.node.span.key">{{
                  item.row.node.span.label || item.row.node.span.key
                }}</span>
                <span
                  v-if="item.row.node.span.attempt && item.row.node.span.attempt > 1"
                  class="tw-attempt"
                  >#{{ item.row.node.span.attempt }}</span
                >
                <TraceTag
                  v-if="item.row.node.span.id === data.stuckSpanId"
                  tone="orange"
                  class="tw-flag"
                  >{{ t('creationTask.spans.stuck') }}</TraceTag
                >
              </div>
              <div class="tw-right">
                <span
                  v-for="tk in gridTicks"
                  :key="tk.pct"
                  class="tw-grid"
                  :style="{ left: `${tk.pct}%` }"
                />
                <template v-if="geom(item.row.node)">
                  <span
                    v-if="geom(item.row.node)!.point"
                    class="tw-point"
                    :style="{
                      left: `${geom(item.row.node)!.left}%`,
                      background: statusColor(item.row.node.status, isDark),
                    }"
                  />
                  <span
                    v-else
                    class="tw-bar"
                    :class="{
                      'tw-bar--running': geom(item.row.node)!.running,
                      'tw-bar--root': isRoot(item.row.node),
                    }"
                    :style="{
                      left: `${geom(item.row.node)!.left}%`,
                      width: `max(${geom(item.row.node)!.width}%, 3px)`,
                      '--tw-c': statusColor(item.row.node.status, isDark),
                    }"
                  />
                  <span class="tw-dur" :style="durStyle(item.row.node)">{{
                    durText(item.row.node)
                  }}</span>
                </template>
                <span v-else class="tw-dur tw-dur--na">{{ t('creationTask.spans.noTime') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 详情抽屉 -->
    <a-drawer
      :open="!!selectedNode"
      :title="selectedNode ? selectedNode.span.label || selectedNode.span.key : ''"
      :width="480"
      @close="selectedId = null"
    >
      <template v-if="selectedNode">
        <a-space wrap style="margin-bottom: 12px">
          <TraceTag :tone="serviceTone(selectedNode.service)">{{
            t(`creationTask.spans.service.${selectedNode.service}`)
          }}</TraceTag>
          <TraceTag :tone="statusTone(selectedNode.status)">{{
            t(`creationTask.spans.status.${selectedNode.status}`)
          }}</TraceTag>
          <TraceTag v-if="selectedNode.span.id === data.stuckSpanId" tone="orange">{{
            t('creationTask.spans.stuck')
          }}</TraceTag>
        </a-space>
        <a-descriptions :column="1" size="small" bordered style="margin-bottom: 12px">
          <a-descriptions-item label="key"
            ><code>{{ selectedNode.span.key }}</code></a-descriptions-item
          >
          <a-descriptions-item label="id"
            ><code>{{ selectedNode.span.id }}</code></a-descriptions-item
          >
          <a-descriptions-item :label="t('creationTask.spans.startAt')">{{
            formatDateTime(selectedNode.span.startAt)
          }}</a-descriptions-item>
          <a-descriptions-item :label="t('creationTask.spans.endAt')">{{
            selectedNode.span.endAt ? formatDateTime(selectedNode.span.endAt) : '-'
          }}</a-descriptions-item>
          <a-descriptions-item :label="t('creationTask.spans.duration')">{{
            formatDuration(spanDurationMs(selectedNode, now))
          }}</a-descriptions-item>
          <a-descriptions-item
            v-if="selectedNode.span.attempt != null"
            :label="t('creationTask.spans.attempt')"
            >{{ selectedNode.span.attempt }}</a-descriptions-item
          >
        </a-descriptions>

        <a-alert
          v-if="selectedNode.span.failure"
          type="error"
          show-icon
          style="margin-bottom: 12px"
          :message="t('creationTask.spans.failure')"
        >
          <template #description>
            <div v-if="selectedNode.span.failure.class">
              {{ t('creationTask.spans.failureClass') }}:
              <code>{{ selectedNode.span.failure.class }}</code>
            </div>
            <div v-if="selectedNode.span.failure.code">
              {{ t('creationTask.spans.failureCode') }}:
              <code>{{ selectedNode.span.failure.code }}</code>
            </div>
            <div v-if="selectedNode.span.failure.check">
              {{ t('creationTask.trace.check') }}:
              <code>{{ selectedNode.span.failure.check }}</code>
            </div>
            <div v-if="selectedNode.span.failure.message" class="tw-msg">
              {{ selectedNode.span.failure.message }}
            </div>
          </template>
        </a-alert>

        <div v-if="selectedNode.span.external" class="tw-section">
          <div class="tw-section__title">{{ t('creationTask.spans.external') }}</div>
          <a-space wrap>
            <TraceTag tone="gray">{{ selectedNode.span.external.type }}</TraceTag>
            <code>{{ selectedNode.span.external.ref }}</code>
            <a-button size="small" @click="copyRef(selectedNode.span.external.ref)">
              <template #icon><CopyOutlined /></template>
              {{ t('creationTask.spans.copy') }}
            </a-button>
            <a-button
              v-if="gatewayCallId(selectedNode)"
              size="small"
              type="link"
              @click="openGatewayCall(gatewayCallId(selectedNode)!)"
            >
              {{ t('creationTask.spans.openGatewayCall') }}
            </a-button>
          </a-space>
        </div>

        <div v-if="attrEntries.length" class="tw-section">
          <div class="tw-section__title">{{ t('creationTask.spans.attrs') }}</div>
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item v-for="[k, v] in attrEntries" :key="k" :label="k">
              <span class="tw-attr">{{ String(v) }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import type { TaskSpan, TaskSpans } from '@/api/creation-task';

import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CopyOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  StopOutlined,
} from '@antdv-next/icons';
import { message } from 'antdv-next';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { copyToClipboard, formatDateTime } from '@/utils/helpers';

import TraceTag from '../TraceTag/index.vue';
import { ACCENT, GRID_LINE, pickColor, useIsDark } from '../trace-theme';

import {
  ancestorIds,
  axisTicks,
  barGeom,
  buildSpanTree,
  computeAxis,
  failureSummary,
  flattenTree,
  formatDuration,
  isBadStatus,
  overallStatus,
  serviceTone,
  spanDurationMs,
  statusColor,
  statusTone,
  type SpanNode,
} from './helpers';

const props = withDefaults(
  defineProps<{
    data: TaskSpans;
    /** 是否在头部展示排查提示 */
    showHints?: boolean;
    /** 能否跳转 AI 网关调用详情（无权限时只给复制） */
    canOpenGateway?: boolean;
    /** 关键路径 span id（高亮：行左侧粗标记 + 条描边） */
    criticalPath?: readonly string[];
    /** 外部指定要定位并闪烁的 span；同 id 重复定位请用 expose 的 focus() */
    focusSpanId?: string | null;
  }>(),
  { showHints: true, canOpenGateway: true, criticalPath: () => [], focusSpanId: null },
);

const { t } = useI18n();
const isDark = useIsDark();
const rootStyle = computed(() => ({
  '--tw-accent': pickColor(ACCENT, isDark.value),
  '--tw-grid': pickColor(GRID_LINE, isDark.value),
}));
const router = useRouter();

const ROW_H = 32;
const VIEW_H = 520;
const OVERSCAN = 10;
/** 超过该行数时默认只展开前两层（失败 / 卡点路径除外） */
const LARGE_TRACE = 300;

const tree = computed(() => buildSpanTree(props.data.spans));
const collapsed = ref<Set<string>>(new Set());
const selectedId = ref<string | null>(null);
const focusedId = ref<string | null>(null);
let focusTimer: ReturnType<typeof setTimeout> | null = null;
const criticalSet = computed(() => new Set(props.criticalPath || []));
const scrollTop = ref(0);
const viewport = ref<HTMLElement | null>(null);

// ---- 当前时间（仅用于运行中 span 的右端）：未终态才走表 ----
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
function syncTimer() {
  const live =
    !props.data.terminal && (props.data.spans || []).some((s) => s?.status === 'running');
  if (live && !timer) timer = setInterval(() => (now.value = Date.now()), 1000);
  else if (!live && timer) {
    clearInterval(timer);
    timer = null;
  }
}
watch(
  () => [props.data.terminal, props.data.spans],
  () => {
    now.value = Date.now();
    syncTimer();
  },
);
onMounted(syncTimer);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (focusTimer) clearTimeout(focusTimer);
});

const rows = computed(() => flattenTree(tree.value.roots, collapsed.value));
const axis = computed(() => computeAxis(props.data, tree.value.byId.values(), now.value));
const ticks = computed(() => axisTicks(axis.value, 5));
/** 网格线不含 0 / 100 */
const gridTicks = computed(() => ticks.value.filter((tk) => tk.pct > 0 && tk.pct < 100));
const totalMs = computed(() => props.data.totalMs ?? (rows.value.length ? axis.value.span : null));
const overall = computed(() => overallStatus(props.data));
const overallTone = computed(() =>
  overall.value === 'failed'
    ? 'red'
    : overall.value === 'running'
      ? 'blue'
      : overall.value === 'ok'
        ? 'green'
        : 'gray',
);
/** 根 span（「任务」，无父）：画成半透明轨道而不是实心条，让子节点更突出 */
function isRoot(n: SpanNode) {
  return n.span.id === 'task' || !n.span.parentId;
}
const failingNode = computed(() =>
  props.data.failingSpanId ? tree.value.byId.get(props.data.failingSpanId) || null : null,
);
const stuckNode = computed(() =>
  props.data.stuckSpanId ? tree.value.byId.get(props.data.stuckSpanId) || null : null,
);
const selectedNode = computed(() =>
  selectedId.value ? tree.value.byId.get(selectedId.value) || null : null,
);
const attrEntries = computed(() => Object.entries(selectedNode.value?.span.attrs || {}));
const legend = ['ok', 'running', 'failed', 'cancelled'] as const;

// ---- 虚拟滚动：行高固定，只渲染可视窗口 ± OVERSCAN ----
const windowRows = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN);
  const end = Math.min(rows.value.length, Math.ceil((scrollTop.value + VIEW_H) / ROW_H) + OVERSCAN);
  return rows.value.slice(start, end).map((row, i) => ({ row, index: start + i }));
});
function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop;
}

const geomCache = computed(() => {
  const m = new Map<string, ReturnType<typeof barGeom>>();
  for (const n of tree.value.byId.values()) m.set(n.span.id, barGeom(n, axis.value, now.value));
  return m;
});
function geom(n: SpanNode) {
  return geomCache.value.get(n.span.id) ?? null;
}
function durText(n: SpanNode) {
  const d = spanDurationMs(n, now.value);
  return d == null ? '' : formatDuration(d);
}
/** 耗时文字：条靠左时放条右侧，靠右（>60%）时放条左侧，避免溢出 */
function durStyle(n: SpanNode): CSSProperties {
  const g = geom(n);
  if (!g) return {};
  if (g.left + g.width > 60) return { right: `${100 - g.left}%`, paddingRight: '6px' };
  return { left: `${g.left + g.width}%`, paddingLeft: '6px' };
}

function isBad(s: unknown) {
  return isBadStatus(s);
}
function failureText(span: TaskSpan) {
  const f = span.failure;
  const head = [f?.class, f?.code].filter(Boolean).join(' / ');
  const msg = failureSummary(span);
  return head && msg !== head ? `${head}：${msg}` : msg;
}

// ---- 折叠 / 选择 / 定位 ----
function toggle(id: string) {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}
function expandAll() {
  collapsed.value = new Set();
}
function collapseAll() {
  const next = new Set<string>();
  for (const n of tree.value.byId.values()) if (n.children.length) next.add(n.span.id);
  collapsed.value = next;
}
function select(id: string) {
  selectedId.value = id;
}

/** 展开祖先并滚动到该行（失败 / 卡点自动调用，也用于头部「定位」按钮） */
async function locate(id: string) {
  const anc = ancestorIds(tree.value.byId, id);
  if (anc.some((a) => collapsed.value.has(a))) {
    const next = new Set(collapsed.value);
    anc.forEach((a) => next.delete(a));
    collapsed.value = next;
  }
  await nextTick();
  const idx = rows.value.findIndex((r) => r.node.span.id === id);
  if (idx < 0 || !viewport.value) return;
  const top = Math.max(0, idx * ROW_H - VIEW_H / 2 + ROW_H);
  viewport.value.scrollTo({ top, behavior: 'smooth' });
}

/** 定位并短暂高亮（不打开抽屉）；供外部「最慢节点」点击调用 */
async function focus(id: string) {
  if (!tree.value.byId.has(id)) return;
  focusedId.value = id;
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(() => (focusedId.value = null), 2500);
  await locate(id);
  viewport.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
watch(
  () => props.focusSpanId,
  (id) => {
    if (id) void focus(id);
  },
);
defineExpose({ focus });

/** 大 trace 默认折叠深层；失败 / 卡点祖先保持展开 */
function initCollapse() {
  const total = props.data.spans?.length || 0;
  if (total <= LARGE_TRACE) {
    collapsed.value = new Set();
    return;
  }
  const keep = new Set<string>([
    ...ancestorIds(tree.value.byId, props.data.failingSpanId),
    ...ancestorIds(tree.value.byId, props.data.stuckSpanId),
  ]);
  const next = new Set<string>();
  const walk = (n: SpanNode, depth: number) => {
    if (depth >= 1 && n.children.length && !keep.has(n.span.id)) next.add(n.span.id);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  tree.value.roots.forEach((r) => walk(r, 0));
  collapsed.value = next;
}

// 任务切换：重置折叠 / 选择；失败或卡点首次出现 / 变化：展开并滚动过去
watch(
  () => props.data.taskId,
  () => {
    selectedId.value = null;
    initCollapse();
  },
  { immediate: true },
);
watch(
  () =>
    [props.data.failingSpanId, props.data.stuckSpanId, props.data.spans?.length ? 1 : 0] as const,
  ([failing, stuck], old) => {
    const target = failing || stuck;
    const prev = old ? old[0] || old[1] : null;
    if (target && target !== prev) void nextTick(() => locate(target));
  },
  { immediate: true, flush: 'post' },
);

// ---- 外部引用 ----
async function copyRef(text: string) {
  if (await copyToClipboard(text)) message.success(t('common.copySuccess'));
  else message.error(t('common.copyFailed'));
}
/** 网关调用 id：external.type 含 gateway/call，或 service=gateway 且有 ref */
function gatewayCallId(n: SpanNode): string | null {
  const ext = n.span.external;
  if (!props.canOpenGateway || !ext?.ref) return null;
  return /gateway|call/i.test(ext.type) || n.service === 'gateway' ? ext.ref : null;
}
function openGatewayCall(callId: string) {
  selectedId.value = null;
  void router.push({ path: '/ai-gateway/calls', query: { callId } });
}
</script>

<style scoped>
.tw-row--critical {
  box-shadow: inset 3px 0 0 var(--tw-accent);
}
.tw-row--critical .tw-bar {
  outline: 1px solid var(--tw-accent);
  outline-offset: 1px;
}
.tw-row--focus {
  background: color-mix(in srgb, var(--color-primary, #1677ff) 18%, transparent) !important;
}
.tw-legend__crit {
  width: 3px !important;
  height: 12px !important;
  margin-right: 6px !important;
  border-radius: 2px;
  background: var(--tw-accent) !important;
}
.tw {
  --tw-left-w: 360px;
}
.tw-header {
  margin-bottom: 8px;
}
.tw-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.tw-meta--live {
  color: var(--color-primary, #1677ff);
}
.tw-alert {
  margin-top: 8px;
}
.tw-hints {
  margin: 8px 0 0;
  padding-left: 20px;
}
.tw-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.tw-legend {
  margin-left: auto;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.tw-legend__item i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 2px;
}
.tw-viewport {
  overflow: auto;
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  background: var(--color-bg-container);
}
.tw-inner {
  min-width: 760px;
}
.tw-axis {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  height: 28px;
  background: var(--color-fill-quaternary);
  border-bottom: 1px solid var(--color-border-secondary);
}
.tw-axis__label {
  align-items: center;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.tw-axis__ticks {
  position: relative;
}
.tw-tick {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.tw-tick:first-child {
  transform: none;
  margin-left: 4px;
}
.tw-tick--last {
  transform: translateX(-100%);
  margin-left: -4px;
}
.tw-body {
  position: relative;
}
.tw-row {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-secondary);
  box-sizing: border-box;
}
.tw-row:hover {
  background: var(--color-fill-quaternary, rgba(127, 127, 127, 0.08));
}
.tw-row--selected {
  background: color-mix(in srgb, var(--color-primary, #1677ff) 12%, transparent);
}
.tw-row--stuck {
  background: color-mix(in srgb, var(--color-warning, #faad14) 12%, transparent);
}
.tw-row--failing {
  background: color-mix(in srgb, var(--color-error, #ff4d4f) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--color-error, #ff4d4f);
}
.tw-left {
  flex: none;
  width: var(--tw-left-w);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  overflow: hidden;
  box-sizing: border-box;
}
.tw-right {
  position: relative;
  flex: 1;
  min-width: 400px;
  border-left: 1px solid var(--color-border-secondary);
}
.tw-axis .tw-left {
  display: flex;
}
.tw-indent {
  flex: none;
}
.tw-toggle {
  flex: none;
  width: 14px;
  font-size: 11px;
  color: var(--color-text-secondary);
  text-align: center;
}
.tw-status-icon {
  flex: none;
}
.tw-svc {
  flex: none;
  margin: 0 2px;
  line-height: 18px;
}
.tw-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.tw-attempt {
  flex: none;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.tw-flag {
  flex: none;
  margin: 0;
}
.tw-grid {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--tw-grid);
}
.tw-bar {
  position: absolute;
  top: 9px;
  height: 14px;
  border-radius: 3px;
  background: var(--tw-c);
  opacity: 0.9;
}
/* 根节点「任务」：与子节点同样的实心状态色（同商拍批次页的观感），略矮、略淡，表示整体跨度 */
.tw-bar--root {
  top: 11px;
  height: 10px;
  opacity: 0.55;
}
.tw-bar--running {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.3) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0.3) 75%,
    transparent 75%
  );
  background-size: 16px 16px;
  animation: tw-stripe 0.8s linear infinite;
}
.tw-bar--root.tw-bar--running {
  background-image: none;
  animation: none;
}
@keyframes tw-stripe {
  to {
    background-position: 16px 0;
  }
}
.tw-point {
  position: absolute;
  top: 12px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  transform: rotate(45deg);
}
.tw-dur {
  position: absolute;
  top: 0;
  line-height: 31px;
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tw-dur--na {
  left: 8px;
}
.tw-section {
  margin-bottom: 12px;
}
.tw-section__title {
  margin-bottom: 6px;
  font-weight: 600;
}
.tw-msg,
.tw-attr {
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
