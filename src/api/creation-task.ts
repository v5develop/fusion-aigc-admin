import type { PageResult } from '@/types/api';
import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

// Task status enum
export enum TaskStatus {
  QUEUING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  FAILED = 3,
  CANCELLED = 4,
}

// Task type enum — 数据库存储小驼峰格式（如 productSetImages、hitVideo），列表筛选仍可用大类
export type TaskType = string;

// Creation Task record
export interface CreationTask {
  id: number;
  taskId: string;
  userId: number;
  username?: string;
  type: TaskType;
  typeName?: string;
  mode: number;
  /** 用户原始入参：用户端完整原始请求体快照（仅入口主任务有值，子任务/派生任务为 null）*/
  requestParams?: string;
  /** 出口/执行入参：下发执行方（AIGC/第三方 API）的入参快照 */
  params?: string;
  /** 执行方任务 ID：执行方返回的任务标识（本地 task_id / 豆包 arkId / wavespeed requestId / comet taskId）*/
  executionTaskId?: string;
  /** 编排拓扑：PIPELINE / FAN_OUT / WORKFLOW …；WORKFLOW 由 Java 工作流驱动 */
  orchestrationTopology?: string | null;
  /** 工作流步骤（仅 WORKFLOW 任务；详情接口可直接带上，缺省时按需另取） */
  workflowSteps?: WorkflowStep[] | null;
  status: TaskStatus;
  /** 屏蔽状态：0未屏蔽 1屏蔽(可取消) 2永久屏蔽(不可逆) */
  blockStatus?: number;
  blockReason?: string;
  blockTime?: string;
  statusText?: string;
  resultUrl?: string;
  /**
   * 全部产物 URL。一次调用出 N 张的 task_type（批量 44/57/58/59/60、原生多图 65/66）
   * 把 N 张全落在同一个任务行上，此时 resultUrl 只是其中首张。
   * 只渲染 resultUrl 会让运营在排查「用户说少给图」时看到 1 张而误判为「本来就只出了一张」。
   * 单产物任务该字段为空数组/缺省，回退 resultUrl。
   */
  resultUrls?: string[];
  errorMsg?: string;
  category?: string;
  ownerType?: number;
  ownerId?: number;
  parentTaskId?: string;
  /** 是否有子任务（列表可展开标记） */
  hasChildren?: boolean;
  /** 子任务数量（父任务聚合） */
  childCount?: number;
  /** 子任务合计消耗点数（父任务聚合，已退款/已取消/已过期不计） */
  totalPricePoints?: number;
  /** 子任务聚合计费状态（父任务聚合折叠值） */
  aggregatedBillingStatus?: string;
  /** 是否可重试（后端权威：失败+未屏蔽+非子任务+可续跑的编排管线父任务）。据此显隐重试按钮 */
  canRetry?: boolean;
  /** 是否可强制完成（未交付且未屏蔽的父任务）。据此显隐强制完成按钮 */
  canForceComplete?: boolean;
  /** 是否可强制失败（失败/部分成功且未屏蔽未锁）。置终态封禁重试。据此显隐强制失败按钮 */
  canForceFail?: boolean;
  /** 是否可取消（排队/处理中且未屏蔽的父任务）。据此显隐取消按钮 */
  canCancel?: boolean;
  /** 后台重试次数（达 app.creation.retry.max-attempts 上限后 canRetry=false） */
  retryCount?: number;
  featureCode?: string;
  modelId?: number;
  modelName?: string;
  reservationNo?: string;
  billingStatus?: string;
  pricePoints?: number;
  language?: string;
  watermark?: string;
  createTime: string;
  updateTime: string;
  children?: CreationTask[];
  /** 子任务列表：详情接口 GET /{id} 返回的子任务挂在 subTasks（非 children） */
  subTasks?: CreationTask[];
  // ---- 子任务成本字段（组合任务子任务列表）----
  costSource?: string;
  estimatedCost?: number;
  meterType?: string;
  meterValue?: number;
  providerModel?: string;
  reservationLines?: ReservationLine[];
}

export interface ReservationLine {
  lineNo: number;
  componentCode: string;
  stepCode: string;
  mode: number;
  reservedPoints: number;
  confirmedPoints: number;
  refundedPoints: number;
  status: string;
  outputRef: string;
}

