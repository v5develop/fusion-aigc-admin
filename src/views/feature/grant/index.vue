<template>
  <div class="page-container">
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

        <template v-if="column.dataIndex === 'source'">
          <a-tag :color="record.source === 'union' ? 'blue' : 'orange'">
            {{ capabilityGrantSourceMap[record.source] || record.source }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColorMap[record.status]">
            {{ capabilityGrantStatusMap[record.status] || '-' }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'action'">
          <a-button
            v-if="record.status === 1"
            type="link"
            size="small"
            danger
            @click="handleRevoke(record)"
          >
            {{ $t('capabilityGrant.revoke') }}
          </a-button>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getFeatureGrantList, revokeCapability } from '@/api/feature'
import { getLocale } from '@/locales'

const { t } = useI18n()
const currentLocale = computed(() => getLocale())

const capabilityGrantSourceMap: Record<string, string> = {
  union: t('capabilityGrant.sourceMap.union'),
  manual: t('capabilityGrant.sourceMap.manual'),
}

const capabilityGrantStatusMap: Record<number, string> = {
  1: t('capabilityGrant.statusMap.active'),
  2: t('capabilityGrant.statusMap.expired'),
  3: t('capabilityGrant.statusMap.revoked'),
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  2: 'default',
  3: 'red',
}

const columns = [
  {
    title: t('capabilityGrant.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('capabilityGrant.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('capabilityGrant.featureName'),
    dataIndex: 'featureName',
    width: 180,
  },
  {
    title: t('capabilityGrant.source'),
    dataIndex: 'source',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('capabilityGrant.sourceMap.union'), value: 'union' },
      { label: t('capabilityGrant.sourceMap.manual'), value: 'manual' },
    ],
    width: 100,
  },
  {
    title: t('capabilityGrant.effectiveTime'),
    dataIndex: 'effectiveTime',
    width: 180,
  },
  {
    title: t('capabilityGrant.expireTime'),
    dataIndex: 'expireTime',
    width: 180,
  },
  {
    title: t('capabilityGrant.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('capabilityGrant.statusMap.active'), value: 1 },
      { label: t('capabilityGrant.statusMap.expired'), value: 2 },
      { label: t('capabilityGrant.statusMap.revoked'), value: 3 },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 120,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureGrantList({
    userId: params.userId as number | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.items || [],
    total: res.total || 0,
    success: true,
  }
}

function handleRevoke(record: { id: number }) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('capabilityGrant.confirmRevoke'),
    onOk: async () => {
      await revokeCapability(record.id)
      message.success(t('capabilityGrant.revokeSuccess'))
    },
  })
}
</script>
