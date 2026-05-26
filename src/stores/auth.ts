import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import {
  getStoredToken,
  storeToken,
  getStoredUser,
  storeUser,
  clearUser,
  loginWithPassword,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  type UserInfo,
} from '@/api/auth'
import { setRefreshToken, getRefreshToken, clearTokens } from '@/utils/storage'
import { usePermissionStore } from '@/stores/permission'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken())
  const user = ref<UserInfo | null>(getStoredUser())
  const isLoggedIn = computed(() => !!token.value)

  const login = async (username: string, password: string): Promise<void> => {
    const resp = await loginWithPassword(username, password)
    // Backend returns: { accessToken, refreshToken, expiresIn, adminId, username, roleCode }
    if (resp?.accessToken) {
      token.value = resp.accessToken
      const userInfo: UserInfo = {
        id: resp.adminId,
        username: resp.username,
        nickname: resp.username,
        avatar: '',
        roles: resp.roleCode ? [resp.roleCode] : [],
        permissions: [],
      }
      user.value = userInfo
      storeToken(resp.accessToken)
      storeUser(userInfo)
      if (resp.refreshToken) {
        setRefreshToken(resp.refreshToken)
      }
    } else {
      throw new Error('Login failed')
    }
  }

  const setTokens = (accessToken: string, newRefreshToken: string) => {
    token.value = accessToken
    storeToken(accessToken)
    setRefreshToken(newRefreshToken)
  }

  const refreshAccessToken = async (): Promise<string> => {
    const storedRefreshToken = getRefreshToken()
    if (!storedRefreshToken) {
      throw new Error('No refresh token available')
    }
    const resp = await apiRefreshToken(storedRefreshToken)
    if (resp?.accessToken) {
      setTokens(resp.accessToken, resp.refreshToken || storedRefreshToken)
      return resp.accessToken
    }
    throw new Error('Token refresh failed')
  }

  const logout = async () => {
    try {
      if (token.value) {
        await apiLogout()
      }
    } finally {
      clearTokens()
      clearUser()
      token.value = null
      user.value = null
      const permissionStore = usePermissionStore()
      permissionStore.resetPermission()
    }
  }

  const initAuth = () => {
    const storedToken = getStoredToken()
    const storedUser = getStoredUser()
    if (storedToken) {
      token.value = storedToken
    }
    if (storedUser) {
      user.value = storedUser
    }
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    logout,
    initAuth,
    setTokens,
    refreshAccessToken,
  }
})
