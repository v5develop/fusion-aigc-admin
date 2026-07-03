import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

// ======================== Types ========================

export interface BillingOffer {
  id?: number
  offerCode: string
  name: string
  category?: string
  entryCode: string
  featureCode: string
  billingScene?: string
  displayConfig?: string
  status: string
  sort?: number
  createTime?: string
  updateTime?: string
}

export interface BillingOfferVariant {
  id?: number
  variantCode: string
  offerCode?: string
  name: string
  qualityTier?: string
  defaultModelId?: number
  defaultResolution?: string
  defaultDurationSeconds?: number
  includedOutputs?: number
  settlementType?: string
  status: string
  createTime?: string
  updateTime?: string
}

export interface ChargeComponent {
  id?: number
  componentCode: string
  variantCode?: string
  stepCode: string
  componentType?: string
  mode: number
  costType?: string
  /** 分段计费该步计价口径：IMAGE_GEN(按张)/VIDEO_GEN(按秒)；空=用 basePoints 固定单价 */
  actionType?: string | null
  modelId?: number
  basePoints?: number
  repeatCount?: number
  sort?: number
  createTime?: string
  updateTime?: string
}

// ======================== Offer API ========================

export function getOfferList(params: Record<string, unknown>) {
  return request.get<PageResult<BillingOffer>>('/api/v1/admin/billing/offers', { params })
}

export function getAllOffers() {
  return request.get<BillingOffer[]>('/api/v1/admin/billing/offers/all')
}

export function createOffer(data: Partial<BillingOffer>) {
  return request.post<BillingOffer>('/api/v1/admin/billing/offers', data)
}

export function updateOffer(id: number, data: Partial<BillingOffer>) {
  return request.put<BillingOffer>(`/api/v1/admin/billing/offers/${id}`, data)
}

export function deleteOffer(id: number) {
  return request.delete(`/api/v1/admin/billing/offers/${id}`)
}

// ======================== Variant API ========================

export function getVariantsByOffer(offerId: number) {
  return request.get<BillingOfferVariant[]>(`/api/v1/admin/billing/offers/${offerId}/variants`)
}

export function createVariant(offerId: number, data: Partial<BillingOfferVariant>) {
  return request.post<BillingOfferVariant>(`/api/v1/admin/billing/offers/${offerId}/variants`, data)
}

export function updateVariant(id: number, data: Partial<BillingOfferVariant>) {
  return request.put<BillingOfferVariant>(`/api/v1/admin/billing/offers/variants/${id}`, data)
}

export function deleteVariant(id: number) {
  return request.delete(`/api/v1/admin/billing/offers/variants/${id}`)
}

// ======================== Component API ========================

export function getComponentsByVariant(variantId: number) {
  return request.get<ChargeComponent[]>(`/api/v1/admin/billing/offers/variants/${variantId}/components`)
}

export function createComponent(variantId: number, data: Partial<ChargeComponent>) {
  return request.post<ChargeComponent>(`/api/v1/admin/billing/offers/variants/${variantId}/components`, data)
}

export function updateComponent(id: number, data: Partial<ChargeComponent>) {
  return request.put<ChargeComponent>(`/api/v1/admin/billing/offers/components/${id}`, data)
}

export function deleteComponent(id: number) {
  return request.delete(`/api/v1/admin/billing/offers/components/${id}`)
}

// ======================== Tree API ========================

export interface OfferTreeNode {
  id: number
  offerCode: string
  name: string
  entryCode: string
  featureCode: string
  category?: string
  billingScene?: string
  status: string
  sort?: number
  createTime?: string
  variants: VariantTreeNode[]
}

export interface VariantTreeNode {
  id: number
  variantCode: string
  offerCode: string
  name: string
  qualityTier?: string
  settlementType?: string
  defaultModelId?: number
  defaultResolution?: string
  defaultDurationSeconds?: number
  includedOutputs?: number
  status: string
  createTime?: string
  components: ChargeComponent[]
}

export function getOfferTree(params?: Record<string, unknown>) {
  return request.get<PageResult<OfferTreeNode>>('/api/v1/admin/billing/offers/list', { params })
}

// ======================== Cache ========================

export function refreshOfferCache() {
  return request.post('/api/v1/admin/billing/offers/refresh')
}
