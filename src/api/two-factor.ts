import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * 管理员两步验证（TOTP）。
 *
 * - 开关 `admin.two_factor.enabled` 默认关；关着时 status.required 恒为 false，后台不弹任何 2FA 提示。
 * - 开着且当前管理员未绑定时 required=true，必须绑定后才能继续用后台；
 *   其它接口此时回 HTTP 403 + 错误码 2FA_BIND_REQUIRED，由请求拦截器转成打开绑定弹窗。
 */
export interface TwoFactorStatus {
  /** 全站开关 admin.two_factor.enabled */
  enabled: boolean;
  /** 当前管理员是否已绑定 */
  bound: boolean;
  /** enabled && !bound：必须先绑定 */
  required: boolean;
}

export interface TwoFactorSetupResult {
  /** otpauth://totp/... 用于生成二维码 */
  otpauthUri: string;
  /** Base32 密钥，扫不了码时手动输入 */
  secret?: string;
}

/** 绑定流程里的错误（验证码错误等）由弹窗原地展示，不走全局 message */
const silent = { silentError: true, noErrorRedirect: true } as AxiosRequestConfig;

export function getTwoFactorStatus() {
  return request.get<TwoFactorStatus>('/api/v1/admin/auth/2fa/status', silent);
}

/**
 * 生成待绑定密钥。已绑定（换绑）时必须带当前验证码 currentCode，后端校验通过才生成新密钥；
 * 未绑定时不传。
 */
export function setupTwoFactor(currentCode?: string) {
  return request.post<TwoFactorSetupResult>(
    '/api/v1/admin/auth/2fa/setup',
    currentCode ? { currentCode } : {},
    silent,
  );
}

export function verifyTwoFactor(code: string) {
  return request.post<unknown>('/api/v1/admin/auth/2fa/verify', { code }, silent);
}

/** 超级管理员重置某管理员的验证器（清除绑定），该管理员下次登录需重新绑定；原因必填，后端记审计 */
export function resetTwoFactor(adminId: number, reason: string) {
  return request.post<unknown>('/api/v1/admin/auth/2fa/reset', { adminId, reason });
}

/** 系统设置「是否开启2FA」开关，沿用其它布尔开关的 GET/PUT ?enabled= 约定 */
export function getTwoFactorEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/two-factor');
}

export function setTwoFactorEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/two-factor', undefined, {
    params: { enabled },
  });
}
