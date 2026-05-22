import { request } from '@/utils/request'
import type { AdminRole, AdminRoleListParams, PageResult } from '@/types/api'

export function getAdminRoleList(params: AdminRoleListParams) {
  return request.get<PageResult<AdminRole>>('/api/admin/roles', { params })
}

export function createAdminRole(data: Partial<AdminRole>) {
  return request.post('/api/admin/roles', data)
}

export function updateAdminRole(id: number, data: Partial<AdminRole>) {
  return request.put(`/api/admin/roles/${id}`, data)
}

export function deleteAdminRole(id: number) {
  return request.delete(`/api/admin/roles/${id}`)
}

export function getRolePermissions(id: number) {
  return request.get<string[]>(`/api/admin/roles/${id}/permissions`)
}

export function saveRolePermissions(id: number, permissions: string[]) {
  return request.put(`/api/admin/roles/${id}/permissions`, { permissions })
}
