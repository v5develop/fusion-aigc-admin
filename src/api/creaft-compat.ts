import { request } from '@/utils/request';

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
 * - `NOT_ASSEMBLABLE` 已启用但配置不完整，仅对应能力不可用，不阻止服务启动
 * - `DRIFT` 与冻结契约不一致（缺行/重复行/某列不符），只能改数据，不能改契约
 */
export type CreaftBindingState = 'READY' | 'DISABLED' | 'NOT_ASSEMBLABLE' | 'DRIFT';

/** 两端共享数据库中的运营执行参数，处理器身份由程序维护。 */
export interface CreaftExecutionProfile {
  /** 只有 POOL 能力有池（按池查 provider）；其余能力自己挑 provider，这一列为 null */
  poolName: string | null;
  selectionPolicy: string;
  providerKeys: string[];
  stagingProfile: string;
  timeoutProfile: string;
}

/**
 * 执行目标怎么选，决定该显示哪些执行配置字段。
 *
 * 由后端按执行清单下发。不要按路由名自己判断——同一件事后端已经从三处删掉了写死的判据，
 * 前端再留一个（比如 `route === '/agent/stream'`）就是第四份。
 */
export type CreaftExecutionTargetMode =
  | 'POOL'
  | 'VARIANT'
  | 'SINGLE_PROVIDER'
  | 'JAVA_MODEL'
  | 'HANDLER_OWNED';

/**
 * 编辑执行配置时的可选值，与后端提交期校验同源（执行清单）。
 *
 * 此前这三张词表抄在本文件的常量数组里、池名与 provider 是自由文本框。那是第四份副本，
 * 也是唯一一份运营看得见的：抄漏一个值，运营只能在保存被拒之后才知道；provider 拼错
 * 一个字母更是要等到启动准入才有反馈。
 */
export interface CreaftExecutionOptions {
  selectionPolicies: string[];
  stagingProfiles: string[];
  timeoutProfiles: string[];
  /** 池名 -> 池里的 provider。POOL 能力的候选只能从所选池里挑 */
  pools: Record<string, string[]>;
  /** 视频别名能用的 provider */
  variantProviders: string[];
  textModels: string[];
}

export interface CreaftBindingRow {
  /** 为空表示库里没有这条路由的绑定行（DRIFT） */
  bindingId: number | null;
  creaftV1Route: string;
  displayName: string | null;

  // 以下为冻结契约派生，只读
  entryCode: string | null;
  capabilityCode: string | null;
  capabilityVersion: string | null;
  taskType: string | null;
  billingPolicyKind: string | null;

  /** FIXED / FREE_THEN_FIXED 可直接配置；其他策略由各自定价机制决定。 */
  policyEditable: boolean;
  fixedPoints: number | null;
  freeQuota: number | null;

  // 可配置
  modelId: number | null;
  /** 由 modelId 关联模型派生，仅用于展示。 */
  modelCode: string | null;
  executionProfile: CreaftExecutionProfile | null;
  /** 为空表示执行面没有实现这条能力 */
  executionTargetMode: CreaftExecutionTargetMode | null;
  /** SINGLE_PROVIDER 能力能选哪些 provider；其余方式为空（候选由所选池决定） */
  executionTargetOptions: string[];
  billingFeatureCode: string | null;
  billingActionType: string | null;
  enabled: boolean | null;

  // 价目行（服务端联动写入，前端只读展示）
  pricingCatalogId: number | null;
  pricingCatalogCode: string | null;
  pricingCatalogModelCode: string | null;
  pricingCatalogEnabled: boolean | null;

  state: CreaftBindingState;
  stateReason: string | null;
  /**
   * 价目接口（biz-points / *-model-configs）能否出数；与 state 是两条独立链路。
   * NO_CHARGE / FIXED / FREE_THEN_FIXED 使用策略字段；
   * 只有 CATALOG_PRICE 依赖「模型 + 生效定价」。
   */
  quotePreviewReady: boolean;
  quotePreviewReason: string | null;
  /** 是否需要关联模型；Agent 不因此要求计费与价格。 */
  requiresModelBinding: boolean;
}

export interface CreaftModelOption {
  modelId: number;
  code: string;
  name: string;
  /** 缺它要去「权益/能力」里把模型挂到该计费能力上 */
  boundToFeature: boolean;
  /** 缺它要去「定价管理」加一条生效定价 */
  hasActivePrice: boolean;
  /** 是否可选择；Agent 不要求计费绑定，完整启用校验仍由服务端执行。 */
  selectable: boolean;
}

export interface CreaftBindingConfigureData {
  modelId?: number;
  executionProfile?: CreaftExecutionProfile;
  billingFeatureCode?: string;
  billingActionType?: string;
}

