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
        <a-button v-if="showReconcileRetry" type="primary" ghost @click="reconcileVisible = true">
          {{ $t('reconcile.retryAfterReview') }}
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
        <a-button
          v-if="canShowDeleteTask(task)"
          danger
          :loading="deleting"
          :disabled="deleting"
          @click="handleDelete"
        >
          {{ $t('creationTask.deleteTask') }}
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
            <TraceTag v-if="task" :tone="statusColorMap[task.status]">
              {{ statusMap[task.status] || '-' }}
            </TraceTag>
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
          <a-descriptions-item :label="$t('latency.total')">
            <b v-if="task?.totalDurationMs != null" class="total-duration">{{
              formatDuration(task.totalDurationMs)
            }}</b>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('latency.deliveredAt')">
            {{ task?.deliveredAt || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 任务全链路：Java 任务 → 网关调用 → 媒体阶段，一眼看出卡在哪。
           默认折叠不请求；展开才拉取/恢复轮询，折叠即停轮询（决策见 traceHelpers.traceToggleAction） -->
      <a-card v-if="task?.taskId" style="margin-bottom: 16px">
        <a-collapse :activeKey="traceActiveKey" ghost @change="onTraceChange">
          <a-collapse-panel key="trace" :header="$t('creationTask.trace.title')">
            <template #extra>
              <a-space v-if="traceOpen" @click.stop @keypress.stop>
                <span v-if="trace?.traceId || spans?.taskId" class="trace-meta">
                  {{ $t('creationTask.trace.traceId') }}:
                  <code>{{ trace?.traceId || spans?.taskId }}</code>
                </span>
                <span v-if="!spans && trace?.generatedAt" class="trace-meta">
                  {{ $t('creationTask.trace.generatedAt') }}: {{ trace.generatedAt }}
                </span>
                <a-tag v-if="tracePolling" color="processing">{{
                  $t('creationTask.trace.autoRefresh', { sec: Math.round(traceDelayMs / 1000) })
                }}</a-tag>
                <a-button size="small" :loading="traceLoading" @click="retryTrace">{{
                  $t('creationTask.trace.refresh')
                }}</a-button>
              </a-space>
            </template>
            <a-alert
              v-if="tracePollState === 'unavailable'"
              type="warning"
              show-icon
              style="margin-bottom: 8px"
              :message="$t('creationTask.trace.unavailable')"
            >
              <template #action>
                <a-button size="small" :loading="traceLoading" @click="retryTrace">{{
                  $t('creationTask.trace.retry')
                }}</a-button>
              </template>
            </a-alert>
            <a-alert
              v-else-if="tracePollState === 'failed'"
              type="error"
              show-icon
              style="margin-bottom: 8px"
              :message="
                $t('creationTask.trace.stoppedAfterFailures', { n: TRACE_MAX_CONSECUTIVE_FAILURES })
              "
              :description="traceError"
            >
              <template #action>
                <a-button size="small" :loading="traceLoading" @click="retryTrace">{{
                  $t('creationTask.trace.retry')
                }}</a-button>
              </template>
            </a-alert>
            <div v-else-if="traceError" class="error-text" style="margin-bottom: 8px">
              {{ $t('creationTask.trace.loadFail') }}: {{ traceError }}
            </div>
            <LatencySummaryCard
              v-if="spans?.summary"
              :summary="spans.summary"
              @focus-span="focusSpan"
            />
            <TraceWaterfall
              v-if="spans"
              ref="waterfall"
              :data="spans"
              :critical-path="spans.summary?.criticalPath || []"
              :can-open-gateway="can('ai_gateway:view')"
            />
            <template v-else-if="trace">
              <a-alert
                v-if="trace.stuckAt"
                type="warning"
                show-icon
                style="margin-bottom: 12px"
                :message="
                  $t('creationTask.trace.stuckBanner', {
                    name: stuckName,
                    source: sourceLabel(trace.stuckAt.source),
                    elapsed: formatDuration(trace.stuckAt.elapsedMs),
                    reason: trace.stuckAt.reason || '-',
                  })
                "
              />
              <a-alert
                v-else-if="traceComplete"
                type="success"
                show-icon
                style="margin-bottom: 12px"
                :message="$t('creationTask.trace.complete')"
              />
              <a-empty v-if="!traceStages.length" :description="$t('creationTask.trace.empty')" />
              <ol v-else class="trace-list">
                <li
                  v-for="(stage, i) in traceStages"
                  :key="`${stage.key}-${i}`"
                  class="trace-row"
                  :class="[
                    `trace-row--${stage.status}`,
                    { 'trace-row--stuck': i === stuckRowIndex },
                  ]"
                >
                  <span class="trace-row__icon">
                    <CheckCircleFilled v-if="stage.status === 'done'" style="color: #52c41a" />
                    <LoadingOutlined
                      v-else-if="stage.status === 'running'"
                      style="color: #1677ff"
                    />
                    <CloseCircleFilled
                      v-else-if="stage.status === 'failed'"
                      style="color: #ff4d4f"
                    />
                    <MinusCircleOutlined
                      v-else-if="stage.status === 'skipped'"
                      style="color: var(--color-text-tertiary, #bfbfbf)"
                    />
                    <ClockCircleOutlined
                      v-else
                      style="color: var(--color-text-tertiary, #bfbfbf)"
                    />
                  </span>
                  <div class="trace-row__body">
                    <div class="trace-row__head">
                      <a-tag :color="sourceColor(stage.source)">{{
                        sourceLabel(stage.source)
                      }}</a-tag>
                      <span class="trace-row__name">{{ stage.name || stage.key }}</span>
                      <code class="trace-row__key">{{ stage.key }}</code>
                      <a-tag :color="stageColor(stage.status)">{{
                        $t(`creationTask.trace.status.${stage.status}`)
                      }}</a-tag>
                      <a-tag v-if="i === stuckRowIndex" color="orange">{{
                        $t('creationTask.trace.stuckHere')
                      }}</a-tag>
                      <span class="trace-row__duration">
                        {{ stage.elapsedText }}
                        <span v-if="stage.ongoing && stage.elapsedText !== '-'">{{
                          $t('creationTask.trace.ongoing')
                        }}</span>
                      </span>
                    </div>
                    <div v-if="stage.status === 'failed' && stage.check" class="trace-row__check">
                      {{ $t('creationTask.trace.check') }}: <code>{{ stage.check }}</code>
                    </div>
                    <div v-if="stage.detail" class="trace-row__detail">{{ stage.detail }}</div>
                    <div v-if="stage.startedAt || stage.endedAt" class="trace-row__time">
                      {{ stage.startedAt || '-' }} → {{ stage.endedAt || '-' }}
                    </div>
                  </div>
                </li>
              </ol>
            </template>
            <a-skeleton v-else-if="traceLoading" active :paragraph="{ rows: 3 }" />
          </a-collapse-panel>
        </a-collapse>
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

      <!-- 画布运行：画布生图/视频等由 Go 画布发起的任务，入参里带 canvasId / runId / nodeId -->
      <a-card v-if="canvasRun" title="画布运行" style="margin-bottom: 16px">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="画布 ID">
            <code>{{ canvasRun.canvasId }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="运行 ID">
            <code>{{ canvasRun.runId || '-' }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="节点 ID">
            <code>{{ canvasRun.nodeId || '-' }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="入口码">{{ canvasRun.entryCode || '-' }}</a-descriptions-item>
          <a-descriptions-item label="模型组">{{
            canvasRun.modelGroup || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="操作" :span="2">
            <a-button size="small" type="link" @click="openCanvasRuns">
              查看该画布的运行记录（节点步骤、后端、状态、报错）
            </a-button>
          </a-descriptions-item>
        </a-descriptions>
        <div style="margin-top: 16px">
          <div class="diag-title">工作流步骤（画布节点运行）</div>
          <a-skeleton v-if="canvasRunLoading" active :paragraph="{ rows: 2 }" />
          <a-alert
            v-else-if="canvasRunMissing"
            type="info"
            show-icon
            message="未在画布运行记录中找到本任务（可能已被清理，或运行在其他画布）"
          />
          <a-descriptions v-else-if="canvasRunRow" :column="3" size="small" bordered>
            <a-descriptions-item v-for="f in canvasRunFields" :key="f.label" :label="f.label">
              {{ f.value }}
            </a-descriptions-item>
          </a-descriptions>
        </div>
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
        v-if="task?.errorMsg || failingSpan"
        :title="$t('creationTask.errorInfo')"
        style="margin-bottom: 16px"
      >
        <a-alert type="error" show-icon>
          <template #message>
            <span>{{
              task?.errorMsg ? decodeUnicode(task.errorMsg) : failureSummary(failingSpan)
            }}</span>
            <a-button type="link" size="small" style="padding: 0 4px" @click="showApiLogs">
              {{ $t('creationTask.errorDetail') }}
            </a-button>
          </template>
          <!-- 失败 span（统一链路）：哪个节点、哪类失败、命中哪条判据、现场属性 -->
          <template v-if="failingSpan" #description>
            <div class="err-span">
              <TraceTag :tone="serviceTone(failingSpan.service)">{{
                $t(`creationTask.spans.service.${normalizeService(failingSpan.service)}`)
              }}</TraceTag>
              <b>{{ failingSpan.label || failingSpan.key }}</b>
              <code class="err-span__key">{{ failingSpan.key }}</code>
            </div>
            <div v-if="failingSpan.failure?.class">
              {{ $t('creationTask.spans.failureClass') }}:
              <code>{{ failingSpan.failure.class }}</code>
            </div>
            <div v-if="failingSpan.failure?.code">
              {{ $t('creationTask.spans.failureCode') }}:
              <code>{{ failingSpan.failure.code }}</code>
            </div>
            <div v-if="failingSpan.failure?.check">
              {{ $t('creationTask.trace.check') }}: <code>{{ failingSpan.failure.check }}</code>
            </div>
            <div v-if="failingSpan.failure?.message" class="err-span__msg">
              {{ failingSpan.failure.message }}
            </div>
            <div v-if="Object.keys(failingSpan.attrs || {}).length" class="err-span__attrs">
              <a-tag v-for="(v, k) in failingSpan.attrs" :key="k">{{ k }}: {{ String(v) }}</a-tag>
            </div>
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
              <TraceTag :tone="statusColorMap[record.status]">
                {{ statusMap[record.status] || '-' }}
              </TraceTag>
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

      <!-- 诊断与时间线：默认折叠，首次展开才请求；失败仅在本卡片内提示 -->
      <a-card style="margin-bottom: 16px">
        <a-collapse :activeKey="diagActive" ghost @change="onDiagChange">
          <a-collapse-panel key="diag" :header="$t('creationTask.diagnosis.title')">
            <a-spin :spinning="diagLoading">
              <a-alert
                v-if="diagError"
                type="error"
                show-icon
                :message="$t('creationTask.diagnosis.loadFail')"
                :description="diagError"
              >
                <template #action>
                  <a-button size="small" @click="loadDiagnosis">{{
                    $t('creationTask.diagnosis.retry')
                  }}</a-button>
                </template>
              </a-alert>
              <template v-else-if="diagnosis">
                <a-descriptions :column="2" size="small" style="margin-bottom: 12px">
                  <a-descriptions-item :label="$t('creationTask.diagnosis.statusLabel')">
                    {{ diagnosis.task?.statusLabel || '-' }}
                  </a-descriptions-item>
                  <a-descriptions-item :label="$t('creationTask.diagnosis.failureCode')">
                    <code v-if="diagFailing.code">{{ diagFailing.code }}</code>
                    <span v-else>-</span>
                  </a-descriptions-item>
                  <a-descriptions-item :label="$t('creationTask.diagnosis.blockedStep')">
                    <code v-if="diagFailing.step">{{ diagFailing.step }}</code>
                    <span v-else>-</span>
                  </a-descriptions-item>
                  <a-descriptions-item :label="$t('creationTask.diagnosis.gatewayCall')">
                    <router-link
                      v-if="
                        diagFailing.gatewayCallId &&
                        can('ai_gateway:view') &&
                        !diagFailing.gatewayCallLink
                      "
                      :to="{
                        path: '/ai-gateway/calls',
                        query: { callId: diagFailing.gatewayCallId },
                      }"
                    >
                      {{ diagFailing.gatewayCallId }}
                    </router-link>
                    <a
                      v-else-if="safeLink(diagFailing.gatewayCallLink)"
                      :href="diagFailing.gatewayCallLink || ''"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ diagFailing.gatewayCallId || diagFailing.gatewayCallLink }}
                    </a>
                    <code v-else-if="diagFailing.gatewayCallId">{{
                      diagFailing.gatewayCallId
                    }}</code>
                    <span v-else>-</span>
                  </a-descriptions-item>
                </a-descriptions>

                <div v-if="!spans && diagnosis.hints?.length" class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.diagnosis.hints') }}</div>
                  <ul class="diag-hints">
                    <li v-for="(h, i) in diagnosis.hints" :key="i">
                      {{ h.text }}
                      <a-tag v-if="h.manualSection" color="blue" style="margin-left: 8px">{{
                        $t('creationTask.diagnosis.manual', { section: h.manualSection })
                      }}</a-tag>
                    </li>
                  </ul>
                </div>

                <div v-if="byStatusEntries.length" class="diag-section">
                  <div class="diag-title">
                    {{ $t('creationTask.diagnosis.stepCounts') }} ({{
                      diagnosis.steps?.total ?? 0
                    }})
                  </div>
                  <TraceTag v-for="[k, v] in byStatusEntries" :key="k" :tone="diagStatusColor(k)">
                    {{ k }}: {{ v }}
                  </TraceTag>
                </div>

                <div class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.diagnosis.billingDelivery') }}</div>
                  <a-descriptions :column="2" size="small">
                    <a-descriptions-item :label="$t('creationTask.diagnosis.billingStatus')">
                      {{ diagnosis.billing?.billingStatus || diagnosis.task?.billingStatus || '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="$t('creationTask.diagnosis.reservationStatus')">
                      {{ diagnosis.billing?.reservationStatus || '-' }}
                    </a-descriptions-item>
                    <template v-if="diagnosis.delivery">
                      <a-descriptions-item :label="$t('creationTask.diagnosis.hasResult')">
                        <a-tag :color="diagnosis.delivery.hasResult ? 'green' : 'default'">{{
                          yesNo(diagnosis.delivery.hasResult)
                        }}</a-tag>
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('creationTask.diagnosis.resultCount')">
                        {{ diagnosis.delivery.resultCount ?? '-' }}
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('creationTask.diagnosis.coverPresent')">
                        <a-tag :color="diagnosis.delivery.coverPresent ? 'green' : 'default'">{{
                          yesNo(diagnosis.delivery.coverPresent)
                        }}</a-tag>
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('creationTask.diagnosis.watermarkPresent')">
                        <a-tag :color="diagnosis.delivery.watermarkPresent ? 'green' : 'default'">{{
                          yesNo(diagnosis.delivery.watermarkPresent)
                        }}</a-tag>
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('creationTask.diagnosis.watermarkCount')">
                        {{ diagnosis.delivery.watermarkCount ?? '-' }}
                      </a-descriptions-item>
                      <a-descriptions-item :label="$t('creationTask.diagnosis.watermarkAligned')">
                        <a-tag
                          :color="diagnosis.delivery.watermarkAligned === false ? 'red' : 'default'"
                          >{{ yesNo(diagnosis.delivery.watermarkAligned) }}</a-tag
                        >
                      </a-descriptions-item>
                    </template>
                  </a-descriptions>
                </div>

                <div v-if="diagnosis.aigcPush" class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.diagnosis.aigcPush') }}</div>
                  <a-descriptions :column="2" size="small">
                    <a-descriptions-item :label="$t('creationTask.diagnosis.pushStatus')">
                      {{ diagnosis.aigcPush.statusLabel || '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="$t('creationTask.diagnosis.pushAttempts')">
                      {{ diagnosis.aigcPush.attempts ?? 0 }} /
                      {{ diagnosis.aigcPush.maxAttempts ?? '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item
                      :label="$t('creationTask.diagnosis.pushLastError')"
                      :span="2"
                    >
                      <span v-if="diagnosis.aigcPush.lastError" class="error-text">{{
                        diagnosis.aigcPush.lastError
                      }}</span>
                      <span v-else>-</span>
                    </a-descriptions-item>
                  </a-descriptions>
                </div>

                <div v-if="diagnosis.mediaOps?.length" class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.diagnosis.mediaOps') }}</div>
                  <a-table
                    :columns="mediaOpColumns"
                    :data-source="diagnosis.mediaOps"
                    :pagination="false"
                    :row-key="(_r: DiagnosisMediaOp, i?: number) => String(i)"
                    size="small"
                    :scroll="{ x: 800 }"
                  />
                </div>

                <div v-if="spans" class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.spans.spanTimeline') }}</div>
                  <a-table
                    :columns="spanTimelineColumns"
                    :data-source="spanTimeline"
                    :pagination="{ pageSize: 50, size: 'small', hideOnSinglePage: true }"
                    :row-key="(r: TaskSpan) => r.id"
                    size="small"
                    :scroll="{ x: 900 }"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.dataIndex === 'startAt'">{{
                        formatDateTime(record.startAt)
                      }}</template>
                      <template v-else-if="column.dataIndex === 'service'">
                        <TraceTag :tone="serviceTone(record.service)">{{
                          $t(`creationTask.spans.service.${normalizeService(record.service)}`)
                        }}</TraceTag>
                      </template>
                      <template v-else-if="column.dataIndex === 'label'">
                        {{ record.label || record.key }}
                        <code class="err-span__key">{{ record.key }}</code>
                      </template>
                      <template v-else-if="column.dataIndex === 'status'">
                        <TraceTag :tone="spanStatusTone(record.status)">{{
                          $t(`creationTask.spans.status.${normalizeStatus(record.status)}`)
                        }}</TraceTag>
                      </template>
                      <template v-else-if="column.dataIndex === 'durationMs'">{{
                        formatDuration(record.durationMs)
                      }}</template>
                      <template v-else-if="column.dataIndex === 'failure'">
                        <span v-if="record.failure" class="error-text">{{
                          failureSummary(record)
                        }}</span>
                        <span v-else>-</span>
                      </template>
                    </template>
                  </a-table>
                </div>
                <div v-else class="diag-section">
                  <div class="diag-title">{{ $t('creationTask.diagnosis.timeline') }}</div>
                  <a-table
                    :columns="timelineColumns"
                    :data-source="timelineRows"
                    :pagination="false"
                    :row-key="(_r: TimelineEvent, i?: number) => String(_r.id ?? i)"
                    size="small"
                    :scroll="{ x: 900 }"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.dataIndex === 'kind'">
                        <template v-if="eventKindLabel(record)">
                          <a-tag :title="record.kind">{{ eventKindLabel(record) }}</a-tag>
                          <span v-if="eventDurationMs(record) != null">{{
                            $t('creationTask.diagnosis.duration', { ms: eventDurationMs(record) })
                          }}</span>
                        </template>
                        <span v-else>{{ record.kind }}</span>
                      </template>
                      <template v-if="column.dataIndex === 'status'">
                        <TraceTag
                          v-if="record.status"
                          :tone="diagStatusColor(record.status)"
                          :title="record.status"
                          >{{ eventStatusLabel(record.status) }}</TraceTag
                        >
                        <span v-else>-</span>
                      </template>
                    </template>
                  </a-table>
                  <div v-if="timelineNextAfterId" style="margin-top: 8px; text-align: center">
                    <a-button :loading="timelineMoreLoading" @click="loadMoreTimeline">{{
                      $t('creationTask.diagnosis.loadMore')
                    }}</a-button>
                  </div>
                  <div v-if="timelineMoreError" class="error-text" style="margin-top: 8px">
                    {{ timelineMoreError }}
                  </div>
                </div>
              </template>
            </a-spin>
          </a-collapse-panel>
        </a-collapse>
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
    <ReconcileRetryModal
      v-if="task"
      v-model:open="reconcileVisible"
      :task-id="task.taskId"
      @success="onReconcileRetried"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  CreationTask,
  CompositeCostSummary,
  ApiRequestLog,
  PipelineStepsResponse,
  WorkflowStep,
  Diagnosis,
  DiagnosisMediaOp,
  TimelineEvent,
  TaskTrace,
  TaskSpan,
  TaskSpans,
} from '@/api/creation-task';
import type { ModerationLog } from '@/api/moderation-log';

import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  LoadingOutlined,
  MinusCircleOutlined,
} from '@antdv-next/icons';
import { message, Modal } from 'antdv-next';
import { ref, computed, onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';

import { listRuns, type CanvasRun } from '@/api/canvas-admin';
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
  getTaskDiagnosis,
  getTaskTimeline,
  getTaskTrace,
  getTaskSpans,
  fixTaskContentType,
  deleteCreationTask,
  canShowDeleteTask,
  deleteRejectionOf,
} from '@/api/creation-task';
import { getCreationTaskModerationLogs } from '@/api/moderation-log';
import ReconcileRetryModal from '@/components/Billing/ReconcileRetryModal.vue';
import LatencySummaryCard from '@/components/LatencySummary/index.vue';
import {
  failureSummary,
  normalizeService,
  normalizeStatus,
  pickFailingSpan,
  serviceTone,
  shouldStopSpansPolling,
  sortSpansByTime,
  spansFingerprint,
  statusTone as spanStatusTone,
} from '@/components/TraceWaterfall/helpers';
import TraceTag from '@/components/TraceTag/index.vue';
import TraceWaterfall from '@/components/TraceWaterfall/index.vue';
import { usePermission } from '@/composables/usePermission';
import { decodeUnicode, formatDateTime } from '@/utils/helpers';

import {
  formatDuration,
  isChainComplete,
  isTraceEndpointMissing,
  nextPollDelayMs,
  nextUnchangedPolls,
  normalizeSource,
  normalizeStageStatus,
  pickStuckRow,
  shouldStopPolling,
  sourceColor,
  stageColor,
  stageElapsed,
  TRACE_MAX_CONSECUTIVE_FAILURES,
  TRACE_POLL_BASE_MS,
  traceFingerprint,
  traceToggleAction,
} from './trace-helpers';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const task = ref<CreationTask | null>(null);
const costSummary = ref<CompositeCostSummary | null>(null);
const pipelineSteps = ref<PipelineStepsResponse | null>(null);
const workflowSteps = ref<WorkflowStep[]>([]);

// ---- 诊断与时间线（折叠卡片，首次展开才请求） ----
const diagActive = ref<string[]>([]);
const diagLoading = ref(false);
const diagError = ref('');
const diagnosis = ref<Diagnosis | null>(null);
const timelineRows = ref<TimelineEvent[]>([]);
const timelineNextAfterId = ref<number | string | null>(null);
const timelineMoreLoading = ref(false);
const timelineMoreError = ref('');
let diagLoaded = false;
/** 每次换任务 / 重新加载诊断 +1；过期会话（旧任务）的响应直接丢弃 */
let diagSession = 0;
const TIMELINE_PAGE_SIZE = 50;

/**
 * antdv-next 的 Collapse 只 emit('change', keys)（不 emit update:activeKey，v-model 不回写），
 * keys 为 string[]（@v-c/collapse 经 getActiveKeysArray 归一，accordion 也是 [] / [key]）；
 * 这里再兜底一次，并拷贝出普通数组，避免把组件内部的响应式数组存进来。
 */
function normalizeCollapseKeys(keys: unknown): string[] {
  if (Array.isArray(keys)) return keys.map((k) => String(k));
  return typeof keys === 'string' || typeof keys === 'number' ? [String(keys)] : [];
}

// ---- 任务全链路（Java → 网关 → 媒体）----
// 轮询状态机（决策函数见 traceHelpers，均为纯函数）：
//   idle        未轮询（尚无任务，或打开页面时任务已终态：只拉一次）
//   polling     自动轮询：上一次响应落定后才 setTimeout 排下一次（绝不并发），
//               默认 5s，链路连续 3 次无变化放慢到 15s，有变化回到 5s；
//               页面隐藏 / KeepAlive 切走时只撤定时器，回到可见/激活时立即补拉一次
//   settled     trace 显示链路已静止（无卡点、无 running/pending）→ 停
//   failed      连续 3 次请求失败 → 停，显示错误与「重试」
//   unavailable 接口返回 404（后端未上线 trace 接口）→ 立即停，提示「trace 接口未就绪」
// 「刷新/重试」按钮：清零失败与退避计数，回到 polling 立刻拉一次（由响应决定是否继续）。
type TracePollState = 'idle' | 'polling' | 'settled' | 'failed' | 'unavailable';
const trace = ref<TaskTrace | null>(null);
/** 统一链路（spans）：有值时是 任务链路 / 错误信息 / 诊断 / 时间线 的唯一数据源；旧后端 404 时为 null，回退旧 trace */
const spans = ref<TaskSpans | null>(null);
const waterfall = ref<InstanceType<typeof TraceWaterfall> | null>(null);
function focusSpan(id: string) {
  void waterfall.value?.focus(id);
}
/** /spans 接口 404（旧后端）后本页不再请求，直到用户点「刷新/重试」 */
let spansMissing = false;
const traceLoading = ref(false);
const traceError = ref('');
const tracePollState = ref<TracePollState>('idle');
const tracePolling = computed(() => tracePollState.value === 'polling');
const traceDelayMs = ref(TRACE_POLL_BASE_MS);
let traceTimer: ReturnType<typeof setTimeout> | null = null;
/** 每次切换任务/重新开始 +1；过期会话的响应直接丢弃 */
let traceSession = 0;
/** 在途请求所属会话；与当前会话相同时不再发新请求 */
let traceInFlight: number | null = null;
let traceFailures = 0;
let traceUnchanged = 0;
let traceLastFingerprint = '';
/** 组件处于激活态（未被 KeepAlive 切走、未卸载） */
let traceActive = true;
/** 链路卡片折叠面板：任务链路是主视图，默认展开；用户折叠后不请求、不轮询 */
const traceActiveKey = ref<string[]>(['trace']);
const traceOpen = computed(() => traceActiveKey.value.includes('trace'));
/** 从调用检索（?trace=1）进入时自动展开一次；记下任务号，之后用户收起不会被再次展开 */
let autoExpandTraceFor: number | null = null;
/** 当前任务是否已在展开时拉过一次 trace（换任务 / 重新加载任务时清零） */
let traceStarted = false;

const traceStages = computed(() =>
  (trace.value?.stages || [])
    .filter((s) => !!s)
    .map((s) => {
      const { ms, ongoing } = stageElapsed(s, trace.value?.generatedAt);
      return {
        ...s,
        status: normalizeStageStatus(s.status),
        source: normalizeSource(s.source),
        elapsedText: formatDuration(ms),
        ongoing,
      };
    }),
);
const stuckRowIndex = computed(() => pickStuckRow(trace.value));
/** 失败 span / 时间线都从同一份 spans 派生，三处不再各有数据源 */
const failingSpan = computed(() => pickFailingSpan(spans.value));
const spanTimeline = computed(() => sortSpansByTime(spans.value?.spans));
const spanTimelineColumns = [
  { title: t('creationTask.spans.startAt'), dataIndex: 'startAt', width: 170 },
  { title: t('creationTask.diagnosis.source'), dataIndex: 'service', width: 100 },
  { title: t('creationTask.spans.node'), dataIndex: 'label', width: 280 },
  { title: t('creationTask.diagnosis.status'), dataIndex: 'status', width: 100 },
  { title: t('creationTask.spans.duration'), dataIndex: 'durationMs', width: 100 },
  { title: t('creationTask.spans.failure'), dataIndex: 'failure' },
];
/** 诊断卡片「失败码 / 卡点步骤 / 网关调用」：有 spans 取失败 span，否则回退 diagnosis.failingStep */
const diagFailing = computed(() => {
  const sp = failingSpan.value;
  if (sp) {
    const ext = sp.external;
    return {
      code: sp.failure?.code || null,
      step: sp.key,
      gatewayCallId: ext?.ref && /gateway|call/i.test(ext.type) ? ext.ref : null,
      gatewayCallLink: null as string | null,
    };
  }
  const f = diagnosis.value?.failingStep;
  return {
    code: f?.failureCode ?? null,
    step: f?.stepPath ?? null,
    gatewayCallId: f?.gatewayCallId ?? null,
    gatewayCallLink: f?.gatewayCallLink ?? null,
  };
});
const traceComplete = computed(() => isChainComplete(trace.value));
const stuckName = computed(() => {
  const stuck = trace.value?.stuckAt;
  if (!stuck) return '';
  const row = traceStages.value[stuckRowIndex.value];
  return row?.name || stuck.stage || '-';
});

function sourceLabel(source: unknown) {
  return t(`creationTask.trace.source.${normalizeSource(source)}`);
}

/** 任务终态（完成/失败/取消）；仅用于打开页面时决定是否开启自动轮询 */
function isTaskTerminal() {
  const st = task.value?.status;
  return st !== 0 && st !== 1;
}

function pageVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function clearTraceTimer() {
  if (traceTimer) clearTimeout(traceTimer);
  traceTimer = null;
}

/** 仅在轮询态、卡片展开、组件激活且页面可见时排下一次 */
function scheduleTrace(delayMs: number) {
  clearTraceTimer();
  if (tracePollState.value !== 'polling' || !traceOpen.value || !traceActive || !pageVisible())
    return;
  traceDelayMs.value = delayMs;
  traceTimer = setTimeout(() => {
    traceTimer = null;
    void loadTrace();
  }, delayMs);
}

async function loadTrace() {
  const taskId = task.value?.taskId;
  if (!taskId) return;
  const session = traceSession;
  if (traceInFlight === session) return; // 在途请求未落定，不叠加
  traceInFlight = session;
  clearTraceTimer();
  traceLoading.value = true;
  let changed = false;
  let usedSpans = false;
  try {
    // 优先统一链路 /spans；旧后端 404 → 本页回退到旧 /trace
    if (!spansMissing) {
      try {
        const sp = (await getTaskSpans(taskId)) || null;
        if (session !== traceSession) return;
        if (sp && Array.isArray(sp.spans)) {
          const fp = spansFingerprint(sp);
          changed = fp !== traceLastFingerprint;
          traceLastFingerprint = fp;
          spans.value = sp;
          trace.value = null;
          usedSpans = true;
        } else {
          spansMissing = true;
        }
      } catch (e) {
        if (session !== traceSession) return;
        if (!isTraceEndpointMissing(e)) throw e;
        spansMissing = true;
        spans.value = null;
      }
    }
    if (!usedSpans) {
      const data = (await getTaskTrace(taskId)) || null;
      if (session !== traceSession) return;
      const fp = traceFingerprint(data);
      changed = fp !== traceLastFingerprint;
      traceLastFingerprint = fp;
      trace.value = data;
    }
    traceError.value = '';
    traceFailures = 0;
    traceUnchanged = nextUnchangedPolls(traceUnchanged, changed);
  } catch (e) {
    if (session !== traceSession) return;
    if (isTraceEndpointMissing(e)) {
      traceError.value = t('creationTask.trace.unavailable');
      tracePollState.value = 'unavailable';
      return;
    }
    traceFailures++;
    traceError.value = (e as Error)?.message || String(e);
  } finally {
    if (traceInFlight === session) traceInFlight = null;
    if (session === traceSession) traceLoading.value = false;
  }
  if (tracePollState.value !== 'polling') return;
  const stop = usedSpans
    ? shouldStopSpansPolling(spans.value, traceFailures, TRACE_MAX_CONSECUTIVE_FAILURES)
    : shouldStopPolling(trace.value, traceFailures);
  if (stop) {
    tracePollState.value = stop === 'failures' ? 'failed' : 'settled';
    clearTraceTimer();
    return;
  }
  scheduleTrace(nextPollDelayMs(traceUnchanged, changed, traceFailures));
}

function resetTracePacing() {
  traceFailures = 0;
  traceUnchanged = 0;
  traceDelayMs.value = TRACE_POLL_BASE_MS;
}

function stopTracePolling() {
  clearTraceTimer();
}

/** 刷新 / 重试：清零计数，回到轮询态并立即拉一次 */
function retryTrace() {
  if (!task.value?.taskId) return;
  resetTracePacing();
  spansMissing = false;
  tracePollState.value = 'polling';
  void loadTrace();
}

function startTrace() {
  clearTraceTimer();
  traceSession++;
  traceInFlight = null;
  trace.value = null;
  spans.value = null;
  traceError.value = '';
  traceLastFingerprint = '';
  resetTracePacing();
  tracePollState.value = 'idle';
  if (!task.value?.taskId) return;
  // 打开时任务已终态：只拉一次；否则进入轮询，由 trace 响应决定何时停
  if (!isTaskTerminal()) tracePollState.value = 'polling';
  void loadTrace();
}

/** 轮询态下恢复：没有在途请求也没有排队定时器时立即补拉一次 */
function resumeTrace() {
  if (tracePollState.value !== 'polling' || !traceOpen.value || !traceActive || !pageVisible())
    return;
  if (traceInFlight === traceSession || traceTimer) return;
  void loadTrace();
}

/** 链路卡片头部点击：受控回写 activeKey（唯一来源），再按新状态启停 */
function onTraceChange(keys: unknown) {
  traceActiveKey.value = normalizeCollapseKeys(keys);
  onTraceToggle();
}

/** 链路卡片展开/折叠：每次展开都发一次请求（轮询中则立即补拉，否则重新开始），折叠即撤定时器 */
function onTraceToggle() {
  switch (traceToggleAction(traceOpen.value, traceStarted, tracePollState.value)) {
    case 'start':
      traceStarted = true;
      // 同一会话的请求还在途（收起又展开）：不再叠加，等它落定即可
      if (traceInFlight === traceSession) break;
      startTrace();
      break;
    case 'resume':
      resumeTrace();
      break;
    case 'pause':
      clearTraceTimer();
      break;
  }
}

/** 加载（或重新加载）任务时调用：卡片展开则立即重拉，折叠则只清空旧任务的链路，待展开再拉 */
function resetTraceForTask() {
  traceStarted = false;
  if (traceOpen.value) {
    // 重新加载的是新的任务状态：旧会话的在途响应作废，否则下面的在途守卫会把这次拉取跳过
    traceSession++;
    traceInFlight = null;
    onTraceToggle();
    return;
  }
  clearTraceTimer();
  traceSession++; // 旧任务的在途响应作废
  traceInFlight = null;
  trace.value = null;
  spans.value = null;
  traceError.value = '';
  traceLoading.value = false;
  traceLastFingerprint = '';
  resetTracePacing();
  tracePollState.value = 'idle';
}

function onTraceVisibilityChange() {
  if (pageVisible()) resumeTrace();
  else clearTraceTimer();
}

onMounted(() => document.addEventListener('visibilitychange', onTraceVisibilityChange));
onBeforeUnmount(() => {
  traceActive = false;
  traceSession++; // 卸载后在途响应作废
  stopTracePolling();
  document.removeEventListener('visibilitychange', onTraceVisibilityChange);
});
// 多标签 KeepAlive：切走时撤定时器，切回且仍在轮询态时立即补拉
onDeactivated(() => {
  traceActive = false;
  stopTracePolling();
});
onActivated(() => {
  traceActive = true;
  resumeTrace();
});

// ---- 核对后重试：存在 UNKNOWN 步骤且有 reconciliation:handle 权限才显示 ----
const { can } = usePermission();
const reconcileVisible = ref(false);
// 诊断卡片默认折叠不请求；打开页面不再静默预取诊断，UNKNOWN 步骤判断只用诊断卡片展开时拉到的那份，
// 所以「核对后重试」在展开「诊断与时间线」后才可能出现（权限判断不变）。
const hasUnknownStep = computed(() => {
  const d = diagnosis.value;
  return d?.failingStep?.status === 'UNKNOWN' || (d?.steps?.byStatus?.UNKNOWN ?? 0) > 0;
});
const showReconcileRetry = computed(
  () => !!task.value && can('reconciliation:handle') && hasUnknownStep.value,
);

async function onReconcileRetried() {
  diagLoaded = false;
  diagnosis.value = null;
  await loadTask();
  // 诊断卡片仍展开时重拉一份，保持展开即有内容（折叠时等下次展开再拉）
  onDiagToggle();
}

const byStatusEntries = computed(() => Object.entries(diagnosis.value?.steps?.byStatus || {}));

const mediaOpColumns = [
  { title: t('creationTask.diagnosis.opName'), dataIndex: 'op', width: 160 },
  { title: t('creationTask.diagnosis.status'), dataIndex: 'status', width: 110 },
  { title: t('creationTask.diagnosis.failureClass'), dataIndex: 'failureClass', width: 140 },
  { title: t('creationTask.diagnosis.failureCode'), dataIndex: 'failureCode', width: 160 },
  { title: t('creationTask.diagnosis.attempts'), dataIndex: 'attempts', width: 80 },
  { title: t('creationTask.diagnosis.createTime'), dataIndex: 'createTime', width: 170 },
];

const timelineColumns = [
  { title: t('creationTask.diagnosis.ts'), dataIndex: 'ts', width: 170 },
  { title: t('creationTask.diagnosis.source'), dataIndex: 'source', width: 110 },
  { title: t('creationTask.diagnosis.kind'), dataIndex: 'kind', width: 140 },
  { title: t('creationTask.diagnosis.stepPath'), dataIndex: 'stepPath', width: 200 },
  { title: t('creationTask.diagnosis.status'), dataIndex: 'status', width: 110 },
  { title: t('creationTask.diagnosis.failureCode'), dataIndex: 'failureCode', width: 160 },
  { title: t('creationTask.diagnosis.attempt'), dataIndex: 'attempt', width: 80 },
];

function yesNo(v?: boolean | null) {
  if (v == null) return '-';
  return v ? t('creationTask.diagnosis.yes') : t('creationTask.diagnosis.no');
}

// 用 antdv Tag 预设色，随主题自适应
function diagStatusColor(status: string) {
  const s = String(status || '').toUpperCase();
  if (['SUCCEEDED', 'DONE', 'SUCCESS', 'COMPLETED'].includes(s)) return 'green';
  if (['FAILED', 'ERROR'].includes(s)) return 'red';
  if (['RUNNING', 'PROCESSING'].includes(s)) return 'blue';
  if (['WAITING', 'PENDING', 'UNKNOWN'].includes(s)) return 'orange';
  return 'default';
}

// 时间线事件的显示名：只认新增的这几类，其余 kind 原样显示。
// 后端口径：late_success_delivery 的 status = acked / not_deliverable；cancel_restore_failed 是 settlement 的 status
const EVENT_KIND_LABELED = new Set([
  'late_success_delivery',
  'late_success_not_deliverable',
  'cancel_restore_failed',
  'acked',
  'deliver_ingest',
  'settle_publish',
  'settle_tx',
]);
const EVENT_TIMING_KINDS = new Set(['deliver_ingest', 'settle_publish', 'settle_tx']);

function eventKindKey(ev: TimelineEvent): string | undefined {
  const kind = ev.kind || '';
  if (ev.status === 'cancel_restore_failed') return 'cancel_restore_failed';
  if (kind === 'late_success_delivery' && ev.status === 'not_deliverable') {
    return 'late_success_not_deliverable';
  }
  return EVENT_KIND_LABELED.has(kind) ? kind : undefined;
}

function eventKindLabel(ev: TimelineEvent) {
  const key = eventKindKey(ev);
  return key ? t(`creationTask.diagnosis.eventKind.${key}`) : '';
}

// 状态只给 acked 换显示名，其余原样
function eventStatusLabel(status: string) {
  return status === 'acked' ? t('creationTask.diagnosis.eventKind.acked') : status;
}

// 计时事件 message = durationMs=<毫秒>；读不出不编造
function eventDurationMs(ev: TimelineEvent): number | undefined {
  if (!EVENT_TIMING_KINDS.has(ev.kind || '')) return undefined;
  const m = /^durationMs=(\d{1,15})$/.exec((ev.message || '').trim());
  return m ? Number(m[1]) : undefined;
}

// 仅放行 http(s) 与站内相对路径，避免后端异常值变成 javascript: 链接
function safeLink(link?: string | null) {
  return !!link && /^(https?:\/\/|\/(?!\/))/i.test(link);
}

function diagErrMsg(e: unknown) {
  return (e as { message?: string })?.message || String(e);
}

/** 响应仍属于当前会话且任务未切换时才落地 */
function diagCurrent(session: number, id: string) {
  return session === diagSession && task.value?.taskId === id;
}

async function loadDiagnosis() {
  const id = task.value?.taskId;
  if (!id) return;
  const session = ++diagSession; // 最新一次加载为准，之前在途的响应作废
  diagLoading.value = true;
  diagError.value = '';
  timelineMoreError.value = '';
  try {
    const d = await getTaskDiagnosis(id);
    if (!diagCurrent(session, id)) return;
    diagnosis.value = d || null;
    timelineRows.value = (d?.timeline || []).map((e, i) => ({ ...e, id: `diag-${i}` }));
    diagLoaded = true;
    // 统一链路已提供时间线（spans），不再拉旧事件流
    if (spans.value) return;
    // 诊断里的 timeline 是最近 30 条；游标分页从头取完整事件流，替换之
    const tl = await getTaskTimeline(id, { limit: TIMELINE_PAGE_SIZE });
    if (!diagCurrent(session, id)) return;
    timelineRows.value = tl?.events || [];
    timelineNextAfterId.value = tl?.nextAfterId ?? null;
  } catch (e) {
    if (!diagCurrent(session, id)) return;
    if (!diagnosis.value) diagError.value = diagErrMsg(e);
    else timelineMoreError.value = diagErrMsg(e);
  } finally {
    if (session === diagSession) diagLoading.value = false;
  }
}

async function loadMoreTimeline() {
  const id = task.value?.taskId;
  if (!id || timelineNextAfterId.value == null) return;
  const session = diagSession;
  timelineMoreLoading.value = true;
  timelineMoreError.value = '';
  try {
    const tl = await getTaskTimeline(id, {
      afterId: timelineNextAfterId.value,
      limit: TIMELINE_PAGE_SIZE,
    });
    if (!diagCurrent(session, id)) return;
    timelineRows.value = [...timelineRows.value, ...(tl?.events || [])];
    timelineNextAfterId.value = tl?.nextAfterId ?? null;
  } catch (e) {
    if (!diagCurrent(session, id)) return;
    timelineMoreError.value = diagErrMsg(e);
  } finally {
    if (session === diagSession) timelineMoreLoading.value = false;
  }
}

function onDiagToggle() {
  if (diagActive.value.length && !diagLoaded && !diagLoading.value) loadDiagnosis();
}

/** 诊断卡片头部点击：受控回写 activeKey（唯一来源），展开且未加载才请求 */
function onDiagChange(keys: unknown) {
  diagActive.value = normalizeCollapseKeys(keys);
  onDiagToggle();
}

/** 加载（或重新加载）任务时调用：清掉上一个任务的诊断，旧会话在途响应作废；卡片展开则立即为新任务重拉 */
function resetDiagnosisForTask() {
  diagSession++;
  diagLoaded = false;
  diagnosis.value = null;
  diagError.value = '';
  diagLoading.value = false;
  timelineRows.value = [];
  timelineNextAfterId.value = null;
  timelineMoreLoading.value = false;
  timelineMoreError.value = '';
  onDiagToggle();
}

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

// 画布运行信息：从入参解析（画布任务的 requestParams 带 canvasId / runId / nodeId）
const canvasRun = computed(() => {
  if (!task.value?.requestParams) return null;
  try {
    const p = JSON.parse(task.value.requestParams) as Record<string, unknown>;
    const canvasId = typeof p.canvasId === 'string' ? p.canvasId : '';
    if (!canvasId) return null;
    const str = (v: unknown) => (typeof v === 'string' && v ? v : '');
    return {
      canvasId,
      runId: str(p.runId),
      nodeId: str(p.nodeId),
      entryCode: str(p.entryCode),
      modelGroup: str(p.modelGroup),
    };
  } catch {
    return null;
  }
});
// 画布运行的步骤：Go 画布管理端按画布过滤运行记录，再按 task_id / run_id 匹配到本任务
const canvasRunRow = ref<CanvasRun | null>(null);
const canvasRunLoading = ref(false);
const canvasRunMissing = ref(false);
async function loadCanvasRunRow() {
  canvasRunRow.value = null;
  canvasRunMissing.value = false;
  const cr = canvasRun.value;
  const taskId = task.value?.taskId;
  if (!cr || !taskId) return;
  canvasRunLoading.value = true;
  try {
    const page = await listRuns({ canvasId: cr.canvasId, page: 1, pageSize: 200 });
    const row = (page?.list || []).find(
      (r) => r.taskId === taskId || (!!cr.runId && r.runId === cr.runId),
    );
    canvasRunRow.value = row || null;
    canvasRunMissing.value = !row;
  } catch {
    canvasRunMissing.value = true;
  } finally {
    canvasRunLoading.value = false;
  }
}
const canvasRunFields = computed(() => {
  const r = canvasRunRow.value;
  if (!r) return [];
  const fmt = (ms: number) => (ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-');
  return [
    { label: '状态', value: r.status || '-' },
    { label: '后端', value: r.backend || '-' },
    { label: '后端引用', value: r.backendRef || '-' },
    { label: '第几次', value: String(r.attempt ?? '-') },
    { label: '模型', value: r.model || r.modelGroup || '-' },
    { label: '计费状态', value: r.billingStatus || '-' },
    { label: '成本(元)', value: r.costCny || '-' },
    { label: '进度', value: `${r.progress ?? 0}%` },
    { label: '开始', value: fmt(r.startedAt) },
    { label: '结束', value: fmt(r.finishedAt) },
    { label: '错误码', value: r.errorCode || '-' },
    { label: '错误', value: r.error || '-' },
  ];
});
function openCanvasRuns() {
  if (!canvasRun.value) return;
  router.push({ path: '/canvas/runs', query: { canvas_id: canvasRun.value.canvasId } });
}

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
    // 从调用检索跳转（trace=1）：直接展开链路卡片（只自动展开一次，之后由用户自己收起）
    if (route.query.trace === '1' && autoExpandTraceFor !== id) {
      autoExpandTraceFor = id;
      traceActiveKey.value = ['trace'];
    }
    // 诊断 / 链路均为折叠卡片，打开页面不请求，展开才拉取
    resetTraceForTask();
    resetDiagnosisForTask();
    void loadCanvasRunRow();
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
    content: t(
      isRefundedBilling(task.value.billingStatus)
        ? 'creationTask.confirmRetryCharge'
        : 'creationTask.confirmRetry',
    ),
    onOk: async () => {
      await retryCreationTask(task.value!.taskId);
      message.success(t('creationTask.retrySuccess'));
      loadTask();
    },
  });
}

// Delete（仅终态且非子任务；删除任务及其子任务、分组成员与 creaft v1 历史，素材库与媒体不动；后端记审计）
const deleting = ref(false);

function handleDelete() {
  if (!task.value || deleting.value) return;
  const taskId = task.value.taskId;
  Modal.confirm({
    title: t('creationTask.deleteConfirmTitle'),
    content: t('creationTask.deleteConfirmContent'),
    okText: t('creationTask.deleteTask'),
    okButtonProps: { danger: true },
    onOk: async () => {
      deleting.value = true;
      try {
        await deleteCreationTask(taskId);
        message.success(t('creationTask.deleteSuccess'));
        handleBack();
      } catch (error) {
        const msg = (error as Error)?.message || t('creationTask.deleteFailed');
        const rejection = deleteRejectionOf(error);
        if (rejection === 'not_found') {
          // 已被删除：回列表（列表激活时会重查），不再提示过期的错误
          message.info(t('creationTask.deleteSuccess'));
          handleBack();
          return;
        }
        // 其余拒绝原样提示后端消息，后端已写明原因
        message.error(msg);
        if (rejection === 'state_changed') loadTask();
      } finally {
        deleting.value = false;
      }
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
.total-duration {
  color: var(--color-primary, #1677ff);
  font-size: 16px;
}
.trace-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.trace-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.trace-row {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
}
.trace-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 17px;
  top: 30px;
  bottom: -8px;
  border-left: 1px dashed var(--color-border, #d9d9d9);
}
.trace-row--stuck {
  background: rgba(250, 173, 20, 0.12);
  border-color: #faad14;
}
.trace-row--failed {
  background: rgba(255, 77, 79, 0.06);
}
.trace-row__icon {
  flex: none;
  width: 16px;
  line-height: 22px;
}
.trace-row__body {
  flex: 1;
  min-width: 0;
}
.trace-row__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.trace-row__head :deep(.ant-tag) {
  margin-inline-end: 0;
}
.trace-row__name {
  font-weight: 600;
}
.trace-row__key {
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 12px;
}
.trace-row__duration {
  margin-left: auto;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.trace-row__check {
  margin-top: 4px;
  color: #ff4d4f;
}
.trace-row__detail {
  margin-top: 4px;
  color: var(--color-text-secondary);
  word-break: break-word;
}
.trace-row__time {
  margin-top: 2px;
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 12px;
}
.err-span {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.err-span__key {
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 12px;
}
.err-span__msg {
  word-break: break-all;
  white-space: pre-wrap;
}
.err-span__attrs {
  margin-top: 6px;
}
.diag-section {
  margin-top: 12px;
}
.diag-title {
  margin-bottom: 8px;
  font-weight: 600;
}
.diag-hints {
  margin: 0;
  padding-left: 20px;
}
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