// Task list query params
export interface CreationTaskQuery {
  type?: string;
  status?: number | string;
  userId?: number | string;
  modelId?: number | string;
  featureCode?: string;
  billingStatus?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

// Dashboard stats
export interface CreationDashboardStats {
  todayTasks: number;
  todayCompleted: number;
  todayFailed: number;
  successRate: number;
  queuing: number;
  processing: number;
}

// Dashboard trend
export interface CreationDashboardTrend {
  labels: string[];
  taskCounts: number[];
  successCounts: number[];
  failedCounts: number[];
}

// Dashboard distribution
export interface CreationDashboardDistribution {
  statusDistribution: { name: string; value: number }[];
  typeDistribution: { name: string; value: number }[];
}

// Dashboard ranking
export interface CreationDashboardRanking {
  modelRanking: { name: string; value: number }[];
  userRanking: { name: string; value: number }[];
}

// Dashboard heatmap
export interface CreationDashboardHeatmap {
  hours: number[];
  days: string[];
  values: number[][];
}

// Dashboard duration stats
export interface CreationDashboardDuration {
  types: string[];
  p50: number[];
  p90: number[];
  p99: number[];
}

// Dashboard error stats
export interface CreationDashboardErrors {
  errors: { errorMsg: string; count: number; percentage: number }[];
}

// Combined dashboard data
export interface CreationDashboardData {
  stats: CreationDashboardStats;
  trend?: CreationDashboardTrend;
  distribution?: CreationDashboardDistribution;
  ranking?: CreationDashboardRanking;
  heatmap?: CreationDashboardHeatmap;
  duration?: CreationDashboardDuration;
  errors?: CreationDashboardErrors;
}

// API functions

export function getCreationTaskList(params: CreationTaskQuery) {
  return request.get<PageResult<CreationTask>>('/api/v1/admin/creation/tasks', { params });
}

export function getCreationTaskDetail(id: number) {
  return request.get<CreationTask>(`/api/v1/admin/creation/tasks/${id}`);
}

// API 请求日志（afv_api_request_log），用于错误信息详情展示
export interface ApiRequestLog {
  id: number;
  /** 客户端名称：AIGC/COMET/WAVESPEED */
  clientName: string;
  /** 请求类型：SUBMIT/POLL */
  requestType: string;
  /** 外部任务ID */
  taskId?: string;
  requestUrl?: string;
  httpMethod?: string;
  requestBody?: string;
  responseStatus?: number;
  responseBody?: string;
  success: boolean;
  errorMessage?: string;
  costTime?: number;
  createTime: string;
}

export function getCreationTaskApiLogs(id: number) {
  return request.get<ApiRequestLog[]>(`/api/v1/admin/creation/tasks/${id}/api-logs`);
}

// 按父任务ID查询子任务列表（列表展开行用）
export function getCreationTaskChildren(taskId: string, config?: AxiosRequestConfig) {
  return request.get<CreationTask[]>(
    `/api/v1/admin/creation/tasks/${encodeURIComponent(taskId)}/children`,
    config,
  );
}

export function cancelCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/cancel`);
}

/** UNKNOWN 步骤重试时必须携带的计费结论声明 */
export interface RetryBillingDeclaration {
  billingOutcome: 'BILLED' | 'NOT_BILLED';
  note: string;
}

export function retryCreationTask(taskId: string, declaration?: RetryBillingDeclaration) {
  return declaration
    ? request.post(`/api/v1/admin/creation/tasks/${taskId}/retry`, declaration)
    : request.post(`/api/v1/admin/creation/tasks/${taskId}/retry`);
}

/** 点数是否已退还：重试会再次冻结并扣减，确认窗须明确提示 */
export function isRefundedBilling(billingStatus?: string) {
  return billingStatus === 'REFUNDED' || billingStatus === 'PARTIALLY_REFUNDED';
}

export function forceCompleteCreationTask(taskId: string, resultUrl?: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/force-complete`, { resultUrl });
}

// 强制失败（置终态、封禁重试；FAN_OUT 父任务逐个处理失败子）
export function forceFailCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/force-fail`);
}

// 屏蔽任务（遮罩用户端内容 + 素材库下架；permanent=true 永久不可逆）
export function blockCreationTask(taskId: string, data: { permanent?: boolean; reason?: string }) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/block`, data);
}

