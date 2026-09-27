<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewayCalls') }}</h2>
    </div>

    <a-card variant="borderless" style="margin-bottom: 12px">
      <a-form layout="inline" class="filter-form">
        <a-form-item :label="$t('aiGateway.status')">
          <a-select
            v-model:value="filters.status"
            :options="statusOptions"
            allow-clear
            style="width: 140px"
          />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.operation')">
          <a-select
            v-model:value="filters.operation"
            :options="operationOptions"
            allow-clear
            style="width: 190px"
          />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.modelGroup')">
          <a-input v-model:value="filters.model_group" allow-clear style="width: 190px" />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.deployment')">
          <a-input v-model:value="filters.deployment" allow-clear style="width: 190px" />
        </a-form-item>
        <a-form-item :label="fieldLabel('execution_ref')">
          <a-input v-model:value="filters.execution_ref" allow-clear style="width: 220px" />
        </a-form-item>
        <a-form-item :label="fieldLabel('idempotency_key')">
          <a-input v-model:value="filters.idempotency_key" allow-clear style="width: 260px" />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.moneyAtRisk')">
          <a-select
            v-model:value="filters.money_at_risk"
            :options="moneyOptions"
            allow-clear
            style="width: 100px"
          />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.timeRange')">
          <a-range-picker v-model:value="range" show-time value-format="YYYY-MM-DDTHH:mm:ssZ" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="loading" @click="search">{{
              $t('common.search')
            }}</a-button>
            <a-button @click="reset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 1600 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'id'">
            <a @click="openDetail(record.id)"
              ><code>{{ record.id }}</code></a
            >
          </template>
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)" :title="record.status">{{
              enumShort(record.status)
            }}</a-tag>
            <a-tag v-if="record.money_at_risk" color="red">{{ $t('aiGateway.moneyAtRisk') }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'idempotency_key'">
            <code class="wrap">{{ record.idempotency_key }}</code>
          </template>
          <template v-if="column.dataIndex === 'operation'">
            <span :title="record.operation">{{ enumShort(record.operation) }}</span>
          </template>
          <template v-if="column.dataIndex === 'labels'">
            <a-tag v-for="(v, k) in record.labels || {}" :key="k">{{ k }}={{ v }}</a-tag>
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

    <a-drawer v-model:open="detailOpen" :title="detailId" width="880">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <h4>{{ formText('detailRecord') }}</h4>
          <pre class="json-viewer">{{ pretty(detail.record) }}</pre>
          <h4>{{ formText('detailRequest') }}</h4>
          <pre class="json-viewer">{{ pretty(detail.request) }}</pre>
          <h4>{{ formText('detailEvents') }}</h4>
          <a-timeline v-if="detail.events && detail.events.length">
            <a-timeline-item v-for="(ev, i) in detail.events" :key="i">
              <pre class="json-viewer small">{{ pretty(ev) }}</pre>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else />
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import {
  CALL_STATUSES,
  OPERATIONS,
  getCall,
  searchCalls,
  type AdminCallDetail,
  type CallSearchParams,
  type CallSummary,
} from '@/api/ai-gateway';

import { enumLabel, enumShort, fieldLabel, formText } from '../components/gatewayI18n';

/**
 * 网关调用检索。任务详情里的「网关调用」链接带 `?callId=` 进来，直接打开详情抽屉；
 * 也可带 `idempotency_key` / `execution_ref` 预填筛选。
 */
const { t } = useI18n();
const route = useRoute();

const statusOptions = computed(() => CALL_STATUSES.map((s) => ({ label: enumLabel(s), value: s })));
const operationOptions = computed(() => OPERATIONS.map((s) => ({ label: enumLabel(s), value: s })));
const moneyOptions = computed(() => [
  { label: t('common.yes'), value: 'true' },
  { label: t('common.no'), value: 'false' },
]);

const filters = reactive({
  status: undefined as string | undefined,
  operation: undefined as string | undefined,
  model_group: '',
  deployment: '',
  execution_ref: typeof route.query.execution_ref === 'string' ? route.query.execution_ref : '',
  idempotency_key:
    typeof route.query.idempotency_key === 'string' ? route.query.idempotency_key : '',
  money_at_risk: undefined as string | undefined,
});
const range = ref<[string, string] | null>(null);

const rows = ref<CallSummary[]>([]);
const loading = ref(false);
const currentCursor = ref<string | undefined>(undefined);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<(string | undefined)[]>([]);

function params(cursor?: string): CallSearchParams {
  return {
    status: filters.status,
    operation: filters.operation,
    model_group: filters.model_group.trim(),
    deployment: filters.deployment.trim(),
    execution_ref: filters.execution_ref.trim(),
    idempotency_key: filters.idempotency_key.trim(),
    money_at_risk:
      filters.money_at_risk === undefined ? undefined : filters.money_at_risk === 'true',
    from: range.value?.[0],
    to: range.value?.[1],
    cursor,
    limit: 50,
  };
}

async function fetchPage(cursor?: string) {
  loading.value = true;
  try {
    const page = await searchCalls(params(cursor));
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
function reset() {
  filters.status = undefined;
  filters.operation = undefined;
  filters.model_group = '';
  filters.deployment = '';
  filters.execution_ref = '';
  filters.idempotency_key = '';
  filters.money_at_risk = undefined;
  range.value = null;
  search();
}
function nextPage() {
  if (!nextCursor.value) return;
  cursorStack.value.push(currentCursor.value);
  fetchPage(nextCursor.value);
}
function prevPage() {
  const prev = cursorStack.value.pop();
  fetchPage(prev);
}

function statusColor(s: string) {
  if (s === 'SUCCEEDED') return 'green';
  if (s === 'FAILED') return 'red';
  if (s === 'UNKNOWN') return 'volcano';
  if (s === 'CANCELLED') return 'default';
  return 'blue';
}

const columns = computed(() => [
  { title: fieldLabel('call_id'), dataIndex: 'id', width: 230, fixed: 'left' as const },
  { title: t('aiGateway.status'), dataIndex: 'status', width: 190 },
  { title: t('aiGateway.operation'), dataIndex: 'operation', width: 150 },
  { title: t('aiGateway.modelGroup'), dataIndex: 'model_group', width: 180 },
  { title: t('aiGateway.lastDeployment'), dataIndex: 'last_deployment', width: 180 },
  { title: t('aiGateway.attempts'), dataIndex: 'attempt_count', width: 80 },
  { title: t('aiGateway.costCny'), dataIndex: 'cost_amount_cny', width: 100 },
  { title: fieldLabel('idempotency_key'), dataIndex: 'idempotency_key', width: 260 },
  { title: fieldLabel('labels'), dataIndex: 'labels', width: 260 },
  { title: t('aiGateway.createdAt'), dataIndex: 'created_at', width: 190 },
  { title: t('aiGateway.completedAt'), dataIndex: 'completed_at', width: 190 },
]);

// ---- 详情 ----
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailId = ref('');
const detail = ref<AdminCallDetail | null>(null);

async function openDetail(id: string) {
  detailId.value = id;
  detail.value = null;
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    detail.value = await getCall(id);
  } catch {
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function pretty(v: unknown) {
  return JSON.stringify(v ?? null, null, 2);
}

onMounted(() => {
  search();
  if (typeof route.query.callId === 'string' && route.query.callId) {
    openDetail(route.query.callId);
  }
});
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
.filter-form {
  row-gap: 8px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.json-viewer {
  background: var(--color-fill-quaternary, #fafafa);
  padding: 10px;
  border-radius: 4px;
  max-height: 420px;
  overflow: auto;
  font-size: 12px;
}
.json-viewer.small {
  max-height: 240px;
}
.wrap {
  word-break: break-all;
}
</style>
