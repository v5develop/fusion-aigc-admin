<template>
  <div ref="rootEl" class="tw" :style="rootStyle">
    <!-- 头部：整体状态、总耗时、失败摘要、卡点、排查提示 -->
    <div class="tw-header">
      <div class="tw-meta-line">
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
        <span v-if="rows.length" class="tw-actions">
          <a-button size="small" type="link" @click="expandAll">{{
            t('creationTask.spans.expandAll')
          }}</a-button>
          <a-button size="small" type="link" @click="collapseAll">{{
            t('creationTask.spans.collapseAll')
          }}</a-button>
        </span>
      </div>
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
      <!-- 图例：状态色（条）+ 服务圆点 + 关键路径竖条 -->
      <div class="tw-legend">
        <span class="tw-legend__group">
          <span v-for="s in legend" :key="s" class="tw-legend__item">
            <i class="tw-legend__swatch" :style="{ background: statusColor(s, isDark) }" />{{
              t(`creationTask.spans.status.${s}`)
            }}
          </span>
        </span>
        <span class="tw-legend__group">
          <span v-for="s in serviceLegend" :key="s" class="tw-legend__item">
            <i class="tw-legend__dot" :style="{ background: svcColor(s) }" />{{
              t(`creationTask.spans.service.${s}`)
            }}
          </span>
        </span>
        <span v-if="criticalSet.size" class="tw-legend__group">
          <span class="tw-legend__item">
            <i class="tw-legend__rail" />{{ t('latency.criticalPath') }}
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
            <div class="tw-cell tw-cell--name tw-axis__title">
              {{ t('creationTask.spans.node') }}
            </div>
            <div class="tw-cell tw-cell--dur tw-axis__title tw-axis__title--dur">
              {{ t('creationTask.spans.duration') }}
            </div>
            <div class="tw-cell tw-cell--line">
              <div class="tw-plot">
                <span
                  v-for="tk in ticks"
                  :key="tk.pct"
                  class="tw-tick"
                  :style="{ left: `${tk.pct}%` }"
                  >{{ tk.label }}</span
                >
              </div>
            </div>
          </div>
          <div class="tw-body" :style="{ height: `${rows.length * ROW_H}px` }">
            <div class="tw-gridlayer">
              <div class="tw-plot">
                <span
                  v-for="tk in gridTicks"
                  :key="tk.pct"
                  class="tw-grid"
                  :style="{ left: `${tk.pct}%` }"
                />
              </div>
            </div>
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
              <div
                class="tw-cell tw-cell--name"
                :title="nameTitle(item.row.node)"
              >
                <span
                  v-for="d in item.row.depth"
                  :key="d"
                  class="tw-guide"
                  aria-hidden="true"
                />
                <span
                  v-if="item.row.hasChildren"
                  class="tw-toggle tw-toggle--on"
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
                <i class="tw-svc" :style="{ background: svcColor(item.row.node.service) }" />
                <span class="tw-label">
                  <template v-for="p in [labelParts(item.row.node)]" :key="0">
                    <span v-if="p.prefix" class="tw-label__prefix">{{ p.prefix }}</span>
                    <span class="tw-label__main">{{ p.main }}</span>
                    <span v-if="p.note" class="tw-label__note"> （{{ p.note }}）</span>
                  </template>
                </span>
                <span
                  v-if="item.row.node.span.attempt && item.row.node.span.attempt > 1 && !(item.row.node.span.label || '').includes(`#${item.row.node.span.attempt}`)"
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
              <div
                class="tw-cell tw-cell--dur"
                :class="{ 'tw-cell--running': geom(item.row.node)?.running }"
              >
                <template v-if="durText(item.row.node)">{{ durText(item.row.node) }}</template>
                <span v-else class="tw-dur--na">—</span>
              </div>
              <div class="tw-cell tw-cell--line">
                <div class="tw-plot">
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
                      :class="{ 'tw-bar--running': geom(item.row.node)!.running }"
                      :style="{
                        left: `${geom(item.row.node)!.left}%`,
                        width: `max(${geom(item.row.node)!.width}%, 3px)`,
                        '--tw-c': statusColor(item.row.node.status, isDark),
                      }"
                    />
                  </template>
                </div>
              </div>
            </div>
          </div>
          <!-- 列分隔条：拖动 / ← → 调宽，双击复位 -->
          <div
            class="tw-splitter"
            :class="{ 'tw-splitter--active': dragging }"
            role="separator"
            aria-orientation="vertical"
            tabindex="0"
            :aria-label="t('creationTask.spans.node')"
            :aria-valuenow="nameW"
            :aria-valuemin="NAME_MIN"
            :style="{ left: `${nameW - 3}px` }"
            @pointerdown="onSplitDown"
            @pointermove="onSplitMove"
            @pointerup="onSplitUp"
            @pointercancel="onSplitUp"
            @keydown="onSplitKey"
            @dblclick="resetNameW"
          />
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
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { copyToClipboard, formatDateTime } from '@/utils/helpers';

