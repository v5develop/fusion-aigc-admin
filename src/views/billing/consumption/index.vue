<template>
  <div class="page-container">
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('billing.todayConsumption')"
          :value="stats.todayConsumption"
          suffix="pts"
          color="#1890ff"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('billing.monthConsumption')"
          :value="stats.monthConsumption"
          suffix="pts"
          color="#52c41a"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('billing.todayThirdPartyCost')"
          :value="stats.todayThirdPartyCost"
          prefix="¥"
          :precision="2"
          color="#fa541c"
        />
      </a-col>
    </a-row>

    <a-card :title="$t('billing.consumption')">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'featureName'">
            {{ record.featureName?.[currentLocale] || record.featureName?.['zh-CN'] || '-' }}
          </template>

          <template v-if="column.dataIndex === 'billingStatus'">
            <a-tag :color="billingStatusColorMap[record.billingStatus]">
              {{ billingStatusMap[record.billingStatus] || record.billingStatus || '-' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColorMap[record.status]">
              {{ statusMap[record.status] || '-' }}
            </a-tag>
          </template>
        </template>
      </ProTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import ProStatCard from '@/components/Pro/ProStatCard/index.vue'
import { getConsumptionList, getConsumptionStats } from '@/api/consumption'
import { getLocale } from '@/locales'

const { t } = useI18n()
const currentLocale = computed(() => getLocale())

const stats = ref({
  todayConsumption: 0,
  monthConsumption: 0,
  todayThirdPartyCost: 0,
})

async function loadStats() {
  try {
    const res = await getConsumptionStats()
    stats.value = res
  } catch (error) {
    console.error('Failed to load consumption stats:', error)
  }
}

const statusMap: Record<number, string> = {
  1: t('billing.statusMap.success'),
  2: t('billing.statusMap.failed'),
  3: t('billing.statusMap.processing'),
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  2: 'red',
  3: 'blue',
}

const billingStatusMap: Record<string, string> = {
  NONE: '-',
  HELD: t('billing.billingStatusMap.held'),
  CONFIRMED: t('billing.billingStatusMap.confirmed'),
  REFUNDED: t('billing.billingStatusMap.refunded'),
  CANCELLED: t('billing.billingStatusMap.cancelled'),
  SETTLEMENT_FAILED: t('billing.billingStatusMap.settlementFailed'),
}

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
}

const columns = [
  {
    title: t('capabilityGrant.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('feature.featureName'),
    dataIndex: 'featureName',
    width: 150,
  },
  {
    title: t('model.modelCode'),
    dataIndex: 'modelCode',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('billing.reservationNo'),
    dataIndex: 'reservationNo',
    width: 180,
  },
  {
    title: t('billing.billingStatus'),
    dataIndex: 'billingStatus',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('billing.billingStatusMap.held'), value: 'HELD' },
      { label: t('billing.billingStatusMap.confirmed'), value: 'CONFIRMED' },
      { label: t('billing.billingStatusMap.refunded'), value: 'REFUNDED' },
      { label: t('billing.billingStatusMap.cancelled'), value: 'CANCELLED' },
      { label: t('billing.billingStatusMap.settlementFailed'), value: 'SETTLEMENT_FAILED' },
    ],
    width: 140,
    align: 'center' as const,
  },
  {
    title: t('billing.spec'),
    dataIndex: 'spec',
    width: 120,
  },
  {
    title: t('billing.inputTokens'),
    dataIndex: 'inputTokens',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.outputTokens'),
    dataIndex: 'outputTokens',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.pointsCost'),
    dataIndex: 'pointsCost',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.thirdPartyCost'),
    dataIndex: 'thirdPartyCost',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('billing.statusMap.success'), value: 1 },
      { label: t('billing.statusMap.failed'), value: 2 },
      { label: t('billing.statusMap.processing'), value: 3 },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getConsumptionList({
    userId: params.userId as number | undefined,
    featureCode: params.featureCode as string | undefined,
    billingStatus: params.billingStatus as string | undefined,
    status: params.status as number | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.items || [],
    total: res.total || 0,
    success: true,
  }
}

onMounted(() => {
  loadStats()
})
</script>
