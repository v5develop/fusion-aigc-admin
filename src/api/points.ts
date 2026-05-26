import { request } from '@/utils/request'
import type { PointsLog, PointsLogParams, PageResult } from '@/types/api'

export function getPointsLogList(params: PointsLogParams) {
  return request.get<PageResult<PointsLog>>('/api/v1/admin/points/logs', { params })
}

export function adjustPoints(data: {
  userId: number
  adjustType: string
  amount: number
  reason: string
  idempotencyKey?: string
}) {
  const headers: Record<string, string> = {}
  if (data.idempotencyKey) {
    headers['Idempotency-Key'] = data.idempotencyKey
  }
  // 移除 idempotencyKey 避免发到 body 里
  const { idempotencyKey, ...body } = data
  return request.post('/api/v1/admin/points/adjust', body, { headers })
}
