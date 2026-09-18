import type { AdminResource, AdminResourceListParams, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getAdminResourceList(params: AdminResourceListParams) {
  return request.get<PageResult<AdminResource>>('/api/v1/admin/resources', { params });
}

export function getAdminResourceOptions() {
  return request.get<AdminResource[]>('/api/v1/admin/resources/options');
}

export function createAdminResource(data: Partial<AdminResource>) {
  return request.post('/api/v1/admin/resources', data);
}

export function updateAdminResource(id: number, data: Partial<AdminResource>) {
  return request.put(`/api/v1/admin/resources/${id}`, data);
}

export function deleteAdminResource(id: number) {
  return request.delete(`/api/v1/admin/resources/${id}`);
}
