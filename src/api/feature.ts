import type {
  Feature,
  FeatureListParams,
  PageResult,
  FeatureGrant,
  FeatureChangeLog,
} from '@/types/api';

import { request } from '@/utils/request';

export function getFeatureList(params: FeatureListParams) {
  return request.get<PageResult<Feature>>('/api/v1/admin/creation/features', { params });
}

export function getFeatureOptions() {
  return request.get<Feature[]>('/api/v1/admin/creation/features/all');
}

export function createFeature(data: Partial<Feature>) {
  return request.post('/api/v1/admin/creation/features', data);
}

export function updateFeature(id: number, data: Partial<Feature>) {
  return request.put(`/api/v1/admin/creation/features/${id}`, data);
}

export function deleteFeature(id: number) {
  return request.delete(`/api/v1/admin/creation/features/${id}`);
}

export function getFeatureModelMapping(id: number) {
  return request.get<{ modelIds: number[] }>(`/api/v1/admin/creation/features/${id}/models`);
}

export function saveFeatureModelMapping(id: number, data: { modelIds: number[] }) {
  return request.put(`/api/v1/admin/creation/features/${id}/models`, data);
}

export function getFeatureGrantList(params: {
  userId?: number;
  username?: string;
  source?: string;
  page: number;
  pageSize: number;
}) {
  return request.get<PageResult<FeatureGrant>>('/api/v1/admin/creation/feature-grants', { params });
}

export function revokeFeature(grantId: number) {
  return request.post(`/api/v1/admin/creation/feature-grants/${grantId}/revoke`);
}

export function manualAddFeature(data: {
  userId?: number;
  unionUserId?: string;
  featureCode: string;
  expireTime?: string;
}) {
  return request.post('/api/v1/admin/creation/feature-grants', data);
}

export function manualRemoveFeature(grantId: number) {
  return request.post(`/api/v1/admin/creation/feature-grants/${grantId}/manual-remove`);
}

export function getFeatureChangeLog(params: {
  featureId?: number;
  userId?: number;
  username?: string;
  featureCode?: string;
  unionUserId?: string;
  changeType?: string;
  page: number;
  pageSize: number;
}) {
  return request.get<PageResult<FeatureChangeLog>>('/api/v1/admin/creation/features/change-log', {
    params,
  });
}
