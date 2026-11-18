<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewayCalls') }}</h2>
    </div>

    <a-card variant="borderless" style="margin-bottom: 12px">
      <a-form layout="inline" class="filter-form">
        <a-form-item :label="fieldLabel('call_id')">
          <a-input v-model:value="filters.callId" allow-clear style="width: 280px" />
        </a-form-item>
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
          <a-range-picker v-model:value="range" show-time value-format="YYYY-MM-DD HH:mm:ss" />
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
        table-layout="fixed"
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
          <template v-if="column.dataIndex === 'cost_amount_cny'">
            <span>{{ record.cost_amount_cny ?? '—' }}</span>
            <a-tag v-if="costPending(record)" color="orange" class="cost-pending-tag">{{
              fieldLabel('costPending')
            }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'idempotency_key'">
            <code class="wrap">{{ record.idempotency_key }}</code>
          </template>
          <template v-if="column.dataIndex === 'operation'">
            <span :title="record.operation">{{ enumShort(record.operation) }}</span>
          </template>
          <template v-if="column.dataIndex === 'labels'">
            <div class="labels-cell">
              <a-tag v-for="(v, k) in record.labels || {}" :key="k">{{ k }}={{ v }}</a-tag>
              <a
                v-if="creationTaskIdFromLabels(record.labels)"
                @click="goTaskTrace(creationTaskIdFromLabels(record.labels)!)"
                >{{ $t('aiGateway.viewTaskTrace') }}</a
              >
            </div>
          </template>
          <template v-if="isTimeField(column.dataIndex)">
            {{ formatDateTime(record[column.dataIndex as string]) }}
          </template>
        </template>
      </a-table>
      <div class="pager">
        <a-button
          :disabled="!!filters.callId.trim() || !cursorStack.length || loading"
          @click="prevPage"
        >
          {{ $t('aiGateway.prevPage') }}
        </a-button>
        <a-button :disabled="!!filters.callId.trim() || !nextCursor || loading" @click="nextPage">
          {{ $t('aiGateway.nextPage') }}
        </a-button>
      </div>
    </a-card>

    <a-drawer v-model:open="detailOpen" :title="detailId" width="880">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <div v-if="detailTaskId" style="margin-bottom: 8px">
            <a @click="goTaskTrace(detailTaskId)">{{ $t('aiGateway.viewTaskTrace') }}</a>
            <code style="margin-left: 8px">{{ detailTaskId }}</code>
          </div>
          <div v-if="lateInfo.success" style="margin-bottom: 8px">
            <a-tag color="green">{{ $t('aiGateway.lateSuccess') }}</a-tag>
            <span>{{ formatDateTime(lateInfo.successAt) }}</span>
            <template v-if="lateInfo.deliveredAt">
              <a-tag color="blue" style="margin-left: 12px">{{
                $t('aiGateway.lateDelivered')
              }}</a-tag>
              <span>{{ formatDateTime(lateInfo.deliveredAt) }}</span>
            </template>
          </div>
          <div v-if="canRehostRetry" style="margin-bottom: 8px">
            <a-button danger :loading="rehosting" @click="handleRehostRetry">{{
              $t('aiGateway.rehostRetry')
            }}</a-button>
          </div>
          <template v-if="rehostResult">
            <h4>{{ $t('aiGateway.rehostRetryResult') }}</h4>
            <pre class="json-viewer small">{{ pretty(rehostResult) }}</pre>
          </template>
          <h4>{{ formText('detailCall') }}</h4>
          <pre class="json-viewer">{{ pretty(detail.call) }}</pre>
          <h4>{{ formText('detailInput') }}</h4>
          <pre class="json-viewer">{{ pretty(detail.input) }}</pre>
          <h4>{{ formText('detailAttempts') }}</h4>
          <a-collapse v-if="detail.attempts.length">
            <a-collapse-panel
              v-for="attempt in detail.attempts"
              :key="String(attempt.seq)"
              :header="`#${attempt.seq} · ${attempt.deployment || attempt.provider} · ${attempt.state}`"
            >
              <a-tag v-if="costPending(attempt)" color="orange" class="cost-pending-tag">{{
                fieldLabel('costPending')
              }}</a-tag>
              <pre class="json-viewer">{{ pretty(attempt) }}</pre>
            </a-collapse-panel>
          </a-collapse>
          <a-empty v-else />
          <h4>
            {{ formText('detailOutcome') }}
            <a-tag v-if="costPending(detail.outcome)" color="orange">{{
              fieldLabel('costPending')
            }}</a-tag>
          </h4>
          <pre class="json-viewer">{{ pretty(detail.outcome) }}</pre>
          <template v-if="lateInfo.success">
            <h4>{{ $t('aiGateway.lateResult') }}</h4>
            <pre class="json-viewer">{{ pretty(detail.outcome.late_result) }}</pre>
          </template>
          <h4>{{ formText('detailEvents') }}</h4>
          <a-timeline v-if="detail.events.length">
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
import { Modal, message } from 'antdv-next';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
  CALL_STATUSES,
  OPERATIONS,
  getCall,
  rehostRetryCall,
  searchCalls,
  type AdminCallDetail,
  type CallRehostRetryResult,
  type CallSearchParams,
  type CallSummary,
} from '@/api/ai-gateway';
import { getCreationTaskList } from '@/api/creation-task';
import { formatDateTime } from '@/utils/helpers';
import { creationTaskIdFromLabels } from '@/views/creation/task/trace-helpers';

import { enumLabel, enumShort, fieldLabel, formText } from '../components/gatewayI18n';
import { isTimeField } from '../components/schema';

