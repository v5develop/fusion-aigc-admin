<template>
  <div class="page-container">
    <a-card :title="$t('settingsUnion.title')">
      <a-form
        layout="vertical"
        :model="formData"
        :rules="rules"
        ref="formRef"
        class="max-w-2xl"
      >
        <a-form-item :label="$t('settingsUnion.baseUrl')" name="baseUrl">
          <a-input
            v-model:value="formData.baseUrl"
            :placeholder="$t('settingsUnion.baseUrlPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.appId')" name="appId">
          <a-input
            v-model:value="formData.appId"
            :placeholder="$t('settingsUnion.appIdPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.appSecret')" name="appSecret">
          <a-input-password
            v-model:value="formData.appSecret"
            :placeholder="$t('settingsUnion.appSecretPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.tokenUrl')" name="tokenUrl">
          <a-input
            v-model:value="formData.tokenUrl"
            :placeholder="$t('settingsUnion.tokenUrlPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.grantUrl')" name="grantUrl">
          <a-input
            v-model:value="formData.grantUrl"
            :placeholder="$t('settingsUnion.grantUrlPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.revokeUrl')" name="revokeUrl">
          <a-input
            v-model:value="formData.revokeUrl"
            :placeholder="$t('settingsUnion.revokeUrlPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('settingsUnion.callbackUrl')" name="callbackUrl">
          <a-input
            v-model:value="formData.callbackUrl"
            :placeholder="$t('settingsUnion.callbackUrlPlaceholder')"
          />
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSubmit" :loading="submitting">
              {{ $t('common.save') }}
            </a-button>
            <a-button @click="handleTest" :loading="testing">
              {{ $t('settingsUnion.testConnection') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'
import { getUnionConfig, saveUnionConfig, testUnionConnection } from '@/api/config'

const { t } = useI18n()

const formRef = ref()
const submitting = ref(false)
const testing = ref(false)

const formData = reactive({
  baseUrl: '',
  appId: '',
  appSecret: '',
  tokenUrl: '',
  grantUrl: '',
  revokeUrl: '',
  callbackUrl: '',
})

const rules = {
  baseUrl: [{ required: true, message: t('settingsUnion.baseUrl') + t('common.required'), trigger: 'blur' }],
  appId: [{ required: true, message: t('settingsUnion.appId') + t('common.required'), trigger: 'blur' }],
  appSecret: [{ required: true, message: t('settingsUnion.appSecret') + t('common.required'), trigger: 'blur' }],
  tokenUrl: [{ required: true, message: t('settingsUnion.tokenUrl') + t('common.required'), trigger: 'blur' }],
  grantUrl: [{ required: true, message: t('settingsUnion.grantUrl') + t('common.required'), trigger: 'blur' }],
  revokeUrl: [{ required: true, message: t('settingsUnion.revokeUrl') + t('common.required'), trigger: 'blur' }],
  callbackUrl: [{ required: true, message: t('settingsUnion.callbackUrl') + t('common.required'), trigger: 'blur' }],
}

async function loadConfig() {
  try {
    const res = await getUnionConfig()
    Object.assign(formData, res)
  } catch {
    // Use default empty values
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitting.value = true
    await saveUnionConfig(formData)
    message.success(t('settingsUnion.saveSuccess'))
  } catch {
    // Validation error or API error handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleTest() {
  try {
    await formRef.value?.validateFields()
    testing.value = true
    await testUnionConnection(formData)
    message.success(t('settingsUnion.testConnectionSuccess'))
  } catch (error) {
    console.error('Test connection failed:', error)
    message.error(t('settingsUnion.testConnectionFailed'))
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.max-w-2xl {
  max-width: 720px;
}
</style>
