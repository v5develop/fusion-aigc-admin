import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

// Task status enum
export enum TaskStatus {
  QUEUING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  FAILED = 3,
  CANCELLED = 4,
}

// Task type enum
export type TaskType = 'IMAGE' | 'VIDEO' | 'ECOMMERCE'

// Creation Task record
export interface CreationTask {
  id: number
  taskId: string
  userId: number
  username?: string
  type: TaskType
  mode: number
  params?: string
  aigcTaskId?: string
  status: TaskStatus
  statusText?: string
  resultUrl?: string
  errorMsg?: string
  category?: string
  ownerType?: number
  ownerId?: number
  parentTaskId?: string
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
  pageNo: number
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

export function cancelCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/cancel`)
}

export function retryCreationTask(taskId: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/retry`)
}

export function forceCompleteCreationTask(taskId: string, resultUrl?: string) {
  return request.post(`/api/v1/admin/creation/tasks/${taskId}/force-complete`, { resultUrl })
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
