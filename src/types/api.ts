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
  items: T[]
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
  nickname: string
  email: string
  phone: string
  status: number
  roleIds: number[]
  roles?: string[]
  createTime: string
  updateTime: string
}

export interface AdminUserListParams extends ListParams {}

// Admin Role Types
export interface AdminRole {
  id: number
  name: string
  code: string
  description: string
  status: number
  permissions: string[]
  createTime: string
  updateTime: string
}

export interface AdminRoleListParams extends ListParams {}

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
  modelCode: string
  modelName: string
  provider: string
  modelType: string
  status: number
  description: string
  createTime: string
  updateTime: string
}

export interface ModelListParams extends ListParams {
  provider?: string
  modelType?: string
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
  modelName?: string
  actionType?: string
  status?: number
}

// Points Types
export interface PointsLog {
  id: number
  userId: number
  username: string
  amount: number
  balance: number
  type: string
  source: string
  reason: string
  createTime: string
}

export interface PointsLogParams extends ListParams {
  userId?: number
  type?: string
  source?: string
}

// Consumption Types
export interface Consumption {
  id: number
  userId: number
  username: string
  featureCode: string
  featureName: Record<string, string>
  modelCode: string
  spec?: string
  inputTokens: number
  outputTokens: number
  pointsCost: number
  thirdPartyCost?: number
  reservationNo: string
  billingStatus: string
  status: number
  createTime: string
}

export interface ConsumptionParams extends ListParams {
  userId?: number
  featureCode?: string
  billingStatus?: string
  status?: number
}

// Reconciliation Types
export interface ReconciliationSummary {
  totalGrant: number
  totalConsume: number
  totalRefund: number
  differenceAmount: number
  period: string
  items: ReconciliationItem[]
}

export interface ReconciliationItem {
  date: string
  grantCount: number
  consumeCount: number
  refundCount: number
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
