<template>
  <div class="page-container">
    <a-card :title="$t('settingsAIProvider.title')">
      <template #extra>
        <a-button type="primary" @click="handleAdd">
          <PlusOutlined /> {{ $t('settingsAIProvider.addProvider') }}
        </a-button>
      </template>

      <a-table
        :columns="columns"
        :data-source="providerList"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('settingsAIProvider.noProviderData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'platform'">
            <a-tag color="blue">{{ platformMap[record.platform] || record.platform }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-switch
              :checked="record.status === 1"
              @change="(checked: boolean) => handleStatusChange(record, checked)"
            />
          </template>

          <template v-if="column.key === 'operation'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                {{ $t('common.edit') }}
              </a-button>
              <a-button type="link" size="small" @click="handleTest(record)">
                {{ $t('settingsAIProvider.testConnection') }}
              </a-button>
              <a-popconfirm
                :title="$t('settingsAIProvider.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>
                  {{ $t('common.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- Add/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('settingsAIProvider.editProvider') : $t('settingsAIProvider.addProvider')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="700px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('settingsAIProvider.name')" required>
          <a-input
            v-model:value="formData.name"
            :placeholder="$t('settingsAIProvider.namePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.type')" required>
          <a-select
            v-model:value="formData.platform"
            :placeholder="$t('settingsAIProvider.typePlaceholder')"
            :options="platformOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.baseUrl')">
          <a-input
            v-model:value="formData.apiUrl"
            :placeholder="$t('settingsAIProvider.baseUrlPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.apiKey')" required>
          <a-input-password
            v-model:value="formData.apiKey"
            :placeholder="$t('settingsAIProvider.apiKeyPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import {
  getAiProviderPage,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  testAiProviderConnection,
} from '@/api/config'
import type { AiProvider } from '@/types/api'

const { t } = useI18n()

const loading = ref(false)
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const providerList = ref<AiProvider[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showTotal: (total: number) => `共 ${total} 条`,
})

const platformMap: Record<string, string> = {
  openai: 'OpenAI',
  openai_compatible: 'OpenAI Compatible',
  anthropic: 'Anthropic',
  dashscope: 'DashScope',
  ollama: 'Ollama',
  gemini: 'Gemini',
  vertex_ai: 'Vertex AI',
  volcengine: 'Volcengine',
  GoogleFlowReverseApi: 'Google Flow Reverse Api',
  custom: t('settingsAIProvider.custom'),
}

const platformOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'OpenAI Compatible', value: 'openai_compatible' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'DashScope', value: 'dashscope' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Vertex AI', value: 'vertex_ai' },
  { label: 'Volcengine', value: 'volcengine' },
  { label: 'Google Flow Reverse Api', value: 'GoogleFlowReverseApi' },
  { label: t('settingsAIProvider.custom'), value: 'custom' },
]

const columns = [
  {
    title: t('settingsAIProvider.name'),
    dataIndex: 'name',
    width: 180,
  },
  {
    title: t('settingsAIProvider.type'),
    dataIndex: 'platform',
    width: 150,
  },
  {
    title: t('settingsAIProvider.baseUrl'),
    dataIndex: 'apiUrl',
    ellipsis: true,
  },
  {
    title: t('settingsAIProvider.enabled'),
    dataIndex: 'status',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    key: 'operation',
    width: 200,
    align: 'center' as const,
  },
]

const formData = reactive({
  name: '',
  platform: 'openai',
  apiUrl: '',
  apiKey: '',
})

async function loadProviders() {
  loading.value = true
  try {
    const res = await getAiProviderPage({
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
    })
    providerList.value = res.list || []
    pagination.total = res.total || 0
  } catch {
    providerList.value = []
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: { current?: number; pageSize?: number }) {
  if (pag.current) pagination.current = pag.current
  if (pag.pageSize) pagination.pageSize = pag.pageSize
  loadProviders()
}

function handleAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(formData, {
    name: '',
    platform: 'openai',
    apiUrl: '',
    apiKey: '',
  })
  modalVisible.value = true
}

function handleEdit(record: AiProvider) {
  isEdit.value = true
  editId.value = record.id ?? null
  Object.assign(formData, {
    name: record.name,
    platform: record.platform,
    apiUrl: record.apiUrl ?? '',
    apiKey: '', // 安全原因不回显
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.name) {
    message.error(t('settingsAIProvider.nameRequired'))
    return
  }
  if (!formData.apiKey && !isEdit.value) {
    message.error(t('settingsAIProvider.apiKeyRequired'))
    return
  }

  submitLoading.value = true
  try {
    if (isEdit.value && editId.value) {
      const data: Partial<AiProvider> = {
        name: formData.name,
        platform: formData.platform,
        apiUrl: formData.apiUrl || undefined,
      }
      if (formData.apiKey) {
        data.apiKey = formData.apiKey
      }
      await updateAiProvider(editId.value, data)
      message.success(t('settingsAIProvider.updateSuccess'))
    } else {
      await createAiProvider({
        name: formData.name,
        platform: formData.platform,
        apiUrl: formData.apiUrl || undefined,
        apiKey: formData.apiKey,
        status: 1,
      })
      message.success(t('settingsAIProvider.createSuccess'))
    }
    modalVisible.value = false
    loadProviders()
  } catch {
    // Error handled by interceptor
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(record: AiProvider) {
  try {
    await deleteAiProvider(record.id!)
    message.success(t('settingsAIProvider.deleteSuccess'))
    loadProviders()
  } catch {
    // Error handled by interceptor
  }
}

async function handleStatusChange(record: AiProvider, checked: boolean) {
  try {
    await updateAiProvider(record.id!, { status: checked ? 1 : 0 })
    record.status = checked ? 1 : 0
  } catch {
    record.status = record.status === 1 ? 0 : 1
  }
}

async function handleTest(record: AiProvider) {
  try {
    await testAiProviderConnection(record)
    message.success(t('settingsAIProvider.testConnectionSuccess'))
  } catch {
    message.error(t('settingsAIProvider.testConnectionFailed'))
  }
}

onMounted(() => {
  loadProviders()
})
</script>
