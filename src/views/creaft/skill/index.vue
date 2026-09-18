<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 技能目录</h2>
      <a-space>
        <a-button @click="reload">刷新</a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="GET /api/v1/agent/skills 的数据源。两条规则决定一条技能能不能被用户看到：启用，且分类非空——分类为空的行会被整行跳过。"
    />

    <a-alert
      v-if="summary && summary.uncategorised > 0"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`有 ${summary.uncategorised} 条启用的技能没有分类，用户端的「@技能」列表里看不到它们（接口会整行跳过并打 WARN）。分类请照 v1 的 agent_skill.category 填，不要自己发明——两边字面量不一致时弹窗分组会与 v1 对不上，而且不报错。`"
    />

    <a-alert
      v-if="summary && summary.placeholderCode > 0"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`有 ${summary.placeholderCode} 条技能的编码还是占位值 skill_<id>（V1.0.112 的种子只拿到 id 和标题）。要与 v1 对齐请用 deploy/sql/creaft-v1-agent-skill-import.sql 批量导入，单条也可以在这里改。`"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="categoryFilter"
          :options="categoryFilterOptions"
          style="width: 220px"
          @change="loadList"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按技能名或编码过滤"
          allow-clear
          style="width: 240px"
          @press-enter="loadList"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
          style="width: 140px"
          @change="loadList"
        />
        <span v-if="summary" class="muted">
          共 {{ summary.total }} 条 / 启用 {{ summary.enabled }} 条 / 用户可见 {{ visibleCount }} 条
        </span>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty description="暂无技能。技能身份来自铺货侧绑定，本页不新增" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">{{ record.title }}</div>
            <div v-if="record.description" class="muted">{{ record.description }}</div>
          </template>

          <template v-if="column.dataIndex === 'agentSkillCode'">
            <code class="route-code">{{ record.agentSkillCode }}</code>
            <a-tag v-if="record.placeholderCode" color="orange" style="margin-left: 4px">
              占位
            </a-tag>
            <div class="muted">id {{ record.agentSkillId }}</div>
          </template>

          <template v-if="column.dataIndex === 'category'">
            <span v-if="record.category">{{ record.category }}</span>
            <a-tag v-else color="red">未分类</a-tag>
          </template>

          <template v-if="column.dataIndex === 'visible'">
            <a-tag :color="record.visible ? 'green' : 'default'">
              {{ record.visible ? '可见' : '不可见' }}
            </a-tag>
            <div v-if="!record.visible" class="muted">
              {{ record.enabled === 1 ? '缺分类' : '已停用' }}
            </div>
          </template>

          <template v-if="column.key === 'operation'">
            <a-button
              v-permission="'creaft_catalog:edit'"
              type="link"
              size="small"
              @click="openEdit(record)"
            >
              编辑
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      title="编辑技能"
      :confirm-loading="saving"
      width="640px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="技能身份">
          <code class="route-code">{{ editing?.agentSkillId }}</code>
          <div class="muted">与铺货侧共用的 int64，不可改</div>
        </a-form-item>

        <a-form-item label="分类">
          <!-- 选已有分类或输新的：仓库里这种场合用 a-auto-complete
               （select 的 combobox 模式在 antdv 4 已经去掉了） -->
          <a-auto-complete
            v-model:value="form.category"
            :options="categoryOptions"
            :filter-option="filterCategoryOption"
            allow-clear
            placeholder="照 v1 的 agent_skill.category 填"
          />
          <div class="muted warn">清空分类 = 这条技能从用户端的 @技能 列表里消失</div>
        </a-form-item>

        <a-form-item label="技能名">
          <a-input v-model:value="form.title" />
        </a-form-item>

        <a-form-item label="描述">
          <a-input v-model:value="form.description" />
        </a-form-item>

        <a-form-item label="图标地址">
          <a-input v-model:value="form.icon" placeholder="选填" />
        </a-form-item>

        <a-form-item label="版本">
          <a-input v-model:value="form.version" placeholder="v1 的 version，是字符串不是数字" />
        </a-form-item>

        <a-form-item label="排序权重">
          <a-input-number v-model:value="form.weight" :min="0" style="width: 100%" />
          <div class="muted">同分类内降序：大的在前（与 v1 一致）</div>
        </a-form-item>

        <a-form-item label="技能编码">
          <a-input v-model:value="form.agentSkillCode" />
          <div class="muted warn">
            与 v1 对齐身份用的编码。改成别的会让按编码反查的地方找不到，非对齐需要时别动。
          </div>
        </a-form-item>

        <a-form-item label="启用">
          <a-switch v-model:checked="enabled" />
          <span class="muted" style="margin-left: 8px">停用等于该技能在 @技能 列表里不存在</span>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  getCreaftAgentSkillSummary,
  getCreaftAgentSkills,
  updateCreaftAgentSkill,
  type CreaftAgentSkillRow,
  type CreaftAgentSkillSummary,
} from '@/api/creaft-compat';

