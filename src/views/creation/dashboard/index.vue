<template>
  <div class="creation-dashboard">
    <!-- 页面头部 -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">{{ t('creationDashboard.title') }}</h2>
      <div class="dashboard-actions">
        <a-button @click="refreshAll">
          <template #icon><ReloadOutlined /></template>
          {{ t('common.refresh') }}
        </a-button>
        <a-range-picker
          v-model:value="dateRange"
          :placeholder="[t('creationDashboard.startDate'), t('creationDashboard.endDate')]"
          @change="onDateRangeChange"
        />
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <a-row :gutter="[16, 16]">
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.todayTasks')"
            :value="realtime.totalToday"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><ThunderboltOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.todayCompleted')"
            :value="realtime.todayCompleted"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><CheckCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.todayFailed')"
            :value="realtime.todayFailed"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><CloseCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.successRate')"
            :value="realtime.successRate"
            suffix="%"
            :value-style="{ color: '#13c2c2' }"
          >
            <template #prefix><RiseOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.pending')"
            :value="realtime.pendingCount"
            :value-style="{ color: '#fa8c16' }"
          >
            <template #prefix><ClockCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <a-card variant="borderless">
          <a-statistic
            :title="t('creationDashboard.processing')"
            :value="realtime.processingCount"
            :value-style="{ color: '#722ed1' }"
          >
            <template #prefix><LoadingOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 趋势图 + 状态分布 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="24" :lg="14">
        <a-card :title="t('creationDashboard.taskTrend')" variant="borderless">
          <v-chart :option="trendOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="10">
        <a-card :title="t('creationDashboard.statusDistribution')" variant="borderless">
          <v-chart :option="statusPieOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 类型分布 + 时段热力图 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="24" :lg="10">
        <a-card :title="t('creationDashboard.typeDistribution')" variant="borderless">
          <v-chart :option="typePieOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="14">
        <a-card :title="t('creationDashboard.hourlyHeatmap')" variant="borderless">
          <v-chart :option="heatmapOption" autoresize class="chart-container heatmap-chart" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 模型排行 + 用户排行 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('creationDashboard.modelRanking')" variant="borderless">
          <v-chart :option="modelRankingOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('creationDashboard.userRanking')" variant="borderless">
          <v-chart :option="userRankingOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 耗时统计 + 失败原因 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('creationDashboard.durationStats')" variant="borderless">
          <v-chart :option="durationOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('creationDashboard.failureAnalysis')" variant="borderless">
          <a-table
            :columns="failureColumns"
            :data-source="failureData"
            :pagination="false"
            size="small"
            :locale="{ emptyText: t('common.noData') }"
          />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RiseOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  SingleAxisComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { LegacyGridContainLabel } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

import {
  getCreationOverview,
  getCreationTrend,
  getDurationStats,
  getFailureAnalysis,
  getHourlyHeatmap,
  getModelRanking,
  getRealtimeStatus,
  getStatusDistribution,
  getTypeDistribution,
  getUserRanking,
} from '@/api/creation-dashboard'
import type {
  DistributionItem,
  DurationGroup,
  FailureItem,
  HeatmapItem,
  RankingItem,
  RealtimeData,
  TrendDataPoint,
} from '@/api/creation-dashboard'

// 注册 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  GraphicComponent,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  SingleAxisComponent,
  VisualMapComponent,
  LegacyGridContainLabel,
])

const { t } = useI18n()

// === 状态数据 ===
const dateRange = ref<[string, string] | null>(null)
const realtime = ref<RealtimeData>({
  pendingCount: 0,
  processingCount: 0,
  todayCompleted: 0,
  todayFailed: 0,
  successRate: 0,
  avgWaitTime: 0,
})
const trendData = ref<TrendDataPoint[]>([])
const statusData = ref<DistributionItem[]>([])
const typeData = ref<DistributionItem[]>([])
const modelRanking = ref<RankingItem[]>([])
const userRanking = ref<RankingItem[]>([])
const heatmapData = ref<HeatmapItem[]>([])
const durationData = ref<DurationGroup[]>([])
const failureData = ref<FailureItem[]>([])

let refreshTimer: ReturnType<typeof setInterval> | null = null

// === 颜色配置 ===
const CHART_COLORS = {
  primary: '#1890ff',
  success: '#52c41a',
  error: '#ff4d4f',
  warning: '#faad14',
  purple: '#722ed1',
  cyan: '#13c2c2',
  orange: '#fa8c16',
}

