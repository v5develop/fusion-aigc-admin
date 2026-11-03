import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import {
  getStoredToken,
  storeToken,
  getStoredUser,
  storeUser,
  clearUser,
  loginWithPassword,
  loginWithTwoFactor,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  getAdminInfo,
  type LoginResult,
  type UserInfo,
} from '@/api/auth';
import { usePermissionStore } from '@/stores/permission';
import { useTwoFactorStore } from '@/stores/two-factor';
import { setRefreshToken, getRefreshToken, clearTokens } from '@/utils/storage';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const user = ref<UserInfo | null>(getStoredUser());
  const isLoggedIn = computed(() => !!token.value);

  /**
   * 密码登录。已绑定两步验证（且本设备未被记住）时后端回 requires2fa + pendingToken，
   * 此时不落 token，返回 pendingToken 交给登录页走第二步 loginTwoFactor。
   */
  const login = async (
    username: string,
    password: string,
  ): Promise<{ pendingToken: string } | void> => {
    const resp = await loginWithPassword(username, password);
    if (resp?.requires2fa) {
      if (!resp.pendingToken) throw new Error('Login failed');
      return { pendingToken: resp.pendingToken };
    }
    await applyLoginResult(resp);
  };

  /** 登录第二步：验证码通过后与密码登录一样落 token、拉权限 */
  const loginTwoFactor = async (
    pendingToken: string,
    code: string,
    rememberDevice: boolean,
  ): Promise<void> => {
    const resp = await loginWithTwoFactor(pendingToken, code, rememberDevice);
    await applyLoginResult(resp);
  };

  const applyLoginResult = async (resp: LoginResult | undefined): Promise<void> => {
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
      // 2FA 开关开着且未绑定时打开强制绑定弹窗；开关关着时 required=false，什么都不发生
      void useTwoFactorStore().checkAfterLogin();
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
      useTwoFactorStore().reset();
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
    loginTwoFactor,
    logout,
    initAuth,
    setTokens,
    refreshAccessToken,
    loadUserInfo,
  };
});
