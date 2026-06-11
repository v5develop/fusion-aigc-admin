<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('creationTask.noTaskData')" />
      </template>
      <template #toolbar>
        <a-button @click="handleExport">
          <ExportOutlined /> {{ $t('common.export') }}
        </a-button>
        <a-button
          danger
          :disabled="selectedRowKeys.length === 0"
          @click="handleBatchCancel"
        >
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
            {{ record.typeName || record.type }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-badge :color="statusColorMap[record.status]" :text="statusMap[record.status] || '-'" />
        </template>

        <template v-if="column.dataIndex === 'billingStatus'">
          <a-tag :color="billingStatusColorMap[record.billingStatus]">
            {{ billingStatusMap[record.billingStatus] || record.billingStatus || '-' }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'pricePoints'">
          <span class="points-value">{{ record.pricePoints ?? '-' }}</span>
        </template>

        <template v-if="column.dataIndex === 'errorMsg'">
          <a-tooltip v-if="record.errorMsg" :title="record.errorMsg">
            <span class="text-ellipsis">{{ record.errorMsg }}</span>
          </a-tooltip>
          <span v-else>-</span>
        </template>

        <template v-if="column.key === 'operation'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="handleViewDetail(record)">
              {{ $t('common.view') }}
            </a-button>
            <a-button
              v-if="record.status === 0 || record.status === 1"
              type="link"
              size="small"
              danger
              @click="handleCancel(record)"
            >
              {{ $t('common.cancel') }}
            </a-button>
            <a-button
              v-if="record.status === 3"
              type="link"
              size="small"
              @click="handleRetry(record)"
            >
              {{ $t('creationTask.retry') }}
            </a-button>
            <a-button
              v-if="record.status === 3 || record.status === 1"
              type="link"
              size="small"
              @click="handleForceComplete(record)"
            >
              {{ $t('creationTask.forceComplete') }}
            </a-button>
          </a-space>
        </template>
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
        <a-form-item :label="$t('creationTask.resultUrl')">
          <a-input
            v-model:value="forceCompleteForm.resultUrl"
            :placeholder="$t('creationTask.resultUrlPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ExportOutlined, StopOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getCreationTaskList,
  cancelCreationTask,
  retryCreationTask,
  forceCompleteCreationTask,
  exportCreationTasks,
  batchCancelCreationTasks,
} from '@/api/creation-task'
import type { CreationTask } from '@/api/creation-task'
import { getAllOffers } from '@/api/billing-offer'

const { t } = useI18n()
const router = useRouter()
const tableRef = ref()
const selectedRowKeys = ref<string[]>([])

// 动态类型筛选选项（从 offer 表加载）
const typeSearchOptions = ref<{ label: string; value: string }[]>([])
onMounted(async () => {
  try {
    const offers = await getAllOffers()
    typeSearchOptions.value = (offers || [])
      .filter((o: any) => o.entryCode && o.status === 'ACTIVE')
      .map((o: any) => ({ label: o.name || o.entryCode, value: o.entryCode }))
  } catch {
    // 加载失败时留空，不影响主流程
  }
})

// Status map
const statusMap: Record<number, string> = {
  0: t('creationTask.statusQueuing'),
  1: t('creationTask.statusProcessing'),
  2: t('creationTask.statusCompleted'),
  3: t('creationTask.statusFailed'),
  4: t('creationTask.statusCancelled'),
}

const statusColorMap: Record<number, string> = {
  0: '#1890ff',
  1: '#fa8c16',
  2: '#52c41a',
  3: '#ff4d4f',
  4: '#d9d9d9',
}

// Type color map — 尝试匹配已知大类意图，未匹配时根据名称选择
const TYPE_COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'magenta']
function getTypeColor(type: string, index?: number): string {
  if (!type) return 'default'
  // 图片类
  if (/image|Image|photo|Photo|picture/i.test(type) || type === 'IMAGE') return 'blue'
  // 视频类
  if (/video|Video|clip|Clip/i.test(type) || type === 'VIDEO') return 'purple'
  // 电商类
  if (/ecommerce|Ecommerce|product|Product/i.test(type) || type === 'ECOMMERCE') return 'orange'
  // 回退：按 index 循环分配
  return TYPE_COLORS[(index ?? 0) % TYPE_COLORS.length]
}

// Billing status map
const billingStatusMap: Record<string, string> = {
  HELD: t('creationTask.billingHeld'),
  CONFIRMED: t('creationTask.billingConfirmed'),
  REFUNDED: t('creationTask.billingRefunded'),
  CANCELLED: t('creationTask.billingCancelled'),
  SETTLEMENT_FAILED: t('creationTask.billingSettlementFailed'),
}

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
}

