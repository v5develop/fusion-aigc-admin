<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 技能目录</h2>
      <a-space>
        <a-button v-permission="'creaft_catalog:edit'" @click="openCategoryOrder">
          调整分类顺序
        </a-button>
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
          @change="onFilterChange"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按技能名或编码过滤"
          allow-clear
          style="width: 240px"
          @press-enter="onFilterChange"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
          style="width: 140px"
          @change="onFilterChange"
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
      <div class="pager">
        <a-pagination
          v-model:current="page"
          v-model:page-size="pageSize"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="loadList"
          @show-size-change="onSizeChange"
        />
      </div>
    </a-card>

    <a-modal
      v-model:open="categoryOrderVisible"
      title="调整技能分类顺序"
      :confirm-loading="categoryOrderSaving"
      :ok-button-props="{
        disabled: categoryOrderLoading || categoryOrderItems.length === 0,
      }"
      :cancel-button-props="{ disabled: categoryOrderSaving }"
      :closable="!categoryOrderSaving"
      :mask-closable="false"
      :keyboard="!categoryOrderSaving"
      width="560px"
      @ok="saveCategoryOrder"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        message="第一项分类的第一条技能是桌面端默认技能。拖动分类可固定组间顺序，不再随技能数量或权重变化。"
      />
      <a-alert
        v-if="!categoryOrderLoading && !categoryOrderConfigured"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="当前没有显式配置；下面展示的是后端按 v1 回退规则算出的实际顺序。保存后会固定为该顺序。"
      />
      <a-spin :spinning="categoryOrderLoading">
        <draggable
          v-if="categoryOrderItems.length > 0"
          v-model="categoryOrderItems"
          class="category-order-list"
          item-key="name"
          handle=".category-order-item__handle"
          ghost-class="category-order-item--ghost"
          :animation="180"
          :disabled="categoryOrderSaving"
        >
          <template #item="{ element, index }">
            <div class="category-order-item">
              <HolderOutlined class="category-order-item__handle" />
              <span class="category-order-item__index">{{ index + 1 }}</span>
              <span class="category-order-item__name">{{ element.name }}</span>
              <a-tag v-if="index === 0" color="blue">默认分类</a-tag>
            </div>
          </template>
        </draggable>
        <a-empty
          v-else-if="!categoryOrderLoading"
          description="暂无用户可见的技能分类，请先补齐并启用技能"
        />
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { HolderOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { computed, onActivated, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import draggable from 'vuedraggable';

import {
  getCreaftAgentSkillCategoryOrder,
  getCreaftAgentSkillSummary,
  getCreaftAgentSkills,
  updateCreaftAgentSkillCategoryOrder,
  type CreaftAgentSkillRow,
  type CreaftAgentSkillSummary,
} from '@/api/creaft-compat';

const router = useRouter();
const rows = ref<CreaftAgentSkillRow[]>([]);
const summary = ref<CreaftAgentSkillSummary | null>(null);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

/** 筛选、搜索变化回到第一页；翻页与改每页条数直接重载 */
function onFilterChange() {
  page.value = 1;
  loadList();
}

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}
const categoryFilter = ref<string>('');
const enabledFilter = ref<'' | 1 | 0>('');
const keyword = ref('');

const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

/** 分类候选来自体检接口的全量去重（列表分页，不能从当前页收集） */
const categories = ref<string[]>([]);
const categoryFilterOptions = computed(() => [
  { label: '全部分类', value: '' },
  // 「未分类」是这页最常用的筛选——要补的就是这批
  { label: '未分类', value: '__EMPTY__' },
  ...categories.value.map((c) => ({ label: c, value: c })),
]);
/** 用户可见 = 启用且有分类，与后端 visible 的口径一致；全量数字取自体检，不能从当前页数 */
const visibleCount = computed(() =>
  summary.value ? summary.value.enabled - summary.value.uncategorised : 0,
);

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
  keywordTimer = setTimeout(onFilterChange, 300);
}

