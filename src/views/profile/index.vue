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
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { reactive, ref } from 'vue';

import { changePassword } from '@/api/auth';
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

.form-hint {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.max-w-2xl {
  max-width: 42rem;
}
</style>
