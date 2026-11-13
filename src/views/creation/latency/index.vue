<template>
  <div class="page-container latency-page">
    <a-card :title="t('latency.page.title')" style="margin-bottom: 16px">
      <template #extra>
        <a-button :loading="loading" @click="loadAll">
          <template #icon><ReloadOutlined /></template>
          {{ t('common.refresh') }}
        </a-button>
      </template>
      <div class="lp-filters">
        <a-radio-group v-model:value="preset" button-style="solid" @change="onPresetChange">
          <a-radio-button value="1h">{{ t('latency.page.preset1h') }}</a-radio-button>
          <a-radio-button value="24h">{{ t('latency.page.preset24h') }}</a-radio-button>
          <a-radio-button value="7d">{{ t('latency.page.preset7d') }}</a-radio-button>
          <a-radio-button value="custom">{{ t('latency.page.presetCustom') }}</a-radio-button>
        </a-radio-group>
        <a-range-picker
          v-if="preset === 'custom'"
          v-model:value="customRange"
          show-time
          :disabled-date="disabledFuture"
        />
        <a-select
          v-model:value="filters.entryCode"
          allow-clear
          show-search
          option-filter-prop="label"
          :placeholder="t('latency.page.entry')"
          :options="entryOptions"
          style="width: 170px"
        />
        <a-select
          v-model:value="filters.modelCode"
          allow-clear
          show-search
          option-filter-prop="label"
          :placeholder="t('latency.page.model')"
          :options="modelOptions"
          style="width: 170px"
        />
        <a-select
          v-model:value="filters.provider"
          allow-clear
          show-search
          :placeholder="t('latency.page.provider')"
          :options="providerOptions"
          style="width: 140px"
        />
        <a-select
          v-model:value="filters.status"
          allow-clear
          :placeholder="t('creationTask.status')"
          :options="statusOptions"
          style="width: 120px"
        />
        <a-select v-model:value="groupBy" :options="groupByOptions" style="width: 150px" />
        <a-button type="primary" :loading="loading" @click="loadAll">{{
          t('common.search')
        }}</a-button>
      </div>
    </a-card>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      style="margin-bottom: 16px"
      :message="t('latency.page.loadFail')"
      :description="loadError"
    />
    <a-alert
      v-if="stats?.degradedCount && stats.degradedCount > 0"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="t('latency.page.degraded', { n: stats.degradedCount })"
    />
    <a-alert
      v-if="stats?.gatewayDegradedCount && stats.gatewayDegradedCount > 0"
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="t('latency.page.gatewayDegraded', { n: stats.gatewayDegradedCount })"
    />
    <a-alert
      v-if="stats?.truncated"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="t('latency.page.truncated')"
    />

    <a-spin :spinning="loading">
      <!-- KPI -->
      <a-row :gutter="[16, 16]" style="margin-bottom: 16px">
        <a-col :xs="12" :md="6" :xl="4">
          <a-card variant="borderless"
            ><a-statistic :title="t('latency.page.samples')" :value="stats?.sampleCount ?? 0"
          /></a-card>
        </a-col>
        <a-col v-for="k in kpis" :key="k.key" :xs="12" :md="6" :xl="4">
          <a-card variant="borderless">
            <a-statistic :title="k.title" :value="k.value" :value-style="{ color: k.color }" />
          </a-card>
        </a-col>
      </a-row>

      <a-empty
        v-if="!loading && stats && !stats.sampleCount"
        :description="t('latency.page.noData')"
      />

      <template v-if="stats && stats.sampleCount">
        <!-- 调优建议 -->
        <a-card :title="t('latency.page.adviceTitle')" style="margin-bottom: 16px">
          <a-space direction="vertical" style="width: 100%">
            <a-alert
              v-for="(a, i) in advices"
              :key="i"
              :type="a.level"
              show-icon
              :message="adviceText(a)"
            />
          </a-space>
          <div v-if="vendorNeedsGroupHint" class="lp-hint">
            {{ t('latency.page.vendorGroupHint') }}
          </div>
        </a-card>

        <!-- 阶段构成 -->
        <a-card :title="t('latency.page.categoryTitle')" style="margin-bottom: 16px">
          <div class="lp-subtitle">{{ t('latency.page.shareBar') }}</div>
          <StackedBar :items="shareItems" :height="28" />
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :xs="24" :xl="12">
              <a-table
                size="small"
                :pagination="false"
                row-key="category"
                :columns="categoryColumns"
                :data-source="categoryRows"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'name'">
                    <TraceTag :tone="categoryColor(record.category, theme.isDark)">{{ record.name }}</TraceTag>
                  </template>
                  <template v-else-if="column.dataIndex === 'sharePct'">
                    <b>{{ record.sharePct.toFixed(1) }}%</b>
                  </template>
                  <template
                    v-else-if="['p50', 'p90', 'p99', 'avg'].includes(String(column.dataIndex))"
                  >
                    {{ formatDuration(record[String(column.dataIndex)]) }}
                  </template>
                </template>
              </a-table>
            </a-col>
            <a-col :xs="24" :xl="12">
              <div class="lp-subtitle">{{ t('latency.page.percentileChart') }}</div>
              <VChart class="lp-chart" :option="categoryChartOption" autoresize />
            </a-col>
          </a-row>
        </a-card>

        <!-- 分组对比 -->
        <a-card :title="groupTitle" style="margin-bottom: 16px">
          <div class="lp-subtitle">
            {{
              groupBy === 'day' ? t('latency.page.dayChartHint') : t('latency.page.rankChartHint')
            }}
          </div>
          <VChart class="lp-chart lp-chart--tall" :option="groupChartOption" autoresize />
          <a-table
            size="small"
            style="margin-top: 16px"
            row-key="key"
            :columns="groupColumns"
            :data-source="groupRows"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'label'">{{ record.label }}</template>
              <template v-else-if="column.dataIndex === 'dominant'">
                <TraceTag :tone="categoryColor(record.dominantCategory, theme.isDark)">{{
                  catLabel(record.dominantCategory)
                }}</TraceTag>
              </template>
              <template v-else-if="column.dataIndex === 'mix'">
                <StackedBar :items="record.mix" :height="14" />
              </template>
              <template v-else-if="['p50', 'p90', 'p99'].includes(String(column.dataIndex))">
                {{ formatDuration(record[String(column.dataIndex)]) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </template>

      <!-- 最慢任务 -->
      <a-card :title="t('latency.page.slowestTitle')">
        <template #extra>
          <a-space>
            <a-select
              v-model:value="slowCategory"
              allow-clear
              :placeholder="t('latency.page.slowestCategory')"
              :options="categoryFilterOptions"
              style="width: 170px"
              @change="loadSlowest"
            />
            <a-select
              v-model:value="slowLimit"
              :options="[20, 50, 100].map((n) => ({ value: n, label: `Top ${n}` }))"
              style="width: 100px"
              @change="loadSlowest"
            />
          </a-space>
        </template>
        <a-table
          size="small"
          row-key="taskId"
          :loading="slowLoading"
          :columns="slowColumns"
          :data-source="slowest"
          :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          :scroll="{ x: 1100 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'taskId'">
              <a-button type="link" size="small" @click="openTask(record)">{{
                record.taskId
              }}</a-button>
            </template>
            <template v-else-if="column.dataIndex === 'entry'">{{
              record.entryName || record.entryCode || '-'
            }}</template>
            <template v-else-if="column.dataIndex === 'model'">{{
              record.modelName || record.modelCode || '-'
            }}</template>
            <template v-else-if="column.dataIndex === 'providerDeployment'">
              {{ [record.provider, record.deployment].filter(Boolean).join(' / ') || '-' }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <TraceTag :tone="statusColorOf(record.status)">{{ statusLabel(record.status) }}</TraceTag>
            </template>
            <template v-else-if="column.dataIndex === 'totalMs'"
              ><b>{{ formatDuration(record.totalMs) }}</b></template
            >
            <template v-else-if="column.dataIndex === 'firstResultMs'">{{
              record.firstResultMs != null ? formatDuration(record.firstResultMs) : '-'
            }}</template>
            <template v-else-if="column.dataIndex === 'dominant'">
              <TraceTag :tone="categoryColor(record.dominantCategory, theme.isDark)">{{
                catLabel(record.dominantCategory)
              }}</TraceTag>
              {{ formatDuration(record.dominantMs) }}
            </template>
            <template v-else-if="column.dataIndex === 'submittedAt'">{{
              formatDateTime(record.submittedAt)
            }}</template>
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import type {
  LatencyGroupBy,
  LatencyGroupStat,
  LatencyOptions,
  LatencySlowTask,
  LatencyStats,
} from '@/api/creation-latency';

import { ReloadOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import dayjs, { type Dayjs } from 'dayjs';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, onMounted, reactive, ref } from 'vue';
import VChart from 'vue-echarts';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getLatencyOptions, getLatencySlowest, getLatencyStats } from '@/api/creation-latency';
import { getCreationTaskList } from '@/api/creation-task';
import {
  categoryColor,
  categoryI18nKey,
  formatDuration,
  LATENCY_CATEGORIES,
  sortByCategory,
} from '@/components/LatencySummary/categories';
import StackedBar from '@/components/LatencySummary/StackedBar.vue';
import TraceTag from '@/components/TraceTag/index.vue';
import { pickColor, TONES } from '@/components/trace-theme';
import { useThemeStore } from '@/stores/theme';
import { formatDateTime } from '@/utils/helpers';

import { buildAdvice, groupNamesTarget, type Advice } from './advice';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  LegacyGridContainLabel,
]);

