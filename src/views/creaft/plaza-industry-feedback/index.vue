<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">行业建议与搜索缺口</h2>
      <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="这里只有按词聚合的计数，不含任何个人信息。行业建议来自用户在「没有我的行业」里写的词；搜索缺口来自行业内搜索零结果的词，用来指导补内容。"
    />

    <a-tabs v-model:active-key="tab" @change="onTab">
      <a-tab-pane key="suggest" tab="行业建议" />
      <a-tab-pane key="miss" tab="搜索缺口" />
    </a-tabs>

    <!-- ===================== 行业建议 ===================== -->
    <a-card v-if="tab === 'suggest'" variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="sug.status"
          :options="sugStatusOptions"
          style="width: 130px"
          @change="reloadSuggestions"
        />
        <a-range-picker
          v-model:value="sug.range"
          value-format="YYYY-MM-DD"
          style="width: 250px"
          @change="reloadSuggestions"
        />
        <a-select
          v-model:value="sug.sort"
          :options="sugSortOptions"
          style="width: 130px"
          @change="reloadSuggestions"
        />
        <span class="muted" style="align-self: center">
          另有 {{ noTextTotal }} 次「想要新行业」的提交没有写文字
        </span>
      </div>
      <a-table
        :columns="sugColumns"
        :data-source="suggestions"
        :loading="sug.loading"
        :pagination="false"
        row-key="normText"
        size="middle"
      >
        <template #emptyText><a-empty description="暂无新的行业建议" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'text'">
            <b>{{ record.text }}</b>
          </template>
          <template v-else-if="column.dataIndex === 'lastAt'">
            {{ fmtTime(record.lastAt) }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor[record.status]">{{ statusLabel[record.status] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-space :size="2">
              <a-button
                v-if="record.status === 'NEW'"
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="primary"
                @click="adopt(record)"
              >
                一键新建行业
              </a-button>
              <a-button
                v-if="record.status === 'NEW'"
                v-permission="'creaft_catalog:edit'"
                size="small"
                @click="ignore(record)"
              >
                忽略
              </a-button>
              <span v-if="record.status !== 'NEW'" class="muted">已处理</span>
            </a-space>
          </template>
        </template>
      </a-table>
      <div class="pager">
        <span class="muted">共 {{ sugTotal }} 个词</span>
        <a-pagination
          v-model:current="sug.page"
          :page-size="sug.size"
          :total="sugTotal"
          :show-size-changer="false"
          @change="loadSuggestions"
        />
      </div>
    </a-card>

    <!-- ===================== 搜索缺口 ===================== -->
    <a-card v-else variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="miss.industry"
          allow-clear
          placeholder="全部行业"
          :options="industryOptions"
          style="width: 160px"
          @change="reloadMiss"
        />
        <a-select
          v-model:value="miss.status"
          :options="missStatusOptions"
          style="width: 130px"
          @change="reloadMiss"
        />
        <a-range-picker
          v-model:value="miss.range"
          value-format="YYYY-MM-DD"
          style="width: 250px"
          @change="reloadMiss"
        />
      </div>
      <a-table
        :columns="missColumns"
        :data-source="misses"
        :loading="miss.loading"
        :pagination="false"
        row-key="key"
        size="middle"
      >
        <template #emptyText><a-empty description="暂无搜索缺口" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'normTerm'">
            <b>{{ record.normTerm }}</b>
          </template>
          <template v-else-if="column.dataIndex === 'industry'">
            {{ industryNameOf(record.industryCode) }}
          </template>
          <template v-else-if="column.dataIndex === 'days'">
            {{ record.firstDay }} ~ {{ record.lastDay }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor[record.status]">{{ statusLabel[record.status] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-space :size="2" wrap>
              <a-button size="small" type="link" @click="goNewTemplate(record)"
                >去新建模板</a-button
              >
              <template v-if="record.status === 'NEW'">
                <a-button
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  @click="mark(record, 'HANDLED')"
                >
                  标记已处理
                </a-button>
                <a-button
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  @click="mark(record, 'IGNORED')"
                >
                  忽略
                </a-button>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>
      <div class="pager">
        <span class="muted">共 {{ missTotal }} 个词</span>
        <a-pagination
          v-model:current="miss.page"
          :page-size="miss.size"
          :total="missTotal"
          @change="loadMisses"
        />
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  getIndustries,
  getIndustrySuggestions,
  getSearchMisses,
  ignoreIndustrySuggestion,
  isPlazaMock,
  markSearchMiss,
  dayStart,
  nextDayStart,
  type IndustryNode,
  type IndustrySuggestion,
  type SearchMiss,
} from '@/api/plaza-admin';

const router = useRouter();
const tab = ref<'suggest' | 'miss'>('suggest');

const statusLabel: Record<string, string> = {
  NEW: '待处理',
  ADOPTED: '已采纳',
  IGNORED: '已忽略',
  HANDLED: '已处理',
};
const fmtTime = (t: string) => t.replace('T', ' ');
const statusColor: Record<string, string> = {
  NEW: 'blue',
  ADOPTED: 'green',
  IGNORED: 'default',
  HANDLED: 'green',
};

// ---- 行业建议 ----
const sug = reactive({
  status: 'NEW',
  range: undefined as [string, string] | undefined,
  sort: 'count' as 'count' | 'recent',
  page: 1,
  size: 20,
  loading: false,
});
const sugStatusOptions = [
  { label: '待处理', value: 'NEW' },
  { label: '已采纳', value: 'ADOPTED' },
  { label: '已忽略', value: 'IGNORED' },
  { label: '全部', value: '' },
];
const sugSortOptions = [
  { label: '按次数', value: 'count' },
  { label: '按最近', value: 'recent' },
];
const sugColumns = [
  { title: '词', dataIndex: 'text' },
  { title: '提交次数', dataIndex: 'count', width: 110 },
  { title: '去重会话数', dataIndex: 'sids', width: 120 },
  { title: '最近提交', dataIndex: 'lastAt', width: 180 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '操作', key: 'operation', width: 220 },
];
const suggestions = ref<IndustrySuggestion[]>([]);
const noTextTotal = ref(0);
const sugTotal = ref(0);

function reloadSuggestions() {
  sug.page = 1;
  loadSuggestions();
}
async function loadSuggestions() {
  sug.loading = true;
  try {
    // Go 不认纯日期；to 是开区间（<），所以取结束日的次日 0 点
    const res = await getIndustrySuggestions({
      status: sug.status || undefined,
      from: sug.range?.[0] ? dayStart(sug.range[0]) : undefined,
      to: sug.range?.[1] ? nextDayStart(sug.range[1]) : undefined,
      sort: sug.sort,
      page: sug.page,
      size: sug.size,
    });
    suggestions.value = res?.items ?? [];
    sugTotal.value = res?.total ?? 0;
    noTextTotal.value = res?.noTextCount ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    sug.loading = false;
  }
}

/** 一键新建：带词跳到行业管理预填表单，创建成功后由那边回写 ADOPTED */
function adopt(s: IndustrySuggestion) {
  router.push({
    path: '/creaft/template-industry',
    query: { create: s.text, suggestion: s.normText },
  });
}

async function ignore(s: IndustrySuggestion) {
  try {
    await ignoreIndustrySuggestion(s.normText);
    message.success('已忽略');
    await loadSuggestions();
  } catch {
    /* 已提示 */
  }
}

// ---- 搜索缺口 ----
const miss = reactive({
  industry: undefined as string | undefined,
  status: 'NEW',
  range: undefined as [string, string] | undefined,
  page: 1,
  size: 50,
  loading: false,
});
const missStatusOptions = [
  { label: '待处理', value: 'NEW' },
  { label: '已处理', value: 'HANDLED' },
  { label: '已忽略', value: 'IGNORED' },
  { label: '全部', value: '' },
];
const missColumns = [
  { title: '词', dataIndex: 'normTerm' },
  { title: '所在行业', dataIndex: 'industry', width: 130 },
  { title: '零结果次数', dataIndex: 'count', width: 110 },
  { title: '首次 ~ 最近', dataIndex: 'days', width: 220 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '操作', key: 'operation', width: 260 },
];
const missRaw = ref<SearchMiss[]>([]);
const missTotal = ref(0);
const misses = computed(() =>
  missRaw.value.map((m) => ({ ...m, key: `${m.industryCode}|${m.normTerm}` })),
);

const roots = ref<IndustryNode[]>([]);
const industryOptions = computed(() =>
  roots.value.flatMap((r) => [
    { label: r.name, value: r.code },
    ...(r.children ?? []).map((c) => ({ label: `${r.name} · ${c.name}`, value: c.code })),
  ]),
);
const industryNameOf = (code: string) =>
  industryOptions.value.find((o) => o.value === code)?.label ?? code;

function reloadMiss() {
  miss.page = 1;
  loadMisses();
}
async function loadMisses() {
  miss.loading = true;
  try {
    // 缺口按「日」汇总，from / to 只取日期部分且两端都含
    const res = await getSearchMisses({
      industry: miss.industry,
      status: miss.status || undefined,
      from: miss.range?.[0] ? dayStart(miss.range[0]) : undefined,
      to: miss.range?.[1] ? dayStart(miss.range[1]) : undefined,
      sort: 'cnt',
      page: miss.page,
      size: miss.size,
    });
    missRaw.value = res?.items ?? [];
    missTotal.value = res?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    miss.loading = false;
  }
}

async function mark(m: SearchMiss, status: 'HANDLED' | 'IGNORED') {
  try {
    await markSearchMiss(m.industryCode, m.normTerm, status);
    message.success(status === 'HANDLED' ? '已标记处理' : '已忽略');
    await loadMisses();
  } catch {
    /* 已提示 */
  }
}

function goNewTemplate(m: SearchMiss) {
  router.push({
    path: '/creaft/plaza-templates',
    query: { newTitle: m.normTerm, industry: m.industryCode },
  });
}

function onTab() {
  if (tab.value === 'miss' && !missRaw.value.length) loadMisses();
}

onMounted(async () => {
  loadSuggestions();
  try {
    roots.value = (await getIndustries()) ?? [];
  } catch {
    /* 已提示 */
  }
});
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
