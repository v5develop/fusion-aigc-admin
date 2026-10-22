<template>
  <div class="page-container">
    <a-card :title="$t('reconcile.title')">
      <template #extra>
        <a-space>
          <a-select
            v-model:value="status"
            style="width: 160px"
            :options="statusOptions"
            @change="reload"
          />
          <a-button :loading="loading" @click="reload">{{ $t('common.refresh') }}</a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        row-key="reconcileNo"
        :pagination="false"
        :scroll="{ x: 1400 }"
      >
        <template #emptyText>
          <a-empty :description="$t('reconcile.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'taskId'">
            <a @click="goTask(record.taskId)">{{ record.taskId }}</a>
          </template>
          <template v-else-if="column.dataIndex === 'moneyAtRisk'">
            <a-tag :color="record.moneyAtRisk ? 'red' : 'default'">
              {{ record.moneyAtRisk ? $t('reconcile.risk.yes') : $t('reconcile.risk.no') }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'estimatedPoints'">
            {{ record.estimatedPoints ?? '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor[record.status as ReconcileStatus]">
              {{ statusLabel(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'retryRequestedBy'">
            <div v-if="record.retryRequestedBy">
              {{ record.retryRequestedBy }}
              <div class="sub-text">{{ record.retryRequestedAt || '-' }}</div>
            </div>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-button
              v-if="record.status === 'PENDING_REVIEW'"
              type="link"
              size="small"
              @click="openRetry(record.taskId)"
            >
              {{ $t('reconcile.retry') }}
            </a-button>
          </template>
        </template>
      </a-table>

      <div class="footer-bar">
        <span class="sub-text">{{ $t('reconcile.total', { total }) }}</span>
        <a-button v-if="nextBeforeId != null" :loading="loadingMore" @click="loadMore">
          {{ $t('reconcile.loadMore') }}
        </a-button>
      </div>
    </a-card>

    <ReconcileRetryModal v-model:open="retryVisible" :task-id="retryTaskId" @success="reload" />
  </div>
</template>

<script setup lang="ts">
import type { ReconcileItem, ReconcileStatus } from '@/api/billing-reconcile';

import { message } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getReconciliations } from '@/api/billing-reconcile';
import { getCreationTaskList } from '@/api/creation-task';
import ReconcileRetryModal from '@/components/Billing/ReconcileRetryModal.vue';
import { usePermission } from '@/composables/usePermission';

const { t } = useI18n();
const router = useRouter();
const { can } = usePermission();

const PAGE_SIZE = 20;

const status = ref<ReconcileStatus>('PENDING_REVIEW');
const items = ref<ReconcileItem[]>([]);
const total = ref(0);
const nextBeforeId = ref<number | null>(null);
const loading = ref(false);
const loadingMore = ref(false);

const retryVisible = ref(false);
const retryTaskId = ref('');

const statusColor: Record<ReconcileStatus, string> = {
  PENDING_REVIEW: 'orange',
  BILLED: 'red',
  NOT_BILLED: 'green',
};

const statusOptions = computed(() =>
  (['PENDING_REVIEW', 'BILLED', 'NOT_BILLED'] as ReconcileStatus[]).map((v) => ({
    value: v,
    label: statusLabel(v),
  })),
);

function statusLabel(v: string) {
  const map: Record<string, string> = {
    PENDING_REVIEW: t('reconcile.status.pending'),
    BILLED: t('reconcile.status.billed'),
    NOT_BILLED: t('reconcile.status.notBilled'),
  };
  return map[v] || v || '-';
}

const columns = computed(() => {
  const cols = [
    { title: t('reconcile.col.reconcileNo'), dataIndex: 'reconcileNo', width: 190 },
    { title: t('reconcile.col.taskId'), dataIndex: 'taskId', width: 230 },
    { title: t('reconcile.col.stepPath'), dataIndex: 'stepPath', width: 180, ellipsis: true },
    { title: t('reconcile.col.gatewayRunNo'), dataIndex: 'gatewayRunNo', width: 100 },
    { title: t('reconcile.col.stepStatus'), dataIndex: 'stepStatus', width: 120 },
    { title: t('reconcile.col.moneyAtRisk'), dataIndex: 'moneyAtRisk', width: 110 },
    { title: t('reconcile.col.estimatedPoints'), dataIndex: 'estimatedPoints', width: 110 },
    { title: t('reconcile.col.status'), dataIndex: 'status', width: 100 },
    { title: t('reconcile.col.createTime'), dataIndex: 'createTime', width: 170 },
    { title: t('reconcile.col.retryRequested'), dataIndex: 'retryRequestedBy', width: 190 },
  ];
  // 无处理权限时整列操作隐藏
  if (can('reconciliation:handle')) {
    cols.push({ title: t('common.operation'), key: 'operation', width: 100 } as never);
  }
  return cols;
});

async function fetchPage(beforeId?: number) {
  return getReconciliations({ status: status.value, limit: PAGE_SIZE, beforeId });
}

async function reload() {
  loading.value = true;
  try {
    const res = await fetchPage();
    items.value = res.items || [];
    total.value = res.total ?? 0;
    nextBeforeId.value = res.nextBeforeId ?? null;
  } catch (e) {
    console.error('Failed to load reconciliations:', e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (nextBeforeId.value == null) return;
  loadingMore.value = true;
  try {
    const res = await fetchPage(nextBeforeId.value);
    items.value = [...items.value, ...(res.items || [])];
    total.value = res.total ?? total.value;
    nextBeforeId.value = res.nextBeforeId ?? null;
  } catch (e) {
    console.error('Failed to load more reconciliations:', e);
  } finally {
    loadingMore.value = false;
  }
}

function openRetry(taskId: string) {
  retryTaskId.value = taskId;
  retryVisible.value = true;
}

// 任务详情路由用的是数字主键，核对单只带 taskId，需先按 taskId 检索出主键
async function goTask(taskId: string) {
  try {
    const res = await getCreationTaskList({ keyword: taskId, page: 1, pageSize: 5 });
    const hit = (res.list || []).find((r) => r.taskId === taskId);
    if (!hit) {
      message.warning(t('reconcile.taskNotFound'));
      return;
    }
    router.push({ name: 'CreationTaskDetail', params: { id: String(hit.id) } });
  } catch (e) {
    console.error('Failed to resolve task:', e);
  }
}

onMounted(reload);
</script>

<style scoped>
.sub-text {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
</style>
