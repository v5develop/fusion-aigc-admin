<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">视频封面待处理</h2>
      <a-button :loading="loading" @click="loadList">刷新</a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      message="这些任务的视频已经交付，只是自动抽帧封面失败（已尝试多次）。先看失败原因，确认源视频可以解码后点「重新生成」；仍然失败就保持待处理，原因会更新。"
    />

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="taskId"
        size="middle"
      >
        <template #emptyText>
          <a-empty description="没有待处理的封面" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'taskId'">
            <code class="route-code">{{ record.taskId }}</code>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 5 ? 'orange' : 'green'">
              {{ record.status === 5 ? '部分成功' : '成功' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'coverError'">
            <span class="error-text">{{ record.coverError || '未记录原因' }}</span>
          </template>

          <template v-if="column.dataIndex === 'resultUrl'">
            <a
              v-if="record.resultUrl"
              :href="record.resultUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              打开成片
            </a>
            <span v-else class="muted">无成片地址</span>
          </template>

          <template v-if="column.dataIndex === 'operation'">
            <a-popconfirm
              :title="`用源视频重新抽帧 ${record.taskId}？`"
              :disabled="!record.hasSourceVideo"
              @confirm="regenerate(record)"
            >
              <a-button
                type="link"
                size="small"
                :disabled="!record.hasSourceVideo"
                :loading="busyTaskId === record.taskId"
              >
                重新生成
              </a-button>
            </a-popconfirm>
            <div v-if="!record.hasSourceVideo" class="muted">缺少源视频，无法重新生成</div>
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
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref } from 'vue';

import { type CoverPendingRow, getCoverPending, regenerateCover } from '@/api/creation-cover';

const columns = [
  { title: '任务', dataIndex: 'taskId', width: 300 },
  { title: '状态', dataIndex: 'status', width: 100, align: 'center' as const },
  { title: '失败原因', dataIndex: 'coverError' },
  { title: '成片', dataIndex: 'resultUrl', width: 110 },
  { title: '更新时间', dataIndex: 'updateTime', width: 170 },
  { title: '操作', dataIndex: 'operation', width: 160, align: 'center' as const },
];

const rows = ref<CoverPendingRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const busyTaskId = ref<string | null>(null);

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}

async function loadList() {
  loading.value = true;
  try {
    const result = await getCoverPending({ page: page.value, pageSize: pageSize.value });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
    // 本页被处理完、回到空页时回退一页
    if (!rows.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
      return loadList();
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function regenerate(record: CoverPendingRow) {
  busyTaskId.value = record.taskId;
  try {
    await regenerateCover(record.taskId);
    message.success('封面已重新生成');
    loadList();
  } catch {
    /* 拦截器已提示；失败原因在列表里已更新为本次报错 */
    loadList();
  } finally {
    busyTaskId.value = null;
  }
}

loadList();
</script>

<style scoped>
.page-container {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.ph-title {
  margin: 0;
  font-size: 18px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.route-code {
  font-size: 12px;
}
.error-text {
  color: var(--color-error, #cf1322);
  font-size: 12px;
  word-break: break-all;
}
</style>
