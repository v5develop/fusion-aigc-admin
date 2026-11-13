<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
      :expandable="expandableConfig"
    >
      <template #emptyText>
        <a-empty :description="$t('creationTask.noTaskData')" />
      </template>
      <template #toolbar>
        <a-button @click="handleExport"> <ExportOutlined /> {{ $t('common.export') }} </a-button>
        <a-button danger :disabled="selectedRowKeys.length === 0" @click="handleBatchCancel">
          <StopOutlined /> {{ $t('creationTask.batchCancel') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'taskId'">
          <a-button type="link" size="small" @click="handleViewDetail(record)">
            {{ record.taskId }}
          </a-button>
        </template>

        <template v-if="column.dataIndex === 'type'">
          <a-tag :color="getTypeColor(record.type)">
            {{ typeLabel(record) }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColorMap[record.status]">{{
            statusMap[record.status] || '-'
          }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'totalDurationMs'">
          <a-tooltip
            v-if="record.deliveredAt"
            :title="`${$t('latency.deliveredAt')}: ${record.deliveredAt}`"
          >
            <span>{{ formatDuration(record.totalDurationMs) }}</span>
          </a-tooltip>
          <span v-else>{{
            record.totalDurationMs != null ? formatDuration(record.totalDurationMs) : '—'
          }}</span>
        </template>

        <template v-if="column.dataIndex === 'billingStatus'">
          <template v-if="record.hasChildren">
            <a-tag :color="billingStatusColorMap[record.aggregatedBillingStatus]">
              {{
                billingStatusMap[record.aggregatedBillingStatus] ||
                record.aggregatedBillingStatus ||
                '-'
              }}
            </a-tag>
            <a-tooltip :title="$t('creationTask.aggregatedHint', { count: record.childCount })">
              <a-tag color="purple">{{ $t('creationTask.aggregatedTag') }}</a-tag>
            </a-tooltip>
          </template>
          <a-tag v-else :color="billingStatusColorMap[record.billingStatus]">
            {{ billingStatusMap[record.billingStatus] || record.billingStatus || '-' }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'pricePoints'">
          <template v-if="record.hasChildren">
            <a-tooltip :title="$t('creationTask.aggregatedHint', { count: record.childCount })">
              <span class="points-value">{{ record.totalPricePoints ?? '-' }}</span>
              <span class="agg-badge">{{ $t('creationTask.aggregatedTag') }}</span>
            </a-tooltip>
          </template>
          <span v-else class="points-value">{{ record.pricePoints ?? '-' }}</span>
        </template>

        <template v-if="column.dataIndex === 'errorMsg'">
          <a-tooltip v-if="record.errorMsg" :title="record.errorMsg">
            <span class="text-ellipsis">{{ record.errorMsg }}</span>
          </a-tooltip>
          <span v-else>-</span>
        </template>

        <template v-if="column.key === 'operation'">
          <a-space :size="4" :wrap="true">
            <a-button type="link" size="small" @click="handleViewDetail(record)">
              {{ $t('common.view') }}
            </a-button>
            <a-button
              v-if="record.canCancel"
              type="link"
              size="small"
              danger
              @click="handleCancel(record)"
            >
              {{ $t('common.cancel') }}
            </a-button>
            <a-button v-if="record.canRetry" type="link" size="small" @click="handleRetry(record)">
              {{ $t('creationTask.retry') }}
            </a-button>
            <a-button
              v-if="record.canForceComplete"
              type="link"
              size="small"
              @click="handleForceComplete(record)"
            >
              {{ $t('creationTask.forceComplete') }}
            </a-button>
            <a-button
              v-if="record.canForceFail"
              type="link"
              size="small"
              danger
              @click="handleForceFail(record)"
            >
              {{ $t('creationTask.forceFail') }}
            </a-button>
            <a-button
              v-if="!record.blockStatus"
              type="link"
              size="small"
              danger
              @click="handleBlock(record)"
            >
              {{ $t('creationTask.block') }}
            </a-button>
            <a-button
              v-if="record.blockStatus === 1"
              type="link"
              size="small"
              @click="handleUnblock(record)"
            >
              {{ $t('creationTask.unblock') }}
            </a-button>
            <a-tag v-if="record.blockStatus === 2" color="red">
              {{ $t('creationTask.blockedPermanent') }}
            </a-tag>
          </a-space>
        </template>
      </template>

      <!-- 子任务展开行 -->
      <template #expandedRowRender="{ record }">
        <ChildTaskExpand
          :task-id="record.taskId"
          :key="`child-${record.taskId}-${childReloadTick}-${childExpandTicks[record.taskId] || 0}`"
        >
          <template #default="{ data }">
            <a-table
              :columns="childColumns"
              :data-source="data"
              :pagination="false"
              row-key="id"
              size="small"
              :scroll="{ x: 1250 }"
            >
              <template #emptyText>
                <a-empty :description="$t('creationTask.noChildData')" />
              </template>
              <template #bodyCell="{ column, record: child }">
                <template v-if="column.dataIndex === 'taskId'">
                  <a-button type="link" size="small" @click="handleViewDetail(child)">
                    {{ child.taskId }}
                  </a-button>
                </template>
                <template v-if="column.dataIndex === 'type'">
                  <a-tag :color="getTypeColor(child.type)">
                    {{ typeLabel(child) }}
                  </a-tag>
                </template>
                <template v-if="column.dataIndex === 'status'">
                  <a-tag :color="statusColorMap[child.status]">{{
                    statusMap[child.status] || '-'
                  }}</a-tag>
                </template>
                <template v-if="column.dataIndex === 'result'">
                  <a-image
                    v-if="isImageUrl(child.resultUrl)"
                    :src="child.resultUrl"
                    :width="56"
                    :height="56"
                    style="object-fit: cover; border-radius: 4px"
                  />
                  <video
                    v-else-if="isVideoUrl(child.resultUrl)"
                    :src="child.resultUrl"
                    controls
                    style="width: 88px; height: 56px; border-radius: 4px"
                  />
                  <a v-else-if="child.resultUrl" :href="child.resultUrl" target="_blank">{{
                    $t('creationTask.previewResult')
                  }}</a>
                  <span v-else>-</span>
                </template>
                <template v-if="column.dataIndex === 'pricePoints'">
                  <span class="points-value">{{ child.pricePoints ?? '-' }}</span>
                </template>
                <template v-if="column.dataIndex === 'errorMsg'">
                  <a-tooltip v-if="child.errorMsg" :title="child.errorMsg">
                    <span class="text-ellipsis">{{ child.errorMsg }}</span>
                  </a-tooltip>
                  <span v-else>-</span>
                </template>
                <!-- 失败子任务逐个处理：重试(仅本子) / 强制完成 / 强制失败 -->
                <template v-if="column.dataIndex === 'action'">
                  <a-space :size="4">
                    <a-button
                      v-if="child.canRetry"
                      type="link"
                      size="small"
                      @click="handleRetry(child)"
                    >
                      {{ $t('creationTask.retry') }}
                    </a-button>
                    <a-button
                      v-if="child.canForceComplete"
                      type="link"
                      size="small"
                      @click="handleForceComplete(child)"
                    >
                      {{ $t('creationTask.forceComplete') }}
                    </a-button>
                    <a-button
                      v-if="child.canForceFail"
                      type="link"
                      size="small"
                      danger
                      @click="handleForceFail(child)"
                    >
                      {{ $t('creationTask.forceFail') }}
                    </a-button>
                    <span v-if="!child.canRetry && !child.canForceComplete && !child.canForceFail"
                      >-</span
                    >
                  </a-space>
                </template>
              </template>
            </a-table>
          </template>
        </ChildTaskExpand>
      </template>
    </ProTable>

    <!-- Force Complete Modal -->
    <a-modal
      v-model:open="forceCompleteVisible"
      :title="$t('creationTask.forceComplete')"
      @ok="handleForceCompleteConfirm"
      :confirmLoading="forceCompleteLoading"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('creationTask.resultUrl')" required>
          <a-input
            v-model:value="forceCompleteForm.resultUrl"
            :placeholder="$t('creationTask.resultUrlPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Block Modal -->
    <a-modal
      v-model:open="blockVisible"
      :title="$t('creationTask.block')"
      :confirmLoading="blockLoading"
      @ok="handleBlockConfirm"
    >
      <a-alert
        type="warning"
        show-icon
        :message="$t('creationTask.blockConfirmContent')"
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item :label="$t('creationTask.blockReason')">
          <a-textarea
            v-model:value="blockForm.reason"
            :placeholder="$t('creationTask.blockReasonPlaceholder')"
            :rows="2"
          />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="blockForm.permanent">
            {{ $t('creationTask.blockPermanent') }}
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { CreationTask } from '@/api/creation-task';

import { ExportOutlined, StopOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed, onActivated, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getContentEntryCodes } from '@/api/creation-content';
import {
  getCreationTaskList,
  cancelCreationTask,
  retryCreationTask,
  isRefundedBilling,
  forceCompleteCreationTask,
  forceFailCreationTask,
  blockCreationTask,
  unblockCreationTask,
  exportCreationTasks,
  batchCancelCreationTasks,
} from '@/api/creation-task';
import ProTable from '@/components/Pro/ProTable/index.vue';

import ChildTaskExpand from './ChildTaskExpand.vue';
import { formatDuration } from './trace-helpers';

const { t } = useI18n();
const router = useRouter();
const tableRef = ref();

// 布局的 <keep-alive :include> 按组件名匹配（值是路由名），<script setup> 默认名是文件名 index，
// 一直匹配不上，于是从详情页返回时列表整页重挂，页码与筛选条件全丢。
defineOptions({ name: 'CreationTaskList' });

// 从详情返回时实例是缓存的，页码与筛选都还在；原地重查一次，让在详情里做的取消/重试等操作体现出来。
// 首次挂载时 ProTable 自己会加载，跳过那一次激活，免得重复请求。
let firstActivation = true;
onActivated(() => {
  if (firstActivation) {
    firstActivation = false;
    return;
  }
  tableRef.value?.reload();
});
const selectedRowKeys = ref<string[]>([]);
// 子任务展开行强制刷新：动作作用于子任务后 +1，重挂 ChildTaskExpand 拉取最新子状态
const childReloadTick = ref(0);

/**
 * 每个父任务各自的展开计数，每次「重新展开」+1。
 *
 * 底层表格收起展开行时<b>并不销毁它</b>：@v-c/table 的 BodyRow 里有个只进不退的
 * latch（`if (rowInfo.expanded.value) expandedRef.value = true`），配合
 * ExpandedRow 的 `style.display = expanded ? null : 'none'`，收起只是把那一行藏起来。
 * 于是 ChildTaskExpand 的 onMounted 一辈子只跑一次，收起再展开看到的还是第一次的数据——
 * 想看到子任务的最新状态只能刷新整页。
 *
 * 把这个计数编进 :key，重新展开就换 key、重挂组件，onMounted 再跑一次。
 * 按 taskId 分开计数，展开 A 不会顺带把已展开的 B 也重拉一遍。
 */
const childExpandTicks = ref<Record<string, number>>({});

// 刷新父列表（重算聚合）+ 重挂展开的子任务行（拉取最新状态）
function reloadTasks() {
  tableRef.value?.reload();
  childReloadTick.value++;
}

// 仅有子任务的父任务行可展开；展开行内容由 ChildTaskExpand 组件自管理
const expandableConfig = computed(() => ({
  rowExpandable: (record: CreationTask) => !!record.hasChildren,
  onExpand: (expanded: boolean, record: CreationTask) => {
    if (!expanded || !record.taskId) return;
    childExpandTicks.value[record.taskId] = (childExpandTicks.value[record.taskId] || 0) + 1;
  },
}));

// 入口筛选选项：与创作内容列表同源（启用中的 offer + creaft v1 兼容能力入口）。
// 只取 offer 的话，v1 线协议提交的任务（entry_code 是 creaft.v1.*）在这里一条都筛不到
const typeSearchOptions = ref<{ label: string; value: string }[]>([]);
onMounted(async () => {
  try {
    const entries = (await getContentEntryCodes()) || [];
    typeSearchOptions.value = entries.map((e) => ({
      label: e.entryName || e.entryCode,
      value: e.entryCode,
    }));
  } catch {
    // 加载失败时留空，不影响主流程
  }
});

// Status map
const statusMap: Record<number, string> = {
  0: t('creationTask.statusQueuing'),
  1: t('creationTask.statusProcessing'),
  2: t('creationTask.statusCompleted'),
  3: t('creationTask.statusFailed'),
  4: t('creationTask.statusCancelled'),
  5: t('creationTask.statusPartialSuccess'),
};

const statusColorMap: Record<number, string> = {
  0: 'blue',
  1: 'gold',
  2: 'green',
  3: 'red',
  4: 'default',
  5: 'orange',
};

// 任务类型展示：优先后端中文名(typeName，来自计费 Offer)，通用 image/video 无 Offer 时回退到本地词条
function typeLabel(r: { typeName?: string; type?: string }): string {
  if (r.typeName) return r.typeName;
  if (r.type === 'image') return t('creationTask.typeGenericImage');
  if (r.type === 'video') return t('creationTask.typeGenericVideo');
  return r.type || '-';
}

// Type color map — 尝试匹配已知大类意图，未匹配时根据名称选择
const TYPE_COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'magenta'];
function getTypeColor(type: string, index?: number): string {
  if (!type) return 'default';
  // 图片类
  if (/image|Image|photo|Photo|picture/i.test(type) || type === 'IMAGE') return 'blue';
  // 视频类
  if (/video|Video|clip|Clip/i.test(type) || type === 'VIDEO') return 'purple';
  // 电商类
  if (/ecommerce|Ecommerce|product|Product/i.test(type) || type === 'ECOMMERCE') return 'orange';
  // 回退：按 index 循环分配
  return TYPE_COLORS[(index ?? 0) % TYPE_COLORS.length];
}

// Billing status map
const billingStatusMap: Record<string, string> = {
  HELD: t('creationTask.billingHeld'),
  CONFIRMED: t('creationTask.billingConfirmed'),
  REFUNDED: t('creationTask.billingRefunded'),
  CANCELLED: t('creationTask.billingCancelled'),
  SETTLEMENT_FAILED: t('creationTask.billingSettlementFailed'),
  PARTIALLY_REFUNDED: t('creationTask.billingPartiallyRefunded'),
  NONE: t('creationTask.billingNone'),
  BILLING_PENDING_REVIEW: t('creationTask.billingPendingReview'),
};

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  PARTIALLY_REFUNDED: 'warning',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
  NONE: 'default',
  BILLING_PENDING_REVIEW: 'purple',
};

// Columns definition
const columns = computed(() => [
  {
    title: t('creationTask.taskId'),
    dataIndex: 'taskId',
    search: true,
    searchType: 'input' as const,
    width: 200,
  },
  {
    title: t('creationTask.userId'),
    dataIndex: 'userId',
    search: true,
    searchType: 'input' as const,
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('creationTask.username'),
    dataIndex: 'username',
    width: 120,
  },
  {
    title: t('creationTask.type'),
    dataIndex: 'type',
    search: true,
    searchType: 'select' as const,
    searchOptions: typeSearchOptions.value,
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('creationTask.status'),
    dataIndex: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('creationTask.statusQueuing'), value: 0 },
      { label: t('creationTask.statusProcessing'), value: 1 },
      { label: t('creationTask.statusCompleted'), value: 2 },
      { label: t('creationTask.statusFailed'), value: 3 },
      { label: t('creationTask.statusCancelled'), value: 4 },
      { label: t('creationTask.statusPartialSuccess'), value: 5 },
    ],
    width: 120,
  },
  {
    title: t('creationTask.modelName'),
    dataIndex: 'modelName',
    width: 140,
  },
  {
    title: t('creationTask.featureCode'),
    dataIndex: 'featureCode',
    search: true,
    searchType: 'input' as const,
    width: 140,
  },
  {
    title: t('creationTask.billingStatus'),
    dataIndex: 'billingStatus',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('creationTask.billingHeld'), value: 'HELD' },
      { label: t('creationTask.billingConfirmed'), value: 'CONFIRMED' },
      { label: t('creationTask.billingRefunded'), value: 'REFUNDED' },
      { label: t('creationTask.billingCancelled'), value: 'CANCELLED' },
      { label: t('creationTask.billingSettlementFailed'), value: 'SETTLEMENT_FAILED' },
      { label: t('creationTask.billingPartiallyRefunded'), value: 'PARTIALLY_REFUNDED' },
    ],
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('creationTask.pricePoints'),
    dataIndex: 'pricePoints',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('creationTask.errorMsg'),
    dataIndex: 'errorMsg',
    ellipsis: true,
    width: 180,
  },
  {
    title: t('latency.total'),
    dataIndex: 'totalDurationMs',
    width: 110,
    align: 'right' as const,
    // 仅当前页客户端排序（列表接口暂不支持服务端排序）
    sorter: (a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.totalDurationMs as number | null) ?? -1) - ((b.totalDurationMs as number | null) ?? -1),
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 260,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]);

