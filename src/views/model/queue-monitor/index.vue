<template>
  <div class="page-container">
    <a-card :title="$t('generationMonitor.title')">
      <template #extra>
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
      </template>

      <a-typography-title :level="5">{{ $t('generationMonitor.redisQueueSection') }}</a-typography-title>
      <a-table
        :columns="queueColumns"
        :data-source="queueRows"
        :loading="loading"
        :pagination="false"
        row-key="queueName"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noQueue')" />
        </template>
      </a-table>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.creationSection') }}
      </a-typography-title>
      <a-table
        :columns="creationColumns"
        :data-source="creationRows"
        :loading="loading"
        :pagination="false"
        row-key="type"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noCreation')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'recentFailed'">
            <a-tag v-if="record.recentFailed > 0" color="error">{{ record.recentFailed }}</a-tag>
            <span v-else>0</span>
          </template>
        </template>
      </a-table>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.pipelineSection') }}
      </a-typography-title>
      <a-descriptions :column="2" bordered>
        <a-descriptions-item :label="$t('generationMonitor.pipelineInflight')">
          <a-statistic :value="pipelineMetrics?.inflightCount || 0" />
        </a-descriptions-item>
        <a-descriptions-item :label="$t('generationMonitor.pipelineInflightWithProgress')">
          <a-statistic :value="pipelineMetrics?.inflightWithProgress || 0">
            <template #suffix>
              <span style="font-size: 14px; color: #999">{{ $t('generationMonitor.times') }}</span>
            </template>
          </a-statistic>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('generationMonitor.pipelineAvgStepDuration')">
          <a-statistic :value="pipelineMetrics?.avgStepDurationMs || 0">
            <template #suffix>
              <span style="font-size: 14px; color: #999">ms</span>
            </template>
          </a-statistic>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('generationMonitor.pipelineTypeDistribution')">
          <span>{{ pipelineMetrics?.typeDistribution || '-' }}</span>
        </a-descriptions-item>
      </a-descriptions>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.stepDurationDistribution') }}
      </a-typography-title>
      <a-space style="margin-bottom: 12px">
        <a-select v-model:value="durationHours" style="width: 120px" @change="loadStepDuration">
          <a-select-option :value="1">{{ $t('generationMonitor.hours1') }}</a-select-option>
          <a-select-option :value="6">{{ $t('generationMonitor.hours6') }}</a-select-option>
          <a-select-option :value="24">{{ $t('generationMonitor.hours24') }}</a-select-option>
          <a-select-option :value="72">{{ $t('generationMonitor.hours72') }}</a-select-option>
        </a-select>
      </a-space>
      <a-table
        :columns="durationColumns"
        :data-source="stepDurationData"
        :loading="durationLoading"
        :pagination="false"
        row-key="stepCode"
        size="middle"
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

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.slowStepTrend') }}
      </a-typography-title>
      <a-space style="margin-bottom: 12px">
        <a-select v-model:value="trendHours" style="width: 120px" @change="loadSlowStepTrend">
          <a-select-option :value="1">{{ $t('generationMonitor.hours1') }}</a-select-option>
          <a-select-option :value="6">{{ $t('generationMonitor.hours6') }}</a-select-option>
          <a-select-option :value="24">{{ $t('generationMonitor.hours24') }}</a-select-option>
          <a-select-option :value="72">{{ $t('generationMonitor.hours72') }}</a-select-option>
        </a-select>
        <a-input-number
          v-model:value="trendThresholdMs"
          :min="1000"
          :step="1000"
          style="width: 150px"
          addon-after="ms"
          @change="loadSlowStepTrend"
        />
        <a-select v-model:value="trendBucketMinutes" style="width: 120px" @change="loadSlowStepTrend">
          <a-select-option :value="5">5 min</a-select-option>
          <a-select-option :value="15">15 min</a-select-option>
          <a-select-option :value="30">30 min</a-select-option>
          <a-select-option :value="60">1 hour</a-select-option>
        </a-select>
      </a-space>
      <div ref="slowStepTrendChartRef" style="height: 300px; margin-bottom: 24px"></div>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.stepDurationTrend') }}
      </a-typography-title>
      <a-space style="margin-bottom: 12px">
        <a-select v-model:value="durationTrendHours" style="width: 120px" @change="loadStepDurationTrend">
          <a-select-option :value="1">{{ $t('generationMonitor.hours1') }}</a-select-option>
          <a-select-option :value="6">{{ $t('generationMonitor.hours6') }}</a-select-option>
          <a-select-option :value="24">{{ $t('generationMonitor.hours24') }}</a-select-option>
          <a-select-option :value="72">{{ $t('generationMonitor.hours72') }}</a-select-option>
        </a-select>
        <a-select v-model:value="durationTrendBucketMinutes" style="width: 120px" @change="loadStepDurationTrend">
          <a-select-option :value="5">5 min</a-select-option>
          <a-select-option :value="15">15 min</a-select-option>
          <a-select-option :value="30">30 min</a-select-option>
          <a-select-option :value="60">1 hour</a-select-option>
        </a-select>
      </a-space>
      <div ref="stepDurationTrendChartRef" style="height: 350px"></div>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.alertHistory') }}
      </a-typography-title>
      <a-space style="margin-bottom: 12px">
        <a-select v-model:value="alertHours" style="width: 120px" @change="loadAlertHistory">
          <a-select-option :value="1">{{ $t('generationMonitor.hours1') }}</a-select-option>
          <a-select-option :value="6">{{ $t('generationMonitor.hours6') }}</a-select-option>
          <a-select-option :value="24">{{ $t('generationMonitor.hours24') }}</a-select-option>
          <a-select-option :value="72">{{ $t('generationMonitor.hours72') }}</a-select-option>
        </a-select>
        <a-select v-model:value="alertTypeFilter" style="width: 150px" allow-clear @change="loadAlertHistory">
          <a-select-option value="INFLIGHT">{{ $t('generationMonitor.alertTypeInflight') }}</a-select-option>
          <a-select-option value="RECOVERY">{{ $t('generationMonitor.alertTypeRecovery') }}</a-select-option>
          <a-select-option value="SLOW_STEP">{{ $t('generationMonitor.alertTypeSlowStep') }}</a-select-option>
        </a-select>
      </a-space>
      <a-table
        :columns="alertColumns"
        :data-source="alertHistoryData"
        :loading="alertLoading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noAlertHistory')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'alertLevel'">
            <a-tag :color="record.alertLevel === 'ERROR' ? 'red' : 'orange'">{{ record.alertLevel }}</a-tag>
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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
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
} from '@/api/generation'

