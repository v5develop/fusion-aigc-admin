import type { ModelCostPricing, CostPricingListParams, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getCostPricingList(params: CostPricingListParams) {
  return request.get<PageResult<ModelCostPricing>>('/api/v1/admin/cost-pricing', { params });
}

export function createCostPricing(data: Partial<ModelCostPricing>) {
  return request.post('/api/v1/admin/cost-pricing', data);
}

export function updateCostPricing(id: number, data: Partial<ModelCostPricing>) {
  return request.put(`/api/v1/admin/cost-pricing/${id}`, data);
}

export function deleteCostPricing(id: number) {
  return request.delete(`/api/v1/admin/cost-pricing/${id}`);
}
