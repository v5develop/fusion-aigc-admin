// API Response Types

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PageParams {
  page: number;
  pageSize: number;
  [key: string]: unknown;
}

export interface PageResult<T> {
  list: T[];
  total: number;
}

export interface ListParams extends PageParams {
  keyword?: string;
  startDate?: string;
  endDate?: string;
  status?: number;
  [key: string]: unknown;
}

// Admin User Types
export interface AdminUser {
  id: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  status: number;
  roleIds: number[];
  roles?: { id: number; roleCode: string; roleName: string }[];
  lastLoginTime?: string;
  lastLoginIp?: string;
  createTime: string;
}

export interface AdminUserListParams extends ListParams {}

// Admin Role Types
export interface AdminRole {
  id: number;
  roleCode: string;
  roleName: string;
  description: string;
  status: number;
  permissions: string[];
  createTime: string;
  updateTime: string;
}

export interface AdminRoleListParams extends ListParams {
  roleCode?: string;
  roleName?: string;
  status?: number;
}

// Admin Permission Types
export interface AdminPermission {
  id: number;
  permissionCode: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string;
  createTime: string;
  updateTime: string;
}

export interface AdminPermissionListParams extends ListParams {
  resource?: string;
  action?: string;
}

// Admin Resource Types
export interface AdminResource {
  id: number;
  resourceCode: string;
  resourceName: string;
  description?: string;
  sort: number;
  status: number;
  createTime: string;
  updateTime: string;
}

export interface AdminResourceListParams extends ListParams {
  resourceCode?: string;
  status?: number;
}

// C-End User Types
export interface User {
  id: number;
  username: string;
  nickname: string;
  email: string;
  phone: string;
  avatar: string;
  unionUserId: string | null;
  unionBound: number;
  status: number;
  balance: number;
  frozen: number;
  /** 是否已加入某账号池（有有效绑定行） */
  pooled?: boolean;
  /** 是否池主（余额/能力归属方） */
  poolMain?: boolean;
  /** 来源应用 appKey（绑定行来源，回退用户自身 source_app_key） */
  sourceAppKey?: string | null;
  /** 绑定来源：pool_bind / union_backfill；未绑定为 null */
  bindSource?: string | null;
  capabilities: UserFeature[];
  createTime: string;
  updateTime: string;
}

export interface UserFeature {
  id: number;
  featureCode: string;
  /** 来源类型，如 UNION / MANUAL */
  source?: string;
  sourceId?: string;
  /** 状态字符串：ACTIVE / EXPIRED / REVOKED */
  status: string;
  effectiveTime?: string;
  expireTime?: string;
  grantTime?: string;
}

/** 多应用账号池成员（绑定关系） */
export interface UserPoolMember {
  userId: number;
  nickname: string | null;
  /** 来源应用 appKey */
  appKey: string | null;
  /** 该成员在其应用内的外部用户 ID */
  externalUserId: string | null;
  unionUserId: string | null;
  /** 是否池主（余额/能力归属方） */
  main: boolean;
  /** 绑定来源：pool_bind / union_backfill */
  bindSource: string | null;
  balance: number;
  frozenBalance: number;
}

/** 用户多应用账号池（绑定关系） */
export interface UserPool {
  /** 用户池标识（= 池主 userId） */
  poolId: number;
  /** 是否已加入某账号池（false = 未绑定，仅自身单成员） */
  bound: boolean;
  members: UserPoolMember[];
}

export interface UserListParams extends ListParams {
  username?: string;
  unionBound?: number;
  startTime?: string;
  endTime?: string;
}

// Feature Types
export interface Feature {
  id: number;
  featureCode: string;
  featureName: Record<string, string>;
  description: Record<string, string> | null;
  actionType?: string;
  status: number;
  modelCount: number;
  createTime: string;
  updateTime: string;
}

export interface FeatureListParams extends ListParams {
  featureCode?: string;
  featureName?: string;
  actionType?: string;
  status?: number;
}

