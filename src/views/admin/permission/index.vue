<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('admin.permission.noPermissionData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          {{ $t('admin.permission.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'permissionName'">
          {{ getPermName(record) }}
        </template>

        <template v-if="column.key === 'operation'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="handleEdit(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-button type="link" size="small" danger @click="handleDelete(record)">
              {{ $t('common.delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:open="permModalVisible"
      :title="isEdit ? $t('admin.permission.edit') : $t('admin.permission.create')"
      :confirm-loading="permSubmitLoading"
      @ok="handlePermSubmit"
      width="600px"
    >
      <a-form :model="permForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('admin.permission.permissionCode')" v-if="!isEdit">
          <a-input
            v-model:value="permForm.permissionCode"
            :placeholder="$t('admin.permission.permissionCode')"
          />
        </a-form-item>
        <a-divider orientation="left">{{ $t('admin.permission.permissionName') }}</a-divider>
        <a-form-item
          v-for="lang in langConfigs"
          :key="lang.locale"
          :label="lang.label"
        >
          <a-input
            v-model:value="permForm.names[lang.locale]"
            :placeholder="lang.placeholder"
          />
        </a-form-item>
        <a-divider orientation="left">{{ $t('admin.permission.resource') }}</a-divider>
        <a-form-item :label="$t('admin.permission.resource')">
          <a-input
            v-model:value="permForm.resource"
            :placeholder="$t('admin.permission.resource')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.permission.action')">
          <a-input
            v-model:value="permForm.action"
            :placeholder="$t('admin.permission.action')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.permission.description')">
          <a-textarea
            v-model:value="permForm.description"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getAdminPermissionList,
  createAdminPermission,
  updateAdminPermission,
  deleteAdminPermission,
} from '@/api/admin-permission'

const { t, locale } = useI18n()

interface LangConfig {
  locale: string
  label: string
  placeholder: string
}

const langConfigs: LangConfig[] = [
  { locale: 'zh-CN', label: '中文', placeholder: '请输入中文名称' },
  { locale: 'en-US', label: 'English', placeholder: 'Please enter English name' },
  { locale: 'ja-JP', label: '日本語', placeholder: '日本語を入力してください' },
  { locale: 'ko-KR', label: '한국어', placeholder: '한국어를 입력하세요' },
]

const columns = [
  {
    title: t('admin.permission.permissionCode'),
    dataIndex: 'permissionCode',
    searchType: 'input' as const,
    width: 200,
  },
  {
    title: t('admin.permission.permissionName'),
    dataIndex: 'permissionName',
    width: 200,
  },
  {
    title: t('admin.permission.resource'),
    dataIndex: 'resource',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('admin.permission.action'),
    dataIndex: 'action',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('admin.permission.description'),
    dataIndex: 'description',
    ellipsis: true,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getAdminPermissionList({
    resource: params.resource as string | undefined,
    action: params.action as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function getPermName(record: Record<string, unknown>): string {
  const raw = record.permissionName as string
  try {
    const parsed = JSON.parse(raw)
    return parsed[locale.value] || parsed['zh-CN'] || parsed['en-US'] || raw
  } catch {
    return raw || ''
  }
}

const permModalVisible = ref(false)
const permSubmitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const permForm = reactive({
  permissionCode: '',
  names: {} as Record<string, string>,
  resource: '',
  action: '',
  description: '',
})

function parsePermName(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function buildPermName(): string {
  return JSON.stringify(permForm.names)
}

function resetForm() {
  permForm.permissionCode = ''
  permForm.names = {}
  permForm.resource = ''
  permForm.action = ''
  permForm.description = ''
}

function handleCreate() {
  isEdit.value = false
  editId.value = null
  resetForm()
  permModalVisible.value = true
}

function handleEdit(record: Record<string, unknown>) {
  isEdit.value = true
  editId.value = record.id as number
  permForm.permissionCode = record.permissionCode as string
  permForm.names = parsePermName(record.permissionName as string)
  permForm.resource = record.resource as string
  permForm.action = record.action as string
  permForm.description = (record.description as string) || ''
  permModalVisible.value = true
}

async function handlePermSubmit() {
  permSubmitLoading.value = true
  try {
    if (isEdit.value && editId.value) {
      await updateAdminPermission(editId.value, {
        permissionName: buildPermName(),
        resource: permForm.resource,
        action: permForm.action,
        description: permForm.description,
      })
      message.success(t('admin.permission.updateSuccess'))
    } else {
      await createAdminPermission({
        permissionCode: permForm.permissionCode,
        permissionName: buildPermName(),
        resource: permForm.resource,
        action: permForm.action,
        description: permForm.description,
      })
      message.success(t('admin.permission.createSuccess'))
    }
    permModalVisible.value = false
  } catch (error) {
    console.error('Failed to save permission:', error)
  } finally {
    permSubmitLoading.value = false
  }
}

function handleDelete(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('admin.permission.delete'),
    content: t('admin.permission.confirmDelete'),
    onOk: async () => {
      try {
        await deleteAdminPermission(record.id as number)
        message.success(t('admin.permission.deleteSuccess'))
      } catch (error) {
        console.error('Failed to delete permission:', error)
      }
    },
  })
}
</script>