// 子任务表格列（精简版）
const childColumns = computed(() => [
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 240, ellipsis: true },
  { title: t('creationTask.type'), dataIndex: 'type', width: 100, align: 'center' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 110 },
  {
    title: t('creationTask.resultImage'),
    dataIndex: 'result',
    width: 110,
    align: 'center' as const,
  },
  { title: t('creationTask.modelName'), dataIndex: 'modelName', width: 130, ellipsis: true },
  {
    title: t('creationTask.pricePoints'),
    dataIndex: 'pricePoints',
    width: 90,
    align: 'center' as const,
  },
  { title: t('creationTask.errorMsg'), dataIndex: 'errorMsg', ellipsis: true, width: 200 },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]);

/** 结果 URL 是否为图片（按扩展名粗判，签名 URL 去掉 query 再判） */
function isImageUrl(url?: string): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(path);
}
/** 结果 URL 是否为视频 */
function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|avi|mkv)$/.test(path);
}

// Load data
async function loadData(params: Record<string, unknown>) {
  const res = await getCreationTaskList({
    type: params.type as string | undefined,
    status: params.status as number | string | undefined,
    userId: params.userId as number | string | undefined,
    featureCode: params.featureCode as string | undefined,
    billingStatus: params.billingStatus as string | undefined,
    keyword: (params.taskId as string) || (params.keyword as string | undefined),
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

// View detail
function handleViewDetail(record: CreationTask) {
  router.push({ name: 'CreationTaskDetail', params: { id: String(record.id) } });
}

// Cancel task
function handleCancel(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmCancel'),
    onOk: async () => {
      await cancelCreationTask(record.taskId);
      message.success(t('creationTask.cancelSuccess'));
      tableRef.value?.reload();
    },
  });
}

// Retry task
function handleRetry(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t(
      isRefundedBilling(record.billingStatus)
        ? 'creationTask.confirmRetryCharge'
        : 'creationTask.confirmRetry',
    ),
    onOk: async () => {
      await retryCreationTask(record.taskId);
      message.success(t('creationTask.retrySuccess'));
      reloadTasks();
    },
  });
}

