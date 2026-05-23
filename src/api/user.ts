import { request } from '@/utils/request'
import type { User, UserListParams, PageResult } from '@/types/api'

export function getUserList(params: UserListParams) {
  return request.get<PageResult<User>>('/api/admin/app-users', { params })
}

export function getUserDetail(id: number) {
  return request.get<User>(`/api/admin/app-users/${id}`)
}

export function getUserCapabilities(userId: number) {
  return request.get(`/api/admin/app-users/${userId}/capabilities`)
}

export function getUserPoints(userId: number) {
  return request.get(`/api/admin/app-users/${userId}/points`)
}

export function adjustUserPoints(userId: number, data: { amount: number; reason: string }) {
  return request.post(`/api/admin/app-users/${userId}/points/adjust`, data)
}
