<template>
  <div class="page-container">
    <a-card variant="borderless">
      <a-alert
        class="storage-alert"
        type="info"
        show-icon
        :message="$t('settingsStorageSystem.tip')"
      />

      <a-form layout="vertical" :model="formData" class="max-w-3xl">
        <a-row :gutter="32">
          <a-col :span="12">
            <a-divider orientation="left">{{
              $t('settingsStorageSystem.privateBucketTitle')
            }}</a-divider>
            <a-form-item :label="$t('settingsStorageSystem.endpoint')">
              <a-input
                v-model:value="formData.privateEndpoint"
                :placeholder="$t('settingsStorageSystem.endpointPlaceholder')"
              />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.bucket')">
              <a-input v-model:value="formData.privateBucket" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.accessKey')">
              <a-input v-model:value="formData.privateAccessKey" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.secretKey')">
              <a-input-password v-model:value="formData.privateSecretKey" />
              <div class="form-tip">{{ $t('settingsStorageSystem.maskedSecretHint') }}</div>
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.region')">
              <a-input v-model:value="formData.privateRegion" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.customDomain')">
              <a-input v-model:value="formData.privateCustomDomain" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.stsRoleArn')">
              <a-input
                v-model:value="formData.privateStsRoleArn"
                :placeholder="$t('settingsStorageSystem.stsRoleArnPlaceholder')"
              />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.stsRegion')">
              <a-space style="width: 100%">
                <a-checkbox
                  v-model:checked="privateStsRegionSameAsRegion"
                  @change="handlePrivateStsRegionSameChange"
                >
                  {{ $t('settingsStorageSystem.stsRegionSameAsRegion') }}
                </a-checkbox>
              </a-space>
              <a-input
                v-if="!privateStsRegionSameAsRegion"
                v-model:value="formData.privateStsRegion"
                style="margin-top: 8px"
              />
              <div v-if="privateStsRegionSameAsRegion" class="form-tip">
                {{ $t('settingsStorageSystem.stsRegionHint') }}: {{ formData.privateRegion || '-' }}
              </div>
              <div v-else class="form-tip">{{ $t('settingsStorageSystem.stsRegionHint') }}</div>
            </a-form-item>
          </a-col>

          <a-col :span="12">
            <a-divider orientation="left">{{
              $t('settingsStorageSystem.publicBucketTitle')
            }}</a-divider>
            <a-form-item :label="$t('settingsStorageSystem.endpoint')">
              <a-input
                v-model:value="formData.publicEndpoint"
                :placeholder="$t('settingsStorageSystem.endpointPlaceholder')"
              />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.bucket')">
              <a-input v-model:value="formData.publicBucket" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.accessKey')">
              <a-input v-model:value="formData.publicAccessKey" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.secretKey')">
              <a-input-password v-model:value="formData.publicSecretKey" />
              <div class="form-tip">{{ $t('settingsStorageSystem.maskedSecretHint') }}</div>
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.region')">
              <a-input v-model:value="formData.publicRegion" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.customDomain')">
              <a-input v-model:value="formData.publicCustomDomain" />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.stsRoleArn')">
              <a-input
                v-model:value="formData.publicStsRoleArn"
                :placeholder="$t('settingsStorageSystem.stsRoleArnPlaceholder')"
              />
            </a-form-item>
            <a-form-item :label="$t('settingsStorageSystem.stsRegion')">
              <a-space style="width: 100%">
                <a-checkbox
                  v-model:checked="publicStsRegionSameAsRegion"
                  @change="handlePublicStsRegionSameChange"
                >
                  {{ $t('settingsStorageSystem.stsRegionSameAsRegion') }}
                </a-checkbox>
              </a-space>
              <a-input
                v-if="!publicStsRegionSameAsRegion"
                v-model:value="formData.publicStsRegion"
                style="margin-top: 8px"
              />
              <div v-if="publicStsRegionSameAsRegion" class="form-tip">
                {{ $t('settingsStorageSystem.stsRegionHint') }}: {{ formData.publicRegion || '-' }}
              </div>
              <div v-else class="form-tip">{{ $t('settingsStorageSystem.stsRegionHint') }}</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSubmit" :loading="submitting">
              {{ $t('settingsStorageSystem.save') }}
            </a-button>
            <a-button @click="handleTest" :loading="testing">
              {{ $t('settingsStorageSystem.testConnection') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { SystemStorageConfig } from '@/types/api';

import { message } from 'antdv-next';
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getSystemStorageConfig,
  saveSystemStorageConfig,
  testSystemStorageConnection,
} from '@/api/config';

const { t } = useI18n();

const submitting = ref(false);
const testing = ref(false);
const privateStsRegionSameAsRegion = ref(true);
const publicStsRegionSameAsRegion = ref(true);

const formData = reactive<SystemStorageConfig>({
  privateEndpoint: '',
  privateBucket: '',
  privateAccessKey: '',
  privateSecretKey: '',
  privateRegion: '',
  privateCustomDomain: '',
  privateStsRoleArn: '',
  privateStsRegion: '',
  publicEndpoint: '',
  publicBucket: '',
  publicAccessKey: '',
  publicSecretKey: '',
  publicRegion: '',
  publicCustomDomain: '',
  publicStsRoleArn: '',
  publicStsRegion: '',
});

function isMasked(value?: string) {
  return !!value && value.includes('****');
}

function handlePrivateStsRegionSameChange() {
  if (privateStsRegionSameAsRegion.value) {
    formData.privateStsRegion = formData.privateRegion;
  }
}

function handlePublicStsRegionSameChange() {
  if (publicStsRegionSameAsRegion.value) {
    formData.publicStsRegion = formData.publicRegion;
  }
}

// 脱敏字段未修改（仍含 ****）则不回传，避免把掩码写回后端
function buildPayload(): SystemStorageConfig {
  const payload: SystemStorageConfig = { ...formData };
  if (privateStsRegionSameAsRegion.value) {
    payload.privateStsRegion = formData.privateRegion;
  }
  if (publicStsRegionSameAsRegion.value) {
    payload.publicStsRegion = formData.publicRegion;
  }
  if (isMasked(payload.privateAccessKey)) delete payload.privateAccessKey;
  if (isMasked(payload.privateSecretKey)) delete payload.privateSecretKey;
  if (isMasked(payload.privateStsRoleArn)) delete payload.privateStsRoleArn;
  if (isMasked(payload.publicAccessKey)) delete payload.publicAccessKey;
  if (isMasked(payload.publicSecretKey)) delete payload.publicSecretKey;
  if (isMasked(payload.publicStsRoleArn)) delete payload.publicStsRoleArn;
  return payload;
}

async function loadConfig() {
  try {
    const res = await getSystemStorageConfig();
    if (res) {
      Object.assign(formData, res);
      privateStsRegionSameAsRegion.value =
        !res.privateStsRegion || res.privateStsRegion === res.privateRegion;
      publicStsRegionSameAsRegion.value =
        !res.publicStsRegion || res.publicStsRegion === res.publicRegion;
    }
  } catch {
    // 使用默认空值
  }
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await saveSystemStorageConfig(buildPayload());
    message.success(t('settingsStorageSystem.saveSuccess'));
    await loadConfig();
  } finally {
    submitting.value = false;
  }
}

async function handleTest() {
  testing.value = true;
  try {
    await testSystemStorageConnection(buildPayload());
    message.success(t('settingsStorageSystem.testSuccess'));
  } catch {
    message.error(t('settingsStorageSystem.testFailed'));
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
.max-w-3xl {
  max-width: 1080px;
}

.storage-alert {
  margin-bottom: 16px;
}

.form-tip {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}
</style>