// AI Model Types
export interface AIModel {
  id: number;
  name: string;
  code: string;
  provider?: string;
  modelType: number;
  status: number;
  icon?: string;
  description: string;
  sort?: number;
  config?: string;
  maxConcurrency?: number;
  generationTimeoutSeconds?: number;
  defaultModel?: boolean;
  supportVision?: boolean;
  supportReasoning?: boolean;
  contextWindow?: number;
  apiConfigId?: number;
  aiProviderId?: number;
  /** AI 网关模型组编码（afv_ai_model.gateway_model_group）；有值时该模型经网关调用 */
  gatewayModelGroup?: string | null;
  createTime: string;
  updateTime: string;
}

export interface ModelListParams extends ListParams {
  name?: string;
  code?: string;
  modelType?: number;
  status?: number;
}

// Pricing Types
export interface ModelPricing {
  id: number;
  modelId: number;
  modelName?: string;
  modelCode?: string;
  actionType: string;
  pricePoints: number;
  priceUnit?: string;
  // 分辨率分档键：空表示通用档（后端 resolution IS NULL）
  resolution?: string;
  // 时长分档秒数：空表示通用档；PER_SECOND 每秒单价档一般留空，总价由内核按时长乘算
  durationSeconds?: number;
  effectiveTime?: string;
  expireTime?: string;
  status: number;
  createTime: string;
  updateTime?: string;
}

export interface PricingListParams extends ListParams {
  modelId?: number;
  /** 模型编码，精确匹配 */
  modelCode?: string;
  actionType?: string;
  /** 分档分辨率，如 1k / 2k / 4k，精确匹配 */
  resolution?: string;
  status?: number;
}

// Points Types
export interface PointsLog {
  id: number;
  userId: number;
  username: string;
  amount: number;
  balanceAfter: number;
  changeType: string;
  bizType: string;
  description: string;
  createTime: string;
}

export interface PointsLogParams extends PageParams {
  userId?: number;
  changeType?: string;
  bizType?: string;
  startTime?: string;
  endTime?: string;
}

// Consumption Types
export interface Consumption {
  id: number;
  userId: number;
  username: string;
  amount: number;
  balanceAfter: number;
  bizType: string;
  bizId: string;
  description: string;
  createTime: string;
}

export interface ConsumptionParams extends PageParams {
  userId?: number;
  bizKeyword?: string;
}

// Reconciliation Types
export interface ReconciliationSummary {
  totalRecharge: number;
  totalConsume: number;
  totalRefund: number;
  differenceAmount: number;
  items: ReconciliationDailyItem[];
}

export interface ReconciliationDailyItem {
  date: string;
  rechargeCount: number;
  consumeCount: number;
  refundCount: number;
  rechargeAmount: number;
  consumeAmount: number;
  refundAmount: number;
  difference: number;
}

export interface ReconciliationDifference {
  id: number;
  reconcileNo: string;
  differenceType: string;
  bizType: string;
  bizId: string;
  reservationNo: string;
  localPoints: number;
  remotePoints: number;
  amount: number;
  status: string;
  detail: string;
  createTime: string;
}

export interface ReconciliationMonthly {
  totalRecharge: number;
  totalConsume: number;
  totalDifference: number;
  items: ReconciliationMonthlyItem[];
}

export interface ReconciliationMonthlyItem {
  date: string;
  rechargeCount: number;
  consumeCount: number;
  rechargeAmount: number;
  consumeAmount: number;
  difference: number;
}

// Model Cost Types
export interface ModelCost {
  id: number;
  reservationNo: string;
  taskId: string;
  userId: number;
  username?: string;
  modelId: number;
  modelName?: string;
  pricingId: number;
  pointsConsumed: number;
  actualCostAmount: number;
  actualCostCurrency: string;
  costDetail: string;
  createTime: string;
}

// Cost Pricing Types
export interface ModelCostPricing {
  id: number;
  modelId: number;
  modelName?: string;
  modelCode?: string;
  meterType?: string;
  actionType?: string;
  costAmount?: number;
  costCurrency?: string;
  costUnit?: string;
  provider?: string;
  providerModel?: string;
  effectiveTime?: string;
  expireTime?: string;
  status: number;
  createTime?: string;
}

export interface CostPricingListParams extends ListParams {
  modelId?: number;
  meterType?: string;
  status?: number;
}

// Margin Types
export interface MarginSummary {
  rate?: string | null;
  paidPoints: number;
  revenueCny: number | string;
  costCny: number | string;
  marginCny: number | string;
  marginRate?: number | string | null;
}

