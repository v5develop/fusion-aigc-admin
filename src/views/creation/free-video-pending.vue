<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ t('creationFreeVideoPending.title') }}</h2>
      <a-button :loading="loading" @click="loadList">{{
        t('creationFreeVideoPending.refresh')
      }}</a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="t('creationFreeVideoPending.hint')"
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
          <a-empty :description="t('creationFreeVideoPending.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'taskId'">
            <code class="route-code">{{ record.taskId }}</code>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag>{{ statusLabel(record.status) }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'operation'">
            <a-popconfirm
              :title="t('creationFreeVideoPending.confirmRetry', { taskId: record.taskId })"
              :ok-text="t('creationFreeVideoPending.retry')"
              :cancel-text="t('common.cancel')"
              @confirm="retry(record)"
            >
              <a-button
                v-permission="'task:retry'"
                type="link"
                size="small"
                :loading="busyTaskId === record.taskId"
              >
                {{ t('creationFreeVideoPending.retry') }}
              </a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { FreeVideoPendingTask } from '@/api/creation-task';

import { message } from 'antdv-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getFreeVideoPendingTasks, retryFreeVideoFinalize } from '@/api/creation-task';

const { t } = useI18n();

const columns = computed(() => [
  { title: t('creationFreeVideoPending.colTaskId'), dataIndex: 'taskId', width: 300 },
  { title: t('creationFreeVideoPending.colUserId'), dataIndex: 'userId', width: 120 },
  {
    title: t('creationFreeVideoPending.colStatus'),
    dataIndex: 'status',
    width: 120,
    align: 'center' as const,
  },
  { title: t('creationFreeVideoPending.colCreateTime'), dataIndex: 'createTime', width: 170 },
  { title: t('creationFreeVideoPending.colUpdateTime'), dataIndex: 'updateTime', width: 170 },
  {
    title: t('creationFreeVideoPending.colOperation'),
    dataIndex: 'operation',
    width: 140,
    align: 'center' as const,
  },
]);

const STATUS_LABEL_KEYS: Record<number, string> = {
  0: 'creationFreeVideoPending.statusQueuing',
  1: 'creationFreeVideoPending.statusProcessing',
  2: 'creationFreeVideoPending.statusCompleted',
  3: 'creationFreeVideoPending.statusFailed',
  4: 'creationFreeVideoPending.statusCancelled',
  5: 'creationFreeVideoPending.statusPartial',
};

function statusLabel(status: number) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : String(status);
}

const rows = ref<FreeVideoPendingTask[]>([]);
const loading = ref(false);
const busyTaskId = ref<string | null>(null);

async function loadList() {
  loading.value = true;
  try {
    const list = await getFreeVideoPendingTasks(50);
    rows.value = list || [];
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function retry(record: FreeVideoPendingTask) {
  busyTaskId.value = record.taskId;
  try {
    await retryFreeVideoFinalize(record.taskId);
    message.success(t('creationFreeVideoPending.retrySuccess'));
    await loadList();
  } catch {
    /* 拦截器已提示 */
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
.route-code {
  font-size: 12px;
}
</style>
