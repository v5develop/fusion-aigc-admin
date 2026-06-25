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
            <a-tag v-if="task?.type" :color="getTypeColor(task.type)">
              {{ task.typeName || task.type }}
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
            {{ task?.executionTaskId || '-' }}
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

      <!-- Request Params（用户原始入参，仅主任务有值） -->
      <a-card :title="$t('creationTask.requestParamsInfo')" style="margin-bottom: 16px">
        <div v-if="formattedRequestParams" class="json-viewer">
          <pre>{{ formattedRequestParams }}</pre>
        </div>
        <a-empty v-else :description="$t('creationTask.noRequestParams')" />
      </a-card>

      <!-- Execution Params（下发执行方的出口入参） -->
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
            v-if="isImageUrl(task.resultUrl)"
            :src="task.resultUrl"
            :alt="$t('creationTask.resultImage')"
            style="max-width: 400px; max-height: 400px"
          />
          <video
            v-else-if="isVideoUrl(task.resultUrl)"
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
        <a-alert type="error" show-icon>
          <template #message>
            <span>{{ decodeUnicode(task.errorMsg) }}</span>
            <a-button type="link" size="small" style="padding: 0 4px" @click="showApiLogs">
              {{ $t('creationTask.errorDetail') }}
            </a-button>
          </template>
        </a-alert>
      </a-card>

      <!-- API Request Log Modal (错误信息详情) -->
      <a-modal
        v-model:open="apiLogModalOpen"
        :title="$t('creationTask.apiLogTitle')"
        width="860px"
        :footer="null"
      >
        <a-spin :spinning="apiLogLoading">
          <a-empty v-if="!apiLogLoading && apiLogs.length === 0" :description="$t('creationTask.apiLogEmpty')" />
          <div v-for="log in apiLogs" :key="log.id" class="api-log-item">
            <div class="api-log-head">
              <a-space wrap>
                <a-tag :color="log.success ? 'green' : 'red'">
                  {{ log.success ? $t('creationTask.apiLogSuccess') : $t('creationTask.apiLogFailed') }}
                </a-tag>
                <a-tag color="blue">{{ log.clientName }}</a-tag>
                <a-tag>{{ log.requestType }}</a-tag>
                <a-tag v-if="log.httpMethod">{{ log.httpMethod }}</a-tag>
                <a-tag v-if="log.responseStatus != null" :color="log.responseStatus >= 400 ? 'red' : 'default'">
                  HTTP {{ log.responseStatus }}
                </a-tag>
                <span v-if="log.costTime != null" class="api-log-cost">{{ log.costTime }} ms</span>
                <span class="api-log-time">{{ log.createTime }}</span>
              </a-space>
            </div>
            <a-descriptions :column="1" size="small" bordered class="api-log-desc">
              <a-descriptions-item v-if="log.taskId" :label="$t('creationTask.apiLogTaskId')">
                <code>{{ log.taskId }}</code>
              </a-descriptions-item>
              <a-descriptions-item v-if="log.requestUrl" :label="$t('creationTask.apiLogUrl')">
                <span class="api-log-break">{{ log.requestUrl }}</span>
              </a-descriptions-item>
              <a-descriptions-item v-if="log.errorMessage" :label="$t('creationTask.apiLogError')">
                <span class="api-log-error">{{ decodeUnicode(log.errorMessage) }}</span>
              </a-descriptions-item>
              <a-descriptions-item v-if="log.responseBody" :label="$t('creationTask.apiLogResponse')">
                <pre class="api-log-pre">{{ decodeUnicode(log.responseBody) }}</pre>
              </a-descriptions-item>
              <a-descriptions-item v-if="log.requestBody" :label="$t('creationTask.apiLogRequest')">
                <pre class="api-log-pre">{{ decodeUnicode(log.requestBody) }}</pre>
              </a-descriptions-item>
            </a-descriptions>
          </div>
        </a-spin>
      </a-modal>

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
              <a-tag :color="getTypeColor(record.type)">
                {{ record.typeName || record.type }}
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

      <!-- Pipeline Steps (交付 B) -->
      <a-card
        v-if="pipelineSteps && pipelineSteps.steps.length > 0"
        :title="$t('creationTask.pipelineSteps')"
        style="margin-bottom: 16px"
      >
        <a-descriptions :column="2" size="small" style="margin-bottom: 12px">
          <a-descriptions-item :label="$t('creationTask.pipelineType')">
            <a-tag color="purple">{{ pipelineSteps.parentTask.pipelineType }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.pipelineTopology')">
            <a-tag color="blue">{{ pipelineSteps.parentTask.topology }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.pipelineSettlement')">
            <a-tag color="green">{{ pipelineSteps.parentTask.settlementType }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.pipelineCurrentStep')">
            {{ pipelineSteps.parentTask.orchestrationStep }}
          </a-descriptions-item>
        </a-descriptions>
        <a-table
          :columns="pipelineStepColumns"
          :data-source="pipelineSteps.steps"
          :pagination="false"
          row-key="code"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'code'">
              <code>{{ record.code }}</code>
            </template>
            <template v-if="column.dataIndex === 'kind'">
              <a-tag :color="record.kind === 'LOCAL' ? 'blue' : 'orange'">{{ record.kind }}</a-tag>
            </template>
            <template v-if="column.dataIndex === 'status'">
              <a-badge :color="pipelineStepStatusColor[record.status]" :text="record.status" />
            </template>
            <template v-if="column.dataIndex === 'mode'">
              <a-tag v-if="record.mode != null" color="blue">MODE_{{ record.mode }}</a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'handler'">
              <code v-if="record.handler">{{ record.handler }}</code>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'externalTaskId'">
              <code v-if="record.externalTaskId">{{ record.externalTaskId }}</code>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'resultUrl'">
              <a v-if="record.resultUrl" :href="record.resultUrl" target="_blank">{{ record.resultUrl }}</a>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'errorMsg'">
              <span v-if="record.errorMsg" class="error-text">{{ decodeUnicode(record.errorMsg) }}</span>
              <span v-else>-</span>
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
import { getCreationTaskDetail, cancelCreationTask, retryCreationTask, forceCompleteCreationTask, getCompositeCostSummary, getCreationTaskApiLogs, getPipelineSteps } from '@/api/creation-task'
import type { CreationTask, CompositeCostSummary, ApiRequestLog, PipelineStepsResponse } from '@/api/creation-task'
import { decodeUnicode } from '@/utils/helpers'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const task = ref<CreationTask | null>(null)
const costSummary = ref<CompositeCostSummary | null>(null)
const pipelineSteps = ref<PipelineStepsResponse | null>(null)

// API 请求日志（错误信息详情）
const apiLogModalOpen = ref(false)
const apiLogLoading = ref(false)
const apiLogs = ref<ApiRequestLog[]>([])

async function showApiLogs() {
  if (!task.value) return
  apiLogModalOpen.value = true
  apiLogLoading.value = true
  try {
    apiLogs.value = (await getCreationTaskApiLogs(task.value.id)) ?? []
  } catch {
    apiLogs.value = []
  } finally {
    apiLogLoading.value = false
  }
}

// Composite modes (MODE_999 = hitVideo, MODE_1000 = hitVideoReplication)
function isCompositeMode(mode: number) {
  return mode === 999 || mode === 1000
}

// Pipeline 步骤状态颜色映射
const pipelineStepStatusColor: Record<string, string> = {
  PENDING: '#d9d9d9',
  RUNNING: '#1890ff',
  DONE: '#52c41a',
  FAILED: '#ff4d4f',
}

// Pipeline 步骤表格列定义
const pipelineStepColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'code', width: 120 },
  { title: t('creationTask.stepKind'), dataIndex: 'kind', width: 100, align: 'center' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 100 },
  { title: t('creationTask.mode'), dataIndex: 'mode', width: 100, align: 'center' as const },
  { title: t('creationTask.handler'), dataIndex: 'handler', width: 140 },
  { title: t('creationTask.externalTaskId'), dataIndex: 'externalTaskId', width: 180, ellipsis: true },
  { title: t('creationTask.resultUrl'), dataIndex: 'resultUrl', width: 200, ellipsis: true },
  { title: t('creationTask.errorMsg'), dataIndex: 'errorMsg', width: 200, ellipsis: true },
]

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

const TYPE_COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'magenta']
function getTypeColor(type: string, index?: number): string {
  if (!type) return 'default'
  if (/image|Image|photo|Photo|picture/i.test(type) || type === 'IMAGE') return 'blue'
  if (/video|Video|clip|Clip/i.test(type) || type === 'VIDEO') return 'purple'
  if (/ecommerce|Ecommerce|product|Product/i.test(type) || type === 'ECOMMERCE') return 'orange'
  return TYPE_COLORS[(index ?? 0) % TYPE_COLORS.length]
}

