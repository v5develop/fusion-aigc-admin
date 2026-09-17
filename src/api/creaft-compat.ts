import { request } from '@/utils/request'

/**
 * creaft v1 兼容面的两类配置：能力绑定（含价目行）与数据驱动目录。
 *
 * 这两块原先只能直连 SQL 改。接口把三个约束挪到了服务端：结构列不可改、
 * 绑定与价目行必须一致、启用前要过装配自检。所以前端不需要（也不应该）
 * 自己拼一致性——照着 state 与 quotePreviewReady 展示即可。
 */

/**
 * 绑定准入状态。
 * - `READY` 已启用且可装配
 * - `DISABLED` 结构完整但停用中，用户提交不到这条能力
 * - `NOT_ASSEMBLABLE` 已启用但装配不起来，下次重启会失败，须尽快处理
 * - `DRIFT` 与冻结契约不一致（缺行/重复行/某列不符），只能改数据，不能改契约
 */
export type CreaftBindingState = 'READY' | 'DISABLED' | 'NOT_ASSEMBLABLE' | 'DRIFT'

export interface CreaftBindingRow {
  /** 为空表示库里没有这条路由的绑定行（DRIFT） */
  bindingId: number | null
  creaftV1Route: string
  displayName: string | null

  // 以下为冻结契约派生，只读
  entryCode: string | null
  capabilityCode: string | null
  capabilityVersion: string | null
  taskType: string | null
  billingPolicyKind: string | null
  /** FIXED / FREE_THEN_FIXED 的点数与免费额度写在这里 */
  billingPolicyJson: string | null
  modelSelectorType: string | null
  /** creaft v1 的执行池名，不是 Java 模型码 */
  modelSelectorValue: string | null

  // 点数覆盖：冻结策略里那两个数是运营可改的那一小块
  /** 只有 FIXED / FREE_THEN_FIXED 可覆盖；CATALOG_PRICE 的价钱在「定价管理」里配 */
  policyOverridable: boolean
  /** 为空表示没有覆盖，按冻结策略 */
  overrideFixedPoints: number | null
  overrideFreeQuota: number | null
  /** 实际生效值（有覆盖取覆盖值，否则取冻结值）。三个值都要显示，否则对不上账时无法自证 */
  effectiveFixedPoints: number | null
  effectiveFreeQuota: number | null
  overrideReason: string | null
  overrideBy: string | null
  overrideTime: string | null

  // 可配置
  modelCode: string | null
  billingFeatureCode: string | null
  billingActionType: string | null
  enabled: boolean | null

  // 价目行（服务端联动写入，前端只读展示）
  pricingCatalogId: number | null
  pricingCatalogCode: string | null
  pricingCatalogModelCode: string | null
  pricingCatalogEnabled: boolean | null

  state: CreaftBindingState
  stateReason: string | null
  /**
   * 价目接口（biz-points / *-model-configs）能否出数；与 state 是两条独立链路。
   * 点数写在冻结策略里的三种（NO_CHARGE / FIXED / FREE_THEN_FIXED）恒为 true —— 不需要运营配；
   * 只有 CATALOG_PRICE 依赖「模型 + 生效定价」。
   */
  quotePreviewReady: boolean
  quotePreviewReason: string | null
  /** 仅 CATALOG_PRICE 需要配模型与价格 */
  requiresModelBinding: boolean
}

export interface CreaftModelOption {
  modelId: number
  code: string
  name: string
  /** 缺它要去「权益/能力」里把模型挂到该计费能力上 */
  boundToFeature: boolean
  /** 缺它要去「定价管理」加一条生效定价 */
  hasActivePrice: boolean
  /** 两个前置条件都满足；选它启用一定能过装配自检 */
  selectable: boolean
}

export interface CreaftBindingConfigureData {
  /** 传空串表示清空 */
  modelCode?: string
  billingFeatureCode?: string
  billingActionType?: string
}

/**
 * 点数覆盖。
 *
 * 只有这两个数可覆盖：kind 是结构事实（决定要不要配模型、价目走哪条分支、准入查什么），
 * 运行期改它会让页面显示的判据与实扣脱节，所以后端不接收。
 */
export interface CreaftBindingPolicyOverrideData {
  /** 0 表示改成免费；这是一次显式的、留痕的决定 */
  fixedPoints: number
  /** 仅 FREE_THEN_FIXED 可填，其它策略传了会被拒 */
  freeQuota?: number | null
  /** 必填：改价会进账，没有理由事后无法复盘 */
  reason: string
}

