import { request } from '@/utils/request'
import type { AdminRole, AdminRoleListParams, PageResult } from '@/types/api'

export function getAdminRoleList(params: AdminRoleListParams) {
  return request.get<PageResult<AdminRole>>('/api/v1/admin/roles', { params })
}

export function createAdminRole(data: Partial<AdminRole>) {
  return request.post('/api/v1/admin/roles', data)
}

export function updateAdminRole(id: number, data: Partial<AdminRole>) {
  return request.put(`/api/v1/admin/roles/${id}`, data)
}

export function deleteAdminRole(id: number) {
  return request.delete(`/api/v1/admin/roles/${id}`)
}

export function getRolePermissions(id: number) {
  return request.get<string[]>(`/api/v1/admin/roles/${id}/permissions`)
}

export function getAllPermissions() {
  return request.get<Permission[]>('/api/v1/admin/roles/permissions/all')
}

export function saveRolePermissions(id: number, permissions: string[]) {
  return request.put(`/api/v1/admin/roles/${id}/permissions`, { permissions })
}

export interface Permission {
  id: number
  permissionCode: string
  permissionName: string
  resource: string
  action: string
  description?: string
}
