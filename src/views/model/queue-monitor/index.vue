<template>
  <div class="page-container">
    <!-- 顶部控制栏 -->
    <a-card size="small" style="margin-bottom: 16px">
      <a-row justify="space-between" align="middle">
        <a-col>
          <a-typography-title :level="5" style="margin: 0">{{
            $t('generationMonitor.title')
          }}</a-typography-title>
        </a-col>
        <a-col>
          <a-space>
            <a-switch
              v-model:checked="autoRefresh"
              :checked-children="$t('generationMonitor.autoRefreshOn')"
              :un-checked-children="$t('generationMonitor.autoRefreshOff')"
            />
            <a-button :loading="loading" @click="loadData">
              {{ $t('common.refresh') }}
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- Redis 队列 + 创作任务概览 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12">
        <a-card :title="$t('generationMonitor.redisQueueSection')" size="small">
          <a-table
            :columns="queueColumns"
            :data-source="queueRows"
            :loading="loading"
            :pagination="false"
            row-key="queueName"
            size="small"
          >
            <template #emptyText>
              <a-empty :description="$t('generationMonitor.noQueue')" />
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card :title="$t('generationMonitor.creationSection')" size="small">
          <a-table
            :columns="creationColumns"
            :data-source="creationRows"
            :loading="loading"
            :pagination="false"
            row-key="type"
            size="small"
          >
            <template #emptyText>
              <a-empty :description="$t('generationMonitor.noCreation')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'recentFailed'">
                <a-tag v-if="record.recentFailed > 0" color="error">{{
                  record.recentFailed
                }}</a-tag>
                <span v-else>0</span>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>

    <!-- Pipeline 指标 -->
    <a-card
      :title="$t('generationMonitor.pipelineSection')"
      size="small"
      style="margin-bottom: 16px"
    >
      <a-row :gutter="16">
        <a-col :span="6">
          <a-statistic
            :title="$t('generationMonitor.pipelineInflight')"
            :value="pipelineMetrics?.inflightCount || 0"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            :title="$t('generationMonitor.pipelineInflightWithProgress')"
            :value="pipelineMetrics?.inflightWithProgress || 0"
          >
            <template #suffix>
              <span style="font-size: 14px; color: var(--color-text-tertiary)">{{
                $t('generationMonitor.times')
              }}</span>
            </template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            :title="$t('generationMonitor.pipelineAvgStepDuration')"
            :value="pipelineMetrics?.avgStepDurationMs || 0"
          >
            <template #suffix>
              <span style="font-size: 14px; color: var(--color-text-tertiary)">ms</span>
            </template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            :title="$t('generationMonitor.pipelineTypeDistribution')"
            :value="pipelineMetrics?.typeDistribution || '-'"
          />
        </a-col>
      </a-row>
    </a-card>

    <!-- 步骤耗时分布 -->
    <a-card
      :title="$t('generationMonitor.stepDurationDistribution')"
      size="small"
      style="margin-bottom: 16px"
    >
      <template #extra>
        <a-select
          v-model:value="durationHours"
          size="small"
          style="width: 100px"
          @change="loadStepDuration"
          :options="hourOptions"
        />
      </template>
      <a-table
        :columns="durationColumns"
        :data-source="stepDurationData"
        :loading="durationLoading"
        :pagination="false"
        row-key="stepCode"
        size="small"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noStepDurationData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'p50'">
            <a-tag color="green">{{ record.p50 }} ms</a-tag>
          </template>
          <template v-if="column.dataIndex === 'p90'">
            <a-tag color="orange">{{ record.p90 }} ms</a-tag>
          </template>
          <template v-if="column.dataIndex === 'p99'">
            <a-tag color="red">{{ record.p99 }} ms</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 图表区域 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12">
        <a-card :title="$t('generationMonitor.slowStepTrend')" size="small">
          <template #extra>
            <a-space size="small">
              <a-select
                v-model:value="trendHours"
                size="small"
                style="width: 80px"
                @change="loadSlowStepTrend"
                :options="hourOptions"
              />
              <a-space-compact>
                <a-input-number
                  v-model:value="trendThresholdMs"
                  :min="1000"
                  :step="1000"
                  size="small"
                  style="width: 100px"
                  @change="loadSlowStepTrend"
                />
                <a-button size="small" disabled>ms</a-button>
              </a-space-compact>
              <a-select
                v-model:value="trendBucketMinutes"
                size="small"
                style="width: 80px"
                @change="loadSlowStepTrend"
                :options="bucketMinuteOptions"
              />
            </a-space>
          </template>
          <div ref="slowStepTrendChartRef" style="height: 300px"></div>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card :title="$t('generationMonitor.stepDurationTrend')" size="small">
          <template #extra>
            <a-space size="small">
              <a-select
                v-model:value="durationTrendHours"
                size="small"
                style="width: 80px"
                @change="loadStepDurationTrend"
                :options="hourOptions"
              />
              <a-select
                v-model:value="durationTrendBucketMinutes"
                size="small"
                style="width: 80px"
                @change="loadStepDurationTrend"
                :options="bucketMinuteOptions"
              />
            </a-space>
          </template>
          <div ref="stepDurationTrendChartRef" style="height: 300px"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 告警历史 -->
    <a-card :title="$t('generationMonitor.alertHistory')" size="small">
      <template #extra>
        <a-space size="small">
          <a-select
            v-model:value="alertHours"
            size="small"
            style="width: 80px"
            @change="loadAlertHistory"
            :options="hourOptions"
          />
          <a-select
            v-model:value="alertTypeFilter"
            size="small"
            style="width: 120px"
            allow-clear
            @change="loadAlertHistory"
            :options="alertTypeOptions"
          />
        </a-space>
      </template>
      <a-table
        :columns="alertColumns"
        :data-source="alertHistoryData"
        :loading="alertLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noAlertHistory')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'alertLevel'">
            <a-tag :color="record.alertLevel === 'ERROR' ? 'red' : 'orange'">{{
              record.alertLevel
            }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'alertType'">
            <a-tag :color="alertTypeColor[record.alertType]">{{ record.alertType }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'alertTime'">
            {{ formatTime(record.alertTime) }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getGenerationMetricsOverview,
  getPipelineMetrics,
  getPipelineStepDuration,
  getPipelineAlertHistory,
  getSlowStepTrend,
  getStepDurationTrend,
  type GenerationQueueMetric,
  type CreationTaskMetric,
  type PipelineMetric,
  type StepDurationDistribution,
  type PipelineAlertHistory,
  type SlowStepTrend,
  type StepDurationTrend,
} from '@/api/generation';

const { t } = useI18n();

/**
 * 下拉选项一律用 :options，<b>不能写 a-select-option 子标签</b>。
 *
 * antdv-next 的 a-select 渲染底层 VcSelect 时第三个参数（children）直接传 null
 * （antdv-next/dist/select/index.js 里 createVNode(VcSelect, ..., null)），
 * 默认插槽全程没被引用过——子标签写了也到不了下拉框。组件本身注册过
 * （ASelectOption），所以既没有 Vue 警告也不报错，只是下拉框空着。
 * 本页原先 7 个下拉全是这种写法，等于 7 个都点不开。
 *
 * 用 computed 是因为标签要跟着语言切换走。
 */
const hourOptions = computed(() => [
  { label: t('generationMonitor.hours1'), value: 1 },
  { label: t('generationMonitor.hours6'), value: 6 },
  { label: t('generationMonitor.hours24'), value: 24 },
  { label: t('generationMonitor.hours72'), value: 72 },
]);

/** 时间桶粒度。单位是通用写法，不进语言包。 */
const bucketMinuteOptions = [
  { label: '5min', value: 5 },
  { label: '15min', value: 15 },
  { label: '30min', value: 30 },
  { label: '1h', value: 60 },
];

const alertTypeOptions = computed(() => [
  { label: t('generationMonitor.alertTypeInflight'), value: 'INFLIGHT' },
  { label: t('generationMonitor.alertTypeRecovery'), value: 'RECOVERY' },
  { label: t('generationMonitor.alertTypeSlowStep'), value: 'SLOW_STEP' },
]);

const queueRows = ref<GenerationQueueMetric[]>([]);
const creationRows = ref<CreationTaskMetric[]>([]);
const pipelineMetrics = ref<PipelineMetric | null>(null);
const stepDurationData = ref<StepDurationDistribution[]>([]);
const alertHistoryData = ref<PipelineAlertHistory[]>([]);
const slowStepTrendData = ref<SlowStepTrend[]>([]);
const stepDurationTrendData = ref<StepDurationTrend[]>([]);
const loading = ref(false);
const durationLoading = ref(false);
const alertLoading = ref(false);
const trendLoading = ref(false);
const durationTrendLoading = ref(false);
const durationHours = ref(24);
const alertHours = ref(24);
const alertTypeFilter = ref<string | undefined>(undefined);
const trendHours = ref(24);
const trendThresholdMs = ref(60000);
const trendBucketMinutes = ref(60);
const durationTrendHours = ref(24);
const durationTrendBucketMinutes = ref(60);
const autoRefresh = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

// 图表实例
const slowStepTrendChartRef = ref<HTMLElement>();
const stepDurationTrendChartRef = ref<HTMLElement>();
let slowStepTrendChart: echarts.ECharts | null = null;
let stepDurationTrendChart: echarts.ECharts | null = null;

const queueColumns = [
  { title: t('generationMonitor.queueName'), dataIndex: 'queueName', width: 200 },
  {
    title: t('generationMonitor.queueLength'),
    dataIndex: 'queueLength',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.concurrent'),
    dataIndex: 'concurrent',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.maxConcurrent'),
    dataIndex: 'maxConcurrent',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.availableSlots'),
    dataIndex: 'availableSlots',
    width: 80,
    align: 'center' as const,
  },
];

const creationColumns = [
  { title: t('generationMonitor.creationType'), dataIndex: 'type', width: 200 },
  {
    title: t('generationMonitor.queued'),
    dataIndex: 'queued',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.processing'),
    dataIndex: 'processing',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.inflight'),
    dataIndex: 'inflight',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.recentFailed'),
    dataIndex: 'recentFailed',
    width: 80,
    align: 'center' as const,
  },
];

const durationColumns = [
  { title: t('generationMonitor.stepCode'), dataIndex: 'stepCode', width: 200 },
  { title: 'P50', dataIndex: 'p50', width: 120, align: 'center' as const },
  { title: 'P90', dataIndex: 'p90', width: 120, align: 'center' as const },
  { title: 'P99', dataIndex: 'p99', width: 120, align: 'center' as const },
  {
    title: t('generationMonitor.sampleCount'),
    dataIndex: 'count',
    width: 100,
    align: 'center' as const,
  },
];

const alertColumns = [
  { title: t('generationMonitor.alertTime'), dataIndex: 'alertTime', width: 180 },
  {
    title: t('generationMonitor.alertLevel'),
    dataIndex: 'alertLevel',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('generationMonitor.alertType'),
    dataIndex: 'alertType',
    width: 120,
    align: 'center' as const,
  },
  { title: t('generationMonitor.alertMessage'), dataIndex: 'message', ellipsis: true },
];

const alertTypeColor: Record<string, string> = {
  INFLIGHT: 'red',
  RECOVERY: 'orange',
  SLOW_STEP: 'gold',
};

function formatTime(time: string): string {
  if (!time) return '-';
  const date = new Date(time);
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadData() {
  loading.value = true;
  try {
    const overview = await getGenerationMetricsOverview();
    queueRows.value = overview?.redisQueues || [];
    creationRows.value = overview?.creationTasks || [];
    pipelineMetrics.value = await getPipelineMetrics();
  } catch (error) {
    console.error('Failed to load generation metrics:', error);
  } finally {
    loading.value = false;
  }
}

async function loadStepDuration() {
  durationLoading.value = true;
  try {
    stepDurationData.value = await getPipelineStepDuration(durationHours.value);
  } catch (error) {
    console.error('Failed to load step duration:', error);
  } finally {
    durationLoading.value = false;
  }
}

async function loadAlertHistory() {
  alertLoading.value = true;
  try {
    alertHistoryData.value = await getPipelineAlertHistory(
      alertHours.value,
      100,
      alertTypeFilter.value,
    );
  } catch (error) {
    console.error('Failed to load alert history:', error);
  } finally {
    alertLoading.value = false;
  }
}

async function loadSlowStepTrend() {
  trendLoading.value = true;
  try {
    slowStepTrendData.value = await getSlowStepTrend(
      trendHours.value,
      trendThresholdMs.value,
      trendBucketMinutes.value,
    );
    await nextTick();
    renderSlowStepTrendChart();
  } catch (error) {
    console.error('Failed to load slow step trend:', error);
  } finally {
    trendLoading.value = false;
  }
}

async function loadStepDurationTrend() {
  durationTrendLoading.value = true;
  try {
    stepDurationTrendData.value = await getStepDurationTrend(
      durationTrendHours.value,
      durationTrendBucketMinutes.value,
    );
    await nextTick();
    renderStepDurationTrendChart();
  } catch (error) {
    console.error('Failed to load step duration trend:', error);
  } finally {
    durationTrendLoading.value = false;
  }
}

function renderSlowStepTrendChart() {
  if (!slowStepTrendChartRef.value) return;
  if (!slowStepTrendChart) {
    slowStepTrendChart = echarts.init(slowStepTrendChartRef.value);
  }
  const timeBuckets = slowStepTrendData.value.map((d) => d.timeBucket);
  const slowCounts = slowStepTrendData.value.map((d) => d.slowCount);
  slowStepTrendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: timeBuckets, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: t('generationMonitor.slowStepCount') },
    series: [
      {
        name: t('generationMonitor.slowStepCount'),
        type: 'line',
        data: slowCounts,
        smooth: true,
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#ff4d4f' },
      },
    ],
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
  });
}

