import type { LoginParams, LoginResult, AdminInfo, UserInfo } from '@/types/auth';
import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';
import { getToken, setToken, removeToken, getUser, setUser, removeUser } from '@/utils/storage';

export function loginWithPassword(username: string, password: string) {
  return request.post<LoginResult>('/api/v1/admin/auth/login', { username, password }, {
    silentError: true,
  } as AxiosRequestConfig & { silentError: boolean });
}

export function refreshToken(token: string) {
  return request.post<LoginResult>('/api/v1/admin/auth/refresh', { refreshToken: token });
}

export function logout() {
  return request.post('/api/v1/admin/auth/logout');
}

export function getAdminInfo() {
  return request.get<AdminInfo>('/api/v1/admin/auth/info');
}

export function changePassword(params: { oldPassword: string; newPassword: string }) {
  return request.put('/api/v1/admin/auth/password', params, {
    silentError: true,
  } as AxiosRequestConfig & { silentError: boolean });
}

// Storage helpers for auth store compatibility
export function getStoredToken(): string | null {
  return getToken();
}

export function storeToken(token: string): void {
  setToken(token);
}

export function clearToken(): void {
  removeToken();
}

export function getStoredUser(): UserInfo | null {
  return getUser();
}

export function storeUser(user: UserInfo): void {
  setUser(user);
}

export function clearUser(): void {
  removeUser();
}

export type { LoginParams, LoginResult, AdminInfo, UserInfo };
