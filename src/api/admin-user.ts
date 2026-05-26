import { request } from '@/utils/request'
import type { AdminUser, AdminUserListParams, PageResult } from '@/types/api'

export function getAdminUserList(params: AdminUserListParams) {
  return request.get<PageResult<AdminUser>>('/api/v1/admin/users', { params })
}

export function createAdminUser(data: Partial<AdminUser>) {
  return request.post('/api/v1/admin/users', data)
}

export function updateAdminUser(id: number, data: Partial<AdminUser>) {
  return request.put(`/api/admin/users/${id}`, data)
}

export function deleteAdminUser(id: number) {
  return request.delete(`/api/admin/users/${id}`)
}

export function resetAdminPassword(id: number, data: { newPassword: string }) {
  return request.put(`/api/admin/users/${id}/password`, data)
}

export function toggleAdminStatus(id: number, status: number) {
  return request.put(`/api/admin/users/${id}/status`, { status })
}
