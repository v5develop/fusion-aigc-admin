// API Response Types

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageParams {
  page: number
  pageSize: number
  [key: string]: unknown
}

export interface PageResult<T> {
  list: T[]
  total: number
}

export interface ListParams extends PageParams {
  keyword?: string
  startDate?: string
  endDate?: string
  status?: number
  [key: string]: unknown
}

// Admin User Types
export interface AdminUser {
  id: number
  username: string
  realName: string
  email: string
  phone: string
  status: number
  roleIds: number[]
  roles?: { id: number; roleCode: string; roleName: string }[]
  lastLoginTime?: string
  lastLoginIp?: string
  createTime: string
}

export interface AdminUserListParams extends ListParams {}

// Admin Role Types
export interface AdminRole {
  id: number
  roleCode: string
  roleName: string
  description: string
  status: number
  permissions: string[]
  createTime: string
  updateTime: string
}

export interface AdminRoleListParams extends ListParams {
  roleCode?: string
  roleName?: string
  status?: number
}

// Admin Permission Types
export interface AdminPermission {
  id: number
  permissionCode: string
  permissionName: string
  resource: string
  action: string
  description?: string
  createTime: string
  updateTime: string
}

export interface AdminPermissionListParams extends ListParams {
  resource?: string
  action?: string
}

// Admin Resource Types
export interface AdminResource {
  id: number
  resourceCode: string
  resourceName: string
  description?: string
  sort: number
  status: number
  createTime: string
  updateTime: string
}

export interface AdminResourceListParams extends ListParams {
  resourceCode?: string
  status?: number
}

// C-End User Types
export interface User {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  avatar: string
  unionUserId: string | null
  unionBound: number
  status: number
  balance: number
  frozen: number
  capabilities: UserFeature[]
  createTime: string
  updateTime: string
}

export interface UserFeature {
  id: number
  featureCode: string
  /** 来源类型，如 UNION / MANUAL */
  source?: string
  sourceId?: string
  /** 状态字符串：ACTIVE / EXPIRED / REVOKED */
  status: string
  effectiveTime?: string
  expireTime?: string
  grantTime?: string
}

export interface UserListParams extends ListParams {
  unionBound?: number
}

// Feature Types
export interface Feature {
  id: number
  featureCode: string
  featureName: Record<string, string>
  description: Record<string, string> | null
  actionType?: string
  status: number
  modelCount: number
  createTime: string
  updateTime: string
}

export interface FeatureListParams extends ListParams {}

// AI Model Types
export interface AIModel {
  id: number
  name: string
  code: string
  provider?: string
  modelType: number
  status: number
  icon?: string
  description: string
  sort?: number
  config?: string
  maxConcurrency?: number
  defaultModel?: boolean
  supportVision?: boolean
  supportReasoning?: boolean
  contextWindow?: number
  apiConfigId?: number
  aiProviderId?: number
  createTime: string
  updateTime: string
}

export interface ModelListParams extends ListParams {
  name?: string
  code?: string
  modelType?: number
  status?: number
}

// Pricing Types
export interface ModelPricing {
  id: number
  modelId: number
  modelName?: string
  modelCode?: string
  actionType: string
  pricePoints: number
  priceUnit?: string
  effectiveTime?: string
  expireTime?: string
  status: number
  createTime: string
  updateTime?: string
}

export interface PricingListParams extends ListParams {
  modelId?: number
  actionType?: string
  status?: number
}

// Points Types
export interface PointsLog {
  id: number
  userId: number
  username: string
  amount: number
  balanceAfter: number
  changeType: string
  bizType: string
  description: string
  createTime: string
}

export interface PointsLogParams extends PageParams {
  userId?: number
  changeType?: string
  startTime?: string
  endTime?: string
}

// Consumption Types
export interface Consumption {
  id: number
  userId: number
  username: string
  amount: number
  balanceAfter: number
  bizType: string
  bizId: string
  description: string
  createTime: string
}

export interface ConsumptionParams extends PageParams {
  userId?: number
  bizKeyword?: string
}

// Reconciliation Types
export interface ReconciliationSummary {
  totalRecharge: number
  totalConsume: number
  totalRefund: number
  differenceAmount: number
  items: ReconciliationDailyItem[]
}

export interface ReconciliationDailyItem {
  date: string
  rechargeCount: number
  consumeCount: number
  refundCount: number
  rechargeAmount: number
  consumeAmount: number
  refundAmount: number
  difference: number
}

export interface ReconciliationDifference {
  id: number
  reconcileNo: string
  differenceType: string
  bizType: string
  bizId: string
  reservationNo: string
  localPoints: number
  remotePoints: number
  amount: number
  status: string
  detail: string
  createTime: string
}

export interface ReconciliationMonthly {
  totalRecharge: number
  totalConsume: number
  totalDifference: number
  items: ReconciliationMonthlyItem[]
}

export interface ReconciliationMonthlyItem {
  date: string
  rechargeCount: number
  consumeCount: number
  rechargeAmount: number
  consumeAmount: number
  difference: number
}

// Model Cost Types
export interface ModelCost {
  id: number
  reservationNo: string
  taskId: string
  userId: number
  username?: string
  modelId: number
  pricingId: number
  pointsConsumed: number
  actualCostAmount: number
  actualCostCurrency: string
  costDetail: string
  createTime: string
}