const STATUS_COLORS: Record<string, string> = {
  排队中: CHART_COLORS.warning,
  处理中: CHART_COLORS.primary,
  已完成: CHART_COLORS.success,
  失败: CHART_COLORS.error,
  已取消: '#8c8c8c',
}

// 调色板：所有类型统一使用循环调色板
const PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.cyan,
  '#eb2f96', '#faad14', '#a0d911', '#f5222d',
]

// === 失败原因表格列 ===
const failureColumns = computed(() => [
  {
    title: t('creationDashboard.errorMsg'),
    dataIndex: 'errorMsg',
    key: 'errorMsg',
    ellipsis: true,
    width: '40%',
  },
  {
    title: t('creationDashboard.failCount'),
    dataIndex: 'count',
    key: 'count',
    width: '15%',
    align: 'right' as const,
  },
  {
    title: t('creationDashboard.percentage'),
    dataIndex: 'percentage',
    key: 'percentage',
    width: '20%',
    align: 'right' as const,
  },
  {
    title: t('creationDashboard.sampleTasks'),
    dataIndex: 'sampleTaskIds',
    key: 'sampleTaskIds',
    ellipsis: true,
    width: '25%',
  },
])

// === 趋势折线图 ===
const trendOption = computed(() => {
  const dates = trendData.value.map((d) => d.date)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: {
      data: [
        t('creationDashboard.totalTasks'),
        t('creationDashboard.successTasks'),
        t('creationDashboard.failTasks'),
      ],
      bottom: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        name: t('creationDashboard.totalTasks'),
        type: 'line',
        data: trendData.value.map((d) => d.taskCount),
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: CHART_COLORS.primary },
      },
      {
        name: t('creationDashboard.successTasks'),
        type: 'line',
        data: trendData.value.map((d) => d.successCount),
        smooth: true,
        areaStyle: { opacity: 0.1 },
        itemStyle: { color: CHART_COLORS.success },
      },
      {
        name: t('creationDashboard.failTasks'),
        type: 'line',
        data: trendData.value.map((d) => d.failCount),
        smooth: true,
        areaStyle: { opacity: 0.1 },
        itemStyle: { color: CHART_COLORS.error },
      },
    ],
  }
})

// === 状态分布饼图 ===
const statusPieOption = computed(() => {
  const total = statusData.value.reduce((sum, item) => sum + item.value, 0)
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    graphic: total > 0
      ? [
          {
            type: 'text',
            left: 'center',
            top: '38%',
            style: { text: `${total}`, fontSize: 24, fontWeight: 'bold', fill: '#333', textAlign: 'center' },
          },
          {
            type: 'text',
            left: 'center',
            top: '50%',
            style: { text: t('creationDashboard.totalTasks'), fontSize: 12, fill: '#999', textAlign: 'center' },
          },
        ]
      : [],
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        data: statusData.value.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: STATUS_COLORS[item.name] || CHART_COLORS.primary },
        })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
        label: { show: false },
      },
    ],
  }
})

// === 类型分布饼图 ===
const typePieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      data: typeData.value.map((item, idx) => ({
        name: item.name,
        value: item.value,
        itemStyle: { color: PALETTE[idx % PALETTE.length] },
      })),
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
      label: { formatter: '{b}\n{d}%' },
    },
  ],
}))

// === 时段热力图 ===
const heatmapOption = computed(() => {
  const days = [t('creationDashboard.sun'), t('creationDashboard.mon'), t('creationDashboard.tue'), t('creationDashboard.wed'), t('creationDashboard.thu'), t('creationDashboard.fri'), t('creationDashboard.sat')]
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const maxCount = heatmapData.value.length > 0 ? Math.max(...heatmapData.value.map((d) => d.count)) : 10

  return {
    tooltip: {
      position: 'top',
    },
    grid: { left: '12%', right: '8%', bottom: '15%', top: '5%' },
    xAxis: {
      type: 'category',
      data: hours,
      splitArea: { show: true },
      axisLabel: { interval: 2 },
    },
    yAxis: {
      type: 'category',
      data: days,
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: { color: ['#e0f3ff', '#91d5ff', '#40a9ff', '#1890ff', '#096dd9'] },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData.value.map((d) => [d.hour, d.day, d.count]),
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  }
})

// === 模型排行柱状图 ===
const modelRankingOption = computed(() => {
  const data = modelRanking.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: [t('creationDashboard.taskCount'), t('creationDashboard.successRate')], bottom: 0 },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { width: 80, overflow: 'truncate' },
    },
    series: [
      {
        name: t('creationDashboard.taskCount'),
        type: 'bar',
        data: data.map((d) => d.taskCount),
        itemStyle: { color: CHART_COLORS.primary },
        barMaxWidth: 20,
      },
      {
        name: t('creationDashboard.successRate'),
        type: 'bar',
        data: data.map((d) => d.successRate),
        itemStyle: { color: CHART_COLORS.success },
        barMaxWidth: 20,
      },
    ],
  }
})

