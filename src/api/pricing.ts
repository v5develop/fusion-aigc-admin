import type { ModelPricing, PricingListParams, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getPricingList(params: PricingListParams) {
  return request.get<PageResult<ModelPricing>>('/api/v1/admin/pricing', { params });
}

export function createPricing(data: Partial<ModelPricing>) {
  return request.post('/api/v1/admin/pricing', data);
}

export function updatePricing(id: number, data: Partial<ModelPricing>) {
  return request.put(`/api/v1/admin/pricing/${id}`, data);
}

export function deletePricing(id: number) {
  return request.delete(`/api/v1/admin/pricing/${id}`);
}
