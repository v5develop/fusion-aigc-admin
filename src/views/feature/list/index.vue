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
        <a-empty :description="$t('feature.noFeatureData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('feature.createFeature') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'featureName'">
          {{ record.featureName?.[currentLocale] || record.featureName?.['zh-CN'] || '-' }}
        </template>

        <template v-if="column.dataIndex === 'description'">
          {{ record.description?.[currentLocale] || record.description?.['zh-CN'] || '-' }}
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'actionType'">
          <a-tag>{{ actionTypeMap[record.actionType] || record.actionType || '-' }}</a-tag>
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
      :title="isEdit ? $t('feature.editFeature') : $t('feature.createFeature')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('feature.featureCode')" required>
          <a-input
            v-model:value="formData.featureCode"
            :placeholder="$t('feature.featureCodePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.featureName')" required>
          <I18nInput
            v-model:value="featureName"
            :placeholder="$t('feature.featureNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.description')">
          <I18nInput
            v-model:value="description"
            :placeholder="$t('feature.descriptionPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.actionType')" required>
          <a-select v-model:value="formData.actionType" :options="actionTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('feature.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :un-checked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { Feature } from '@/types/api';

import { PlusOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, reactive, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

import { getFeatureList, createFeature, updateFeature, deleteFeature } from '@/api/feature';
import I18nInput from '@/components/I18nInput/index.vue';
import ProTable from '@/components/Pro/ProTable/index.vue';
import { getLocale } from '@/locales';

const { t } = useI18n();
const currentLocale = computed(() => getLocale());

const actionTypeOptions = [
  { label: t('pricing.actionTypeImage'), value: 'IMAGE_GEN' },
  { label: t('pricing.actionTypeVideo'), value: 'VIDEO_GEN' },
  { label: t('pricing.actionTypeText'), value: 'TEXT_CHAT' },
  { label: t('pricing.actionTypeTool'), value: 'AI_TOOL' },
];

const actionTypeMap: Record<string, string> = {
  IMAGE_GEN: t('pricing.actionTypeImage'),
  VIDEO_GEN: t('pricing.actionTypeVideo'),
  TEXT_CHAT: t('pricing.actionTypeText'),
  AI_TOOL: t('pricing.actionTypeTool'),
};

const columns = [
  {
    title: t('feature.featureCode'),
    dataIndex: 'featureCode',
    search: true,
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('feature.featureName'),
    dataIndex: 'featureName',
    search: true,
    searchType: 'input' as const,
    width: 200,
  },
  {
    title: t('feature.description'),
    dataIndex: 'description',
    ellipsis: true,
  },
  {
    title: t('feature.actionType'),
    dataIndex: 'actionType',
    search: true,
    searchType: 'select' as const,
    searchOptions: actionTypeOptions,
    width: 120,
  },
  {
    title: t('feature.modelCount'),
    dataIndex: 'modelCount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('feature.status'),
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
];

const modalVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const tableRef = ref();

const featureName = ref<Record<string, string>>({
  'zh-CN': '',
  'en-US': '',
  'ja-JP': '',
  'ko-KR': '',
});
const description = ref<Record<string, string>>({
  'zh-CN': '',
  'en-US': '',
  'ja-JP': '',
  'ko-KR': '',
});

const formData = reactive({
  featureCode: '',
  actionType: 'IMAGE_GEN',
  statusChecked: 1,
});

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureList({
    featureCode: params.featureCode as string | undefined,
    featureName: params.featureName as string | undefined,
    actionType: params.actionType as string | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

function handleCreate() {
  isEdit.value = false;
  editId.value = null;
  formData.featureCode = '';
  featureName.value = { 'zh-CN': '', 'en-US': '', 'ja-JP': '', 'ko-KR': '' };
  description.value = { 'zh-CN': '', 'en-US': '', 'ja-JP': '', 'ko-KR': '' };
  formData.actionType = 'IMAGE_GEN';
  formData.statusChecked = 1;
  modalVisible.value = true;
}

function handleEdit(record: Feature) {
  isEdit.value = true;
  editId.value = record.id;
  formData.featureCode = record.featureCode;
  featureName.value = { ...(record.featureName || {}) };
  description.value = { ...(record.description || {}) };
  formData.actionType = record.actionType || 'IMAGE_GEN';
  formData.statusChecked = record.status;
  modalVisible.value = true;
}

async function handleSubmit() {
  await nextTick(); // 确保 I18nInput 的值已同步

  if (!formData.featureCode) {
    message.error(t('feature.featureCodeRequired'));
    return;
  }
  if (!featureName.value || !Object.values(featureName.value).some((v) => v)) {
    message.error(t('feature.featureNameRequired'));
    return;
  }

  submitLoading.value = true;
  try {
    const data = {
      featureCode: formData.featureCode,
      featureName: featureName.value,
      description: description.value,
      actionType: formData.actionType,
      status: formData.statusChecked,
    };

    if (isEdit.value && editId.value) {
      await updateFeature(editId.value, data);
      message.success(t('feature.updateSuccess'));
    } else {
      await createFeature(data);
      message.success(t('feature.createSuccess'));
    }
    modalVisible.value = false;
    tableRef.value?.reload();
  } catch (error) {
    console.error('Failed to save feature:', error);
  } finally {
    submitLoading.value = false;
  }
}

function handleDelete(record: Feature) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('feature.confirmDeleteFeature'),
    onOk: async () => {
      await deleteFeature(record.id);
      message.success(t('feature.deleteSuccess'));
      tableRef.value?.reload();
    },
  });
}
</script>
