<template>
  <div class="page-container">
    <a-card :title="$t('settingsStorage.title')">
      <a-form
        layout="vertical"
        :model="formData"
        :rules="rules"
        ref="formRef"
        class="max-w-2xl"
      >
        <a-form-item :label="$t('settingsStorage.type')" name="type">
          <a-select
            v-model:value="formData.type"
            :options="typeOptions"
            @change="handleTypeChange"
          />
        </a-form-item>

        <a-divider />

        <a-form-item :label="$t('settingsStorage.bucket')" name="bucket">
          <a-input
            v-model:value="formData.bucket"
            :placeholder="$t('settingsStorage.bucketPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.region')" name="region">
          <a-input
            v-model:value="formData.region"
            :placeholder="$t('settingsStorage.regionPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.accessKey')" name="accessKey">
          <a-input
            v-model:value="formData.accessKey"
            :placeholder="$t('settingsStorage.accessKeyPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.secretKey')" name="secretKey">
          <a-input-password
            v-model:value="formData.secretKey"
            :placeholder="$t('settingsStorage.secretKeyPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.endpoint')" name="endpoint">
          <a-input
            v-model:value="formData.endpoint"
            :placeholder="$t('settingsStorage.endpointPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.domain')" name="domain">
          <a-input
            v-model:value="formData.domain"
            :placeholder="$t('settingsStorage.domainPlaceholder')"
          />
          <div class="form-hint">{{ $t('settingsStorage.domainHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.maxFileSize')" name="maxFileSize">
          <a-input-number
            v-model:value="formData.maxFileSize"
            :min="1"
            :max="100"
            addon-after="MB"
            style="width: 200px"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsStorage.allowedTypes')" name="allowedTypes">
          <a-select
            v-model:value="formData.allowedTypes"
            mode="tags"
            :placeholder="$t('settingsStorage.allowedTypesPlaceholder')"
            style="width: 100%"
          >
            <a-select-option value="image/jpeg">JPEG</a-select-option>
            <a-select-option value="image/png">PNG</a-select-option>
            <a-select-option value="image/gif">GIF</a-select-option>
            <a-select-option value="image/webp">WebP</a-select-option>
            <a-select-option value="video/mp4">MP4</a-select-option>
            <a-select-option value="video/webm">WebM</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSubmit" :loading="submitting">
              {{ $t('common.save') }}
            </a-button>
            <a-button @click="handleTest">
              {{ $t('settingsStorage.testConnection') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { getStorageConfig, saveStorageConfig } from '@/api/config'

const { t } = useI18n()

const formRef = ref()
const submitting = ref(false)

const typeOptions = [
  { label: '本地存储', value: 'local' },
  { label: '阿里云 OSS', value: 'aliyun' },
  { label: '腾讯云 COS', value: 'tencent' },
  { label: '七牛云', value: 'qiniu' },
  { label: 'AWS S3', value: 'aws' },
  { label: 'MinIO', value: 'minio' },
]

const formData = reactive({
  type: 'local',
  bucket: '',
  region: '',
  accessKey: '',
  secretKey: '',
  endpoint: '',
  domain: '',
  maxFileSize: 50,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'] as string[],
})

const rules = {
  type: [{ required: true, message: t('settingsStorage.typeRequired'), trigger: 'change' }],
  bucket: [{ required: true, message: t('settingsStorage.bucketRequired'), trigger: 'blur' }],
  accessKey: [{ required: true, message: t('settingsStorage.accessKeyRequired'), trigger: 'blur' }],
  secretKey: [{ required: true, message: t('settingsStorage.secretKeyRequired'), trigger: 'blur' }],
  domain: [{ required: true, message: t('settingsStorage.domainRequired'), trigger: 'blur' }],
}

function handleTypeChange() {
  // Reset cloud-specific fields when switching to local
  if (formData.type === 'local') {
    formData.accessKey = ''
    formData.secretKey = ''
    formData.endpoint = ''
  }
}

async function loadConfig() {
  try {
    const res = await getStorageConfig()
    if (res) {
      Object.assign(formData, res)
    }
  } catch {
    // Use default values
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitting.value = true
    await saveStorageConfig(formData)
    message.success(t('settingsStorage.saveSuccess'))
  } catch {
    // Validation error or API error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleTest() {
  message.info(t('settingsStorage.testConnection'))
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.max-w-2xl {
  max-width: 720px;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
