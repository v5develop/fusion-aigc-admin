<template>
  <div class="page-container">
    <div class="detail-page-header">
      <div class="detail-page-header__left">
        <a-button type="text" class="detail-page-header__back" @click="handleBack">
          <ArrowLeftOutlined />
        </a-button>
        <span class="detail-page-header__title">{{ $t('creationTask.taskDetail') }}</span>
      </div>
      <a-space>
        <a-button v-if="task && task.canCancel" danger @click="handleCancel">
          {{ $t('common.cancel') }}
        </a-button>
        <a-button v-if="task && task.canRetry" @click="handleRetry">
          {{ $t('creationTask.retry') }}
        </a-button>
        <a-button v-if="task && task.canForceComplete" type="primary" @click="handleForceComplete">
          {{ $t('creationTask.forceComplete') }}
        </a-button>
        <a-button v-if="task && !task.blockStatus" danger @click="handleBlock">
          {{ $t('creationTask.block') }}
        </a-button>
        <a-button v-if="task && task.blockStatus === 1" @click="handleUnblock">
          {{ $t('creationTask.unblock') }}
        </a-button>
        <a-tag v-if="task && task.blockStatus === 2" color="red">
          {{ $t('creationTask.blockedPermanent') }}
        </a-tag>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <!-- Basic Info -->
      <a-card :title="$t('creationTask.basicInfo')" style="margin-bottom: 16px">
        <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }">
          <a-descriptions-item :label="$t('creationTask.taskId')">
            {{ task?.taskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.type')">
            <a-tag v-if="task?.type" :color="getTypeColor(task.type)">
              {{ typeLabel(task) }}
            </a-tag>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationTask.status')">
            <a-tag v-if="task" :color="statusColorMap[task.status]">
              {{ statusMap[task.status] || '-' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item v-if="task?.blockStatus" :label="$t('creationTask.blockStatus')">
            <a-tag color="red">
              {{
                task.blockStatus === 2
                  ? $t('creationTask.blockedPermanent')
                  : $t('creationTask.blocked')
              }}
            </a-tag>
            <span
              v-if="task.blockReason"
              style="margin-left: 8px; color: var(--color-text-secondary)"
            >
              {{ task.blockReason }}
            </span>
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
            <a-tag
              v-if="task?.mode != null"
              :color="isCompositeMode(task.mode) ? 'purple' : 'blue'"
            >
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
          <!-- 子任务计费聚合（FAN_OUT 批量任务计费落在子任务上，父任务本身可能无预扣）-->
          <template v-if="hasSubTasks">
            <a-descriptions-item :label="$t('creationTask.childCount')">
              {{ task?.childCount ?? '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('creationTask.aggregatedBillingStatus')">
              <a-tag
                v-if="task?.aggregatedBillingStatus"
                :color="billingStatusColorMap[task.aggregatedBillingStatus]"
              >
                {{ billingStatusMap[task.aggregatedBillingStatus] || task.aggregatedBillingStatus }}
              </a-tag>
              <span v-else>-</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('creationTask.totalPricePoints')">
              <span class="points-value">{{ task?.totalPricePoints ?? '-' }}</span>
            </a-descriptions-item>
          </template>
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

      <!-- Result：一次调用出 N 张的 task_type 全落在同一行，逐张渲染，别只显示首张 -->
      <a-card
        v-if="resultUrlList.length"
        :title="$t('creationTask.resultInfo')"
        style="margin-bottom: 16px"
      >
        <template #extra>
          <a-space>
            <a-tag v-if="resultUrlList.length > 1" color="blue">
              {{ $t('creationTask.resultCount', { count: resultUrlList.length }) }}
            </a-tag>
            <a-button
              v-if="isVideoUrl(resultUrlList[0])"
              size="small"
              :loading="fixingContentType"
              @click="handleFixContentType"
            >
              {{ $t('creationTask.fixContentType') }}
            </a-button>
          </a-space>
        </template>
        <div class="result-preview">
          <div v-for="(url, i) in resultUrlList" :key="i" class="result-preview__item">
            <a-image
              v-if="isImageUrl(url)"
              :src="url"
              :alt="$t('creationTask.resultImage')"
              style="max-width: 400px; max-height: 400px"
            />
            <video
              v-else-if="isVideoUrl(url)"
              controls
              playsinline
              preload="metadata"
              style="max-width: 600px; max-height: 400px"
            >
              <source :src="url" :type="getVideoMimeType(url)" />
            </video>
            <a v-else :href="url" target="_blank">{{ url }}</a>
          </div>
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
          <a-empty
            v-if="!apiLogLoading && apiLogs.length === 0"
            :description="$t('creationTask.apiLogEmpty')"
          />
          <div v-for="log in apiLogs" :key="log.id" class="api-log-item">
            <div class="api-log-head">
              <a-space wrap>
                <a-tag :color="log.success ? 'green' : 'red'">
                  {{
                    log.success ? $t('creationTask.apiLogSuccess') : $t('creationTask.apiLogFailed')
                  }}
                </a-tag>
                <a-tag color="blue">{{ log.clientName }}</a-tag>
                <a-tag>{{ log.requestType }}</a-tag>
                <a-tag v-if="log.httpMethod">{{ log.httpMethod }}</a-tag>
                <a-tag
                  v-if="log.responseStatus != null"
                  :color="log.responseStatus >= 400 ? 'red' : 'default'"
                >
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
              <a-descriptions-item
                v-if="log.responseBody"
                :label="$t('creationTask.apiLogResponse')"
              >
                <pre class="api-log-pre">{{ decodeUnicode(log.responseBody) }}</pre>
              </a-descriptions-item>
              <a-descriptions-item v-if="log.requestBody" :label="$t('creationTask.apiLogRequest')">
                <pre class="api-log-pre">{{ decodeUnicode(log.requestBody) }}</pre>
              </a-descriptions-item>
            </a-descriptions>
          </div>
        </a-spin>
      </a-modal>

      <!-- 内容审核日志（内容未通过时在此关联查看命中详情与上游原始响应） -->
      <a-card
        v-if="moderationLogs.length > 0"
        :title="$t('moderationLog.title')"
        style="margin-bottom: 16px"
      >
        <a-table
          :columns="moderationColumns"
          :data-source="moderationLogs"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'bizType'">
              <a-tag color="blue">{{
                $t('moderationLog.bizTypeMap.' + record.bizType) || record.bizType
              }}</a-tag>
            </template>
            <template v-if="column.dataIndex === 'provider'">
              <a-tag :color="record.provider === 'template' ? 'gold' : 'geekblue'">
                {{ $t('moderationLog.providerMap.' + record.provider) || record.provider }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'passed'">
              <a-tag :color="record.passed ? 'green' : 'red'">
                {{ record.passed ? $t('moderationLog.passedYes') : $t('moderationLog.passedNo') }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'reason'">
              <span v-if="record.reason" class="error-text">{{
                decodeUnicode(record.reason)
              }}</span>
              <span v-else>-</span>
            </template>
          </template>
          <template #expandedRowRender="{ record }">
            <a-descriptions :column="1" size="small" bordered>
              <a-descriptions-item
                v-if="record.requestContent"
                :label="$t('moderationLog.requestContent')"
              >
                <span class="api-log-break">{{ decodeUnicode(record.requestContent) }}</span>
              </a-descriptions-item>
              <a-descriptions-item
                v-if="record.rejectedTarget"
                :label="$t('moderationLog.rejectedTarget')"
              >
                <span class="api-log-break">{{ decodeUnicode(record.rejectedTarget) }}</span>
              </a-descriptions-item>
              <a-descriptions-item
                v-if="record.rawResponse"
                :label="$t('moderationLog.rawResponse')"
              >
                <pre class="api-log-pre">{{ decodeUnicode(record.rawResponse) }}</pre>
              </a-descriptions-item>
              <a-descriptions-item v-if="record.requestId" :label="$t('moderationLog.requestId')">
                <code>{{ record.requestId }}</code>
              </a-descriptions-item>
              <!-- 上游检测任务ID：拿它去易盾控制台回溯那次检测 -->
              <a-descriptions-item v-if="record.outTaskId" :label="$t('moderationLog.outTaskId')">
                <code>{{ record.outTaskId }}</code>
              </a-descriptions-item>
            </a-descriptions>
          </template>
        </a-table>
      </a-card>

      <!-- Children Tasks -->
      <a-card
        v-if="task?.subTasks && task.subTasks.length > 0"
        :title="$t('creationTask.childrenTasks')"
      >
        <a-table
          :columns="childColumns"
          :data-source="task.subTasks"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'type'">
              <a-tag :color="getTypeColor(record.type)">
                {{ typeLabel(record) }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'status'">
              <a-tag :color="statusColorMap[record.status]">
                {{ statusMap[record.status] || '-' }}
              </a-tag>
            </template>
            <template v-if="column.dataIndex === 'result'">
              <a-image
                v-if="isImageUrl(record.resultUrl)"
                :src="record.resultUrl"
                :width="64"
                :height="64"
                style="object-fit: cover; border-radius: 4px"
              />
              <video
                v-else-if="isVideoUrl(record.resultUrl)"
                :src="record.resultUrl"
                controls
                style="width: 96px; height: 64px; border-radius: 4px"
              />
              <a v-else-if="record.resultUrl" :href="record.resultUrl" target="_blank">{{
                record.resultUrl
              }}</a>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'estimatedCost'">
              <span v-if="record.estimatedCost != null" class="points-value">
                {{ record.estimatedCost }}
              </span>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'costSource'">
              <a-tag
                v-if="record.costSource"
                :color="costSourceColorMap[record.costSource] || 'default'"
              >
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
              <a-tag
                v-if="record.costSource"
                :color="costSourceColorMap[record.costSource] || 'default'"
              >
                {{ t('creationTask.costSourceMap.' + record.costSource) || record.costSource }}
              </a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'stepCode'">
              <code>{{ record.stepCode }}</code>
            </template>
          </template>
        </a-table>
      </a-card>

      <!-- Workflow Steps：Java 工作流逐步状态，每步链到 AI 网关的调用记录 -->
      <a-card
        v-if="workflowSteps.length > 0"
        :title="$t('creationTask.workflowSteps')"
        style="margin-bottom: 16px"
      >
        <a-table
          :columns="workflowStepColumns"
          :data-source="workflowSteps"
          :pagination="false"
          :row-key="(r: WorkflowStep) => r.stepPath"
          size="small"
          :scroll="{ x: 1200 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'stepPath'">
              <code>{{ record.stepPath }}</code>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-badge
                :color="
                  workflowStepStatusColor[String(record.status || '').toUpperCase()] || '#d9d9d9'
                "
                :text="record.status || '-'"
              />
            </template>
            <template v-else-if="column.dataIndex === 'gatewayCallId'">
              <router-link
                v-if="record.gatewayCallId"
                :to="{ name: 'AiGatewayCalls', query: { callId: record.gatewayCallId } }"
              >
                <code>{{ record.gatewayCallId }}</code>
              </router-link>
              <span v-else>-</span>
            </template>
            <template v-else-if="column.dataIndex === 'errorMsg'">
              <span v-if="record.errorMsg" class="error-text">{{
                decodeUnicode(String(record.errorMsg))
              }}</span>
              <span v-else>-</span>
            </template>
            <template v-else>
              {{ record[column.dataIndex as string] ?? '-' }}
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
              <a v-if="record.resultUrl" :href="record.resultUrl" target="_blank">{{
                record.resultUrl
              }}</a>
              <span v-else>-</span>
            </template>
            <template v-if="column.dataIndex === 'errorMsg'">
              <span v-if="record.errorMsg" class="error-text">{{
                decodeUnicode(record.errorMsg)
              }}</span>
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
        <a-table
          :columns="reservationColumns"
          :data-source="task.reservationLines"
          :pagination="false"
          row-key="lineNo"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'stepCode'"
              ><code>{{ record.stepCode }}</code></template
            >
            <template v-if="column.dataIndex === 'mode'"
              ><a-tag v-if="record.mode != null" color="blue"
                >MODE_{{ record.mode }}</a-tag
              ></template
            >
            <template v-if="column.dataIndex === 'reservedPoints'"
              ><span class="points-value">{{ record.reservedPoints ?? '-' }}</span></template
            >
            <template v-if="column.dataIndex === 'confirmedPoints'"
              ><span class="points-value">{{ record.confirmedPoints ?? '-' }}</span></template
            >
            <template v-if="column.dataIndex === 'refundedPoints'"
              ><span class="points-value">{{ record.refundedPoints ?? '-' }}</span></template
            >
            <template v-if="column.dataIndex === 'status'"
              ><a-tag :color="reservationStatusColorMap[record.status]">{{
                record.status
              }}</a-tag></template
            >
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
import type {
  CreationTask,
  CompositeCostSummary,
  ApiRequestLog,
  PipelineStepsResponse,
  WorkflowStep,
} from '@/api/creation-task';
import type { ModerationLog } from '@/api/moderation-log';

import { ArrowLeftOutlined } from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';

import {
  getCreationTaskDetail,
  cancelCreationTask,
  retryCreationTask,
  isRefundedBilling,
  forceCompleteCreationTask,
  blockCreationTask,
  unblockCreationTask,
  getCompositeCostSummary,
  getCreationTaskApiLogs,
  getPipelineSteps,
  getWorkflowSteps,
  fixTaskContentType,
} from '@/api/creation-task';
import { getCreationTaskModerationLogs } from '@/api/moderation-log';
import { decodeUnicode } from '@/utils/helpers';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const task = ref<CreationTask | null>(null);
const costSummary = ref<CompositeCostSummary | null>(null);
const pipelineSteps = ref<PipelineStepsResponse | null>(null);
const workflowSteps = ref<WorkflowStep[]>([]);

const workflowStepStatusColor: Record<string, string> = {
  PENDING: '#d9d9d9',
  RUNNING: '#1890ff',
  WAITING: '#faad14',
  SUCCEEDED: '#52c41a',
  DONE: '#52c41a',
  FAILED: '#ff4d4f',
  UNKNOWN: '#fa541c',
  CANCELLED: '#8c8c8c',
  SKIPPED: '#bfbfbf',
};

const workflowStepColumns = [
  { title: t('creationTask.stepPath'), dataIndex: 'stepPath', width: 220, fixed: 'left' as const },
  { title: t('creationTask.stepStatus'), dataIndex: 'status', width: 120 },
  { title: t('creationTask.stepOperation'), dataIndex: 'operation', width: 150 },
  { title: t('creationTask.stepModelGroup'), dataIndex: 'modelGroup', width: 180 },
  { title: t('creationTask.gatewayCall'), dataIndex: 'gatewayCallId', width: 240 },
  { title: t('creationTask.stepAttempt'), dataIndex: 'attempt', width: 70 },
  { title: t('creationTask.stepStartedAt'), dataIndex: 'startedAt', width: 170 },
  { title: t('creationTask.stepFinishedAt'), dataIndex: 'finishedAt', width: 170 },
  { title: t('creationTask.errorMsg'), dataIndex: 'errorMsg', ellipsis: true },
];

// 是否存在子任务：存在则展示父任务计费聚合（合计消耗点数 / 折叠计费状态 / 子任务数）
const hasSubTasks = computed(() => (task.value?.subTasks?.length ?? 0) > 0);

/**
 * 待展示的产物列表。优先 resultUrls（一次调用出 N 张的 task_type 把 N 张全落在同一行），
 * 为空才回退 resultUrl —— 单产物任务后端不写 resultUrls 列，回退是常态而非异常。
 * 部分成功时数组里可能有 null 占位（失败位保序），过滤掉不渲染空框。
 */
const resultUrlList = computed<string[]>(() => {
  const many = (task.value?.resultUrls ?? []).filter((u): u is string => !!u);
  if (many.length) return many;
  return task.value?.resultUrl ? [task.value.resultUrl] : [];
});

// API 请求日志（错误信息详情）
const apiLogModalOpen = ref(false);
const apiLogLoading = ref(false);
const apiLogs = ref<ApiRequestLog[]>([]);

// 内容审核日志（含子任务；未过审时关联查看命中详情与上游原始响应）
const moderationLogs = ref<ModerationLog[]>([]);
const moderationColumns = [
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
  { title: t('moderationLog.bizType'), dataIndex: 'bizType', width: 90, align: 'center' as const },
  {
    title: t('moderationLog.provider'),
    dataIndex: 'provider',
    width: 110,
    align: 'center' as const,
  },
  { title: t('moderationLog.passed'), dataIndex: 'passed', width: 90, align: 'center' as const },
  { title: t('moderationLog.scene'), dataIndex: 'scene', width: 110 },
  { title: t('moderationLog.label'), dataIndex: 'label', width: 120 },
  { title: t('moderationLog.reason'), dataIndex: 'reason', ellipsis: true },
];

async function showApiLogs() {
  if (!task.value) return;
  apiLogModalOpen.value = true;
  apiLogLoading.value = true;
  try {
    apiLogs.value = (await getCreationTaskApiLogs(task.value.id)) ?? [];
  } catch {
    apiLogs.value = [];
  } finally {
    apiLogLoading.value = false;
  }
}

// Composite modes (MODE_999 = hitVideo, MODE_1000 = hitVideoReplication)
function isCompositeMode(mode: number) {
  return mode === 999 || mode === 1000;
}

// Pipeline 步骤状态颜色映射
const pipelineStepStatusColor: Record<string, string> = {
  PENDING: '#d9d9d9',
  RUNNING: '#1890ff',
  DONE: '#52c41a',
  FAILED: '#ff4d4f',
};

// Pipeline 步骤表格列定义
const pipelineStepColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'code', width: 120 },
  { title: t('creationTask.stepKind'), dataIndex: 'kind', width: 100, align: 'center' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 100 },
  { title: t('creationTask.mode'), dataIndex: 'mode', width: 100, align: 'center' as const },
  { title: t('creationTask.handler'), dataIndex: 'handler', width: 140 },
  {
    title: t('creationTask.externalTaskId'),
    dataIndex: 'externalTaskId',
    width: 180,
    ellipsis: true,
  },
  { title: t('creationTask.resultUrl'), dataIndex: 'resultUrl', width: 200, ellipsis: true },
  { title: t('creationTask.errorMsg'), dataIndex: 'errorMsg', width: 200, ellipsis: true },
];

const reservationColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'stepCode', width: 140 },
  { title: t('creationTask.mode'), dataIndex: 'mode', width: 90, align: 'center' as const },
  {
    title: t('creationTask.reservedPoints'),
    dataIndex: 'reservedPoints',
    width: 110,
    align: 'right' as const,
  },
  {
    title: t('creationTask.confirmedPoints'),
    dataIndex: 'confirmedPoints',
    width: 110,
    align: 'right' as const,
  },
  {
    title: t('creationTask.refundedPoints'),
    dataIndex: 'refundedPoints',
    width: 110,
    align: 'right' as const,
  },
  { title: t('creationTask.status'), dataIndex: 'status', width: 110, align: 'center' as const },
];

const reservationStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  CANCELLED: 'default',
};

const costColumns = [
  { title: t('creationTask.stepCode'), dataIndex: 'stepCode', width: 160 },
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 200, ellipsis: true },
  {
    title: t('creationTask.estimatedCost'),
    dataIndex: 'pointsConsumed',
    width: 100,
    align: 'right' as const,
  },
  {
    title: t('creationTask.costSource'),
    dataIndex: 'costSource',
    width: 100,
    align: 'center' as const,
  },
  { title: t('creationTask.meterType'), dataIndex: 'meterType', width: 100 },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
];

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

const TYPE_COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'magenta'];
function getTypeColor(type: string, index?: number): string {
  if (!type) return 'default';
  if (/image|Image|photo|Photo|picture/i.test(type) || type === 'IMAGE') return 'blue';
  if (/video|Video|clip|Clip/i.test(type) || type === 'VIDEO') return 'purple';
  if (/ecommerce|Ecommerce|product|Product/i.test(type) || type === 'ECOMMERCE') return 'orange';
  return TYPE_COLORS[(index ?? 0) % TYPE_COLORS.length];
}

function isImageUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url);
}
function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv|flv)(\?.*)?$/i.test(url);
}

function getVideoMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.includes('.mp4?')) return 'video/mp4';
  if (lower.endsWith('.webm') || lower.includes('.webm?')) return 'video/webm';
  if (lower.endsWith('.mov') || lower.includes('.mov?')) return 'video/quicktime';
  return 'video/mp4';
}

const billingStatusMap: Record<string, string> = {
  HELD: t('creationTask.billingHeld'),
  CONFIRMED: t('creationTask.billingConfirmed'),
  REFUNDED: t('creationTask.billingRefunded'),
  CANCELLED: t('creationTask.billingCancelled'),
  SETTLEMENT_FAILED: t('creationTask.billingSettlementFailed'),
  PARTIALLY_REFUNDED: t('creationTask.billingPartiallyRefunded'),
};

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  PARTIALLY_REFUNDED: 'warning',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
};

const costSourceColorMap: Record<string, string> = {
  estimated: 'orange',
  billed: 'green',
  configured: 'blue',
  returned: 'cyan',
  unknown: 'default',
};

// Child task columns
const childColumns = [
  { title: t('creationTask.taskId'), dataIndex: 'taskId', width: 200, ellipsis: true },
  { title: t('creationTask.type'), dataIndex: 'type', width: 100, align: 'center' as const },
  { title: t('creationTask.status'), dataIndex: 'status', width: 100 },
  {
    title: t('creationTask.resultImage'),
    dataIndex: 'result',
    width: 110,
    align: 'center' as const,
  },
  { title: t('creationTask.modelName'), dataIndex: 'modelName', width: 120 },
  { title: t('creationTask.providerModel'), dataIndex: 'providerModel', width: 110 },
  {
    title: t('creationTask.estimatedCost'),
    dataIndex: 'estimatedCost',
    width: 100,
    align: 'right' as const,
  },
  {
    title: t('creationTask.costSource'),
    dataIndex: 'costSource',
    width: 100,
    align: 'center' as const,
  },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
];