/**
 * 网关调用检索。任务详情里的「网关调用」链接带 `?callId=` 进来，按 ID 精确查询；
 * 也可带 `idempotency_key` / `execution_ref` 预填筛选。
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const statusOptions = computed(() => CALL_STATUSES.map((s) => ({ label: enumLabel(s), value: s })));
const operationOptions = computed(() => OPERATIONS.map((s) => ({ label: enumLabel(s), value: s })));
const moneyOptions = computed(() => [
  { label: t('common.yes'), value: 'true' },
  { label: t('common.no'), value: 'false' },
]);

const filters = reactive({
  callId: typeof route.query.callId === 'string' ? route.query.callId : '',
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
let fetchSequence = 0;

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
  const sequence = ++fetchSequence;
  loading.value = true;
  try {
    const callId = filters.callId.trim();
    if (callId) {
      const found = await getCall(callId);
      if (sequence !== fetchSequence) return;
      const record = found.call as unknown as CallSummary;
      const cost = found.outcome.cost as { amount_cny?: string } | undefined;
      rows.value = [
        {
          ...record,
          attempt_count: found.attempts.length,
          last_deployment: String(found.attempts.at(-1)?.deployment || '') || null,
          cost_amount_cny: cost?.amount_cny ?? null,
          cost_final: (found.outcome.cost as { final?: boolean } | undefined)?.final ?? null,
        },
      ];
      nextCursor.value = null;
      currentCursor.value = undefined;
      detailId.value = callId;
      detail.value = found;
      rehostResult.value = null;
      detailOpen.value = true;
      return;
    }
    const page = await searchCalls(params(cursor));
    if (sequence !== fetchSequence) return;
    rows.value = page?.items || [];
    nextCursor.value = page?.next_cursor ?? null;
    currentCursor.value = cursor;
  } catch {
    if (sequence !== fetchSequence) return;
    rows.value = [];
    nextCursor.value = null;
    if (filters.callId.trim()) {
      detail.value = null;
      detailOpen.value = false;
    }
  } finally {
    if (sequence === fetchSequence) loading.value = false;
  }
}

function search() {
  cursorStack.value = [];
  const callId = filters.callId.trim();
  if (route.query.callId !== (callId || undefined)) {
    void router.replace({ query: { ...route.query, callId: callId || undefined } });
  }
  fetchPage(undefined);
}
function reset() {
  filters.callId = '';
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

/** 成本待核对：网关返回 cost.final === false（或列表行的 cost_final === false），等供应商回报实扣后才定稿 */
function costPending(src: unknown): boolean {
  const o = src as { cost?: { final?: boolean } | null; cost_final?: boolean | null } | null;
  return o?.cost?.final === false || o?.cost_final === false;
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
  rehostResult.value = null;
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

// 迟到成功：网关把 late_* 放在 outcome 里（与 result 同组），调用终态不变
const lateInfo = computed(() => {
  const o = detail.value?.outcome || {};
  return {
    success: o.late_success === true,
    successAt: o.late_success_at,
    deliveredAt: o.late_delivered_at,
  };
});

// 转存重试：仅 FAILED 终态、有已计费尝试、尚无迟到成功时可用；其余拒绝由网关判（409 带判据，拦截器提示）
const canRehostRetry = computed(
  () =>
    detail.value?.call?.status === 'FAILED' &&
    !lateInfo.value.success &&
    detail.value.attempts.some((a) => a.charged === 'CHARGED'),
);
const rehosting = ref(false);
const rehostResult = ref<CallRehostRetryResult | null>(null);

function handleRehostRetry() {
  const id = detailId.value;
  Modal.confirm({
    title: t('aiGateway.rehostRetry'),
    content: t('aiGateway.rehostRetryConfirm'),
    onOk: async () => {
      rehosting.value = true;
      try {
        const r = await rehostRetryCall(id);
        rehostResult.value = r;
        if (r?.outcome === 'persisted') {
          message.success(t('aiGateway.rehostRetryPersisted', { n: r.outputs_persisted ?? 0 }));
        } else {
          const check = r?.check || '-';
          message.error(
            r?.retryable
              ? `${t('aiGateway.rehostRetryFailed', { check })} · ${t('aiGateway.rehostRetryRetryable')}`
              : t('aiGateway.rehostRetryFailed', { check }),
          );
        }
        if (detailId.value === id) {
          const kept = rehostResult.value;
          await openDetail(id);
          rehostResult.value = kept;
        }
      } catch {
        /* 拦截器已提示网关错误（含判据） */
      } finally {
        rehosting.value = false;
      }
    },
  });
}

const detailTaskId = computed(() =>
  creationTaskIdFromLabels(detail.value?.call?.labels as Record<string, unknown> | undefined),
);

// 任务详情路由用数字主键，labels.job 只带 taskId，先按 taskId 检索出主键（同核对单页做法）
async function goTaskTrace(taskId: string) {
  try {
    const res = await getCreationTaskList({ keyword: taskId, page: 1, pageSize: 5 });
    const hit = (res.list || []).find((r) => r.taskId === taskId);
    if (!hit) {
      message.warning(t('aiGateway.taskTraceNotFound'));
      return;
    }
    // trace=1：详情页直接展开任务链路卡片（见 detail.vue 的 autoExpandTrace）
    void router.push({
      name: 'CreationTaskDetail',
      params: { id: String(hit.id) },
      query: { trace: '1' },
    });
  } catch (e) {
    console.error('Failed to resolve task:', e);
  }
}

function pretty(v: unknown) {
  return JSON.stringify(v ?? null, null, 2);
}

onMounted(() => {
  search();
});

watch(
  () => route.query.callId,
  (value) => {
    const callId = typeof value === 'string' ? value : '';
    if (filters.callId === callId) return;
    filters.callId = callId;
    search();
  },
);
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
.labels-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}
.labels-cell :deep(.ant-tag) {
  max-width: 100%;
  margin-inline-end: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
