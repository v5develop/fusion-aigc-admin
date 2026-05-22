import { request } from '@/utils/request'
import type { User, UserListParams, PageResult } from '@/types/api'

export function getUserList(params: UserListParams) {
  return request.get<PageResult<User>>('/api/admin/users/c端', { params })
}

export function getUserDetail(id: number) {
  return request.get<User>(`/api/admin/users/c端/${id}`)
}

export function getUserCapabilities(userId: number) {
  return request.get(`/api/admin/users/c端/${userId}/capabilities`)
}

export function getUserPoints(userId: number) {
  return request.get(`/api/admin/users/c端/${userId}/points`)
}

export function adjustUserPoints(userId: number, data: { amount: number; reason: string }) {
  return request.post(`/api/admin/users/c端/${userId}/points/adjust`, data)
}
