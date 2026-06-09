<template>
  <div class="page-container">
    <a-page-header
      :title="$t('creationTask.taskDetail')"
      @back="handleBack"
      style="padding: 0 0 16px"
    >
      <template #extra>
        <a-space>
          <a-button
            v-if="task && (task.status === 0 || task.status === 1)"
            danger
            @click="handleCancel"
          >
            {{ $t('common.cancel') }}
          </a-button>
          <a-button
            v-if="task && task.status === 3"
            @click="handleRetry"
          >
            {{ $t('creationTask.retry') }}
          </a-button>
          <a-button
            v-if="task && (task.status === 3 || task.status === 1)"
            type="primary"
            @click="handleForceComplete"
          >
            {{ $t('creationTask.forceComplete') }}
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <a-spin :spinning="loading">
      <!-- Basic Info -->
      <a-card :title="$t('creationTask.basicInfo')" style="margin-bottom: 16px">
        <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }">
          <a-descriptions-item :label="$t('creationTask.taskId')">
            {{ task?.taskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.type')">
            <a-tag v-if="task?.type" :color="typeColorMap[task.type]">
              {{ typeMap[task.type] || task.type }}
            </a-tag>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.status')">
            <a-badge
              v-if="task"
              :color="statusColorMap[task.status]"
              :text="statusMap[task.status] || '-'"
            />
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.userId')">
            {{ task?.userId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.username')">
            {{ task?.username || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.modelName')">
            {{ task?.modelName || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.featureCode')">
            {{ task?.featureCode || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.category')">
            {{ task?.category || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.aigcTaskId')">
            {{ task?.aigcTaskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.mode')">
            <a-tag v-if="task?.mode != null" :color="isCompositeMode(task.mode) ? 'purple' : 'blue'">
              {{ 'MODE_' + task.mode }}
            </a-tag>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.parentTaskId')">
            {{ task?.parentTaskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('common.createTime')">
            {{ task?.createTime || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('common.updateTime')">
            {{ task?.updateTime || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- Billing Info -->
      <a-card :title="$t('creationTask.billingInfo')" style="margin-bottom: 16px">
        <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }">
          <a-descriptions-item :label="$t('creationTask.billingStatus')">
            <a-tag v-if="task?.billingStatus" :color="billingStatusColorMap[task.billingStatus]">
              {{ billingStatusMap[task.billingStatus] || task.billingStatus }}
            </a-tag>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.pricePoints')">
            <span class="points-value">{{ task?.pricePoints ?? '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.reservationNo')">
            {{ task?.reservationNo || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- Params Info -->
      <a-card :title="$t('creationTask.paramsInfo')" style="margin-bottom: 16px">
        <div v-if="formattedParams" class="json-viewer">
          <pre>{{ formattedParams }}</pre>
        </div>
        <a-empty v-else :description="$t('creationTask.noParams')" />
      </a-card>

      <!-- Result -->
      <a-card
        v-if="task?.resultUrl"
        :title="$t('creationTask.resultInfo')"
        style="margin-bottom: 16px"
      >
        <div class="result-preview">
          <a-image
            v-if="task.type === 'IMAGE' || task.type === 'ECOMMERCE'"
            :src="task.resultUrl"
            :alt="$t('creationTask.resultImage')"
            style="max-width: 400px; max-height: 400px"
          />
          <video
            v-else-if="task.type === 'VIDEO'"
            :src="task.resultUrl"
            controls
            style="max-width: 600px; max-height: 400px"
          />
          <a v-else :href="task.resultUrl" target="_blank">{{ task.resultUrl }}</a>
        </div>
      </a-card>

      <!-- Error Info -->
      <a-card
        v-if="task?.errorMsg"
        :title="$t('creationTask.errorInfo')"
        style="margin-bottom: 16px"
      >
        <a-alert type="error" :message="task.errorMsg" show-icon />
      </a-card>

      <!-- Children Tasks -->
      <a-card
        v-if="task?.children && task.children.length > 0"
        :title="$t('creationTask.childrenTasks')"
      >
        <a-table
          :columns="childColumns"
          :data-source="task.children"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'type'">
              <a-tag :color="typeColorMap[record.type]">
                {{ typeMap[record.type] || record.type }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'status'">
              <a-badge
                :color="statusColorMap[record.status]"
                :text="statusMap[record.status] || '-'"
              />
            </template>
            <template v-if="column.dataIndex === 'estimatedCost'">
              <span v-if="record.estimatedCost != null" class="points-value">
                {{ record.estimatedCost }}
              </span>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'costSource'">
              <a-tag v-if="record.costSource" :color="costSourceColorMap[record.costSource] || 'default'">
                {{ t('creationTask.costSourceMap.' + record.costSource) || record.costSource }}
              </a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'providerModel'">
              <code v-if="record.providerModel">{{ record.providerModel }}</code>
              <span v-else>-</span>
            </template>
          </template>
        </a-table>
      </a-card>

      <!-- Composite Cost Summary -->
      <a-card
        v-if="costSummary && costSummary.breakdown.length > 0"
        :title="$t('creationTask.costSummary')"
        style="margin-bottom: 16px"
      >
        <a-descriptions :column="3" size="small" style="margin-bottom: 12px">
          <a-descriptions-item :label="$t('creationTask.totalEstimatedCost')">
            <span class="points-value">{{ costSummary.totalEstimatedCost }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.costCount')">
            {{ costSummary.costCount }}
          </a-descriptions-item>
        </a-descriptions>
        <a-table
          :columns="costColumns"
          :data-source="costSummary.breakdown"
          :pagination="false"
          row-key="taskId"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'costSource'">
              <a-tag :color="costSourceColorMap[record.costSource] || 'default'">
                {{ record.costSource }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'stepCode'">
              <code>{{ record.stepCode }}</code>
            </template>
          </template>
        </a-table>
      </a-card>

      <!-- Reservation Lines -->
      <a-card
        v-if="task?.reservationLines && task.reservationLines.length > 0"
        :title="$t('creationTask.reservationLines')"
        style="margin-bottom: 16px"
      >
        <a-table :columns="reservationColumns" :data-source="task.reservationLines" :pagination="false" row-key="lineNo" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'stepCode'"><code>{{ record.stepCode }}</code></template>
            <template v-if="column.dataIndex === 'mode'"><a-tag v-if="record.mode != null" color="blue">MODE_{{ record.mode }}</a-tag></template>
            <template v-if="column.dataIndex === 'reservedPoints'"><span class="points-value">{{ record.reservedPoints ?? '-' }}</span></template>
            <template v-if="column.dataIndex === 'confirmedPoints'"><span class="points-value">{{ record.confirmedPoints ?? '-' }}</span></template>
            <template v-if="column.dataIndex === 'refundedPoints'"><span class="points-value">{{ record.refundedPoints ?? '-' }}</span></template>
            <template v-if="column.dataIndex === 'status'"><a-tag :color="reservationStatusColorMap[record.status]">{{ record.status }}</a-tag></template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

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
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'antdv-next'
import { getCreationTaskDetail, cancelCreationTask, retryCreationTask, forceCompleteCreationTask, getCompositeCostSummary } from '@/api/creation-task'
import type { CreationTask, CompositeCostSummary } from '@/api/creation-task'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const task = ref<CreationTask | null>(null)
const costSummary = ref<CompositeCostSummary | null>(null)

// Composite modes (MODE_999 = hitVideo, MODE_1000 = hitVideoReplication)
function isCompositeMode(mode: number) {
  return mode === 999 || mode === 1000
}

const reservationColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'stepCode', width: 140 },
  { title: t('creationTask.mode'), dataIndex: 'mode', width: 90, align: 'center' as const },
  { title: t('creationTask.reservedPoints'), dataIndex: 'reservedPoints', width: 110, align: 'right' as const },
  { title: t('creationTask.confirmedPoints'), dataIndex: 'confirmedPoints', width: 110, align: 'right' as const },
  { title: t('creationTask.refundedPoints'), dataIndex: 'refundedPoints', width: 110, align: 'right' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 110, align: 'center' as const },
]

const reservationStatusColorMap: Record<string, string> = {
  HELD: 'blue', CONFIRMED: 'green', REFUNDED: 'orange', CANCELLED: 'default',
}

const costColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'stepCode', width: 160 },
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 200, ellipsis: true },
  { title: t('creationTask.estimatedCost'), dataIndex: 'pointsConsumed', width: 100, align: 'right' as const },
  { title: t('creationTask.costSource'), dataIndex: 'costSource', width: 100, align: 'center' as const },
  { title: t('creationTask.meterType'), dataIndex: 'meterType', width: 100 },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
]

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

const typeMap: Record<string, string> = {
  IMAGE: t('creationTask.typeImage'),
  VIDEO: t('creationTask.typeVideo'),
  ECOMMERCE: t('creationTask.typeEcommerce'),
}

const typeColorMap: Record<string, string> = {
  IMAGE: 'blue',
  VIDEO: 'purple',
  ECOMMERCE: 'orange',
}

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

const costSourceColorMap: Record<string, string> = {
  ESTIMATED: 'orange',
  BILLED: 'green',
  RETURNED: 'blue',
  UNKNOWN: 'default',
}

// Child task columns
const childColumns = [
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 200, ellipsis: true },
  { title: t('creationTask.type'), dataIndex: 'type', width: 100, align: 'center' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 100 },
  { title: t('creationTask.modelName'), dataIndex: 'modelName', width: 120 },
  { title: t('creationTask.providerModel'), dataIndex: 'providerModel', width: 110 },
  { title: t('creationTask.estimatedCost'), dataIndex: 'estimatedCost', width: 100, align: 'right' as const },
  { title: t('creationTask.costSource'), dataIndex: 'costSource', width: 100, align: 'center' as const },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
]

// Format params JSON
const formattedParams = computed(() => {
  if (!task.value?.params) return ''
  try {
    const parsed = JSON.parse(task.value.params)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return task.value.params
  }
})

// Load task detail
async function loadTask() {
  const id = Number(route.params.id)
  if (!id) return

  loading.value = true
  try {
    task.value = await getCreationTaskDetail(id)
    // 组合任务加载成本明细
    if (task.value?.mode != null && isCompositeMode(task.value.mode) && task.value.taskId) {
      try {
        costSummary.value = await getCompositeCostSummary(task.value.taskId)
      } catch { costSummary.value = null }
    }
  } catch (error) {
    console.error('Failed to load task detail:', error)
  } finally {
    loading.value = false
  }
}

function handleBack() {
  router.push({ name: 'CreationTaskList' })
}

function handleCancel() {
  if (!task.value) return
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmCancel'),
    onOk: async () => {
      await cancelCreationTask(task.value!.taskId)
      message.success(t('creationTask.cancelSuccess'))
      loadTask()
    },
  })
}

function handleRetry() {
  if (!task.value) return
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmRetry'),
    onOk: async () => {
      await retryCreationTask(task.value!.taskId)
      message.success(t('creationTask.retrySuccess'))
      loadTask()
    },
  })
}

// Force complete
const forceCompleteVisible = ref(false)
const forceCompleteLoading = ref(false)
const forceCompleteForm = ref({ taskId: '', resultUrl: '' })

function handleForceComplete() {
  if (!task.value) return
  forceCompleteForm.value = { taskId: task.value.taskId, resultUrl: '' }
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
    loadTask()
  } catch (error) {
    console.error('Force complete failed:', error)
  } finally {
    forceCompleteLoading.value = false
  }
}

onMounted(() => {
  loadTask()
})
</script>

<style scoped>
.json-viewer {
  max-height: 400px;
  overflow: auto;
  background: var(--color-bg-layout);
  border-radius: 8px;
  padding: 12px 16px;
}

.json-viewer pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.points-value {
  font-weight: 600;
  color: var(--color-primary);
}

.result-preview {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8px;
}
</style>
