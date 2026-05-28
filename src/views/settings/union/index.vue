<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="config" :tab="$t('settingsUnion.title')">
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

            <a-form-item :label="$t('settingsUnion.callbackUrl')" name="callbackUrl">
              <a-input
                v-model:value="formData.callbackUrl"
                :placeholder="$t('settingsUnion.callbackUrlPlaceholder')"
              />
            </a-form-item>

            <a-divider />

            <a-form-item :label="$t('settingsUnion.signatureEnabled')">
              <a-switch
                v-model:checked="formData.signatureEnabled"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
              />
              <div class="form-tip">{{ $t('settingsUnion.signatureEnabledTip') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsUnion.whitelistEnabled')">
              <a-switch
                v-model:checked="formData.whitelistEnabled"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
              />
              <div class="form-tip">{{ $t('settingsUnion.whitelistEnabledTip') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsUnion.whitelistIps')" name="whitelistIps" v-if="formData.whitelistEnabled">
              <a-textarea
                v-model:value="whitelistIpsText"
                :placeholder="$t('settingsUnion.whitelistIpsPlaceholder')"
                :rows="4"
              />
              <div class="form-tip">{{ $t('settingsUnion.whitelistIpsTip') }}</div>
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
        </a-tab-pane>

        <a-tab-pane key="openapi" :tab="$t('settingsUnion.openapi')">
          <div class="api-list">
            <div v-for="api in apiDocs" :key="api.method + api.path" class="api-item">
              <div class="api-header">
                <a-tag :color="api.methodColor" class="method-tag">{{ api.method }}</a-tag>
                <span class="api-path">{{ api.path }}</span>
                <a-button type="link" size="small" @click="copyText(api.path)">
                  <CopyOutlined />
                </a-button>
              </div>
              <div class="api-desc">{{ api.description }}</div>

              <div class="api-section">
                <div class="section-title">{{ $t('settingsUnion.requestParams') }}</div>
                <a-table
                  :columns="paramColumns"
                  :data-source="api.requestParams"
                  :pagination="false"
                  size="small"
                  row-key="name"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.dataIndex === 'required'">
                      <a-tag :color="record.required ? 'red' : 'default'" size="small">
                        {{ record.required ? $t('settingsUnion.paramRequired') : $t('settingsUnion.paramOptional') }}
                      </a-tag>
                    </template>
                    <template v-if="column.dataIndex === 'type'">
                      <a-tag size="small">{{ record.type }}</a-tag>
                    </template>
                  </template>
                </a-table>
              </div>

              <div class="api-section">
                <div class="section-title">{{ $t('settingsUnion.responseParams') }}</div>
                <a-table
                  :columns="paramColumns"
                  :data-source="api.responseParams"
                  :pagination="false"
                  size="small"
                  row-key="name"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.dataIndex === 'required'">
                      <a-tag :color="record.required ? 'red' : 'default'" size="small">
                        {{ record.required ? $t('settingsUnion.paramRequired') : $t('settingsUnion.paramOptional') }}
                      </a-tag>
                    </template>
                    <template v-if="column.dataIndex === 'type'">
                      <a-tag size="small">{{ record.type }}</a-tag>
                    </template>
                  </template>
                </a-table>
              </div>

              <div class="api-section" v-if="api.requestExample">
                <div class="section-title">{{ $t('settingsUnion.requestExample') }}</div>
                <pre class="code-block"><code>{{ api.requestExample }}</code></pre>
              </div>

              <div class="api-section" v-if="api.responseExample">
                <div class="section-title">{{ $t('settingsUnion.responseExample') }}</div>
                <pre class="code-block"><code>{{ api.responseExample }}</code></pre>
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { CopyOutlined } from '@antdv-next/icons'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'
import { getUnionConfig, saveUnionConfig, testUnionConnection } from '@/api/config'

const { t } = useI18n()

const activeTab = ref('config')
const formRef = ref()
const submitting = ref(false)
const testing = ref(false)

const formData = reactive({
  baseUrl: '',
  appId: '',
  appSecret: '',
  tokenUrl: '',
  callbackUrl: '',
  signatureEnabled: true,
  whitelistEnabled: false,
  whitelistIps: [] as string[],
})

const whitelistIpsText = computed({
  get: () => formData.whitelistIps.join('\n'),
  set: (val: string) => {
    formData.whitelistIps = val.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  },
})

function isValidIpOrCidr(value: string): boolean {
  const cidrMatch = value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (cidrMatch) {
    const ip = cidrMatch[1]
    const prefix = parseInt(cidrMatch[2], 10)
    if (prefix < 0 || prefix > 32) return false
    return isValidIp(ip)
  }
  return isValidIp(value)
}

function isValidIp(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts.every(part => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part
  })
}

function isSignatureRequired(): boolean {
  return formData.signatureEnabled !== false
}

const rules = {
  baseUrl: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.baseUrl) {
          callback(new Error(t('settingsUnion.baseUrl') + t('common.required')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  appId: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.appId) {
          callback(new Error(t('settingsUnion.appId') + t('common.required')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  appSecret: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.appSecret) {
          callback(new Error(t('settingsUnion.appSecret') + t('common.required')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  tokenUrl: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.tokenUrl) {
          callback(new Error(t('settingsUnion.tokenUrl') + t('common.required')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  callbackUrl: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.callbackUrl) {
          callback(new Error(t('settingsUnion.callbackUrl') + t('common.required')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  whitelistIps: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (formData.whitelistEnabled) {
          if (!formData.whitelistIps || formData.whitelistIps.length === 0) {
            callback(new Error(t('settingsUnion.whitelistIps') + t('common.required')))
            return
          }
          const invalidIp = formData.whitelistIps.find(ip => !isValidIpOrCidr(ip))
          if (invalidIp) {
            callback(new Error(`无效的 IP 格式: ${invalidIp}`))
            return
          }
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}

const paramColumns = computed(() => [
  { title: t('settingsUnion.paramName'), dataIndex: 'name', width: 160 },
  { title: t('settingsUnion.paramType'), dataIndex: 'type', width: 180 },
  { title: t('settingsUnion.paramRequired'), dataIndex: 'required', width: 80, align: 'center' as const },
  { title: t('settingsUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const apiDocs = computed(() => {
  return [
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/feature-grants',
      description: t('settingsUnion.grantDesc'),
      requestParams: [
        { name: 'grantId', type: 'String', required: true, description: t('settingsUnion.grantIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
        { name: 'featureCodes', type: 'List<String>', required: true, description: t('settingsUnion.featureCodesDesc') },
        { name: 'expireTime', type: 'LocalDateTime', required: false, description: t('settingsUnion.expireTimeDesc') },
      ],
      requestExample: JSON.stringify({
        grantId: 'GRANT-20260528-001',
        unionUserId: 'union_user_12345',
        featureCodes: ['video_gen', 'image_gen'],
        expireTime: '2026-12-31T23:59:59',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('settingsUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.statusDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          externalId: 'GRANT-20260528-001',
          userId: 10001,
          status: 'SUCCESS',
        },
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/point-recharges',
      description: t('settingsUnion.rechargeDesc'),
      requestParams: [
        { name: 'rechargeId', type: 'String', required: true, description: t('settingsUnion.rechargeIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
        { name: 'pointsAmount', type: 'Long', required: true, description: t('settingsUnion.pointsAmountDesc') },
        { name: 'expireTime', type: 'LocalDateTime', required: false, description: t('settingsUnion.expireTimeDesc') },
      ],
      requestExample: JSON.stringify({
        rechargeId: 'RECHARGE-20260528-001',
        unionUserId: 'union_user_12345',
        pointsAmount: 1000,
        expireTime: '2026-12-31T23:59:59',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('settingsUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.statusDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          externalId: 'RECHARGE-20260528-001',
          userId: 10001,
          status: 'SUCCESS',
        },
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/feature-revokes',
      description: t('settingsUnion.revokeDesc'),
      requestParams: [
        { name: 'revokeId', type: 'String', required: true, description: t('settingsUnion.revokeIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
        { name: 'featureCodes', type: 'List<String>', required: true, description: t('settingsUnion.featureCodesDesc') },
        { name: 'sourceGrantId', type: 'String', required: false, description: t('settingsUnion.sourceGrantIdDesc') },
      ],
      requestExample: JSON.stringify({
        revokeId: 'REVOKE-20260528-001',
        unionUserId: 'union_user_12345',
        featureCodes: ['video_gen'],
        sourceGrantId: 'GRANT-20260528-001',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('settingsUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.statusDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          externalId: 'REVOKE-20260528-001',
          userId: 10001,
          status: 'SUCCESS',
        },
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/point-refunds',
      description: t('settingsUnion.refundDesc'),
      requestParams: [
        { name: 'refundId', type: 'String', required: true, description: t('settingsUnion.refundIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
        { name: 'sourceBizType', type: 'String', required: true, description: t('settingsUnion.sourceBizTypeDesc') },
        { name: 'sourceBizId', type: 'String', required: true, description: t('settingsUnion.sourceBizIdDesc') },
        { name: 'amount', type: 'Long', required: true, description: t('settingsUnion.refundAmountDesc') },
      ],
      requestExample: JSON.stringify({
        refundId: 'REFUND-20260528-001',
        unionUserId: 'union_user_12345',
        sourceBizType: 'CONSUME',
        sourceBizId: 'ORDER-20260528-001',
        amount: 100,
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('settingsUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.statusDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          externalId: 'REFUND-20260528-001',
          userId: 10001,
          status: 'SUCCESS',
        },
      }, null, 2),
    },
    {
      method: 'GET',
      methodColor: 'blue',
      path: '/api/v1/union/features',
      description: t('settingsUnion.featuresDesc'),
      requestParams: [],
      requestExample: null,
      responseParams: [
        { name: 'code', type: 'String', required: false, description: '能力编码' },
        { name: 'name', type: 'Map<String, String>', required: false, description: t('settingsUnion.featureNameDesc') },
        { name: 'description', type: 'Map<String, String>', required: false, description: t('settingsUnion.featureDescDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.featureStatusDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: [
          {
            code: 'video_gen',
            name: { zh: '视频生成', en: 'Video Generation' },
            description: { zh: 'AI 视频生成能力', en: 'AI video generation' },
            status: 'active',
          },
          {
            code: 'image_gen',
            name: { zh: '图片生成', en: 'Image Generation' },
            description: { zh: 'AI 图片生成能力', en: 'AI image generation' },
            status: 'active',
          },
        ],
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/auth/union-login',
      description: t('settingsUnion.unionLoginDesc'),
      requestParams: [
        { name: 'loginTicket', type: 'String', required: true, description: t('settingsUnion.loginTicketDesc') },
      ],
      requestExample: JSON.stringify({
        loginTicket: 'ticket_abc123xyz',
      }, null, 2),
      responseParams: [
        { name: 'accessToken', type: 'String', required: false, description: t('settingsUnion.accessTokenDesc') },
        { name: 'refreshToken', type: 'String', required: false, description: t('settingsUnion.refreshTokenDesc') },
        { name: 'expiresIn', type: 'Long', required: false, description: t('settingsUnion.expiresInDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'username', type: 'String', required: false, description: t('settingsUnion.usernameDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('settingsUnion.nicknameDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIs...',
          refreshToken: 'dGhpcyBpcyBhIHJlZnJl...',
          expiresIn: 7200,
          userId: 10001,
          username: 'union_user_12345',
          nickname: '联盟用户',
        },
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/user/bind-union',
      description: t('settingsUnion.bindUnionDesc'),
      requestParams: [
        { name: 'bindToken', type: 'String', required: true, description: t('settingsUnion.bindTokenDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
      ],
      requestExample: JSON.stringify({
        bindToken: 'bind_token_xyz789',
        unionUserId: 'union_user_12345',
      }, null, 2),
      responseParams: [
        { name: 'success', type: 'Boolean', required: false, description: t('settingsUnion.bindSuccessDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          success: true,
        },
      }, null, 2),
    },
  ]
})

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

function copyText(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    message.success(t('settingsUnion.copySuccess'))
  }).catch(() => {
    message.error(t('settingsUnion.copyFailed'))
  })
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.max-w-2xl {
  max-width: 720px;
}

.api-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.api-item {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  background: #fafafa;
}

.api-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.method-tag {
  font-weight: 600;
  font-size: 12px;
  min-width: 52px;
  text-align: center;
}

.api-path {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
  color: #1a1a1a;
  word-break: break-all;
}

.api-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
}

.api-section {
  margin-top: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px 16px;
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 0;
}

.code-block code {
  font-family: inherit;
}
</style>
