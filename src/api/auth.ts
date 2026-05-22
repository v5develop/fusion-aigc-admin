import { request } from '@/utils/request'
import { getToken, setToken, removeToken, getUser, setUser, removeUser } from '@/utils/storage'
import type { LoginParams, LoginResult, AdminInfo, UserInfo } from '@/types/auth'

export function loginWithPassword(username: string, password: string) {
  return request.post<LoginResult>('/api/admin/auth/login', { username, password })
}

export function logout() {
  return request.post('/api/admin/auth/logout')
}

export function getAdminInfo() {
  return request.get<AdminInfo>('/api/admin/auth/info')
}

export function changePassword(params: { oldPassword: string; newPassword: string }) {
  return request.put('/api/admin/auth/password', params)
}

// Storage helpers for auth store compatibility
export function getStoredToken(): string | null {
  return getToken()
}

export function storeToken(token: string): void {
  setToken(token)
}

export function clearToken(): void {
  removeToken()
}

export function getStoredUser(): UserInfo | null {
  return getUser()
}

export function storeUser(user: UserInfo): void {
  setUser(user)
}

export function clearUser(): void {
  removeUser()
}

export type { LoginParams, LoginResult, AdminInfo, UserInfo }
