import type { Consumption, ConsumptionParams, ConsumptionStats, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getConsumptionList(params: ConsumptionParams) {
  return request.get<PageResult<Consumption>>('/api/v1/admin/consumptions', { params });
}

export function getConsumptionStats() {
  return request.get<ConsumptionStats>('/api/v1/admin/consumptions/stats');
}
