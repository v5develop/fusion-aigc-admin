<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('entryRoute.title') }}</h2>
      <a-button v-permission="'display_asset:create'" type="primary" @click="openCreate">
        {{ $t('entryRoute.add') }}
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('entryRoute.hint')"
    />

    <a-alert
      v-if="missingRoutes.length"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('entryRoute.missingHint', { list: missingRoutes.join('、') })"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="platformFilter"
          :options="platformFilterOptions"
          style="width: 160px"
          @change="loadList"
        />
        <a-select
          v-model:value="entryFilter"
          :options="entryOptions"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 240px"
          :placeholder="$t('entryRoute.filterEntry')"
          @change="loadList"
        />
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('entryRoute.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'entryCode'">
            <div>{{ entryName(record.entryCode) }}</div>
            <span class="muted">{{ record.entryCode }}</span>
          </template>

          <template v-if="column.dataIndex === 'platform'">
            <a-tag :color="record.platform === 'APP' ? 'blue' : 'green'">
              {{ record.platform === 'APP' ? 'APP' : 'PC' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'route'">
            <code class="route-code">{{ record.route }}</code>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? $t('entryRoute.enabled') : $t('entryRoute.disabled') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'display_asset:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <a-popconfirm
                v-permission="'display_asset:delete'"
                :title="$t('entryRoute.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? $t('entryRoute.editTitle') : $t('entryRoute.add')"
      :confirm-loading="saving"
      width="560px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('entryRoute.entryCode')" required>
          <a-select
            v-model:value="form.entryCode"
            :options="entryOptions"
            show-search
            option-filter-prop="label"
            :placeholder="$t('entryRoute.filterEntry')"
          />
        </a-form-item>
        <a-form-item :label="$t('entryRoute.platform')" required>
          <a-radio-group v-model:value="form.platform" button-style="solid">
            <a-radio-button value="APP">APP</a-radio-button>
            <a-radio-button value="PC">PC</a-radio-button>
          </a-radio-group>
          <div class="muted">{{ $t('entryRoute.platformHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('entryRoute.route')" required>
          <a-input
            v-model:value="form.route"
            :placeholder="
              form.platform === 'APP'
                ? $t('entryRoute.routePlaceholderApp')
                : $t('entryRoute.routePlaceholderPc')
            "
          />
        </a-form-item>
        <a-form-item :label="$t('entryRoute.remark')">
          <a-input v-model:value="form.remark" />
        </a-form-item>
        <a-form-item :label="$t('entryRoute.status')">
          <a-switch
            v-model:checked="enabled"
            :checked-children="$t('entryRoute.enabled')"
            :un-checked-children="$t('entryRoute.disabled')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getEntryRoutes,
  createEntryRoute,
  updateEntryRoute,
  deleteEntryRoute,
  type CreationEntryRoute,
  type RoutePlatform,
} from '@/api/entry-route'
import { getDisplayEntryCodes } from '@/api/display-asset'

const { t } = useI18n()

const rows = ref<CreationEntryRoute[]>([])
const loading = ref(false)
const platformFilter = ref<'' | RoutePlatform>('')
const entryFilter = ref<string | undefined>(undefined)

const platformFilterOptions = computed(() => [
  { label: t('entryRoute.platformAll'), value: '' },
  { label: 'APP', value: 'APP' },
  { label: 'PC', value: 'PC' },
])

// ---- 创作入口下拉 ----
const entryOptions = ref<{ label: string; value: string }[]>([])
const entryNameMap = reactive<Record<string, string>>({})
async function loadEntryCodes() {
  try {
    const res = (await getDisplayEntryCodes()) || []
    entryOptions.value = res.map((e) => {
      entryNameMap[e.entryCode] = e.entryName
      return { label: `${e.entryName} (${e.entryCode})`, value: e.entryCode }
    })
  } catch {
    /* 拦截器已提示 */
  }
}
loadEntryCodes()

function entryName(code: string) {
  return entryNameMap[code] || code
}

/**
 * 漏配提醒：列出还没配任何端路由的创作入口。
 * 漏配不会让做同款不可用（前端回退通用创作页），正因如此没人会主动发现，得在这里点出来。
 */
const missingRoutes = computed(() => {
  if (!entryOptions.value.length) return []
  const configured = new Set(rows.value.map((r) => r.entryCode))
  return entryOptions.value
    .filter((o) => !configured.has(o.value))
    .map((o) => entryNameMap[o.value] || o.value)
})

const columns = computed(() => [
  { title: t('entryRoute.entryCode'), dataIndex: 'entryCode', width: 220 },
  { title: t('entryRoute.platform'), dataIndex: 'platform', width: 100, align: 'center' as const },
  { title: t('entryRoute.route'), dataIndex: 'route', ellipsis: true },
  { title: t('entryRoute.remark'), dataIndex: 'remark', width: 180, ellipsis: true },
  { title: t('entryRoute.status'), dataIndex: 'status', width: 100, align: 'center' as const },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 140,
    align: 'center' as const,
  },
])

async function loadList() {
  loading.value = true
  try {
    rows.value =
      (await getEntryRoutes({
        entryCode: entryFilter.value,
        platform: platformFilter.value || undefined,
      })) || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
loadList()

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)

const form = reactive({
  entryCode: undefined as string | undefined,
  platform: 'APP' as RoutePlatform,
  route: '',
  remark: '',
  status: 1,
})
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

function openCreate() {
  editId.value = null
  Object.assign(form, {
    entryCode: undefined,
    platform: 'APP' as RoutePlatform,
    route: '',
    remark: '',
    status: 1,
  })
  modalVisible.value = true
}

function openEdit(record: CreationEntryRoute) {
  editId.value = record.id
  Object.assign(form, {
    entryCode: record.entryCode,
    platform: record.platform,
    route: record.route,
    remark: record.remark || '',
    status: record.status,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.entryCode) {
    message.warning(t('entryRoute.entryRequired'))
    return
  }
  if (!form.route?.trim()) {
    message.warning(t('entryRoute.routeRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      entryCode: form.entryCode,
      platform: form.platform,
      route: form.route.trim(),
      remark: form.remark,
      status: form.status,
    }
    if (editId.value) await updateEntryRoute(editId.value, payload)
    else await createEntryRoute(payload)
    message.success(t('common.saveSuccess'))
    modalVisible.value = false
    loadList()
  } catch {
    /* 同入口同端重复配置由后端拒绝，原因由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: CreationEntryRoute) {
  try {
    await deleteEntryRoute(record.id)
    message.success(t('common.deleteSuccess'))
    loadList()
  } catch {
    /* 拦截器已提示 */
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary, #f5f5f5);
  color: var(--text-color, #262626);
  font-size: 12px;
}
</style>
