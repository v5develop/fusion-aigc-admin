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

            <a-form-item :label="$t('settingsUnion.appKey')" name="appKey">
              <a-input
                v-model:value="formData.appKey"
                :placeholder="$t('settingsUnion.appKeyPlaceholder')"
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
                @change="handleSignatureChange"
              />
              <div class="form-tip">{{ $t('settingsUnion.signatureEnabledTip') }}</div>
            </a-form-item>

            <a-form-item :label="$t('settingsUnion.whitelistEnabled')">
              <a-switch
                v-model:checked="formData.whitelistEnabled"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
                @change="handleWhitelistChange"
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

            <a-form-item name="trustedProxies" v-if="formData.whitelistEnabled" class="advanced-item">
              <template #label>
                <span class="advanced-label">
                  {{ $t('settingsUnion.trustedProxies') }}
                  <a-tag size="small" color="default">{{ $t('settingsUnion.advancedTag') }}</a-tag>
                </span>
              </template>
              <a-textarea
                v-model:value="trustedProxiesText"
                :placeholder="$t('settingsUnion.trustedProxiesPlaceholder')"
                :rows="3"
              />
              <div class="form-tip">{{ $t('settingsUnion.trustedProxiesTip') }}</div>
            </a-form-item>

            <a-form-item v-if="formData.whitelistEnabled" class="advanced-item">
              <template #label>
                <span class="advanced-label">
                  {{ $t('settingsUnion.offlineRequireTimestamp') }}
                  <a-tag size="small" color="default">{{ $t('settingsUnion.advancedTag') }}</a-tag>
                </span>
              </template>
              <a-switch
                v-model:checked="formData.offlineRequireTimestamp"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
              />
              <div class="form-tip">{{ $t('settingsUnion.offlineRequireTimestampTip') }}</div>
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
          <a-card size="small" class="signature-guide">
            <template #title>{{ $t('settingsUnion.signatureGuideTitle') }}</template>
            <a-alert type="info" show-icon :message="$t('settingsUnion.signatureGuideIntro')" style="margin-bottom: 12px" />

            <div class="section-title">{{ $t('settingsUnion.authModesTitle') }}</div>
            <div class="auth-modes">
              <div v-for="mode in authModes" :key="mode.key" class="auth-mode-item">
                <div class="auth-mode-head">
                  <a-tag :color="mode.key === 'signed' ? 'green' : 'orange'">{{ mode.title }}</a-tag>
                </div>
                <div class="auth-mode-desc">{{ mode.desc }}</div>
                <div class="auth-mode-headers">
                  <span class="auth-mode-headers-label">{{ $t('settingsUnion.authModeHeaders') }}</span>
                  <code>{{ mode.headers }}</code>
                </div>
              </div>
            </div>

            <div class="section-title" style="margin-top: 12px">{{ $t('settingsUnion.signatureHeaders') }}</div>
            <a-table
              :columns="signatureHeaderColumns"
              :data-source="signatureHeaders"
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
              </template>
            </a-table>
            <div class="section-title" style="margin-top: 12px">{{ $t('settingsUnion.signatureSteps') }}</div>
            <pre class="code-block"><code>{{ signatureAlgoText }}</code></pre>
            <div class="section-title" style="margin-top: 12px">{{ $t('settingsUnion.signatureParamsTitle') }}</div>
            <a-table
              :columns="signatureParamColumns"
              :data-source="signatureParams"
              :pagination="false"
              size="small"
              row-key="field"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'field'">
                  <code>{{ record.field }}</code>
                </template>
              </template>
            </a-table>
            <div class="form-tip">{{ $t('settingsUnion.signatureGuideNote') }}</div>
          </a-card>

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
  appKey: '',
  appSecret: '',
  tokenUrl: '',
  callbackUrl: '',
  signatureEnabled: true,
  whitelistEnabled: false,
  whitelistIps: [] as string[],
  trustedProxies: [] as string[],
  offlineRequireTimestamp: true,
})

const whitelistIpsText = computed({
  get: () => formData.whitelistIps.join('\n'),
  set: (val: string) => {
    formData.whitelistIps = val.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  },
})