function isImageUrl(url?: string): boolean {
  if (!url) return false
  return /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url)
}
function isVideoUrl(url?: string): boolean {
  if (!url) return false
  return /\.(mp4|webm|mov|avi|mkv|flv)(\?.*)?$/i.test(url)
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

// Format request params JSON（用户原始入参，仅入口主任务有值）
const formattedRequestParams = computed(() => {
  if (!task.value?.requestParams) return ''
  try {
    const parsed = JSON.parse(task.value.requestParams)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return task.value.requestParams
  }
})

// Format execution params JSON（下发执行方的出口入参）
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
    // 组合任务加载成本明细和 pipeline steps
    if (task.value?.mode != null && isCompositeMode(task.value.mode) && task.value.taskId) {
      try {
        costSummary.value = await getCompositeCostSummary(task.value.taskId)
      } catch { costSummary.value = null }

      try {
        pipelineSteps.value = await getPipelineSteps(task.value.taskId)
      } catch { pipelineSteps.value = null }
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

.api-log-item {
  margin-bottom: 16px;
}

.api-log-item:last-child {
  margin-bottom: 0;
}

.api-log-head {
  margin-bottom: 8px;
}

.api-log-cost,
.api-log-time {
  font-size: 12px;
  color: #999;
}

.api-log-break {
  word-break: break-all;
}

.api-log-error {
  color: var(--color-error, #ff4d4f);
  word-break: break-all;
}

.api-log-pre {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
