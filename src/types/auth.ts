// Authentication Types

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  adminId: number;
  username: string;
  roleCode: string;
  user?: AdminInfo;
  /** 已开启并绑定两步验证：密码正确但还要验证码，此时不下发 token，只给 pendingToken */
  requires2fa?: boolean;
  /** 第二步 /auth/login/2fa 用的短期凭证 */
  pendingToken?: string;
}

export interface AdminInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  roles: string[];
  permissions: string[];
}

export type UserInfo = AdminInfo;
