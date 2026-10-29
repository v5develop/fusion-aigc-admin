import type { PointsLog, PointsLogParams, PointsAdjustParams, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getPointsLogList(params: PointsLogParams) {
  return request.get<PageResult<PointsLog>>('/api/v1/admin/points/logs', { params });
}

export function adjustPoints(data: PointsAdjustParams) {
  const headers: Record<string, string> = {};
  if (data.idempotencyKey) {
    headers['Idempotency-Key'] = data.idempotencyKey;
  }
  // 移除 idempotencyKey 避免发到 body 里
  const { idempotencyKey: _idempotencyKey, ...body } = data;
  return request.post('/api/v1/admin/points/adjust', body, { headers });
}
