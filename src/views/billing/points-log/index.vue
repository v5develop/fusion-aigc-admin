<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'type'">
          <a-tag :color="typeColorMap[record.type]">
            {{ typeMap[record.type] || record.type }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'source'">
          <a-tag :color="sourceColorMap[record.source]">
            {{ sourceMap[record.source] || record.source }}
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
  grant: t('points.typeMap.grant'),
  consume: t('points.typeMap.consume'),
  adjust: t('points.typeMap.adjust'),
  refund: t('points.typeMap.refund'),
  expire: t('points.typeMap.expire'),
}

const sourceMap: Record<string, string> = {
  union: t('points.sourceMap.union'),
  manual: t('points.sourceMap.manual'),
  system: t('points.sourceMap.system'),
}

const typeColorMap: Record<string, string> = {
  grant: 'green',
  consume: 'blue',
  adjust: 'orange',
  refund: 'purple',
  expire: 'default',
}

const sourceColorMap: Record<string, string> = {
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
    title: t('points.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('points.amount'),
    dataIndex: 'amount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('points.balance'),
    dataIndex: 'balance',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('points.type'),
    dataIndex: 'type',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.typeMap.grant'), value: 'grant' },
      { label: t('points.typeMap.consume'), value: 'consume' },
      { label: t('points.typeMap.adjust'), value: 'adjust' },
      { label: t('points.typeMap.refund'), value: 'refund' },
      { label: t('points.typeMap.expire'), value: 'expire' },
    ],
    width: 100,
  },
  {
    title: t('points.source'),
    dataIndex: 'source',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.sourceMap.union'), value: 'union' },
      { label: t('points.sourceMap.manual'), value: 'manual' },
      { label: t('points.sourceMap.system'), value: 'system' },
    ],
    width: 100,
  },
  {
    title: t('points.reason'),
    dataIndex: 'reason',
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
    type: params.type as string | undefined,
    source: params.source as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.items || [],
    total: res.total || 0,
    success: true,
  }
}
</script>
