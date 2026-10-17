<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">生成配置</h2>
      <span class="muted"
        >模型、比例、时长、风格的展示与启用。编码由执行面路由决定，这里只能改名称、排序、启用和默认。</span
      >
    </div>

    <a-card variant="borderless" title="选项" style="margin-bottom: 16px">
      <div class="filter-bar">
        <a-select v-model:value="group" :options="groupOptions" style="width: 200px" />
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
          <template v-if="column.dataIndex === 'group'">{{ groupLabel(record.group) }}</template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled ? 'green' : 'default'">{{
              record.enabled ? '启用' : '停用'
            }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'is_default'">
            <a-tag v-if="record.is_default" color="blue">默认</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'operation' && canEdit">
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card variant="borderless" title="模板必选">
      <p class="muted section-hint">
        开启后，用户生成前必须选择模板。没有配置的类型沿用代码默认值。
      </p>
      <a-table
        :columns="kindColumns"
        :data-source="kinds"
        :loading="loading"
        :pagination="false"
        row-key="kind"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'kind'">{{ kindLabel(record.kind) }}</template>
          <template v-else-if="column.dataIndex === 'template_required'">
            <a-switch
              :checked="record.template_required"
              :disabled="!canEdit"
              :loading="kindSaving === record.kind"
              @change="(v: boolean) => toggleKind(record, v)"
            />
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalVisible" title="编辑生成选项" :confirm-loading="saving" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="编码（只读）">
          <a-input :value="editing?.code" disabled />
        </a-form-item>
        <a-form-item label="名称" :rules="[{ required: true }]">
          <a-input v-model:value="form.label" :maxlength="64" :disabled="isStyleGroup" />
          <span v-if="isStyleGroup" class="hint">风格名称会进入出图提示词，不能在后台修改</span>
        </a-form-item>
        <a-form-item label="排序（越小越靠前）">
          <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch :checked="form.enabled" @change="onEnabledChange" />
          <span class="hint">每组至少保留一个启用项</span>
        </a-form-item>
        <a-form-item label="设为默认">
          <a-switch
            :checked="form.is_default"
            :disabled="!form.enabled"
            @change="(v: boolean) => (form.is_default = v)"
          />
          <span class="hint">默认项必须启用，同组只能有一个默认</span>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  type GenKindItem,
  type GenOptionItem,
  type GenOptionUpdate,
  listGenOptions,
  updateGenKind,
  updateGenOption,
} from '@/api/local-life-admin';
import { hasLocalLifePermission, LOCAL_LIFE_UPDATE } from '@/utils/local-life-permission';

const GROUP_LABELS: Record<string, string> = {
  poster_models: '海报档位',
  poster_sizes: '海报比例',
  poster_styles: '海报风格',
  longimage_sizes: '长图比例',
  action_models: '动作迁移模型',
  voiceover_models: '口播模型',
  voiceover_sizes: '口播比例',
  voiceover_durations: '口播时长',
  remake_models: '视频复刻模型',
  video_models: '探店 / 短剧模型',
  video_sizes: '视频比例',
  video_durations: '视频时长',
};

const KIND_LABELS: Record<string, string> = {
  poster: '海报',
  longImage: '长图',
  actionTransfer: '动作迁移',
};

const groupOptions = [
  { label: '全部分组', value: '' },
  ...Object.entries(GROUP_LABELS).map(([value, label]) => ({ label, value })),
];

const canEdit = computed(() => hasLocalLifePermission(LOCAL_LIFE_UPDATE));
const group = ref('');
const all = ref<GenOptionItem[]>([]);
const kinds = ref<GenKindItem[]>([]);
const loading = ref(false);
const kindSaving = ref<string | null>(null);
const modalVisible = ref(false);
const saving = ref(false);
const editing = ref<GenOptionItem | null>(null);
const form = reactive<GenOptionUpdate>({
  label: '',
  sort_order: 0,
  enabled: true,
  is_default: false,
});

const isStyleGroup = computed(() => editing.value?.group === 'poster_styles');

const columns = [
  { title: '分组', dataIndex: 'group', width: 150 },
  { title: '编码', dataIndex: 'code', width: 220 },
  { title: '名称', dataIndex: 'label', width: 180 },
  { title: '排序', dataIndex: 'sort_order', width: 80, align: 'center' as const },
  { title: '启用', dataIndex: 'enabled', width: 90, align: 'center' as const },
  { title: '默认', dataIndex: 'is_default', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', width: 90, align: 'center' as const },
];
const visibleColumns = computed(() =>
  columns.filter((c) => canEdit.value || c.dataIndex !== 'operation'),
);

const kindColumns = [
  { title: '类型', dataIndex: 'kind', width: 200 },
  { title: '模板必选', dataIndex: 'template_required', width: 140, align: 'center' as const },
];

const rows = computed(() => all.value.filter((r) => !group.value || r.group === group.value));

function groupLabel(value: string) {
  return GROUP_LABELS[value] ?? value;
}

function kindLabel(value: string) {
  return KIND_LABELS[value] ?? value;
}

async function load() {
  loading.value = true;
  try {
    const result = await listGenOptions();
    all.value = result?.list || [];
    kinds.value = result?.kinds || [];
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

function openEdit(record: GenOptionItem) {
  editing.value = record;
  Object.assign(form, {
    label: record.label,
    sort_order: record.sort_order,
    enabled: record.enabled,
    is_default: record.is_default,
  });
  modalVisible.value = true;
}

function onEnabledChange(checked: boolean) {
  form.enabled = checked;
  if (!checked) form.is_default = false;
}

async function save() {
  if (!editing.value) return;
  if (!form.label.trim()) {
    message.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await updateGenOption(editing.value.id, { ...form, label: form.label.trim() });
    message.success('已保存');
    modalVisible.value = false;
    load();
  } catch {
    /* 已由 API 层提示（如「每组至少保留一个启用项」） */
  } finally {
    saving.value = false;
  }
}

async function toggleKind(record: GenKindItem, checked: boolean) {
  kindSaving.value = record.kind;
  try {
    await updateGenKind(record.kind, { template_required: checked });
    message.success('已保存');
    load();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    kindSaving.value = null;
  }
}

load();
</script>

<style scoped>
.page-container {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.ph-title {
  margin: 0;
  font-size: 18px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.section-hint {
  margin: 0 0 12px;
  font-size: 12px;
}
.hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary, #8c8c8c);
}
</style>