// Columns definition
const columns = computed(() => [
  {
    title: t('creationTask.taskId'),
    dataIndex: 'taskId',
    searchType: 'input' as const,
    width: 200,
  },
  {
    title: t('creationTask.userId'),
    dataIndex: 'userId',
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
    searchType: 'select' as const,
    searchOptions: typeSearchOptions.value,
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('creationTask.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('creationTask.statusQueuing'), value: 0 },
      { label: t('creationTask.statusProcessing'), value: 1 },
      { label: t('creationTask.statusCompleted'), value: 2 },
      { label: t('creationTask.statusFailed'), value: 3 },
      { label: t('creationTask.statusCancelled'), value: 4 },
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
    searchType: 'input' as const,
    width: 140,
  },
  {
    title: t('creationTask.billingStatus'),
    dataIndex: 'billingStatus',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('creationTask.billingHeld'), value: 'HELD' },
      { label: t('creationTask.billingConfirmed'), value: 'CONFIRMED' },
      { label: t('creationTask.billingRefunded'), value: 'REFUNDED' },
      { label: t('creationTask.billingCancelled'), value: 'CANCELLED' },
      { label: t('creationTask.billingSettlementFailed'), value: 'SETTLEMENT_FAILED' },
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
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const,
  },
])

// Load data
async function loadData(params: Record<string, unknown>) {
  const res = await getCreationTaskList({
    type: params.type as string | undefined,
    status: params.status as number | string | undefined,
    userId: params.userId as number | string | undefined,
    featureCode: params.featureCode as string | undefined,
    billingStatus: params.billingStatus as string | undefined,
    keyword: params.keyword as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

// View detail
function handleViewDetail(record: CreationTask) {
  router.push({ name: 'CreationTaskDetail', params: { id: String(record.id) } })
}

// Cancel task
function handleCancel(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmCancel'),
    onOk: async () => {
      await cancelCreationTask(record.taskId)
      message.success(t('creationTask.cancelSuccess'))
      tableRef.value?.reload()
    },
  })
}

// Retry task
function handleRetry(record: CreationTask) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmRetry'),
    onOk: async () => {
      await retryCreationTask(record.taskId)
      message.success(t('creationTask.retrySuccess'))
      tableRef.value?.reload()
    },
  })
}

// Force complete
const forceCompleteVisible = ref(false)
const forceCompleteLoading = ref(false)
const forceCompleteForm = ref({ taskId: '', resultUrl: '' })

function handleForceComplete(record: CreationTask) {
  forceCompleteForm.value = { taskId: record.taskId, resultUrl: '' }
  forceCompleteVisible.value = true
}

async function handleForceCompleteConfirm() {
  forceCompleteLoading.value = true
  try {
    await forceCompleteCreationTask(
      forceCompleteForm.value.taskId,
      forceCompleteForm.value.resultUrl || undefined,
    )
    message.success(t('creationTask.forceCompleteSuccess'))
    forceCompleteVisible.value = false
    tableRef.value?.reload()
  } catch (error) {
    console.error('Force complete failed:', error)
  } finally {
    forceCompleteLoading.value = false
  }
}

// Batch cancel
function handleBatchCancel() {
  if (selectedRowKeys.value.length === 0) {
    message.warning(t('creationTask.selectTaskFirst'))
    return
  }
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmBatchCancel', { count: selectedRowKeys.value.length }),
    onOk: async () => {
      await batchCancelCreationTasks(selectedRowKeys.value)
      message.success(t('creationTask.batchCancelSuccess'))
      selectedRowKeys.value = []
      tableRef.value?.reload()
    },
  })
}

// Export
async function handleExport() {
  try {
    const searchParams = tableRef.value?.searchForm || {}
    const blob = await exportCreationTasks({
      type: searchParams.type,
      status: searchParams.status,
      userId: searchParams.userId,
      featureCode: searchParams.featureCode,
      billingStatus: searchParams.billingStatus,
      keyword: searchParams.keyword,
      page: 1,
      pageSize: 10000,
    })
    const url = window.URL.createObjectURL(blob as unknown as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `creation-tasks-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    message.success(t('common.success'))
  } catch (error) {
    console.error('Export failed:', error)
  }
}
</script>

<style scoped>
.points-value {
  font-weight: 600;
  color: var(--color-primary);
}

.text-ellipsis {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
