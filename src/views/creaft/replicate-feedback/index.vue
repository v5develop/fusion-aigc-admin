<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">视频做同款 · 成片反馈</h2>
      <a-tag v-if="isReplicateMock()" color="orange">mock 数据</a-tag>
    </div>

    <!-- 汇总：随时间范围联动 -->
    <a-spin :spinning="summaryLoading">
      <div class="cards">
        <a-card variant="borderless" class="stat">
          <a-statistic title="满意" :value="summary.up" />
        </a-card>
        <a-card variant="borderless" class="stat">
          <a-statistic title="不满意" :value="summary.down" />
        </a-card>
        <a-card variant="borderless" class="stat">
          <a-statistic title="不满意占比" :value="downRate" suffix="%" :precision="1" />
          <div class="muted">共 {{ summary.total }} 条反馈</div>
        </a-card>
        <a-card variant="borderless" class="stat">
          <div class="stat-title">按连贯度对比（不满意 / 全部）</div>
          <div v-for="c in continuityRows" :key="c.continuity" class="cont-row">
            <span class="cont-name">{{ continuityLabel(c.continuity) }}</span>
            <b>{{ c.rate }}%</b>
            <span class="muted">（{{ c.down }}/{{ c.up + c.down }}）</span>
          </div>
          <div v-if="!continuityRows.length" class="muted">暂无数据</div>
        </a-card>
      </div>
    </a-spin>

    <a-card variant="borderless" title="不满意原因分布" style="margin-top: 16px">
      <a-empty v-if="!reasonRows.length" description="没有原因数据" />
      <div v-for="r in reasonRows" :key="r.reason" class="bar-row">
        <span class="bar-name">{{ reasonLabel(r.reason) }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: `${(r.count / maxCount) * 100}%` }"></div>
        </div>
        <span class="bar-count">{{ r.count }}</span>
        <span class="muted bar-split">
          更连贯 {{ r.smooth }} · 更快 {{ r.fast }}
          <template v-if="r.reason === 'seam_jump'">
            ｜接缝跳变率：更连贯 {{ seamRate('smooth') }} / 更快 {{ seamRate('fast') }}
          </template>
        </span>
      </div>
      <div class="muted" style="margin-top: 8px">
        接缝跳变率 = 该连贯度下选了「接缝跳变」的反馈数 ÷ 该连贯度下不满意的反馈数。
      </div>
    </a-card>

    <a-card variant="borderless" style="margin-top: 16px">
      <div class="filter-bar">
        <a-select
          v-model:value="filters.rating"
          allow-clear
          placeholder="评价"
          style="width: 110px"
          :options="ratingOptions"
          @change="reloadFirst"
        />
        <a-select
          v-model:value="filters.reason"
          allow-clear
          placeholder="原因"
          style="width: 140px"
          :options="reasonOptions"
          @change="reloadFirst"
        />
        <a-select
          v-model:value="filters.continuity"
          allow-clear
          placeholder="连贯度"
          style="width: 120px"
          :options="continuityOptions"
          @change="reloadFirst"
        />
        <a-range-picker
          v-model:value="range"
          value-format="YYYY-MM-DD"
          :placeholder="['反馈自', '反馈至']"
          style="width: 240px"
          @change="reloadFirst"
        />
        <a-input
          v-model:value="filters.userId"
          allow-clear
          placeholder="用户 ID"
          style="width: 120px"
          @press-enter="reloadFirst"
        />
        <a-input
          v-model:value="filters.jobId"
          allow-clear
          placeholder="任务 ID"
          style="width: 110px"
          @press-enter="reloadFirst"
        />
        <a-button type="primary" @click="reloadFirst">查询</a-button>
        <a-button @click="reset">重置</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1000 }"
      >
        <template #emptyText><a-empty description="没有符合条件的反馈" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'jobId'">
            <a @click="openDetail(record.jobId)">#{{ record.jobId }}</a>
          </template>
          <template v-else-if="column.dataIndex === 'rating'">
            <a-tag :color="record.rating === 'up' ? 'green' : 'red'">{{
              record.rating === 'up' ? '满意' : '不满意'
            }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'segIndex'">
            {{ record.segIndex ? `第 ${record.segIndex} 段` : '整条' }}
          </template>
          <template v-else-if="column.dataIndex === 'reasons'">
            <a-tag v-for="r in record.reasons" :key="r" color="orange">{{ reasonLabel(r) }}</a-tag>
            <span v-if="!record.reasons.length" class="muted">—</span>
          </template>
          <template v-else-if="column.dataIndex === 'continuity'">
            {{ continuityLabel(record.continuity) }}
          </template>
          <template v-else-if="column.dataIndex === 'note'">
            <span class="note">{{ record.note || '—' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'updatedAt'">
            {{ fmtTime(record.updatedAt || record.createdAt) }}
          </template>
        </template>
      </a-table>

      <div class="pager">
        <span class="muted">共 {{ total }} 条</span>
        <a-pagination
          v-model:current="page"
          v-model:page-size="size"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="load"
        />
      </div>
    </a-card>

    <JobDetailDrawer v-model:open="detailOpen" :job-id="detailId" />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  getAdminFeedback,
  getFeedbackSummary,
  isReplicateMock,
  type AdminFeedback,
  type FeedbackSummary,
  type ReplicateContinuity,
} from '@/api/replicate-admin';

import {
  CONTINUITY_LABEL,
  FEEDBACK_REASON_LABEL,
  continuityLabel,
  fmtTime,
  reasonLabel,
} from '../replicate-job/job-meta';
import JobDetailDrawer from '../replicate-job/JobDetailDrawer.vue';

const ratingOptions = [
  { label: '满意', value: 'up' },
  { label: '不满意', value: 'down' },
];
const reasonOptions = Object.entries(FEEDBACK_REASON_LABEL).map(([value, label]) => ({
  label,
  value,
}));
const continuityOptions = Object.entries(CONTINUITY_LABEL).map(([value, label]) => ({
  label,
  value,
}));

const columns = [
  { title: '任务 ID', dataIndex: 'jobId', width: 90 },
  { title: '用户 ID', dataIndex: 'userId', width: 100 },
  { title: '评价', dataIndex: 'rating', width: 90 },
  { title: '范围', dataIndex: 'segIndex', width: 90 },
  { title: '原因', dataIndex: 'reasons', width: 240 },
  { title: '连贯度', dataIndex: 'continuity', width: 90 },
  { title: '备注', dataIndex: 'note' },
  { title: '反馈时间', dataIndex: 'updatedAt', width: 170 },
];

const filters = reactive({
  rating: undefined as 'up' | 'down' | undefined,
  reason: undefined as string | undefined,
  continuity: undefined as ReplicateContinuity | undefined,
  userId: '',
  jobId: '',
});
const range = ref<[string, string] | undefined>();
const page = ref(1);
const size = ref(20);
const rows = ref<AdminFeedback[]>([]);
const total = ref(0);
const loading = ref(false);

const summary = ref<FeedbackSummary>({ total: 0, up: 0, down: 0, byReason: [], byContinuity: [] });
const summaryLoading = ref(false);

const downRate = computed(() =>
  summary.value.total ? (summary.value.down / summary.value.total) * 100 : 0,
);
const continuityRows = computed(() =>
  summary.value.byContinuity.map((c) => {
    const all = c.up + c.down;
    return { ...c, rate: all ? ((c.down / all) * 100).toFixed(1) : '0.0' };
  }),
);
const reasonRows = computed(() => [...summary.value.byReason].sort((a, b) => b.count - a.count));
const maxCount = computed(() => Math.max(1, ...reasonRows.value.map((r) => r.count)));

/** 某连贯度下的接缝跳变率：选了接缝跳变的反馈数 ÷ 该连贯度不满意数 */
function seamRate(c: ReplicateContinuity): string {
  const seam = summary.value.byReason.find((r) => r.reason === 'seam_jump');
  const down = summary.value.byContinuity.find((x) => x.continuity === c)?.down ?? 0;
  if (!down) return '—';
  return `${(((seam?.[c] ?? 0) / down) * 100).toFixed(1)}%`;
}

const positiveInt = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

async function loadSummary() {
  summaryLoading.value = true;
  try {
    summary.value = await getFeedbackSummary({
      from: range.value?.[0] || undefined,
      to: range.value?.[1] || undefined,
    });
  } catch {
    /* 已提示 */
  } finally {
    summaryLoading.value = false;
  }
}

let seq = 0;
async function load() {
  const userId = positiveInt(filters.userId);
  const jobId = positiveInt(filters.jobId);
  if (Number.isNaN(userId) || Number.isNaN(jobId)) {
    message.warning('用户 ID / 任务 ID 需要是正整数');
    return;
  }
  const s = ++seq;
  loading.value = true;
  try {
    const res = await getAdminFeedback({
      page: page.value,
      pageSize: size.value,
      rating: filters.rating,
      reason: filters.reason as never,
      continuity: filters.continuity,
      from: range.value?.[0] || undefined,
      to: range.value?.[1] || undefined,
      userId,
      jobId,
    });
    if (s !== seq) return;
    rows.value = res.items;
    total.value = res.total;
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
}
function reloadFirst() {
  page.value = 1;
  load();
  loadSummary();
}
function reset() {
  Object.assign(filters, {
    rating: undefined,
    reason: undefined,
    continuity: undefined,
    userId: '',
    jobId: '',
  });
  range.value = undefined;
  reloadFirst();
}

const detailOpen = ref(false);
const detailId = ref(0);
function openDetail(id: number) {
  detailId.value = id;
  detailOpen.value = true;
}

onMounted(() => {
  load();
  loadSummary();
});
</script>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.stat-title {
  margin-bottom: 8px;
  color: var(--ant-color-text-secondary, #666);
}
.cont-row {
  padding: 2px 0;
}
.cont-name {
  display: inline-block;
  width: 64px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
.bar-name {
  width: 90px;
  flex: none;
}
.bar-track {
  flex: 1;
  max-width: 360px;
  height: 14px;
  border-radius: 7px;
  background: var(--ant-color-fill-quaternary, #f0f0f0);
}
.bar-fill {
  height: 100%;
  border-radius: 7px;
  background: var(--ant-color-primary, #1677ff);
}
.bar-count {
  width: 36px;
  flex: none;
  font-weight: 600;
}
.bar-split {
  flex: none;
}
.note {
  white-space: pre-wrap;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
@media (max-width: 1000px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
