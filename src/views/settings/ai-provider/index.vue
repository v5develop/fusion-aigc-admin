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
        :pagination="false"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('settingsAIProvider.noProviderData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'type'">
            <a-tag color="blue">{{ typeMap[record.type] || record.type }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-switch
              v-model:checked="record.status"
              :checked-value="1"
              :unchecked-value="0"
              @change="handleStatusChange(record)"
            />
          </template>

          <template v-if="column.dataIndex === 'action'">
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
            v-model:value="formData.type"
            :placeholder="$t('settingsAIProvider.typePlaceholder')"
            :options="typeOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.baseUrl')">
          <a-input
            v-model:value="formData.baseUrl"
            :placeholder="$t('settingsAIProvider.baseUrlPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.apiKey')" required>
          <a-input-password
            v-model:value="formData.apiKey"
            :placeholder="$t('settingsAIProvider.apiKeyPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.model')">
          <a-input
            v-model:value="formData.model"
            :placeholder="$t('settingsAIProvider.modelPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.maxTokens')">
          <a-input-number
            v-model:value="formData.maxTokens"
            :min="1"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.temperature')">
          <a-input-number
            v-model:value="formData.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.timeout')">
          <a-input-number
            v-model:value="formData.timeout"
            :min="1000"
            :step="1000"
            style="width: 100%"
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
import { getAIProviderConfig, saveAIProviderConfig, testAIProviderConnection } from '@/api/config'

const { t } = useI18n()

const loading = ref(false)
const modalVisible = ref(false)
const submitLoading = ref(false)
const testing = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const providerList = ref<any[]>([])

const typeMap: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  dashscope: 'DashScope',
  ollama: 'Ollama',
  gemini: 'Gemini',
  custom: t('settingsAIProvider.custom'),
}

const typeOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'DashScope', value: 'dashscope' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'Gemini', value: 'gemini' },
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
    dataIndex: 'type',
    width: 120,
  },
  {
    title: t('settingsAIProvider.baseUrl'),
    dataIndex: 'baseUrl',
    ellipsis: true,
  },
  {
    title: t('settingsAIProvider.model'),
    dataIndex: 'model',
    width: 150,
  },
  {
    title: t('settingsAIProvider.enabled'),
    dataIndex: 'status',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 200,
    align: 'center' as const,
  },
]

const formData = reactive({
  name: '',
  type: 'openai',
  baseUrl: '',
  apiKey: '',
  model: '',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 30000,
})

async function loadProviders() {
  loading.value = true
  try {
    const res = await getAIProviderConfig() as Record<string, unknown>
    providerList.value = (res.providers as Array<Record<string, unknown>>) || res || []
  } catch {
    providerList.value = []
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(formData, {
    name: '',
    type: 'openai',
    baseUrl: '',
    apiKey: '',
    model: '',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 30000,
  })
  modalVisible.value = true
}

function handleEdit(record: any) {
  isEdit.value = true
  editId.value = record.id
  Object.assign(formData, record)
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.name) {
    message.error(t('settingsAIProvider.nameRequired'))
    return
  }
  if (!formData.apiKey) {
    message.error(t('settingsAIProvider.apiKeyRequired'))
    return
  }

  submitLoading.value = true
  try {
    await saveAIProviderConfig({
      id: editId.value,
      ...formData,
    })
    message.success(isEdit.value ? t('settingsAIProvider.updateSuccess') : t('settingsAIProvider.createSuccess'))
    modalVisible.value = false
    loadProviders()
  } catch {
    // Error handled by interceptor
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(record: any) {
  try {
    await saveAIProviderConfig({ id: record.id, action: 'delete' })
    message.success(t('settingsAIProvider.deleteSuccess'))
    loadProviders()
  } catch {
    // Error handled by interceptor
  }
}

async function handleStatusChange(record: any) {
  try {
    await saveAIProviderConfig({
      id: record.id,
      status: record.status,
    })
  } catch {
    record.status = record.status === 1 ? 0 : 1
  }
}

async function handleTest(record: any) {
  testing.value = true
  try {
    await testAIProviderConnection(record)
    message.success(t('settingsAIProvider.testConnectionSuccess'))
  } catch (error) {
    console.error('Test connection failed:', error)
    message.error(t('settingsAIProvider.testConnectionFailed'))
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadProviders()
})
</script>
