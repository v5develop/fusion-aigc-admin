import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import {
  getStoredToken,
  storeToken,
  getStoredUser,
  storeUser,
  clearUser,
  loginWithPassword,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  getAdminInfo,
  type UserInfo,
} from '@/api/auth';
import { usePermissionStore } from '@/stores/permission';
import { setRefreshToken, getRefreshToken, clearTokens } from '@/utils/storage';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const user = ref<UserInfo | null>(getStoredUser());
  const isLoggedIn = computed(() => !!token.value);

  const login = async (username: string, password: string): Promise<void> => {
    const resp = await loginWithPassword(username, password);
    // Backend returns: { accessToken, refreshToken, expiresIn, adminId, username, roleCode }
    if (resp?.accessToken) {
      token.value = resp.accessToken;
      const userInfo: UserInfo = {
        id: resp.adminId,
        username: resp.username,
        nickname: resp.username,
        avatar: '',
        roles: resp.roleCode ? [resp.roleCode] : [],
        permissions: [],
      };
      user.value = userInfo;
      storeToken(resp.accessToken);
      storeUser(userInfo);
      if (resp.refreshToken) {
        setRefreshToken(resp.refreshToken);
      }
      // 登录响应不含权限列表，拉取 /auth/info 填充 roles/permissions，
      // 否则 v-permission 永远拿到空数组，按钮全被隐藏。
      await loadUserInfo();
    } else {
      throw new Error('Login failed');
    }
  };

  // 从后端拉取当前管理员完整信息（含 roles/permissions）并写入 store。
  const loadUserInfo = async (): Promise<void> => {
    if (!token.value) return;
    try {
      const info = await getAdminInfo();
      if (info) {
        const userInfo: UserInfo = {
          id: info.id,
          username: info.username,
          nickname: info.nickname || info.username,
          avatar: info.avatar || '',
          roles: info.roles ?? [],
          permissions: info.permissions ?? [],
        };
        user.value = userInfo;
        storeUser(userInfo);
      }
    } catch (error) {
      console.error('Failed to load admin info:', error);
    }
  };

  const setTokens = (accessToken: string, newRefreshToken: string) => {
    token.value = accessToken;
    storeToken(accessToken);
    setRefreshToken(newRefreshToken);
  };

  const refreshAccessToken = async (): Promise<string> => {
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }
    const resp = await apiRefreshToken(storedRefreshToken);
    if (resp?.accessToken) {
      setTokens(resp.accessToken, resp.refreshToken || storedRefreshToken);
      return resp.accessToken;
    }
    throw new Error('Token refresh failed');
  };

  const logout = async () => {
    try {
      if (token.value) {
        await apiLogout();
      }
    } finally {
      clearTokens();
      clearUser();
      token.value = null;
      user.value = null;
      const permissionStore = usePermissionStore();
      permissionStore.resetPermission();
    }
  };

  const initAuth = () => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken) {
      token.value = storedToken;
    }
    if (storedUser) {
      user.value = storedUser;
    }
    // 用本地存储的旧 user 先占位，再异步刷新真实 roles/permissions，
    // 兼容旧会话（早期登录未拉取权限，store 里 permissions 为空）。
    if (storedToken) {
      void loadUserInfo();
    }
  };

  return {
    token,
    user,
    isLoggedIn,
    login,
    logout,
    initAuth,
    setTokens,
    refreshAccessToken,
    loadUserInfo,
  };
});
