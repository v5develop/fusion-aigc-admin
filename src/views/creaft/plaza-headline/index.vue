<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">本周头条</h2>
      <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate()">
        新增头条
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="智能体首页「本周头条」：从已启用的创意广场模板里挑本周爆款样本，加一句推荐语（≤60 字）。用户端只显示今天在生效窗口内、已启用、且模板本身仍启用的头条，按近 7 天复刻次数排序（同次数按「排序」升序）；同一模板同时挂多条时只取起始日最晚的一条。复刻次数 = 近 7 天用该模板发起的智能体轮次，每 10 分钟刷新。"
    />

    <a-card variant="borderless" style="margin-bottom: 12px">
      <template #title>
        <span>近 7 天热门模板</span>
        <span class="muted" style="margin-left: 8px">按复刻次数排序，帮你挑头条</span>
      </template>
      <template #extra>
        <a-button size="small" :loading="suggestLoading" @click="loadSuggestions">刷新</a-button>
      </template>
      <a-table
        :columns="suggestColumns"
        :data-source="suggestions"
        :loading="suggestLoading"
        :pagination="false"
        row-key="plazaTemplateId"
        size="small"
      >
        <template #emptyText>
          <a-empty description="近 7 天还没有人用模板做同款" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="tpl-cell">
              <img
                v-if="record.cover && !isVideo(record.cover)"
                :src="record.cover"
                class="thumb"
                alt=""
              />
              <div v-else class="thumb thumb-empty">{{ record.cover ? '视频' : '无图' }}</div>
              <div>
                <div class="title-cell">{{ record.title }}</div>
                <code class="route-code">#{{ record.plazaTemplateId }}</code>
              </div>
            </div>
          </template>
          <template v-if="column.dataIndex === 'uses'">
            <span>{{ record.uses }} 次</span>
            <span :class="trendClass(record.trend)" style="margin-left: 6px">{{
              trendText(record.trend)
            }}</span>
          </template>
          <template v-if="column.key === 'operation'">
            <a-tag v-if="record.headlined" color="purple">已在头条</a-tag>
            <a-button
              v-else
              v-permission="'creaft_catalog:edit'"
              type="link"
              size="small"
              @click="openCreate(record)"
            >
              设为头条
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="phaseFilter"
          :options="phaseOptions"
          style="width: 140px"
          @change="onFilterChange"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按模板标题或推荐语过滤"
          allow-clear
          style="width: 240px"
          @press-enter="onKeywordEnter"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
          style="width: 140px"
          @change="onFilterChange"
        />
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
          <a-empty description="暂无头条" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'templateTitle'">
            <div class="tpl-cell">
              <img
                v-if="record.templateCover && !isVideo(record.templateCover)"
                :src="record.templateCover"
                class="thumb"
                alt=""
              />
              <div v-else class="thumb thumb-empty">
                {{ record.templateCover ? '视频' : '无图' }}
              </div>
              <div>
                <div class="title-cell">{{ record.templateTitle || '（模板已删除）' }}</div>
                <a-space v-if="record.templateTags?.length" :size="4" wrap>
                  <a-tag v-for="tag in record.templateTags.slice(0, 3)" :key="tag">{{ tag }}</a-tag>
                </a-space>
                <div>
                  <code class="route-code">模板 #{{ record.plazaTemplateId }}</code>
                </div>
                <div v-if="!record.templateExists" class="muted warn">
                  模板已删除，用户端不显示这条头条
                </div>
                <div v-else-if="!record.templateEnabled" class="muted warn">
                  模板已停用，用户端不显示这条头条
                </div>
              </div>
            </div>
          </template>

          <template v-if="column.dataIndex === 'why'">
            <span>{{ record.why }}</span>
          </template>

          <template v-if="column.dataIndex === 'window'">
            <div>{{ record.startDate }} ~ {{ record.endDate }}</div>
            <a-tag :color="PHASE[record.phase as PlazaHeadlinePhase].color">
              {{ PHASE[record.phase as PlazaHeadlinePhase].label }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'uses'">
            <div>{{ record.uses }} 次</div>
            <div :class="trendClass(record.trend)">{{ trendText(record.trend) }}</div>
          </template>

          <template v-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled === 1 ? 'green' : 'default'">
              {{ record.enabled === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'creaft_catalog:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                编辑
              </a-button>
              <a-popconfirm
                v-permission="'creaft_catalog:edit'"
                title="删除后立刻从用户端消失。只想临时下架请改成「停用」。确认删除？"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
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
          @change="onPageChange"
        />
      </div>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? '编辑头条' : '新增头条'"
      :confirm-loading="saving"
      width="640px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
        <a-form-item label="广场模板" required>
          <a-select
            v-model:value="form.plazaTemplateId"
            show-search
            allow-clear
            :filter-option="false"
            :options="templateOptions"
            :loading="templateSearching"
            placeholder="输入标题搜索已启用的广场模板"
            @search="onTemplateSearch"
            @dropdown-visible-change="onTemplateDropdown"
          />
          <div class="muted">只能选已启用的模板；标题、封面、标签都读模板本身。</div>
        </a-form-item>

        <a-form-item label="推荐语" required>
          <a-input
            v-model:value="form.why"
            :maxlength="60"
            show-count
            placeholder="一句话说清楚为什么值得复刻，例如：同一张主图换配色，一晚上铺出 12 个 SKU"
          />
        </a-form-item>

        <a-form-item label="生效窗口" required>
          <a-range-picker
            v-model:value="form.window"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
          <div class="muted">按自然日闭区间生效（北京时间），默认本周一到周日；可提前排下周。</div>
        </a-form-item>

        <a-form-item label="排序">
          <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
          <div class="muted">复刻次数相同时按它升序，小的靠前。</div>
        </a-form-item>

        <a-form-item label="启用">
          <a-switch v-model:checked="enabled" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import dayjs from 'dayjs';
import { computed, reactive, ref } from 'vue';

import { getCreaftTemplates } from '@/api/creaft-compat';
import {
  createPlazaHeadline,
  deletePlazaHeadline,
  getPlazaHeadlineSuggestions,
  getPlazaHeadlines,
  updatePlazaHeadline,
  type PlazaHeadlinePhase,
  type PlazaHeadlineRow,
  type PlazaHeadlineSuggestion,
} from '@/api/plaza-headline';

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const isVideo = (url: string) => VIDEO_RE.test(url);

const PHASE: Record<PlazaHeadlinePhase, { label: string; color: string }> = {
  CURRENT: { label: '生效中', color: 'green' },
  UPCOMING: { label: '待生效', color: 'blue' },
  EXPIRED: { label: '已过期', color: 'default' },
};

function trendText(trend: number | null) {
  if (trend == null) return '新上榜';
  if (trend > 0) return `↑ ${trend}%`;
  if (trend < 0) return `↓ ${Math.abs(trend)}%`;
  return '持平';
}
function trendClass(trend: number | null) {
  if (trend == null) return 'trend-new';
  return trend > 0 ? 'trend-up' : 'muted';
}

// ---- 热门建议 ----
const suggestions = ref<PlazaHeadlineSuggestion[]>([]);
const suggestLoading = ref(false);
const suggestColumns = [
  { title: '模板', dataIndex: 'title' },
  { title: '近 7 天复刻', dataIndex: 'uses', width: 180 },
  { title: '操作', key: 'operation', width: 120, align: 'center' as const },
];

async function loadSuggestions() {
  suggestLoading.value = true;
  try {
    suggestions.value = (await getPlazaHeadlineSuggestions(10)) || [];
  } catch {
    /* 拦截器已提示 */
  } finally {
    suggestLoading.value = false;
  }
}

// ---- 列表 ----
const rows = ref<PlazaHeadlineRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const phaseFilter = ref<'all' | 'current' | 'upcoming' | 'expired'>('all');
const enabledFilter = ref<'' | 1 | 0>('');
const keyword = ref('');

const phaseOptions = [
  { label: '全部窗口', value: 'all' },
  { label: '生效中', value: 'current' },
  { label: '待生效', value: 'upcoming' },
  { label: '已过期', value: 'expired' },
];
const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

const columns = [
  { title: '模板', dataIndex: 'templateTitle', width: 320 },
  { title: '推荐语', dataIndex: 'why' },
  { title: '生效窗口', dataIndex: 'window', width: 210 },
  { title: '近 7 天复刻', dataIndex: 'uses', width: 120 },
  { title: '排序', dataIndex: 'sortOrder', width: 70, align: 'center' as const },
  { title: '状态', dataIndex: 'enabled', width: 80, align: 'center' as const },
  { title: '操作', key: 'operation', width: 130, align: 'center' as const },
];

function onFilterChange() {
  page.value = 1;
  loadList();
}
// 改每页条数时组件同时触发 change 与 showSizeChange，只接 change 一处，免得重复请求
let lastPageSize = pageSize.value;
function onPageChange(current: number, size: number) {
  if (size !== lastPageSize) {
    lastPageSize = size;
    page.value = 1;
  } else {
    page.value = current;
  }
  pageSize.value = size;
  loadList();
}
let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(onFilterChange, 300);
}
function onKeywordEnter() {
  clearTimeout(keywordTimer);
  onFilterChange();
}

let listSeq = 0;
async function loadList(): Promise<void> {
  const seq = ++listSeq;
  loading.value = true;
  try {
    const result = await getPlazaHeadlines({
      phase: phaseFilter.value,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    // 筛选连改时只认最后一次请求，旧响应不覆盖新结果
    if (seq !== listSeq) return;
    rows.value = result?.list || [];
    total.value = result?.total || 0;
    if (!rows.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
      return loadList();
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    if (seq === listSeq) loading.value = false;
  }
}

loadList();
loadSuggestions();

// ---- 模板选择器（远程搜索已启用的广场模板） ----
const templateOptions = ref<{ label: string; value: number }[]>([]);
const templateSearching = ref(false);
let templateTimer: ReturnType<typeof setTimeout> | undefined;
let templateSeq = 0;

async function searchTemplates(kw: string) {
  const s = ++templateSeq;
  templateSearching.value = true;
  try {
    const result = await getCreaftTemplates('PLAZA', {
      keyword: kw.trim() || undefined,
      enabled: 1,
      page: 1,
      pageSize: 30,
    });
    if (s !== templateSeq) return;
    const found = (result?.list || []).map((t) => ({
      label: `${t.title}（#${t.id}）`,
      value: t.id,
    }));
    // 保留当前选中项，免得搜索后选中值显示成裸 id
    const current = templateOptions.value.find((o) => o.value === form.plazaTemplateId);
    templateOptions.value =
      current && !found.some((o) => o.value === current.value) ? [current, ...found] : found;
  } catch {
    /* 拦截器已提示 */
  } finally {
    if (s === templateSeq) templateSearching.value = false;
  }
}
function onTemplateSearch(kw: string) {
  clearTimeout(templateTimer);
  templateTimer = setTimeout(() => searchTemplates(kw), 300);
}
function onTemplateDropdown(open: boolean) {
  if (open && templateOptions.value.length <= 1) searchTemplates('');
}

// ---- 新增 / 编辑 ----
const modalVisible = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);

const form = reactive({
  plazaTemplateId: undefined as number | undefined,
  why: '',
  window: undefined as [string, string] | undefined,
  sortOrder: 0,
  enabled: 1,
});
const enabled = computed({
  get: () => form.enabled === 1,
  set: (value: boolean) => (form.enabled = value ? 1 : 0),
});

/** 默认窗口：本周一 ~ 本周日 */
function thisWeek(): [string, string] {
  const today = dayjs();
  const monday = today.subtract((today.day() + 6) % 7, 'day');
  return [monday.format('YYYY-MM-DD'), monday.add(6, 'day').format('YYYY-MM-DD')];
}

function openCreate(suggestion?: PlazaHeadlineSuggestion) {
  editId.value = null;
  Object.assign(form, {
    plazaTemplateId: suggestion?.plazaTemplateId,
    why: '',
    window: thisWeek(),
    sortOrder: 0,
    enabled: 1,
  });
  templateOptions.value = suggestion
    ? [
        {
          label: `${suggestion.title}（#${suggestion.plazaTemplateId}）`,
          value: suggestion.plazaTemplateId,
        },
      ]
    : [];
  modalVisible.value = true;
}

function openEdit(record: PlazaHeadlineRow) {
  editId.value = record.id;
  Object.assign(form, {
    plazaTemplateId: record.plazaTemplateId,
    why: record.why,
    window: [record.startDate, record.endDate],
    sortOrder: record.sortOrder ?? 0,
    enabled: record.enabled ?? 1,
  });
  templateOptions.value = [
    {
      label: `${record.templateTitle || '（模板已删除）'}（#${record.plazaTemplateId}）`,
      value: record.plazaTemplateId,
    },
  ];
  modalVisible.value = true;
}

async function handleSubmit() {
  if (!form.plazaTemplateId) {
    message.warning('请选择广场模板');
    return;
  }
  const why = form.why.trim();
  if (!why) {
    message.warning('推荐语必填');
    return;
  }
  if (Array.from(why).length > 60) {
    message.warning('推荐语最多 60 个字');
    return;
  }
  if (!form.window?.[0] || !form.window?.[1]) {
    message.warning('请选择生效窗口');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      plazaTemplateId: form.plazaTemplateId,
      why,
      startDate: form.window[0],
      endDate: form.window[1],
      sortOrder: form.sortOrder ?? 0,
      enabled: form.enabled,
    };
    if (editId.value) await updatePlazaHeadline(editId.value, payload);
    else await createPlazaHeadline(payload);
    message.success('已保存');
    modalVisible.value = false;
    loadList();
    loadSuggestions();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function handleDelete(record: PlazaHeadlineRow) {
  try {
    await deletePlazaHeadline(record.id);
    message.success('已删除');
    loadList();
    loadSuggestions();
  } catch {
    /* 拦截器已提示 */
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
.tpl-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.thumb {
  flex: none;
  width: 72px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--color-fill-quaternary, #fafafa);
}
.thumb-empty {
  display: grid;
  place-items: center;
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
  border: 1px solid var(--color-border-secondary, #f0f0f0);
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
.trend-up {
  color: var(--color-success, #389e0d);
  font-weight: 600;
  font-size: 12px;
}
.trend-new {
  color: #7a548c;
  font-weight: 600;
  font-size: 12px;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