export interface MarginByModel {
  modelId: number;
  modelName?: string;
  revenueCny: number | string;
  costCny: number | string;
  marginCny: number | string;
  marginRate: number | string;
}

export interface MarginTrendPoint {
  date: string;
  revenueCny: number | string;
  costCny: number | string;
  marginCny: number | string;
}

export interface MarginByReservation {
  reservationNo: string;
  rate?: string | null;
  paidPoints: number;
  revenueCny: number | string;
  costCny: number | string;
  marginCny: number | string;
  costLines: ModelCost[];
}

export interface MarginConfig {
  pointsToCostCnyRate?: string;
}

export interface ModelCostStats {
  todayCost: number;
  totalCount: number;
  costByModel: Record<string, number>;
  costBySource?: Record<string, number>;
}

// Billing Exception Types
export interface BillingExceptionTask {
  taskType: 'IMAGE' | 'VIDEO';
  taskId: string;
  reservationNo: string;
  userId: number;
  billingStatus: string;
  pricePoints: number;
  status: number;
  errorMsg: string;
  reviewReason: string;
  createTime: string;
  updateTime: string;
}

export interface AgedHeldReservation {
  reservationNo: string;
  userId: number;
  featureCode: string;
  modelId: number;
  pricePoints: number;
  bizType: string;
  bizId: string;
  status: string;
  taskStatus: number | null;
  classificationReason: string;
  expireTime: string;
  createTime: string;
}

export interface BillingExceptionListParams extends PageParams {
  taskType?: string;
  billingStatus?: string;
}

// Settings Types
export interface UnionConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  tokenUrl: string;
  callbackUrl: string;
  signatureEnabled?: boolean;
  whitelistEnabled?: boolean;
  whitelistIps?: string[];
  trustedProxies?: string[];
  offlineRequireTimestamp?: boolean;
}

/** @deprecated Use AiProvider */
export type ApiConfig = AiProvider;

