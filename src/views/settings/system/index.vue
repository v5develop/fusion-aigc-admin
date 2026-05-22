<template>
  <div class="page-container">
    <a-card :title="$t('settingsSystem.title')">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="basic" :tab="$t('settingsSystem.basic')">
          <a-form
            layout="vertical"
            :model="basicForm"
            :rules="basicRules"
            ref="basicFormRef"
            class="max-w-2xl"
          >
            <a-form-item :label="$t('settingsSystem.siteName')" name="siteName">
              <a-input
                v-model:value="basicForm.siteName"
                :placeholder="$t('settingsSystem.siteNamePlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.siteLogo')" name="siteLogo">
              <a-input
                v-model:value="basicForm.siteLogo"
                :placeholder="$t('settingsSystem.siteLogoPlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.defaultLanguage')" name="defaultLanguage">
              <a-select v-model:value="basicForm.defaultLanguage" :options="languageOptions" />
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.defaultPoints')" name="defaultPoints">
              <a-input-number
                v-model:value="basicForm.defaultPoints"
                :min="0"
                :precision="0"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.defaultPointsHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.pointsExpireDays')" name="pointsExpireDays">
              <a-input-number
                v-model:value="basicForm.pointsExpireDays"
                :min="0"
                :precision="0"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.pointsExpireDaysHint') }}</div>
            </a-form-item>

            <a-form-item>
              <a-button type="primary" @click="handleSaveBasic" :loading="savingBasic">
                {{ $t('common.save') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="security" :tab="$t('settingsSystem.security')">
          <a-form
            layout="vertical"
            :model="securityForm"
            ref="securityFormRef"
            class="max-w-2xl"
          >
            <a-form-item :label="$t('settingsSystem.tokenExpireHours')" name="tokenExpireHours">
              <a-input-number
                v-model:value="securityForm.tokenExpireHours"
                :min="1"
                :max="720"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.tokenExpireHoursHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.maxLoginAttempts')" name="maxLoginAttempts">
              <a-input-number
                v-model:value="securityForm.maxLoginAttempts"
                :min="1"
                :max="10"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.maxLoginAttemptsHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.lockDuration')" name="lockDuration">
              <a-input-number
                v-model:value="securityForm.lockDuration"
                :min="5"
                :max="1440"
                addon-after="分钟"
                style="width: 200px"
              />
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.enableCaptcha')">
              <a-switch v-model:checked="securityForm.enableCaptcha" />
              <div class="form-hint">{{ $t('settingsSystem.enableCaptchaHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.enableIpWhitelist')">
              <a-switch v-model:checked="securityForm.enableIpWhitelist" />
            </a-form-item>

            <a-form-item v-if="securityForm.enableIpWhitelist" :label="$t('settingsSystem.ipWhitelist')" name="ipWhitelist">
              <a-textarea
                v-model:value="securityForm.ipWhitelist"
                :rows="4"
                :placeholder="$t('settingsSystem.ipWhitelistPlaceholder')"
              />
              <div class="form-hint">{{ $t('settingsSystem.ipWhitelistHint') }}</div>
            </a-form-item>

            <a-form-item>
              <a-button type="primary" @click="handleSaveSecurity" :loading="savingSecurity">
                {{ $t('common.save') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="notification" :tab="$t('settingsSystem.notification')">
          <a-form
            layout="vertical"
            :model="notificationForm"
            ref="notificationFormRef"
            class="max-w-2xl"
          >
            <a-form-item :label="$t('settingsSystem.lowPointsThreshold')" name="lowPointsThreshold">
              <a-input-number
                v-model:value="notificationForm.lowPointsThreshold"
                :min="0"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.lowPointsThresholdHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.enableExpireNotify')">
              <a-switch v-model:checked="notificationForm.enableExpireNotify" />
              <div class="form-hint">{{ $t('settingsSystem.enableExpireNotifyHint') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsSystem.expireNotifyDays')" name="expireNotifyDays">
              <a-input-number
                v-model:value="notificationForm.expireNotifyDays"
                :min="1"
                :max="30"
                style="width: 200px"
              />
              <div class="form-hint">{{ $t('settingsSystem.expireNotifyDaysHint') }}</div>
            </a-form-item>

            <a-form-item>
              <a-button type="primary" @click="handleSaveNotification" :loading="savingNotification">
                {{ $t('common.save') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { getSystemConfig, saveSystemConfig } from '@/api/config'

const { t } = useI18n()

const activeTab = ref('basic')

const basicFormRef = ref()

const savingBasic = ref(false)
const savingSecurity = ref(false)
const savingNotification = ref(false)

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

const basicForm = reactive({
  siteName: 'AI Fusion Video',
  siteLogo: '',
  defaultLanguage: 'zh-CN',
  defaultPoints: 100,
  pointsExpireDays: 365,
})

const basicRules = {
  siteName: [{ required: true, message: t('settingsSystem.siteNameRequired'), trigger: 'blur' }],
}

const securityForm = reactive({
  tokenExpireHours: 24,
  maxLoginAttempts: 5,
  lockDuration: 30,
  enableCaptcha: false,
  enableIpWhitelist: false,
  ipWhitelist: '',
})

const notificationForm = reactive({
  lowPointsThreshold: 50,
  enableExpireNotify: true,
  expireNotifyDays: 7,
})

async function loadConfig() {
  try {
    const res = await getSystemConfig() as Record<string, Record<string, unknown>>
    if (res) {
      if (res.basic) Object.assign(basicForm, res.basic)
      if (res.security) Object.assign(securityForm, res.security)
      if (res.notification) Object.assign(notificationForm, res.notification)
    }
  } catch {
    // Use default values
  }
}

async function handleSaveBasic() {
  try {
    await basicFormRef.value?.validateFields()
    savingBasic.value = true
    await saveSystemConfig({ section: 'basic', ...basicForm })
    message.success(t('settingsSystem.saveSuccess'))
  } catch {
    // Validation error or API error handled by interceptor
  } finally {
    savingBasic.value = false
  }
}

async function handleSaveSecurity() {
  savingSecurity.value = true
  try {
    await saveSystemConfig({ section: 'security', ...securityForm })
    message.success(t('settingsSystem.saveSuccess'))
  } catch {
    // Error handled by interceptor
  } finally {
    savingSecurity.value = false
  }
}

async function handleSaveNotification() {
  savingNotification.value = true
  try {
    await saveSystemConfig({ section: 'notification', ...notificationForm })
    message.success(t('settingsSystem.saveSuccess'))
  } catch {
    // Error handled by interceptor
  } finally {
    savingNotification.value = false
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

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
