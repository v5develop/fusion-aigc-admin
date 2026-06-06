import { request } from '@/utils/request'

// === 类型定义 ===

export interface OverviewData {
  totalToday: number
  totalWeek: number
  totalMonth: number
  pendingCount: number
  processingCount: number
  completedCount: number
  failedCount: number
  cancelledCount: number
  successRate: number
}

export interface DistributionItem {
  name: string
  value: number
  percentage: number
}

export interface TrendDataPoint {
  date: string
  taskCount: number
  successCount: number
  failCount: number
}

export interface RankingItem {
  id: number
  name: string
  taskCount: number
  successRate: number
  avgDuration?: number
}

export interface HeatmapItem {
  day: number
  hour: number
  count: number
}

export interface DurationGroup {
  type: string
  p50: number
  p90: number
  p99: number
  avg: number
  min: number
  max: number
}

export interface RealtimeData {
  totalToday?: number
  pendingCount: number
  processingCount: number
  todayCompleted: number
  todayFailed: number
  successRate: number
  avgWaitTime: number
}

export interface FailureItem {
  errorMsg: string
  count: number
  percentage: number
  sampleTaskIds: string[]
}

// === API 函数 ===

export function getCreationOverview() {
  return request.get<OverviewData>('/api/v1/admin/creation/dashboard/overview')
}

export function getStatusDistribution() {
  return request.get<DistributionItem[]>('/api/v1/admin/creation/dashboard/status-distribution')
}

export function getTypeDistribution() {
  return request.get<DistributionItem[]>('/api/v1/admin/creation/dashboard/type-distribution')
}

export function getCreationTrend(params: { startDate?: string; endDate?: string; granularity?: string }) {
  return request.get<TrendDataPoint[]>('/api/v1/admin/creation/dashboard/trend', { params })
}

export function getModelRanking(limit?: number) {
  return request.get<RankingItem[]>('/api/v1/admin/creation/dashboard/model-ranking', { params: { limit } })
}

export function getUserRanking(limit?: number) {
  return request.get<RankingItem[]>('/api/v1/admin/creation/dashboard/user-ranking', { params: { limit } })
}

export function getHourlyHeatmap() {
  return request.get<HeatmapItem[]>('/api/v1/admin/creation/dashboard/hourly-heatmap')
}

export function getDurationStats() {
  return request.get<DurationGroup[]>('/api/v1/admin/creation/dashboard/duration-stats')
}

export function getRealtimeStatus() {
  return request.get<RealtimeData>('/api/v1/admin/creation/dashboard/realtime')
}

export function getFailureAnalysis() {
  return request.get<FailureItem[]>('/api/v1/admin/creation/dashboard/failure-analysis')
}
