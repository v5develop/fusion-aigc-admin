<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">外部执行</h2>
      <a-space>
        <a-button @click="reload">刷新</a-button>
      </a-space>
    </div>

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

    <a-modal v-model:open="detailVisible" title="外部执行详情" width="720px" :footer="null">
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
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  batchForceTerminalExternalExecutions,
  forceTerminalExternalExecution,
  getExternalExecutionDetail,
  getExternalExecutions,
  FORCE_TERMINAL_STATUSES,
  type ExternalExecutionDetail,
  type ExternalExecutionListItem,
} from '@/api/external-execution';

const rows = ref<ExternalExecutionListItem[]>([]);
const total = ref(0);
const loading = ref(false);
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
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 160, align: 'center' as const },
];

const stuckCount = computed(() => rows.value.filter((row) => row.forceable).length);
/** 只把可收口的行计入批量：勾了终态行再提交，后端会逐条拒，白跑一趟 */
const selectedForceable = computed(() =>
  rows.value
    .filter((row) => selectedKeys.value.includes(row.executionNo) && row.forceable)
    .map((row) => row.executionNo),
);

const rowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedKeys.value = keys.map(String);
  },
  getCheckboxProps: (record: ExternalExecutionListItem) => ({ disabled: !record.forceable }),
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

function reload() {
  filters.page = 1;
  loadList();
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
    loadList();
  } catch {
    /* 拦截器已提示 */
  } finally {
    forcing.value = false;
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
</style>
