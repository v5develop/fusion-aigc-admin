// API Response Types

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageParams {
  pageNo: number
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

// C-End User Types
export interface User {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  avatar: string
  unionUserId: string | null
  isUnionBound: boolean
  status: number
  pointsBalance: number
  capabilities: UserCapability[]
  createTime: string
  updateTime: string
}

export interface UserCapability {
  id: number
  featureCode: string
  featureName: Record<string, string>
  expireTime: string
  grantTime: string
  status: number
}

export interface UserListParams extends ListParams {
  isUnionBound?: boolean
}

// Feature Types
export interface Feature {
  id: number
  featureCode: string
  featureName: Record<string, string>
  description: Record<string, string> | null
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
  totalGrant: number
  totalConsume: number
  totalRefund: number
  differenceAmount: number
  items: ReconciliationDailyItem[]
}

export interface ReconciliationDailyItem {
  date: string
  grantCount: number
  consumeCount: number
  refundCount: number
  grantAmount: number
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

// Model Cost Types
export interface ModelCost {
  id: number
  reservationNo: string
  taskId: string
  userId: number
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
export interface BillingException {
  id: number
  taskId: string
  reservationNo: string
  bizType: string
  billingStatus: string
  errorMsg: string
  userId: number
  username: string
  pricePoints: number
  status: string
  createTime: string
}

export interface BillingExceptionListParams extends PageParams {
  userId?: number
  bizType?: string
  billingStatus?: string
  status?: string
}
