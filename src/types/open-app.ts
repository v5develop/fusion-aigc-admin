/** 开放平台应用状态：0-待审核 1-已启用 2-已禁用 3-已拒绝 */
export type OpenAppStatus = 0 | 1 | 2 | 3

/** 开放平台应用（响应，绝不含 secret 明文） */
export interface OpenApp {
  id: number
  appId: string
  appName: string
  keyVersion: string
  status: OpenAppStatus
  /** JSON 字符串，如 ["billing","auth","asset"] */
  scopes?: string | null
  /** JSON 字符串，CIDR 列表 */
  ipWhitelist?: string | null
  signatureEnabled: number
  whitelistEnabled: number
  rateLimit: number
  callbackUrl?: string | null
  ownerTeamId?: number | null
  isBuiltin: number
  remark?: string | null
  approvedBy?: number | null
  approvedTime?: string | null
  createTime: string
}

/** 创建应用申请入参 */
export interface OpenAppCreateReq {
  appName: string
  ownerTeamId?: number
  scopes?: string[]
  ipWhitelist?: string[]
  callbackUrl?: string
  remark?: string
}

/** 审批 / 轮换返回的一次性明文密钥 */
export interface OpenAppSecretResp {
  appId: string
  appSecret: string
  keyVersion: string
}

/** 列表查询参数 */
export interface OpenAppListParams {
  appName?: string
  status?: OpenAppStatus
  page: number
  pageSize: number
}