// === 用户排行柱状图 ===
const userRankingOption = computed(() => {
  const data = userRanking.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { width: 80, overflow: 'truncate' },
    },
    series: [
      {
        name: t('creationDashboard.taskCount'),
        type: 'bar',
        data: data.map((d) => d.taskCount),
        itemStyle: { color: CHART_COLORS.purple },
        barMaxWidth: 20,
      },
    ],
  }
})

// === 耗时统计分组柱状图 ===
const durationOption = computed(() => {
  const types = durationData.value.map((d) => d.typeName || d.type)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['P50', 'P90', 'P99'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: types },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (val: number) => formatDuration(val) },
    },
    series: [
      {
        name: 'P50',
        type: 'bar',
        data: durationData.value.map((d) => d.p50),
        itemStyle: { color: CHART_COLORS.primary },
        barMaxWidth: 30,
      },
      {
        name: 'P90',
        type: 'bar',
        data: durationData.value.map((d) => d.p90),
        itemStyle: { color: CHART_COLORS.warning },
        barMaxWidth: 30,
      },
      {
        name: 'P99',
        type: 'bar',
        data: durationData.value.map((d) => d.p99),
        itemStyle: { color: CHART_COLORS.error },
        barMaxWidth: 30,
      },
    ],
  }
})

// === 工具函数 ===
function formatDuration(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${min}m${sec}s`
}

// === 数据加载 ===
async function loadOverview() {
  try {
    const data = await getCreationOverview()
    realtime.value.totalToday = data.totalToday
    realtime.value.todayCompleted = data.completedCount
    realtime.value.todayFailed = data.failedCount
    realtime.value.pendingCount = data.pendingCount
    realtime.value.processingCount = data.processingCount
    realtime.value.successRate = data.successRate
  } catch (e) {
    console.error('Failed to load overview:', e)
  }
}

async function loadRealtime() {
  try {
    realtime.value = await getRealtimeStatus()
  } catch (e) {
    console.error('Failed to load realtime:', e)
  }
}

async function loadTrend() {
  try {
    const params: { startDate?: string; endDate?: string } = {}
    if (dateRange.value) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    trendData.value = await getCreationTrend(params)
  } catch (e) {
    console.error('Failed to load trend:', e)
  }
}

async function loadStatusDistribution() {
  try {
    statusData.value = await getStatusDistribution()
  } catch (e) {
    console.error('Failed to load status distribution:', e)
  }
}

async function loadTypeDistribution() {
  try {
    typeData.value = await getTypeDistribution()
  } catch (e) {
    console.error('Failed to load type distribution:', e)
  }
}

async function loadModelRanking() {
  try {
    modelRanking.value = await getModelRanking(10)
  } catch (e) {
    console.error('Failed to load model ranking:', e)
  }
}

async function loadUserRanking() {
  try {
    userRanking.value = await getUserRanking(10)
  } catch (e) {
    console.error('Failed to load user ranking:', e)
  }
}

async function loadHeatmap() {
  try {
    heatmapData.value = await getHourlyHeatmap()
  } catch (e) {
    console.error('Failed to load heatmap:', e)
  }
}

async function loadDurationStats() {
  try {
    durationData.value = await getDurationStats()
  } catch (e) {
    console.error('Failed to load duration stats:', e)
  }
}

async function loadFailureAnalysis() {
  try {
    failureData.value = await getFailureAnalysis()
  } catch (e) {
    console.error('Failed to load failure analysis:', e)
  }
}

async function refreshAll() {
  await Promise.all([
    loadOverview(),
    loadTrend(),
    loadStatusDistribution(),
    loadTypeDistribution(),
    loadModelRanking(),
    loadUserRanking(),
    loadHeatmap(),
    loadDurationStats(),
    loadFailureAnalysis(),
  ])
}

function onDateRangeChange() {
  loadTrend()
}

// === 生命周期 ===
onMounted(async () => {
  await refreshAll()
  refreshTimer = setInterval(() => {
    loadRealtime()
  }, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.creation-dashboard {
  padding: 8px 0;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.dashboard-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-row {
  margin-top: 16px;
}

.chart-container {
  height: 300px;
  width: 100%;
}

.heatmap-chart {
  height: 320px;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .chart-container {
    height: 250px;
  }

  .heatmap-chart {
    height: 280px;
  }
}
</style>