const { t, te } = useI18n();
const router = useRouter();
const theme = useThemeStore();

// ---------------- 筛选 ----------------
const MAX_RANGE_DAYS = 31;
type Preset = '1h' | '24h' | '7d' | 'custom';
const preset = ref<Preset>('24h');
const customRange = ref<[Dayjs, Dayjs] | null>(null);
const filters = reactive<{
  entryCode?: string;
  modelCode?: string;
  provider?: string;
  status?: number;
}>({});
const groupBy = ref<LatencyGroupBy>('day');
const options = ref<LatencyOptions>({ entries: [], models: [], providers: [] });

const entryOptions = computed(() =>
  options.value.entries.map((e) => ({ value: e.code, label: e.name || e.code })),
);
const modelOptions = computed(() =>
  options.value.models.map((e) => ({ value: e.code, label: e.name || e.code })),
);
const providerOptions = computed(() =>
  options.value.providers.map((p) => ({ value: p, label: p })),
);
const statusOptions = computed(() =>
  [2, 3, 5, 4].map((v) => ({ value: v, label: statusLabel(v) })),
);
const groupByOptions = computed(() =>
  (['day', 'entry', 'model', 'provider', 'deployment'] as const).map((g) => ({
    value: g,
    label: t('latency.page.groupBy', { dim: t(`latency.page.dim.${g}`) }),
  })),
);
const categoryFilterOptions = computed(() =>
  LATENCY_CATEGORIES.map((c) => ({ value: c.code, label: catLabel(c.code) })),
);

