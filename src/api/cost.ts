import { request } from '@/utils/request'
import type { ModelCost, ModelCostStats, PageResult } from '@/types/api'

export function getCostList(params: {
  modelId?: number
  userId?: number
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}) {
  return request.get<PageResult<ModelCost>>('/api/v1/admin/costs', { params })
}

export function getCostStats(params: { startDate?: string; endDate?: string }) {
  return request.get<ModelCostStats>('/api/v1/admin/costs/stats', { params })
}
