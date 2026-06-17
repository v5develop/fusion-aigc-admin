<template>
  <div class="page-container">
    <a-card :title="$t('user.list')">
      <ProTable
        ref="proTableRef"
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
            <a-avatar v-if="record.avatar && !failedAvatars.has(record.avatar)" :src="record.avatar" @error="handleAvatarError(record)">
              {{ record.nickname?.charAt(0) }}
            </a-avatar>
            <a-avatar v-else>{{ record.nickname?.charAt(0) }}</a-avatar>
          </template>

          <template v-if="column.dataIndex === 'unionBound'">
            <a-tag :color="record.unionBound === 1 ? 'green' : 'default'">
              {{ record.unionBound === 1 ? $t('user.bound') : $t('user.unbound') }}
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
              <a-button type="link" size="small" @click="handleGrant(record)">
                {{ $t('user.grantCapability') }}
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

    <!-- 授权创作能力弹窗 -->
    <a-modal
      v-model:open="grantModalVisible"
      :title="$t('user.grantCapability')"
      @ok="handleConfirmGrant"
      :confirm-loading="grantLoading"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('user.username')">
          <a-input :value="grantForm.username" disabled />
        </a-form-item>
        <a-form-item :label="$t('featureGrant.featureCode')" required>
          <a-select
            v-model:value="grantForm.featureCode"
            :placeholder="$t('featureGrant.selectFeature')"
            :options="featureSelectOptions"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('featureGrant.expireTime')">
          <a-date-picker v-model:value="grantForm.expireTime" show-time style="width: 100%" />
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
import { manualAddFeature, getFeatureOptions } from '@/api/feature'
import { getLocale } from '@/locales'
import { uuid } from '@/utils/helpers'
import { ref, computed } from 'vue'
import type { Dayjs } from 'dayjs'
import type { Feature } from '@/types/api'

const { t } = useI18n()
const router = useRouter()
const currentLocale = computed(() => getLocale())

const proTableRef = ref<InstanceType<typeof ProTable> | null>(null)
const adjustModalVisible = ref(false)
const adjustForm = ref({ userId: 0, username: '', amount: 0, reason: '', adjustType: 'ADD' as string })
const failedAvatars = ref(new Set<string>())

// 授权创作能力
const grantModalVisible = ref(false)
const grantLoading = ref(false)
const grantForm = ref<{
  userId: number
  username: string
  featureCode: string | undefined
  expireTime: Dayjs | undefined
}>({ userId: 0, username: '', featureCode: undefined, expireTime: undefined })
const featureOptions = ref<Feature[]>([])
const featureSelectOptions = computed(() =>
  featureOptions.value.map((f) => ({
    label: f.featureName?.[currentLocale.value] || f.featureName?.['zh-CN'] || f.featureCode,
    value: f.featureCode,
  }))
)

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
    title: t('user.keyword'),
    dataIndex: 'keyword',
    search: true,
    searchType: 'input' as const,
    searchProps: { placeholder: t('user.keywordPlaceholder') },
    hideInTable: true,
  },
  {
    title: t('user.username'),
    dataIndex: 'username',
    search: true,
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
    dataIndex: 'unionBound',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('user.bound'), value: 1 },
      { label: t('user.unbound'), value: 0 },
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
    search: true,
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
    search: true,
    searchType: 'dateRange' as const,
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 240,
    fixed: 'right' as const,
    align: 'center' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  // createTime 为 dateRange 搜索，值为 [start, end] 的 dayjs 数组
  const range = params.createTime as [Dayjs, Dayjs] | undefined
  const startTime = range?.[0] ? range[0].startOf('day').format('YYYY-MM-DD HH:mm:ss') : undefined
  const endTime = range?.[1] ? range[1].endOf('day').format('YYYY-MM-DD HH:mm:ss') : undefined

  const res = await getUserList({
    keyword: params.keyword as string | undefined,
    username: params.username as string | undefined,
    unionBound: params.unionBound as number | undefined,
    status: params.status as number | undefined,
    startTime,
    endTime,
    page: (params.current as number) || 1,
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

function handleAvatarError(record: Record<string, unknown>) {
  if (record.avatar) {
    failedAvatars.value.add(record.avatar as string)
  }
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
      idempotencyKey: uuid(),
    })
    message.success(t('common.success'))
    adjustModalVisible.value = false
    proTableRef.value?.refresh()
  } catch (error) {
    console.error('Adjust points failed:', error)
  }
}

async function loadFeatureOptions() {
  try {
    const res = await getFeatureOptions()
    featureOptions.value = res || []
  } catch {
    // 能力选项获取失败不阻塞主流程
  }
}

function handleGrant(record: Record<string, unknown>) {
  grantForm.value = {
    userId: record.id as number,
    username: (record.username as string) || (record.nickname as string) || '',
    featureCode: undefined,
    expireTime: undefined,
  }
  grantModalVisible.value = true
  // 打开弹窗时确保能力选项已加载（兜底）
  if (featureOptions.value.length === 0) {
    loadFeatureOptions()
  }
}

async function handleConfirmGrant() {
  if (!grantForm.value.featureCode) {
    message.error(t('featureGrant.featureCodeRequired'))
    return
  }
  if (!grantForm.value.userId) {
    message.error(t('user.userNotFound'))
    return
  }
  grantLoading.value = true
  try {
    await manualAddFeature({
      userId: grantForm.value.userId,
      featureCode: grantForm.value.featureCode,
      expireTime: grantForm.value.expireTime?.format('YYYY-MM-DD HH:mm:ss'),
    })
    message.success(t('featureGrant.manualAddSuccess'))
    grantModalVisible.value = false
    proTableRef.value?.refresh()
  } catch {
    // 错误已在 request 拦截器中处理
  } finally {
    grantLoading.value = false
  }
}
</script>

<style scoped>
.points-value {
  font-weight: 600;
  color: var(--color-primary);
}
</style>
