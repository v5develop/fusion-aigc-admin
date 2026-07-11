import { request } from '@/utils/request'
import type { AxiosRequestConfig } from 'axios'
import type { PageResult } from '@/types/api'

// Task status enum
export enum TaskStatus {
  QUEUING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  FAILED = 3,
  CANCELLED = 4,
}

// Task type enum — 数据库存储小驼峰格式（如 productSetImages、hitVideo），列表筛选仍可用大类
export type TaskType = string

// Creation Task record
export interface CreationTask {
  id: number
  taskId: string
  userId: number
  username?: string
  type: TaskType
  typeName?: string
  mode: number
  /** 用户原始入参：用户端完整原始请求体快照（仅入口主任务有值，子任务/派生任务为 null）*/
  requestParams?: string
  /** 出口/执行入参：下发执行方（AIGC/第三方 API）的入参快照 */
  params?: string
  /** 执行方任务 ID：执行方返回的任务标识（本地 task_id / 豆包 arkId / wavespeed requestId / comet taskId）*/
  executionTaskId?: string
  status: TaskStatus
  statusText?: string
  resultUrl?: string
  errorMsg?: string
  category?: string
  ownerType?: number
  ownerId?: number
  parentTaskId?: string
  /** 是否有子任务（列表可展开标记） */
  hasChildren?: boolean
  /** 子任务数量（父任务聚合） */
  childCount?: number
  /** 子任务合计消耗积分（父任务聚合，已退款/已取消/已过期不计） */
  totalPricePoints?: number
  /** 子任务聚合计费状态（父任务聚合折叠值） */
  aggregatedBillingStatus?: string
  featureCode?: string
  modelId?: number
  modelName?: string
  reservationNo?: string
  billingStatus?: string
  pricePoints?: number
  language?: string
  watermark?: string
  createTime: string
  updateTime: string
  children?: CreationTask[]
  /** 子任务列表：详情接口 GET /{id} 返回的子任务挂在 subTasks（非 children） */
  subTasks?: CreationTask[]
  // ---- 子任务成本字段（组合任务子任务列表）----
  costSource?: string
  estimatedCost?: number
  meterType?: string
  meterValue?: number
  providerModel?: string
  reservationLines?: ReservationLine[]
}

export interface ReservationLine {
  lineNo: number
  componentCode: string
  stepCode: string
  mode: number
  reservedPoints: number
  confirmedPoints: number
  refundedPoints: number
  status: string
  outputRef: string
}

// Task list query params
export interface CreationTaskQuery {
  type?: string
  status?: number | string
  userId?: number | string
  modelId?: number | string
  featureCode?: string
  billingStatus?: string
  category?: string
  startTime?: string
  endTime?: string
  keyword?: string
  page: number
  pageSize: number
}

// Dashboard stats
export interface CreationDashboardStats {
  todayTasks: number
  todayCompleted: number
  todayFailed: number
  successRate: number
  queuing: number
  processing: number
}

// Dashboard trend
export interface CreationDashboardTrend {
  labels: string[]
  taskCounts: number[]
  successCounts: number[]
  failedCounts: number[]
}

// Dashboard distribution
export interface CreationDashboardDistribution {
  statusDistribution: { name: string; value: number }[]
  typeDistribution: { name: string; value: number }[]
}

// Dashboard ranking
export interface CreationDashboardRanking {
  modelRanking: { name: string; value: number }[]
  userRanking: { name: string; value: number }[]
}

// Dashboard heatmap
export interface CreationDashboardHeatmap {
  hours: number[]
  days: string[]
  values: number[][]
}

// Dashboard duration stats
export interface CreationDashboardDuration {
  types: string[]
  p50: number[]
  p90: number[]
  p99: number[]
}

// Dashboard error stats
export interface CreationDashboardErrors {
  errors: { errorMsg: string; count: number; percentage: number }[]
}

// Combined dashboard data
export interface CreationDashboardData {
  stats: CreationDashboardStats
  trend?: CreationDashboardTrend
  distribution?: CreationDashboardDistribution
  ranking?: CreationDashboardRanking
  heatmap?: CreationDashboardHeatmap
  duration?: CreationDashboardDuration
  errors?: CreationDashboardErrors
}

// API functions

export function getCreationTaskList(params: CreationTaskQuery) {
  return request.get<PageResult<CreationTask>>('/api/v1/admin/creation/tasks', { params })
}

export function getCreationTaskDetail(id: number) {
  return request.get<CreationTask>(`/api/v1/admin/creation/tasks/${id}`)
}

// API 请求日志（afv_api_request_log），用于错误信息详情展示
export interface ApiRequestLog {
  id: number
  /** 客户端名称：AIGC/COMET/WAVESPEED */
  clientName: string
  /** 请求类型：SUBMIT/POLL */
  requestType: string
  /** 外部任务ID */
  taskId?: string
  requestUrl?: string
  httpMethod?: string
  requestBody?: string
  responseStatus?: number
  responseBody?: string
  success: boolean
  errorMessage?: string
  costTime?: number
  createTime: string
}

export function getCreationTaskApiLogs(id: number) {
  return request.get<ApiRequestLog[]>(`/api/v1/admin/creation/tasks/${id}/api-logs`)
}

// 按父任务ID查询子任务列表（列表展开行用）
export function getCreationTaskChildren(taskId: string, config?: AxiosRequestConfig) {
  return request.get<CreationTask[]>(
    `/api/v1/admin/creation/tasks/${encodeURIComponent(taskId)}/children`,
    config,
  )
}

export function cancelCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/cancel`)
}

export function retryCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/retry`)
}

export function forceCompleteCreationTask(taskId: string, resultUrl?: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/force-complete`, { resultUrl })
}

export function fixTaskContentType(id: number) {
  return request.post(`/api/v1/admin/creation/tasks/${id}/fix-content-type`)
}

export function exportCreationTasks(params: CreationTaskQuery) {
  return request.get('/api/v1/admin/creation/tasks/export', {
    params,
    responseType: 'blob',
  })
}

export function batchCancelCreationTasks(taskIds: string[]) {
  return request.post('/api/v1/admin/creation/tasks/batch-cancel', { taskIds })
}

export function getCreationDashboardData(params?: { days?: number }) {
  return request.get<CreationDashboardData>('/api/v1/admin/creation/dashboard', { params })
}

// ======================== Composite Cost Summary ========================

export interface CompositeCostSummary {
  parentTaskId: string
  totalEstimatedCost: number
  costCount: number
  breakdown: CompositeCostItem[]
}

export interface CompositeCostItem {
  stepCode: string
  taskId: string
  costSource: string
  pointsConsumed: number
  meterType: string
  meterValue?: number
  createTime?: string
}

export function getCompositeCostSummary(parentTaskId: string) {
  return request.get<CompositeCostSummary>('/api/v1/admin/costs/composite-summary', {
    params: { parentTaskId },
  })
}

// ======================== Pipeline Steps (交付 B) ========================

export interface PipelineParentTask {
  taskId: string
  status: number
  orchestrationStep: number
  pipelineType: string
  topology: string
  settlementType: string
}

export interface PipelineStep {
  code: string
  kind: string
  status: string
  externalTaskId?: string
  resultUrl?: string
  errorMsg?: string
  mode?: number
  handler?: string
}

export interface PipelineStepsResponse {
  parentTask: PipelineParentTask
  steps: PipelineStep[]
}

export function getPipelineSteps(taskId: string) {
  return request.get<PipelineStepsResponse>(`/api/v1/admin/creation/tasks/${taskId}/steps`)
}
