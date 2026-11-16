<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">视频做同款 · 任务管理</h2>
      <a-tag v-if="isReplicateMock()" color="orange">mock 数据</a-tag>
    </div>

    <SwitchBar />

    <a-card variant="borderless">
      <div class="filter-bar">
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
          placeholder="job id"
          style="width: 110px"
          @press-enter="reloadFirst"
        />
        <a-input
          v-model:value="filters.taskId"
          allow-clear
          placeholder="任务号 / 方案号"
          style="width: 220px"
          @press-enter="reloadFirst"
        />
        <a-input
          v-model:value="filters.planNo"
          allow-clear
          placeholder="方案号"
          style="width: 160px"
          @press-enter="reloadFirst"
        />
        <a-select
          v-model:value="filters.status"
          mode="multiple"
          allow-clear
          placeholder="状态（可多选）"
          style="width: 220px"
          :options="statusOptions"
          @change="reloadFirst"
        />
        <a-range-picker
          v-model:value="range"
          value-format="YYYY-MM-DD"
          :placeholder="['创建自', '创建至']"
          style="width: 240px"
          @change="reloadFirst"
        />
        <a-button type="primary" @click="reloadFirst">查询</a-button>
        <a-button @click="reset">重置</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="jobId"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #emptyText>
          <a-empty description="没有符合条件的任务" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'jobId'">
            <a @click="openDetail(record.jobId)">#{{ record.jobId }}</a>
          </template>
          <template v-else-if="column.dataIndex === 'taskId'">
            <code class="code">{{ record.taskId }}</code>
            <div class="muted">{{ record.planNo }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'user'">
            {{ record.userId }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.statusLabel }}</a-tag>
            <div v-if="record.stopReason === 'admin_force'" class="muted">后台强制收尾</div>
          </template>
          <template v-else-if="column.dataIndex === 'segs'">
            {{ record.segDone }}/{{ record.segTotal }}
            <span v-if="record.segFailed" class="bad">（失败 {{ record.segFailed }}）</span>
            <span v-if="record.redoCount" class="muted"> · 重做 {{ record.redoCount }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'error'">
            <span class="bad">{{ record.error }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'createdAt'">
            {{ fmtTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-button size="small" type="link" @click="openDetail(record.jobId)">详情</a-button>
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

    <JobDetailDrawer v-model:open="detailOpen" :job-id="detailId" @changed="load" />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { onMounted, reactive, ref } from 'vue';

import {
  getAdminJobs,
  isReplicateMock,
  type AdminJobRow,
  type JobStatus,
} from '@/api/replicate-admin';

import { STATUS_LABEL, fmtTime, statusColor } from './job-meta';
import JobDetailDrawer from './JobDetailDrawer.vue';
import SwitchBar from './SwitchBar.vue';

const statusOptions = (Object.keys(STATUS_LABEL) as JobStatus[]).map((v) => ({
  label: STATUS_LABEL[v],
  value: v,
}));

const columns = [
  { title: 'job', dataIndex: 'jobId', width: 90 },
  { title: '任务号 / 方案号', dataIndex: 'taskId', width: 250 },
  { title: '用户 ID', dataIndex: 'user', width: 100 },
  { title: '状态', dataIndex: 'status', width: 140 },
  { title: '段进度', dataIndex: 'segs', width: 170 },
  { title: '失败原因', dataIndex: 'error', width: 260 },
  { title: '创建时间', dataIndex: 'createdAt', width: 170 },
  { title: '操作', key: 'operation', width: 80, fixed: 'right' as const },
];

const filters = reactive({
  userId: '',
  jobId: '',
  taskId: '',
  planNo: '',
  status: [] as JobStatus[],
});
const range = ref<[string, string] | undefined>();
const page = ref(1);
const size = ref(20);
const rows = ref<AdminJobRow[]>([]);
const total = ref(0);
const loading = ref(false);

const positiveInt = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

let seq = 0;
async function load() {
  const userId = positiveInt(filters.userId);
  const jobId = positiveInt(filters.jobId);
  if (Number.isNaN(userId) || Number.isNaN(jobId)) {
    message.warning('用户 ID / job id 需要是正整数');
    return;
  }
  const s = ++seq;
  loading.value = true;
  try {
    const res = await getAdminJobs({
      userId,
      jobId,
      taskId: filters.taskId.trim() || undefined,
      planNo: filters.planNo.trim() || undefined,
      status: filters.status.length ? filters.status.join(',') : undefined,
      // 后端认纯日期（北京时间），日期形式的 to 含当天
      from: range.value?.[0] || undefined,
      to: range.value?.[1] || undefined,
      page: page.value,
      size: size.value,
    });
    if (s !== seq) return;
    rows.value = res?.items ?? [];
    total.value = res?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
}
function reloadFirst() {
  page.value = 1;
  load();
}
function reset() {
  Object.assign(filters, {
    userId: '',
    jobId: '',
    taskId: '',
    status: [],
    planNo: '',
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

onMounted(load);
</script>

<style scoped>
.code {
  font-size: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
