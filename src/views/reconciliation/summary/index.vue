<template>
  <div class="page-container">
    <a-card :title="$t('reconciliation.summary')" class="mb-4">
      <!-- 视图切换 -->
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <a-tab-pane key="summary" :tab="$t('reconciliation.summary')" />
        <a-tab-pane key="monthly" :tab="$t('reconciliation.monthly')" />
      </a-tabs>

      <!-- 汇总视图 -->
      <template v-if="activeTab === 'summary'">
        <a-form layout="inline" style="margin-bottom: 16px;">
          <a-form-item :label="$t('reconciliation.period')">
            <a-range-picker v-model:value="dateRange" @change="handleDateChange" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="loadSummary" :loading="loading">
              {{ $t('common.search') }}
            </a-button>
          </a-form-item>
          <a-form-item>
            <a-button @click="handleExport" :loading="exporting">
              <template #icon><DownloadOutlined /></template>
              {{ $t('common.export') }}
            </a-button>
          </a-form-item>
        </a-form>

        <a-row :gutter="[16, 16]" class="mb-4">
          <a-col :xs="24" :sm="12" :lg="6">
            <ProStatCard
              :label="$t('reconciliation.totalRecharge')"
              :value="summary.totalRecharge"
              suffix="pts"
              color="#1890ff"
            />
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <ProStatCard
              :label="$t('reconciliation.totalConsume')"
              :value="summary.totalConsume"
              suffix="pts"
              color="#52c41a"
            />
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <ProStatCard
              :label="$t('reconciliation.totalRefund')"
              :value="summary.totalRefund"
              suffix="pts"
              color="#faad14"
            />
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <ProStatCard
              :label="$t('reconciliation.differenceAmount')"
              :value="summary.differenceAmount"
              suffix="pts"
              :color="summary.differenceAmount !== 0 ? '#ff4d4f' : '#52c41a'"
            />
          </a-col>
        </a-row>

        <!-- 趋势图 -->
        <div ref="trendChartRef" class="chart-container mb-4"></div>

        <a-table
          :columns="columns"
          :data-source="summary.items"
          :pagination="false"
          row-key="date"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'difference'">
              <span :class="record.difference !== 0 ? 'text-red-500' : 'text-green-500'">
                {{ record.difference }}
              </span>
            </template>
          </template>
        </a-table>
      </template>

      <!-- 月度明细视图 -->
      <template v-if="activeTab === 'monthly'">
        <a-form layout="inline" style="margin-bottom: 16px;">
          <a-form-item :label="$t('reconciliation.month')">
            <a-date-picker
              v-model:value="selectedMonth"
              picker="month"
              @change="loadMonthly"
            />
          </a-form-item>
        </a-form>

        <a-row :gutter="[16, 16]" class="mb-4">
          <a-col :xs="24" :sm="12" :lg="8">
            <ProStatCard
              :label="$t('reconciliation.totalRecharge')"
              :value="monthly.totalRecharge"
              suffix="pts"
              color="#1890ff"
            />
          </a-col>
          <a-col :xs="24" :sm="12" :lg="8">
            <ProStatCard
              :label="$t('reconciliation.totalConsume')"
              :value="monthly.totalConsume"
              suffix="pts"
              color="#52c41a"
            />
          </a-col>
          <a-col :xs="24" :sm="12" :lg="8">
            <ProStatCard
              :label="$t('reconciliation.differenceAmount')"
              :value="monthly.totalDifference"
              suffix="pts"
              :color="monthly.totalDifference !== 0 ? '#ff4d4f' : '#52c41a'"
            />
          </a-col>
        </a-row>

        <!-- 月度趋势图 -->
        <div ref="monthlyChartRef" class="chart-container mb-4"></div>

        <a-table
          :columns="monthlyColumns"
          :data-source="monthly.items"
          :pagination="{ pageSize: 31 }"
          row-key="date"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'difference'">
              <span :class="record.difference !== 0 ? 'text-red-500' : 'text-green-500'">
                {{ record.difference }}
              </span>
            </template>
          </template>
        </a-table>
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'
import { DownloadOutlined } from '@antdv-next/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import ProStatCard from '@/components/Pro/ProStatCard/index.vue'
import { getReconciliationSummary, getReconciliationMonthly, exportReconciliation } from '@/api/reconciliation'