// Format request params JSON（用户原始入参，仅入口主任务有值）
const formattedRequestParams = computed(() => {
  if (!task.value?.requestParams) return '';
  try {
    const parsed = JSON.parse(task.value.requestParams);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return task.value.requestParams;
  }
});

// Format execution params JSON（下发执行方的出口入参）
const formattedParams = computed(() => {
  if (!task.value?.params) return '';
  try {
    const parsed = JSON.parse(task.value.params);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return task.value.params;
  }
});

// Load task detail
async function loadTask() {
  const id = Number(route.params.id);
  if (!id) return;

  loading.value = true;
  try {
    task.value = await getCreationTaskDetail(id);
    // 内容审核日志（所有任务：命中/免审/未过审都可能有记录）
    try {
      moderationLogs.value = (await getCreationTaskModerationLogs(id)) ?? [];
    } catch {
      moderationLogs.value = [];
    }
    // 工作流任务：详情带了步骤就直接用，否则按需另取（取不到不影响其余信息）
    workflowSteps.value = task.value?.workflowSteps || [];
    if (
      !workflowSteps.value.length &&
      task.value?.orchestrationTopology === 'WORKFLOW' &&
      task.value.taskId
    ) {
      workflowSteps.value = await getWorkflowSteps(task.value.taskId).catch(() => []);
    }
    // 组合任务加载成本明细和 pipeline steps
    if (task.value?.mode != null && isCompositeMode(task.value.mode) && task.value.taskId) {
      try {
        costSummary.value = await getCompositeCostSummary(task.value.taskId);
      } catch {
        costSummary.value = null;
      }

      try {
        pipelineSteps.value = await getPipelineSteps(task.value.taskId);
      } catch {
        pipelineSteps.value = null;
      }
    }
  } catch (error) {
    console.error('Failed to load task detail:', error);
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.push({ name: 'CreationTaskList' });
}

function handleCancel() {
  if (!task.value) return;
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.confirmCancel'),
    onOk: async () => {
      await cancelCreationTask(task.value!.taskId);
      message.success(t('creationTask.cancelSuccess'));
      loadTask();
    },
  });
}

