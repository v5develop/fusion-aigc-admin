<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">批次列表</h2>
      <span class="muted">创作商拍（商拍 / 姿态 / 图片生成）的批次，用于排查与对账</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="query.kind"
          :options="kindOptions"
          style="width: 140px"
          @change="onFilter"
        />
        <a-select
          v-model:value="query.status"
          :options="statusOptions"
          style="width: 140px"
          @change="onFilter"
        />
        <a-input-number
          v-model:value="query.userId"
          placeholder="用户 ID"
          :min="1"
          style="width: 140px"
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
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'kind'">
            {{ KIND_LABEL[record.kind] || record.kind }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <TraceTag :tone="statusTag(BATCH_STATUS, record.status).color">{{
              statusTag(BATCH_STATUS, record.status).text
            }}</TraceTag>
          </template>
          <template v-else-if="column.dataIndex === 'tasks'">
            <span class="ok">{{ record.taskDone }}</span> /
            <span :class="{ bad: record.taskFailed > 0 }">{{ record.taskFailed }}</span> /
            {{ record.taskTotal }}
          </template>
          <template v-else-if="column.dataIndex === 'createdAt'">{{
            formatTime(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="toDetail(record.id)">详情</a-button>
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
import TraceTag from '@/components/TraceTag/index.vue';
import type { Dayjs } from 'dayjs';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { listBatches, type Batch } from '@/api/studio-admin';
import { formatTime } from '@/utils/format';
import { BATCH_STATUS, KIND_LABEL, rangeToMs, statusTag } from '@/utils/studio';

const router = useRouter();

const kindOptions = [
  { label: '全部类型', value: '' },
  { label: '商拍', value: 'tryon' },
  { label: '姿态', value: 'pose' },
  { label: '图片生成', value: 'imagegen' },
];
const statusOptions = [
  { label: '全部状态', value: -1 },
  ...Object.entries(BATCH_STATUS).map(([k, v]) => ({ label: v.text, value: Number(k) })),
];

const query = ref({
  kind: '' as string,
  status: -1,
  userId: null as number | null,
  page: 1,
  pageSize: 20,
});
const range = ref<[Dayjs, Dayjs] | null>(null);
const rows = ref<Batch[]>([]);
const total = ref(0);
const loading = ref(false);

const columns = [
  { title: '批次 ID', dataIndex: 'id', width: 100 },
  { title: '用户', dataIndex: 'userId', width: 100 },
  { title: '类型', dataIndex: 'kind', width: 100 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '任务 完成 / 失败 / 总数', dataIndex: 'tasks', width: 180 },
  { title: '预估点数', dataIndex: 'estimatedPoints', width: 100, align: 'right' as const },
  { title: '创建时间', dataIndex: 'createdAt', width: 170 },
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

function toDetail(id: number) {
  router.push(`/studio/batches/${id}`);
}

async function load() {
  loading.value = true;
  try {
    const q = query.value;
    const result = await listBatches({
      kind: (q.kind || undefined) as never,
      status: q.status,
      userId: q.userId ?? undefined,
      ...rangeToMs(range.value),
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
.ok {
  color: var(--color-success, #52c41a);
}
.bad {
  color: var(--color-error, #ff4d4f);
}
</style>
