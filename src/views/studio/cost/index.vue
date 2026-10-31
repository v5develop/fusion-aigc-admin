<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">成本汇总</h2>
      <span class="muted">按创建时间统计子任务数、上游成本与点数</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-range-picker v-model:value="range" @change="load" />
        <a-radio-group v-model:value="groupBy" button-style="solid" @change="load">
          <a-radio-button value="kind">按类型</a-radio-button>
          <a-radio-button value="model_group">按 model group</a-radio-button>
        </a-radio-group>
        <a-button @click="load">刷新</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="key"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'key'">
            {{ groupBy === 'kind' ? KIND_LABEL[record.key] || record.key : record.key || '-' }}
          </template>
        </template>
        <template #summary>
          <a-table-summary-row v-if="summary">
            <a-table-summary-cell><b>合计</b></a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.task_total }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.task_succeeded }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.task_failed }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.cost_cny }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.points }}</a-table-summary-cell>
          </a-table-summary-row>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import { ref } from 'vue';

import { getCostSummary, type CostRow } from '@/api/studio-admin';
import { KIND_LABEL, rangeToMs } from '@/utils/studio';

const range = ref<[Dayjs, Dayjs] | null>(null);
const groupBy = ref<'kind' | 'model_group'>('kind');
const rows = ref<CostRow[]>([]);
const summary = ref<CostRow | null>(null);
const loading = ref(false);

const columns = [
  { title: '分组', dataIndex: 'key' },
  { title: '任务数', dataIndex: 'task_total', align: 'right' as const },
  { title: '成功', dataIndex: 'task_succeeded', align: 'right' as const },
  { title: '失败', dataIndex: 'task_failed', align: 'right' as const },
  { title: '成本（元）', dataIndex: 'cost_cny', align: 'right' as const },
  { title: '点数', dataIndex: 'points', align: 'right' as const },
];

async function load() {
  loading.value = true;
  try {
    const result = await getCostSummary({ group_by: groupBy.value, ...rangeToMs(range.value) });
    rows.value = result?.rows || [];
    summary.value = result?.total || null;
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
</style>