import { useAuthStore } from '@/stores/auth';

import TraceTag from '../TraceTag/index.vue';
import { ACCENT, GRID_LINE, TONES, pickColor, useIsDark } from '../trace-theme';

import {
  ancestorIds,
  barGeom,
  buildSpanTree,
  computeAxis,
  failureSummary,
  flattenTree,
  formatDuration,
  isBadStatus,
  overallStatus,
  niceTicks,
  serviceTone,
  splitLabel,
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
    /** 关键路径 span id（高亮：行左缘 3px 紫色竖条） */
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
  '--tw-name-w': `${nameW.value}px`,
  '--tw-dur-w': `${DUR_W}px`,
  '--tw-inner-min': `${nameW.value + DUR_W + LINE_MIN}px`,
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
onMounted(() => {
  syncTimer();
  if (rootEl.value) {
    rootW.value = rootEl.value.clientWidth || rootW.value;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (w) rootW.value = w;
      });
      resizeObs.observe(rootEl.value);
    }
  }
});
onBeforeUnmount(() => {
  resizeObs?.disconnect();
  if (timer) clearInterval(timer);
  if (focusTimer) clearTimeout(focusTimer);
});

const rows = computed(() => flattenTree(tree.value.roots, collapsed.value));
const axis = computed(() => computeAxis(props.data, tree.value.byId.values(), now.value));
const ticks = computed(() => niceTicks(axis.value, 7));
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
/** 本次链路里出现过的服务（图例的圆点说明），按固定顺序 */
const SERVICE_ORDER = ['java', 'go', 'media', 'gateway', 'gpu', 'admin', 'user'] as const;
const serviceLegend = computed(() => {
  const seen = new Set<string>();
  for (const n of tree.value.byId.values()) seen.add(n.service);
  return SERVICE_ORDER.filter((s) => seen.has(s));
});
function svcColor(service: unknown) {
  return pickColor(TONES[serviceTone(service)], isDark.value);
}
function labelParts(n: SpanNode) {
  return splitLabel(n.span.label || n.span.key || '');
}
function nameTitle(n: SpanNode) {
  const svc = t(`creationTask.spans.service.${n.service}`);
  return `${n.span.label || n.span.key}\n${svc} · ${n.span.key}`;
}

