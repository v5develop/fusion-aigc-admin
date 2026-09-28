<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewayAlerts') }}</h2>
      <a-space>
        <a-segmented v-model:value="status" :options="statusOptions" @change="search" />
        <a-button :loading="loading" @click="search">{{ $t('common.refresh') }}</a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="$t('aiGateway.alertHint')"
    />

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'severity'">
            <a-tag :color="severityColor(record.severity)" :title="record.severity">{{
              enumShort(record.severity)
            }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 'firing' ? 'red' : 'green'" :title="record.status">{{
              enumShort(record.status)
            }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'type'">
            <span :title="record.type">{{ enumLabel(record.type) }}</span>
          </template>
          <template v-if="column.dataIndex === 'scope'">
            <code>{{ record.scope }}</code>
          </template>
          <template v-if="isTimeField(column.dataIndex)">
            {{ formatDateTime(record[column.dataIndex as string]) }}
          </template>
        </template>
      </a-table>
      <div class="pager">
        <a-button :disabled="!cursorStack.length || loading" @click="prevPage">
          {{ $t('aiGateway.prevPage') }}
        </a-button>
        <a-button :disabled="!nextCursor || loading" @click="nextPage">
          {{ $t('aiGateway.nextPage') }}
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { listAlerts, type GatewayAlert } from '@/api/ai-gateway';
import { formatDateTime } from '@/utils/helpers';

import { enumLabel, enumShort, fieldLabel } from '../components/gatewayI18n';
import { isTimeField } from '../components/schema';

/** 网关告警只暴露状态与事件；通知渠道由监控栈（Prometheus / Alertmanager）负责，不在这里配 */
const { t } = useI18n();

const status = ref<string>('firing');
const statusOptions = computed(() => [
  { label: t('aiGateway.alertFiring'), value: 'firing' },
  { label: t('aiGateway.alertResolved'), value: 'resolved' },
  { label: t('aiGateway.all'), value: '' },
]);

const rows = ref<GatewayAlert[]>([]);
const loading = ref(false);
const currentCursor = ref<string | undefined>(undefined);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<(string | undefined)[]>([]);

async function fetchPage(cursor?: string) {
  loading.value = true;
  try {
    const page = await listAlerts({ status: status.value || undefined, cursor, limit: 50 });
    rows.value = page?.items || [];
    nextCursor.value = page?.next_cursor ?? null;
    currentCursor.value = cursor;
  } catch {
    rows.value = [];
    nextCursor.value = null;
  } finally {
    loading.value = false;
  }
}

function search() {
  cursorStack.value = [];
  fetchPage(undefined);
}
function nextPage() {
  if (!nextCursor.value) return;
  cursorStack.value.push(currentCursor.value);
  fetchPage(nextCursor.value);
}
function prevPage() {
  fetchPage(cursorStack.value.pop());
}

function severityColor(s: string) {
  if (s === 'critical') return 'red';
  if (s === 'warning') return 'orange';
  return 'blue';
}

const columns = computed(() => [
  { title: fieldLabel('id'), dataIndex: 'id', width: 80 },
  { title: t('aiGateway.alertType'), dataIndex: 'type', width: 180 },
  { title: t('aiGateway.scope'), dataIndex: 'scope', width: 240 },
  { title: t('aiGateway.severity'), dataIndex: 'severity', width: 100 },
  { title: t('aiGateway.status'), dataIndex: 'status', width: 100 },
  { title: t('aiGateway.message'), dataIndex: 'message', ellipsis: true },
  { title: t('aiGateway.count'), dataIndex: 'count', width: 80 },
  { title: t('aiGateway.firstAt'), dataIndex: 'first_at', width: 190 },
  { title: t('aiGateway.lastAt'), dataIndex: 'last_at', width: 190 },
  { title: t('aiGateway.resolvedAt'), dataIndex: 'resolved_at', width: 190 },
]);

onMounted(search);
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
.pager {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
