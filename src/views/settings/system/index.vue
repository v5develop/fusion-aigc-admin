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

        <a-tab-pane key="agentModel" :tab="$t('settingsSystem.agentModel')">
          <div class="max-w-2xl">
            <a-alert
              type="info"
              show-icon
              :message="$t('settingsSystem.agentModelHint')"
              class="agent-model-alert"
            />

            <a-form
              v-for="item in agentProfiles"
              :key="item.profile"
              layout="vertical"
              class="agent-profile-block"
            >
              <a-form-item :label="profileLabel(item.profile)">
                <div class="form-hint" style="margin-bottom: 8px">{{ profileHint(item.profile) }}</div>
                <a-select
                  v-model:value="item.modelId"
                  :options="modelOptionsFor(item.profile)"
                  :loading="loadingModels"
                  :placeholder="$t('settingsSystem.agentModelPlaceholder')"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  style="max-width: 360px"
                />
                <div class="form-hint">
                  {{ item.profile === 'VISION' ? $t('settingsSystem.agentProfileVisionSelectHint') : $t('settingsSystem.agentModelSelectHint') }}
                </div>
              </a-form-item>

              <a-form-item v-if="item.modelId && metaFor(item.modelId)">
                <a-space>
                  <a-tag v-if="metaFor(item.modelId)?.code" color="blue">
                    {{ metaFor(item.modelId)?.code }}
                  </a-tag>
                  <a-tag v-if="metaFor(item.modelId)?.supportVision" color="green">
                    {{ $t('settingsSystem.agentModelSupportVision') }}
                  </a-tag>
                </a-space>
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  @click="handleSaveProfile(item)"
                  :loading="savingProfile === item.profile"
                >
                  {{ $t('common.save') }}
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>

        <a-tab-pane key="aiWriting" :tab="$t('settingsSystem.aiWritingModel')">
          <div class="max-w-2xl">
            <a-alert
              type="info"
              show-icon
              :message="$t('settingsSystem.aiWritingModelHint')"
              class="agent-model-alert"
            />

            <a-form layout="vertical" class="agent-profile-block">
              <a-form-item :label="$t('settingsSystem.aiWritingModelLabel')">
                <a-select
                  v-model:value="aiWritingModelId"
                  :options="allModelOptions"
                  :loading="loadingModels"
                  :placeholder="$t('settingsSystem.agentModelPlaceholder')"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  style="max-width: 360px"
                />
                <div class="form-hint">{{ $t('settingsSystem.aiWritingModelSelectHint') }}</div>
              </a-form-item>

              <a-form-item v-if="aiWritingModelId && metaFor(aiWritingModelId)">
                <a-space>
                  <a-tag v-if="metaFor(aiWritingModelId)?.code" color="blue">
                    {{ metaFor(aiWritingModelId)?.code }}
                  </a-tag>
                  <a-tag v-if="metaFor(aiWritingModelId)?.supportVision" color="green">
                    {{ $t('settingsSystem.agentModelSupportVision') }}
                  </a-tag>
                </a-space>
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  @click="handleSaveAiWriting"
                  :loading="savingAiWriting"
                >
                  {{ $t('common.save') }}
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { getSystemConfig, saveSystemConfig, getAgentModelProfiles, bindAgentModelProfile, getAiWritingModel, saveAiWritingModel } from '@/api/config'
import { getModelOptions } from '@/api/model'
import type { AIModel, AgentModelProfile } from '@/types/api'

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
  siteName: 'Fusion AIGC',
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

// ===== Agent 模型档位路由配置（提示词优化按是否带图自动路由 TEXT/VISION 档；与用户权限角色无关）=====
const loadingModels = ref(false)
const models = ref<AIModel[]>([])
const savingProfile = ref<string | null>(null)
// 后端返回 TEXT/VISION 两档；modelId 可被 v-model 就地编辑，保存时按档提交
const agentProfiles = ref<AgentModelProfile[]>([])

// 前端「AI 帮写」专用优化模型（独立一档，与管线内部自动优化解耦）；null=未配置回退默认档位路由
const aiWritingModelId = ref<number | null>(null)
const savingAiWriting = ref(false)

// 全部启用模型的下拉项（label 含 code）
const allModelOptions = computed(() =>
  models.value.map((m) => ({
    label: m.code ? `${m.name} (${m.code})` : m.name,
    value: m.id,
    supportVision: !!m.supportVision,
  }))
)

// VISION 档仅可选支持视觉的模型；TEXT 档不限
function modelOptionsFor(profile: string) {
  if (profile === 'VISION') {
    return allModelOptions.value.filter((o) => o.supportVision)
  }
  return allModelOptions.value
}

function metaFor(modelId: number | null) {
  const model = models.value.find((m) => m.id === modelId)
  if (!model) return null
  return { code: model.code, supportVision: model.supportVision }
}

function profileLabel(profile: string) {
  return profile === 'VISION'
    ? t('settingsSystem.agentProfileVision')
    : t('settingsSystem.agentProfileText')
}

function profileHint(profile: string) {
  return profile === 'VISION'
    ? t('settingsSystem.agentProfileVisionHint')
    : t('settingsSystem.agentProfileTextHint')
}

async function loadAgentModelConfig() {
  loadingModels.value = true
  try {
    const [options, profiles, aiWriting] = await Promise.all([
      getModelOptions(),
      getAgentModelProfiles(),
      getAiWritingModel(),
    ])
    models.value = options ?? []
    // 保证 TEXT 在前、VISION 在后的稳定顺序
    const order = ['TEXT', 'VISION']
    agentProfiles.value = (profiles ?? [])
      .slice()
      .sort((a, b) => order.indexOf(a.profile) - order.indexOf(b.profile))
    aiWritingModelId.value = aiWriting?.modelId ?? null
  } catch {
    // Error handled by interceptor
  } finally {
    loadingModels.value = false
  }
}

async function handleSaveProfile(item: AgentModelProfile) {
  savingProfile.value = item.profile
  try {
    await bindAgentModelProfile(item.profile, item.modelId ?? null)
    message.success(t('settingsSystem.saveSuccess'))
  } catch {
    // Error handled by interceptor
  } finally {
    savingProfile.value = null
  }
}

async function handleSaveAiWriting() {
  savingAiWriting.value = true
  try {
    await saveAiWritingModel(aiWritingModelId.value ?? null)
    message.success(t('settingsSystem.saveSuccess'))
  } catch {
    // Error handled by interceptor
  } finally {
    savingAiWriting.value = false
  }
}

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
  loadAgentModelConfig()
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

.agent-model-alert {
  margin-bottom: 16px;
}
</style>
