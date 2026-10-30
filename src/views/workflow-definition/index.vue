<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('workflowDefinition.list') }}</h2>
      <a-space>
        <a-button :loading="loading" @click="load">{{ $t('common.refresh') }}</a-button>
        <a-button v-permission="'mode:create'" type="primary" @click="openCreate">
          {{ $t('workflowDefinition.create') }}
        </a-button>
      </a-space>
    </div>

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="small"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'code'">
            <code>{{ record.code }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.currentVersion ? 'green' : 'default'">
              {{ statusText(record) }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'currentVersion'">
            {{
              record.currentVersion
                ? $t('workflowDefinition.versionItem', { version: record.currentVersion })
                : $t('workflowDefinition.noVersion')
            }}
          </template>
          <template v-else-if="column.dataIndex === 'updateTime'">
            {{ record.updateTime ? formatDateTime(record.updateTime) : '-' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">
              {{ $t('workflowDefinition.open') }}
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="createOpen"
      :title="$t('workflowDefinition.create')"
      :confirm-loading="creating"
      @ok="submitCreate"
    >
      <a-form ref="formRef" :model="form" layout="vertical">
        <a-form-item
          :label="$t('workflowDefinition.code')"
          name="code"
          :rules="[{ required: true, message: $t('workflowDefinition.codeRequired') }]"
          :extra="$t('workflowDefinition.codeHint')"
        >
          <a-input v-model:value="form.code" />
        </a-form-item>
        <a-form-item
          :label="$t('workflowDefinition.name')"
          name="name"
          :rules="[{ required: true, message: $t('workflowDefinition.nameRequired') }]"
        >
          <a-input v-model:value="form.name" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  type WorkflowDefinitionItem,
} from '@/api/workflow-definition';
import { formatDateTime } from '@/utils/helpers';

const { t } = useI18n();
const router = useRouter();

const rows = ref<WorkflowDefinitionItem[]>([]);
const loading = ref(false);

const columns = computed(() => [
  { title: t('workflowDefinition.code'), dataIndex: 'code' },
  { title: t('workflowDefinition.name'), dataIndex: 'name' },
  { title: t('workflowDefinition.status'), dataIndex: 'status', width: 120 },
  { title: t('workflowDefinition.currentVersion'), dataIndex: 'currentVersion', width: 120 },
  { title: t('workflowDefinition.updateTime'), dataIndex: 'updateTime', width: 180 },
  { title: '', key: 'action', width: 100 },
]);

// 后端状态为 DRAFT / ENABLED / DISABLED；是否已发布以 currentVersion 为准
function statusText(row: { currentVersion?: number | null; status?: string }) {
  if (row.currentVersion) return t('workflowDefinition.statusPublished');
  if (!row.status) return '-';
  if (row.status.toUpperCase() === 'DRAFT') return t('workflowDefinition.statusDraft');
  return t('workflowDefinition.statusOther', { status: row.status });
}

// 服务端分页：后端返回 PageResult { list, total }
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true });

async function load() {
  loading.value = true;
  try {
    const page = await listWorkflowDefinitions(pagination.current, pagination.pageSize);
    rows.value = page.list;
    pagination.total = page.total;
  } finally {
    loading.value = false;
  }
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  pagination.current = p.current ?? 1;
  pagination.pageSize = p.pageSize ?? pagination.pageSize;
  load();
}

function openDetail(record: WorkflowDefinitionItem) {
  router.push(`/workflow/definitions/${record.id}`);
}

const createOpen = ref(false);
const creating = ref(false);
const formRef = ref();
const form = reactive({ code: '', name: '' });

function openCreate() {
  form.code = '';
  form.name = '';
  createOpen.value = true;
}

async function submitCreate() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  creating.value = true;
  try {
    const id = await createWorkflowDefinition({ code: form.code.trim(), name: form.name.trim() });
    message.success(t('workflowDefinition.created'));
    createOpen.value = false;
    if (id !== undefined && id !== null && id !== '') {
      router.push(`/workflow/definitions/${id}`);
    } else {
      await load();
    }
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>
