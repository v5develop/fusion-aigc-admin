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

          <template v-if="column.dataIndex === 'apiType'">
            <a-tag>{{ apiTypeMap[record.apiType] || record.apiType || '-' }}</a-tag>
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
        <a-form-item :label="$t('settingsAIProvider.apiType')">
          <a-select v-model:value="formData.apiType" :options="apiTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.baseUrl')">
          <a-input
            v-model:value="formData.apiUrl"
            :placeholder="$t('settingsAIProvider.baseUrlPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.autoAppendV1Path')">
          <a-switch v-model:checked="formData.autoAppendV1Path" />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.apiKey')" :required="!isEdit">
          <a-input-password
            v-model:value="formData.apiKey"
            :placeholder="
              isEdit
                ? $t('settingsAIProvider.secretUnchangedPlaceholder')
                : $t('settingsAIProvider.apiKeyPlaceholder')
            "
          />
        </a-form-item>
        <template v-if="showAppCredentialFields">
          <a-form-item :label="$t('settingsAIProvider.appId')">
            <a-input
              v-model:value="formData.appId"
              :placeholder="$t('settingsAIProvider.appIdPlaceholder')"
            />
          </a-form-item>
          <a-form-item :label="$t('settingsAIProvider.appSecret')">
            <a-input-password
              v-model:value="formData.appSecret"
              :placeholder="
                isEdit
                  ? $t('settingsAIProvider.secretUnchangedPlaceholder')
                  : $t('settingsAIProvider.appSecretPlaceholder')
              "
            />
          </a-form-item>
        </template>
        <a-form-item :label="$t('settingsAIProvider.modelIds')">
          <a-select
            v-model:value="formData.modelIds"
            mode="multiple"
            show-search
            allow-clear
            :options="modelOptions"
            :filter-option="filterModelOption"
            :placeholder="$t('settingsAIProvider.modelIdsPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.proxyType')">
          <a-select v-model:value="formData.proxyType" :options="proxyTypeOptions" />
        </a-form-item>
        <template v-if="formData.proxyType && formData.proxyType !== 'none'">
          <a-form-item :label="$t('settingsAIProvider.proxyHost')">
            <a-input v-model:value="formData.proxyHost" />
          </a-form-item>
          <a-form-item :label="$t('settingsAIProvider.proxyPort')">
            <a-input-number
              v-model:value="formData.proxyPort"
              style="width: 100%"
              :min="1"
              :max="65535"
            />
          </a-form-item>
          <a-form-item :label="$t('settingsAIProvider.proxyUsername')">
            <a-input v-model:value="formData.proxyUsername" />
          </a-form-item>
          <a-form-item :label="$t('settingsAIProvider.proxyPassword')">
            <a-input-password
              v-model:value="formData.proxyPassword"
              :placeholder="
                isEdit
                  ? $t('settingsAIProvider.secretUnchangedPlaceholder')
                  : $t('settingsAIProvider.proxyPasswordPlaceholder')
              "
            />
          </a-form-item>
        </template>
        <a-form-item :label="$t('settingsAIProvider.enabled')">
          <a-switch v-model:checked="formData.enabled" />
        </a-form-item>
        <a-form-item :label="$t('settingsAIProvider.remark')">
          <a-textarea v-model:value="formData.remark" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { AiProvider, AIModel } from '@/types/api';

import { PlusOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { computed, ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getAiProviderPage,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  testAiProviderConnection,
} from '@/api/config';
import { getModelOptions } from '@/api/model';

const { t } = useI18n();

const loading = ref(false);
const modalVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);

const providerList = ref<AiProvider[]>([]);
const modelList = ref<AIModel[]>([]);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showTotal: (total: number) => `共 ${total} 条`,
});

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
};

const platformDefaultBaseUrls: Record<string, string> = {
  openai: 'https://api.openai.com',
  openai_compatible: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  dashscope: 'https://dashscope.aliyuncs.com',
  ollama: 'http://localhost:11434',
  vertex_ai: 'us-central1',
  volcengine: 'https://ark.cn-beijing.volces.com',
  GoogleFlowReverseApi: 'http://localhost:8000',
};

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
];

const apiTypeMap: Record<number, string> = {
  1: t('settingsAIProvider.apiTypeText'),
  2: t('settingsAIProvider.apiTypeImage'),
  3: t('settingsAIProvider.apiTypeVideo'),
};

const apiTypeOptions = [
  { label: t('settingsAIProvider.apiTypeText'), value: 1 },
  { label: t('settingsAIProvider.apiTypeImage'), value: 2 },
  { label: t('settingsAIProvider.apiTypeVideo'), value: 3 },
];

const proxyTypeOptions = [
  { label: t('settingsAIProvider.proxyTypeNone'), value: 'none' },
  { label: 'HTTP', value: 'http' },
  { label: 'SOCKS5', value: 'socks5' },
];

const modelOptions = computed(() =>
  modelList.value.map((model) => ({
    label: `${model.name} (${model.code})`,
    value: model.id,
  })),
);

function filterModelOption(input: string, option?: { label?: string }) {
  return (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
}

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
    title: t('settingsAIProvider.apiType'),
    dataIndex: 'apiType',
    width: 120,
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
];

