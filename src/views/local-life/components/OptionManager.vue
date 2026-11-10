<template>
  <div>
    <div class="filter-bar">
      <a-select
        v-model:value="optionType"
        :options="typeOptions"
        style="width: 200px"
        @change="load"
      />
      <a-button v-if="canEdit" type="primary" @click="openCreate">新增选项</a-button>
    </div>

    <a-table
      :columns="visibleColumns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'default'">{{
            record.status === 1 ? '启用' : '停用'
          }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'operation' && canEdit">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm title="确认删除该选项？" @confirm="remove(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? '编辑选项' : '新增选项'"
      :confirm-loading="saving"
      @ok="save"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="类型">
          <a-select v-model:value="form.optionType" :options="typeOptions.filter((t) => t.value)" />
        </a-form-item>
        <a-form-item label="编码" :rules="[{ required: true }]">
          <a-input v-model:value="form.code" />
        </a-form-item>
        <a-form-item label="显示名" :rules="[{ required: true }]">
          <a-input v-model:value="form.label" />
        </a-form-item>
        <a-form-item label="取值（提示词等）">
          <a-textarea v-model:value="form.value" :rows="4" />
        </a-form-item>
        <a-form-item label="排序（越小越靠前）">
          <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="状态">
          <a-switch
            :checked="form.status === 1"
            @change="(v: boolean) => (form.status = v ? 1 : 0)"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { Option, OptionForm } from '@/api/local-life-admin';

import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import { hasLocalLifePermission, LOCAL_LIFE_UPDATE } from '@/utils/local-life-permission';

export interface OptionApi {
  list: (optionType?: string) => Promise<{ list: Option[] }>;
  create: (data: OptionForm) => Promise<Option>;
  update: (id: number, data: OptionForm) => Promise<Option>;
  remove: (id: number) => Promise<unknown>;
}

const props = defineProps<{
  types: { label: string; value: string }[];
  api: OptionApi;
}>();

const canEdit = computed(() => hasLocalLifePermission(LOCAL_LIFE_UPDATE));
const typeOptions = [{ label: '全部类型', value: '' }, ...props.types];
const optionType = ref('');
const rows = ref<Option[]>([]);
const loading = ref(false);
const modalVisible = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
const form = reactive<OptionForm>({
  optionType: props.types[0]?.value ?? '',
  code: '',
  label: '',
  value: '',
  sortOrder: 0,
  status: 1,
});

const columns = [
  { title: '类型', dataIndex: 'optionType', width: 140 },
  { title: '编码', dataIndex: 'code', width: 180 },
  { title: '显示名', dataIndex: 'label', width: 180 },
  { title: '取值', dataIndex: 'value', ellipsis: true },
  { title: '排序', dataIndex: 'sortOrder', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', width: 140, align: 'center' as const },
];
const visibleColumns = computed(() =>
  columns.filter((c) => canEdit.value || c.dataIndex !== 'operation'),
);

async function load() {
  loading.value = true;
  try {
    const result = await props.api.list(optionType.value || undefined);
    rows.value = result?.list || [];
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editId.value = null;
  Object.assign(form, {
    optionType: optionType.value || props.types[0]?.value || '',
    code: '',
    label: '',
    value: '',
    sortOrder: 0,
    status: 1,
  });
  modalVisible.value = true;
}

function openEdit(record: Option) {
  editId.value = record.id;
  Object.assign(form, {
    optionType: record.optionType,
    code: record.code,
    label: record.label,
    value: record.value,
    sortOrder: record.sortOrder,
    status: record.status,
  });
  modalVisible.value = true;
}

async function save() {
  if (!form.code.trim() || !form.label.trim()) {
    message.warning('编码和显示名不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload: OptionForm = { ...form, code: form.code.trim(), label: form.label.trim() };
    if (editId.value) await props.api.update(editId.value, payload);
    else await props.api.create(payload);
    message.success('已保存');
    modalVisible.value = false;
    load();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    saving.value = false;
  }
}

async function remove(record: Option) {
  try {
    await props.api.remove(record.id);
    message.success('已删除');
    load();
  } catch {
    /* 已由 API 层提示 */
  }
}

load();
</script>
