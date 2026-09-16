<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-form layout="inline" class="mb-4">
        <a-form-item :label="$t('notification.scope')">
          <a-select
            v-model:value="query.targetScope"
            allow-clear
            class="filter-select"
            :options="scopeOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('notification.status')">
          <a-select
            v-model:value="query.status"
            allow-clear
            class="filter-select"
            :options="statusOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('common.keyword')">
          <a-input v-model:value="query.keyword" allow-clear @press-enter="reload" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="reload">{{ $t('common.search') }}</a-button>
            <a-button @click="openPublish">{{ $t('notification.publish') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'targetScope'">
            <a-tag :color="record.targetScope === 'ALL' ? 'blue' : 'purple'">
              {{ scopeLabel(record.targetScope) }}
            </a-tag>
            <span v-if="record.targetUserId" class="form-hint">#{{ record.targetUserId }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record)">{{ statusLabel(record) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <!-- 已撤回的不再给撤回入口；后端幂等，但摆一个不会改变任何东西的按钮只会让人以为没生效 -->
            <a-popconfirm
              v-if="record.status !== STATUS_REVOKED"
              :title="$t('notification.revokeConfirm')"
              @confirm="handleRevoke(record)"
            >
              <a class="danger-link">{{ $t('notification.revoke') }}</a>
            </a-popconfirm>
            <span v-else class="form-hint">—</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="$t('notification.publish')"
      :confirm-loading="publishing"
      @ok="handlePublish"
    >
      <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical">
        <a-form-item :label="$t('notification.title')" name="title">
          <a-input v-model:value="form.title" />
        </a-form-item>
        <a-form-item :label="$t('notification.content')" name="content">
          <a-textarea v-model:value="form.content" :rows="5" />
        </a-form-item>
        <a-form-item :label="$t('notification.type')" name="notificationType">
          <a-select v-model:value="form.notificationType" :options="typeOptions" />
        </a-form-item>
        <a-form-item :label="$t('notification.scope')" name="targetScope">
          <a-select v-model:value="form.targetScope" :options="scopeOptions" />
        </a-form-item>
        <a-form-item
          v-if="form.targetScope === 'USER'"
          :label="$t('notification.targetUserId')"
          name="targetUserId"
        >
          <a-input-number v-model:value="form.targetUserId" :min="1" class="w-full" />
        </a-form-item>
        <a-form-item :label="$t('notification.publishTime')">
          <a-date-picker
            v-model:value="form.publishTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="w-full"
          />
          <div class="form-hint">{{ $t('notification.publishTimeDesc') }}</div>
        </a-form-item>
        <a-form-item :label="$t('notification.expireTime')">
          <a-date-picker
            v-model:value="form.expireTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="w-full"
          />
          <div class="form-hint">{{ $t('notification.expireTimeDesc') }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 站内通知发布与撤回。
 *
 * 发布口在管理端而不是用户端：creaft v1 把 publish 挂在用户端路由上、靠角色判断拦住，
 * 那等于在用户链上留了一个只有管理员能用的写入口。这里走 admin 链（独立 token + RBAC）。
 *
 * 列表口径与用户端**刻意不同**：这里能看到未到发布时间的排期稿和已撤回的历史，
 * 运营要据此判断「是不是已经发过了」—— 只看用户端列表会重复发一遍。
 */
import { ref, reactive, onMounted } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { getNotifications, publishNotification, revokeNotification } from '@/api/notification'
import type { AdminNotification, NotificationPublishParams } from '@/types/api'

const { t } = useI18n()

/** 后端只有两个状态：0-已撤回 1-已发布。「排期中」不是状态，而是 publishTime 还没到。 */
const STATUS_REVOKED = 0
const STATUS_PUBLISHED = 1

const list = ref<AdminNotification[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 10,
  targetScope: undefined as string | undefined,
  status: undefined as number | undefined,
  keyword: '',
})

const modalOpen = ref(false)
const publishing = ref(false)
// 与其它页一致：不引框架内部类型，避免 antdv-next 版本升级时类型路径漂移
const formRef = ref()
const form = reactive<NotificationPublishParams & { targetUserId: number | null }>({
  title: '',
  content: '',
  notificationType: 'SYSTEM',
  targetScope: 'ALL',
  targetUserId: null,
  publishTime: null,
  expireTime: null,
})

const formRules: Record<string, Array<Record<string, unknown>>> = {
  title: [{ required: true }],
  content: [{ required: true }],
  notificationType: [{ required: true }],
  targetScope: [{ required: true }],
}

const scopeOptions = [
  { value: 'ALL', label: t('notification.scopeAll') },
  { value: 'USER', label: t('notification.scopeUser') },
]

const typeOptions = [
  { value: 'SYSTEM', label: t('notification.typeSystem') },
  { value: 'ACTIVITY', label: t('notification.typeActivity') },
  { value: 'BILLING', label: t('notification.typeBilling') },
]

const statusOptions = [
  { value: STATUS_PUBLISHED, label: t('notification.statusPublished') },
  { value: STATUS_REVOKED, label: t('notification.statusRevoked') },
]

const columns = [
  { title: t('notification.title'), dataIndex: 'title', key: 'title', ellipsis: true },
  { title: t('notification.type'), dataIndex: 'notificationType', key: 'notificationType' },
  { title: t('notification.scope'), key: 'targetScope' },
  { title: t('notification.publishTime'), dataIndex: 'publishTime', key: 'publishTime' },
  { title: t('notification.expireTime'), dataIndex: 'expireTime', key: 'expireTime' },
  { title: t('notification.status'), key: 'status' },
  { title: t('common.action'), key: 'action', width: 100 },
]

const pagination = reactive({
  get current() {
    return query.page
  },
  get pageSize() {
    return query.pageSize
  },
  get total() {
    return total.value
  },
  showSizeChanger: true,
})

function scopeLabel(scope: string) {
  return scopeOptions.find((item) => item.value === scope)?.label ?? scope
}

/**
 * 「排期中」是从 publishTime 推出来的，不是一个独立状态。
 * 把它当状态显示会让运营以为能按它筛选，而后端的 status 参数里根本没有这个值。
 */
function statusLabel(record: AdminNotification) {
  if (record.status === STATUS_REVOKED) return t('notification.statusRevoked')
  if (record.publishTime && record.publishTime > nowIso()) return t('notification.statusScheduled')
  return t('notification.statusPublished')
}

function statusColor(record: AdminNotification) {
  if (record.status === STATUS_REVOKED) return 'default'
  if (record.publishTime && record.publishTime > nowIso()) return 'gold'
  return 'green'
}

/** 后端时间是 yyyy-MM-ddTHH:mm:ss 的本地时间字符串，同格式下字典序即时间序。 */
function nowIso() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  )
}

