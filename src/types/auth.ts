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
