<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('admin.resource.noResourceData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          {{ $t('admin.resource.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'resourceName'">
          {{ getResourceName(record) }}
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
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
      v-model:open="resourceModalVisible"
      :title="isEdit ? $t('admin.resource.edit') : $t('admin.resource.create')"
      :confirm-loading="resourceSubmitLoading"
      @ok="handleResourceSubmit"
      width="500px"
    >
      <a-form :model="resourceForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('admin.resource.resourceCode')" v-if="!isEdit">
          <a-input
            v-model:value="resourceForm.resourceCode"
            :placeholder="$t('admin.resource.resourceCode')"
          />
        </a-form-item>
        <a-divider orientation="left">{{ $t('admin.resource.resourceName') }}</a-divider>
        <a-form-item
          v-for="lang in langConfigs"
          :key="lang.locale"
          :label="lang.label"
        >
          <a-input
            v-model:value="resourceForm.names[lang.locale]"
            :placeholder="lang.placeholder"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.resource.description')">
          <a-textarea
            v-model:value="resourceForm.description"
            :rows="3"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.resource.sort')">
          <a-input-number
            v-model:value="resourceForm.sort"
            :min="0"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="resourceForm.statusChecked"
            :checked-value="1"
            :un-checked-value="0"
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
  getAdminResourceList,
  createAdminResource,
  updateAdminResource,
  deleteAdminResource,
} from '@/api/admin-resource'

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
    title: t('admin.resource.resourceCode'),
    dataIndex: 'resourceCode',
    search: true,
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('admin.resource.resourceName'),
    dataIndex: 'resourceName',
    width: 200,
  },
  {
    title: t('admin.resource.description'),
    dataIndex: 'description',
    ellipsis: true,
  },
  {
    title: t('admin.resource.sort'),
    dataIndex: 'sort',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('model.status'),
    dataIndex: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 100,
    align: 'center' as const,
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
  const res = await getAdminResourceList({
    resourceCode: params.resourceCode as string | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function getResourceName(record: Record<string, unknown>): string {
  const raw = record.resourceName as string
  try {
    const parsed = JSON.parse(raw)
    return parsed[locale.value] || parsed['zh-CN'] || parsed['en-US'] || raw
  } catch {
    return raw || ''
  }
}

const resourceModalVisible = ref(false)
const resourceSubmitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const resourceForm = reactive({
  resourceCode: '',
  names: {} as Record<string, string>,
  description: '',
  sort: 0,
  statusChecked: 1,
})

function parseResourceName(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function buildResourceName(): string {
  return JSON.stringify(resourceForm.names)
}

function resetForm() {
  resourceForm.resourceCode = ''
  resourceForm.names = {}
  resourceForm.description = ''
  resourceForm.sort = 0
  resourceForm.statusChecked = 1
}

function handleCreate() {
  isEdit.value = false
  editId.value = null
  resetForm()
  resourceModalVisible.value = true
}

function handleEdit(record: Record<string, unknown>) {
  isEdit.value = true
  editId.value = record.id as number
  resourceForm.resourceCode = record.resourceCode as string
  resourceForm.names = parseResourceName(record.resourceName as string)
  resourceForm.description = (record.description as string) || ''
  resourceForm.sort = (record.sort as number) || 0
  resourceForm.statusChecked = record.status as number
  resourceModalVisible.value = true
}

async function handleResourceSubmit() {
  resourceSubmitLoading.value = true
  try {
    if (isEdit.value && editId.value) {
      await updateAdminResource(editId.value, {
        resourceName: buildResourceName(),
        description: resourceForm.description,
        sort: resourceForm.sort,
        status: resourceForm.statusChecked,
      })
      message.success(t('admin.resource.updateSuccess'))
    } else {
      await createAdminResource({
        resourceCode: resourceForm.resourceCode,
        resourceName: buildResourceName(),
        description: resourceForm.description,
        sort: resourceForm.sort,
        status: resourceForm.statusChecked,
      })
      message.success(t('admin.resource.createSuccess'))
    }
    resourceModalVisible.value = false
  } catch (error) {
    console.error('Failed to save resource:', error)
  } finally {
    resourceSubmitLoading.value = false
  }
}

function handleDelete(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('admin.resource.delete'),
    content: t('admin.resource.confirmDelete'),
    onOk: async () => {
      try {
        await deleteAdminResource(record.id as number)
        message.success(t('admin.resource.deleteSuccess'))
      } catch (error) {
        console.error('Failed to delete resource:', error)
      }
    },
  })
}
</script>
