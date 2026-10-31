<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">反推服务状态</h2>
      <a-button type="primary" :loading="loading" @click="load">刷新</a-button>
    </div>

    <a-card variant="borderless">
      <a-descriptions v-if="status" :column="2" size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="运行中子任务">{{ status.running_tasks }}</a-descriptions-item>
        <a-descriptions-item label="排队批次">{{ status.queued_batches }}</a-descriptions-item>
      </a-descriptions>

      <a-table
        :columns="columns"
        :data-source="status?.deps || []"
        :loading="loading"
        :pagination="false"
        row-key="name"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'name'">
            {{ DEP_LABEL[record.name] || record.name }}
          </template>
          <template v-else-if="column.dataIndex === 'ok'">
            <a-tag :color="record.ok ? 'success' : 'error'">{{
              record.ok ? '正常' : '异常'
            }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'latency_ms'">
            {{ record.latency_ms }} ms
          </template>
        </template>
      </a-table>
      <p class="muted tip">
        detail 为服务返回的模型 / Key 配置情况；Key 只显示是否已配置，不会回显内容。
      </p>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { getSidecarStatus, type SidecarStatus } from '@/api/studio-admin';

const DEP_LABEL: Record<string, string> = {
  sidecar: '反推服务（sidecar）',
  'ai-gateway': 'AI 网关',
  media: '媒体服务',
};

const status = ref<SidecarStatus | null>(null);
const loading = ref(false);

const columns = [
  { title: '服务', dataIndex: 'name', width: 200 },
  { title: '状态', dataIndex: 'ok', width: 90 },
  { title: '版本', dataIndex: 'version', width: 140 },
  { title: '延迟', dataIndex: 'latency_ms', width: 100 },
  { title: '地址', dataIndex: 'base_url', ellipsis: true },
  { title: '详情（模型 / Key 是否配置）', dataIndex: 'detail', ellipsis: true },
];

async function load() {
  loading.value = true;
  try {
    status.value = await getSidecarStatus();
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
.tip {
  margin-top: 12px;
}
</style>
