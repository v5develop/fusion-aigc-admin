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
        <a-empty :description="$t('actionType.noData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('actionType.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
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
            <a-popconfirm
              :title="$t('actionType.confirmDelete')"
              :ok-text="$t('common.confirm')"
              :cancel-text="$t('common.cancel')"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>
                {{ $t('common.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('actionType.edit') : $t('actionType.create')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }" ref="formRef">
        <a-form-item
          :label="$t('actionType.actionCode')"
          name="actionCode"
          :rules="[{ required: true, message: $t('actionType.actionCodeRequired') }]"
        >
          <a-input
            v-model:value="formData.actionCode"
            :placeholder="$t('actionType.actionCodePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item
          :label="$t('actionType.actionName')"
          name="actionName"
          :rules="[{ required: true, message: $t('actionType.actionNameRequired') }]"
        >
          <a-input
            v-model:value="formData.actionName"
            :placeholder="$t('actionType.actionNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('actionType.description')">
          <a-textarea
            v-model:value="formData.description"
            :placeholder="$t('actionType.descriptionPlaceholder')"
            :rows="3"
          />
        </a-form-item>
        <a-form-item :label="$t('actionType.sortOrder')">
          <a-input-number
            v-model:value="formData.sortOrder"
            :min="0"
            :placeholder="$t('actionType.sortOrderPlaceholder')"
            class="w-full"
          />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
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
import type { ActionType } from '@/types/api';

import { PlusOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getActionTypeList,
  createActionType,
  updateActionType,
  deleteActionType,
} from '@/api/action-type';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();

const columns = [
  {
    title: t('actionType.actionCode'),
    dataIndex: 'actionCode',
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('actionType.actionName'),
    dataIndex: 'actionName',
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('actionType.description'),
    dataIndex: 'description',
    width: 250,
    ellipsis: true,
  },
  {
    title: t('actionType.sortOrder'),
    dataIndex: 'sortOrder',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
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
];

const tableRef = ref();
const formRef = ref();
const modalVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);

const formData = reactive({
  actionCode: '',
  actionName: '',
  description: '',
  sortOrder: 0,
  statusChecked: 1,
});

async function loadData(params: Record<string, unknown>) {
  const res = await getActionTypeList({
    actionCode: params.actionCode as string | undefined,
    actionName: params.actionName as string | undefined,
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
  formData.actionCode = '';
  formData.actionName = '';
  formData.description = '';
  formData.sortOrder = 0;
  formData.statusChecked = 1;
  modalVisible.value = true;
}

function handleEdit(record: ActionType) {
  isEdit.value = true;
  editId.value = record.id;
  formData.actionCode = record.actionCode;
  formData.actionName = record.actionName;
  formData.description = record.description || '';
  formData.sortOrder = record.sortOrder ?? 0;
  formData.statusChecked = record.status;
  modalVisible.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields();
  } catch {
    return;
  }

  submitLoading.value = true;
  try {
    const data = {
      actionCode: formData.actionCode.trim(),
      actionName: formData.actionName.trim(),
      description: formData.description?.trim(),
      sortOrder: formData.sortOrder,
      status: formData.statusChecked,
    };

    if (isEdit.value && editId.value) {
      await updateActionType(editId.value, data);
      message.success(t('actionType.updateSuccess'));
    } else {
      await createActionType(data);
      message.success(t('actionType.createSuccess'));
    }
    modalVisible.value = false;
    tableRef.value?.reload();
  } catch (error) {
    console.error('Failed to save action type:', error);
  } finally {
    submitLoading.value = false;
  }
}

async function handleDelete(record: ActionType) {
  try {
    await deleteActionType(record.id);
    message.success(t('actionType.deleteSuccess'));
    tableRef.value?.reload();
  } catch (error) {
    console.error('Failed to delete action type:', error);
  }
}
</script>

<style scoped>
.w-full {
  width: 100%;
}
</style>
