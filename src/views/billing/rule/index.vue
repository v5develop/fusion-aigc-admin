<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" row-key="id">
      <template #toolbar>
        <a-button type="primary" @click="openModal(null)">
          <PlusOutlined /> {{ $t('billingRule.create') }}
        </a-button>
        <a-button style="margin-left: 8px" :loading="refreshing" @click="handleRefresh">
          <ReloadOutlined /> {{ $t('billingRule.refreshCache') }}
        </a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
        </template>
        <template v-if="column.dataIndex === 'effectValue'">
          <span :style="{ color: record.effectValue > 0 ? 'green' : 'red' }">
            {{
              record.effectType === 'MULTIPLY'
                ? record.effectValue + 'x'
                : record.effectType === 'DISCOUNT'
                  ? record.effectValue + '%'
                  : '+' + record.effectValue
            }}
          </span>
        </template>
        <template v-if="column.key === 'operation'">
          <a-space>
            <a-button type="link" size="small" @click="openModal(record)">{{
              $t('common.edit')
            }}</a-button>
            <a-popconfirm
              :title="$t('billingRule.confirmDelete')"
              @confirm="handleDelete(record.id)"
            >
              <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>

    <a-modal
      v-model:open="visible"
      :title="editing ? $t('common.edit') : $t('billingRule.create')"
      :confirm-loading="loading"
      @ok="handleSubmit"
    >
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Rule Code" required>
              <a-input v-model:value="form.ruleCode" :disabled="!!editing" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('billingRule.priority')">
              <a-input-number v-model:value="form.priority" :min="0" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.scopeType')" required>
              <a-select v-model:value="form.scopeType" :options="scopeTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.scopeCode')" required>
              <a-input v-model:value="form.scopeCode" placeholder="* = match all" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.factorKey')" required>
              <a-select v-model:value="form.factorKey" :options="factorKeyFormOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.operator')" required>
              <a-select v-model:value="form.operator" :options="operatorFormOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.matchValue')" required>
              <a-input v-model:value="form.matchValue" placeholder='"hd" or ["a","b"] or 3' />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.effectType')" required>
              <a-select v-model:value="form.effectType" :options="effectTypeFormOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.effectValue')" required>
              <a-input-number v-model:value="form.effectValue" :step="0.01" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingRule.status')">
              <a-select v-model:value="form.status" :options="ruleStatusFormOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('billingRule.remark')">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { ChargeRule } from '@/api/billing-rule';

import { PlusOutlined, ReloadOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getRuleList,
  createRule,
  updateRule,
  deleteRule,
  refreshRuleCache,
} from '@/api/billing-rule';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();
const tableRef = ref();
const loading = ref(false);
const refreshing = ref(false);

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'green',
  DISABLED: 'red',
  APPROVED: 'blue',
};

const columns = [
  { title: 'Rule Code', dataIndex: 'ruleCode', width: 180, searchType: 'input' as const },
  {
    title: t('billingRule.scopeType'),
    dataIndex: 'scopeType',
    width: 110,
    searchType: 'select' as const,
    searchOptions: ['OFFER', 'VARIANT', 'COMPONENT', 'MODEL', 'GLOBAL'].map((v) => ({
      label: v,
      value: v as string | number | boolean,
    })),
  },
  { title: t('billingRule.scopeCode'), dataIndex: 'scopeCode', width: 120 },
  {
    title: t('billingRule.factorKey'),
    dataIndex: 'factorKey',
    width: 130,
    searchType: 'select' as const,
    searchOptions: ['qualityTier', 'referenceCount', 'durationSeconds', 'outputCount'].map((v) => ({
      label: v,
      value: v as string | number | boolean,
    })),
  },
  {
    title: t('billingRule.operator'),
    dataIndex: 'operator',
    width: 80,
    searchType: 'select' as const,
    searchOptions: ['EQ', 'IN', 'GTE', 'LTE', 'RANGE'].map((v) => ({
      label: v,
      value: v as string | number | boolean,
    })),
  },
  {
    title: t('billingRule.effectType'),
    dataIndex: 'effectType',
    width: 110,
    searchType: 'select' as const,
    searchOptions: ['ADD_POINTS', 'MULTIPLY', 'DISCOUNT', 'CAP', 'FLOOR'].map((v) => ({
      label: v,
      value: v as string | number | boolean,
    })),
  },
  { title: t('billingRule.effectValue'), dataIndex: 'effectValue', width: 100 },
  { title: t('billingRule.priority'), dataIndex: 'priority', width: 70 },
  {
    title: t('billingRule.status'),
    dataIndex: 'status',
    width: 90,
    searchType: 'select' as const,
    searchOptions: ['DRAFT', 'PUBLISHED', 'DISABLED', 'APPROVED'].map((v) => ({
      label: v,
      value: v as string | number | boolean,
    })),
  },
  { title: t('billingRule.remark'), dataIndex: 'remark', width: 160, ellipsis: true },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    fixed: 'right' as const,
    width: 140,
  },
];

