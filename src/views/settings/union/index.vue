<template>
  <div class="page-container">
    <a-card variant="borderless">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="config" :tab="$t('openPlatformUnion.title')">
          <a-form
            layout="vertical"
            :model="formData"
            :rules="rules"
            ref="formRef"
            class="max-w-2xl"
          >
            <a-form-item :label="$t('openPlatformUnion.baseUrl')" name="baseUrl">
              <a-input
                v-model:value="formData.baseUrl"
                :placeholder="$t('openPlatformUnion.baseUrlPlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.appKey')" name="appKey">
              <a-input
                v-model:value="formData.appKey"
                :placeholder="$t('openPlatformUnion.appKeyPlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.appSecret')" name="appSecret">
              <a-input-password
                v-model:value="formData.appSecret"
                :placeholder="$t('openPlatformUnion.appSecretPlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.tokenUrl')" name="tokenUrl">
              <a-input
                v-model:value="formData.tokenUrl"
                :placeholder="$t('openPlatformUnion.tokenUrlPlaceholder')"
              />
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.callbackUrl')" name="callbackUrl">
              <a-input
                v-model:value="formData.callbackUrl"
                :placeholder="$t('openPlatformUnion.callbackUrlPlaceholder')"
              />
            </a-form-item>

            <a-divider />

            <a-form-item :label="$t('openPlatformUnion.signatureEnabled')">
              <a-switch
                v-model:checked="formData.signatureEnabled"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
                @change="handleSignatureChange"
              />
              <div class="form-tip">{{ $t('openPlatformUnion.signatureEnabledTip') }}</div>
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.whitelistEnabled')">
              <a-switch
                v-model:checked="formData.whitelistEnabled"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
                @change="handleWhitelistChange"
              />
              <div class="form-tip">{{ $t('openPlatformUnion.whitelistEnabledTip') }}</div>
            </a-form-item>

            <a-form-item :label="$t('openPlatformUnion.whitelistIps')" name="whitelistIps" v-if="formData.whitelistEnabled">
              <a-textarea
                v-model:value="whitelistIpsText"
                :placeholder="$t('openPlatformUnion.whitelistIpsPlaceholder')"
                :rows="4"
              />
              <div class="form-tip">{{ $t('openPlatformUnion.whitelistIpsTip') }}</div>
            </a-form-item>

            <a-form-item name="trustedProxies" v-if="formData.whitelistEnabled" class="advanced-item">
              <template #label>
                <span class="advanced-label">
                  {{ $t('openPlatformUnion.trustedProxies') }}
                  <a-tag size="small" color="default">{{ $t('openPlatformUnion.advancedTag') }}</a-tag>
                </span>
              </template>
              <a-textarea
                v-model:value="trustedProxiesText"
                :placeholder="$t('openPlatformUnion.trustedProxiesPlaceholder')"
                :rows="3"
              />
              <div class="form-tip">{{ $t('openPlatformUnion.trustedProxiesTip') }}</div>
            </a-form-item>

            <a-form-item v-if="formData.whitelistEnabled" class="advanced-item">
              <template #label>
                <span class="advanced-label">
                  {{ $t('openPlatformUnion.offlineRequireTimestamp') }}
                  <a-tag size="small" color="default">{{ $t('openPlatformUnion.advancedTag') }}</a-tag>
                </span>
              </template>
              <a-switch
                v-model:checked="formData.offlineRequireTimestamp"
                :checked-children="$t('common.enabled')"
                :un-checked-children="$t('common.disabled')"
              />
              <div class="form-tip">{{ $t('openPlatformUnion.offlineRequireTimestampTip') }}</div>
            </a-form-item>

            <a-form-item>
              <a-space>
                <a-button type="primary" @click="handleSubmit" :loading="submitting">
                  {{ $t('common.save') }}
                </a-button>
                <a-button @click="handleTest" :loading="testing">
                  {{ $t('openPlatformUnion.testConnection') }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="openapi" :tab="$t('openPlatformUnion.openapi')">
          <a-card size="small" class="signature-guide">
            <template #title>{{ $t('openPlatformUnion.signatureGuideTitle') }}</template>
            <a-alert type="info" show-icon :message="$t('openPlatformUnion.signatureGuideIntro')" style="margin-bottom: 12px" />

            <div class="section-title">{{ $t('openPlatformUnion.authModesTitle') }}</div>
            <div class="auth-modes">
              <div v-for="mode in authModes" :key="mode.key" class="auth-mode-item">
                <div class="auth-mode-head">
                  <a-tag :color="mode.key === 'signed' ? 'green' : 'orange'">{{ mode.title }}</a-tag>
                </div>
                <div class="auth-mode-desc">{{ mode.desc }}</div>
                <div class="auth-mode-headers">
                  <span class="auth-mode-headers-label">{{ $t('openPlatformUnion.authModeHeaders') }}</span>
                  <code>{{ mode.headers }}</code>
                </div>
              </div>
            </div>

            <div class="section-title" style="margin-top: 12px">{{ $t('openPlatformUnion.signatureHeaders') }}</div>
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
                    {{ record.required ? $t('openPlatformUnion.paramRequired') : $t('openPlatformUnion.paramOptional') }}
                  </a-tag>
                </template>
              </template>
            </a-table>
            <div class="section-title" style="margin-top: 12px">{{ $t('openPlatformUnion.signatureSteps') }}</div>
            <pre class="code-block"><code>{{ signatureAlgoText }}</code></pre>
            <div class="section-title" style="margin-top: 12px">{{ $t('openPlatformUnion.signatureParamsTitle') }}</div>
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
            <div class="form-tip">{{ $t('openPlatformUnion.signatureGuideNote') }}</div>
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
                <div class="section-title">{{ $t('openPlatformUnion.requestParams') }}</div>
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
                        {{ record.required ? $t('openPlatformUnion.paramRequired') : $t('openPlatformUnion.paramOptional') }}
                      </a-tag>
                    </template>
                    <template v-if="column.dataIndex === 'type'">
                      <a-tag size="small">{{ record.type }}</a-tag>
                    </template>
                  </template>
                </a-table>
              </div>

              <div class="api-section">
                <div class="section-title">{{ $t('openPlatformUnion.responseParams') }}</div>
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
                        {{ record.required ? $t('openPlatformUnion.paramRequired') : $t('openPlatformUnion.paramOptional') }}
                      </a-tag>
                    </template>
                    <template v-if="column.dataIndex === 'type'">
                      <a-tag size="small">{{ record.type }}</a-tag>
                    </template>
                  </template>
                </a-table>
              </div>

              <div class="api-section" v-if="api.requestExample">
                <div class="section-title">{{ $t('openPlatformUnion.requestExample') }}</div>
                <pre class="code-block"><code>{{ api.requestExample }}</code></pre>
              </div>

              <div class="api-section" v-if="api.responseExample">
                <div class="section-title">{{ $t('openPlatformUnion.responseExample') }}</div>
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
          callback(new Error(t('openPlatformUnion.baseUrl') + t('common.required')))
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
          callback(new Error(t('openPlatformUnion.appKey') + t('common.required')))
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
          callback(new Error(t('openPlatformUnion.appSecret') + t('common.required')))
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
          callback(new Error(t('openPlatformUnion.tokenUrl') + t('common.required')))
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
          callback(new Error(t('openPlatformUnion.callbackUrl') + t('common.required')))
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
            callback(new Error(t('openPlatformUnion.whitelistIps') + t('common.required')))
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
  { title: t('openPlatformUnion.paramName'), dataIndex: 'name', width: 160 },
  { title: t('openPlatformUnion.paramType'), dataIndex: 'type', width: 180 },
  { title: t('openPlatformUnion.paramRequired'), dataIndex: 'required', width: 80, align: 'center' as const },
  { title: t('openPlatformUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const signatureHeaderColumns = computed(() => [
  { title: t('openPlatformUnion.paramName'), dataIndex: 'name', width: 200 },
  { title: t('openPlatformUnion.paramRequired'), dataIndex: 'required', width: 80, align: 'center' as const },
  { title: t('openPlatformUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const authModes = computed(() => [
  {
    key: 'signed',
    title: t('openPlatformUnion.authModeSignedTitle'),
    desc: t('openPlatformUnion.authModeSignedDesc'),
    headers: 'X-Union-App-Key, X-Union-Timestamp, X-Union-Nonce, X-Union-Signature',
  },
  {
    key: 'unsigned',
    title: t('openPlatformUnion.authModeUnsignedTitle'),
    desc: t('openPlatformUnion.authModeUnsignedDesc'),
    headers: 'X-Union-App-Key, X-Union-Timestamp, X-Union-Nonce',
  },
])

const signatureHeaders = computed(() => [
  { name: 'X-Union-App-Key', required: true, description: t('openPlatformUnion.headerAppKeyDesc') },
  { name: 'X-Union-Timestamp', required: true, description: t('openPlatformUnion.headerTimestampDesc') },
  { name: 'X-Union-Nonce', required: true, description: t('openPlatformUnion.headerNonceDesc') },
  { name: 'X-Union-Signature', required: true, description: t('openPlatformUnion.headerSignatureDesc') },
  { name: 'X-Union-Key-Version', required: false, description: t('openPlatformUnion.headerKeyVersionDesc') },
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
  { title: t('openPlatformUnion.signatureParamField'), dataIndex: 'field', width: 200 },
  { title: t('openPlatformUnion.paramDesc'), dataIndex: 'description', ellipsis: true },
])

const signatureParams = computed(() => [
  { field: 'httpMethod', description: t('openPlatformUnion.sigParamMethodDesc') },
  { field: 'requestUri', description: t('openPlatformUnion.sigParamUriDesc') },
  { field: 'canonicalQuery', description: t('openPlatformUnion.sigParamQueryDesc') },
  { field: 'bodyHash', description: t('openPlatformUnion.sigParamBodyDesc') },
  { field: 'timestamp', description: t('openPlatformUnion.sigParamTimestampDesc') },
  { field: 'nonce', description: t('openPlatformUnion.sigParamNonceDesc') },
  { field: 'appKey', description: t('openPlatformUnion.sigParamAppKeyDesc') },
  { field: 'appSecret', description: t('openPlatformUnion.sigParamAppSecretDesc') },
  { field: 'signature', description: t('openPlatformUnion.sigParamSignatureDesc') },
])

const apiDocs = computed(() => {
  return [
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/feature-grants',
      description: t('openPlatformUnion.grantDesc'),
      requestParams: [
        { name: 'grantId', type: 'String', required: true, description: t('openPlatformUnion.grantIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'featureCodes', type: 'List<String>', required: true, description: t('openPlatformUnion.featureCodesDesc') },
        { name: 'expireTime', type: 'LocalDateTime', required: false, description: t('openPlatformUnion.expireTimeDesc') },
      ],
      requestExample: JSON.stringify({
        grantId: 'GRANT-20260528-001',
        unionUserId: 'union_user_12345',
        featureCodes: ['video_gen', 'image_gen'],
        expireTime: '2026-12-31T23:59:59',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('openPlatformUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.statusDesc') },
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
      description: t('openPlatformUnion.rechargeDesc'),
      requestParams: [
        { name: 'rechargeId', type: 'String', required: true, description: t('openPlatformUnion.rechargeIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'pointsAmount', type: 'Long', required: true, description: t('openPlatformUnion.pointsAmountDesc') },
        { name: 'bizType', type: 'String', required: false, description: t('openPlatformUnion.rechargeBizTypeDesc') },
        { name: 'expireTime', type: 'LocalDateTime', required: false, description: t('openPlatformUnion.rechargeExpireTimeDesc') },
      ],
      requestExample: JSON.stringify({
        rechargeId: 'RECHARGE-20260528-001',
        unionUserId: 'union_user_12345',
        pointsAmount: 1000,
        bizType: 'subscription',
        expireTime: '2026-12-31T23:59:59',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('openPlatformUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.statusDesc') },
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
      description: t('openPlatformUnion.revokeDesc'),
      requestParams: [
        { name: 'revokeId', type: 'String', required: true, description: t('openPlatformUnion.revokeIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'featureCodes', type: 'List<String>', required: true, description: t('openPlatformUnion.featureCodesDesc') },
        { name: 'sourceGrantId', type: 'String', required: false, description: t('openPlatformUnion.sourceGrantIdDesc') },
      ],
      requestExample: JSON.stringify({
        revokeId: 'REVOKE-20260528-001',
        unionUserId: 'union_user_12345',
        featureCodes: ['video_gen'],
        sourceGrantId: 'GRANT-20260528-001',
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('openPlatformUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.statusDesc') },
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
      description: t('openPlatformUnion.refundDesc'),
      requestParams: [
        { name: 'refundId', type: 'String', required: true, description: t('openPlatformUnion.refundIdDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'sourceBizType', type: 'String', required: true, description: t('openPlatformUnion.sourceBizTypeDesc') },
        { name: 'sourceBizId', type: 'String', required: true, description: t('openPlatformUnion.sourceBizIdDesc') },
        { name: 'amount', type: 'Long', required: true, description: t('openPlatformUnion.refundAmountDesc') },
      ],
      requestExample: JSON.stringify({
        refundId: 'REFUND-20260528-001',
        unionUserId: 'union_user_12345',
        sourceBizType: 'CONSUME',
        sourceBizId: 'ORDER-20260528-001',
        amount: 100,
      }, null, 2),
      responseParams: [
        { name: 'externalId', type: 'String', required: false, description: t('openPlatformUnion.externalIdDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.statusDesc') },
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
      description: t('openPlatformUnion.featuresDesc'),
      requestParams: [],
      requestExample: null,
      responseParams: [
        { name: 'code', type: 'String', required: false, description: '创作能力编码' },
        { name: 'name', type: 'Map<String, String>', required: false, description: t('openPlatformUnion.featureNameDesc') },
        { name: 'description', type: 'Map<String, String>', required: false, description: t('openPlatformUnion.featureDescDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.featureStatusDesc') },
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
      description: t('openPlatformUnion.unionLoginDesc'),
      requestParams: [
        { name: 'loginTicket', type: 'String', required: true, description: t('openPlatformUnion.loginTicketDesc') },
      ],
      requestExample: JSON.stringify({
        loginTicket: 'ticket_abc123xyz',
      }, null, 2),
      responseParams: [
        { name: 'accessToken', type: 'String', required: false, description: t('openPlatformUnion.accessTokenDesc') },
        { name: 'refreshToken', type: 'String', required: false, description: t('openPlatformUnion.refreshTokenDesc') },
        { name: 'expiresIn', type: 'Long', required: false, description: t('openPlatformUnion.expiresInDesc') },
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'username', type: 'String', required: false, description: t('openPlatformUnion.usernameDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('openPlatformUnion.nicknameDesc') },
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
      description: t('openPlatformUnion.bindUnionDesc'),
      requestParams: [
        { name: 'bindToken', type: 'String', required: true, description: t('openPlatformUnion.bindTokenDesc') },
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
      ],
      requestExample: JSON.stringify({
        bindToken: 'bind_token_xyz789',
        unionUserId: 'union_user_12345',
      }, null, 2),
      responseParams: [
        { name: 'success', type: 'Boolean', required: false, description: t('openPlatformUnion.bindSuccessDesc') },
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
      description: t('openPlatformUnion.checkUserExistsDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'data', type: 'Boolean', required: false, description: t('openPlatformUnion.checkUserExistsResultDesc') },
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
      description: t('openPlatformUnion.rechargeConsumptionDesc'),
      requestParams: [
        { name: 'rechargeIds', type: 'List<String>', required: true, description: t('openPlatformUnion.rechargeIdsDesc') },
      ],
      requestExample: JSON.stringify({
        rechargeIds: ['RECHARGE-20260528-001', 'RECHARGE-20260528-002'],
      }, null, 2),
      responseParams: [
        { name: 'rechargeId', type: 'String', required: false, description: t('openPlatformUnion.rechargeIdDesc') },
        { name: 'pointsAmount', type: 'Long', required: false, description: t('openPlatformUnion.rechargePointsAmountDesc') },
        { name: 'consumedAmount', type: 'Long', required: false, description: t('openPlatformUnion.consumedAmountDesc') },
        { name: 'remainingAmount', type: 'Long', required: false, description: t('openPlatformUnion.remainingAmountDesc') },
        { name: 'expireTime', type: 'String', required: false, description: t('openPlatformUnion.rechargeExpireTimeDesc') },
        { name: 'expired', type: 'Boolean', required: false, description: t('openPlatformUnion.expiredDesc') },
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
      description: t('openPlatformUnion.userPointsLogDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'Long', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'page', type: 'Integer', required: false, description: t('openPlatformUnion.pageDesc') },
        { name: 'pageSize', type: 'Integer', required: false, description: t('openPlatformUnion.pageSizeDesc') },
        { name: 'changeType', type: 'String', required: false, description: t('openPlatformUnion.changeTypeFilterDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'total', type: 'Long', required: false, description: t('openPlatformUnion.totalDesc') },
        { name: 'list', type: 'List', required: false, description: t('openPlatformUnion.listDesc') },
        { name: '  list.changeType', type: 'String', required: false, description: t('openPlatformUnion.changeTypeDesc') },
        { name: '  list.amount', type: 'Long', required: false, description: t('openPlatformUnion.amountDesc') },
        { name: '  list.balanceAfter', type: 'Long', required: false, description: t('openPlatformUnion.balanceAfterDesc') },
        { name: '  list.bizType', type: 'String', required: false, description: t('openPlatformUnion.bizTypeDesc') },
        { name: '  list.bizId', type: 'String', required: false, description: t('openPlatformUnion.bizIdDesc') },
        { name: '  list.description', type: 'String', required: false, description: t('openPlatformUnion.descriptionDesc') },
        { name: '  list.createTime', type: 'String', required: false, description: t('openPlatformUnion.createTimeDesc') },
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
      description: t('openPlatformUnion.getUnionUserInfoDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
      ],
      requestExample: null,
      responseParams: [
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'avatar', type: 'String', required: false, description: t('openPlatformUnion.avatarDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('openPlatformUnion.nicknameDesc') },
        { name: 'phone', type: 'String', required: false, description: t('openPlatformUnion.maskPhoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('openPlatformUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: false, description: t('openPlatformUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('openPlatformUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('openPlatformUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('openPlatformUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: false, description: t('openPlatformUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.unionUserStatusDesc') },
        { name: 'createdAt', type: 'String', required: false, description: t('openPlatformUnion.createdAtDesc') },
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
        _note_userNotFound: t('openPlatformUnion.userNotFoundDesc'),
      }, null, 2),
    },
    {
      method: 'POST',
      methodColor: 'green',
      path: '/api/v1/union/user-register',
      description: t('openPlatformUnion.registerUnionUserDesc'),
      requestParams: [
        { name: 'unionUserId', type: 'String', required: true, description: t('openPlatformUnion.unionUserIdDesc') },
        { name: 'nickname', type: 'String', required: true, description: t('openPlatformUnion.nicknameDesc') },
        { name: 'avatar', type: 'String', required: true, description: t('openPlatformUnion.avatarDesc') },
        { name: 'phone', type: 'String', required: false, description: t('openPlatformUnion.phoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('openPlatformUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: true, description: t('openPlatformUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('openPlatformUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('openPlatformUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('openPlatformUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: true, description: t('openPlatformUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.unionUserStatusDesc') },
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
        { name: 'userId', type: 'Long', required: false, description: t('openPlatformUnion.userIdDesc') },
        { name: 'avatar', type: 'String', required: false, description: t('openPlatformUnion.avatarDesc') },
        { name: 'nickname', type: 'String', required: false, description: t('openPlatformUnion.nicknameDesc') },
        { name: 'phone', type: 'String', required: false, description: t('openPlatformUnion.maskPhoneDesc') },
        { name: 'birthday', type: 'String', required: false, description: t('openPlatformUnion.birthdayDesc') },
        { name: 'gender', type: 'Integer', required: false, description: t('openPlatformUnion.genderDesc') },
        { name: 'province', type: 'String', required: false, description: t('openPlatformUnion.provinceDesc') },
        { name: 'city', type: 'String', required: false, description: t('openPlatformUnion.cityDesc') },
        { name: 'realNameStatus', type: 'String', required: false, description: t('openPlatformUnion.realNameStatusDesc') },
        { name: 'roles', type: 'List<String>', required: false, description: t('openPlatformUnion.rolesDesc') },
        { name: 'status', type: 'String', required: false, description: t('openPlatformUnion.unionUserStatusDesc') },
        { name: 'createdAt', type: 'String', required: false, description: t('openPlatformUnion.createdAtDesc') },
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
    message.warning(t('openPlatformUnion.authMethodSwitchedTip'))
  }
}

function handleWhitelistChange(checked: boolean) {
  if (!checked && !formData.signatureEnabled) {
    formData.signatureEnabled = true
    message.warning(t('openPlatformUnion.authMethodSwitchedTip'))
  }
}

async function handleSubmit() {
  if (!formData.signatureEnabled && !formData.whitelistEnabled) {
    message.error(t('openPlatformUnion.authMethodRequiredTip'))
    return
  }
  try {
    await formRef.value?.validateFields()
    submitting.value = true
    await saveUnionConfig(formData)
    message.success(t('openPlatformUnion.saveSuccess'))
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
    message.success(t('openPlatformUnion.testConnectionSuccess'))
  } catch (error) {
    console.error('Test connection failed:', error)
    message.error(t('openPlatformUnion.testConnectionFailed'))
  } finally {
    testing.value = false
  }
}

function copyText(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    message.success(t('openPlatformUnion.copySuccess'))
  }).catch(() => {
    message.error(t('openPlatformUnion.copyFailed'))
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
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  padding: 16px 20px;
  background: var(--color-fill-quaternary);
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
  color: var(--color-text-primary);
  word-break: break-all;
}

.api-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.api-section {
  margin-top: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.advanced-item :deep(.ant-form-item-label) > label {
  color: var(--color-text-tertiary);
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
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  padding: 10px 12px;
  background: var(--color-fill-quaternary);
}

.auth-mode-head {
  margin-bottom: 6px;
}

.auth-mode-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}

.auth-mode-headers {
  font-size: 12px;
}

.auth-mode-headers-label {
  color: var(--color-text-tertiary);
  margin-right: 6px;
}

.auth-mode-headers code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--color-primary-5);
  background: var(--color-bg-container);
  padding: 1px 4px;
  border-radius: 3px;
}

:deep(.ant-tag-default) {
  background: var(--color-fill-quaternary);
  border-color: var(--color-border-secondary);
  color: var(--color-text-secondary);
}

:deep(.ant-tag-red) {
  background: rgba(255, 77, 79, 0.12);
  border-color: rgba(255, 77, 79, 0.3);
  color: rgba(255, 77, 79, 0.85);
}
</style>