function handleRetry() {
  if (!task.value) return;
  Modal.confirm({
    title: t('common.warning'),
    content: t(isRefundedBilling(task.value.billingStatus) ? 'creationTask.confirmRetryCharge' : 'creationTask.confirmRetry'),
    onOk: async () => {
      await retryCreationTask(task.value!.taskId);
      message.success(t('creationTask.retrySuccess'));
      loadTask();
    },
  });
}

// Force complete
const forceCompleteVisible = ref(false);
const forceCompleteLoading = ref(false);
const forceCompleteForm = ref({ taskId: '', resultUrl: '' });

function handleForceComplete() {
  if (!task.value) return;
  forceCompleteForm.value = { taskId: task.value.taskId, resultUrl: '' };
  forceCompleteVisible.value = true;
}

async function handleForceCompleteConfirm() {
  forceCompleteLoading.value = true;
  try {
    await forceCompleteCreationTask(
      forceCompleteForm.value.taskId,
      forceCompleteForm.value.resultUrl || undefined,
    );
    message.success(t('creationTask.forceCompleteSuccess'));
    forceCompleteVisible.value = false;
    loadTask();
  } catch (error) {
    console.error('Force complete failed:', error);
  } finally {
    forceCompleteLoading.value = false;
  }
}

// Block / unblock
const blockVisible = ref(false);
const blockLoading = ref(false);
const blockForm = ref({ reason: '', permanent: false });