const { t } = useI18n()

const queueRows = ref<GenerationQueueMetric[]>([])
const creationRows = ref<CreationTaskMetric[]>([])
const pipelineMetrics = ref<PipelineMetric | null>(null)
const stepDurationData = ref<StepDurationDistribution[]>([])
const alertHistoryData = ref<PipelineAlertHistory[]>([])
const slowStepTrendData = ref<SlowStepTrend[]>([])
const stepDurationTrendData = ref<StepDurationTrend[]>([])
const loading = ref(false)
const durationLoading = ref(false)
const alertLoading = ref(false)
const trendLoading = ref(false)
const durationTrendLoading = ref(false)
const durationHours = ref(24)
const alertHours = ref(24)
const alertTypeFilter = ref<string | undefined>(undefined)
const trendHours = ref(24)
const trendThresholdMs = ref(60000)
const trendBucketMinutes = ref(60)
const durationTrendHours = ref(24)
const durationTrendBucketMinutes = ref(60)
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

// 图表实例
const slowStepTrendChartRef = ref<HTMLElement>()
const stepDurationTrendChartRef = ref<HTMLElement>()
let slowStepTrendChart: echarts.ECharts | null = null
let stepDurationTrendChart: echarts.ECharts | null = null

const queueColumns = [
  { title: t('generationMonitor.queueName'), dataIndex: 'queueName', width: 280 },
  { title: t('generationMonitor.queueLength'), dataIndex: 'queueLength', width: 120, align: 'center' as const },
  { title: t('generationMonitor.concurrent'), dataIndex: 'concurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.maxConcurrent'), dataIndex: 'maxConcurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.availableSlots'), dataIndex: 'availableSlots', width: 120, align: 'center' as const },
]

const creationColumns = [
  { title: t('generationMonitor.creationType'), dataIndex: 'type', width: 280 },
  { title: t('generationMonitor.queued'), dataIndex: 'queued', width: 120, align: 'center' as const },
  { title: t('generationMonitor.processing'), dataIndex: 'processing', width: 120, align: 'center' as const },
  { title: t('generationMonitor.inflight'), dataIndex: 'inflight', width: 120, align: 'center' as const },
  { title: t('generationMonitor.recentFailed'), dataIndex: 'recentFailed', width: 120, align: 'center' as const },
]

const durationColumns = [
  { title: t('generationMonitor.stepCode'), dataIndex: 'stepCode', width: 200 },
  { title: 'P50', dataIndex: 'p50', width: 120, align: 'center' as const },
  { title: 'P90', dataIndex: 'p90', width: 120, align: 'center' as const },
  { title: 'P99', dataIndex: 'p99', width: 120, align: 'center' as const },
  { title: t('generationMonitor.sampleCount'), dataIndex: 'count', width: 120, align: 'center' as const },
]