/** 修改唯一的当前策略点数，原因写入审计记录。策略种类不在此修改。 */
export interface CreaftBindingPolicyData {
  /** 0 表示改成免费；这是一次显式的、留痕的决定 */
  fixedPoints: number;
  /** 仅 FREE_THEN_FIXED 可填，其它策略传了会被拒 */
  freeQuota?: number | null;
  /** 必填：改价会进账，没有理由事后无法复盘 */
  reason: string;
}

export interface CreaftV1CapabilityRow {
  capabilityCode: string;
  /** 计费权威是 afv_billing_offer 的同名 entry_code，不是 compat 绑定 */
  entryCode: string | null;
  ready: boolean;
  /** 缺什么，逐条列出；为空即就绪 */
  problems: string[];
}

export interface CreaftBindingOverview {
  /**
   * 执行面（app.internal-execution.enabled）是否开启。
   * 用于区分当前执行配置是否投入使用；普通配置缺失不阻止服务启动。
   */
  executionPlaneEnabled: boolean;
  executionOptions: CreaftExecutionOptions;
  rows: CreaftBindingRow[];
  /**
   * v1 线协议能力（当前只有 media.cutout / 抠图）。
   * 它属于独立协议，计费同样要运营配置，缺配时抠图提交会被直接拒。
   */
  protocolV1Capabilities: CreaftV1CapabilityRow[];
}

export function getCreaftBindings() {
  return request.get<CreaftBindingOverview>('/api/v1/admin/creaft/bindings');
}

export function getCreaftBindingModelOptions(bindingId: number) {
  return request.get<CreaftModelOption[]>(
    `/api/v1/admin/creaft/bindings/${bindingId}/model-options`,
  );
}

export function configureCreaftBinding(bindingId: number, data: CreaftBindingConfigureData) {
  return request.put(`/api/v1/admin/creaft/bindings/${bindingId}`, data);
}

/** 装配自检不通过时后端拒绝并说明缺什么，拦截器会提示原因 */
export function enableCreaftBinding(bindingId: number) {
  return request.post(`/api/v1/admin/creaft/bindings/${bindingId}/enable`);
}

export function disableCreaftBinding(bindingId: number) {
  return request.post(`/api/v1/admin/creaft/bindings/${bindingId}/disable`);
}

/** 更新共享表的当前策略点数并审计。 */
export function saveCreaftBindingPolicy(bindingId: number, data: CreaftBindingPolicyData) {
  return request.put(`/api/v1/admin/creaft/bindings/${bindingId}/billing-policy`, data);
}

/**
 * 目录类型。一张表分四类，各自被不同接口读；
 * `AVG_DURATION` 无行时 `GET /api/v1/features/task-avg-duration/{taskType}` 对任何取值都回 4001。
 */
export type CreaftCatalogType = 'AVG_DURATION' | 'FEATURE' | 'MODEL_CONFIG' | 'BIZ_POINT';

export interface CreaftCatalogRow {
  id: number;
  catalogType: CreaftCatalogType;
  catalogKey: string;
  category: string | null;
  title: string | null;
  modelType: number | null;
  pointPrice: number | null;
  avgSeconds: number | null;
  payloadJson: string | null;
  sortOrder: number | null;
  /** 只有 1 会被下发接口读到 */
  status: number;
  createTime?: string;
  updateTime?: string;
}

export interface CreaftCatalogSaveData {
  catalogType: CreaftCatalogType;
  catalogKey: string;
  category?: string;
  title?: string;
  modelType?: number | null;
  pointPrice?: number | null;
  avgSeconds?: number | null;
  payloadJson?: string;
  sortOrder?: number;
  status?: number;
}

export function getCreaftCatalog(params?: { catalogType?: string; catalogKey?: string }) {
  return request.get<CreaftCatalogRow[]>('/api/v1/admin/creaft/feature-catalog', { params });
}

export function createCreaftCatalog(data: CreaftCatalogSaveData) {
  return request.post<number>('/api/v1/admin/creaft/feature-catalog', data);
}

export function updateCreaftCatalog(id: number, data: CreaftCatalogSaveData) {
  return request.put(`/api/v1/admin/creaft/feature-catalog/${id}`, data);
}

export function deleteCreaftCatalog(id: number) {
  return request.delete(`/api/v1/admin/creaft/feature-catalog/${id}`);
}

/**
 * creaft v1 公共模板（创意广场 / 本地生活官方模板）。
 *
 * 这批数据原先只能直连 SQL 铺：`afv_compat_template` 建表在 V1.0.75，但没有任何管理入口，
 * 也没有任何迁移往里插过数据。表现是三条下发接口都正常回 200 + 空分页信封，
 * 调用方分不清「还没铺数据」和「接口没通」。
 */
export type CreaftTemplateType = 'PLAZA' | 'LOCAL_LIFE';

