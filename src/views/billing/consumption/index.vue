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
        <template #emptyText>
          <a-empty :description="$t('billing.noConsumptionData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'amount'">
            <span :class="record.amount < 0 ? 'text-red-500' : ''">
              {{ record.amount }}
            </span>
          </template>
        </template>
      </ProTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import ProStatCard from '@/components/Pro/ProStatCard/index.vue'
import { getConsumptionList, getConsumptionStats } from '@/api/consumption'

const { t } = useI18n()

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

const columns = [
  {
    title: t('billing.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('billing.username'),
    dataIndex: 'username',
    width: 120,
  },
  {
    title: t('billing.amount'),
    dataIndex: 'amount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.balanceAfter'),
    dataIndex: 'balanceAfter',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.bizType'),
    dataIndex: 'bizType',
    width: 120,
  },
  {
    title: t('billing.bizId'),
    dataIndex: 'bizId',
    width: 180,
  },
  {
    title: t('billing.description'),
    dataIndex: 'description',
    ellipsis: true,
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
    bizKeyword: params.bizKeyword as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

onMounted(() => {
  loadStats()
})
</script>
