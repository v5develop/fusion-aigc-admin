<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('feature.noChangeLogData')" />
      </template>
      <template #toolbar>
        <a-button @click="handleExport">
          <DownloadOutlined /> {{ $t('common.export') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'changeType'">
          <a-tag :color="changeTypeColorMap[record.changeType]">
            {{ capabilityChangeLogChangeTypeMap[record.changeType] || record.changeType }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'source'">
          <a-tag>
            {{ capabilityChangeLogSourceMap[record.source] || record.source }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'pointsChange'">
          <span :class="record.pointsChange > 0 ? 'text-green-500' : record.pointsChange < 0 ? 'text-red-500' : ''">
            {{ record.pointsChange > 0 ? '+' : '' }}{{ record.pointsChange }}
          </span>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { DownloadOutlined } from '@antdv-next/icons'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getFeatureChangeLog } from '@/api/feature'

const { t } = useI18n()

const capabilityChangeLogChangeTypeMap: Record<string, string> = {
  grant: t('capabilityChangeLog.changeTypeMap.grant'),
  revoke: t('capabilityChangeLog.changeTypeMap.revoke'),
  upgrade: t('capabilityChangeLog.changeTypeMap.upgrade'),
  downgrade: t('capabilityChangeLog.changeTypeMap.downgrade'),
  manualAdd: t('capabilityChangeLog.changeTypeMap.manualAdd'),
  manualRemove: t('capabilityChangeLog.changeTypeMap.manualRemove'),
  expire: t('capabilityChangeLog.changeTypeMap.expire'),
}

const capabilityChangeLogSourceMap: Record<string, string> = {
  unionGrant: t('capabilityChangeLog.sourceMap.unionGrant'),
  unionRevoke: t('capabilityChangeLog.sourceMap.unionRevoke'),
  manual: t('capabilityChangeLog.sourceMap.manual'),
  systemExpire: t('capabilityChangeLog.sourceMap.systemExpire'),
}

const changeTypeColorMap: Record<string, string> = {
  grant: 'green',
  revoke: 'red',
  upgrade: 'blue',
  downgrade: 'orange',
  manualAdd: 'purple',
  manualRemove: 'volcano',
  expire: 'default',
}

const columns = [
  {
    title: t('capabilityChangeLog.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('capabilityChangeLog.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('capabilityChangeLog.featureCode'),
    dataIndex: 'featureCode',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('capabilityChangeLog.unionUserId'),
    dataIndex: 'unionUserId',
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('capabilityChangeLog.changeType'),
    dataIndex: 'changeType',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('capabilityChangeLog.changeTypeMap.grant'), value: 'grant' },
      { label: t('capabilityChangeLog.changeTypeMap.revoke'), value: 'revoke' },
      { label: t('capabilityChangeLog.changeTypeMap.upgrade'), value: 'upgrade' },
      { label: t('capabilityChangeLog.changeTypeMap.downgrade'), value: 'downgrade' },
      { label: t('capabilityChangeLog.changeTypeMap.manualAdd'), value: 'manualAdd' },
      { label: t('capabilityChangeLog.changeTypeMap.manualRemove'), value: 'manualRemove' },
      { label: t('capabilityChangeLog.changeTypeMap.expire'), value: 'expire' },
    ],
    width: 120,
  },
  {
    title: t('capabilityChangeLog.pointsChange'),
    dataIndex: 'pointsChange',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('capabilityChangeLog.operator'),
    dataIndex: 'operator',
    width: 120,
  },
  {
    title: t('capabilityChangeLog.remark'),
    dataIndex: 'remark',
    ellipsis: true,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureChangeLog({
    featureId: params.featureId as number | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function handleExport() {
  message.success(t('capabilityChangeLog.exportSuccess'))
}
</script>