async function loadList() {
  loading.value = true;
  try {
    const result = await getCreaftAgentSkills({
      category: categoryFilter.value || undefined,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
    // 删掉末页最后一条后，回退到前一页，避免停在空页上
    if (!rows.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
      return loadList();
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
    categories.value = summary.value.categories || [];
  } catch {
    /* 体检数字缺失不影响列表 */
  }
}

function reload() {
  loadList();
  loadSummary();
}

reload();

// ---- 分类组间顺序 ----
interface CategoryOrderItem {
  name: string;
}

const categoryOrderVisible = ref(false);
const categoryOrderLoading = ref(false);
const categoryOrderSaving = ref(false);
const categoryOrderConfigured = ref(false);
const categoryOrderItems = ref<CategoryOrderItem[]>([]);
let categoryOrderRequest = 0;

watch(categoryOrderVisible, (open) => {
  if (!open) {
    categoryOrderRequest++;
    categoryOrderLoading.value = false;
  }
});

async function openCategoryOrder() {
  if (categoryOrderSaving.value) return;
  const requestId = ++categoryOrderRequest;
  categoryOrderItems.value = [];
  categoryOrderConfigured.value = false;
  categoryOrderLoading.value = true;
  categoryOrderVisible.value = true;
  try {
    const result = await getCreaftAgentSkillCategoryOrder();
    if (requestId !== categoryOrderRequest || !categoryOrderVisible.value) return;
    categoryOrderConfigured.value = result.configuredOrder.length > 0;
    categoryOrderItems.value = result.effectiveOrder.map((name) => ({ name }));
  } catch {
    /* 拦截器已提示；保持空态和禁止保存，避免把加载失败误当成空配置覆盖。 */
  } finally {
    if (requestId === categoryOrderRequest) categoryOrderLoading.value = false;
  }
}

async function saveCategoryOrder() {
  if (categoryOrderLoading.value || categoryOrderSaving.value || !categoryOrderItems.value.length) {
    return;
  }
  categoryOrderSaving.value = true;
  try {
    const result = await updateCreaftAgentSkillCategoryOrder(
      categoryOrderItems.value.map((item) => item.name),
    );
    categoryOrderConfigured.value = result.configuredOrder.length > 0;
    categoryOrderItems.value = result.effectiveOrder.map((name) => ({ name }));
    message.success('分类顺序已保存并生效');
    categoryOrderVisible.value = false;
  } catch {
    /* 拦截器已提示 */
  } finally {
    categoryOrderSaving.value = false;
  }
}

// ---- 编辑：独立页（内容太长，不放弹窗）----
function openEdit(record: CreaftAgentSkillRow) {
  router.push({ name: 'CreaftSkillEdit', params: { id: record.id } });
}

onBeforeUnmount(() => {
  categoryOrderRequest++;
  clearTimeout(keywordTimer);
});

// 布局的 <keep-alive :include> 按组件名匹配路由名：不设名字的话从编辑页返回时整页重挂、筛选条件全丢。
defineOptions({ name: 'CreaftSkill' });

// 从编辑页返回时实例是缓存的，筛选都还在；原地重查一次，让刚保存的修改体现出来。首次挂载已经加载过，跳过那一次。
let firstActivation = true;
onActivated(() => {
  if (firstActivation) {
    firstActivation = false;
    return;
  }
  reload();
});
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
.category-order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.category-order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 6px;
  background: var(--color-bg-container, #fff);
}
.category-order-item__handle {
  color: var(--color-text-tertiary, #999);
  cursor: grab;
}
.category-order-item__handle:active {
  cursor: grabbing;
}
.category-order-item__index {
  width: 24px;
  color: var(--color-text-tertiary, #999);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.category-order-item__name {
  flex: 1;
  font-weight: 500;
}
.category-order-item--ghost {
  opacity: 0.45;
  background: var(--color-primary-bg, #e6f4ff);
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
