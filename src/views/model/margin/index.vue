<template>
  <div class="page-container margin-dashboard">
    <!-- 头部：日期范围 -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">{{ t('margin.title') }}</h2>
      <a-range-picker
        v-model:value="dateRange"
        value-format="YYYY-MM-DD"
        @change="refreshAll"
      />
    </div>

    <!-- 毛利率换算配置 -->
    <a-card variant="borderless" class="config-card">
      <a-alert
        v-if="summary.rate == null || summary.rate === ''"
        type="warning"
        show-icon
        :message="t('margin.rateNotConfigured')"
        style="margin-bottom: 12px"
      />
      <a-space>
        <span>{{ t('margin.rate') }}</span>
        <a-input-number
          v-model:value="rateInput"
          :step="0.0001"
          :precision="6"
          :min="0"
          style="width: 200px"
        />
        <a-button type="primary" :loading="savingRate" @click="handleSaveRate">
          {{ t('margin.saveRate') }}
        </a-button>
        <span class="form-hint">{{ t('margin.rateHint') }}</span>
      </a-space>
    </a-card>

    <!-- 指标卡片 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="12" :lg="6">
        <ProStatCard :label="t('margin.revenueCny')" :value="`¥ ${fmt(summary.revenueCny)}`" tone="blue" />
      </a-col>
      <a-col :xs="12" :lg="6">
        <ProStatCard :label="t('margin.costCny')" :value="`¥ ${fmt(summary.costCny)}`" tone="orange" />
      </a-col>
      <a-col :xs="12" :lg="6">
        <ProStatCard :label="t('margin.marginCny')" :value="`¥ ${fmt(summary.marginCny)}`" tone="green" />
      </a-col>
      <a-col :xs="12" :lg="6">
        <ProStatCard :label="t('margin.marginRate')" :value="marginRateText" tone="purple" />
      </a-col>
    </a-row>

    <!-- 图表 -->
    <a-row :gutter="[16, 16]" class="dashboard-row">
      <a-col :xs="24" :lg="14">
        <a-card :title="t('margin.trend')" variant="borderless">
          <v-chart :option="trendOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="10">
        <a-card :title="t('margin.byModel')" variant="borderless">
          <v-chart :option="byModelOption" autoresize class="chart-container" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, ref } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'

import ProStatCard from '@/components/Pro/ProStatCard/index.vue'
import {
  getMarginSummary,
  getMarginByModel,
  getMarginTrend,
  getMarginConfig,
  updateMarginConfig,
} from '@/api/margin'
import type { MarginSummary, MarginByModel, MarginTrendPoint } from '@/types/api'
import { usePermission } from '@/composables/usePermission'

use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const { t } = useI18n()
const { can } = usePermission()
void can // 权限助手可用；margin 配置对所有可见页面的用户展示

// === 日期范围（默认近 7 天）===
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const dateRange = ref<[string, string]>([daysAgo(6), daysAgo(0)])

const dateParams = computed(() => ({
  startDate: dateRange.value?.[0],
  endDate: dateRange.value?.[1],
}))

// === 数据状态 ===
const summary = ref<MarginSummary>({
  rate: null,
  paidPoints: 0,
  revenueCny: 0,
  costCny: 0,
  marginCny: 0,
  marginRate: null,
})
const byModelData = ref<MarginByModel[]>([])
const trendData = ref<MarginTrendPoint[]>([])

// === 毛利率换算配置 ===
const rateInput = ref<number | undefined>(undefined)
const savingRate = ref(false)

// === 工具函数 ===
function fmt(v: number | string | null | undefined): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

const marginRateText = computed(() => {
  const r = summary.value.marginRate
  if (r == null || r === '') return '-'
  const n = Number(r)
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '-'
})

// === 图表 ===
const trendOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
  legend: {
    data: [t('margin.revenueCny'), t('margin.costCny'), t('margin.marginCny')],
    bottom: 0,
  },
  grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
  xAxis: { type: 'category', data: trendData.value.map((d) => d.date), boundaryGap: false },
  yAxis: { type: 'value' },
  series: [
    {
      name: t('margin.revenueCny'),
      type: 'line',
      smooth: true,
      data: trendData.value.map((d) => Number(d.revenueCny)),
      itemStyle: { color: '#1890ff' },
      areaStyle: { opacity: 0.1 },
    },
    {
      name: t('margin.costCny'),
      type: 'line',
      smooth: true,
      data: trendData.value.map((d) => Number(d.costCny)),
      itemStyle: { color: '#fa8c16' },
      areaStyle: { opacity: 0.1 },
    },
    {
      name: t('margin.marginCny'),
      type: 'line',
      smooth: true,
      data: trendData.value.map((d) => Number(d.marginCny)),
      itemStyle: { color: '#52c41a' },
      areaStyle: { opacity: 0.1 },
    },
  ],
}))

const byModelOption = computed(() => {
  const data = byModelData.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.modelName || String(d.modelId)),
      axisLabel: { width: 80, overflow: 'truncate' },
    },
    series: [
      {
        name: t('margin.marginCny'),
        type: 'bar',
        data: data.map((d) => Number(d.marginCny)),
        itemStyle: { color: '#52c41a' },
        barMaxWidth: 20,
      },
    ],
  }
})

// === 数据加载 ===
async function loadSummary() {
  try {
    summary.value = await getMarginSummary(dateParams.value)
  } catch (e) {
    console.error('Failed to load margin summary:', e)
  }
}

async function loadByModel() {
  try {
    byModelData.value = await getMarginByModel(dateParams.value)
  } catch (e) {
    console.error('Failed to load margin by model:', e)
  }
}

async function loadTrend() {
  try {
    trendData.value = await getMarginTrend(dateParams.value)
  } catch (e) {
    console.error('Failed to load margin trend:', e)
  }
}

async function loadRateConfig() {
  try {
    const cfg = await getMarginConfig()
    const raw = cfg?.pointsToCostCnyRate
    rateInput.value = raw != null && raw !== '' ? Number(raw) : undefined
  } catch (e) {
    console.error('Failed to load margin config:', e)
  }
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadByModel(), loadTrend()])
}

async function handleSaveRate() {
  savingRate.value = true
  try {
    await updateMarginConfig({
      pointsToCostCnyRate: rateInput.value != null ? String(rateInput.value) : '',
    })
    message.success(t('margin.saveSuccess'))
    await loadSummary()
  } catch (e) {
    console.error('Failed to save margin config:', e)
  } finally {
    savingRate.value = false
  }
}

onMounted(async () => {
  await Promise.all([refreshAll(), loadRateConfig()])
})
</script>

<style scoped>
.margin-dashboard {
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

.config-card {
  margin-bottom: 16px;
}

.dashboard-row {
  margin-top: 16px;
}

.chart-container {
  height: 300px;
  width: 100%;
}

</style>