function handleBlock() {
  if (!task.value) return;
  blockForm.value = { reason: '', permanent: false };
  blockVisible.value = true;
}

async function handleBlockConfirm() {
  if (!task.value) return;
  blockLoading.value = true;
  try {
    await blockCreationTask(task.value.taskId, {
      permanent: blockForm.value.permanent,
      reason: blockForm.value.reason || undefined,
    });
    message.success(t('creationTask.blockSuccess'));
    blockVisible.value = false;
    loadTask();
  } catch (error) {
    console.error('Block failed:', error);
  } finally {
    blockLoading.value = false;
  }
}

function handleUnblock() {
  if (!task.value) return;
  Modal.confirm({
    title: t('common.warning'),
    content: t('creationTask.unblockConfirm'),
    onOk: async () => {
      await unblockCreationTask(task.value!.taskId);
      message.success(t('creationTask.unblockSuccess'));
      loadTask();
    },
  });
}

// Fix Content-Type for existing OSS objects (historical videos uploaded without Content-Type)
const fixingContentType = ref(false);
async function handleFixContentType() {
  if (!task.value) return;
  fixingContentType.value = true;
  try {
    await fixTaskContentType(task.value.id);
    message.success(t('creationTask.fixContentTypeSuccess'));
  } catch {
    message.error(t('creationTask.fixContentTypeFailed'));
  } finally {
    fixingContentType.value = false;
  }
}

onMounted(() => {
  loadTask();
});
</script>

<style scoped>
.detail-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px;
}
.detail-page-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-page-header__title {
  font-size: 16px;
  font-weight: 600;
}
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
  /* 多产物（65/66 一次出 N 张）时横向排布并换行；单产物时与原先居中一张的观感一致 */
  flex-wrap: wrap;
  gap: 12px;
}

.result-preview__item {
  display: flex;
  align-items: flex-start;
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
  color: var(--color-text-tertiary);
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
