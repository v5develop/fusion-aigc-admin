<template>
  <div class="page-container">
    <a-card :title="$t('user.list')">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('user.noUserData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'avatar'">
            <a-avatar :src="record.avatar" v-if="record.avatar">
              {{ record.nickname?.charAt(0) }}
            </a-avatar>
            <a-avatar v-else>{{ record.nickname?.charAt(0) }}</a-avatar>
          </template>

          <template v-if="column.dataIndex === 'isUnionBound'">
            <a-tag :color="record.isUnionBound ? 'green' : 'default'">
              {{ record.isUnionBound ? $t('user.bound') : $t('user.unbound') }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColorMap[record.status]">
              {{ statusMap[record.status] || '-' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'pointsBalance'">
            <span class="points-value">{{ record.pointsBalance || 0 }}</span>
          </template>

          <template v-if="column.dataIndex === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleViewDetail(record)">
                {{ $t('common.view') }}
              </a-button>
              <a-button type="link" size="small" @click="handleAdjustPoints(record)">
                {{ $t('user.adjustPoints') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { message, Modal } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getUserList, adjustUserPoints } from '@/api/user'

const { t } = useI18n()
const router = useRouter()

const statusMap: Record<number, string> = {
  1: t('common.enabled'),
  0: t('common.disabled'),
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const columns = [
  {
    title: t('user.avatar'),
    dataIndex: 'avatar',
    width: 60,
    align: 'center' as const,
  },
  {
    title: t('user.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('user.nickname'),
    dataIndex: 'nickname',
    width: 120,
  },
  {
    title: t('user.email'),
    dataIndex: 'email',
    width: 180,
  },
  {
    title: t('user.phone'),
    dataIndex: 'phone',
    width: 140,
  },
  {
    title: t('user.unionBound'),
    dataIndex: 'isUnionBound',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('user.bound'), value: true },
      { label: t('user.unbound'), value: false },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('user.pointsBalance'),
    dataIndex: 'pointsBalance',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 160,
    fixed: 'right' as const,
    align: 'center' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getUserList({
    keyword: params.keyword as string | undefined,
    isUnionBound: params.isUnionBound as boolean | undefined,
    status: params.status as number | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function handleViewDetail(record: Record<string, unknown>) {
  router.push({ name: 'UserDetail', params: { id: String(record.id) } })
}

function handleAdjustPoints(record: Record<string, unknown>) {
  let amount = 0
  let reason = ''

  Modal.confirm({
    title: t('user.adjustPoints'),
    content: t('user.adjustPointsConfirm', { username: record.username }),
    width: 400,
    okText: t('common.confirm'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      try {
        await adjustUserPoints(record.id as number, { amount, reason })
        message.success(t('common.success'))
      } catch (error) {
        console.error('Adjust points failed:', error)
      }
    },
  })
}
</script>

<style scoped>
.points-value {
  font-weight: 600;
  color: var(--color-primary);
}
</style>
