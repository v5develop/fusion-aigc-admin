import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getTwoFactorStatus } from '@/api/two-factor';

/**
 * 强制绑定弹窗的全局状态。
 *
 * 入口只有两个：登录后查一次 status（required=true 才打开），
 * 以及任意请求回 403 + 2FA_BIND_REQUIRED（拦截器调 requireBind）。
 * 开关关着时 required 恒为 false，弹窗永远不出现，也不会再查 status。
 */
export const useTwoFactorStore = defineStore('twoFactor', () => {
  const forceBindOpen = ref(false);

  const requireBind = () => {
    forceBindOpen.value = true;
  };

  const markBound = () => {
    forceBindOpen.value = false;
  };

  /** 登录后调用一次；查询失败不拦登录，真需要绑定时后续请求的 403 会再打开弹窗 */
  const checkAfterLogin = async () => {
    try {
      const status = await getTwoFactorStatus();
      if (status?.required) requireBind();
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  const reset = () => {
    forceBindOpen.value = false;
  };

  return { forceBindOpen, requireBind, markBound, checkAfterLogin, reset };
});
