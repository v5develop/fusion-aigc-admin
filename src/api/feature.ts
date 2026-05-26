import { request } from '@/utils/request'
import type { Feature, FeatureListParams, PageResult } from '@/types/api'

export function getFeatureList(params: FeatureListParams) {
  return request.get<PageResult<Feature>>('/api/v1/admin/capabilities/points', { params })
}

export function createFeature(data: Partial<Feature>) {
  return request.post('/api/v1/admin/capabilities/points', data)
}

export function updateFeature(id: number, data: Partial<Feature>) {
  return request.put(`/api/admin/capabilities/points/${id}`, data)
}

export function deleteFeature(id: number) {
  return request.delete(`/api/admin/capabilities/points/${id}`)
}

export function getFeatureModelMapping(id: number) {
  return request.get<{ modelIds: number[] }>(`/api/admin/capabilities/points/${id}/models`)
}

export function saveFeatureModelMapping(id: number, data: { modelIds: number[] }) {
  return request.put(`/api/admin/capabilities/points/${id}/models`, data)
}

export interface CapabilityGrant {
  id: number
  userId: number
  username: string
  featureName: Record<string, string>
  source: string
  effectiveTime: string
  expireTime: string
  status: number
}

export function getFeatureGrantList(params: { userId?: number; pageNo: number; pageSize: number }) {
  return request.get<PageResult<CapabilityGrant>>('/api/v1/admin/capabilities/grants', { params })
}

export function revokeCapability(grantId: number) {
  return request.post(`/api/admin/capabilities/grants/${grantId}/revoke`)
}

export interface CapabilityChangeLog {
  id: number
  userId: number
  username: string
  featureCode: string
  featureName: Record<string, string>
  changeType: string
  pointsChange: number
  source: string
  remark: string
  createTime: string
}

export function getFeatureChangeLog(params: { featureId?: number; pageNo: number; pageSize: number }) {
  return request.get<PageResult<CapabilityChangeLog>>('/api/v1/admin/capabilities/change-log', { params })
}
