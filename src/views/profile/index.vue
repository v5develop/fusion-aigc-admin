<template>
  <div class="page-container">
    <a-row :gutter="16">
      <a-col :xs="24" :md="8">
        <a-card :title="$t('profile.basicInfo')">
          <div class="profile-summary">
            <a-avatar :src="authStore.user?.avatar" :size="96">
              {{ authStore.user?.username?.charAt(0).toUpperCase() }}
            </a-avatar>
            <div class="profile-name">
              {{ authStore.user?.nickname || authStore.user?.username }}
            </div>
            <div class="profile-roles">
              <a-tag v-for="role in authStore.user?.roles" :key="role" color="blue">
                {{ role }}
              </a-tag>
            </div>
          </div>

          <a-descriptions :column="1" bordered size="small" class="profile-desc">
            <a-descriptions-item :label="$t('profile.userId')">
              {{ authStore.user?.id }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('profile.username')">
              {{ authStore.user?.username }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('profile.role')">
              {{ authStore.user?.roles?.join(', ') || '-' }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>

      <a-col :xs="24" :md="16">
        <a-card :title="$t('profile.security')">
          <a-form
            layout="vertical"
            :model="passwordForm"
            :rules="passwordRules"
            ref="passwordFormRef"
            class="max-w-2xl"
          >
            <a-form-item :label="$t('profile.oldPassword')" name="oldPassword">
              <a-input-password
                v-model:value="passwordForm.oldPassword"
                :placeholder="$t('profile.enterCurrentPassword')"
                autocomplete="current-password"
              />
            </a-form-item>

            <a-form-item :label="$t('profile.newPassword')" name="newPassword">
              <a-input-password
                v-model:value="passwordForm.newPassword"
                :placeholder="$t('profile.enterNewPassword')"
                autocomplete="new-password"
              />
            </a-form-item>

            <a-form-item :label="$t('profile.confirmPassword')" name="confirmPassword">
              <a-input-password
                v-model:value="passwordForm.confirmPassword"
                :placeholder="$t('profile.enterConfirmPassword')"
                autocomplete="new-password"
              />
            </a-form-item>

            <div class="form-hint">{{ $t('profile.passwordTip') }}</div>

            <a-form-item>
              <a-button type="primary" :loading="submitting" @click="handleChangePassword">
                {{ $t('profile.changePassword') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>

        <a-card :title="$t('twoFactor.profileTitle')" class="two-factor-card">
          <div class="form-hint">{{ $t('twoFactor.profileDesc') }}</div>
          <a-space>
            <template v-if="twoFactorStatus">
              <a-tag v-if="twoFactorStatus.bound" color="success">
                {{ $t('twoFactor.bound') }}
              </a-tag>
              <a-tag v-else>{{ $t('twoFactor.unbound') }}</a-tag>
              <a-button
                :type="twoFactorStatus.bound ? 'default' : 'primary'"
                @click="openTwoFactorModal"
              >
                {{ twoFactorStatus.bound ? $t('twoFactor.rebind') : $t('twoFactor.bind') }}
              </a-button>
            </template>
            <a-spin v-else-if="loadingTwoFactor" size="small" />
          </a-space>
        </a-card>

        <TwoFactorBindModal
          v-model:open="twoFactorModalOpen"
          :mode="twoFactorStatus?.bound ? 'rebind' : 'bind'"
          @success="loadTwoFactorStatus"
        />
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { onMounted, reactive, ref } from 'vue';

import { changePassword } from '@/api/auth';
import { getTwoFactorStatus, type TwoFactorStatus } from '@/api/two-factor';
import TwoFactorBindModal from '@/components/TwoFactor/TwoFactorBindModal.vue';
import { $t } from '@/locales';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const passwordFormRef = ref();
const submitting = ref(false);

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const validateConfirm = async (_rule: unknown, value: string) => {
  if (value && value !== passwordForm.newPassword) {
    return Promise.reject($t('profile.passwordMismatch'));
  }
  return Promise.resolve();
};

const passwordRules = {
  oldPassword: [{ required: true, message: $t('profile.enterCurrentPassword') }],
  newPassword: [
    { required: true, message: $t('profile.enterNewPassword') },
    { min: 6, message: $t('profile.passwordMinLength') },
  ],
  confirmPassword: [
    { required: true, message: $t('profile.enterConfirmPassword') },
    { validator: validateConfirm },
  ],
};

const handleChangePassword = async () => {
  try {
    await passwordFormRef.value.validate();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });
    message.success($t('profile.passwordChangeSuccess'));
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    passwordFormRef.value.resetFields();
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    message.error(msg || $t('profile.passwordChangeFailed'));
  } finally {
    submitting.value = false;
  }
};

// ===== 两步验证：查看绑定状态、换绑（换绑须先输入当前验证码）=====
const twoFactorStatus = ref<TwoFactorStatus | null>(null);
const loadingTwoFactor = ref(false);
const twoFactorModalOpen = ref(false);

async function loadTwoFactorStatus() {
  loadingTwoFactor.value = true;
  try {
    twoFactorStatus.value = await getTwoFactorStatus();
  } catch {
    twoFactorStatus.value = null;
  } finally {
    loadingTwoFactor.value = false;
  }
}

function openTwoFactorModal() {
  twoFactorModalOpen.value = true;
}

onMounted(loadTwoFactorStatus);
</script>

<style scoped lang="scss">
.profile-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-lg);

  .profile-name {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .profile-roles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }
}

.profile-desc {
  margin-top: var(--spacing-md);
}

/*
 * 有意的局部覆盖，不是漏删的重复：这一页的说明文字是段落说明（14px + 下间距），
 * 与全局 .form-hint 那种贴在字段下方的小字（12px + 上间距）不是同一个东西。
 * margin-top 显式归零，避免继承全局的 4px 让段落上下都带间距。
 */
.form-hint {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
}

.max-w-2xl {
  max-width: 42rem;
}

.two-factor-card {
  margin-top: 16px;
}
</style>
