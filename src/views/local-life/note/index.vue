<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">图文笔记</h2>
      <span class="muted">只读，用于排查用户侧的笔记生成情况</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input-number
          v-model:value="userId"
          placeholder="用户 ID"
          :min="1"
          style="width: 160px"
          @change="onFilterChange"
        />
        <a-select
          v-model:value="status"
          :options="statusOptions"
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
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'content'">
            <div class="clamp-2">{{ record.content }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'image_urls'">
            <a-image-preview-group>
              <img v-for="(src, i) in record.image_urls" :key="i" :src="src" alt="" class="thumb" />
            </a-image-preview-group>
          </template>
          <template v-else-if="column.dataIndex === 'tags'">
            <a-tag v-for="t in record.tags" :key="t">{{ t }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'create_time'">{{
            formatTime(record.create_time)
          }}</template>
        </template>
      </a-table>

      <div class="pager">
        <a-pagination
          v-model:current="page"
          v-model:page-size="pageSize"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="load"
          @show-size-change="onSizeChange"
        />
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { listNotes, type NoteItem } from '@/api/local-life-admin';
import { formatTime } from '@/utils/format';

const rows = ref<NoteItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const userId = ref<number | null>(null);
const status = ref(-1);
const statusOptions = [
  { label: '全部状态', value: -1 },
  { label: '生成中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '失败', value: 3 },
];

const columns = [
  { title: '用户', dataIndex: 'user_id', width: 90 },
  { title: '类型', dataIndex: 'note_type_label', width: 120 },
  { title: '选题', dataIndex: 'topic', width: 160, ellipsis: true },
  { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
  { title: '正文', dataIndex: 'content' },
  { title: '标签', dataIndex: 'tags', width: 200 },
  { title: '配图', dataIndex: 'image_urls', width: 240 },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '失败原因', dataIndex: 'fail_reason', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'create_time', width: 170 },
];

function onFilterChange() {
  page.value = 1;
  load();
}

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    const result = await listNotes({
      user_id: userId.value ?? undefined,
      status: status.value,
      page: page.value,
      page_size: pageSize.value,
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
.thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  margin-right: 6px;
}
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
</style>
