<template>
  <div class="page-container">
    <a-card :title="$t('billing.pointsAdjust')">
      <a-alert
        v-if="showHighRiskWarning"
        type="warning"
        :message="$t('points.highRiskWarning')"
        :description="$t('points.approvalThreshold', { threshold: HIGH_RISK_THRESHOLD })"
        show-icon
        closable
        class="mb-4"
      />
      <a-form layout="vertical" :model="formData" :rules="rules" ref="formRef" class="max-w-lg">
        <a-form-item :label="$t('points.userId')" name="userId">
          <a-input-search
            v-model:value="formData.userId"
            :placeholder="$t('points.userIdPlaceholder')"
            @search="handleSearchUser"
          >
            <template #enterButton>
              <a-button>{{ $t('common.search') }}</a-button>
            </template>
          </a-input-search>
        </a-form-item>

        <a-form-item v-if="selectedUser" :label="$t('points.selectedUserInfo')">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="$t('points.username')">
              {{ selectedUser.username }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('points.nickname')">
              {{ selectedUser.nickname || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('points.pointsBalance')">
              <span class="text-blue-500 font-medium">{{ selectedUser.pointsBalance }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('points.isUnionBound')">
              <a-tag :color="selectedUser.unionBound === 1 ? 'green' : 'default'">
                {{ selectedUser.unionBound === 1 ? $t('common.yes') : $t('common.no') }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </a-form-item>

        <a-form-item :label="$t('points.adjustType')" name="adjustType">
          <a-radio-group v-model:value="formData.adjustType">
            <a-radio value="add">{{ $t('points.adjustTypeAdd') }}</a-radio>
            <a-radio value="deduct">{{ $t('points.adjustTypeDeduct') }}</a-radio>
            <a-radio value="set">{{ $t('points.adjustTypeSet') }}</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item :label="$t('points.adjustAmount')" name="adjustAmount">
          <a-input-number
            v-model:value="formData.adjustAmount"
            :min="0"
            :precision="0"
            :placeholder="$t('points.adjustAmountPlaceholder')"
            class="w-full"
          />
        </a-form-item>

        <!-- 只在「增加」时出现：扣减不是发放，标一个赠送来源没有意义，
             反而会让流水里出现「扣了一笔注册赠送」这种读不通的记录 -->
        <a-form-item
          v-if="formData.adjustType === 'add'"
          :label="$t('points.grantSource')"
          name="grantSource"
        >
          <a-select
            v-model:value="formData.grantSource"
            allow-clear
            :placeholder="$t('points.grantSourcePlaceholder')"
          >
            <a-select-option value="REGISTER_GIFT">{{
              $t('points.grantSourceRegister')
            }}</a-select-option>
            <a-select-option value="CAMPAIGN_GIFT">{{
              $t('points.grantSourceCampaign')
            }}</a-select-option>
            <a-select-option value="ADMIN_GIFT">{{
              $t('points.grantSourceAdmin')
            }}</a-select-option>
          </a-select>
          <div class="text-xs text-gray-500 mt-1">{{ $t('points.grantSourceDesc') }}</div>
        </a-form-item>

        <a-form-item :label="$t('points.adjustReason')" name="adjustReason">
          <a-textarea
            v-model:value="formData.adjustReason"
            :rows="3"
            :placeholder="$t('points.adjustReasonPlaceholder')"
          />
        </a-form-item>

        <a-form-item
          v-if="isHighRiskOperation"
          :label="$t('points.approvalTicketId')"
          name="approvalTicketId"
        >
          <a-input
            v-model:value="formData.approvalTicketId"
            :placeholder="$t('points.approvalTicketPlaceholder')"
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            @click="handleSubmit"
            :loading="submitting"
            :disabled="!selectedUser"
          >
            {{ $t('common.submit') }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 二次确认弹窗 -->
    <a-modal
      v-model:open="confirmModalVisible"
      :title="$t('points.highRiskConfirmTitle')"
      :ok-text="$t('points.confirmContinue')"
      :cancel-text="$t('points.cancelOperation')"
      ok-button-props="{ danger: true }"
      @ok="handleConfirmSubmit"
    >
      <div class="confirm-content">
        <a-alert
          type="warning"
          :message="$t('points.highRiskConfirmContent')"
          show-icon
          class="mb-4"
        />
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item :label="$t('points.operationType')">
            {{ adjustTypeLabel }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('points.targetUser')">
            {{ selectedUser?.username }} (ID: {{ selectedUser?.id }})
          </a-descriptions-item>
          <a-descriptions-item :label="$t('points.operationAmount')">
            <span
              :class="formData.adjustType === 'deduct' ? 'text-red-500' : 'text-green-500'"
              class="font-medium"
            >
              {{ formData.adjustType === 'add' ? '+' : formData.adjustType === 'deduct' ? '-' : ''
              }}{{ formData.adjustAmount }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('points.operationReason')">
            {{ formData.adjustReason }}
          </a-descriptions-item>
          <a-descriptions-item
            v-if="formData.approvalTicketId"
            :label="$t('points.approvalTicketId')"
          >
            {{ formData.approvalTicketId }}
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { adjustPoints } from '@/api/points';
import { getUserDetail } from '@/api/user';
import { uuid } from '@/utils/helpers';

const { t } = useI18n();

// 高风险操作阈值（可配置）
const HIGH_RISK_THRESHOLD = 10000;

const formRef = ref();
const submitting = ref(false);
const confirmModalVisible = ref(false);
const selectedUser = ref<{
  id: number;
  username: string;
  nickname: string;
  pointsBalance: number;
  unionBound: number;
} | null>(null);

const formData = reactive({
  userId: '',
  adjustType: 'add',
  grantSource: undefined as string | undefined,
  adjustAmount: undefined as number | undefined,
  adjustReason: '',
  approvalTicketId: '',
});

const isHighRiskOperation = computed(() => {
  return (formData.adjustAmount || 0) >= HIGH_RISK_THRESHOLD;
});

const showHighRiskWarning = computed(() => {
  return isHighRiskOperation.value;
});

const adjustTypeLabel = computed(() => {
  const map: Record<string, string> = {
    add: t('points.adjustTypeAdd'),
    deduct: t('points.adjustTypeDeduct'),
    set: t('points.adjustTypeSet'),
  };
  return map[formData.adjustType] || formData.adjustType;
});

const rules = {
  userId: [{ required: true, message: t('points.userId') + t('common.required'), trigger: 'blur' }],
  adjustType: [
    { required: true, message: t('points.adjustType') + t('common.required'), trigger: 'change' },
  ],
  adjustAmount: [
    { required: true, message: t('points.adjustAmount') + t('common.required'), trigger: 'blur' },
  ],
  adjustReason: [
    { required: true, message: t('points.adjustReason') + t('common.required'), trigger: 'blur' },
    { min: 2, message: t('points.adjustReason') + '至少2个字符', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => {
        if (/^\d+$/.test(value)) {
          return Promise.reject(new Error(t('points.adjustReason') + '不能为纯数字'));
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  approvalTicketId: [
    {
      required: true,
      message: t('points.approvalTicketId') + t('common.required'),
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (isHighRiskOperation.value && !value) {
          return Promise.reject(new Error(t('points.approvalTicketId') + t('common.required')));
        }
        return Promise.resolve();
      },
    },
  ],
};

async function handleSearchUser() {
  if (!formData.userId) {
    message.warning(t('points.userIdRequired'));
    return;
  }
  try {
    const res = await getUserDetail(Number(formData.userId));
    selectedUser.value = {
      id: res.id,
      username: res.username,
      nickname: res.nickname,
      pointsBalance: res.balance,
      unionBound: res.unionBound,
    };
  } catch {
    message.error(t('points.userNotFound'));
    selectedUser.value = null;
  }
}

function handleSubmit() {
  formRef.value
    ?.validateFields()
    .then(() => {
      // 显示二次确认弹窗
      confirmModalVisible.value = true;
    })
    .catch(() => {
      // Validation error
    });
}

async function handleConfirmSubmit() {
  try {
    submitting.value = true;
    await adjustPoints({
      userId: selectedUser.value!.id,
      adjustType: formData.adjustType,
      amount: formData.adjustAmount as number,
      reason: formData.adjustReason,
      // 只有「增加」才带来源：扣减不是发放。留空时后端沿用 ADMIN_ADJUST。
      grantSource: formData.adjustType === 'add' ? formData.grantSource || undefined : undefined,
      idempotencyKey: uuid(),
    });
    message.success(t('points.adjustSuccess'));
    confirmModalVisible.value = false;
    formData.adjustAmount = undefined;
    formData.adjustReason = '';
    formData.approvalTicketId = '';
    handleSearchUser();
  } catch {
    // API error handled by interceptor
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.max-w-lg {
  max-width: 600px;
}
.mb-4 {
  margin-bottom: 16px;
}
.confirm-content {
  padding: 8px 0;
}
</style>