const { t } = useI18n()

const loading = ref(false)
const exporting = ref(false)
const activeTab = ref('summary')
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
const selectedMonth = ref<Dayjs>(dayjs())
const trendChartRef = ref<HTMLElement>()
const monthlyChartRef = ref<HTMLElement>()

const summary = reactive({
  totalRecharge: 0,
  totalConsume: 0,
  totalRefund: 0,
  differenceAmount: 0,
  items: [] as Array<{
    date: string
    rechargeCount: number
    consumeCount: number
    refundCount: number
    rechargeAmount: number
    consumeAmount: number
    refundAmount: number
    difference: number
  }>,
})

const monthly = reactive({
  totalRecharge: 0,
  totalConsume: 0,
  totalDifference: 0,
  items: [] as Array<{
    date: string
    rechargeCount: number
    consumeCount: number
    rechargeAmount: number
    consumeAmount: number
    difference: number
  }>,
})

const columns = [
  { title: t('reconciliation.date'), dataIndex: 'date', width: 120 },
  { title: t('reconciliation.rechargeCount'), dataIndex: 'rechargeCount', width: 100, align: 'center' as const },
  { title: t('reconciliation.consumeCount'), dataIndex: 'consumeCount', width: 100, align: 'center' as const },
  { title: t('reconciliation.refundCount'), dataIndex: 'refundCount', width: 100, align: 'center' as const },
  { title: t('reconciliation.differenceValue'), dataIndex: 'difference', width: 120, align: 'center' as const },
]

const monthlyColumns = [
  { title: t('reconciliation.date'), dataIndex: 'date', width: 120 },
  { title: t('reconciliation.rechargeCount'), dataIndex: 'rechargeCount', width: 100, align: 'center' as const },
  { title: t('reconciliation.rechargeAmount'), dataIndex: 'rechargeAmount', width: 120, align: 'center' as const },
  { title: t('reconciliation.consumeCount'), dataIndex: 'consumeCount', width: 100, align: 'center' as const },
  { title: t('reconciliation.consumeAmount'), dataIndex: 'consumeAmount', width: 120, align: 'center' as const },
  { title: t('reconciliation.differenceValue'), dataIndex: 'difference', width: 120, align: 'center' as const },
]

function handleTabChange() {
  if (activeTab.value === 'monthly') {
    loadMonthly()
  }
}

function handleDateChange() {
  loadSummary()
}

async function loadSummary() {
  if (!dateRange.value || dateRange.value.length !== 2) return
  loading.value = true
  try {
    const res = await getReconciliationSummary({
      startDate: dateRange.value[0].format('YYYY-MM-DD'),
      endDate: dateRange.value[1].format('YYYY-MM-DD'),
    })
    summary.totalRecharge = res?.totalRecharge || 0
    summary.totalConsume = res?.totalConsume || 0
    summary.totalRefund = res?.totalRefund || 0
    summary.differenceAmount = res?.differenceAmount || 0
    summary.items = res?.items || []

    await nextTick()
    renderTrendChart(summary.items)
  } finally {
    loading.value = false
  }
}

