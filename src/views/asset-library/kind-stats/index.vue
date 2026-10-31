<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">分类统计</h2>
      <span class="muted">资产按分类 × 来源的数量（不含已删除）</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input-number v-model:value="userId" :min="0" placeholder="用户 ID（空 = 全部）" />
        <a-select v-model:value="media" style="width: 140px" @change="load">
          <a-select-option value="">图片 + 视频</a-select-option>
          <a-select-option value="image">仅图片</a-select-option>
          <a-select-option value="video">仅视频</a-select-option>
        </a-select>
        <a-button type="primary" @click="load">查询</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="tableRows"
        :loading="loading"
        :pagination="false"
        row-key="kind"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'label'">{{ record.label }}</template>
        </template>
        <template #summary>
          <a-table-summary-row v-if="tableRows.length">
            <a-table-summary-cell><b>合计</b></a-table-summary-cell>
            <a-table-summary-cell v-for="s in SOURCES" :key="s.key" align="right">
              {{ sourceTotals[s.key] ?? 0 }}
            </a-table-summary-cell>
            <a-table-summary-cell align="right">
              <b>{{ grandTotal }}</b>
            </a-table-summary-cell>
          </a-table-summary-row>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { getKindStats, type KindStatsResp } from '@/api/assetlib-admin';

const SOURCES = [
  { key: 'upload', label: '上传' },
  { key: 'generated', label: '生成' },
  { key: 'official', label: '官方' },
];

const userId = ref<number | null>(null);
const media = ref<'' | 'image' | 'video'>('');
const data = ref<KindStatsResp | null>(null);
const loading = ref(false);

const columns = [
  { title: '分类', dataIndex: 'label' },
  ...SOURCES.map((s) => ({
    title: s.label,
    dataIndex: s.key,
    align: 'right' as const,
  })),
  { title: '合计', dataIndex: 'total', align: 'right' as const },
];

/** kind 汇总里的 all 是总数，表格行不展示，合计另算。 */
const tableRows = computed(() => {
  if (!data.value) return [];
  const bySource = new Map<string, Record<string, number>>();
  for (const r of data.value.rows) {
    const m = bySource.get(r.kind) ?? {};
    m[r.source] = (m[r.source] ?? 0) + r.count;
    bySource.set(r.kind, m);
  }
  return data.value.kinds
    .filter((k) => k.key !== 'all')
    .map((k) => {
      const m = bySource.get(k.key) ?? {};
      return { kind: k.key, label: k.label || k.key, ...m, total: k.count };
    });
});

const sourceTotals = computed(() => {
  const out: Record<string, number> = {};
  for (const s of data.value?.sources ?? []) out[s.key] = s.count;
  return out;
});

const grandTotal = computed(
  () =>
    data.value?.kinds.find((k) => k.key === 'all')?.count ??
    tableRows.value.reduce((a, r) => a + r.total, 0),
);

async function load() {
  loading.value = true;
  try {
    data.value = await getKindStats({ user_id: userId.value || 0, media: media.value });
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