const alertColumns = [
  { title: t('generationMonitor.alertTime'), dataIndex: 'alertTime', width: 180 },
  { title: t('generationMonitor.alertLevel'), dataIndex: 'alertLevel', width: 100, align: 'center' as const },
  { title: t('generationMonitor.alertType'), dataIndex: 'alertType', width: 120, align: 'center' as const },
  { title: t('generationMonitor.alertMessage'), dataIndex: 'message', ellipsis: true },
]

const alertTypeColor: Record<string, string> = {
  INFLIGHT: 'red',
  RECOVERY: 'orange',
  SLOW_STEP: 'gold',
}

function formatTime(time: string): string {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function loadData() {
  loading.value = true
  try {
    const overview = await getGenerationMetricsOverview()
    queueRows.value = overview?.redisQueues || []
    creationRows.value = overview?.creationTasks || []

    pipelineMetrics.value = await getPipelineMetrics()
  } catch (error) {
    console.error('Failed to load generation metrics:', error)
  } finally {
    loading.value = false
  }
}

async function loadStepDuration() {
  durationLoading.value = true
  try {
    stepDurationData.value = await getPipelineStepDuration(durationHours.value)
  } catch (error) {
    console.error('Failed to load step duration:', error)
  } finally {
    durationLoading.value = false
  }
}

async function loadAlertHistory() {
  alertLoading.value = true
  try {
    alertHistoryData.value = await getPipelineAlertHistory(alertHours.value, 100, alertTypeFilter.value)
  } catch (error) {
    console.error('Failed to load alert history:', error)
  } finally {
    alertLoading.value = false
  }
}

async function loadSlowStepTrend() {
  trendLoading.value = true
  try {
    slowStepTrendData.value = await getSlowStepTrend(trendHours.value, trendThresholdMs.value, trendBucketMinutes.value)
    await nextTick()
    renderSlowStepTrendChart()
  } catch (error) {
    console.error('Failed to load slow step trend:', error)
  } finally {
    trendLoading.value = false
  }
}

async function loadStepDurationTrend() {
  durationTrendLoading.value = true
  try {
    stepDurationTrendData.value = await getStepDurationTrend(durationTrendHours.value, durationTrendBucketMinutes.value)
    await nextTick()
    renderStepDurationTrendChart()
  } catch (error) {
    console.error('Failed to load step duration trend:', error)
  } finally {
    durationTrendLoading.value = false
  }
}

function renderSlowStepTrendChart() {
  if (!slowStepTrendChartRef.value) return

  if (!slowStepTrendChart) {
    slowStepTrendChart = echarts.init(slowStepTrendChartRef.value)
  }

  const timeBuckets = slowStepTrendData.value.map(d => d.timeBucket)
  const slowCounts = slowStepTrendData.value.map(d => d.slowCount)

  slowStepTrendChart.setOption({
    title: {
      text: t('generationMonitor.slowStepTrendChart'),
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: timeBuckets,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      name: t('generationMonitor.slowStepCount'),
    },
    series: [
      {
        name: t('generationMonitor.slowStepCount'),
        type: 'line',
        data: slowCounts,
        smooth: true,
        areaStyle: {
          opacity: 0.3,
        },
        itemStyle: {
          color: '#ff4d4f',
        },
      },
    ],
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
  })
}

function renderStepDurationTrendChart() {
  if (!stepDurationTrendChartRef.value) return

  if (!stepDurationTrendChart) {
    stepDurationTrendChart = echarts.init(stepDurationTrendChartRef.value)
  }

  // 按步骤编码分组
  const stepCodes = Array.from(new Set(stepDurationTrendData.value.map(d => d.stepCode)))
  const timeBuckets = Array.from(new Set(stepDurationTrendData.value.map(d => d.timeBucket))).sort()

  const series = stepCodes.map((stepCode) => {
    const data = timeBuckets.map(timeBucket => {
      const item = stepDurationTrendData.value.find(d => d.stepCode === stepCode && d.timeBucket === timeBucket)
      return item ? item.avgDurationMs : null
    })

    return {
      name: stepCode,
      type: 'line',
      data,
      smooth: true,
    }
  })

  stepDurationTrendChart.setOption({
    title: {
      text: t('generationMonitor.stepDurationTrendChart'),
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | null) => (value ? `${value} ms` : '-'),
    },
    legend: {
      data: stepCodes,
      top: 30,
    },
    xAxis: {
      type: 'category',
      data: timeBuckets,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      name: t('generationMonitor.avgDuration'),
    },
    series,
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
  })
}

function startTimer() {
  stopTimer()
  timer = setInterval(loadData, 5000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoRefresh, (on) => {
  if (on) {
    startTimer()
  } else {
    stopTimer()
  }
})

onMounted(() => {
  loadData()
  loadStepDuration()
  loadAlertHistory()
  loadSlowStepTrend()
  loadStepDurationTrend()
})

onUnmounted(() => {
  stopTimer()
  slowStepTrendChart?.dispose()
  stepDurationTrendChart?.dispose()
})
</script>