const formData = reactive({
  name: '',
  platform: 'openai',
  apiType: 1 as number | undefined,
  apiUrl: '',
  autoAppendV1Path: true,
  proxyType: 'none',
  proxyHost: '',
  proxyPort: undefined as number | undefined,
  proxyUsername: '',
  proxyPassword: '',
  apiKey: '',
  appId: '',
  appSecret: '',
  modelIds: [] as number[],
  enabled: true,
  remark: '',
});

const showAppCredentialFields = computed(() =>
  ['vertex_ai', 'GoogleFlowReverseApi', 'custom'].includes(formData.platform),
);

async function loadProviders() {
  loading.value = true;
  try {
    const res = await getAiProviderPage({
      page: pagination.current,
      pageSize: pagination.pageSize,
    });
    providerList.value = res.list || [];
    pagination.total = res.total || 0;
  } catch {
    providerList.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadModels() {
  try {
    modelList.value = await getModelOptions();
  } catch {
    modelList.value = [];
  }
}

function handleTableChange(pag: { current?: number; pageSize?: number }) {
  if (pag.current) pagination.current = pag.current;
  if (pag.pageSize) pagination.pageSize = pag.pageSize;
  loadProviders();
}

function handleAdd() {
  isEdit.value = false;
  editId.value = null;
  Object.assign(formData, {
    name: '',
    platform: 'openai',
    apiType: 1,
    apiUrl: '',
    autoAppendV1Path: true,
    proxyType: 'none',
    proxyHost: '',
    proxyPort: undefined,
    proxyUsername: '',
    proxyPassword: '',
    apiKey: '',
    appId: '',
    appSecret: '',
    modelIds: [],
    enabled: true,
    remark: '',
  });
  modalVisible.value = true;
}

function handleEdit(record: AiProvider) {
  isEdit.value = true;
  editId.value = record.id ?? null;
  Object.assign(formData, {
    name: record.name,
    platform: record.platform,
    apiType: record.apiType ?? 1,
    apiUrl: record.apiUrl ?? '',
    autoAppendV1Path: record.autoAppendV1Path ?? true,
    proxyType: record.proxyType ?? 'none',
    proxyHost: record.proxyHost ?? '',
    proxyPort: record.proxyPort,
    proxyUsername: record.proxyUsername ?? '',
    proxyPassword: '', // 安全原因不回显
    apiKey: '', // 安全原因不回显
    appId: record.appId ?? '',
    appSecret: '', // 安全原因不回显
    modelIds: record.modelIds ?? (record.modelId ? [record.modelId] : []),
    enabled: record.status !== 0,
    remark: record.remark ?? '',
  });
  modalVisible.value = true;
}

async function handleSubmit() {
  if (!formData.name) {
    message.error(t('settingsAIProvider.nameRequired'));
    return;
  }
  if (!formData.apiKey && !isEdit.value) {
    message.error(t('settingsAIProvider.apiKeyRequired'));
    return;
  }

  submitLoading.value = true;
  try {
    const data: Partial<AiProvider> = {
      name: formData.name,
      platform: formData.platform,
      apiType: formData.apiType,
      apiUrl: formData.apiUrl || undefined,
      autoAppendV1Path: formData.autoAppendV1Path,
      proxyType: formData.proxyType || 'none',
      proxyHost: formData.proxyHost || undefined,
      proxyPort: formData.proxyPort,
      proxyUsername: formData.proxyUsername || undefined,
      appId: showAppCredentialFields.value ? formData.appId || undefined : undefined,
      modelIds: formData.modelIds,
      status: formData.enabled ? 1 : 0,
      remark: formData.remark || undefined,
    };
    if (formData.apiKey) {
      data.apiKey = formData.apiKey;
    }
    if (showAppCredentialFields.value && formData.appSecret) {
      data.appSecret = formData.appSecret;
    }
    if (formData.proxyPassword) {
      data.proxyPassword = formData.proxyPassword;
    }

    if (isEdit.value && editId.value) {
      await updateAiProvider(editId.value, data);
      message.success(t('settingsAIProvider.updateSuccess'));
    } else {
      await createAiProvider(data);
      message.success(t('settingsAIProvider.createSuccess'));
    }
    modalVisible.value = false;
    loadProviders();
  } catch {
    // Error handled by interceptor
  } finally {
    submitLoading.value = false;
  }
}

async function handleDelete(record: AiProvider) {
  try {
    await deleteAiProvider(record.id!);
    message.success(t('settingsAIProvider.deleteSuccess'));
    loadProviders();
  } catch {
    // Error handled by interceptor
  }
}

async function handleStatusChange(record: AiProvider, checked: boolean) {
  try {
    await updateAiProvider(record.id!, { status: checked ? 1 : 0 });
    record.status = checked ? 1 : 0;
  } catch {
    record.status = record.status === 1 ? 0 : 1;
  }
}

async function handleTest(record: AiProvider) {
  try {
    await testAiProviderConnection({
      platform: record.platform,
      apiUrl: record.apiUrl || platformDefaultBaseUrls[record.platform],
    });
    message.success(t('settingsAIProvider.testConnectionSuccess'));
  } catch {
    message.error(t('settingsAIProvider.testConnectionFailed'));
  }
}

onMounted(() => {
  loadModels();
  loadProviders();
});
</script>
