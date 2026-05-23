<template>
  <div class="page-container">
    <a-card :title="$t('reconciliation.summary')" class="mb-4">
      <a-form layout="inline" class="mb-4">
        <a-form-item :label="$t('reconciliation.period')">
          <a-range-picker v-model:value="dateRange" @change="handleDateChange" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadSummary" :loading="loading">
            {{ $t('common.search') }}
          </a-button>
        </a-form-item>
      </a-form>

      <a-row :gutter="[16, 16]" class="mb-4">
        <a-col :xs="24" :sm="12" :lg="6">
          <ProStatCard
            :label="$t('reconciliation.totalGrant')"
            :value="summary.totalGrant"
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
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import ProStatCard from '@/components/Pro/ProStatCard/index.vue'
import { getReconciliationSummary } from '@/api/reconciliation'

const { t } = useI18n()

const loading = ref(false)
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])

const summary = reactive({
  totalGrant: 0,
  totalConsume: 0,
  totalRefund: 0,
  differenceAmount: 0,
  items: [] as Array<{
    date: string
    grantCount: number
    consumeCount: number
    refundCount: number
    grantAmount: number
    consumeAmount: number
    refundAmount: number
    difference: number
  }>,
})

const columns = [
  {
    title: t('reconciliation.date'),
    dataIndex: 'date',
    width: 120,
  },
  {
    title: t('reconciliation.grantCount'),
    dataIndex: 'grantCount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.consumeCount'),
    dataIndex: 'consumeCount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.refundCount'),
    dataIndex: 'refundCount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.differenceValue'),
    dataIndex: 'difference',
    width: 120,
    align: 'center' as const,
  },
]

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
    summary.totalGrant = res?.totalGrant || 0
    summary.totalConsume = res?.totalConsume || 0
    summary.totalRefund = res?.totalRefund || 0
    summary.differenceAmount = res?.differenceAmount || 0
    summary.items = res?.items || []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSummary()
})
</script>