export interface AiProvider {
  id?: number;
  name: string;
  platform: string;
  apiType?: number;
  apiUrl?: string;
  autoAppendV1Path?: boolean;
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
  apiKey?: string;
  appId?: string;
  appSecret?: string;
  modelId?: number;
  modelIds?: number[];
  status?: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface AiProviderPageParams {
  name?: string;
  platform?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

/** @deprecated 保留兼容别名 */
export type AIProviderConfig = AiProvider;

export type StorageConfigType = 'local' | 's3';
export type StoragePlatform = 'local' | 'aliyun_oss' | 'tencent_cos' | 'aws_s3' | 'minio' | 's3';

export interface StorageConfig {
  id?: number;
  name: string;
  type: StorageConfigType;
  endpoint?: string;
  bucketName?: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
  basePath?: string;
  customDomain?: string;
  stsRoleArn?: string;
  stsRegion?: string;
  isDefault?: boolean;
  status?: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SystemStorageConfig {
  privateEndpoint?: string;
  privateBucket?: string;
  privateAccessKey?: string;
  privateSecretKey?: string;
  privateRegion?: string;
  privateCustomDomain?: string;
  privateStsRoleArn?: string;
  privateStsRegion?: string;
  publicEndpoint?: string;
  publicBucket?: string;
  publicAccessKey?: string;
  publicSecretKey?: string;
  publicRegion?: string;
  publicCustomDomain?: string;
  publicStsRoleArn?: string;
  publicStsRegion?: string;
}

export interface SystemConfig {
  basic?: {
    siteName: string;
    siteLogo: string;
    defaultLanguage: string;
    defaultPoints: number;
    pointsExpireDays: number;
  };
  security?: {
    tokenExpireHours: number;
    maxLoginAttempts: number;
    lockDuration: number;
    enableCaptcha: boolean;
    enableIpWhitelist: boolean;
    ipWhitelist: string;
  };
  notification?: {
    lowPointsThreshold: number;
    enableExpireNotify: boolean;
    expireNotifyDays: number;
  };
  section?: string;
  siteName?: string;
  siteBaseUrl?: string;
  allowRegister?: string;
  defaultPoints?: string | number;
}

/**
 * 经验等级规则。加权分落在哪一档，以及那一档的排队优先级。
 *
 * 与免费/付费分层是**两件事**：分层管权利边界（水印），等级管排队快慢。
 */
export interface UserLevelRule {
  id?: number;
  /** LV0..LVn */
  levelCode: string;
  levelName: string;
  /** 达到本级所需的最低加权分（含）。LV0 必须为 0，否则没充过值的用户匹配不到任何档 */
  minScore: number;
  /** 生成排队优先级，越大越先出队 */
  queuePriority: number;
  sort?: number;
  enabled?: boolean;
  remark?: string | null;
  /** 只能由运营指定给用户、不参与打分匹配（如 creaft v1 的 Prime 企业合伙人档） */
  manualOnly?: boolean;
}

/** 按用户指定的等级：覆盖打分结果，到期或档位停用后回落到打分等级。 */
export interface UserLevelAssignment {
  id?: number;
  /** 字符串：18 位雪花号超过 JS 安全整数 */
  userId: string;
  levelCode: string;
  reason?: string | null;
  operator?: string | null;
  /** 为空表示长期有效 */
  expireTime?: string | null;
  updateTime?: string;
}

/** 等级总开关与加权系数。关闭后所有人同优先级，队列退回纯 FIFO。 */
export interface UserLevelSettings {
  enabled: boolean;
  /** JSON 字符串：{rechargeAmountWeight, paidMonthWeight, topPackageAmountWeight}，量纲为主单位 */
  weights?: string | null;
}

/**
 * 点数包（充值套餐）。
 *
 * priceAmount / basePoints / bonusPoints 都是**服务端权威值**：C 端下单只传 packageId，
 * 金额与点数一律以本行为准。在这里改价即改真实售价。
 */
export interface PointsPackage {
  id?: number;
  /** 对外稳定标识。删除后编码会被改写成「原编码#行id」，所以同一个编码可以反复重建 */
  packageCode: string;
  name: string;
  /** 售价，**最小货币单位（分）**，与订单 amount 同口径 */
  priceAmount: number;
  /** 基础点数（按售价换算所得） */
  basePoints: number;
  /** 赠送点数（活动加送，可为 0）。与基础点数分开存，商品卡才能分别展示 */
  bonusPoints?: number;
  /** 角标文案，如「最受欢迎」；为空则不展示角标 */
  badge?: string | null;
  /** 是否推荐档位（前端高亮），与角标相互独立 */
  recommended?: boolean;
  sort?: number;
  enabled?: boolean;
  /** 运营备注，不对 C 端暴露 */
  remark?: string | null;
  /** 划线价（分），v1 meta.original_price；必须高于售价，为空不展示 */
  originalPriceAmount?: number | null;
  /** 权益清单，v1 meta.feature */
  features?: string[];
  /** 到账点数有效天数（从支付成功起算），v1 duration；为空表示永不过期 */
  validDays?: number | null;
  /** 每人限购次数，v1 purchase_rule.limit；为空表示不限 */
  purchaseLimit?: number | null;
  /** 须先买过的档位编码，v1 purchase_rule.prerequisite；买过前置、未买满限购的用户才看得到这一档 */
  prerequisitePackageCodes?: string[];
}

/**
 * 后台列表返回的点数包，比提交体多两个**派生**字段。
 *
 * 档位的基础点数在保存时会与汇率对齐，但存量行不会跟着汇率变：改了后端的
 * `PAYMENT_POINTS_PER_YUAN` 之后，已有档位就地失配，且没有任何写操作会触发校验。
 * 所以列表把失配算出来给运营看，而不是等到有人下次编辑那个档位才被拒。
 */
export interface AdminPointsPackage extends PointsPackage {
  id: number;
  /** 基础 + 赠送 */
  totalPoints?: number;
  /** 当前汇率下该售价应对应的基础点数 */
  expectedBasePoints?: number;
  /** false = 汇率改过而此档位未同步，仍在按旧汇率卖点数 */
  rateConsistent?: boolean;
}

/** 每日签到规则。改这里等于改点数发放口径，会进审计日志。 */
export interface CheckInSettings {
  enabled?: boolean;
  /** 连签奖励梯度：下标=连签天数-1，超出长度后循环。例如 [10,10,10,10,10,10,60] */
  rewards?: number[];
  /** 赠送点数有效期天数，<=0 表示永不过期 */
  pointsValidDays?: number;
}

/** 站内通知（后台视角，含排期稿与已撤回） */
export interface AdminNotification {
  id: number;
  title: string;
  content: string;
  notificationType: string;
  /** ALL-全体公告 USER-定向通知 */
  targetScope: string;
  targetUserId?: number | null;
  publishTime?: string | null;
  expireTime?: string | null;
  status: number;
  publisherId?: number | null;
  createTime?: string;
}

export interface NotificationPublishParams {
  title: string;
  content: string;
  notificationType: string;
  /** ALL 时只写一行、不向用户扇出；USER 时必须给 targetUserId */
  targetScope: string;
  targetUserId?: number | null;
  /** 填未来时间即排期，未到时间用户端查不到 */
  publishTime?: string | null;
  /** 不传走系统默认有效期（notification.default_valid_days，配为 0 则长期有效） */
  expireTime?: string | null;
}

export interface NotificationQueryParams extends PageParams {
  notificationType?: string;
  targetScope?: string;
  status?: number;
  keyword?: string;
}

/** Agent 模型档位绑定（提示词优化按是否带图自动路由 TEXT/VISION 档；与用户权限角色无关） */
export interface AgentModelProfile {
  /** 档位标识：TEXT-纯文本 VISION-视觉 */
  profile: string;
  /** 绑定的模型 ID（关联 afv_ai_model.id），null=未绑定走 yaml 兜底 */
  modelId: number | null;
  /** 模型名称（只读展示） */
  modelName?: string | null;
  /** 模型标识 code（只读展示） */
  modelCode?: string | null;
  /** 是否支持视觉（只读展示） */
  supportVision?: boolean | null;
  /** 状态：1-启用 0-停用 */
  status?: number | null;
}

/** 前端「AI 帮写」专用提示词优化模型（独立一档，与管线内部自动优化解耦） */
export interface AiWritingModel {
  /** 绑定的模型 ID（afv_ai_model.id），null=未配置，回退默认档位路由 */
  modelId: number | null;
  /** 模型名称（只读展示） */
  modelName?: string | null;
  /** 模型标识 code（只读展示） */
  modelCode?: string | null;
  /** 是否支持视觉（只读展示） */
  supportVision?: boolean | null;
}

/** AI语音合成模型配置，供所有需要配音的业务共用 */
export interface AiTtsModel {
  /** AI语音合成模型 ID（afv_ai_model.id），null=未配置 */
  modelId: number | null;
  /** 模型名称（只读展示） */
  modelName?: string | null;
  /** 模型标识 code（只读展示） */
  modelCode?: string | null;
}

// Feature Grant Types
export interface FeatureGrant {
  id: number;
  userId: number;
  username: string;
  featureName: Record<string, string>;
  source: string;
  effectiveTime: string;
  expireTime: string;
  status: number;
}

export interface FeatureChangeLog {
  id: number;
  userId: number;
  username: string;
  featureCode: string;
  featureName: Record<string, string>;
  changeType: string;
  source: string;
  remark: string;
  createTime: string;
}

// Consumption Stats Types
export interface ConsumptionStats {
  todayConsumption: number;
  monthConsumption: number;
  todayThirdPartyCost: number;
}

// Points Adjust Types
export interface PointsAdjustParams {
  userId: number;
  adjustType: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
  /**
   * 发放来源标记。留空=ADMIN_ADJUST（存量行为）。
   *
   * 填 REGISTER_GIFT / CAMPAIGN_GIFT / ADMIN_GIFT 时这批点数会被识别为**赠送额度**，
   * 免费/付费分层据此判断用户有没有真正付过钱。
   * 后端**拒绝付费来源**（RECHARGE 等）——发放与收款必须是两件事。
   */
  grantSource?: string;
}

// Compensation Types
export interface CompensationParams {
  actionType: 'RETRY' | 'IGNORE' | 'REFUND';
  reservationNo: string;
  requestId: string;
  reason: string;
}

// Action Type Types
export interface ActionType {
  id: number;
  actionCode: string;
  actionName: string;
  description?: string;
  sortOrder?: number;
  status: number;
  createTime: string;
  updateTime?: string;
}

export interface ActionTypeListParams extends PageParams {
  status?: number;
}
