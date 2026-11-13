<template>
  <div class="tw">
    <!-- 头部：整体状态、总耗时、失败摘要、卡点、排查提示 -->
    <div class="tw-header">
      <a-space wrap :size="[12, 4]">
        <a-tag :color="overallTagColor">{{ t(`creationTask.spans.overall.${overall}`) }}</a-tag>
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
          <a-tag v-if="h.manualSection" color="blue" style="margin-left: 8px">{{
            t('creationTask.diagnosis.manual', { section: h.manualSection })
          }}</a-tag>
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
            <i :style="{ background: statusColor(s) }" />{{ t(`creationTask.spans.status.${s}`) }}
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
                    :style="{ color: statusColor('ok') }"
                  />
                  <LoadingOutlined
                    v-else-if="item.row.node.status === 'running'"
                    :style="{ color: statusColor('running') }"
                  />
                  <CloseCircleFilled
                    v-else-if="isBad(item.row.node.status)"
                    :style="{ color: statusColor('failed') }"
                  />
                  <StopOutlined
                    v-else-if="item.row.node.status === 'cancelled'"
                    :style="{ color: statusColor('cancelled') }"
                  />
                  <MinusCircleOutlined
                    v-else-if="item.row.node.status === 'skipped'"
                    :style="{ color: statusColor('skipped') }"
                  />
                  <ClockCircleOutlined v-else :style="{ color: statusColor('pending') }" />
                </span>
                <a-tag class="tw-svc" :color="serviceColor(item.row.node.service)">{{
                  t(`creationTask.spans.service.${item.row.node.service}`)
                }}</a-tag>
                <span class="tw-label" :title="item.row.node.span.key">{{
                  item.row.node.span.label || item.row.node.span.key
                }}</span>
                <span
                  v-if="item.row.node.span.attempt && item.row.node.span.attempt > 1"
                  class="tw-attempt"
                  >#{{ item.row.node.span.attempt }}</span
                >
                <a-tag
                  v-if="item.row.node.span.id === data.stuckSpanId"
                  color="orange"
                  class="tw-flag"
                  >{{ t('creationTask.spans.stuck') }}</a-tag
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
                      background: statusColor(item.row.node.status),
                    }"
                  />
                  <span
                    v-else
                    class="tw-bar"
                    :class="{ 'tw-bar--running': geom(item.row.node)!.running }"
                    :style="{
                      left: `${geom(item.row.node)!.left}%`,
                      width: `max(${geom(item.row.node)!.width}%, 3px)`,
                      '--tw-c': statusColor(item.row.node.status),
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
          <a-tag :color="serviceColor(selectedNode.service)">{{
            t(`creationTask.spans.service.${selectedNode.service}`)
          }}</a-tag>
          <a-tag :color="statusColor(selectedNode.status)">{{
            t(`creationTask.spans.status.${selectedNode.status}`)
          }}</a-tag>
          <a-tag v-if="selectedNode.span.id === data.stuckSpanId" color="orange">{{
            t('creationTask.spans.stuck')
          }}</a-tag>
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
            <a-tag>{{ selectedNode.span.external.type }}</a-tag>
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
  serviceColor,
  spanDurationMs,
  statusColor,
  type SpanNode,
} from './helpers';

const props = withDefaults(
  defineProps<{
    data: TaskSpans;
    /** 是否在头部展示排查提示 */
    showHints?: boolean;
    /** 能否跳转 AI 网关调用详情（无权限时只给复制） */
    canOpenGateway?: boolean;
  }>(),
  { showHints: true, canOpenGateway: true },
);

const { t } = useI18n();
const router = useRouter();

const ROW_H = 32;
const VIEW_H = 520;
const OVERSCAN = 10;
/** 超过该行数时默认只展开前两层（失败 / 卡点路径除外） */
const LARGE_TRACE = 300;

const tree = computed(() => buildSpanTree(props.data.spans));
const collapsed = ref<Set<string>>(new Set());
const selectedId = ref<string | null>(null);
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
});

const rows = computed(() => flattenTree(tree.value.roots, collapsed.value));
const axis = computed(() => computeAxis(props.data, tree.value.byId.values(), now.value));
const ticks = computed(() => axisTicks(axis.value, 5));
/** 网格线不含 0 / 100 */
const gridTicks = computed(() => ticks.value.filter((tk) => tk.pct > 0 && tk.pct < 100));
const totalMs = computed(() => props.data.totalMs ?? (rows.value.length ? axis.value.span : null));
const overall = computed(() => overallStatus(props.data));
const overallTagColor = computed(() =>
  overall.value === 'failed'
    ? 'red'
    : overall.value === 'running'
      ? 'processing'
      : overall.value === 'ok'
        ? 'green'
        : 'default',
);
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
  color: #1677ff;
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
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 6px;
  background: var(--color-bg-container, #fff);
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
  background: var(--color-fill-quaternary, #fafafa);
  border-bottom: 1px solid var(--color-border-secondary, #f0f0f0);
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
  border-bottom: 1px solid var(--color-border-secondary, #f0f0f0);
  box-sizing: border-box;
}
.tw-row:hover {
  background: var(--color-fill-quaternary, rgba(127, 127, 127, 0.08));
}
.tw-row--selected {
  background: rgba(22, 119, 255, 0.1);
}
.tw-row--stuck {
  background: rgba(250, 173, 20, 0.14);
}
.tw-row--failing {
  background: rgba(255, 77, 79, 0.12);
  box-shadow: inset 3px 0 0 #ff4d4f;
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
  border-left: 1px solid var(--color-border-secondary, #f0f0f0);
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
  border-left: 1px dashed var(--color-border-secondary, #f0f0f0);
}
.tw-bar {
  position: absolute;
  top: 9px;
  height: 14px;
  border-radius: 3px;
  background: var(--tw-c);
  opacity: 0.9;
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
@keyframes tw-stripe {
  to {
    background-position: 16px 0;
  }
}
.tw-point {
  position: absolute;
  top: 11px;
  width: 10px;
  height: 10px;
  margin-left: -5px;
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
