<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 用户自建本地生活模板</h2>
    </div>

    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="这是用户的私有内容，后台只读：不能在这里新增、编辑或删除。查看载荷会记录审计日志。"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input-number
          v-model:value="userIdFilter"
          placeholder="按用户 id 精确过滤"
          :min="1"
          style="width: 220px"
          @change="onFilterChange"
          @press-enter="onFilterChange"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按标题过滤"
          allow-clear
          style="width: 220px"
          @press-enter="onFilterChange"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
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
        <template #emptyText>
          <a-empty description="暂无用户自建模板" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">{{ record.title }}</div>
            <code class="route-code">#{{ record.id }}</code>
          </template>

          <template v-if="column.dataIndex === 'payloadJson'">
            <a-button
              type="link"
              size="small"
              :loading="detailLoadingId === record.id"
              @click="openPayload(record)"
            >
              查看载荷
            </a-button>
          </template>

          <template v-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled === 1 ? 'green' : 'default'">
              {{ record.enabled === 1 ? '启用' : '停用' }}
            </a-tag>
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
          @change="loadList"
          @show-size-change="onSizeChange"
        />
      </div>
    </a-card>

    <a-modal
      v-model:open="payloadVisible"
      :title="`模板载荷（#${payloadTitleId ?? ''}，库里原文）`"
      width="720px"
      :footer="null"
    >
      <pre class="payload-view">{{ payloadText }}</pre>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref } from 'vue';

import {
  getCreaftUserLocalLifeTemplate,
  getCreaftUserLocalLifeTemplates,
  type CreaftTemplateRow,
} from '@/api/creaft-compat';

const columns = [
  { title: '模板', dataIndex: 'title', width: 300 },
  { title: '所属用户', dataIndex: 'userId', width: 120, align: 'center' as const },
  { title: '分类', dataIndex: 'category', width: 130 },
  { title: '更新时间', dataIndex: 'updateTime', width: 180 },
  { title: '载荷', dataIndex: 'payloadJson', width: 120 },
  { title: '状态', dataIndex: 'enabled', width: 90, align: 'center' as const },
];
const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

const rows = ref<CreaftTemplateRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const userIdFilter = ref<number | null>(null);
const keyword = ref('');
const enabledFilter = ref<'' | 1 | 0>('');

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(onFilterChange, 300);
}

function onFilterChange() {
  page.value = 1;
  loadList();
}

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}

async function loadList() {
  loading.value = true;
  try {
    const result = await getCreaftUserLocalLifeTemplates({
      userId: userIdFilter.value || undefined,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

loadList();

// ---- 载荷查看：点击时才拉详情，服务端会写审计 ----
const payloadVisible = ref(false);
const payloadText = ref('');
const payloadTitleId = ref<number | null>(null);
const detailLoadingId = ref<number | null>(null);

async function openPayload(record: CreaftTemplateRow) {
  detailLoadingId.value = record.id;
  try {
    const detail = await getCreaftUserLocalLifeTemplate(record.id);
    payloadTitleId.value = detail.id;
    payloadText.value = pretty(detail.payloadJson);
    payloadVisible.value = true;
  } catch {
    message.error('读取模板失败');
  } finally {
    detailLoadingId.value = null;
  }
}

function pretty(json: string | null) {
  if (!json) return '{}';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.title-cell {
  font-weight: 500;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
.payload-view {
  max-height: 60vh;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
