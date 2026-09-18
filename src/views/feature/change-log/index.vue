<template>
  <div class="page-container">
    <ProTable :columns="columns" :request="loadData" :search="{}" :toolbar="{}" row-key="id">
      <template #emptyText>
        <a-empty :description="$t('feature.noChangeLogData')" />
      </template>
      <template #toolbar>
        <a-button @click="handleExport"> <DownloadOutlined /> {{ $t('common.export') }} </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'changeType'">
          <a-tag :color="changeTypeColorMap[record.changeType]">
            {{ featureChangeLogChangeTypeMap[record.changeType] || record.changeType }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'source'">
          <a-tag>
            {{ featureChangeLogSourceMap[record.source] || record.source }}
          </a-tag>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { DownloadOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { useI18n } from 'vue-i18n';

import { getFeatureChangeLog } from '@/api/feature';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();

const featureChangeLogChangeTypeMap: Record<string, string> = {
  grant: t('featureChangeLog.changeTypeMap.grant'),
  revoke: t('featureChangeLog.changeTypeMap.revoke'),
  upgrade: t('featureChangeLog.changeTypeMap.upgrade'),
  downgrade: t('featureChangeLog.changeTypeMap.downgrade'),
  manualAdd: t('featureChangeLog.changeTypeMap.manualAdd'),
  manualRemove: t('featureChangeLog.changeTypeMap.manualRemove'),
  manualRenew: t('featureChangeLog.changeTypeMap.manualRenew'),
  supersede: t('featureChangeLog.changeTypeMap.supersede'),
  expire: t('featureChangeLog.changeTypeMap.expire'),
};

const featureChangeLogSourceMap: Record<string, string> = {
  unionGrant: t('featureChangeLog.sourceMap.unionGrant'),
  unionRevoke: t('featureChangeLog.sourceMap.unionRevoke'),
  manual: t('featureChangeLog.sourceMap.manual'),
  systemExpire: t('featureChangeLog.sourceMap.systemExpire'),
};

const changeTypeColorMap: Record<string, string> = {
  grant: 'green',
  revoke: 'red',
  upgrade: 'blue',
  downgrade: 'orange',
  manualAdd: 'purple',
  manualRemove: 'volcano',
  manualRenew: 'cyan',
  supersede: 'gold',
  expire: 'default',
};

const columns = [
  {
    title: t('featureChangeLog.userId'),
    dataIndex: 'userId',
    search: true,
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('featureChangeLog.username'),
    dataIndex: 'username',
    search: true,
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('featureChangeLog.featureCode'),
    dataIndex: 'featureCode',
    search: true,
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('featureChangeLog.unionUserId'),
    dataIndex: 'unionUserId',
    search: true,
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('featureChangeLog.changeType'),
    dataIndex: 'changeType',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('featureChangeLog.changeTypeMap.grant'), value: 'grant' },
      { label: t('featureChangeLog.changeTypeMap.revoke'), value: 'revoke' },
      { label: t('featureChangeLog.changeTypeMap.upgrade'), value: 'upgrade' },
      { label: t('featureChangeLog.changeTypeMap.downgrade'), value: 'downgrade' },
      { label: t('featureChangeLog.changeTypeMap.manualAdd'), value: 'manualAdd' },
      { label: t('featureChangeLog.changeTypeMap.manualRemove'), value: 'manualRemove' },
      { label: t('featureChangeLog.changeTypeMap.manualRenew'), value: 'manualRenew' },
      { label: t('featureChangeLog.changeTypeMap.supersede'), value: 'supersede' },
      { label: t('featureChangeLog.changeTypeMap.expire'), value: 'expire' },
    ],
    width: 120,
  },
  {
    title: t('featureChangeLog.operator'),
    dataIndex: 'operator',
    width: 120,
  },
  {
    title: t('featureChangeLog.remark'),
    dataIndex: 'remark',
    ellipsis: true,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
];

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureChangeLog({
    userId: params.userId as number | undefined,
    username: params.username as string | undefined,
    featureCode: params.featureCode as string | undefined,
    unionUserId: params.unionUserId as string | undefined,
    changeType: params.changeType as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

function handleExport() {
  message.success(t('featureChangeLog.exportSuccess'));
}
</script>
