import type { AdminPermission, AdminPermissionListParams, PageResult } from '@/types/api';

import { request } from '@/utils/request';

export function getAdminPermissionList(params: AdminPermissionListParams) {
  return request.get<PageResult<AdminPermission>>('/api/v1/admin/permissions', { params });
}

export function createAdminPermission(data: Partial<AdminPermission>) {
  return request.post('/api/v1/admin/permissions', data);
}

export function updateAdminPermission(id: number, data: Partial<AdminPermission>) {
  return request.put(`/api/v1/admin/permissions/${id}`, data);
}

export function deleteAdminPermission(id: number) {
  return request.delete(`/api/v1/admin/permissions/${id}`);
}

export function getPermissionTree() {
  return request.get<PermissionGroup[]>('/api/v1/admin/permissions/tree');
}

export interface PermissionGroup {
  resource: string;
  resourceName: string;
  permissions: AdminPermission[];
}