const STATUS_KEYS: Record<number, string> = {
  0: 'statusQueuing',
  1: 'statusProcessing',
  2: 'statusCompleted',
  3: 'statusFailed',
  4: 'statusCancelled',
  5: 'statusPartialSuccess',
};
const STATUS_COLORS: Record<number, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'error',
  4: 'default',
  5: 'warning',
};
function statusLabel(s?: number | null) {
  return s != null && STATUS_KEYS[s] ? t(`creationTask.${STATUS_KEYS[s]}`) : '-';
}
function statusColorOf(s?: number | null) {
  return (s != null && STATUS_COLORS[s]) || 'default';
}

function disabledFuture(d: Dayjs) {
  return d.isAfter(dayjs());
}
function onPresetChange() {
  if (preset.value !== 'custom') void loadAll();
}

const FMT = 'YYYY-MM-DD HH:mm:ss';
/** 返回 null 表示自定义区间不合法（已提示） */
function resolveRange(): { from: string; to: string } | null {
  const now = dayjs();
  if (preset.value === 'custom') {
    const r = customRange.value;
    if (!r || !r[0] || !r[1]) {
      message.warning(t('latency.page.pickRange'));
      return null;
    }
    if (r[1].diff(r[0], 'day', true) > MAX_RANGE_DAYS) {
      message.warning(t('latency.page.rangeTooLong', { n: MAX_RANGE_DAYS }));
      return null;
    }
    return { from: r[0].format(FMT), to: r[1].format(FMT) };
  }
  const back = { '1h': [1, 'hour'], '24h': [24, 'hour'], '7d': [7, 'day'] } as const;
  const [n, unit] = back[preset.value];
  return { from: now.subtract(n, unit).format(FMT), to: now.format(FMT) };
}