const rows = ref<CreaftAgentSkillRow[]>([]);
const summary = ref<CreaftAgentSkillSummary | null>(null);
const loading = ref(false);
const categoryFilter = ref<string>('');
const enabledFilter = ref<'' | 1 | 0>('');
const keyword = ref('');

const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

/** 分类候选从当前行里收集：技能目录是几十行的配置，不值得为下拉再开一个接口 */
const categories = ref<string[]>([]);
const categoryFilterOptions = computed(() => [
  { label: '全部分类', value: '' },
  // 「未分类」是这页最常用的筛选——要补的就是这批
  { label: '未分类', value: '__EMPTY__' },
  ...categories.value.map((c) => ({ label: c, value: c })),
]);
const categoryOptions = computed(() => categories.value.map((c) => ({ label: c, value: c })));
const visibleCount = computed(() => rows.value.filter((row) => row.visible).length);

function filterCategoryOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase());
}

const columns = [
  { title: '技能', dataIndex: 'title', width: 260 },
  { title: '编码 / 身份', dataIndex: 'agentSkillCode', width: 240 },
  { title: '分类', dataIndex: 'category', width: 140 },
  { title: '权重', dataIndex: 'weight', width: 80, align: 'center' as const },
  { title: '用户端', dataIndex: 'visible', width: 110, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 100, align: 'center' as const },
];

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(loadList, 300);
}

async function loadList() {
  loading.value = true;
  try {
    rows.value =
      (await getCreaftAgentSkills({
        category: categoryFilter.value || undefined,
        keyword: keyword.value.trim() || undefined,
        enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
      })) || [];
    // 只在「不带分类筛选」的那次刷新候选，否则筛了某个分类后候选会塌成一项
    if (!categoryFilter.value) {
      categories.value = [
        ...new Set(rows.value.map((row) => row.category).filter((c): c is string => !!c)),
      ].sort();
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  try {
    summary.value = await getCreaftAgentSkillSummary();
  } catch {
    /* 体检数字缺失不影响列表 */
  }
}

function reload() {
  loadList();
  loadSummary();
}

reload();

// ---- 编辑 ----
const modalVisible = ref(false);
const saving = ref(false);
const editing = ref<CreaftAgentSkillRow | null>(null);

const form = reactive({
  category: undefined as string | undefined,
  title: '',
  description: '',
  icon: '',
  version: '',
  weight: 0,
  enabled: 1,
  agentSkillCode: '',
});

const enabled = computed({
  get: () => form.enabled === 1,
  set: (value: boolean) => (form.enabled = value ? 1 : 0),
});

function openEdit(record: CreaftAgentSkillRow) {
  editing.value = record;
  Object.assign(form, {
    category: record.category || undefined,
    title: record.title || '',
    description: record.description || '',
    icon: record.icon || '',
    version: record.version || '',
    weight: record.weight ?? 0,
    enabled: record.enabled ?? 1,
    agentSkillCode: record.agentSkillCode || '',
  });
  modalVisible.value = true;
}

async function handleSubmit() {
  if (!editing.value) return;
  if (!form.agentSkillCode.trim()) {
    message.warning('技能编码不能为空');
    return;
  }
  saving.value = true;
  try {
    await updateCreaftAgentSkill(editing.value.id, {
      category: form.category || undefined,
      title: form.title.trim() || undefined,
      description: form.description || undefined,
      icon: form.icon || undefined,
      version: form.version || undefined,
      weight: form.weight ?? 0,
      enabled: form.enabled,
      agentSkillCode: form.agentSkillCode.trim(),
    });
    message.success('已保存');
    modalVisible.value = false;
    reload();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.title-cell {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
</style>
