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

        <a-tab-pane key="creation" :tab="$t('settingsSystem.creation')">
          <div class="max-w-2xl">
            <a-alert
              type="info"
              show-icon
              :message="$t('settingsSystem.videoWatermarkHint')"
              class="agent-model-alert"
            />
            <a-form layout="vertical">
              <a-form-item :label="$t('settingsSystem.videoWatermark')">
                <!-- 切换即保存：单个布尔值没有「改几项再一起提交」的需求，
                     且水印涉及存储与算力成本，出问题要能一键立刻关掉。
                     也不能并进 basic 表单随整体 PUT——那样用户保存任意其它设置时，
                     都会把当前显示值写进 DB，等于把「DB 未配置、跟随 yaml」这个状态给消掉 -->
                <a-switch
                  v-model:checked="videoWatermarkEnabled"
                  :loading="savingVideoWatermark"
                  @change="handleToggleVideoWatermark"
                />
                <div class="form-hint">{{ $t('settingsSystem.videoWatermarkDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.blindWatermark')">
                <a-switch
                  v-model:checked="blindWatermarkEnabled"
                  :loading="savingBlindWatermark"
                  @change="handleToggleBlindWatermark"
                />
                <div class="form-hint">{{ $t('settingsSystem.blindWatermarkDesc') }}</div>
              </a-form-item>

              <a-divider />

              <!-- 可见水印总开关。与上面的盲水印是两回事：盲水印不可见、用于溯源，
                   嵌在交付给用户的那份产物里；这里是可见遮挡，只出现在预览地址上。
                   两者同时存在不冲突，关掉任何一个都不能替代另一个。 -->
              <a-form-item :label="$t('settingsSystem.displayWatermark')">
                <a-switch
                  v-model:checked="displayWatermarkEnabled"
                  :loading="savingDisplayWatermark"
                  @change="handleToggleDisplayWatermark"
                />
                <div class="form-hint">{{ $t('settingsSystem.displayWatermarkDesc') }}</div>
              </a-form-item>

              <!-- 只管付费档。免费用户查看/下载/进资产库恒带水印，不受它影响，
                   所以这里刻意不写成「查看水印」——那会让人以为关掉后免费用户也没水印了 -->
              <a-form-item :label="$t('settingsSystem.paidViewWatermark')">
                <a-switch
                  v-model:checked="paidViewWatermarkEnabled"
                  :loading="savingPaidViewWatermark"
                  :disabled="!displayWatermarkEnabled"
                  @change="handleTogglePaidViewWatermark"
                />
                <div class="form-hint">{{ $t('settingsSystem.paidViewWatermarkDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.userTier')">
                <a-switch
                  v-model:checked="userTierEnabled"
                  :loading="savingUserTier"
                  @change="handleToggleUserTier"
                />
                <div class="form-hint">{{ $t('settingsSystem.userTierDesc') }}</div>
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
import { getSystemConfig, saveSystemConfig, getAgentModelProfiles, bindAgentModelProfile, getAiWritingModel, saveAiWritingModel, getVideoWatermarkEnabled, setVideoWatermarkEnabled, getBlindWatermarkEnabled, setBlindWatermarkEnabled, getDisplayWatermarkEnabled, setDisplayWatermarkEnabled, getPaidViewWatermarkEnabled, setPaidViewWatermarkEnabled, getUserTierEnabled, setUserTierEnabled } from '@/api/config'
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

/**
 * 视频展示水印开关。读到的是「DB 优先、未配置回退 yaml」后的实际生效值，
 * 所以首次进来显示 false 时 DB 里未必有该行——一旦切换就会写入 DB 并从此以 DB 为准。
 */
const videoWatermarkEnabled = ref(false)
const savingVideoWatermark = ref(false)

/** 图片盲水印开关。同样是 DB 优先后的实际生效值。 */
const blindWatermarkEnabled = ref(false)
const savingBlindWatermark = ref(false)
const displayWatermarkEnabled = ref(false)
const savingDisplayWatermark = ref(false)
const paidViewWatermarkEnabled = ref(false)
const savingPaidViewWatermark = ref(false)
const userTierEnabled = ref(false)
const savingUserTier = ref(false)
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

/** 读水印开关。失败不弹错：它只是设置页的一个开关，拉不到时保持关闭态即可，不该打断整页。 */
async function loadVideoWatermark() {
  try {
    videoWatermarkEnabled.value = await getVideoWatermarkEnabled()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleVideoWatermark(checked: boolean) {
  savingVideoWatermark.value = true
  try {
    await setVideoWatermarkEnabled(checked)
    message.success(checked ? t('settingsSystem.videoWatermarkOn') : t('settingsSystem.videoWatermarkOff'))
  } catch {
    // 保存失败必须把开关拨回去，否则界面显示已开、实际没开，下次进来又变回来
    videoWatermarkEnabled.value = !checked
  } finally {
    savingVideoWatermark.value = false
  }
}

/**
 * 三个开关共用一套「切换即保存 + 失败拨回」的写法。
 *
 * 失败必须把开关拨回去：界面显示已开、实际没开，下次进来又变回来，
 * 而中间这段时间运营会以为策略已经生效。
 */
async function loadDisplayWatermark() {
  try {
    displayWatermarkEnabled.value = await getDisplayWatermarkEnabled()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleDisplayWatermark(checked: boolean) {
  savingDisplayWatermark.value = true
  try {
    await setDisplayWatermarkEnabled(checked)
    message.success(checked ? t('settingsSystem.displayWatermarkOn') : t('settingsSystem.displayWatermarkOff'))
  } catch {
    displayWatermarkEnabled.value = !checked
  } finally {
    savingDisplayWatermark.value = false
  }
}

async function loadPaidViewWatermark() {
  try {
    paidViewWatermarkEnabled.value = await getPaidViewWatermarkEnabled()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleTogglePaidViewWatermark(checked: boolean) {
  savingPaidViewWatermark.value = true
  try {
    await setPaidViewWatermarkEnabled(checked)
    message.success(checked ? t('settingsSystem.paidViewWatermarkOn') : t('settingsSystem.paidViewWatermarkOff'))
  } catch {
    paidViewWatermarkEnabled.value = !checked
  } finally {
    savingPaidViewWatermark.value = false
  }
}

async function loadUserTier() {
  try {
    userTierEnabled.value = await getUserTierEnabled()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleUserTier(checked: boolean) {
  savingUserTier.value = true
  try {
    await setUserTierEnabled(checked)
    message.success(checked ? t('settingsSystem.userTierOn') : t('settingsSystem.userTierOff'))
  } catch {
    userTierEnabled.value = !checked
  } finally {
    savingUserTier.value = false
  }
}

async function loadBlindWatermark() {
  try {
    blindWatermarkEnabled.value = await getBlindWatermarkEnabled()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleBlindWatermark(checked: boolean) {
  savingBlindWatermark.value = true
  try {
    await setBlindWatermarkEnabled(checked)
    message.success(checked ? t('settingsSystem.blindWatermarkOn') : t('settingsSystem.blindWatermarkOff'))
  } catch {
    // 同视频水印：保存失败必须拨回去，否则界面显示已开、实际没开
    blindWatermarkEnabled.value = !checked
  } finally {
    savingBlindWatermark.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadAgentModelConfig()
  loadVideoWatermark()
  loadBlindWatermark()
  loadDisplayWatermark()
  loadPaidViewWatermark()
  loadUserTier()
})
</script>

<style scoped>
.max-w-2xl {
  max-width: 720px;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.agent-model-alert {
  margin-bottom: 16px;
}
</style>