// ---------------- 数据 ----------------
const loading = ref(false);
const loadError = ref('');
const stats = ref<LatencyStats | null>(null);
const slowest = ref<LatencySlowTask[]>([]);
const slowLoading = ref(false);
const slowCategory = ref<string | undefined>();
const slowLimit = ref(20);
/** 本次实际生效的筛选（stats 与 slowest 共用，避免相对时间每次请求都漂移） */
let applied: { from: string; to: string; groupBy: LatencyGroupBy } | null = null;

function baseQuery() {
  return {
    from: applied?.from,
    to: applied?.to,
    entryCode: filters.entryCode,
    modelCode: filters.modelCode,
    provider: filters.provider,
    status: filters.status,
  };
}

async function loadAll() {
  const range = resolveRange();
  if (!range) return;
  applied = { ...range, groupBy: groupBy.value };
  loading.value = true;
  loadError.value = '';
  try {
    const [s] = await Promise.all([
      getLatencyStats({ ...baseQuery(), groupBy: groupBy.value }),
      loadSlowest(),
    ]);
    stats.value = normalizeStats(s);
  } catch (e) {
    stats.value = null;
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function loadSlowest() {
  if (!applied) return;
  slowLoading.value = true;
  try {
    const res = await getLatencySlowest({
      ...baseQuery(),
      category: slowCategory.value,
      limit: slowLimit.value,
    });
    slowest.value = Array.isArray(res) ? res : [];
  } catch {
    slowest.value = [];
  } finally {
    slowLoading.value = false;
  }
}

const ZERO = { p50: 0, p90: 0, p99: 0, avg: 0 };
function normalizeStats(s: LatencyStats | null | undefined): LatencyStats {
  return {
    sampleCount: s?.sampleCount ?? 0,
    truncated: !!s?.truncated,
    degradedCount: s?.degradedCount ?? 0,
    gatewayDegradedCount: s?.gatewayDegradedCount ?? 0,
    total: s?.total ?? ZERO,
    firstResult: s?.firstResult ?? ZERO,
    categories: s?.categories ?? [],
    groups: s?.groups ?? [],
  };
}

onMounted(async () => {
  try {
    const o = await getLatencyOptions();
    options.value = {
      entries: o?.entries ?? [],
      models: o?.models ?? [],
      providers: o?.providers ?? [],
    };
  } catch {
    /* 下拉空着也能用 */
  }
  void loadAll();
});

/** 优先用后端返回的数字 id 直达详情；缺 id 时回退用列表关键字解析 */
async function openTask(row: LatencySlowTask) {
  if (row.id != null) {
    void router.push({ name: 'CreationTaskDetail', params: { id: String(row.id) } });
    return;
  }
  try {
    const res = await getCreationTaskList({ keyword: row.taskId, page: 1, pageSize: 5 });
    const hit = (res.list || []).find((x) => x.taskId === row.taskId);
    if (hit) {
      void router.push({ name: 'CreationTaskDetail', params: { id: String(hit.id) } });
      return;
    }
  } catch {
    /* 落到下面提示 */
  }
  message.warning(t('latency.page.taskNotFound'));
}

// ---------------- 展示派生 ----------------
function catLabel(code: string, backend?: string) {
  const key = categoryI18nKey(code);
  return te(key) ? t(key) : backend || code;
}

const kpis = computed(() => {
  const s = stats.value;
  const f = (ms?: number) => (s ? formatDuration(ms ?? 0) : '-');
  return [
    {
      key: 'p50',
      title: t('latency.page.totalP', { p: 'P50' }),
      value: f(s?.total.p50),
      color: '',
    },
    {
      key: 'p90',
      title: t('latency.page.totalP', { p: 'P90' }),
      value: f(s?.total.p90),
      color: pickColor(TONES.blue, theme.isDark),
    },
    {
      key: 'p99',
      title: t('latency.page.totalP', { p: 'P99' }),
      value: f(s?.total.p99),
      color: pickColor(TONES.orange, theme.isDark),
    },
    { key: 'fr', title: t('latency.page.firstResultP90'), value: f(s?.firstResult.p90), color: '' },
  ];
});

const categoryRows = computed(() =>
  sortByCategory(stats.value?.categories ?? []).map((c) => ({
    ...c,
    name: catLabel(c.category, c.label),
  })),
);
const shareItems = computed(() =>
  categoryRows.value.map((c) => ({ category: c.category, label: c.name, pct: c.sharePct })),
);
const categoryColumns = computed(() => [
  { title: t('latency.page.stage'), dataIndex: 'name', width: 120 },
  { title: 'P50', dataIndex: 'p50', align: 'right' as const },
  { title: 'P90', dataIndex: 'p90', align: 'right' as const },
  { title: 'P99', dataIndex: 'p99', align: 'right' as const },
  { title: t('latency.page.avg'), dataIndex: 'avg', align: 'right' as const },
  { title: t('latency.page.share'), dataIndex: 'sharePct', align: 'right' as const },
]);

const groupTitle = computed(() =>
  t('latency.page.groupTitle', { dim: t(`latency.page.dim.${groupBy.value}`) }),
);
function groupLabel(g: LatencyGroupStat) {
  return g.label || g.key;
}
const groupRows = computed(() => {
  const list = [...(stats.value?.groups ?? [])];
  if (applied?.groupBy === 'day') list.sort((a, b) => a.key.localeCompare(b.key));
  else list.sort((a, b) => b.total.p90 - a.total.p90);
  return list.map((g) => {
    const cats = Object.entries(g.categories ?? {});
    const sum = cats.reduce((a, [, v]) => a + (v.p90 || 0), 0) || 1;
    return {
      ...g,
      label: groupLabel(g),
      p50: g.total.p50,
      p90: g.total.p90,
      p99: g.total.p99,
      mix: cats.map(([category, v]) => ({
        category,
        ms: v.p90,
        pct: ((v.p90 || 0) / sum) * 100,
      })),
    };
  });
});
const groupColumns = computed(() => [
  {
    title: t(`latency.page.dim.${applied?.groupBy ?? groupBy.value}`),
    dataIndex: 'label',
    width: 180,
    fixed: 'left' as const,
  },
  {
    title: t('latency.page.samples'),
    dataIndex: 'sampleCount',
    width: 90,
    align: 'right' as const,
  },
  { title: 'P50', dataIndex: 'p50', width: 90, align: 'right' as const },
  { title: 'P90', dataIndex: 'p90', width: 90, align: 'right' as const },
  { title: 'P99', dataIndex: 'p99', width: 90, align: 'right' as const },
  { title: t('latency.page.dominant'), dataIndex: 'dominant', width: 120 },
  { title: t('latency.page.p90Mix'), dataIndex: 'mix', width: 240 },
]);

const slowColumns = computed(() => [
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 230 },
  { title: t('latency.page.entry'), dataIndex: 'entry', width: 140 },
  { title: t('latency.page.model'), dataIndex: 'model', width: 140 },
  { title: t('latency.page.providerDeployment'), dataIndex: 'providerDeployment', width: 200 },
  { title: t('creationTask.status'), dataIndex: 'status', width: 100 },
  { title: t('latency.total'), dataIndex: 'totalMs', width: 100, align: 'right' as const },
  {
    title: t('latency.firstResult'),
    dataIndex: 'firstResultMs',
    width: 100,
    align: 'right' as const,
  },
  { title: t('latency.page.dominant'), dataIndex: 'dominant', width: 180 },
  { title: t('latency.submittedAt'), dataIndex: 'submittedAt', width: 170 },
]);

// ---------------- 建议 ----------------
const advices = computed(() =>
  buildAdvice(stats.value, applied?.groupBy ?? groupBy.value, groupLabel, formatDuration),
);
function adviceText(a: Advice) {
  const p = { ...a.params };
  if (a.code === 'transfer') p.category = catLabel(String(p.category));
  return t(`latency.advice.${a.code}`, p);
}
/** 厂商占主导但当前分组维度无法指名厂商/部署 → 提示换分组 */
const vendorNeedsGroupHint = computed(
  () => advices.value.some((a) => a.code === 'vendor') && !groupNamesTarget(applied?.groupBy),
);

// ---------------- 图表 ----------------
const PCT_LIGHT = ['#91caff', '#1677ff', '#e07b39'];
const PCT_DARK = ['#3f5f86', '#4f8fd6', '#c4713f'];
const axisColor = computed(() => (theme.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'));
const lineColor = computed(() => (theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'));
const fmtAxis = (v: number) => formatDuration(v);

function tooltipFmt(params: unknown) {
  const arr = Array.isArray(params) ? params : [params];
  const head =
    (arr[0] as { name?: string; axisValueLabel?: string })?.axisValueLabel ??
    (arr[0] as { name?: string })?.name ??
    '';
  const lines = (arr as { marker: string; seriesName: string; value: number }[])
    .filter((p) => Number(p.value) > 0)
    .map((p) => `${p.marker}${p.seriesName}: <b>${formatDuration(Number(p.value))}</b>`);
  return [head, ...lines].join('<br/>');
}

const categoryChartOption = computed(() => {
  const rows = categoryRows.value;
  const series = (['p50', 'p90', 'p99'] as const).map((k, i) => ({
    name: k.toUpperCase(),
    type: 'bar' as const,
    data: rows.map((r) => r[k]),
    itemStyle: { color: (theme.isDark ? PCT_DARK : PCT_LIGHT)[i] },
  }));
  return {
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: axisColor.value } },
    tooltip: { trigger: 'axis', formatter: tooltipFmt },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLabel: { color: axisColor.value, interval: 0, rotate: rows.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: lineColor.value } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: axisColor.value, formatter: fmtAxis },
      splitLine: { lineStyle: { color: lineColor.value } },
    },
    series,
  };
});

const groupChartOption = computed(() => {
  const isDay = applied?.groupBy === 'day';
  const rows = isDay ? groupRows.value : groupRows.value.slice(0, 15);
  // 只画出现过的类别，按链路顺序
  const present = LATENCY_CATEGORIES.filter((c) =>
    rows.some((r) => (r.categories?.[c.code]?.p90 ?? 0) > 0),
  );
  const stack = present.map((c) => ({
    name: catLabel(c.code),
    type: 'bar' as const,
    stack: 'p90',
    data: rows.map((r) => r.categories?.[c.code]?.p90 ?? 0),
    itemStyle: { color: categoryColor(c.code, theme.isDark) },
    emphasis: { focus: 'series' as const },
  }));
  const labels = rows.map((r) => r.label);
  const common = {
    legend: { top: 0, type: 'scroll' as const, textStyle: { color: axisColor.value } },
    tooltip: {
      trigger: 'axis' as const,
      formatter: tooltipFmt,
      axisPointer: { type: 'shadow' as const },
    },
  };
  const valueAxis = {
    type: 'value' as const,
    axisLabel: { color: axisColor.value, formatter: fmtAxis },
    splitLine: { lineStyle: { color: lineColor.value } },
  };
  if (isDay) {
    return {
      ...common,
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { color: axisColor.value },
        axisLine: { lineStyle: { color: lineColor.value } },
      },
      yAxis: valueAxis,
      series: [
        ...stack,
        {
          name: t('latency.page.totalP', { p: 'P90' }),
          type: 'line' as const,
          data: rows.map((r) => r.p90),
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2, color: theme.isDark ? 'rgba(255,255,255,0.85)' : '#262626' },
          itemStyle: { color: theme.isDark ? 'rgba(255,255,255,0.85)' : '#262626' },
        },
      ],
    };
  }
  return {
    ...common,
    grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
    xAxis: valueAxis,
    yAxis: {
      type: 'category' as const,
      inverse: true,
      data: labels,
      axisLabel: { color: axisColor.value, width: 140, overflow: 'truncate' as const },
      axisLine: { lineStyle: { color: lineColor.value } },
    },
    series: stack,
  };
});
</script>

<style scoped>
.lp-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}
.lp-subtitle {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.lp-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.lp-chart {
  width: 100%;
  height: 300px;
}
.lp-chart--tall {
  height: 360px;
}
</style>
