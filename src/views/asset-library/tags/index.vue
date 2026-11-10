<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">标签字典</h2>
      <span class="muted">全部用户的资产标签及使用计数（只读）</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input-number v-model:value="query.userId" :min="0" placeholder="用户 ID（空 = 全部）" />
        <a-input
          v-model:value="query.q"
          allow-clear
          placeholder="标签名"
          style="width: 200px"
          @press-enter="search"
        />
        <a-button type="primary" @click="search">查询</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'createdAt'">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
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
import dayjs from 'dayjs';
import { reactive, ref } from 'vue';

import { listTags, type AdminTag } from '@/api/asset-library-admin';

const query = reactive({
  page: 1,
  pageSize: 20,
  userId: null as number | null,
  q: '',
});
const list = ref<AdminTag[]>([]);
const total = ref(0);
const loading = ref(false);

const columns = [
  { title: '标签名', dataIndex: 'name' },
  { title: '所属用户', dataIndex: 'userId' },
  { title: '使用计数', dataIndex: 'assetCount', align: 'right' as const },
  { title: '创建时间', dataIndex: 'createdAt' },
];

async function load() {
  loading.value = true;
  try {
    const r = await listTags({
      page: query.page,
      pageSize: query.pageSize,
      userId: query.userId || 0,
      q: query.q.trim() || undefined,
    });
    list.value = r?.list || [];
    total.value = r?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function onSize() {
  query.page = 1;
  load();
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
</style>