async function loadMonthly() {
  if (!selectedMonth.value) return
  loading.value = true
  try {
    const res = await getReconciliationMonthly({
      yearMonth: selectedMonth.value.format('YYYY-MM'),
    })
    monthly.totalRecharge = res?.totalRecharge || 0
    monthly.totalConsume = res?.totalConsume || 0
    monthly.totalDifference = res?.totalDifference || 0
    monthly.items = res?.items || []

    await nextTick()
    renderMonthlyChart(monthly.items)
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  if (!dateRange.value || dateRange.value.length !== 2) {
    message.warning('请先选择日期范围')
    return
  }
  exporting.value = true
  try {
    const blob = await exportReconciliation({
      startDate: dateRange.value[0].format('YYYY-MM-DD'),
      endDate: dateRange.value[1].format('YYYY-MM-DD'),
    }) as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reconciliation_${dateRange.value[0].format('YYYY-MM-DD')}_${dateRange.value[1].format('YYYY-MM-DD')}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    message.success('导出成功')
  } catch (error) {
    console.error('Export failed:', error)
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

function renderTrendChart(items: Array<{ date: string; rechargeAmount: number; consumeAmount: number; difference: number }>) {
  if (!trendChartRef.value || !items.length) return
  const maxVal = Math.max(...items.map(i => Math.max(i.rechargeAmount, Math.abs(i.consumeAmount))), 1)
  trendChartRef.value.innerHTML = `
    <div class="bar-chart">
      ${items.map(item => {
        const consumeVal = Math.abs(item.consumeAmount)
        return `
        <div class="bar-group">
          <div class="bar-track">
            <div class="bar bar-recharge" style="height: ${(item.rechargeAmount / maxVal) * 100}%" data-tip="充值 ${item.rechargeAmount}"></div>
            <div class="bar bar-consume" style="height: ${(consumeVal / maxVal) * 100}%" data-tip="消费 ${consumeVal}"></div>
          </div>
          <div class="bar-label">${item.date.slice(5)}</div>
        </div>
      `}).join('')}
    </div>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-dot legend-recharge"></span>充值</span>
      <span class="legend-item"><span class="legend-dot legend-consume"></span>消费</span>
    </div>
  `
}

function renderMonthlyChart(items: Array<{ date: string; rechargeAmount: number; consumeAmount: number }>) {
  if (!monthlyChartRef.value || !items.length) return
  const maxVal = Math.max(...items.map(i => Math.max(i.rechargeAmount, Math.abs(i.consumeAmount))), 1)
  monthlyChartRef.value.innerHTML = `
    <div class="bar-chart">
      ${items.map(item => {
        const consumeVal = Math.abs(item.consumeAmount)
        return `
        <div class="bar-group">
          <div class="bar-track">
            <div class="bar bar-recharge" style="height: ${(item.rechargeAmount / maxVal) * 100}%" data-tip="充值 ${item.rechargeAmount}"></div>
            <div class="bar bar-consume" style="height: ${(consumeVal / maxVal) * 100}%" data-tip="消费 ${consumeVal}"></div>
          </div>
          <div class="bar-label">${item.date.slice(8)}</div>
        </div>
      `}).join('')}
    </div>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-dot legend-recharge"></span>充值</span>
      <span class="legend-item"><span class="legend-dot legend-consume"></span>消费</span>
    </div>
  `
}

onMounted(() => {
  loadSummary()
})
</script>

<style scoped>
.chart-container {
  height: 240px;
  padding: 16px;
  background: var(--color-fill-quaternary);
  border-radius: 8px;
}

.chart-container :deep(.bar-chart) {
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  height: 180px;
  gap: 4px;
}

.chart-container :deep(.bar-group) {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  max-width: 40px;
}

.chart-container :deep(.bar-track) {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  min-height: 0;
}

.chart-container :deep(.bar) {
  width: 45%;
  min-height: 4px;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
}

.chart-container :deep(.bar::after) {
  content: attr(data-tip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  border-radius: 4px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease;
  pointer-events: none;
  z-index: 10;
}

.chart-container :deep(.bar:hover::after) {
  opacity: 1;
  visibility: visible;
}

.chart-container :deep(.bar-recharge) {
  background: linear-gradient(180deg, #1890ff 0%, #69c0ff 100%);
}

.chart-container :deep(.bar-consume) {
  background: linear-gradient(180deg, #52c41a 0%, #95de64 100%);
}

.chart-container :deep(.bar-label) {
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  white-space: nowrap;
}

.chart-container :deep(.chart-legend) {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 8px;
}

.chart-container :deep(.legend-item) {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.chart-container :deep(.legend-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chart-container :deep(.legend-recharge) { background: #1890ff; }
.chart-container :deep(.legend-consume) { background: #52c41a; }
</style>