async function load() {
  loading.value = true
  try {
    const data = await getNotifications({ ...query })
    list.value = data.list
    total.value = data.total
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false
  }
}

function reload() {
  query.page = 1
  return load()
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  query.page = page.current ?? 1
  query.pageSize = page.pageSize ?? 10
  return load()
}

function openPublish() {
  Object.assign(form, {
    title: '',
    content: '',
    notificationType: 'SYSTEM',
    targetScope: 'ALL',
    targetUserId: null,
    publishTime: null,
    expireTime: null,
  })
  modalOpen.value = true
}

async function handlePublish() {
  await formRef.value?.validate()
  if (form.targetScope === 'USER' && !form.targetUserId) {
    message.error(t('notification.targetUserRequired'))
    return
  }
  publishing.value = true
  try {
    await publishNotification({
      ...form,
      // 全体公告不该带 targetUserId：后端按 scope 判断，但把一个无意义的用户号发过去，
      // 事后查审计时会分不清这条到底发给了谁
      targetUserId: form.targetScope === 'USER' ? form.targetUserId : null,
    })
    message.success(t('notification.publishSuccess'))
    modalOpen.value = false
    await reload()
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    publishing.value = false
  }
}

async function handleRevoke(record: AdminNotification) {
  await revokeNotification(record.id)
  message.success(t('notification.revokeSuccess'))
  await load()
}

onMounted(load)
</script>

<style scoped>
/* 这两个局部工具类沿用各设置页的写法；说明文字的 .form-hint 已提到 global.css，不要再在这里复制一份 */
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
.danger-link {
  color: #ff4d4f;
}
.filter-select {
  min-width: 140px;
}
</style>