// Force fail：置终态、封禁重试（仅已失败任务；FAN_OUT 父任务逐个处理失败子）。父子共用（按 taskId）。
function handleForceFail(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmForceFail'),
    onOk: async () => {
      await forceFailCreationTask(record.taskId);
      message.success(t('creationTask.forceFailSuccess'));
      reloadTasks();
    },
  });
}

// Force complete
const forceCompleteVisible = ref(false);
const forceCompleteLoading = ref(false);
const forceCompleteForm = ref({ taskId: '', resultUrl: '' });

function handleForceComplete(record: CreationTask) {
  forceCompleteForm.value = { taskId: record.taskId, resultUrl: '' };
  forceCompleteVisible.value = true;
}

async function handleForceCompleteConfirm() {
  // 结果URL 必填：无产物不算成功交付（后端亦强制）
  if (!forceCompleteForm.value.resultUrl?.trim()) {
    message.warning(t('creationTask.resultUrlPlaceholder'));
    return;
  }
  forceCompleteLoading.value = true;
  try {
    await forceCompleteCreationTask(
      forceCompleteForm.value.taskId,
      forceCompleteForm.value.resultUrl.trim(),
    );
    message.success(t('creationTask.forceCompleteSuccess'));
    forceCompleteVisible.value = false;
    reloadTasks();
  } catch (error) {
    console.error('Force complete failed:', error);
  } finally {
    forceCompleteLoading.value = false;
  }
}