function renderStepDurationTrendChart() {
  if (!stepDurationTrendChartRef.value) return;
  if (!stepDurationTrendChart) {
    stepDurationTrendChart = echarts.init(stepDurationTrendChartRef.value);
  }
  const stepCodes = Array.from(new Set(stepDurationTrendData.value.map((d) => d.stepCode)));
  const timeBuckets = Array.from(
    new Set(stepDurationTrendData.value.map((d) => d.timeBucket)),
  ).sort();
  const series = stepCodes.map((stepCode) => {
    const data = timeBuckets.map((timeBucket) => {
      const item = stepDurationTrendData.value.find(
        (d) => d.stepCode === stepCode && d.timeBucket === timeBucket,
      );
      return item ? item.avgDurationMs : null;
    });
    return { name: stepCode, type: 'line', data, smooth: true };
  });
  stepDurationTrendChart.setOption({
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | null) => (value ? `${value} ms` : '-'),
    },
    legend: { data: stepCodes, top: 0 },
    xAxis: { type: 'category', data: timeBuckets, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: t('generationMonitor.avgDuration') },
    series,
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
  });
}

function startTimer() {
  stopTimer();
  timer = setInterval(loadData, 5000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(autoRefresh, (on) => {
  if (on) {
    startTimer();
  } else {
    stopTimer();
  }
});

onMounted(() => {
  loadData();
  loadStepDuration();
  loadAlertHistory();
  loadSlowStepTrend();
  loadStepDurationTrend();
});

onUnmounted(() => {
  stopTimer();
  slowStepTrendChart?.dispose();
  stepDurationTrendChart?.dispose();
});
</script>
