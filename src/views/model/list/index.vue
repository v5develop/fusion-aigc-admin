<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('model.noModelData')" />
      </template>
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

        <template v-if="column.key === 'operation'">
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
            v-model:value="formData.code"
            :placeholder="$t('model.modelCodePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item :label="$t('model.modelName')" required>
          <a-input
            v-model:value="formData.name"
            :placeholder="$t('model.modelNamePlaceholder')"
          />
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
        <a-form-item :label="$t('model.aiProvider')">
          <a-select
            v-model:value="formData.aiProviderId"
            :options="apiConfigOptions"
            :placeholder="$t('model.aiProviderPlaceholder')"
            allow-clear
          />
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
        <a-form-item :label="$t('model.maxConcurrency')">
          <a-input-number
            v-model:value="formData.maxConcurrency"
            :min="1"
            :precision="0"
            style="width: 200px"
          />
          <div class="form-hint">{{ $t('model.maxConcurrencyHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('model.generationTimeout')">
          <a-input-number
            v-model:value="formData.generationTimeoutSeconds"
            :min="1"
            :precision="0"
            style="width: 200px"
          />
          <div class="form-hint">{{ $t('model.generationTimeoutHint') }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getModelList, createModel, updateModel, deleteModel } from '@/api/model'
import { getAiProviderList } from '@/api/config'
import type { AIModel, AiProvider } from '@/types/api'

const { t } = useI18n()

const modelTypeMap: Record<number, string> = {
  1: t('model.modelTypes.chat'),
  2: t('model.modelTypes.image'),
  3: t('model.modelTypes.video'),
  4: t('model.modelTypes.tts'),
  5: t('model.modelTypes.stt'),
}

const modelTypeOptions = [
  { label: t('model.modelTypes.chat'), value: 1 },
  { label: t('model.modelTypes.image'), value: 2 },
  { label: t('model.modelTypes.video'), value: 3 },
  { label: t('model.modelTypes.tts'), value: 4 },
  { label: t('model.modelTypes.stt'), value: 5 },
]

const columns = [
  {
    title: t('model.modelCode'),
    dataIndex: 'code',
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('model.modelName'),
    dataIndex: 'name',
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('model.modelType'),
    dataIndex: 'modelType',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('model.modelTypes.chat'), value: 1 },
      { label: t('model.modelTypes.image'), value: 2 },
      { label: t('model.modelTypes.video'), value: 3 },
      { label: t('model.modelTypes.tts'), value: 4 },
      { label: t('model.modelTypes.stt'), value: 5 },
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
    dataIndex: 'operation',
    key: 'operation',
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

const tableRef = ref()
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  code: '',
  name: '',
  modelType: 2,
  description: '',
  aiProviderId: undefined as number | undefined,
  statusChecked: 1,
  maxConcurrency: undefined as number | undefined,
  generationTimeoutSeconds: undefined as number | undefined,
})

const apiConfigOptions = ref<{ label: string; value: number }[]>([])

async function loadApiConfigs() {
  try {
    const configs = await getAiProviderList()
    apiConfigOptions.value = configs
      .filter((c: AiProvider) => c.status === 1)
      .map((c: AiProvider) => ({ label: `${c.name} (${c.platform})`, value: c.id! }))
  } catch (e) {
    console.error('Failed to load API configs:', e)
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await getModelList({
    name: params.name as string | undefined,
    code: params.code as string | undefined,
    modelType: params.modelType as number | undefined,
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

function handleCreate() {
  isEdit.value = false
  editId.value = null
  formData.code = ''
  formData.name = ''
  formData.modelType = 2
  formData.description = ''
  formData.aiProviderId = undefined
  formData.statusChecked = 1
  formData.maxConcurrency = undefined
  formData.generationTimeoutSeconds = undefined
  modalVisible.value = true
}

function handleEdit(record: AIModel) {
  isEdit.value = true
  editId.value = record.id
  formData.code = record.code
  formData.name = record.name
  formData.modelType = record.modelType
  formData.description = record.description
  formData.aiProviderId = record.aiProviderId ?? record.apiConfigId
  formData.statusChecked = record.status
  formData.maxConcurrency = record.maxConcurrency ?? undefined
  formData.generationTimeoutSeconds = record.generationTimeoutSeconds ?? undefined
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.code) {
    message.error(t('model.modelCodeRequired'))
    return
  }
  if (!formData.name) {
    message.error(t('model.modelNameRequired'))
    return
  }

  submitLoading.value = true
  try {
    const data = {
      code: formData.code,
      name: formData.name,
      modelType: formData.modelType,
      description: formData.description,
      aiProviderId: formData.aiProviderId,
      status: formData.statusChecked,
      maxConcurrency: formData.maxConcurrency,
      generationTimeoutSeconds: formData.generationTimeoutSeconds,
    }

    if (isEdit.value && editId.value) {
      await updateModel(editId.value, data)
      message.success(t('model.updateSuccess'))
    } else {
      await createModel(data)
      message.success(t('model.createSuccess'))
    }
    modalVisible.value = false
    tableRef.value?.reload()
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

onMounted(() => {
  loadApiConfigs()
})
</script>
