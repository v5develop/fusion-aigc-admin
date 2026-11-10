<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">节点执行</h2>
      <span class="muted">画布节点的执行记录（run），用于排查失败与对账</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input
          v-model:value="query.canvasId"
          placeholder="画布 ID"
          allow-clear
          style="width: 200px"
          @press-enter="onFilter"
        />
        <a-input-number
          v-model:value="query.userId"
          placeholder="用户 ID"
          :min="1"
          style="width: 130px"
          @change="onFilter"
        />
        <a-select
          v-model:value="query.kind"
          :options="kindOptions"
          style="width: 150px"
          @change="onFilter"
        />
        <a-select
          v-model:value="query.backend"
          :options="backendOptions"
          style="width: 130px"
          @change="onFilter"
        />
        <a-select
          v-model:value="query.status"
          :options="statusOptions"
          style="width: 120px"
          @change="onFilter"
        />
        <a-range-picker v-model:value="range" @change="onFilter" />
        <a-button @click="load">刷新</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'runId'">
            <a-typography-text copyable :content="record.runId" style="font-size: 12px">
              {{ record.runId }}
            </a-typography-text>
          </template>
          <template v-else-if="column.dataIndex === 'canvasId'">
            <div>{{ record.canvasId }}</div>
            <div class="muted">用户 {{ record.userId }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'kind'">
            {{ RUN_KIND_LABEL[record.kind] || record.kind }}
          </template>
          <template v-else-if="column.dataIndex === 'backend'">
            <a-tag>{{ record.backend || '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusTag(record.status).color">{{
              statusTag(record.status).text
            }}</a-tag>
            <a-tag v-if="record.billingStatus === 'unsettled'" color="warning">{{
              RUN_BILLING_STATUS.unsettled.text
            }}</a-tag>
            <a-tag v-else-if="record.billingStatus === 'review'" color="warning">{{
              RUN_BILLING_STATUS.review.text
            }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'candidates'">
            <div class="thumbs">
              <a-image
                v-for="(url, i) in (record.candidates || []).slice(0, 3)"
                :key="i"
                :src="url"
                :width="40"
                :height="40"
                class="thumb"
              />
              <span v-if="!(record.candidates || []).length" class="muted">-</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'costCny'">
            {{ record.costCny || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'error'">
            <a-tooltip v-if="record.error" :title="record.error">
              <span class="bad err">{{ record.errorCode || record.error }}</span>
            </a-tooltip>
            <span v-else class="muted">-</span>
          </template>
          <template v-else-if="column.dataIndex === 'createdAt'">{{
            formatTime(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              v-if="canUpdate && isRunActive(record.status)"
              title="确认强制失败该 run？gateway 后端会退款并取消上游。"
              ok-text="强制失败"
              @confirm="forceFail(record)"
            >
              <a-button type="link" size="small" danger>强制失败</a-button>
            </a-popconfirm>
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
  </div>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import { message } from 'antdv-next';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import { forceFailRun, listRuns, type CanvasRun } from '@/api/canvas-admin';
import {
  BACKEND_OPTIONS,
  RUN_KIND_LABEL,
  RUN_BILLING_STATUS,
  RUN_STATUS,
  RUN_STATUS_OPTIONS,
  isRunActive,
  rangeToStartEnd,
} from '@/utils/canvas';
import { CANVAS_UPDATE, hasCanvasPermission } from '@/utils/canvas-permission';
import { formatTime } from '@/utils/format';

const canUpdate = computed(() => hasCanvasPermission(CANVAS_UPDATE));

const kindOptions = [
  { label: '全部类型', value: '' },
  ...Object.entries(RUN_KIND_LABEL).map(([value, label]) => ({ label, value })),
];
const backendOptions = [
  { label: '全部后端', value: '' },
  ...BACKEND_OPTIONS.map((value) => ({ label: value, value })),
];
const statusOptions = [
  { label: '全部状态', value: -1 },
  ...RUN_STATUS_OPTIONS.map((s) => ({ label: s.text, value: s.value })),
];

const route = useRoute();
const query = ref({
  // 支持从任务详情跳转：/canvas/runs?canvas_id=cv_xxx
  canvasId: String(route.query.canvasId || ''),
  userId: null as number | null,
  kind: '',
  backend: '',
  status: -1,
  page: 1,
  pageSize: 20,
});
const range = ref<[Dayjs, Dayjs] | null>(null);
const rows = ref<CanvasRun[]>([]);
const total = ref(0);
const loading = ref(false);

const columns = [
  { title: 'run_id', dataIndex: 'runId', width: 210 },
  { title: '画布', dataIndex: 'canvasId', width: 170 },
  { title: '节点', dataIndex: 'nodeId', width: 130 },
  { title: 'kind', dataIndex: 'kind', width: 120 },
  { title: '后端', dataIndex: 'backend', width: 90 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '候选图', dataIndex: 'candidates', width: 150 },
  { title: '成本（元）', dataIndex: 'costCny', width: 100, align: 'right' as const },
  { title: '错误', dataIndex: 'error', width: 160 },
  { title: '创建时间', dataIndex: 'createdAt', width: 170 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
];

function statusTag(s: string) {
  return RUN_STATUS[s] ?? { text: s, color: 'default' };
}

function onFilter() {
  query.value.page = 1;
  load();
}

function onSize(_c: number, size: number) {
  query.value.pageSize = size;
  query.value.page = 1;
  load();
}

async function forceFail(record: CanvasRun) {
  try {
    await forceFailRun(record.id);
    message.success('已强制失败');
    load();
  } catch {
    /* 已由 API 层提示 */
  }
}

async function load() {
  loading.value = true;
  try {
    const q = query.value;
    const result = await listRuns({
      canvasId: q.canvasId.trim() || undefined,
      userId: q.userId ?? undefined,
      kind: (q.kind || undefined) as never,
      backend: (q.backend || undefined) as never,
      status: q.status,
      ...rangeToStartEnd(range.value),
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
.thumbs {
  display: flex;
  gap: 4px;
}
.thumb {
  object-fit: cover;
  border-radius: 4px;
}
.err {
  display: inline-block;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
</style>
