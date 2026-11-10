<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">官方提示词</h2>
      <span class="muted">画布提示词库；官方条目可新建 / 编辑 / 启停</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="query.vertical"
          :options="verticalOptions"
          style="width: 130px"
          @change="onFilter"
        />
        <a-input
          v-model:value="query.group"
          placeholder="分组 group"
          allow-clear
          style="width: 150px"
          @press-enter="onFilter"
        />
        <a-input
          v-model:value="query.model"
          placeholder="模型"
          allow-clear
          style="width: 150px"
          @press-enter="onFilter"
        />
        <a-select
          v-model:value="query.enabled"
          :options="enabledOptions"
          style="width: 120px"
          @change="onFilter"
        />
        <a-input-search
          v-model:value="query.q"
          placeholder="关键词"
          allow-clear
          style="width: 220px"
          @search="onFilter"
        />
        <a-button @click="load">刷新</a-button>
        <a-button v-if="canUpdate" type="primary" @click="openEdit()">新建官方提示词</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <a-tooltip :title="record.prompt" placement="topLeft">
              <span>{{ record.title }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.dataIndex === 'vertical'">
            {{ VERTICAL_LABEL[record.vertical] || record.vertical }}
          </template>
          <template v-else-if="column.dataIndex === 'models'">
            <a-tag v-for="m in record.models || []" :key="m">{{ m }}</a-tag>
            <span v-if="!(record.models || []).length" class="muted">全部</span>
          </template>
          <template v-else-if="column.dataIndex === 'tags'">
            <a-tag v-for="t in record.tags || []" :key="t" color="blue">{{ t }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-switch
              :checked="record.enabled"
              :disabled="!canUpdate"
              :loading="togglingId === record.id"
              @change="(v: boolean) => onToggle(record, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="canUpdate && record.userId === 0"
              type="link"
              size="small"
              @click="openEdit(record)"
              >编辑</a-button
            >
          </template>
        </template>
      </a-table>
      <div class="pager">
        <a-pagination
          v-model:current="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="load"
          @show-size-change="onSize"
        />
      </div>
    </a-card>

    <a-drawer
      v-model:open="drawerOpen"
      :title="form.id ? '编辑官方提示词' : '新建官方提示词'"
      :width="600"
      destroy-on-close
    >
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" :maxlength="100" show-count />
        </a-form-item>
        <a-form-item label="提示词" required>
          <a-textarea v-model:value="form.prompt" :rows="10" :maxlength="PROMPT_MAX" show-count />
        </a-form-item>
        <a-form-item label="行业 vertical" required>
          <a-radio-group v-model:value="form.vertical">
            <a-radio value="ecommerce">电商</a-radio>
            <a-radio value="general">通用</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="分组 group" required>
          <a-input v-model:value="form.group" :maxlength="50" />
        </a-form-item>
        <a-form-item label="适用模型（可多个，回车确认；留空 = 全部）">
          <a-select v-model:value="form.models" mode="tags" :open="false" />
        </a-form-item>
        <a-form-item label="标签（回车确认）">
          <a-select v-model:value="form.tags" mode="tags" :open="false" />
        </a-form-item>
        <a-form-item label="来源 source">
          <a-input v-model:value="form.source" :maxlength="100" />
        </a-form-item>
        <a-form-item label="排序（越小越靠前）">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 160px" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  createPrompt,
  listPrompts,
  togglePrompt,
  updatePrompt,
  type PromptItem,
} from '@/api/canvas-admin';
import { VERTICAL_LABEL } from '@/utils/canvas';
import { CANVAS_UPDATE, hasCanvasPermission } from '@/utils/canvas-permission';

const PROMPT_MAX = 3000;

const canUpdate = computed(() => hasCanvasPermission(CANVAS_UPDATE));

const verticalOptions = [
  { label: '全部行业', value: '' },
  { label: '电商', value: 'ecommerce' },
  { label: '通用', value: 'general' },
];
const enabledOptions = [
  { label: '全部状态', value: -1 },
  { label: '已启用', value: 1 },
  { label: '已停用', value: 0 },
];

const query = ref({
  vertical: '',
  group: '',
  model: '',
  enabled: -1,
  q: '',
  page: 1,
  pageSize: 20,
});
const rows = ref<PromptItem[]>([]);
const total = ref(0);
const loading = ref(false);
const togglingId = ref(0);

const columns = [
  { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
  { title: 'vertical', dataIndex: 'vertical', width: 90 },
  { title: 'group', dataIndex: 'group', width: 120 },
  { title: 'models', dataIndex: 'models', width: 200 },
  { title: 'tags', dataIndex: 'tags', width: 200 },
  { title: 'source', dataIndex: 'source', width: 120, ellipsis: true },
  { title: '排序', dataIndex: 'sort', width: 70, align: 'right' as const },
  { title: '启用', dataIndex: 'enabled', width: 80 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' as const },
];

function onFilter() {
  query.value.page = 1;
  load();
}

function onSize(_c: number, size: number) {
  query.value.pageSize = size;
  query.value.page = 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    const q = query.value;
    // 接口没有 model 参数：模型走关键词一并检索
    const keyword = [q.q.trim(), q.model.trim()].filter(Boolean).join(' ');
    const result = await listPrompts({
      scope: 'official',
      vertical: q.vertical || undefined,
      group: q.group.trim() || undefined,
      enabled: q.enabled,
      q: keyword || undefined,
      page: q.page,
      pageSize: q.pageSize,
    });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

async function onToggle(record: PromptItem, enabled: boolean) {
  togglingId.value = record.id;
  try {
    await togglePrompt(record.id, enabled);
    record.enabled = enabled;
    message.success(enabled ? '已启用' : '已停用');
  } catch {
    /* 已由 API 层提示 */
  } finally {
    togglingId.value = 0;
  }
}

// ---------------- 新建 / 编辑 ----------------

const drawerOpen = ref(false);
const saving = ref(false);
const form = reactive({
  id: 0,
  title: '',
  prompt: '',
  vertical: 'ecommerce' as 'ecommerce' | 'general',
  group: '',
  models: [] as string[],
  tags: [] as string[],
  source: '',
  sort: 0,
  enabled: true,
});

function openEdit(record?: PromptItem) {
  Object.assign(form, {
    id: record?.id ?? 0,
    title: record?.title ?? '',
    prompt: record?.prompt ?? '',
    vertical: (record?.vertical as 'ecommerce' | 'general') ?? 'ecommerce',
    group: record?.group ?? '',
    models: [...(record?.models ?? [])],
    tags: [...(record?.tags ?? [])],
    source: record?.source ?? '',
    sort: record?.sort ?? 0,
    enabled: record?.enabled ?? true,
  });
  drawerOpen.value = true;
}

async function save() {
  if (!form.title.trim()) return message.warning('请填写标题');
  if (!form.prompt.trim()) return message.warning('请填写提示词');
  if (form.prompt.length > PROMPT_MAX) return message.warning(`提示词不能超过 ${PROMPT_MAX} 字`);
  if (!form.group.trim()) return message.warning('请填写分组');
  saving.value = true;
  try {
    const body = {
      title: form.title.trim(),
      prompt: form.prompt,
      vertical: form.vertical,
      group: form.group.trim(),
      models: form.models,
      tags: form.tags,
      source: form.source.trim(),
      sort: form.sort ?? 0,
      enabled: form.enabled,
    };
    if (form.id) await updatePrompt(form.id, body);
    else await createPrompt(body);
    message.success('已保存');
    drawerOpen.value = false;
    load();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    saving.value = false;
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
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
