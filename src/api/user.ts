import { request } from '@/utils/request'
import type { User, UserListParams, PageResult, UserPool } from '@/types/api'

export function getUserList(params: UserListParams) {
  return request.get<PageResult<User>>('/api/v1/admin/app-users', { params })
}

export function getUserDetail(id: number) {
  return request.get<User>(`/api/v1/admin/app-users/${id}`)
}

export function getUserCapabilities(userId: number) {
  return request.get(`/api/v1/admin/app-users/${userId}/capabilities`)
}

export function getUserPoints(userId: number) {
  return request.get(`/api/v1/admin/app-users/${userId}/points`)
}

/** 用户多应用账号池（绑定关系） */
export function getUserPool(userId: number) {
  return request.get<UserPool>(`/api/v1/admin/app-users/${userId}/pool`)
}

/** 重置 C 端用户 用户名/密码（super_admin）。newUsername / newPassword 各可空（=不改），至少填一项。 */
export function resetUserCredentials(
  userId: number,
  data: { newUsername?: string; newPassword?: string },
) {
  return request.put<boolean>(`/api/v1/admin/app-users/${userId}/credentials`, data)
}


