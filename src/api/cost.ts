import type { ModelCost, ModelCostStats, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getCostList(params: {
  taskId?: string;
  modelId?: number;
  userId?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  return request.get<PageResult<ModelCost>>('/api/v1/admin/costs', { params });
}

export function getCostStats(params: { startDate?: string; endDate?: string }) {
  return request.get<ModelCostStats>('/api/v1/admin/costs/stats', { params });
}
