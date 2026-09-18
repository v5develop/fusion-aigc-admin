<template>
  <div class="page-container">
    <ProTable :columns="columns" :request="loadData" :search="{}" row-key="id">
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
          <span
            :class="record.amount > 0 ? 'text-green-500' : record.amount < 0 ? 'text-red-500' : ''"
          >
            {{ record.amount > 0 ? '+' : '' }}{{ record.amount }}
          </span>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { getPointsLogList } from '@/api/points';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();

const typeMap: Record<string, string> = {
  GRANT: t('points.typeMap.grant'),
  CONSUME: t('points.typeMap.consume'),
  ADJUST: t('points.typeMap.adjust'),
  REFUND: t('points.typeMap.refund'),
  EXPIRE: t('points.typeMap.expire'),
  FREEZE: t('points.typeMap.freeze'),
  UNFREEZE: t('points.typeMap.unfreeze'),
  REVOKE: t('points.typeMap.revoke'),
  RECHARGE: t('points.typeMap.recharge'),
};

const bizTypeMap: Record<string, string> = {
  union: t('points.sourceMap.union'),
  manual: t('points.sourceMap.manual'),
  system: t('points.sourceMap.system'),
  CREATION: t('points.bizTypeMap.creation'),
  IMAGE_GEN: t('points.bizTypeMap.imageGen'),
  VIDEO_GEN: t('points.bizTypeMap.videoGen'),
  TEXT_CHAT: t('points.bizTypeMap.textChat'),
  AI_TOOL: t('points.bizTypeMap.aiTool'),
  union_grant: t('points.bizTypeMap.unionGrant'),
  UNION_RECHARGE: t('points.bizTypeMap.unionRecharge'),
  union_refund: t('points.bizTypeMap.unionRefund'),
  recharge: t('points.bizTypeMap.recharge'),
  admin_adjust: t('points.bizTypeMap.adminAdjust'),
  BATCH_EXPIRE: t('points.bizTypeMap.batchExpire'),
  admin_revoke: t('points.bizTypeMap.adminRevoke'),
};

const typeColorMap: Record<string, string> = {
  GRANT: 'green',
  CONSUME: 'blue',
  ADJUST: 'orange',
  REFUND: 'purple',
  EXPIRE: 'default',
  FREEZE: 'warning',
  UNFREEZE: 'cyan',
  REVOKE: 'red',
  RECHARGE: 'green',
};

const bizTypeColorMap: Record<string, string> = {
  union: 'blue',
  manual: 'volcano',
  system: 'default',
};

const columns = [
  {
    title: t('points.userId'),
    dataIndex: 'userId',
    search: true,
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('points.username'),
    dataIndex: 'username',
    width: 120,
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
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.typeMap.grant'), value: 'GRANT' },
      { label: t('points.typeMap.consume'), value: 'CONSUME' },
      { label: t('points.typeMap.adjust'), value: 'ADJUST' },
      { label: t('points.typeMap.refund'), value: 'REFUND' },
      { label: t('points.typeMap.expire'), value: 'EXPIRE' },
      { label: t('points.typeMap.freeze'), value: 'FREEZE' },
      { label: t('points.typeMap.unfreeze'), value: 'UNFREEZE' },
      { label: t('points.typeMap.revoke'), value: 'REVOKE' },
      { label: t('points.typeMap.recharge'), value: 'RECHARGE' },
    ],
    width: 100,
  },
  {
    title: t('points.bizType'),
    dataIndex: 'bizType',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('points.bizTypeMap.creation'), value: 'CREATION' },
      { label: t('points.bizTypeMap.imageGen'), value: 'IMAGE_GEN' },
      { label: t('points.bizTypeMap.videoGen'), value: 'VIDEO_GEN' },
      { label: t('points.bizTypeMap.textChat'), value: 'TEXT_CHAT' },
      { label: t('points.bizTypeMap.aiTool'), value: 'AI_TOOL' },
      { label: t('points.bizTypeMap.unionGrant'), value: 'union_grant' },
      { label: t('points.bizTypeMap.unionRecharge'), value: 'UNION_RECHARGE' },
      { label: t('points.bizTypeMap.unionRefund'), value: 'union_refund' },
      { label: t('points.bizTypeMap.recharge'), value: 'recharge' },
      { label: t('points.bizTypeMap.adminAdjust'), value: 'admin_adjust' },
      { label: t('points.bizTypeMap.batchExpire'), value: 'BATCH_EXPIRE' },
      { label: t('points.bizTypeMap.adminRevoke'), value: 'admin_revoke' },
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
];

async function loadData(params: Record<string, unknown>) {
  const res = await getPointsLogList({
    userId: params.userId as number | undefined,
    changeType: params.changeType as string | undefined,
    bizType: params.bizType as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}
</script>
