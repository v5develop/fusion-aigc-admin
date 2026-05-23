import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import {
  getStoredToken,
  storeToken,
  clearToken,
  getStoredUser,
  storeUser,
  clearUser,
  loginWithPassword,
  logout as apiLogout,
  type UserInfo,
} from '@/api/auth'
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
    } else {
      throw new Error('Login failed')
    }
  }

  const logout = async () => {
    try {
      if (token.value) {
        await apiLogout()
      }
    } finally {
      clearToken()
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
  }
})
