<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('billing.noPointsLogData')" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'changeType'">
          <a-tag :color="typeColorMap[record.changeType]">
            {{ typeMap[record.changeType] || record.changeType }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'bizType'">
          <a-tag :color="bizTypeColorMap[record.bizType]">
            {{ bizTypeMap[record.bizType] || record.bizType }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'amount'">
          <span :class="record.amount > 0 ? 'text-green-500' : record.amount < 0 ? 'text-red-500' : ''">
            {{ record.amount > 0 ? '+' : '' }}{{ record.amount }}
          </span>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getPointsLogList } from '@/api/points'

const { t } = useI18n()

const typeMap: Record<string, string> = {
  GRANT: t('points.typeMap.grant'),
  CONSUME: t('points.typeMap.consume'),
  ADJUST: t('points.typeMap.adjust'),
  REFUND: t('points.typeMap.refund'),
  EXPIRE: t('points.typeMap.expire'),
}

const bizTypeMap: Record<string, string> = {
  union: t('points.sourceMap.union'),
  manual: t('points.sourceMap.manual'),
  system: t('points.sourceMap.system'),
}

const typeColorMap: Record<string, string> = {
  GRANT: 'green',
  CONSUME: 'blue',
  ADJUST: 'orange',
  REFUND: 'purple',
  EXPIRE: 'default',
}

const bizTypeColorMap: Record<string, string> = {
  union: 'blue',
  manual: 'volcano',
  system: 'default',
}

const columns = [
  {
    title: t('points.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('points.amount'),
    dataIndex: 'amount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('points.balanceAfter'),
    dataIndex: 'balanceAfter',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('points.changeType'),
    dataIndex: 'changeType',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.typeMap.grant'), value: 'GRANT' },
      { label: t('points.typeMap.consume'), value: 'CONSUME' },
      { label: t('points.typeMap.adjust'), value: 'ADJUST' },
      { label: t('points.typeMap.refund'), value: 'REFUND' },
      { label: t('points.typeMap.expire'), value: 'EXPIRE' },
    ],
    width: 100,
  },
  {
    title: t('points.bizType'),
    dataIndex: 'bizType',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.sourceMap.union'), value: 'union' },
      { label: t('points.sourceMap.manual'), value: 'manual' },
      { label: t('points.sourceMap.system'), value: 'system' },
    ],
    width: 100,
  },
  {
    title: t('points.description'),
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
  const res = await getPointsLogList({
    userId: params.userId as number | undefined,
    changeType: params.changeType as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}
</script>