// Block / unblock
const blockVisible = ref(false);
const blockLoading = ref(false);
const blockForm = ref({ taskId: '', reason: '', permanent: false });

function handleBlock(record: CreationTask) {
  blockForm.value = { taskId: record.taskId, reason: '', permanent: false };
  blockVisible.value = true;
}

async function handleBlockConfirm() {
  blockLoading.value = true;
  try {
    await blockCreationTask(blockForm.value.taskId, {
      permanent: blockForm.value.permanent,
      reason: blockForm.value.reason || undefined,
    });
    message.success(t('creationTask.blockSuccess'));
    blockVisible.value = false;
    tableRef.value?.reload();
  } catch (error) {
    console.error('Block failed:', error);
  } finally {
    blockLoading.value = false;
  }
}

function handleUnblock(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.unblockConfirm'),
    onOk: async () => {
      await unblockCreationTask(record.taskId);
      message.success(t('creationTask.unblockSuccess'));
      tableRef.value?.reload();
    },
  });
}

// Batch cancel
function handleBatchCancel() {
  if (selectedRowKeys.value.length === 0) {
    message.warning(t('creationTask.selectTaskFirst'));
    return;
  }
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmBatchCancel', { count: selectedRowKeys.value.length }),
    onOk: async () => {
      await batchCancelCreationTasks(selectedRowKeys.value);
      message.success(t('creationTask.batchCancelSuccess'));
      selectedRowKeys.value = [];
      tableRef.value?.reload();
    },
  });
}

// Export
async function handleExport() {
  try {
    const searchParams = tableRef.value?.searchForm || {};
    const blob = await exportCreationTasks({
      type: searchParams.type,
      status: searchParams.status,
      userId: searchParams.userId,
      featureCode: searchParams.featureCode,
      billingStatus: searchParams.billingStatus,
      keyword: searchParams.keyword,
      page: 1,
      pageSize: 10000,
    });
    const url = window.URL.createObjectURL(blob as unknown as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `creation-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    message.success(t('common.success'));
  } catch (error) {
    console.error('Export failed:', error);
  }
}
</script>

<style scoped>
.points-value {
  font-weight: 600;
  color: var(--color-primary);
}

.agg-badge {
  margin-left: 4px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-tertiary, #999);
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 4px;
}

.text-ellipsis {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
