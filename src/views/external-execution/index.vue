<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">外部执行</h2>
      <a-space>
        <span v-if="overview?.generatedAt" class="muted">观测于 {{ overview.generatedAt }}</span>
        <a-button :loading="loading || overviewLoading" @click="reload">刷新全部</a-button>
      </a-space>
    </div>

    <a-card class="observability-card" variant="borderless" :loading="overviewLoading">
      <template #title>
        <a-space>
          <span>执行面驾驶舱</span>
          <a-tag :color="healthColor">{{ healthLabel }}</a-tag>
        </a-space>
      </template>

      <a-alert
        v-if="overview?.message"
        :type="overview.health === 'DISABLED' ? 'info' : 'warning'"
        show-icon
        :message="overview.message"
        style="margin-bottom: 16px"
      />

      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-label">当前在途</div>
          <div class="metric-value">{{ overview?.activeExecutions ?? '—' }}</div>
          <div class="metric-note">等待、执行及恢复中的总量</div>
        </div>
        <div class="metric-item" :class="{ danger: (overview?.totalStuck ?? 0) > 0 }">
          <div class="metric-label">卡点命中</div>
          <div class="metric-value">{{ stuckTotalDisplay }}</div>
          <div class="metric-note">五类可重叠，不等于执行单数</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">24h 执行</div>
          <div class="metric-value">{{ overview?.total24h ?? '—' }}</div>
          <div class="metric-note">成功 {{ overview?.succeeded24h ?? '—' }}</div>
        </div>
        <div class="metric-item" :class="{ danger: (overview?.abnormal24h ?? 0) > 0 }">
          <div class="metric-label">24h 异常终态</div>
          <div class="metric-value">{{ overview?.abnormal24h ?? '—' }}</div>
          <div class="metric-note">失败、超时及人工审核</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">24h 终态成功率</div>
          <div class="metric-value">{{ formatPercent(overview?.successRate24h) }}</div>
          <div class="metric-note">只统计已经到达终态的执行</div>
        </div>
      </div>

      <div v-if="overview?.statusCounts?.length" class="status-strip">
        <span class="section-label">状态分布</span>
        <a-tag
          v-for="item in overview.statusCounts"
          :key="item.status"
          :color="statusColor(item.status)"
        >
          {{ item.status }} {{ item.count }}
        </a-tag>
      </div>

      <div v-if="overview?.stuckFindings?.length" class="stuck-grid">
        <div
          v-for="finding in overview.stuckFindings"
          :key="finding.kind"
          class="stuck-item"
          :class="{ active: finding.count > 0 }"
        >
          <div class="stuck-title">
            <span>{{ finding.label }}</span>
            <a-badge :count="finding.count" :show-zero="true" :overflow-count="999" />
          </div>
          <div class="metric-note">
            {{
              finding.stuckMinutes == null
                ? '按执行截止时间判断'
                : `停留超过 ${finding.stuckMinutes} 分钟`
            }}
            <span v-if="finding.saturated"> · 已达扫描上限</span>
          </div>
          <div v-if="finding.samples.length" class="sample-list">
            <a-button
              v-for="sample in finding.samples"
              :key="sample"
              type="link"
              size="small"
              @click="openTimeline(sample)"
            >
              {{ sample }}
            </a-button>
          </div>
        </div>
      </div>

      <a-table
        v-if="overview?.providers?.length"
        class="provider-table"
        :columns="providerColumns"
        :data-source="overview.providers"
        :pagination="false"
        row-key="providerSystem"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'providerSystem'">
            <code class="route-code">{{ record.providerSystem }}</code>
          </template>
          <template v-if="column.dataIndex === 'abnormal24h'">
            <span :class="{ warn: record.abnormal24h > 0 }">{{ record.abnormal24h }}</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="执行号 exe_ 前缀的外部执行面。执行方的终态回推不通时，执行会一直停在非终态；这里是唯一的人工收口入口（此前只能直连改库）。强制收口只改状态、不碰计费。"
    />

    <a-alert
      v-if="stuckCount > 0"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`当前页有 ${stuckCount} 条处于非终态、可强制收口。若它们的 updatedAt 长时间不变，基本可以确定执行方的终态回推没通。`"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="filters.status"
          :options="statusFilterOptions"
          placeholder="全部状态"
          allow-clear
          style="width: 180px"
          @change="loadList"
        />
        <a-input
          v-model:value="filters.executionNo"
          placeholder="执行号（精确）"
          allow-clear
          style="width: 260px"
          @press-enter="loadList"
        />
        <a-input
          v-model:value="filters.aggregateId"
          placeholder="业务任务号（aggregateId）"
          allow-clear
          style="width: 240px"
          @press-enter="loadList"
        />
        <a-input
          v-model:value="filters.providerSystem"
          placeholder="执行方"
          allow-clear
          style="width: 160px"
          @press-enter="loadList"
        />
        <a-button type="primary" @click="loadList">查询</a-button>
        <a-button
          danger
          :disabled="!selectedForceable.length"
          @click="openForce(selectedForceable)"
        >
          批量强制收口 {{ selectedForceable.length || '' }}
        </a-button>
        <a-button
          v-permission="'task:retry'"
          :disabled="!selectedPublishable.length"
          @click="openAction('publish', selectedPublishable, true)"
        >
          批量发布公开副本 {{ selectedPublishable.length || '' }}
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :row-selection="rowSelection"
        :pagination="pagination"
        row-key="executionNo"
        size="middle"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'executionNo'">
            <code class="route-code">{{ record.executionNo }}</code>
            <div v-if="record.aggregateId" class="muted">{{ record.aggregateId }}</div>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.forceable ? 'orange' : 'default'">{{ record.status }}</a-tag>
            <div v-if="record.billingStatus" class="muted">扣费单 {{ record.billingStatus }}</div>
          </template>

          <template v-if="column.dataIndex === 'error'">
            <span v-if="record.lastErrorCode" class="muted warn">{{ record.lastErrorCode }}</span>
            <div v-if="record.lastErrorMessage" class="muted">{{ record.lastErrorMessage }}</div>
            <span v-if="!record.lastErrorCode && !record.lastErrorMessage" class="muted">—</span>
          </template>

          <template v-if="column.dataIndex === 'operation'">
            <a-space size="small">
              <a-button type="link" size="small" @click="openTimeline(record.executionNo)">
                诊断
              </a-button>
              <a-button type="link" size="small" @click="openDetail(record.executionNo)">
                详情
              </a-button>
              <a-button
                v-if="record.forceable"
                type="link"
                size="small"
                danger
                @click="openForce([record.executionNo])"
              >
                强制收口
              </a-button>
              <a-button
                v-if="record.canRedeliver"
                v-permission="'task:retry'"
                type="link"
                size="small"
                @click="openAction('redeliver', [record.executionNo])"
              >
                重新交付
              </a-button>
              <a-button
                v-if="record.canPublishPrivate"
                v-permission="'task:retry'"
                type="link"
                size="small"
                @click="openAction('publish', [record.executionNo])"
              >
                发布公开副本
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="forceVisible"
      :title="`强制收口 ${forceTargets.length} 条`"
      :confirm-loading="forcing"
      @ok="submitForce"
    >
      <a-alert
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="只改执行状态，不做任何计费动作。这些执行的预占若已被超时兜底退过，这里不会再退一次，也不会确认扣费。"
      />
      <a-form layout="vertical">
        <a-form-item label="目标状态">
          <a-select v-model:value="forceStatus" :options="forceStatusOptions" />
          <div class="muted">
            没有 SUCCEEDED：成功交付要走执行态推进的产物转存与素材库同步，手动改状态绕不过它，
            强行标成功只会得到「成功但没有产物」的行。
          </div>
        </a-form-item>
        <a-form-item label="原因" required>
          <a-textarea
            v-model:value="forceReason"
            :rows="3"
            placeholder="为什么要人工收口，会记进审计"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="actionVisible"
      :title="actionTitle"
      :confirm-loading="actionSubmitting"
      @ok="submitAction"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        :message="actionMode === 'redeliver' ? REDELIVER_EXPLAIN : PUBLISH_EXPLAIN"
      />
      <div v-if="actionBatch" class="muted" style="margin-bottom: 12px">
        共 {{ actionTargets.length }} 条（只含可发布公开副本的行，单次上限
        {{ PUBLISH_PRIVATE_BATCH_LIMIT }} 条）
      </div>
      <a-form layout="vertical">
        <a-form-item label="原因" required>
          <a-textarea
            v-model:value="actionReason"
            :rows="3"
            :maxlength="200"
            show-count
            placeholder="为什么要人工处理，会记进审计"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="batchResultVisible"
      title="批量发布公开副本结果"
      :footer="null"
      width="640px"
    >
      <template v-if="batchResult">
        <a-alert
          :type="batchResult.failed.length ? 'warning' : 'success'"
          show-icon
          style="margin-bottom: 12px"
          :message="`成功 ${batchResult.succeeded.length} 条 / 失败 ${batchResult.failed.length} 条`"
        />
        <a-table
          v-if="batchResult.failed.length"
          :columns="batchFailedColumns"
          :data-source="batchResult.failed"
          :pagination="false"
          row-key="executionNo"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'executionNo'">
              <code class="route-code">{{ record.executionNo }}</code>
            </template>
          </template>
        </a-table>
      </template>
    </a-modal>

    <a-modal v-model:open="detailVisible" title="外部执行详情" width="720px">
      <template #footer>
        <a-space>
          <a-button
            v-if="detail?.canRedeliver"
            v-permission="'task:retry'"
            @click="openAction('redeliver', [detail.executionNo])"
          >
            重新交付
          </a-button>
          <a-button
            v-if="detail?.canPublishPrivate"
            v-permission="'task:retry'"
            @click="openAction('publish', [detail.executionNo])"
          >
            发布公开副本
          </a-button>
          <a-button @click="detailVisible = false">关闭</a-button>
        </a-space>
      </template>
      <a-descriptions v-if="detail" :column="2" size="small" bordered>
        <a-descriptions-item label="执行号" :span="2">
          <code class="route-code">{{ detail.executionNo }}</code>
        </a-descriptions-item>
        <a-descriptions-item label="状态">{{ detail.status }}</a-descriptions-item>
        <a-descriptions-item label="扣费单状态">{{
          detail.billingStatus || '—'
        }}</a-descriptions-item>
        <a-descriptions-item label="能力">{{ detail.capabilityCode || '—' }}</a-descriptions-item>
        <a-descriptions-item label="执行方">{{ detail.providerSystem || '—' }}</a-descriptions-item>
        <a-descriptions-item label="业务任务号" :span="2">
          {{ detail.aggregateId || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="预占单号">{{
          detail.reservationNo || '—'
        }}</a-descriptions-item>
        <a-descriptions-item label="远端执行号">
          {{ detail.remoteExecutionId || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="提交次数">{{
          detail.submitAttempts ?? '—'
        }}</a-descriptions-item>
        <a-descriptions-item label="结算次数">
          {{ detail.settlementAttempts ?? '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="提交时间">{{
          detail.submittedTime || '—'
        }}</a-descriptions-item>
        <a-descriptions-item label="完成时间">{{ detail.finishedTime || '—' }}</a-descriptions-item>
        <a-descriptions-item label="更新时间" :span="2">
          {{ detail.updateTime || '—' }}
        </a-descriptions-item>
        <a-descriptions-item v-if="detail.lastErrorMessage" label="最后错误" :span="2">
          <span class="muted warn">{{ detail.lastErrorCode }}</span>
          {{ detail.lastErrorMessage }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <a-drawer
      v-model:open="timelineVisible"
      title="执行链路诊断"
      width="860"
      :destroy-on-close="true"
    >
      <a-spin :spinning="timelineLoading">
        <template v-if="timeline">
          <a-alert
            :type="verdictAlertType"
            show-icon
            :message="timeline.verdictSummary"
            :description="timeline.verdictNextStep"
            style="margin-bottom: 16px"
          />

          <div class="diagnosis-head">
            <div>
              <span class="section-label">结论</span>
              <a-tag :color="verdictColor">{{ timeline.verdict }}</a-tag>
            </div>
            <a-space>
              <span class="muted">{{ timeline.generatedAt }}</span>
              <a-button size="small" :loading="timelineLoading" @click="reloadTimeline">
                重新探测
              </a-button>
            </a-space>
          </div>

          <a-descriptions :column="3" size="small" bordered style="margin-bottom: 20px">
            <a-descriptions-item label="执行号" :span="2">
              <code class="route-code">{{ timeline.execution.executionNo }}</code>
            </a-descriptions-item>
            <a-descriptions-item label="本地状态">
              <a-tag :color="statusColor(timeline.execution.status)">
                {{ timeline.execution.status }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="实时探针">
              <a-tag :color="probeColor(timeline.probe.state)">{{ timeline.probe.state }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="执行方权威态">{{
              timeline.probe.status || '—'
            }}</a-descriptions-item>
            <a-descriptions-item label="事件序号">{{
              timeline.probe.sequence ?? '—'
            }}</a-descriptions-item>
            <a-descriptions-item v-if="timeline.probe.reason" label="探针说明" :span="3">
              {{ timeline.probe.reason }}
            </a-descriptions-item>
          </a-descriptions>

          <a-timeline>
            <a-timeline-item v-for="stage in timelineStages" :key="stage.key" :color="stage.color">
              <div class="stage-title">{{ stage.title }}</div>
              <div class="stage-summary">{{ stage.summary }}</div>
            </a-timeline-item>
          </a-timeline>

          <a-collapse ghost>
            <a-collapse-panel key="evidence" header="查看诊断证据">
              <a-descriptions :column="2" size="small" bordered>
                <a-descriptions-item label="匹配方式">{{ timeline.matchedBy }}</a-descriptions-item>
                <a-descriptions-item label="同业务任务执行数">
                  {{ timeline.matchedBy === 'AGGREGATE_ID' ? timeline.aggregateMatchCount : '—' }}
                </a-descriptions-item>
                <a-descriptions-item label="Java 发件箱"
                  >{{ timeline.outbox.length }} 条</a-descriptions-item
                >
                <a-descriptions-item label="Java 收件箱"
                  >{{ timeline.inbox.length }} 条</a-descriptions-item
                >
                <a-descriptions-item label="交付 checkpoint">
                  {{ timeline.deliveries.length }} 条
                </a-descriptions-item>
                <a-descriptions-item label="计费预占">
                  {{ timeline.reservation?.status || '未找到' }}
                </a-descriptions-item>
                <a-descriptions-item v-if="timeline.agentTurn" label="Agent 轮次状态">
                  {{ timeline.agentTurn.status || '—' }}
                </a-descriptions-item>
                <a-descriptions-item v-if="timeline.agentEventStats" label="Agent 事件">
                  {{ timeline.agentEventStats.eventCount ?? 0 }} 条，最新序号
                  {{ timeline.agentEventStats.maxSequence ?? '—' }}
                </a-descriptions-item>
                <a-descriptions-item
                  v-if="timeline.execution.lastErrorMessage"
                  label="最后错误"
                  :span="2"
                >
                  <span class="warn">{{ timeline.execution.lastErrorCode }}</span>
                  {{ timeline.execution.lastErrorMessage }}
                </a-descriptions-item>
              </a-descriptions>
            </a-collapse-panel>
          </a-collapse>
        </template>
        <a-empty v-else-if="!timelineLoading" description="暂无诊断结果" />
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  batchForceTerminalExternalExecutions,
  forceTerminalExternalExecution,
  getExternalExecutionDetail,
  getExternalExecutionObservability,
  getExternalExecutions,
  getExternalExecutionTimeline,
  batchPublishPrivateExternalExecutions,
  publishPrivateExternalExecution,
  redeliverExternalExecution,
  FORCE_TERMINAL_STATUSES,
  PUBLISH_PRIVATE_BATCH_LIMIT,
  type BatchPublishPrivateResult,
  type ExecutionObservabilityOverview,
  type ExternalExecutionDetail,
  type ExternalExecutionListItem,
  type ExternalExecutionTimeline,
} from '@/api/external-execution';

const rows = ref<ExternalExecutionListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const overviewLoading = ref(false);
const overview = ref<ExecutionObservabilityOverview | null>(null);
const selectedKeys = ref<string[]>([]);
const filters = reactive({
  status: undefined as string | undefined,
  executionNo: '',
  aggregateId: '',
  providerSystem: '',
  page: 1,
  pageSize: 20,
});

/** 非终态才可收口，判据由后端下发的 forceable 决定 —— 前端不自己复刻状态机 */
const NON_TERMINAL = [
  'RESERVED',
  'SUBMITTING',
  'SUBMITTED',
  'PROCESSING',
  'DISPATCH_UNKNOWN',
  'SETTLEMENT_RETRY',
];
const statusFilterOptions = [...NON_TERMINAL, ...FORCE_TERMINAL_STATUSES, 'SUCCEEDED'].map((s) => ({
  label: s,
  value: s,
}));
const forceStatusOptions = FORCE_TERMINAL_STATUSES.map((s) => ({ label: s, value: s }));

const columns = [
  { title: '执行号 / 业务任务号', dataIndex: 'executionNo', width: 360 },
  { title: '状态', dataIndex: 'status', width: 180 },
  { title: '最后错误', dataIndex: 'error', width: 300 },
  { title: '更新时间', dataIndex: 'updateTime', width: 180 },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 340, align: 'center' as const },
];
const providerColumns = [
  { title: '执行方', dataIndex: 'providerSystem' },
  { title: '当前在途', dataIndex: 'active', width: 100 },
  { title: '24h 执行', dataIndex: 'total24h', width: 100 },
  { title: '24h 成功', dataIndex: 'succeeded24h', width: 100 },
  { title: '24h 异常', dataIndex: 'abnormal24h', width: 100 },
];

const healthLabel = computed(() => {
  const labels: Record<string, string> = {
    HEALTHY: '运行正常',
    DEGRADED: '存在卡点',
    DISABLED: '执行面未启用',
    UNAVAILABLE: '观测不可用',
  };
  return labels[overview.value?.health ?? ''] ?? '加载中';
});
const healthColor = computed(() => {
  const colors: Record<string, string> = {
    HEALTHY: 'green',
    DEGRADED: 'orange',
    DISABLED: 'default',
    UNAVAILABLE: 'red',
  };
  return colors[overview.value?.health ?? ''] ?? 'blue';
});
const stuckTotalDisplay = computed(() => {
  if (!overview.value) return '—';
  const prefix = overview.value.stuckFindings.some((finding) => finding.saturated) ? '≥' : '';
  return `${prefix}${overview.value.totalStuck}`;
});

const stuckCount = computed(() => rows.value.filter((row) => row.forceable).length);
/** 只把可收口的行计入批量：勾了终态行再提交，后端会逐条拒，白跑一趟 */
const selectedForceable = computed(() =>
  rows.value
    .filter((row) => selectedKeys.value.includes(row.executionNo) && row.forceable)
    .map((row) => row.executionNo),
);
/** 同理，批量发布只取 canPublishPrivate 的行 */
const selectedPublishable = computed(() =>
  rows.value
    .filter((row) => selectedKeys.value.includes(row.executionNo) && row.canPublishPrivate)
    .map((row) => row.executionNo),
);

const rowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedKeys.value = keys.map(String);
  },
  getCheckboxProps: (record: ExternalExecutionListItem) => ({
    disabled: !record.forceable && !record.canPublishPrivate,
  }),
}));

const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: total.value,
  showSizeChanger: true,
}));

