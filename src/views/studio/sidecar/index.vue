<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">反推服务状态</h2>
      <a-button type="primary" :loading="loading" @click="load">刷新</a-button>
    </div>

    <a-alert
      v-if="sidecarVersion"
      class="ver-alert"
      show-icon
      :type="ALERT_TYPE[sidecarVersionState!]"
      :title="
        sidecarVersionState === 'outdated'
          ? `反推服务版本较旧（当前 ${sidecarVersion}）`
          : sidecarVersionState === 'unknown'
            ? `反推服务版本无法识别（当前 ${sidecarVersion}）`
            : `反推服务版本 ${sidecarVersion}`
      "
      :description="
        sidecarVersionState === 'ok'
          ? undefined
          : `多人姿势配对与新版商拍提示词需要 ${EXPECTED_SIDECAR_VERSION} 及以上${sidecarVersionState === 'outdated' ? '，请升级反推服务' : '，请确认部署的版本'}。`
      "
    />

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
          <template v-else-if="column.dataIndex === 'version'">
            <span
              v-if="record.name === 'sidecar' && record.version"
              class="ver-text"
              :class="{ outdated: versionState(record.version) !== 'ok' }"
              >{{ record.version }}</span
            >
            <template v-else>{{ record.version || '-' }}</template>
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
import { computed, ref } from 'vue';

import { getSidecarStatus, type SidecarStatus } from '@/api/studio-admin';

/** 期望的反推服务最低版本；升级时只改这里。版本串以发布日期开头（2026-11-07.merged / 2026-11-07.1 / 2026-11-07-hotfix） */
const EXPECTED_SIDECAR_VERSION = '2026-11-07.merged';

type VersionState = 'ok' | 'outdated' | 'unknown';

/**
 * 只比日期前缀：同一天的 .1 / .2 / .merged / -hotfix 都算满足（整串按字典序比会把 '.1' 判得比 '.merged' 旧）。
 * 不是「YYYY-MM-DD…」开头的版本串（如 mock-2026-10-30）无法判断，显示为未知，不给绿色。
 */
function versionState(version: string): VersionState {
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(version.trim())?.[1];
  const expected = /^(\d{4}-\d{2}-\d{2})/.exec(EXPECTED_SIDECAR_VERSION)![1]!;
  if (!date) return 'unknown';
  return date < expected ? 'outdated' : 'ok';
}

const ALERT_TYPE: Record<VersionState, 'success' | 'warning' | 'info'> = {
  ok: 'success',
  outdated: 'warning',
  unknown: 'info',
};

const DEP_LABEL: Record<string, string> = {
  sidecar: '反推服务（sidecar）',
  'ai-gateway': 'AI 网关',
  media: '媒体服务',
};

const status = ref<SidecarStatus | null>(null);
const loading = ref(false);

const sidecarVersion = computed(
  () => status.value?.deps.find((d) => d.name === 'sidecar')?.version || '',
);
const sidecarVersionState = computed<VersionState | null>(() =>
  sidecarVersion.value ? versionState(sidecarVersion.value) : null,
);

const columns = [
  { title: '服务', dataIndex: 'name', width: 200 },
  { title: '状态', dataIndex: 'ok', width: 90 },
  { title: '版本', dataIndex: 'version', width: 180 },
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
  font-size: 13px;
}
.ver-alert {
  margin-bottom: 16px;
}
.ver-text {
  font-size: 14px;
  font-weight: 600;
}
.ver-text.outdated {
  color: #d46b08;
}
.page-header :deep(.ant-btn) {
  min-height: 32px;
}
</style>
