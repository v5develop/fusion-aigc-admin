<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('model.createModel') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'modelType'">
          <a-tag>{{ modelTypeMap[record.modelType] || record.modelType }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'action'">
          <a-space>
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
      v-model:open="modalVisible"
      :title="isEdit ? $t('model.editModel') : $t('model.createModel')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('model.modelCode')" required>
          <a-input
            v-model:value="formData.modelCode"
            :placeholder="$t('model.modelCodePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item :label="$t('model.modelName')" required>
          <a-input
            v-model:value="formData.modelName"
            :placeholder="$t('model.modelNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('model.provider')" required>
          <a-input v-model:value="formData.provider" />
        </a-form-item>
        <a-form-item :label="$t('model.modelType')" required>
          <a-select v-model:value="formData.modelType" :options="modelTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('model.description')">
          <a-textarea
            v-model:value="formData.description"
            :placeholder="$t('model.descriptionPlaceholder')"
            :rows="3"
          />
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getModelList, createModel, updateModel, deleteModel } from '@/api/model'
import type { AIModel } from '@/types/api'

const { t } = useI18n()

const modelTypeMap: Record<string, string> = {
  image: t('model.modelTypes.image'),
  video: t('model.modelTypes.video'),
  audio: t('model.modelTypes.audio'),
  text: t('model.modelTypes.text'),
}

const modelTypeOptions = [
  { label: t('model.modelTypes.image'), value: 'image' },
  { label: t('model.modelTypes.video'), value: 'video' },
  { label: t('model.modelTypes.audio'), value: 'audio' },
  { label: t('model.modelTypes.text'), value: 'text' },
]

const columns = [
  {
    title: t('model.modelCode'),
    dataIndex: 'modelCode',
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('model.modelName'),
    dataIndex: 'modelName',
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('model.provider'),
    dataIndex: 'provider',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('model.modelType'),
    dataIndex: 'modelType',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('model.modelTypes.image'), value: 'image' },
      { label: t('model.modelTypes.video'), value: 'video' },
      { label: t('model.modelTypes.audio'), value: 'audio' },
      { label: t('model.modelTypes.text'), value: 'text' },
    ],
    width: 120,
  },
  {
    title: t('model.status'),
    dataIndex: 'status',
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
    dataIndex: 'action',
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  modelCode: '',
  modelName: '',
  provider: '',
  modelType: 'image',
  description: '',
  statusChecked: 1,
})

async function loadData(params: Record<string, unknown>) {
  const res = await getModelList({
    provider: params.provider as string | undefined,
    modelType: params.modelType as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.items || [],
    total: res.total || 0,
    success: true,
  }
}

function handleCreate() {
  isEdit.value = false
  editId.value = null
  formData.modelCode = ''
  formData.modelName = ''
  formData.provider = ''
  formData.modelType = 'image'
  formData.description = ''
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: AIModel) {
  isEdit.value = true
  editId.value = record.id
  formData.modelCode = record.modelCode
  formData.modelName = record.modelName
  formData.provider = record.provider
  formData.modelType = record.modelType
  formData.description = record.description
  formData.statusChecked = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.modelCode) {
    message.error(t('model.modelCodeRequired'))
    return
  }
  if (!formData.modelName) {
    message.error(t('model.modelNameRequired'))
    return
  }

  submitLoading.value = true
  try {
    const data = {
      modelCode: formData.modelCode,
      modelName: formData.modelName,
      provider: formData.provider,
      modelType: formData.modelType,
      description: formData.description,
      status: formData.statusChecked,
    }

    if (isEdit.value && editId.value) {
      await updateModel(editId.value, data)
      message.success(t('model.updateSuccess'))
    } else {
      await createModel(data)
      message.success(t('model.createSuccess'))
    }
    modalVisible.value = false
  } catch (error) {
    console.error('Failed to save model:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleDelete(record: AIModel) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('model.confirmDeleteModel'),
    onOk: async () => {
      await deleteModel(record.id)
      message.success(t('model.deleteSuccess'))
    },
  })
}
</script>
