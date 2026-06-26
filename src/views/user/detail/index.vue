<template>
  <div class="page-container">
    <div class="detail-header">
      <div class="detail-header-left">
        <a-button type="text" class="detail-back-btn" @click="handleBack">
          <ArrowLeftOutlined />
        </a-button>
        <span class="detail-title">{{ $t('user.detail') }}</span>
      </div>
      <a-space>
        <a-button @click="handleAdjustPoints">
          <DollarOutlined />
          {{ $t('user.adjustPoints') }}
        </a-button>
        <a-button type="primary" @click="showGrantModal">
          {{ $t('user.grantCapability') }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <!-- 基本信息 -->
        <a-col :span="24" :lg="14">
          <a-card :title="$t('user.basicInfo')" :variant="'borderless'">
            <template #extra>
              <a-tag :color="statusColorMap[userInfo?.status ?? -1]">
                {{ statusMap[userInfo?.status ?? -1] || '-' }}
              </a-tag>
            </template>

            <div class="user-header">
              <a-avatar v-if="userInfo?.avatar && !avatarFailed" :size="72" :src="userInfo?.avatar" @error="avatarFailed = true">
                {{ userInfo?.nickname?.charAt(0) }}
              </a-avatar>
              <a-avatar v-else :size="72">
                {{ userInfo?.nickname?.charAt(0) }}
              </a-avatar>
              <div class="user-header-text">
                <span class="user-nickname">{{ userInfo?.nickname || '-' }}</span>
                <span class="user-username">@{{ userInfo?.username || '-' }}</span>
              </div>
            </div>

            <a-divider />

            <a-descriptions :column="{ xs: 1, sm: 2 }" size="middle" bordered>
              <a-descriptions-item :label="$t('user.id')">
                {{ userInfo?.id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('user.email')">
                {{ userInfo?.email || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('user.phone')">
                {{ userInfo?.phone || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('user.unionBound')">
                <a-tag :color="userInfo?.unionBound === 1 ? 'green' : 'default'">
                  {{ userInfo?.unionBound === 1 ? $t('user.bound') : $t('user.unbound') }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item v-if="userInfo?.unionUserId" :label="$t('user.unionUserId')">
                <a-typography-text copyable>{{ userInfo?.unionUserId }}</a-typography-text>
              </a-descriptions-item>
              <a-descriptions-item v-if="!userInfo?.unionUserId" :label="$t('user.unionUserId')">
                -
              </a-descriptions-item>
              <a-descriptions-item :label="$t('common.createTime')">
                {{ userInfo?.createTime || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('common.updateTime')">
                {{ userInfo?.updateTime || '-' }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>

        <!-- 右侧信息 -->
        <a-col :span="24" :lg="10">
          <!-- 点数信息 -->
          <a-card :title="$t('user.pointsBalance')" :variant="'borderless'" class="points-card">
            <div class="points-display">
              <span class="points-number">{{ userInfo?.balance ?? 0 }}</span>
              <span class="points-unit">{{ $t('user.pointsUnit') }}</span>
            </div>
            <template #extra>
              <a-button type="link" size="small" @click="handleAdjustPoints">
                {{ $t('user.adjustPoints') }}
              </a-button>
            </template>
          </a-card>

          <!-- 创作能力 -->
          <a-card
            :title="$t('user.capabilities')"
            :variant="'borderless'"
            class="capabilities-card"
            style="margin-top: 16px"
          >
            <template #extra>
              <a-button type="link" size="small" @click="showGrantModal">
                {{ $t('user.grantCapability') }}
              </a-button>
            </template>
            <template v-if="capabilities && capabilities.length > 0">
              <div
                v-for="item in capabilities"
                :key="item.id"
                class="capability-item"
              >
                <div class="capability-header">
                  <span class="capability-name">{{ getCapabilityName(item.featureCode) }}</span>
                  <a-tag :color="capabilityStatusColor(item.status)">
                    {{ capabilityStatusText(item.status) }}
                  </a-tag>
                </div>
                <div class="capability-meta">
                  <span class="capability-code">{{ item.featureCode }}</span>
                  <span class="capability-time">
                    {{ $t('user.grantTime') }}: {{ item.grantTime || '-' }}
                  </span>
                </div>
                <div v-if="item.expireTime" class="capability-expire">
                  {{ $t('user.expireTime') }}: {{ item.expireTime }}
                </div>
              </div>
            </template>
            <template v-else-if="!capabilitiesLoading">
              <a-empty :description="$t('user.noCapabilities')" />
            </template>
            <template v-else>
              <div class="capabilities-skeleton">
                <a-skeleton active />
              </div>
            </template>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <!-- 调整点数弹窗 -->
    <a-modal
      v-model:open="adjustModalVisible"
      :title="$t('user.adjustPoints')"
      @ok="handleConfirmAdjust"
      :confirm-loading="adjustLoading"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('user.username')">
          <a-input :value="userInfo?.username" disabled />
        </a-form-item>
        <a-form-item :label="$t('user.adjustType')">
          <a-radio-group v-model:value="adjustForm.adjustType">
            <a-radio value="ADD">{{ $t('user.adjustAdd') }}</a-radio>
            <a-radio value="DEDUCT">{{ $t('user.adjustDeduct') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="$t('user.adjustAmount')">
          <a-input-number
            v-model:value="adjustForm.amount"
            :min="1"
            :precision="0"
            style="width: 100%"
            :placeholder="$t('user.adjustAmountPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('user.adjustReason')">
          <a-textarea
            v-model:value="adjustForm.reason"
            :rows="3"
            :placeholder="$t('user.adjustReasonPlaceholder')"
          />
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
          <a-input :value="userInfo?.username" disabled />
        </a-form-item>
        <a-form-item :label="$t('user.id')">
          <a-input :value="String(userInfo?.id ?? '')" disabled />
        </a-form-item>
        <a-form-item :label="$t('featureGrant.featureCode')" required>
          <a-select
            v-model:value="grantForm.featureCode"
            :options="featureSelectOptions"
            :placeholder="$t('featureGrant.selectFeature')"
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'
import { DollarOutlined, ArrowLeftOutlined } from '@antdv-next/icons'
import dayjs from 'dayjs'
import { getUserDetail, getUserCapabilities } from '@/api/user'
import { adjustPoints } from '@/api/points'
import { manualAddFeature, getFeatureOptions } from '@/api/feature'
import { getLocale } from '@/locales'
import { uuid } from '@/utils/helpers'
import type { User, UserFeature, Feature } from '@/types/api'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const currentLocale = computed(() => getLocale())

const loading = ref(false)
const capabilitiesLoading = ref(false)
const userInfo = ref<User | null>(null)
const capabilities = ref<UserFeature[]>([])
const avatarFailed = ref(false)

// 调整点数相关
const adjustModalVisible = ref(false)
const adjustLoading = ref(false)
const adjustForm = ref({
  userId: 0,
  amount: 0 as number,
  reason: '',
  adjustType: 'ADD' as string,
})

// 授权创作能力相关
const grantModalVisible = ref(false)
const grantLoading = ref(false)
const grantForm = ref({
  featureCode: undefined as string | undefined,
  expireTime: undefined as dayjs.Dayjs | undefined,
})
const featureOptions = ref<Feature[]>([])

// 状态映射
const statusMap: Record<number, string> = {
  1: t('common.enabled'),
  0: t('common.disabled'),
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

// 获取用户详情
async function fetchUserDetail() {
  const id = Number(route.params.id)
  if (!id) {
    message.error('用户ID无效')
    return
  }
  loading.value = true
  try {
    userInfo.value = await getUserDetail(id)
    avatarFailed.value = false
    // 同时获取能力列表
    fetchCapabilities(id)
  } catch (e) {
    console.error('[UserDetail] 获取用户详情失败:', e)
  } finally {
    loading.value = false
  }
}

// 获取用户创作能力
async function fetchCapabilities(userId: number) {
  capabilitiesLoading.value = true
  try {
    capabilities.value = (await getUserCapabilities(userId)) as UserFeature[]
  } catch (e) {
    console.error('[UserDetail] 获取用户能力失败:', e)
    capabilities.value = []
  } finally {
    capabilitiesLoading.value = false
  }
}

// 从 featureName 多语言记录中获取当前语言名称
function getFeatureName(featureName: Record<string, string>): string {
  const { locale } = useI18n()
  return featureName[locale.value] || featureName['zh-CN'] || featureName['en-US'] || Object.values(featureName)[0] || '-'
}

// 下拉选项：转成 antdv-next a-select 的 {label,value} 数组形式
// （slot 形式 a-select-option 在本组件库+modal 下不渲染，与 model-mapping 页保持一致用 :options）
const featureSelectOptions = computed(() =>
  featureOptions.value.map((f) => ({
    label: f.featureName?.[currentLocale.value] || f.featureName?.['zh-CN'] || f.featureCode,
    value: f.featureCode,
  })),
)

// 能力列表项只返回 featureCode，这里从能力选项（含多语言名称）解析展示名
function getCapabilityName(featureCode: string): string {
  const matched = featureOptions.value.find((f) => f.featureCode === featureCode)
  return matched?.featureName ? getFeatureName(matched.featureName) : featureCode
}

// 能力状态（后端返回字符串：ACTIVE / EXPIRED / REVOKED）
function capabilityStatusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'blue',
    EXPIRED: 'orange',
    REVOKED: 'red',
  }
  return map[status] || 'default'
}

function capabilityStatusText(status: string): string {
  const key = `user.capabilityStatus.${status}`
  const text = t(key)
  return text === key ? status : text
}

// 返回列表
function handleBack() {
  router.push({ name: 'UserList' })
}

// 调整点数
function handleAdjustPoints() {
  if (!userInfo.value) return
  adjustForm.value = {
    userId: userInfo.value.id,
    amount: 0,
    reason: '',
    adjustType: 'ADD',
  }
  adjustModalVisible.value = true
}

async function handleConfirmAdjust() {
  const reason = adjustForm.value.reason.trim()
  if (!reason) {
    message.warning(t('user.adjustReasonRequired'))
    return
  }
  if (/^\d+$/.test(reason) || reason.length < 2) {
    message.warning('调整原因不能为纯数字且至少2个字符')
    return
  }
  if (adjustForm.value.amount <= 0) {
    message.warning(t('user.adjustAmountInvalid'))
    return
  }
  adjustLoading.value = true
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
    // 刷新用户信息
    fetchUserDetail()
  } catch {
    // 错误已在 request 拦截器中处理
  } finally {
    adjustLoading.value = false
  }
}

// 显示授权创作能力弹窗
async function loadFeatureOptions() {
  try {
    const res = await getFeatureOptions()
    featureOptions.value = res || []
  } catch (e) {
    console.error('[UserDetail] 获取能力选项失败:', e)
  }
}

function showGrantModal() {
  grantForm.value = {
    featureCode: undefined,
    expireTime: undefined,
  }
  grantModalVisible.value = true
  // 打开弹窗时强制拉取能力选项，避免依赖挂载时机（onMounted 时若 token/接口未就绪会拿不到数据）
  loadFeatureOptions()
}

// 确认授权创作能力
async function handleConfirmGrant() {
  if (!grantForm.value.featureCode) {
    message.error(t('featureGrant.featureCodeRequired'))
    return
  }
  if (!userInfo.value?.id) {
    message.error(t('user.userNotFound'))
    return
  }
  grantLoading.value = true
  try {
    await manualAddFeature({
      userId: userInfo.value.id,
      featureCode: grantForm.value.featureCode,
      expireTime: grantForm.value.expireTime?.format('YYYY-MM-DD HH:mm:ss'),
    })
    message.success(t('featureGrant.manualAddSuccess'))
    grantModalVisible.value = false
    // 刷新能力列表
    fetchCapabilities(userInfo.value.id)
  } catch {
    // 错误已在 request 拦截器中处理
  } finally {
    grantLoading.value = false
  }
}

onMounted(() => {
  fetchUserDetail()
  loadFeatureOptions()
})
</script>

<style scoped lang="scss">
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .detail-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .detail-back-btn {
    padding: 0 4px;
    font-size: 16px;
  }

  .detail-title {
    font-size: 20px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.85);
  }
}

.user-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 4px;

  .user-header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .user-nickname {
      font-size: 20px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.85);
    }

    .user-username {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.45);
    }
  }
}

.points-display {
  text-align: center;
  padding: 16px 0;

  .points-number {
    font-size: 36px;
    font-weight: 700;
    color: var(--color-primary, #1677ff);
  }

  .points-unit {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.45);
    margin-left: 4px;
  }
}

.capability-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  .capability-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .capability-name {
      font-size: 14px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.85);
    }
  }

  .capability-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    margin-bottom: 4px;
  }

  .capability-expire {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
  }
}

.capabilities-skeleton {
  padding: 8px 0;
}
</style>