async function loadData(p: Record<string, unknown>) {
  const res = await getRuleList({ page: p.current || 1, pageSize: p.pageSize || 10 });
  return { data: res.list || [], total: res.total || 0, success: true };
}

const visible = ref(false);
const editing = ref<ChargeRule | null>(null);
const form = reactive<Partial<ChargeRule>>({
  ruleCode: '',
  scopeType: 'VARIANT',
  scopeCode: '*',
  factorKey: 'qualityTier',
  operator: 'EQ',
  matchValue: '""',
  effectType: 'ADD_POINTS',
  effectValue: 0,
  priority: 0,
  status: 'DRAFT',
  remark: '',
});

function openModal(r: ChargeRule | null) {
  editing.value = r;
  if (r) Object.assign(form, r);
  else
    Object.assign(form, {
      ruleCode: '',
      scopeType: 'VARIANT',
      scopeCode: '*',
      factorKey: 'qualityTier',
      operator: 'EQ',
      matchValue: '""',
      effectType: 'ADD_POINTS',
      effectValue: 0,
      priority: 0,
      status: 'DRAFT',
      remark: '',
    });
  visible.value = true;
}

async function handleSubmit() {
  loading.value = true;
  try {
    if (editing.value) {
      await updateRule(editing.value.id!, form);
      message.success(t('billingRule.updateSuccess'));
    } else {
      await createRule(form);
      message.success(t('billingRule.createSuccess'));
    }
    visible.value = false;
    tableRef.value?.reload();
  } catch {
    /* */
  } finally {
    loading.value = false;
  }
}

async function handleDelete(id: number) {
  await deleteRule(id);
  message.success(t('billingRule.deleteSuccess'));
  tableRef.value?.reload();
}

async function handleRefresh() {
  refreshing.value = true;
  try {
    await refreshRuleCache();
    message.success(t('billingRule.cacheRefreshed'));
  } catch {
    /* */
  } finally {
    refreshing.value = false;
  }
}

const scopeTypeOptions = ['OFFER', 'VARIANT', 'COMPONENT', 'MODEL', 'GLOBAL'].map((v) => ({
  label: v,
  value: v,
}));
const factorKeyFormOptions = [
  'qualityTier',
  'referenceCount',
  'durationSeconds',
  'outputCount',
].map((v) => ({ label: v, value: v }));
const operatorFormOptions = ['EQ', 'IN', 'GTE', 'LTE', 'RANGE'].map((v) => ({
  label: v,
  value: v,
}));
const effectTypeFormOptions = ['ADD_POINTS', 'MULTIPLY', 'DISCOUNT', 'CAP', 'FLOOR'].map((v) => ({
  label: v,
  value: v,
}));
const ruleStatusFormOptions = ['DRAFT', 'PUBLISHED', 'DISABLED'].map((v) => ({
  label: v,
  value: v,
}));
</script>