function onTableChange(page: { current?: number; pageSize?: number }) {
  filters.page = page.current ?? 1;
  filters.pageSize = page.pageSize ?? 20;
  loadList();
}

async function loadList() {
  loading.value = true;
  try {
    const result = await getExternalExecutions({
      status: filters.status || undefined,
      executionNo: filters.executionNo.trim() || undefined,
      aggregateId: filters.aggregateId.trim() || undefined,
      providerSystem: filters.providerSystem.trim() || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    rows.value = result?.list ?? [];
    total.value = Number(result?.total ?? 0);
    // 选中项跟着可见行收敛，避免"翻页后还选着看不见的行"
    const visible = new Set(rows.value.map((row) => row.executionNo));
    selectedKeys.value = selectedKeys.value.filter((key) => visible.has(key));
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadOverview() {
  overviewLoading.value = true;
  try {
    overview.value = await getExternalExecutionObservability();
  } catch {
    /* 拦截器已提示；保留上一次快照，避免一次网络抖动把整个驾驶舱清空 */
  } finally {
    overviewLoading.value = false;
  }
}

function reload() {
  filters.page = 1;
  void Promise.all([loadList(), loadOverview()]);
}

reload();

// ---- 详情 ----
const detailVisible = ref(false);
const detail = ref<ExternalExecutionDetail | null>(null);

async function openDetail(executionNo: string) {
  detail.value = null;
  detailVisible.value = true;
  try {
    detail.value = await getExternalExecutionDetail(executionNo);
  } catch {
    detailVisible.value = false;
  }
}

// ---- 执行链路诊断 ----
const timelineVisible = ref(false);
const timelineLoading = ref(false);
const timeline = ref<ExternalExecutionTimeline | null>(null);
const timelineRef = ref('');
let timelineRequestId = 0;

async function openTimeline(refValue: string) {
  timelineRef.value = refValue;
  timeline.value = null;
  timelineVisible.value = true;
  await loadTimeline(refValue);
}

async function reloadTimeline() {
  if (timelineRef.value) await loadTimeline(timelineRef.value);
}

async function loadTimeline(refValue: string) {
  const requestId = ++timelineRequestId;
  timelineLoading.value = true;
  try {
    const result = await getExternalExecutionTimeline(refValue, true);
    if (requestId === timelineRequestId) timeline.value = result;
  } catch {
    if (requestId === timelineRequestId) timeline.value = null;
  } finally {
    if (requestId === timelineRequestId) timelineLoading.value = false;
  }
}

const verdictHealthy = computed(() =>
  ['RUNNING_NORMALLY', 'TERMINAL'].includes(timeline.value?.verdict ?? ''),
);
const verdictAlertType = computed(() => (verdictHealthy.value ? 'success' : 'warning'));
const verdictColor = computed(() => (verdictHealthy.value ? 'green' : 'orange'));

const timelineStages = computed(() => {
  if (!timeline.value) return [];
  const value = timeline.value;
  const outbox = value.outbox.at(-1);
  const inbox = value.inbox.at(-1);
  const delivery = value.deliveries.at(-1);
  const stages = [
    {
      key: 'dispatch',
      title: '1. 控制面发出执行命令',
      summary: outbox
        ? `${value.outbox.length} 条发件箱记录，最新 ${outbox.eventType ?? '事件'} 为 ${outbox.status ?? '未知状态'}，尝试 ${outbox.attempts ?? 0} 次`
        : '没有找到发件箱记录，命令可能从未入队',
      color: outbox?.status === 'SENT' ? 'green' : outbox ? 'orange' : 'red',
    },
    {
      key: 'executor',
      title: '2. creaft_serv 受理并执行',
      summary:
        value.probe.state === 'OK'
          ? `实时权威状态 ${value.probe.status ?? '未知'}，事件序号 ${value.probe.sequence ?? '—'}，产物 ${value.probe.resultCount ?? 0} 件`
          : `实时探针 ${value.probe.state}：${value.probe.reason ?? '未取得执行方状态'}；本地状态 ${value.execution.status}`,
      color: executionStageColor(value.probe.status ?? value.execution.status),
    },
  ];
  if (value.agentTurn) {
    stages.push({
      key: 'agent',
      title: '3. Agent 运行与事件流',
      summary: `轮次 ${value.agentTurn.status ?? '未知'}，已记录 ${value.agentEventStats?.eventCount ?? 0} 个事件，最新序号 ${value.agentEventStats?.maxSequence ?? value.agentTurn.lastSequence ?? '—'}`,
      color: value.agentTurn.status === 'FAILED' ? 'red' : 'blue',
    });
  }
  stages.push(
    {
      key: 'callback',
      title: `${value.agentTurn ? '4' : '3'}. 执行结果回推控制面`,
      summary: inbox
        ? `${value.inbox.length} 条回调，最新序号 ${inbox.eventSequence ?? '—'}，消费状态 ${inbox.status ?? '未知'}，执行态 ${inbox.callbackStatus ?? '—'}`
        : '尚未收到执行方回调',
      color: inbox?.status === 'PROCESSED' ? 'green' : inbox ? 'orange' : 'gray',
    },
    {
      key: 'delivery',
      title: `${value.agentTurn ? '5' : '4'}. 产物交付`,
      summary: delivery
        ? `${value.deliveries.length} 个交付 checkpoint，最新阶段 ${delivery.stage ?? '未知'}，结算标记 ${delivery.settlementStatus ?? '—'}`
        : '尚无交付 checkpoint',
      color: delivery ? (delivery.reviewReason ? 'orange' : 'green') : 'gray',
    },
    {
      key: 'billing',
      title: `${value.agentTurn ? '6' : '5'}. 点数结算`,
      summary: value.reservation
        ? `预占单 ${value.reservation.status ?? '未知'}，${value.reservation.pricePoints ?? '—'} 点，重试 ${value.reservation.retryCount ?? 0} 次`
        : '未找到计费预占单',
      color: ['CONFIRMED', 'REFUNDED', 'RELEASED'].includes(value.reservation?.status ?? '')
        ? 'green'
        : value.reservation
          ? 'orange'
          : 'red',
    },
  );
  return stages;
});

function executionStageColor(status?: string | null) {
  if (status === 'SUCCEEDED') return 'green';
  if (['FAILED', 'CANCELLED', 'TIMED_OUT', 'MANUAL_REVIEW'].includes(status ?? '')) return 'red';
  return status ? 'blue' : 'gray';
}

function statusColor(status?: string | null) {
  if (status === 'SUCCEEDED') return 'green';
  if (['FAILED', 'TIMED_OUT'].includes(status ?? '')) return 'red';
  if (['MANUAL_REVIEW', 'DISPATCH_UNKNOWN', 'SETTLEMENT_RETRY'].includes(status ?? ''))
    return 'orange';
  if (status === 'CANCELLED') return 'default';
  return 'blue';
}

function probeColor(state: string) {
  if (state === 'OK') return 'green';
  if (state === 'FAILED') return 'red';
  if (state === 'DISABLED') return 'default';
  return 'orange';
}

function formatPercent(value?: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

// ---- 强制收口 ----
const forceVisible = ref(false);
const forcing = ref(false);
const forceTargets = ref<string[]>([]);
const forceStatus = ref<string>('FAILED');
const forceReason = ref('');

function openForce(targets: string[]) {
  forceTargets.value = targets;
  forceStatus.value = 'FAILED';
  forceReason.value = '';
  forceVisible.value = true;
}

async function submitForce() {
  if (!forceReason.value.trim()) {
    message.warning('请填写原因，它会记进审计');
    return;
  }
  forcing.value = true;
  try {
    if (forceTargets.value.length === 1) {
      await forceTerminalExternalExecution(
        forceTargets.value[0],
        forceStatus.value,
        forceReason.value.trim(),
      );
      message.success('已收口');
    } else {
      const result = await batchForceTerminalExternalExecutions(
        forceTargets.value,
        forceStatus.value,
        forceReason.value.trim(),
      );
      // 逐条结果都要给出来：批量里一条失败不影响其它，只报总数会让人以为全成了
      const failed = (result?.items ?? []).filter((item) => !item.success);
      if (failed.length) {
        message.warning(
          `成功 ${result?.success ?? 0} 条，失败 ${failed.length} 条：` +
            failed.map((item) => `${item.executionNo} ${item.message ?? ''}`).join('；'),
        );
      } else {
        message.success(`已收口 ${result?.success ?? 0} 条`);
      }
    }
    forceVisible.value = false;
    selectedKeys.value = [];
    void Promise.all([loadList(), loadOverview()]);
  } catch {
    /* 拦截器已提示 */
  } finally {
    forcing.value = false;
  }
}

// ---- 重新交付 / 发布公开副本 ----
// 显隐只看后端下发的 canRedeliver / canPublishPrivate（缺省即 false），前端不复刻判据
type ActionMode = 'redeliver' | 'publish';
const REDELIVER_EXPLAIN =
  '适用于交付取回失败、停在人工审核的执行：重置交付并重新取回一次。不改计费，不会重复扣点或退点；若仍取不回会再次回到人工审核。';
const PUBLISH_EXPLAIN =
  '适用于产物只存进了私有桶、用户看不到结果的交付：补发一份公开副本，并把可访问地址回写到任务和素材。不改计费，只是给用户补上可访问地址。';

const actionVisible = ref(false);
const actionSubmitting = ref(false);
const actionMode = ref<ActionMode>('redeliver');
const actionTargets = ref<string[]>([]);
/** 批量入口走批量接口并展示逐条结果，哪怕只勾了一条 */
const actionBatch = ref(false);
const actionReason = ref('');
const batchResultVisible = ref(false);
const batchResult = ref<BatchPublishPrivateResult | null>(null);
const batchFailedColumns = [
  { title: '执行号', dataIndex: 'executionNo', width: 260 },
  { title: '失败原因', dataIndex: 'reason' },
];

const actionTitle = computed(() => {
  if (actionMode.value === 'redeliver') return '重新交付';
  return actionBatch.value ? `批量发布公开副本 ${actionTargets.value.length} 条` : '发布公开副本';
});

function openAction(mode: ActionMode, targets: string[], batch = false) {
  if (!targets.length) return;
  if (targets.length > PUBLISH_PRIVATE_BATCH_LIMIT) {
    message.warning(`单次最多 ${PUBLISH_PRIVATE_BATCH_LIMIT} 条，请减少勾选`);
    return;
  }
  actionMode.value = mode;
  actionTargets.value = targets;
  actionBatch.value = batch;
  actionReason.value = '';
  actionVisible.value = true;
}

async function submitAction() {
  const reason = actionReason.value.trim();
  if (!reason) {
    message.warning('请填写原因，它会记进审计');
    return;
  }
  const targets = actionTargets.value;
  actionSubmitting.value = true;
  try {
    if (actionMode.value === 'redeliver') {
      const result = await redeliverExternalExecution(targets[0], reason);
      if (result?.pendingReview) {
        message.warning(
          '已重新取回，但仍未交付成功，执行已回到人工审核（可能是冻结的结果地址已取不到），请改走退款处理',
          6,
        );
      } else {
        message.success(`已重新交付，当前阶段 ${result?.stage ?? '—'}`);
      }
    } else if (!actionBatch.value) {
      await publishSingle(targets[0], reason);
    } else {
      const result = await batchPublishPrivateExternalExecutions(targets, reason);
      batchResult.value = {
        succeeded: result?.succeeded ?? [],
        failed: result?.failed ?? [],
      };
      batchResultVisible.value = true;
      selectedKeys.value = [];
    }
    actionVisible.value = false;
    void Promise.all([loadList(), loadOverview()]);
    if (detailVisible.value && detail.value && targets.includes(detail.value.executionNo)) {
      void refreshDetail(detail.value.executionNo);
    }
  } catch {
    /* 拦截器已弹出后端 msg（409 时即没过的那条判据），保留弹窗便于修改原因后重试 */
  } finally {
    actionSubmitting.value = false;
  }
}

async function publishSingle(executionNo: string, reason: string) {
  const result = await publishPrivateExternalExecution(executionNo, reason);
  const slots = result?.publishedSlots?.length ?? 0;
  message.success(`已发布公开副本${slots ? ` ${slots} 个产物位` : ''}`);
}

async function refreshDetail(executionNo: string) {
  try {
    detail.value = await getExternalExecutionDetail(executionNo);
  } catch {
    /* 拦截器已提示 */
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
.observability-card {
  margin-bottom: 16px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.metric-item {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 8px;
  background: var(--color-fill-quaternary, #fafafa);
}
.metric-item.danger {
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
}
.metric-label,
.section-label {
  color: var(--color-text-secondary, #666);
  font-size: 13px;
}
.metric-value {
  margin: 4px 0;
  color: var(--color-text-primary, #262626);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.25;
}
.metric-note {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.status-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}
.status-strip .section-label {
  margin-right: 4px;
}
.stuck-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.stuck-item {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 8px;
}
.stuck-item.active {
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
  box-shadow: inset 3px 0 0 var(--color-warning, #faad14);
}
.stuck-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--color-text-primary, #262626);
  font-weight: 500;
}
.sample-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-height: 96px;
  margin-top: 6px;
  overflow: auto;
}
.sample-list :deep(.ant-btn) {
  max-width: 100%;
  height: 22px;
  padding: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
}
.provider-table {
  margin-top: 16px;
}
.diagnosis-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.stage-title {
  color: var(--color-text-primary, #262626);
  font-weight: 500;
}
.stage-summary {
  margin-top: 3px;
  color: var(--color-text-secondary, #666);
  line-height: 1.55;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}

@media (max-width: 1200px) {
  .metric-grid,
  .stuck-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid,
  .stuck-grid {
    grid-template-columns: 1fr;
  }
}
</style>
