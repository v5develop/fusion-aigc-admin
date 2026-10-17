<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">文案管理</h2>
      <span v-if="model" class="muted">当前模型：{{ model.name }}（{{ model.code }}）</span>
    </div>

    <a-card variant="borderless">
      <a-tabs v-model:active-key="tab">
        <a-tab-pane key="options" tab="选项">
          <OptionManager
            :types="optionTypes"
            :api="{
              list: listCopywritingOptions,
              create: createCopywritingOption,
              update: updateCopywritingOption,
              remove: deleteCopywritingOption,
            }"
          />
        </a-tab-pane>

        <a-tab-pane key="records" tab="文案记录">
          <div class="filter-bar">
            <a-input-number
              v-model:value="userId"
              placeholder="用户 ID"
              :min="1"
              style="width: 160px"
              @change="onFilterChange"
            />
            <a-input
              v-model:value="keyword"
              placeholder="按标题/正文搜索"
              allow-clear
              style="width: 240px"
              @press-enter="onFilterChange"
              @change="onKeywordChange"
            />
          </div>

          <a-table
            :columns="visibleColumns"
            :data-source="rows"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'body'">
                <div class="clamp-2">{{ record.body }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'create_time'">{{
                formatTime(record.create_time)
              }}</template>
              <template v-else-if="column.dataIndex === 'operation' && canEdit">
                <a-popconfirm title="确认删除这条文案？" @confirm="remove(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </template>
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
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';

import {
  type CopywritingItem,
  createCopywritingOption,
  deleteCopywriting,
  deleteCopywritingOption,
  getCopywritingModel,
  listCopywriting,
  listCopywritingOptions,
  type ModelInfo,
  updateCopywritingOption,
} from '@/api/local-life-admin';
import { formatTime } from '@/utils/format';
import { hasLocalLifePermission, LOCAL_LIFE_UPDATE } from '@/utils/local-life-permission';
import OptionManager from '@/views/local-life/components/OptionManager.vue';

const optionTypes = [
  { label: '内容类型', value: 'CONTENT_TYPE' },
  { label: '风格', value: 'STYLE' },
  { label: '行业', value: 'INDUSTRY' },
  { label: '字数', value: 'WORD_COUNT' },
  { label: '提示词', value: 'PROMPT' },
  { label: '敏感词', value: 'BLOCKWORD' },
];

const canEdit = computed(() => hasLocalLifePermission(LOCAL_LIFE_UPDATE));
const tab = ref('options');
const model = ref<ModelInfo | null>(null);
const rows = ref<CopywritingItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const userId = ref<number | null>(null);
const keyword = ref('');

const columns = [
  { title: '类型', dataIndex: 'content_type_label', width: 120 },
  { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
  { title: '正文', dataIndex: 'body' },
  { title: '字数', dataIndex: 'word_count', width: 90, align: 'center' as const },
  { title: '来源', dataIndex: 'source', width: 120 },
  { title: '时间', dataIndex: 'create_time', width: 170 },
  { title: '操作', dataIndex: 'operation', width: 90, align: 'center' as const },
];
const visibleColumns = computed(() =>
  columns.filter((c) => canEdit.value || c.dataIndex !== 'operation'),
);

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(onFilterChange, 300);
}

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
    const result = await listCopywriting({
      user_id: userId.value ?? undefined,
      keyword: keyword.value.trim() || undefined,
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

async function remove(id: number) {
  try {
    await deleteCopywriting(id);
    message.success('已删除');
    load();
  } catch {
    /* 已由 API 层提示 */
  }
}

onMounted(async () => {
  try {
    model.value = await getCopywritingModel();
  } catch {
    /* 模型信息仅用于展示 */
  }
  load();
});
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
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
</style>
