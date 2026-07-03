<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #toolbar>
        <a-button type="primary" @click="showCreateModal">
          {{ $t('openApp.create') }}
        </a-button>
      </template>
      <template #emptyText>
        <a-empty :description="$t('openApp.noData')" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'appKey'">
          <a-typography-text copyable>{{ record.appKey }}</a-typography-text>
          <a-tag v-if="record.isBuiltin === 1" color="purple" style="margin-left: 8px">
            {{ $t('openApp.builtin') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColorMap[record.status]">
            {{ statusMap[record.status] || '-' }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'scopes'">
          {{ formatJsonArray(record.scopes) }}
        </template>

        <template v-if="column.key === 'operation'">
          <a-button
            v-if="record.status === 0"
            type="link"
            size="small"
            @click="handleApprove(record)"
          >
            {{ $t('openApp.approve') }}
          </a-button>
          <a-button
            v-if="record.status === 0"
            type="link"
            size="small"
            danger
            @click="handleReject(record)"
          >
            {{ $t('openApp.reject') }}
          </a-button>
          <a-button
            v-if="record.status === 1 && record.isBuiltin !== 1"
            type="link"
            size="small"
            danger
            @click="handleDisable(record)"
          >
            {{ $t('openApp.disable') }}
          </a-button>
          <a-button
            v-if="record.status === 2"
            type="link"
            size="small"
            @click="handleEnable(record)"
          >
            {{ $t('openApp.enable') }}
          </a-button>
          <a-button
            v-if="record.status === 1"
            type="link"
            size="small"
            @click="handleRotate(record)"
          >
            {{ $t('openApp.rotate') }}
          </a-button>
        </template>
      </template>
    </ProTable>

    <!-- 创建应用申请弹窗 -->
    <a-modal
      v-model:open="createVisible"
      :title="$t('openApp.create')"
      @ok="handleCreateOk"
      @cancel="createVisible = false"
    >
      <a-form :model="createForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('openApp.appName')" required>
          <a-input v-model:value="createForm.appName" :placeholder="$t('openApp.appNamePlaceholder')" />
        </a-form-item>
        <a-form-item :label="$t('openApp.scopes')">
          <a-select
            v-model:value="createForm.scopes"
            mode="multiple"
            :placeholder="$t('openApp.scopesPlaceholder')"
            :options="scopeOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('openApp.ipWhitelist')">
          <a-select
            v-model:value="createForm.ipWhitelist"
            mode="tags"
            :placeholder="$t('openApp.ipWhitelistPlaceholder')"
            :open="false"
          />
        </a-form-item>
        <a-form-item :label="$t('openApp.callbackUrl')">
          <a-input v-model:value="createForm.callbackUrl" placeholder="https://" />
        </a-form-item>
        <a-form-item :label="$t('openApp.remark')">
          <a-textarea v-model:value="createForm.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 一次性密钥展示弹窗 -->
    <a-modal
      v-model:open="secretVisible"
      :title="$t('openApp.secretTitle')"
      :footer="null"
      @cancel="secretVisible = false"
    >
      <a-alert type="warning" show-icon :message="$t('openApp.secretWarning')" style="margin-bottom: 16px" />
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item :label="$t('openApp.appKey')">
          <a-typography-text copyable>{{ secretResult?.appKey }}</a-typography-text>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('openApp.appSecret')">
          <a-typography-text copyable>{{ secretResult?.appSecret }}</a-typography-text>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('openApp.keyVersion')">
          {{ secretResult?.keyVersion }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { message, Modal, Checkbox } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getOpenAppList,
  createOpenApp,
  approveOpenApp,
  rejectOpenApp,
  disableOpenApp,
  enableOpenApp,
  rotateOpenAppSecret,
} from '@/api/open-app'
import type { OpenApp, OpenAppSecretResp, OpenAppStatus } from '@/types/open-app'

const { t } = useI18n()

const tableRef = ref<InstanceType<typeof ProTable>>()

const statusMap: Record<number, string> = {
  0: t('openApp.statusMap.pending'),
  1: t('openApp.statusMap.enabled'),
  2: t('openApp.statusMap.disabled'),
  3: t('openApp.statusMap.rejected'),
}

const statusColorMap: Record<number, string> = {
  0: 'orange',
  1: 'green',
  2: 'default',
  3: 'red',
}

const scopeOptions = [
  { label: 'billing', value: 'billing' },
  { label: 'auth', value: 'auth' },
  { label: 'asset', value: 'asset' },
]

const columns = [
  { title: t('openApp.appName'), dataIndex: 'appName', search: true, searchType: 'input' as const, width: 160 },
  { title: t('openApp.appKey'), dataIndex: 'appKey', width: 220 },
  { title: t('openApp.scopes'), dataIndex: 'scopes', width: 160 },
  { title: t('openApp.keyVersion'), dataIndex: 'keyVersion', width: 90, align: 'center' as const },
  { title: t('openApp.rateLimit'), dataIndex: 'rateLimit', width: 90, align: 'center' as const },
  {
    title: t('openApp.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('openApp.statusMap.pending'), value: 0 },
      { label: t('openApp.statusMap.enabled'), value: 1 },
      { label: t('openApp.statusMap.disabled'), value: 2 },
      { label: t('openApp.statusMap.rejected'), value: 3 },
    ],
    width: 100,
    align: 'center' as const,
  },
  { title: t('openApp.createTime'), dataIndex: 'createTime', width: 180 },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 220,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

function formatJsonArray(json?: string | null): string {
  if (!json) return '-'
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.join(', ') : json
  } catch {
    return json
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await getOpenAppList({
    appName: params.appName as string | undefined,
    status: params.status as OpenAppStatus | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function reload() {
  tableRef.value?.reload()
}

// ===== 创建申请 =====
const createVisible = ref(false)
const createForm = ref<{
  appName: string
  scopes: string[]
  ipWhitelist: string[]
  callbackUrl: string
  remark: string
}>({
  appName: '',
  scopes: [],
  ipWhitelist: [],
  callbackUrl: '',
  remark: '',
})

function showCreateModal() {
  createForm.value = { appName: '', scopes: [], ipWhitelist: [], callbackUrl: '', remark: '' }
  createVisible.value = true
}

async function handleCreateOk() {
  if (!createForm.value.appName.trim()) {
    message.error(t('openApp.appNameRequired'))
    return
  }
  await createOpenApp({
    appName: createForm.value.appName.trim(),
    scopes: createForm.value.scopes.length ? createForm.value.scopes : undefined,
    ipWhitelist: createForm.value.ipWhitelist.length ? createForm.value.ipWhitelist : undefined,
    callbackUrl: createForm.value.callbackUrl || undefined,
    remark: createForm.value.remark || undefined,
  })
  message.success(t('openApp.createSuccess'))
  createVisible.value = false
  reload()
}

// ===== 一次性密钥展示 =====
const secretVisible = ref(false)
const secretResult = ref<OpenAppSecretResp>()

function showSecret(result: OpenAppSecretResp) {
  secretResult.value = result
  secretVisible.value = true
}

// ===== 审批 / 驳回 / 禁用 / 启用 / 轮换 =====
function handleApprove(record: OpenApp) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('openApp.confirmApprove'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      const result = await approveOpenApp(record.id)
      message.success(t('openApp.approveSuccess'))
      showSecret(result)
      reload()
    },
  })
}

function handleReject(record: OpenApp) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('openApp.confirmReject'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      await rejectOpenApp(record.id)
      message.success(t('openApp.rejectSuccess'))
      reload()
    },
  })
}

function handleDisable(record: OpenApp) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('openApp.confirmDisable'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      await disableOpenApp(record.id)
      message.success(t('openApp.disableSuccess'))
      reload()
    },
  })
}

function handleEnable(record: OpenApp) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('openApp.confirmEnable'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      await enableOpenApp(record.id)
      message.success(t('openApp.enableSuccess'))
      reload()
    },
  })
}

function handleRotate(record: OpenApp) {
  // 默认原地替换（版本号不变、旧密钥立即失效）；勾选后走平滑轮换（生成新版本、旧密钥保留宽限期）。
  const graceful = ref(false)
  Modal.confirm({
    title: t('common.warning'),
    content: () =>
      h('div', [
        h('p', { style: 'margin-bottom:12px' }, t('openApp.confirmRotate')),
        h(
          Checkbox,
          {
            checked: graceful.value,
            'onUpdate:checked': (v: boolean) => (graceful.value = v),
          },
          () => t('openApp.rotateGraceful'),
        ),
        h(
          'div',
          { style: 'margin-top:4px;margin-left:24px;font-size:12px;line-height:1.5;color:var(--color-text-tertiary,#999)' },
          t('openApp.rotateGracefulHint'),
        ),
      ]),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      const result = await rotateOpenAppSecret(record.id, graceful.value)
      message.success(t('openApp.rotateSuccess'))
      showSecret(result)
      reload()
    },
  })
}
</script>
