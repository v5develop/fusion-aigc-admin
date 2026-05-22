import { request } from '@/utils/request'
import type { PointsLog, PointsLogParams, PageResult } from '@/types/api'

export function getPointsLogList(params: PointsLogParams) {
  return request.get<PageResult<PointsLog>>('/api/admin/points/logs', { params })
}

export function adjustPoints(data: { userId: number; adjustType: string; amount: number; reason: string; approvalTicketId?: string }) {
  return request.post('/api/admin/points/adjust', data)
}