const trustedProxiesText = computed({
  get: () => formData.trustedProxies.join('\n'),
  set: (val: string) => {
    formData.trustedProxies = val.split('\n').map(s => s.trim()).filter(s => s.length > 0)
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
  appKey: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (isSignatureRequired() && !formData.appKey) {
          callback(new Error(t('settingsUnion.appKey') + t('common.required')))
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
  trustedProxies: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (formData.trustedProxies && formData.trustedProxies.length > 0) {
          const invalidIp = formData.trustedProxies.find(ip => !isValidIpOrCidr(ip))
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

const signatureHeaderColumns = computed(() => [
  { title: t('settingsUnion.paramName'), dataIndex: 'name', width: 200 },
  { title: t('settingsUnion.paramRequired'), dataIndex: 'required', width: 80, align: 'center' as const },
  { title: t('settingsUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const authModes = computed(() => [
  {
    key: 'signed',
    title: t('settingsUnion.authModeSignedTitle'),
    desc: t('settingsUnion.authModeSignedDesc'),
    headers: 'X-Union-App-Key, X-Union-Timestamp, X-Union-Nonce, X-Union-Signature',
  },
  {
    key: 'unsigned',
    title: t('settingsUnion.authModeUnsignedTitle'),
    desc: t('settingsUnion.authModeUnsignedDesc'),
    headers: 'X-Union-App-Key, X-Union-Timestamp, X-Union-Nonce',
  },
])

const signatureHeaders = computed(() => [
  { name: 'X-Union-App-Key', required: true, description: t('settingsUnion.headerAppKeyDesc') },
  { name: 'X-Union-Timestamp', required: true, description: t('settingsUnion.headerTimestampDesc') },
  { name: 'X-Union-Nonce', required: true, description: t('settingsUnion.headerNonceDesc') },
  { name: 'X-Union-Signature', required: true, description: t('settingsUnion.headerSignatureDesc') },
  { name: 'X-Union-Key-Version', required: false, description: t('settingsUnion.headerKeyVersionDesc') },
])

const signatureAlgoText = [
  'stringToSign =',
  '  httpMethod + "\\n" +',
  '  requestUri + "\\n" +',
  '  canonicalQuery + "\\n" +',
  '  bodyHash + "\\n" +',
  '  timestamp + "\\n" +',
  '  nonce + "\\n" +',
  '  appKey',
  '',
  'signature = HMAC-SHA256(stringToSign, appSecret)',
].join('\n')

const signatureParamColumns = computed(() => [
  { title: t('settingsUnion.signatureParamField'), dataIndex: 'field', width: 200 },
  { title: t('settingsUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const signatureParams = computed(() => [
  { field: 'httpMethod', description: t('settingsUnion.sigParamMethodDesc') },
  { field: 'requestUri', description: t('settingsUnion.sigParamUriDesc') },
  { field: 'canonicalQuery', description: t('settingsUnion.sigParamQueryDesc') },
  { field: 'bodyHash', description: t('settingsUnion.sigParamBodyDesc') },
  { field: 'timestamp', description: t('settingsUnion.sigParamTimestampDesc') },
  { field: 'nonce', description: t('settingsUnion.sigParamNonceDesc') },
  { field: 'appKey', description: t('settingsUnion.sigParamAppKeyDesc') },
  { field: 'appSecret', description: t('settingsUnion.sigParamAppSecretDesc') },
  { field: 'signature', description: t('settingsUnion.sigParamSignatureDesc') },
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
        { name: 'code', type: 'String', required: false, description: '创作能力编码' },
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
            description: { zh: 'AI 视频生成创作能力', en: 'AI video generation' },
            status: 'active',
          },
          {
            code: 'image_gen',
            name: { zh: '图片生成', en: 'Image Generation' },
            description: { zh: 'AI 图片生成创作能力', en: 'AI image generation' },
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
    {
      method: 'GET',
      methodColor: 'blue',
      path: '/api/v1/union/user-exists',
      description: t('settingsUnion.checkUserExistsDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'data', type: 'Boolean', required: false, description: t('settingsUnion.checkUserExistsResultDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: true,
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/recharge-consumption-summary',
      description: t('settingsUnion.rechargeConsumptionDesc'),
      requestParams: [
        { name: 'rechargeIds', type: 'List<String>', required: true, description: t('settingsUnion.rechargeIdsDesc') },
      ],
      requestExample: JSON.stringify({
        rechargeIds: ['RECHARGE-20260528-001', 'RECHARGE-20260528-002'],
      }, null, 2),
      responseParams: [
        { name: 'rechargeId', type: 'String', required: false, description: t('settingsUnion.rechargeIdDesc') },
        { name: 'pointsAmount', type: 'Long', required: false, description: t('settingsUnion.rechargePointsAmountDesc') },
        { name: 'consumedAmount', type: 'Long', required: false, description: t('settingsUnion.consumedAmountDesc') },
        { name: 'remainingAmount', type: 'Long', required: false, description: t('settingsUnion.remainingAmountDesc') },
        { name: 'expireTime', type: 'String', required: false, description: t('settingsUnion.expireTimeDesc') },
        { name: 'expired', type: 'Boolean', required: false, description: t('settingsUnion.expiredDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: [
          {
            rechargeId: 'RECHARGE-20260528-001',
            pointsAmount: 1000,
            consumedAmount: 350,
            remainingAmount: 650,
            expireTime: '2026-12-31 23:59:59',
            expired: false,
          },
        ],
      }, null, 2),
    },
    {
      method: 'GET',
      methodColor: 'blue',
      path: '/api/v1/union/user-points-transactions',
      description: t('settingsUnion.userPointsLogDesc'),
      requestParams: [
        { name: 'userId', type: 'Long', required: true, description: t('settingsUnion.userIdDesc') },
        { name: 'page', type: 'Integer', required: false, description: t('settingsUnion.pageDesc') },
        { name: 'pageSize', type: 'Integer', required: false, description: t('settingsUnion.pageSizeDesc') },
        { name: 'changeType', type: 'String', required: false, description: t('settingsUnion.changeTypeFilterDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'total', type: 'Long', required: false, description: t('settingsUnion.totalDesc') },
        { name: 'list', type: 'List', required: false, description: t('settingsUnion.listDesc') },
        { name: '  list.changeType', type: 'String', required: false, description: t('settingsUnion.changeTypeDesc') },
        { name: '  list.amount', type: 'Long', required: false, description: t('settingsUnion.amountDesc') },
        { name: '  list.balanceAfter', type: 'Long', required: false, description: t('settingsUnion.balanceAfterDesc') },
        { name: '  list.bizType', type: 'String', required: false, description: t('settingsUnion.bizTypeDesc') },
        { name: '  list.bizId', type: 'String', required: false, description: t('settingsUnion.bizIdDesc') },
        { name: '  list.description', type: 'String', required: false, description: t('settingsUnion.descriptionDesc') },
        { name: '  list.createTime', type: 'String', required: false, description: t('settingsUnion.createTimeDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          total: 4,
          list: [
            {
              changeType: 'RECHARGE',
              amount: 1000,
              balanceAfter: 1000,
              bizType: 'UNION_RECHARGE',
              bizId: 'RECHARGE-20260528-001',
              description: '联盟点数充值',
              createTime: '2026-05-28 10:00:00',
            },
            {
              changeType: 'CONSUME',
              amount: -100,
              balanceAfter: 900,
              bizType: 'feature_grant',
              bizId: 'ORDER-20260528-001',
              description: '视频生成消耗',
              createTime: '2026-05-28 11:00:00',
            },
          ],
        },
      }, null, 2),
    },
    {
      method: 'GET',
      methodColor: 'blue',
      path: '/api/v1/union/user-info',
      description: t('settingsUnion.getUnionUserInfoDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'avatar', type: 'String', required: false, description: t('settingsUnion.avatarDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('settingsUnion.nicknameDesc') },
        { name: 'phone', type: 'String', required: false, description: t('settingsUnion.maskPhoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('settingsUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: false, description: t('settingsUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('settingsUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('settingsUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('settingsUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: false, description: t('settingsUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.unionUserStatusDesc') },
        { name: 'createdAt', type: 'String', required: false, description: t('settingsUnion.createdAtDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          userId: 10001,
          avatar: 'https://cdn.union.com/avatar/10001.png',
          nickname: '联盟用户',
          phone: '138****1234',
          birthday: '1990-01-01',
          gender: 1,
          province: 'Guangdong',
          city: 'Shenzhen',
          realNameStatus: 'approved',
          roles: ['user', 'creator'],
          status: 'active',
          createdAt: '2026-05-28T10:00:00',
        },
        _note_userNotFound: t('settingsUnion.userNotFoundDesc'),
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/user-register',
      description: t('settingsUnion.registerUnionUserDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('settingsUnion.unionUserIdDesc') },
        { name: 'nickname', type: 'String', required: true, description: t('settingsUnion.nicknameDesc') },
        { name: 'avatar', type: 'String', required: true, description: t('settingsUnion.avatarDesc') },
        { name: 'phone', type: 'String', required: false, description: t('settingsUnion.phoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('settingsUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: true, description: t('settingsUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('settingsUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('settingsUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('settingsUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: true, description: t('settingsUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.unionUserStatusDesc') },
      ],
      requestExample: JSON.stringify({
        unionUserId: 'union_user_12345',
        nickname: '联盟用户',
        avatar: 'https://cdn.union.com/avatar/10001.png',
        phone: '13812341234',
        birthday: '1990-01-01',
        gender: 1,
        province: 'Guangdong',
        city: 'Shenzhen',
        realNameStatus: 'approved',
        roles: ['user', 'creator'],
        status: 'active',
      }, null, 2),
      responseParams: [
        { name: 'userId', type: 'Long', required: false, description: t('settingsUnion.userIdDesc') },
        { name: 'avatar', type: 'String', required: false, description: t('settingsUnion.avatarDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('settingsUnion.nicknameDesc') },
        { name: 'phone', type: 'String', required: false, description: t('settingsUnion.maskPhoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('settingsUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: false, description: t('settingsUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('settingsUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('settingsUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('settingsUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: false, description: t('settingsUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('settingsUnion.unionUserStatusDesc') },
        { name: 'createdAt', type: 'String', required: false, description: t('settingsUnion.createdAtDesc') },
      ],
      responseExample: JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          userId: 10001,
          avatar: 'https://cdn.union.com/avatar/10001.png',
          nickname: '联盟用户',
          phone: '138****1234',
          birthday: '1990-01-01',
          gender: 1,
          province: 'Guangdong',
          city: 'Shenzhen',
          realNameStatus: 'approved',
          roles: ['user', 'creator'],
          status: 'active',
          createdAt: '2026-05-28T10:00:00',
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

// 签名验签与 IP 白名单不能同时关闭，避免联盟接口完全无鉴权。
// 关闭最后一种鉴权方式时，自动切换打开另一种。
function handleSignatureChange(checked: boolean) {
  if (!checked && !formData.whitelistEnabled) {
    formData.whitelistEnabled = true
    message.warning(t('settingsUnion.authMethodSwitchedTip'))
  }
}

function handleWhitelistChange(checked: boolean) {
  if (!checked && !formData.signatureEnabled) {
    formData.signatureEnabled = true
    message.warning(t('settingsUnion.authMethodSwitchedTip'))
  }
}

async function handleSubmit() {
  if (!formData.signatureEnabled && !formData.whitelistEnabled) {
    message.error(t('settingsUnion.authMethodRequiredTip'))
    return
  }
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

.advanced-item :deep(.ant-form-item-label) > label {
  color: #888;
}

.advanced-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.auth-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 4px;
}

.auth-mode-item {
  flex: 1 1 280px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fafafa;
}

.auth-mode-head {
  margin-bottom: 6px;
}

.auth-mode-desc {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  margin-bottom: 8px;
}

.auth-mode-headers {
  font-size: 12px;
}

.auth-mode-headers-label {
  color: #888;
  margin-right: 6px;
}

.auth-mode-headers code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #c41d7f;
  background: #fff0f6;
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