export interface CreaftV1CapabilityRow {
  capabilityCode: string
  /** 计费权威是 afv_billing_offer 的同名 entry_code，不是 compat 绑定 */
  entryCode: string | null
  ready: boolean
  /** 缺什么，逐条列出；为空即就绪 */
  problems: string[]
}

export interface CreaftBindingOverview {
  /**
   * 执行面（app.internal-execution.enabled）是否开启。
   * 它决定 `NOT_ASSEMBLABLE` 的后果：关着时只是待办，开着时意味着下次重启起不来。
   */
  executionPlaneEnabled: boolean
  rows: CreaftBindingRow[]
  /**
   * v1 线协议能力（当前只有 media.cutout / 抠图）。
   * 它不在上面那 32 条冻结契约里，但计费同样要运营配 —— 缺配时抠图提交会被直接拒。
   */
  protocolV1Capabilities: CreaftV1CapabilityRow[]
}

export function getCreaftBindings() {
  return request.get<CreaftBindingOverview>('/api/v1/admin/creaft/bindings')
}

export function getCreaftBindingModelOptions(bindingId: number) {
  return request.get<CreaftModelOption[]>(`/api/v1/admin/creaft/bindings/${bindingId}/model-options`)
}

export function configureCreaftBinding(bindingId: number, data: CreaftBindingConfigureData) {
  return request.put(`/api/v1/admin/creaft/bindings/${bindingId}`, data)
}

/** 装配自检不通过时后端拒绝并说明缺什么，拦截器会提示原因 */
export function enableCreaftBinding(bindingId: number) {
  return request.post(`/api/v1/admin/creaft/bindings/${bindingId}/enable`)
}

export function disableCreaftBinding(bindingId: number) {
  return request.post(`/api/v1/admin/creaft/bindings/${bindingId}/disable`)
}

/** 覆盖冻结策略里的点数。写独立的覆盖列，不碰契约投影列；无缓存，即刻生效 */
export function saveCreaftBindingPolicyOverride(
  bindingId: number,
  data: CreaftBindingPolicyOverrideData
) {
  return request.put(`/api/v1/admin/creaft/bindings/${bindingId}/billing-policy-override`, data)
}

/** 清除覆盖，回到冻结策略 */
export function clearCreaftBindingPolicyOverride(bindingId: number) {
  return request.delete(`/api/v1/admin/creaft/bindings/${bindingId}/billing-policy-override`)
}

/**
 * 目录类型。一张表分四类，各自被不同接口读；
 * `AVG_DURATION` 无行时 `GET /api/v1/features/task-avg-duration/{taskType}` 对任何取值都回 4001。
 */
export type CreaftCatalogType = 'AVG_DURATION' | 'FEATURE' | 'MODEL_CONFIG' | 'BIZ_POINT'

export interface CreaftCatalogRow {
  id: number
  catalogType: CreaftCatalogType
  catalogKey: string
  category: string | null
  title: string | null
  modelType: number | null
  pointPrice: number | null
  avgSeconds: number | null
  payloadJson: string | null
  sortOrder: number | null
  /** 只有 1 会被下发接口读到 */
  status: number
  createTime?: string
  updateTime?: string
}

export interface CreaftCatalogSaveData {
  catalogType: CreaftCatalogType
  catalogKey: string
  category?: string
  title?: string
  modelType?: number | null
  pointPrice?: number | null
  avgSeconds?: number | null
  payloadJson?: string
  sortOrder?: number
  status?: number
}

export function getCreaftCatalog(params?: { catalogType?: string; catalogKey?: string }) {
  return request.get<CreaftCatalogRow[]>('/api/v1/admin/creaft/feature-catalog', { params })
}

export function createCreaftCatalog(data: CreaftCatalogSaveData) {
  return request.post<number>('/api/v1/admin/creaft/feature-catalog', data)
}

export function updateCreaftCatalog(id: number, data: CreaftCatalogSaveData) {
  return request.put(`/api/v1/admin/creaft/feature-catalog/${id}`, data)
}

export function deleteCreaftCatalog(id: number) {
  return request.delete(`/api/v1/admin/creaft/feature-catalog/${id}`)
}
