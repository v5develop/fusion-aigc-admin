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

          <template v-if="column.dataIndex === 'balance'">
            <span class="points-value">{{ record.balance || 0 }}</span>
          </template>

          <template v-if="column.key === 'operation'">
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

    <a-modal
      v-model:open="adjustModalVisible"
      :title="$t('user.adjustPoints')"
      @ok="handleConfirmAdjust"
    >
      <a-form layout="vertical">
        <a-form-item label="用户">
          <a-input :value="adjustForm.username" disabled />
        </a-form-item>
        <a-form-item label="操作类型">
          <a-radio-group v-model:value="adjustForm.adjustType">
            <a-radio value="ADD">增加</a-radio>
            <a-radio value="DEDUCT">扣减</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="调整点数">
          <a-input-number v-model:value="adjustForm.amount" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="调整原因">
          <a-textarea v-model:value="adjustForm.reason" :rows="3" placeholder="请输入调整原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getUserList } from '@/api/user'
import { adjustPoints } from '@/api/points'
import { ref } from 'vue'

const { t } = useI18n()
const router = useRouter()

const adjustModalVisible = ref(false)
const adjustForm = ref({ userId: 0, username: '', amount: 0, reason: '', adjustType: 'ADD' as string })

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
    dataIndex: 'balance',
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
    dataIndex: 'operation',
    key: 'operation',
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
  adjustForm.value = {
    userId: record.id as number,
    username: record.username as string,
    amount: 0,
    reason: '',
    adjustType: 'ADD',
  }
  adjustModalVisible.value = true
}

async function handleConfirmAdjust() {
  if (!adjustForm.value.reason) {
    message.warning('请输入调整原因')
    return
  }
  if (adjustForm.value.amount <= 0) {
    message.warning('调整点数必须大于0')
    return
  }
  try {
    await adjustPoints({
      userId: adjustForm.value.userId,
      adjustType: adjustForm.value.adjustType,
      amount: adjustForm.value.amount,
      reason: adjustForm.value.reason,
    })
    message.success(t('common.success'))
    adjustModalVisible.value = false
  } catch (error) {
    console.error('Adjust points failed:', error)
  }
}
</script>

<style scoped>
.points-value {
  font-weight: 600;
  color: var(--color-primary);
}
</style>
