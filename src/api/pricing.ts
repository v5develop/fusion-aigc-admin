import { request } from '@/utils/request'
import type { ModelPricing, PricingListParams, PageResult } from '@/types/api'

export function getPricingList(params: PricingListParams) {
  return request.get<PageResult<ModelPricing>>('/api/admin/pricing', { params })
}

export function createPricing(data: Partial<ModelPricing>) {
  return request.post('/api/admin/pricing', data)
}

export function updatePricing(id: number, data: Partial<ModelPricing>) {
  return request.put(`/api/admin/pricing/${id}`, data)
}

export function deletePricing(id: number) {
  return request.delete(`/api/admin/pricing/${id}`)
}
