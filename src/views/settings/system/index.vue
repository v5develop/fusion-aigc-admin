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
          <!-- 切换即保存，与安全表单的「保存」分开：只写 admin.two_factor.enabled 这一个键 -->
          <a-form layout="vertical" class="max-w-2xl">
            <a-form-item :label="$t('settingsSystem.twoFactorEnabled')">
              <a-switch
                v-model:checked="twoFactorEnabled"
                :loading="savingTwoFactor"
                @change="handleToggleTwoFactor"
              />
              <div class="form-hint">{{ $t('settingsSystem.twoFactorEnabledDesc') }}</div>
            </a-form-item>
          </a-form>
          <a-form layout="vertical" :model="securityForm" ref="securityFormRef" class="max-w-2xl">
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

            <a-form-item
              v-if="securityForm.enableIpWhitelist"
              :label="$t('settingsSystem.ipWhitelist')"
              name="ipWhitelist"
            >
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
              <a-button
                type="primary"
                @click="handleSaveNotification"
                :loading="savingNotification"
              >
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
                <div class="form-hint" style="margin-bottom: 8px">
                  {{ profileHint(item.profile) }}
                </div>
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
                  {{
                    item.profile === 'VISION'
                      ? $t('settingsSystem.agentProfileVisionSelectHint')
                      : $t('settingsSystem.agentModelSelectHint')
                  }}
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

              <a-form-item :label="$t('settingsSystem.definitionRoutingDoubao')">
                <a-switch
                  v-model:checked="definitionRoutingDoubao"
                  :loading="savingDefinitionRoutingDoubao"
                  :disabled="!definitionRoutingDoubao"
                  @change="
                    (checked: boolean) => handleToggleDefinitionRouting('hitvideo-doubao', checked)
                  "
                />
                <div class="form-hint">{{ $t('settingsSystem.definitionRoutingDoubaoDesc') }}</div>
                <div class="form-hint">
                  {{ $t('settingsSystem.definitionRoutingDoubaoModeFlowHint') }}
                </div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.definitionRoutingLocal')">
                <a-switch
                  v-model:checked="definitionRoutingLocal"
                  :loading="savingDefinitionRoutingLocal"
                  @change="
                    (checked: boolean) => handleToggleDefinitionRouting('hitvideo-local', checked)
                  "
                />
                <div class="form-hint">{{ $t('settingsSystem.definitionRoutingLocalDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.videoEnhanceDefaultTier')">
                <a-select
                  v-model:value="videoEnhanceDefaultTier"
                  :options="videoEnhanceTierOptions"
                  :loading="savingVideoEnhanceDefaultTier"
                  style="width: 240px"
                  @change="(value: VideoEnhanceTier) => handleVideoEnhanceDefaultTierChange(value)"
                />
                <div class="form-hint">{{ $t('settingsSystem.videoEnhanceDefaultTierDesc') }}</div>
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

              <a-form-item :label="$t('settingsSystem.freeOriginalCleanup')">
                <a-switch
                  v-model:checked="freeOriginalCleanupEnabled"
                  :loading="savingFreeOriginalCleanup"
                  @change="handleToggleFreeOriginalCleanup"
                />
                <div class="form-hint">{{ $t('settingsSystem.freeOriginalCleanupDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.freeOriginalRetention')">
                <a-input-number
                  v-model:value="freeOriginalRetentionDays"
                  :min="90"
                  :precision="0"
                  :loading="savingFreeOriginalRetention"
                  style="width: 200px"
                  @change="handleFreeOriginalRetentionChange"
                />
                <div class="form-hint">{{ $t('settingsSystem.freeOriginalRetentionDesc') }}</div>
              </a-form-item>

              <!-- 用户输入图片保留：关掉永久保留或调低天数会删用户数据，两者都要先确认再保存 -->
              <a-form-item :label="$t('settingsSystem.userInputRetention')">
                <a-tag v-if="savedUserInputRetention.keepForever" color="green">
                  {{ $t('settingsSystem.userInputRetentionTagForever') }}
                </a-tag>
                <a-tag v-else color="orange">
                  {{
                    $t('settingsSystem.userInputRetentionTagDays', {
                      days: savedUserInputRetention.retentionDays,
                    })
                  }}
                </a-tag>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.userInputKeepForever')">
                <a-switch
                  :checked="userInputKeepForever"
                  :loading="savingUserInputRetention"
                  @change="handleToggleUserInputKeepForever"
                />
                <div class="form-hint">{{ $t('settingsSystem.userInputKeepForeverDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.userInputRetentionDays')">
                <div style="display: flex; gap: 8px; align-items: center">
                  <a-input-number
                    v-model:value="userInputRetentionDays"
                    :min="USER_INPUT_RETENTION_MIN_DAYS"
                    :max="USER_INPUT_RETENTION_MAX_DAYS"
                    :precision="0"
                    :disabled="userInputKeepForever"
                    style="width: 200px"
                  />
                  <a-button
                    type="primary"
                    :loading="savingUserInputRetention"
                    :disabled="userInputKeepForever || !userInputDaysDirty"
                    @click="handleSaveUserInputRetentionDays"
                  >
                    {{ $t('common.save') }}
                  </a-button>
                </div>
                <div class="form-hint">{{ $t('settingsSystem.userInputRetentionDaysDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.processingPlaceholders')">
                <div
                  style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    max-width: 640px;
                  "
                >
                  <a-input
                    v-model:value="processingImageUrl"
                    :placeholder="$t('settingsSystem.processingImagePlaceholder')"
                  />
                  <a-input
                    v-model:value="processingVideoUrl"
                    :placeholder="$t('settingsSystem.processingVideoPlaceholder')"
                  />
                  <a-button
                    type="primary"
                    :loading="savingProcessingPlaceholders"
                    style="align-self: flex-start"
                    @click="handleSaveProcessingPlaceholders"
                  >
                    {{ $t('common.save') }}
                  </a-button>
                </div>
                <div class="form-hint">{{ $t('settingsSystem.processingPlaceholdersDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.reconcileRetry')">
                <a-switch
                  v-model:checked="reconcileRetryEnabled"
                  :loading="savingReconcileRetry"
                  @change="handleToggleReconcileRetry"
                />
                <div class="form-hint">{{ $t('settingsSystem.reconcileRetryDesc') }}</div>
              </a-form-item>

              <a-form-item :label="$t('settingsSystem.mediaPurpose')">
                <a-switch
                  v-model:checked="mediaPurposeEnabled"
                  :loading="savingMediaPurpose"
                  @change="handleToggleMediaPurpose"
                />
                <div class="form-hint">{{ $t('settingsSystem.mediaPurposeDesc') }}</div>
                <a-alert
                  type="warning"
                  show-icon
                  :message="$t('settingsSystem.mediaPurposeWarning')"
                />
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
                <a-button type="primary" @click="handleSaveAiWriting" :loading="savingAiWriting">
                  {{ $t('common.save') }}
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>

        <a-tab-pane key="aiTts" :tab="$t('settingsSystem.aiTtsModel')">
          <div class="max-w-2xl">
            <a-alert
              type="info"
              show-icon
              :message="$t('settingsSystem.aiTtsModelHint')"
              class="agent-model-alert"
            />

            <a-form layout="vertical" class="agent-profile-block">
              <a-form-item :label="$t('settingsSystem.aiTtsModelLabel')">
                <a-select
                  v-model:value="aiTtsModelId"
                  :options="aiTtsModelOptions"
                  :loading="loadingModels"
                  :placeholder="$t('settingsSystem.agentModelPlaceholder')"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  style="max-width: 360px"
                />
                <div class="form-hint">{{ $t('settingsSystem.aiTtsModelSelectHint') }}</div>
              </a-form-item>

              <a-form-item v-if="aiTtsModelId && metaFor(aiTtsModelId)">
                <a-tag v-if="metaFor(aiTtsModelId)?.code" color="blue">
                  {{ metaFor(aiTtsModelId)?.code }}
                </a-tag>
              </a-form-item>

              <a-form-item>
                <a-button type="primary" @click="handleSaveAiTts" :loading="savingAiTts">
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
import type { AIModel, AgentModelProfile } from '@/types/api';

import { message, Modal } from 'antdv-next';
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getSystemConfig,
  saveSystemConfig,
  getAgentModelProfiles,
  bindAgentModelProfile,
  getAiWritingModel,
  saveAiWritingModel,
  getAiTtsModel,
  saveAiTtsModel,
  getVideoWatermarkEnabled,
  setVideoWatermarkEnabled,
  getBlindWatermarkEnabled,
  setBlindWatermarkEnabled,
  getDefinitionRoutingEnabled,
  getVideoEnhanceDefaultTier,
  setDefinitionRoutingEnabled,
  setVideoEnhanceDefaultTier,
  type VideoEnhanceTier,
  type DefinitionRoutingTarget,
  getDisplayWatermarkEnabled,
  setDisplayWatermarkEnabled,
  getPaidViewWatermarkEnabled,
  setPaidViewWatermarkEnabled,
  getFreeOriginalCleanupEnabled,
  setFreeOriginalCleanupEnabled,
  getFreeOriginalRetentionDays,
  setFreeOriginalRetentionDays,
  getUserInputRetention,
  setUserInputRetention,
  getProcessingPlaceholders,
  setProcessingPlaceholders,
  getReconcileRetryEnabled,
  setReconcileRetryEnabled,
  getMediaPurposeEnabled,
  setMediaPurposeEnabled,
  getUserTierEnabled,
  setUserTierEnabled,
} from '@/api/config';
import { getModelOptions } from '@/api/model';
import { getTwoFactorEnabled, setTwoFactorEnabled } from '@/api/two-factor';

import {
  USER_INPUT_RETENTION_MAX_DAYS,
  USER_INPUT_RETENTION_MIN_DAYS,
  isDestructiveRetentionChange,
  normalizeRetentionDays,
  type RetentionState,
} from './userInputRetention';

const { t } = useI18n();

const activeTab = ref('basic');

const basicFormRef = ref();

const savingBasic = ref(false);
const savingSecurity = ref(false);
const savingNotification = ref(false);

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const basicForm = reactive({
  siteName: 'Fusion AIGC',
  siteLogo: '',
  defaultLanguage: 'zh-CN',
  defaultPoints: 100,
  pointsExpireDays: 365,
});

const basicRules = {
  siteName: [{ required: true, message: t('settingsSystem.siteNameRequired'), trigger: 'blur' }],
};

const securityForm = reactive({
  tokenExpireHours: 24,
  maxLoginAttempts: 5,
  lockDuration: 30,
  enableCaptcha: false,
  enableIpWhitelist: false,
  ipWhitelist: '',
});

const notificationForm = reactive({
  lowPointsThreshold: 50,
  enableExpireNotify: true,
  expireNotifyDays: 7,
});

// ===== Agent 模型档位路由配置（提示词优化按是否带图自动路由 TEXT/VISION 档；与用户权限角色无关）=====
const loadingModels = ref(false);
const models = ref<AIModel[]>([]);
const savingProfile = ref<string | null>(null);

/**
 * 视频展示水印开关。读到的是「DB 优先、未配置回退 yaml」后的实际生效值，
 * 所以首次进来显示 false 时 DB 里未必有该行——一旦切换就会写入 DB 并从此以 DB 为准。
 */
const videoWatermarkEnabled = ref(false);
const savingVideoWatermark = ref(false);

/** 图片盲水印开关。同样是 DB 优先后的实际生效值。 */
const blindWatermarkEnabled = ref(false);
const savingBlindWatermark = ref(false);
const videoEnhanceDefaultTier = ref<VideoEnhanceTier>('standard');
const savingVideoEnhanceDefaultTier = ref(false);
const videoEnhanceTierOptions = [
  { value: 'fast', label: t('settingsSystem.videoEnhanceTierFast') },
  { value: 'standard', label: t('settingsSystem.videoEnhanceTierStandard') },
  { value: 'generative', label: t('settingsSystem.videoEnhanceTierGenerative') },
];
const definitionRoutingDoubao = ref(false);
const savingDefinitionRoutingDoubao = ref(false);
const definitionRoutingLocal = ref(false);
const savingDefinitionRoutingLocal = ref(false);
const displayWatermarkEnabled = ref(false);
const savingDisplayWatermark = ref(false);
const paidViewWatermarkEnabled = ref(false);
const savingPaidViewWatermark = ref(false);
const reconcileRetryEnabled = ref(false);
const freeOriginalCleanupEnabled = ref(false);
const savingFreeOriginalCleanup = ref(false);
/** 下限 90 天（业务要求），与后端 FREE_ORIGINAL_MIN_RETENTION_DAYS 一致。 */
const FREE_ORIGINAL_MIN_DAYS = 90;
const freeOriginalRetentionDays = ref<number>(FREE_ORIGINAL_MIN_DAYS);
const savingFreeOriginalRetention = ref(false);
/** 后端最后一次确认的生效值（标签按它显示）；表单值未保存前不影响它。默认与现状一致：永久保留。 */
const savedUserInputRetention = ref<RetentionState>({ keepForever: true, retentionDays: 365 });
const userInputKeepForever = ref(true);
const userInputRetentionDays = ref<number | null>(365);
const savingUserInputRetention = ref(false);
const userInputDaysDirty = computed(
  () => userInputRetentionDays.value !== savedUserInputRetention.value.retentionDays,
);
const processingImageUrl = ref('');
const processingVideoUrl = ref('');
const savingProcessingPlaceholders = ref(false);
const savingReconcileRetry = ref(false);
/** 成品直入素材库（网关 media_purpose）开关：DB 优先、未配置回退 yaml 后的实际生效值。 */
const mediaPurposeEnabled = ref(false);
const savingMediaPurpose = ref(false);
const userTierEnabled = ref(false);
const savingUserTier = ref(false);
// 后端返回 TEXT/VISION 两档；modelId 可被 v-model 就地编辑，保存时按档提交
const agentProfiles = ref<AgentModelProfile[]>([]);

// 前端「AI 帮写」专用优化模型（独立一档，与管线内部自动优化解耦）；null=未配置回退默认档位路由
const aiWritingModelId = ref<number | null>(null);
const savingAiWriting = ref(false);

// AI语音合成模型：供所有需要配音的业务共用；null=未配置
const AI_MODEL_TYPE_TTS = 4; // 对应后端 AiModelTypeEnum.TTS
const aiTtsModelId = ref<number | null>(null);
const savingAiTts = ref(false);

// 配音下拉只列已启用的 TTS 模型（后端保存时同样校验）
const aiTtsModelOptions = computed(() =>
  models.value
    .filter((m) => m.modelType === AI_MODEL_TYPE_TTS && m.status === 1)
    .map((m) => ({
      label: m.code ? `${m.name} (${m.code})` : m.name,
      value: m.id,
    })),
);

// 全部启用模型的下拉项（label 含 code）
const allModelOptions = computed(() =>
  models.value.map((m) => ({
    label: m.code ? `${m.name} (${m.code})` : m.name,
    value: m.id,
    supportVision: !!m.supportVision,
  })),
);

// VISION 档仅可选支持视觉的模型；TEXT 档不限
function modelOptionsFor(profile: string) {
  if (profile === 'VISION') {
    return allModelOptions.value.filter((o) => o.supportVision);
  }
  return allModelOptions.value;
}

function metaFor(modelId: number | null) {
  const model = models.value.find((m) => m.id === modelId);
  if (!model) return null;
  return { code: model.code, supportVision: model.supportVision };
}

function profileLabel(profile: string) {
  return profile === 'VISION'
    ? t('settingsSystem.agentProfileVision')
    : t('settingsSystem.agentProfileText');
}

function profileHint(profile: string) {
  return profile === 'VISION'
    ? t('settingsSystem.agentProfileVisionHint')
    : t('settingsSystem.agentProfileTextHint');
}

async function loadAgentModelConfig() {
  loadingModels.value = true;
  try {
    const [options, profiles, aiWriting, aiTts] = await Promise.all([
      getModelOptions(),
      getAgentModelProfiles(),
      getAiWritingModel(),
      getAiTtsModel(),
    ]);
    models.value = options ?? [];
    // 保证 TEXT 在前、VISION 在后的稳定顺序
    const order = ['TEXT', 'VISION'];
    agentProfiles.value = (profiles ?? [])
      .slice()
      .sort((a, b) => order.indexOf(a.profile) - order.indexOf(b.profile));
    aiWritingModelId.value = aiWriting?.modelId ?? null;
    aiTtsModelId.value = aiTts?.modelId ?? null;
  } catch {
    // Error handled by interceptor
  } finally {
    loadingModels.value = false;
  }
}

async function handleSaveProfile(item: AgentModelProfile) {
  savingProfile.value = item.profile;
  try {
    await bindAgentModelProfile(item.profile, item.modelId ?? null);
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Error handled by interceptor
  } finally {
    savingProfile.value = null;
  }
}

async function handleSaveAiTts() {
  savingAiTts.value = true;
  try {
    await saveAiTtsModel(aiTtsModelId.value ?? null);
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Error handled by interceptor
  } finally {
    savingAiTts.value = false;
  }
}

async function handleSaveAiWriting() {
  savingAiWriting.value = true;
  try {
    await saveAiWritingModel(aiWritingModelId.value ?? null);
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Error handled by interceptor
  } finally {
    savingAiWriting.value = false;
  }
}

async function loadConfig() {
  try {
    const res = (await getSystemConfig()) as Record<string, Record<string, unknown>>;
    if (res) {
      if (res.basic) Object.assign(basicForm, res.basic);
      if (res.security) Object.assign(securityForm, res.security);
      if (res.notification) Object.assign(notificationForm, res.notification);
    }
  } catch {
    // Use default values
  }
}

async function handleSaveBasic() {
  try {
    await basicFormRef.value?.validateFields();
    savingBasic.value = true;
    await saveSystemConfig({ section: 'basic', ...basicForm });
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Validation error or API error handled by interceptor
  } finally {
    savingBasic.value = false;
  }
}

async function handleSaveSecurity() {
  savingSecurity.value = true;
  try {
    await saveSystemConfig({ section: 'security', ...securityForm });
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Error handled by interceptor
  } finally {
    savingSecurity.value = false;
  }
}

async function handleSaveNotification() {
  savingNotification.value = true;
  try {
    await saveSystemConfig({ section: 'notification', ...notificationForm });
    message.success(t('settingsSystem.saveSuccess'));
  } catch {
    // Error handled by interceptor
  } finally {
    savingNotification.value = false;
  }
}

/** 读水印开关。失败不弹错：它只是设置页的一个开关，拉不到时保持关闭态即可，不该打断整页。 */
async function loadVideoWatermark() {
  try {
    videoWatermarkEnabled.value = await getVideoWatermarkEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleVideoWatermark(checked: boolean) {
  savingVideoWatermark.value = true;
  try {
    await setVideoWatermarkEnabled(checked);
    message.success(
      checked ? t('settingsSystem.videoWatermarkOn') : t('settingsSystem.videoWatermarkOff'),
    );
  } catch {
    // 保存失败必须把开关拨回去，否则界面显示已开、实际没开，下次进来又变回来
    videoWatermarkEnabled.value = !checked;
  } finally {
    savingVideoWatermark.value = false;
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
    displayWatermarkEnabled.value = await getDisplayWatermarkEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleDisplayWatermark(checked: boolean) {
  savingDisplayWatermark.value = true;
  try {
    await setDisplayWatermarkEnabled(checked);
    message.success(
      checked ? t('settingsSystem.displayWatermarkOn') : t('settingsSystem.displayWatermarkOff'),
    );
  } catch {
    displayWatermarkEnabled.value = !checked;
  } finally {
    savingDisplayWatermark.value = false;
  }
}

async function loadPaidViewWatermark() {
  try {
    paidViewWatermarkEnabled.value = await getPaidViewWatermarkEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleTogglePaidViewWatermark(checked: boolean) {
  savingPaidViewWatermark.value = true;
  try {
    await setPaidViewWatermarkEnabled(checked);
    message.success(
      checked ? t('settingsSystem.paidViewWatermarkOn') : t('settingsSystem.paidViewWatermarkOff'),
    );
  } catch {
    paidViewWatermarkEnabled.value = !checked;
  } finally {
    savingPaidViewWatermark.value = false;
  }
}

async function loadFreeOriginal() {
  try {
    freeOriginalCleanupEnabled.value = await getFreeOriginalCleanupEnabled();
    freeOriginalRetentionDays.value = await getFreeOriginalRetentionDays();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

function applyUserInputRetention(value: RetentionState) {
  savedUserInputRetention.value = { ...value };
  userInputKeepForever.value = value.keepForever;
  userInputRetentionDays.value = value.retentionDays;
}

async function loadUserInputRetention() {
  try {
    const value = await getUserInputRetention();
    applyUserInputRetention({
      keepForever: value.keepForever !== false,
      retentionDays: normalizeRetentionDays(value.retentionDays) ?? 365,
    });
  } catch {
    /* 错误已由拦截器提示 */
  }
}

/** 先确认（若是删除性变更）再保存；取消或失败都回到后端生效值。 */
function commitUserInputRetention(next: RetentionState) {
  const prev = savedUserInputRetention.value;
  const save = async () => {
    savingUserInputRetention.value = true;
    try {
      await setUserInputRetention(next);
      applyUserInputRetention(next);
      message.success(
        next.keepForever
          ? t('settingsSystem.userInputRetentionSavedForever')
          : t('settingsSystem.userInputRetentionSavedDays', { days: next.retentionDays }),
      );
    } catch {
      /* 越界或网络错误：消息已由拦截器提示，回到后端真实值 */
      await loadUserInputRetention();
    } finally {
      savingUserInputRetention.value = false;
    }
  };
  if (!isDestructiveRetentionChange(prev, next)) {
    void save();
    return;
  }
  Modal.confirm({
    title: t('settingsSystem.userInputRetentionConfirmTitle'),
    content: t('settingsSystem.userInputRetentionConfirm', { days: next.retentionDays }),
    okText: t('common.ok'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: save,
    onCancel: () => applyUserInputRetention(prev),
  });
}

function handleToggleUserInputKeepForever(checked: boolean | string | number) {
  const keepForever = checked === true;
  userInputKeepForever.value = keepForever;
  // 天数字段可能被改过但未保存：关永久保留时用当前合法输入，否则沿用已生效值
  const retentionDays = keepForever
    ? savedUserInputRetention.value.retentionDays
    : (normalizeRetentionDays(userInputRetentionDays.value) ??
      savedUserInputRetention.value.retentionDays);
  userInputRetentionDays.value = retentionDays;
  commitUserInputRetention({ keepForever, retentionDays });
}

function handleSaveUserInputRetentionDays() {
  const days = normalizeRetentionDays(userInputRetentionDays.value);
  if (days === null) {
    message.error(
      t('settingsSystem.userInputRetentionDaysInvalid', {
        min: USER_INPUT_RETENTION_MIN_DAYS,
        max: USER_INPUT_RETENTION_MAX_DAYS,
      }),
    );
    return;
  }
  commitUserInputRetention({ keepForever: userInputKeepForever.value, retentionDays: days });
}

async function loadProcessingPlaceholders() {
  try {
    const value = await getProcessingPlaceholders();
    processingImageUrl.value = value.imageUrl ?? '';
    processingVideoUrl.value = value.videoUrl ?? '';
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleSaveProcessingPlaceholders() {
  savingProcessingPlaceholders.value = true;
  try {
    await setProcessingPlaceholders({
      imageUrl: processingImageUrl.value.trim(),
      videoUrl: processingVideoUrl.value.trim(),
    });
    message.success(t('settingsSystem.processingPlaceholdersSaved'));
  } catch {
    /* 地址格式错误或网络错误：重新读取后端的真实值 */
    await loadProcessingPlaceholders();
  } finally {
    savingProcessingPlaceholders.value = false;
  }
}

async function handleToggleFreeOriginalCleanup(checked: boolean) {
  savingFreeOriginalCleanup.value = true;
  try {
    await setFreeOriginalCleanupEnabled(checked);
    message.success(
      checked
        ? t('settingsSystem.freeOriginalCleanupOn')
        : t('settingsSystem.freeOriginalCleanupOff'),
    );
  } catch {
    freeOriginalCleanupEnabled.value = !checked;
  } finally {
    savingFreeOriginalCleanup.value = false;
  }
}

async function handleFreeOriginalRetentionChange(value: number | string | null) {
  const days = Math.max(FREE_ORIGINAL_MIN_DAYS, Math.floor(Number(value) || 0));
  freeOriginalRetentionDays.value = days;
  savingFreeOriginalRetention.value = true;
  try {
    await setFreeOriginalRetentionDays(days);
    message.success(t('settingsSystem.freeOriginalRetentionSaved', { days }));
  } catch {
    /* 低于下限或网络错误：重新读取后端的真实值 */
    await loadFreeOriginal();
  } finally {
    savingFreeOriginalRetention.value = false;
  }
}

async function loadReconcileRetry() {
  try {
    reconcileRetryEnabled.value = await getReconcileRetryEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleReconcileRetry(checked: boolean) {
  savingReconcileRetry.value = true;
  try {
    await setReconcileRetryEnabled(checked);
    message.success(
      checked ? t('settingsSystem.reconcileRetryOn') : t('settingsSystem.reconcileRetryOff'),
    );
  } catch {
    reconcileRetryEnabled.value = !checked;
  } finally {
    savingReconcileRetry.value = false;
  }
}

async function loadMediaPurpose() {
  try {
    mediaPurposeEnabled.value = await getMediaPurposeEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleMediaPurpose(checked: boolean) {
  savingMediaPurpose.value = true;
  try {
    await setMediaPurposeEnabled(checked);
    message.success(
      checked ? t('settingsSystem.mediaPurposeOn') : t('settingsSystem.mediaPurposeOff'),
    );
  } catch {
    mediaPurposeEnabled.value = !checked;
  } finally {
    savingMediaPurpose.value = false;
  }
}

async function loadUserTier() {
  try {
    userTierEnabled.value = await getUserTierEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleUserTier(checked: boolean) {
  savingUserTier.value = true;
  try {
    await setUserTierEnabled(checked);
    message.success(checked ? t('settingsSystem.userTierOn') : t('settingsSystem.userTierOff'));
  } catch {
    userTierEnabled.value = !checked;
  } finally {
    savingUserTier.value = false;
  }
}

async function loadBlindWatermark() {
  try {
    blindWatermarkEnabled.value = await getBlindWatermarkEnabled();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleBlindWatermark(checked: boolean) {
  savingBlindWatermark.value = true;
  try {
    await setBlindWatermarkEnabled(checked);
    message.success(
      checked ? t('settingsSystem.blindWatermarkOn') : t('settingsSystem.blindWatermarkOff'),
    );
  } catch {
    // 同视频水印：保存失败必须拨回去，否则界面显示已开、实际没开
    blindWatermarkEnabled.value = !checked;
  } finally {
    savingBlindWatermark.value = false;
  }
}

async function loadDefinitionRouting() {
  try {
    videoEnhanceDefaultTier.value = await getVideoEnhanceDefaultTier();
  } catch {
    /* 错误已由拦截器提示 */
  }
  try {
    definitionRoutingDoubao.value = await getDefinitionRoutingEnabled('hitvideo-doubao');
  } catch {
    /* 错误已由拦截器提示 */
  }
  try {
    definitionRoutingLocal.value = await getDefinitionRoutingEnabled('hitvideo-local');
  } catch {
    /* 错误已由拦截器提示 */
  }
}

/** 定义路由开关：保存失败拨回原值，避免界面显示已开、实际未开；提交时读取，只影响此后的新任务。 */
async function handleVideoEnhanceDefaultTierChange(tier: VideoEnhanceTier) {
  savingVideoEnhanceDefaultTier.value = true;
  try {
    videoEnhanceDefaultTier.value = await setVideoEnhanceDefaultTier(tier);
    message.success(t('settingsSystem.videoEnhanceDefaultTierSaved'));
  } catch {
    /* 错误已由拦截器提示；回读数据库里的真实值 */
    videoEnhanceDefaultTier.value = await getVideoEnhanceDefaultTier().catch(
      () => videoEnhanceDefaultTier.value,
    );
  } finally {
    savingVideoEnhanceDefaultTier.value = false;
  }
}

// ===== 管理员两步验证开关（admin.two_factor.enabled，默认关）=====
const twoFactorEnabled = ref(false);
const savingTwoFactor = ref(false);

async function loadTwoFactor() {
  try {
    twoFactorEnabled.value = (await getTwoFactorEnabled()) === true;
  } catch {
    /* 错误已由拦截器提示；拉不到保持关闭态 */
  }
}

async function handleToggleTwoFactor(checked: boolean) {
  savingTwoFactor.value = true;
  try {
    await setTwoFactorEnabled(checked);
    message.success(checked ? t('settingsSystem.twoFactorOn') : t('settingsSystem.twoFactorOff'));
  } catch {
    twoFactorEnabled.value = !checked;
  } finally {
    savingTwoFactor.value = false;
  }
}

async function handleToggleDefinitionRouting(target: DefinitionRoutingTarget, checked: boolean) {
  const saving =
    target === 'hitvideo-doubao' ? savingDefinitionRoutingDoubao : savingDefinitionRoutingLocal;
  const value = target === 'hitvideo-doubao' ? definitionRoutingDoubao : definitionRoutingLocal;
  saving.value = true;
  try {
    await setDefinitionRoutingEnabled(target, checked);
    message.success(
      checked ? t('settingsSystem.definitionRoutingOn') : t('settingsSystem.definitionRoutingOff'),
    );
  } catch {
    value.value = !checked;
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadConfig();
  loadDefinitionRouting();
  loadAgentModelConfig();
  loadVideoWatermark();
  loadBlindWatermark();
  loadDisplayWatermark();
  loadPaidViewWatermark();
  loadReconcileRetry();
  loadMediaPurpose();
  loadFreeOriginal();
  loadUserInputRetention();
  loadProcessingPlaceholders();
  loadUserTier();
  loadTwoFactor();
});
</script>

<style scoped>
.max-w-2xl {
  max-width: 720px;
}

.agent-model-alert {
  margin-bottom: 16px;
}
</style>