// 取消屏蔽（恢复展示 + 素材上架；永久屏蔽不可取消）
export function unblockCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/unblock`);
}

export function fixTaskContentType(id: number) {
  return request.post(`/api/v1/admin/creation/tasks/${id}/fix-content-type`);
}

export function exportCreationTasks(params: CreationTaskQuery) {
  return request.get('/api/v1/admin/creation/tasks/export', {
    params,
    responseType: 'blob',
  });
}

export function batchCancelCreationTasks(taskIds: string[]) {
  return request.post('/api/v1/admin/creation/tasks/batch-cancel', { taskIds });
}

export function getCreationDashboardData(params?: { days?: number }) {
  return request.get<CreationDashboardData>('/api/v1/admin/creation/dashboard', { params });
}

// ======================== Composite Cost Summary ========================

export interface CompositeCostSummary {
  parentTaskId: string;
  totalEstimatedCost: number;
  costCount: number;
  breakdown: CompositeCostItem[];
}

export interface CompositeCostItem {
  stepCode: string;
  taskId: string;
  costSource: string;
  pointsConsumed: number;
  meterType: string;
  meterValue?: number;
  createTime?: string;
}

export function getCompositeCostSummary(parentTaskId: string) {
  return request.get<CompositeCostSummary>('/api/v1/admin/costs/composite-summary', {
    params: { parentTaskId },
  });
}

// ======================== Pipeline Steps (交付 B) ========================

export interface PipelineParentTask {
  taskId: string;
  status: number;
  orchestrationStep: number;
  pipelineType: string;
  topology: string;
  settlementType: string;
}

export interface PipelineStep {
  code: string;
  kind: string;
  status: string;
  externalTaskId?: string;
  resultUrl?: string;
  errorMsg?: string;
  mode?: number;
  handler?: string;
}

export interface PipelineStepsResponse {
  parentTask: PipelineParentTask;
  steps: PipelineStep[];
}

// ======================== Workflow Steps（Java 工作流，topology = WORKFLOW） ========================

/**
 * 工作流的一步（`afv_workflow_step`）。字段宽容读取：后端多给的字段原样忽略，少给的不渲染。
 * `gatewayCallId` 指向 AI 网关的调用记录，详情页据此链到「AI 网关 → 调用检索」。
 */
export interface WorkflowStep {
  stepPath: string;
  status?: string | null;
  operation?: string | null;
  modelGroup?: string | null;
  gatewayCallId?: string | null;
  attempt?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMsg?: string | null;
  [key: string]: unknown;
}

export function getWorkflowSteps(taskId: string) {
  return request
    .get<WorkflowStep[] | { steps?: WorkflowStep[] }>(
      `/api/v1/admin/creation/tasks/${taskId}/workflow-steps`,
      { silentError: true, noErrorRedirect: true } as AxiosRequestConfig,
    )
    .then((res) => (Array.isArray(res) ? res : res?.steps || []));
}

// ---- 诊断与时间线（只读） ----
export interface DiagnosisTask {
  taskId?: string | null;
  type?: string | null;
  status?: number | string | null;
  statusLabel?: string | null;
  billingStatus?: string | null;
  errorMsg?: string | null;
  cancelRequested?: boolean | null;
  createTime?: string | null;
  updateTime?: string | null;
  orchestrationTopology?: string | null;
  driverEpoch?: number | null;
  retryCount?: number | null;
}

export interface DiagnosisWorkflow {
  workflowName?: string | null;
  version?: string | number | null;
  stage?: string | null;
  plannedSteps?: number | null;
  deadlineAt?: string | null;
  /** held 为 null 表示读不到 */
  driveLock?: { held?: boolean | null; ttlSeconds?: number | null } | null;
}

export interface DiagnosisFailingStep {
  stepPath?: string | null;
  kind?: string | null;
  status?: string | null;
  operation?: string | null;
  modelGroup?: string | null;
  failureClass?: string | null;
  failureCode?: string | null;
  check?: string | null;
  failureMessage?: string | null;
  retrySafe?: boolean | null;
  moneyAtRisk?: boolean | null;
  attemptCount?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  gatewayCallId?: string | null;
  gatewayCallLink?: string | null;
}

export interface DiagnosisStepItem {
  stepPath?: string | null;
  kind?: string | null;
  status?: string | null;
  operation?: string | null;
  attemptCount?: number | null;
}

export interface DiagnosisSteps {
  total?: number | null;
  byStatus?: Record<string, number> | null;
  items?: DiagnosisStepItem[] | null;
}

export interface DiagnosisBilling {
  billingStatus?: string | null;
  reservationNo?: string | null;
  pricePoints?: number | null;
  reservationStatus?: string | null;
  bizType?: string | null;
  attemptNo?: number | null;
  settled?: boolean | null;
  confirmedTime?: string | null;
  refundedTime?: string | null;
  expireTime?: string | null;
}

export interface DiagnosisDelivery {
  hasResult?: boolean | null;
  resultCount?: number | null;
  resultRefKind?: string | null;
  resultRidPrefix?: string | null;
  coverPresent?: boolean | null;
  coverRidPrefix?: string | null;
  watermarkPresent?: boolean | null;
  watermarkCount?: number | null;
  watermarkAligned?: boolean | null;
}

export interface DiagnosisAigcPush {
  id?: number | string | null;
  status?: number | string | null;
  statusLabel?: string | null;
  bizType?: string | null;
  attempts?: number | null;
  maxAttempts?: number | null;
  nextRetryTime?: string | null;
  lastError?: string | null;
  updateTime?: string | null;
}

export interface DiagnosisTimelineItem {
  kind?: string | null;
  source?: string | null;
  status?: string | null;
  stepPath?: string | null;
  ts?: string | null;
  failureClass?: string | null;
  failureCode?: string | null;
}

export interface DiagnosisMediaOp {
  op?: string | null;
  status?: string | null;
  failureClass?: string | null;
  failureCode?: string | null;
  attempts?: number | null;
  createTime?: string | null;
}

export interface DiagnosisHint {
  text?: string | null;
  manualSection?: string | null;
}

export interface Diagnosis {
  task?: DiagnosisTask | null;
  workflow?: DiagnosisWorkflow | null;
  failingStep?: DiagnosisFailingStep | null;
  steps?: DiagnosisSteps | null;
  billing?: DiagnosisBilling | null;
  delivery?: DiagnosisDelivery | null;
  aigcPush?: DiagnosisAigcPush | null;
  tracing?: Record<string, string> | null;
  timeline?: DiagnosisTimelineItem[] | null;
  mediaOps?: DiagnosisMediaOp[] | null;
  hints?: DiagnosisHint[] | null;
}

export interface TimelineEvent {
  id: number | string;
  ts?: string | null;
  stepPath?: string | null;
  kind?: string | null;
  status?: string | null;
  failureClass?: string | null;
  failureCode?: string | null;
  checkCode?: string | null;
  message?: string | null;
  attempt?: number | null;
  runNo?: number | null;
  externalType?: string | null;
  externalRef?: string | null;
  traceId?: string | null;
  source?: string | null;
  actor?: string | null;
}

export interface TimelineResp {
  events?: TimelineEvent[] | null;
  /** 为空即末页 */
  nextAfterId?: number | string | null;
}

export interface TimelineParams {
  afterId?: number | string;
  limit?: number;
  stepPath?: string;
  kind?: string;
  source?: string;
}

export function getTaskDiagnosis(taskId: string) {
  return request.get<Diagnosis>(`/api/v1/admin/creation/tasks/${taskId}/diagnosis`, {
    silentError: true,
    noErrorRedirect: true,
  } as AxiosRequestConfig);
}

export function getTaskTimeline(taskId: string, params?: TimelineParams) {
  return request.get<TimelineResp>(`/api/v1/admin/creation/tasks/${taskId}/timeline`, {
    params,
    silentError: true,
    noErrorRedirect: true,
  } as AxiosRequestConfig);
}

export function getPipelineSteps(taskId: string) {
  return request.get<PipelineStepsResponse>(`/api/v1/admin/creation/tasks/${taskId}/steps`);
}

// ======================== 免费视频待水印（中间态，需要收尾或重跑） ========================

/** 免费视频水印未就绪的任务（后端只返回这五个字段） */
export interface FreeVideoPendingTask {
  taskId: string;
  userId: number;
  status: number;
  createTime: string;
  updateTime: string;
}

export function getFreeVideoPendingTasks(limit = 50) {
  return request.get<FreeVideoPendingTask[]>('/api/v1/admin/creation/tasks/free-video-pending', {
    params: { limit },
  });
}

/** 重跑免费视频的水印收尾（只补未就绪的产物，已交付的不重做）；入队后异步执行 */
export function retryFreeVideoFinalize(taskId: string) {
  return request.post<boolean>(
    `/api/v1/admin/creation/tasks/${encodeURIComponent(taskId)}/free-video/retry`,
  );
}