export interface ModelCostStats {
  todayCost: number
  totalCount: number
  costByModel: Record<string, number>
}

// Billing Exception Types
export interface BillingExceptionTask {
  taskType: 'IMAGE' | 'VIDEO'
  taskId: string
  reservationNo: string
  userId: number
  billingStatus: string
  pricePoints: number
  status: number
  errorMsg: string
  createTime: string
  updateTime: string
}

export interface AgedHeldReservation {
  reservationNo: string
  userId: number
  featureCode: string
  modelId: number
  pricePoints: number
  bizType: string
  bizId: string
  status: string
  expireTime: string
  createTime: string
}

export interface BillingExceptionListParams extends PageParams {
  taskType?: string
  billingStatus?: string
}

// Settings Types
export interface UnionConfig {
  baseUrl: string
  appKey: string
  appSecret: string
  tokenUrl: string
  callbackUrl: string
  signatureEnabled?: boolean
  whitelistEnabled?: boolean
  whitelistIps?: string[]
  trustedProxies?: string[]
  offlineRequireTimestamp?: boolean
}

/** @deprecated Use AiProvider */
export type ApiConfig = AiProvider

export interface AiProvider {
  id?: number
  name: string
  platform: string
  apiType?: number
  apiUrl?: string
  autoAppendV1Path?: boolean
  proxyType?: string
  proxyHost?: string
  proxyPort?: number
  proxyUsername?: string
  proxyPassword?: string
  apiKey?: string
  appId?: string
  appSecret?: string
  modelId?: number
  modelIds?: number[]
  status?: number
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface AiProviderPageParams {
  name?: string
  platform?: string
  status?: number
  page?: number
  pageSize?: number
}

/** @deprecated 保留兼容别名 */
export type AIProviderConfig = AiProvider

export type StorageConfigType = 'local' | 's3'
export type StoragePlatform = 'local' | 'aliyun_oss' | 'tencent_cos' | 'aws_s3' | 'minio' | 's3'

export interface StorageConfig {
  id?: number
  name: string
  type: StorageConfigType
  endpoint?: string
  bucketName?: string
  accessKey?: string
  secretKey?: string
  region?: string
  basePath?: string
  customDomain?: string
  stsRoleArn?: string
  stsRegion?: string
  isDefault?: boolean
  status?: number
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface SystemStorageConfig {
  privateEndpoint?: string
  privateBucket?: string
  privateAccessKey?: string
  privateSecretKey?: string
  privateRegion?: string
  privateCustomDomain?: string
  privateStsRoleArn?: string
  privateStsRegion?: string
  publicEndpoint?: string
  publicBucket?: string
  publicAccessKey?: string
  publicSecretKey?: string
  publicRegion?: string
  publicCustomDomain?: string
  publicStsRoleArn?: string
  publicStsRegion?: string
}

export interface SystemConfig {
  basic?: {
    siteName: string
    siteLogo: string
    defaultLanguage: string
    defaultPoints: number
    pointsExpireDays: number
  }
  security?: {
    tokenExpireHours: number
    maxLoginAttempts: number
    lockDuration: number
    enableCaptcha: boolean
    enableIpWhitelist: boolean
    ipWhitelist: string
  }
  notification?: {
    lowPointsThreshold: number
    enableExpireNotify: boolean
    expireNotifyDays: number
  }
  section?: string
  siteName?: string
  siteBaseUrl?: string
  allowRegister?: string
  defaultPoints?: string | number
}

/** Agent 模型配置（用于提示词优化等后端 Agent 场景） */
export interface AgentModelConfig {
  /** Agent 模型 ID（关联 afv_ai_model.id），未配置时为 null */
  modelId: number | null
  /** 模型名称（只读展示） */
  modelName?: string | null
  /** 模型标识 code（只读展示） */
  modelCode?: string | null
  /** 是否支持视觉（只读展示） */
  supportVision?: boolean | null
}

// Feature Grant Types
export interface FeatureGrant {
  id: number
  userId: number
  username: string
  featureName: Record<string, string>
  source: string
  effectiveTime: string
  expireTime: string
  status: number
}

export interface FeatureChangeLog {
  id: number
  userId: number
  username: string
  featureCode: string
  featureName: Record<string, string>
  changeType: string
  source: string
  remark: string
  createTime: string
}

// Consumption Stats Types
export interface ConsumptionStats {
  todayConsumption: number
  monthConsumption: number
  todayThirdPartyCost: number
}

// Points Adjust Types
export interface PointsAdjustParams {
  userId: number
  adjustType: string
  amount: number
  reason: string
  idempotencyKey?: string
}

// Compensation Types
export interface CompensationParams {
  actionType: 'RETRY' | 'IGNORE' | 'REFUND'
  reservationNo: string
  requestId?: string
  reason?: string
}

// Action Type Types
export interface ActionType {
  id: number
  actionCode: string
  actionName: string
  description?: string
  sortOrder?: number
  status: number
  createTime: string
  updateTime?: string
}

export interface ActionTypeListParams extends PageParams {
  status?: number
}