export interface CreaftTemplateRow {
  /** 即用户端回包里的 templateId */
  id: number;
  templateType: CreaftTemplateType;
  title: string;
  category: string | null;
  description: string | null;
  /** 已从库里的 {"tags": [...]} 取出，前端按数组用即可 */
  tags: string[];
  /** 模板载荷原文（JSON 对象文本）。用户端拿到的版本会摘掉 prompt */
  payloadJson: string | null;
  /** 升序：小的靠前（与 v1 的 weight 语义相反） */
  sortOrder: number | null;
  enabled: number | null;
  createTime?: string;
  updateTime?: string;
}

export interface CreaftTemplateSaveData {
  templateType: CreaftTemplateType;
  title: string;
  category?: string;
  description?: string;
  tags?: string[];
  payloadJson?: string;
  sortOrder?: number;
  enabled?: number;
}

export function getCreaftTemplates(params?: {
  templateType?: string;
  category?: string;
  keyword?: string;
  enabled?: number;
}) {
  return request.get<CreaftTemplateRow[]>('/api/v1/admin/creaft/templates', { params });
}

/** 已用过的分类，供下拉。本地生活的 category 要与品牌档案行业分类字面量一致，优先选、别手打 */
export function getCreaftTemplateCategories(templateType?: string) {
  return request.get<string[]>('/api/v1/admin/creaft/templates/categories', {
    params: { templateType },
  });
}

/** 已用过的标签，供下拉（不受用户端「只扫前 1000 条」的限制） */
export function getCreaftTemplateTags() {
  return request.get<string[]>('/api/v1/admin/creaft/templates/tags');
}

export function createCreaftTemplate(data: CreaftTemplateSaveData) {
  return request.post<number>('/api/v1/admin/creaft/templates', data);
}

/** 整体替换语义：没带上的值列会被清空 */
export function updateCreaftTemplate(id: number, data: CreaftTemplateSaveData) {
  return request.put(`/api/v1/admin/creaft/templates/${id}`, data);
}

export function deleteCreaftTemplate(id: number) {
  return request.delete(`/api/v1/admin/creaft/templates/${id}`);
}

/**
 * creaft v1 技能目录（`GET /api/v1/agent/skills` 的数据源）。
 *
 * 两条规则决定一条技能能不能被用户看到：`enabled = 1`，且 `category` 非空——
 * 空分类的行会被**整行跳过**，这就是「@技能弹窗为空」的原因（V1.0.112 的种子刻意不填分类）。
 * 没有新增/删除接口：agentSkillId 是与铺货侧共用的身份，凭空造一条等于造出上游不存在的技能。
 */
export interface CreaftAgentSkillRow {
  /** 表主键，编辑用（自增，安全范围内，仍是 number） */
  id: number;
  /**
   * 技能身份，与铺货侧同一个 int64，不可改。
   *
   * **字符串**：值来自 v1 的雪花 id（18~19 位），超过 JS 安全整数上限 2^53-1。
   * 后端刻意以字符串下发，前端也不要 Number() 它——转一次就丢末几位，而且不报错。
   */
  agentSkillId: string;
  agentSkillCode: string;
  title: string;
  description: string | null;
  icon: string | null;
  version: string | null;
  /** 分组键；为空则用户端看不到这一行 */
  category: string | null;
  weight: number | null;
  enabled: number | null;
  /** 用户端现在能不能看到（启用 且 有分类） */
  visible: boolean;
  /** 编码是否还是 skill_<id> 占位值（未与 v1 对齐） */
  placeholderCode: boolean;
}

export interface CreaftAgentSkillSummary {
  total: number;
  enabled: number;
  /** 启用但没有分类——不为 0 意味着用户端 @技能 列表不全 */
  uncategorised: number;
  placeholderCode: number;
}

/** 完整配置仅由单条详情返回，目录列表不包含 config。 */
export interface CreaftAgentSkillDetail extends CreaftAgentSkillRow {
  config: Record<string, unknown>;
}

export interface CreaftAgentSkillSaveData {
  /** 省略时保留原配置；显式传 {} 时清空。 */
  config?: Record<string, unknown>;
  category?: string;
  title?: string;
  description?: string;
  icon?: string;
  version?: string;
  weight?: number;
  enabled?: number;
  agentSkillCode?: string;
}

export function getCreaftAgentSkills(params?: {
  /** 传 __EMPTY__ 只看没分类的那批（NULL 与空串都算） */
  category?: string;
  keyword?: string;
  enabled?: number;
}) {
  return request.get<CreaftAgentSkillRow[]>('/api/v1/admin/creaft/agent-skills', { params });
}

export function getCreaftAgentSkillSummary() {
  return request.get<CreaftAgentSkillSummary>('/api/v1/admin/creaft/agent-skills/summary');
}

export function getCreaftAgentSkillDetail(id: number) {
  return request.get<CreaftAgentSkillDetail>(`/api/v1/admin/creaft/agent-skills/${id}`);
}

/** 整体替换语义：分类清空 = 这条技能从用户端消失 */
export function updateCreaftAgentSkill(id: number, data: CreaftAgentSkillSaveData) {
  return request.put(`/api/v1/admin/creaft/agent-skills/${id}`, data);
}
