<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">画布成本汇总</h2>
      <span class="muted">按创建时间统计 run 数、成本与点数</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-range-picker v-model:value="range" @change="load" />
        <a-radio-group v-model:value="groupBy" button-style="solid" @change="load">
          <a-radio-button value="kind">按 kind</a-radio-button>
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
            {{ groupBy === 'kind' ? RUN_KIND_LABEL[record.key] || record.key : record.key || '-' }}
          </template>
        </template>
        <template #summary>
          <a-table-summary-row v-if="rows.length">
            <a-table-summary-cell><b>合计</b></a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.runs }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.succeeded }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.failed }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.canceled }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.cost }}</a-table-summary-cell>
            <a-table-summary-cell align="right">{{ summary.points }}</a-table-summary-cell>
          </a-table-summary-row>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import { computed, ref } from 'vue';

import { getCostSummary, type CostRow } from '@/api/canvas-admin';
import { RUN_KIND_LABEL, rangeToStartEnd } from '@/utils/canvas';

const range = ref<[Dayjs, Dayjs] | null>(null);
const groupBy = ref<'kind' | 'model_group'>('kind');
const rows = ref<CostRow[]>([]);
const loading = ref(false);

const columns = [
  { title: '分组', dataIndex: 'key' },
  { title: 'run 数', dataIndex: 'runs', align: 'right' as const },
  { title: '成功', dataIndex: 'succeeded', align: 'right' as const },
  { title: '失败', dataIndex: 'failed', align: 'right' as const },
  { title: '已取消', dataIndex: 'canceled', align: 'right' as const },
  { title: '成本（元）', dataIndex: 'costCny', align: 'right' as const },
  { title: '点数', dataIndex: 'points', align: 'right' as const },
];

/** 接口只返回分组行，合计在前端累加 */
const summary = computed(() => {
  const s = { runs: 0, succeeded: 0, failed: 0, canceled: 0, cost: 0, points: 0 };
  for (const r of rows.value) {
    s.runs += r.runs;
    s.succeeded += r.succeeded;
    s.failed += r.failed;
    s.canceled += r.canceled;
    s.cost += Number(r.costCny) || 0;
    s.points += r.points;
  }
  return { ...s, cost: s.cost.toFixed(4) };
});

async function load() {
  loading.value = true;
  try {
    const result = await getCostSummary({
      groupBy: groupBy.value,
      ...rangeToStartEnd(range.value),
    });
    rows.value = result?.rows || [];
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
