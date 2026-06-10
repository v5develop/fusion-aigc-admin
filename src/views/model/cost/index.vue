<template>
  <div class="page-container">
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('cost.todayCost')"
          :value="stats.todayCost"
          prefix="¥"
          :precision="2"
          color="#1890ff"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('cost.totalCount')"
          :value="stats.totalCount"
          color="#52c41a"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="8">
        <ProStatCard
          :label="$t('cost.modelCount')"
          :value="Object.keys(stats.costByModel).length"
          color="#722ed1"
        />
      </a-col>
    </a-row>

    <a-card :title="$t('cost.title')">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('cost.noCostData')" />
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
import { getCostList, getCostStats } from '@/api/cost'

const { t } = useI18n()

const stats = ref({
  todayCost: 0,
  totalCount: 0,
  costByModel: {} as Record<string, number>,
})

const columns = [
  {
    title: t('cost.reservationNo'),
    dataIndex: 'reservationNo',
    width: 180,
  },
  {
    title: t('cost.taskId'),
    dataIndex: 'taskId',
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('cost.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('cost.username'),
    dataIndex: 'username',
    width: 120,
  },
  {
    title: t('cost.modelId'),
    dataIndex: 'modelId',
    width: 180,
    customRender: ({ record }: { record: { modelName?: string; modelId: number } }) => {
      return record.modelName ? `${record.modelName} (${record.modelId})` : record.modelId
    },
  },
  {
    title: t('cost.pointsConsumed'),
    dataIndex: 'pointsConsumed',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('cost.costSource'),
    dataIndex: 'costSource',
    width: 100,
    customRender: ({ record }: { record: { costSource?: string } }) => {
      const source = record.costSource
      if (source === 'billed') return '供应商计费'
      if (source === 'estimated') return '预估'
      return '-'
    },
  },
  {
    title: t('cost.actualCostAmount'),
    dataIndex: 'actualCostAmount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('cost.actualCostCurrency'),
    dataIndex: 'actualCostCurrency',
    width: 100,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getCostList({
    modelId: params.modelId as number | undefined,
    userId: params.userId as number | undefined,
    startDate: params.startDate as string | undefined,
    endDate: params.endDate as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

onMounted(async () => {
  try {
    const res = await getCostStats({})
    stats.value = res
  } catch (error) {
    console.error('Failed to load cost stats:', error)
  }
})
</script>