// ---- 列宽：默认 38%（320px ~ 60%），可拖动，按账号记住 ----
const NAME_MIN = 320;
const NAME_DEFAULT_RATIO = 0.38;
const NAME_MAX_RATIO = 0.6;
const DUR_W = 76;
const LINE_MIN = 240;
const rootEl = ref<HTMLElement | null>(null);
const rootW = ref(1000);
let resizeObs: ResizeObserver | null = null;
const authStore = useAuthStore();
const storeKey = computed(() => `app-trace-waterfall-name-w:${authStore.user?.id ?? 'anon'}`);
function loadNameW(): number | null {
  try {
    const v = Number(localStorage.getItem(storeKey.value));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function saveNameW(v: number | null) {
  try {
    if (v == null) localStorage.removeItem(storeKey.value);
    else localStorage.setItem(storeKey.value, String(Math.round(v)));
  } catch {
    /* 隐私模式 / 配额：忽略，仅本次生效 */
  }
}
const userNameW = ref<number | null>(loadNameW());
function clampNameW(v: number) {
  const max = Math.max(NAME_MIN, rootW.value * NAME_MAX_RATIO);
  return Math.round(Math.min(max, Math.max(NAME_MIN, v)));
}
const nameW = computed(() =>
  clampNameW(userNameW.value ?? rootW.value * NAME_DEFAULT_RATIO),
);
const dragging = ref(false);
let dragStartX = 0;
let dragStartW = 0;
function onSplitDown(e: PointerEvent) {
  dragging.value = true;
  dragStartX = e.clientX;
  dragStartW = nameW.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}
function onSplitMove(e: PointerEvent) {
  if (!dragging.value) return;
  userNameW.value = clampNameW(dragStartW + e.clientX - dragStartX);
}
function onSplitUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* 已释放 */
  }
  saveNameW(userNameW.value);
}
function onSplitKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  userNameW.value = clampNameW(nameW.value + (e.key === 'ArrowLeft' ? -16 : 16));
  saveNameW(userNameW.value);
}
function resetNameW() {
  userNameW.value = null;
  saveNameW(null);
}


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
  // 点事件（零时长）不显示耗时，由模板落到「—」
  if (geom(n)?.point) return '';
  const d = spanDurationMs(n, now.value);
  return d == null ? '' : formatDuration(d);
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
.tw {
  --tw-row-h: 32px;
  --tw-dur-w: 76px;
  --tw-guide: var(--color-border);
  position: relative;
}
.tw-header {
  margin-bottom: 8px;
}
.tw-meta-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}
.tw-actions {
  display: inline-flex;
  gap: 4px;
}
.tw-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.tw-meta b {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
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

/* 图例 */
.tw-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.tw-legend__group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.tw-legend__item {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.tw-legend__swatch {
  display: inline-block;
  width: 14px;
  height: 8px;
  margin-right: 6px;
  border-radius: 2px;
}
.tw-legend__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}
.tw-legend__rail {
  display: inline-block;
  width: 3px;
  height: 12px;
  margin-right: 6px;
  border-radius: 2px;
  background: var(--tw-accent);
}

/* 容器与三列：名称 | 耗时 | 时间轴 */
.tw-viewport {
  overflow: auto;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-container);
}
.tw-inner {
  position: relative;
  min-width: var(--tw-inner-min, 640px);
}
.tw-cell {
  box-sizing: border-box;
  flex: none;
}
.tw-cell--name {
  display: flex;
  align-items: center;
  width: var(--tw-name-w);
  padding: 0 8px;
  overflow: hidden;
  border-right: 1px solid var(--color-border-secondary);
}
.tw-cell--dur {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: var(--tw-dur-w);
  padding: 0 12px 0 4px;
  border-right: 1px solid var(--color-border-secondary);
  font-size: 12px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tw-cell--running {
  color: var(--color-primary, #1677ff);
}
.tw-cell--line {
  position: relative;
  flex: 1;
  min-width: 0;
}
.tw-dur--na {
  color: var(--color-text-quaternary, var(--color-text-tertiary));
}
/* 时间区内再留边距，让首尾刻度文字不被裁切 */
.tw-plot {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 16px;
  right: 32px;
}

/* 表头（吸顶） */
.tw-axis {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  height: 32px;
  background: var(--color-bg-container);
  border-bottom: 1px solid var(--color-border-secondary);
}
.tw-axis .tw-cell {
  background: var(--color-fill-quaternary);
}
.tw-axis__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.tw-axis__title--dur {
  padding-right: 12px;
}
.tw-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  transform: translateX(-50%);
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tw-tick::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  height: 4px;
  border-left: 1px solid var(--color-border);
}

/* 行 */
.tw-body {
  position: relative;
}
.tw-gridlayer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--tw-name-w) + var(--tw-dur-w));
  right: 0;
  z-index: 1;
  pointer-events: none;
}
.tw-grid {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--tw-grid);
}
.tw-row {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  box-sizing: border-box;
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-secondary) 55%, transparent);
}
.tw-row:hover {
  background: var(--color-fill-quaternary, rgba(127, 127, 127, 0.08));
}
.tw-row--failing {
  background: color-mix(in srgb, var(--color-error, #ff4d4f) 8%, transparent);
}
.tw-row--stuck {
  background: color-mix(in srgb, var(--color-warning, #faad14) 10%, transparent);
}
.tw-row--selected,
.tw-row--selected:hover {
  background: color-mix(in srgb, var(--color-primary, #1677ff) 12%, transparent);
}
.tw-row--focus {
  background: color-mix(in srgb, var(--color-primary, #1677ff) 18%, transparent) !important;
}
/* 关键路径：仅行左缘 3px 紫色竖条 */
.tw-row--critical::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 3px;
  background: var(--tw-accent);
}

/* 名称单元 */
.tw-guide {
  flex: none;
  align-self: stretch;
  width: 16px;
  background: linear-gradient(var(--tw-guide), var(--tw-guide)) 50% 0 / 1px 100% no-repeat;
  opacity: 0.55;
}
.tw-toggle {
  flex: none;
  width: 16px;
  font-size: 11px;
  color: var(--color-text-tertiary, var(--color-text-secondary));
  text-align: center;
}
.tw-toggle--on:hover {
  color: var(--color-text);
}
.tw-status-icon {
  flex: none;
  display: inline-flex;
  width: 16px;
  margin-right: 6px;
  font-size: 14px;
}
.tw-svc {
  flex: none;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
}
.tw-label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text);
}
.tw-label__prefix {
  margin-right: 5px;
}
.tw-label__prefix,
.tw-label__note {
  color: var(--color-text-tertiary, var(--color-text-secondary));
  font-size: 12px;
}
.tw-attempt {
  flex: none;
  margin-left: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary, var(--color-text-secondary));
}
.tw-flag {
  flex: none;
  margin: 0 0 0 6px;
}

/* 条与点：统一 12px 高、3px 圆角、实色 */
.tw-bar {
  position: absolute;
  top: 9px;
  height: 12px;
  border-radius: 3px;
  background-color: var(--tw-c);
}
.tw-bar--running {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.22) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.22) 75%,
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
  width: 8px;
  height: 8px;
  margin-left: -4px;
  transform: rotate(45deg);
}

/* 列分隔条 */
.tw-splitter {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: 7px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}
.tw-splitter::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: transparent;
  transition: background 0.15s;
}
.tw-splitter:hover::after,
.tw-splitter:focus-visible::after,
.tw-splitter--active::after {
  left: 2px;
  width: 3px;
  background: var(--color-primary, #1677ff);
  opacity: 0.55;
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
