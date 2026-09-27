import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * AI 网关管理（通用透传）。
 *
 * Java 只把 `/api/v1/admin/ai-gateway/**` 原样转到网关 `/admin/v1/**`（加管理密钥签名与操作人
 * `X-Aig-Operator`），状态码与 JSON 体都原样返回，**不包 CommonResult**。所以这里：
 * - 用 `rawBody` 拿原始体；万一被包了 `{code, data}` 信封也照常解开；
 * - 错误体是 `{error: {code, check, message}}`，拦截器会把 `check`（判据）一起提示出来；
 * - 表单字段一律来自网关下发的 JSON Schema（`schemas/{resource}`、适配器 `params_schema`），
 *   网关新增配置项时前端与 Java 都不用改。这里的类型只声明页面实际要读的字段，其余原样透传。
 */

const BASE = '/api/v1/admin/ai-gateway';

type Flags = {
  rawBody?: boolean;
  silentError?: boolean;
  noRetry?: boolean;
  noErrorRedirect?: boolean;
};

function cfg(extra?: Flags & AxiosRequestConfig): AxiosRequestConfig {
  // 网关页面出错只在原地提示，不跳 /500：正在编辑的表单会丢
  return { rawBody: true, noErrorRedirect: true, ...extra } as AxiosRequestConfig;
}

/** 写操作不自动重传：发布、强制动作、写密钥都不是幂等的「再来一次无害」 */
function writeCfg(extra?: Flags & AxiosRequestConfig): AxiosRequestConfig {
  return cfg({ noRetry: true, ...extra });
}

function enc(code: string) {
  return encodeURIComponent(code);
}

/** 集合接口统一是 `{items: [...]}`；容忍直接回数组 */
function itemsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: T[] }).items;
  }
  return [];
}

// ---------------------------------------------------------------------------
// 通用
// ---------------------------------------------------------------------------

export type JsonSchema = Record<string, unknown>;

export interface AdminSchemaIndexItem {
  resource: string;
  title: string;
  /** 集合路径，如 `/admin/v1/deployments` */
  path: string;
}

export interface AdminResourceSchema {
  resource: string;
  schema: JsonSchema;
}

export interface AdapterCaps {
  kind: string;
  operations: string[];
  modes?: Record<string, string>;
  supports_client_token: boolean;
  lookup_authoritative: boolean;
  cancel_supported: boolean;
  balance_query: boolean;
  input_url_policies: string[];
  params_schema: JsonSchema;
  description?: string | null;
}

/** 网关管理资源（providers / accounts / deployments / model-groups / price-models …）的一条 */
export type GatewayResource = Record<string, unknown> & { code?: string };

export function listSchemas() {
  return request.get<unknown>(`${BASE}/schemas`, cfg()).then(itemsOf<AdminSchemaIndexItem>);
}

export function getSchema(resource: string) {
  return request.get<AdminResourceSchema>(`${BASE}/schemas/${enc(resource)}`, cfg());
}

export function listAdapters() {
  return request.get<unknown>(`${BASE}/adapters`, cfg()).then(itemsOf<AdapterCaps>);
}

/**
 * 集合路径换算：网关给的是 `/admin/v1/xxx`，透传前缀下是 `/xxx`。
 */
export function collectionPath(pathOrResource: string) {
  const p = pathOrResource.startsWith('/admin/v1')
    ? pathOrResource.slice('/admin/v1'.length)
    : pathOrResource;
  return p.startsWith('/') ? p : `/${p}`;
}

export function listResources(collection: string, params?: Record<string, unknown>) {
  return request
    .get<unknown>(`${BASE}${collectionPath(collection)}`, cfg({ params }))
    .then(itemsOf<GatewayResource>);
}

export function getResource(collection: string, code: string) {
  return request.get<GatewayResource>(`${BASE}${collectionPath(collection)}/${enc(code)}`, cfg());
}

/** upsert 进草稿；发布前不生效 */
export function putResource(collection: string, code: string, body: GatewayResource) {
  return request.put<GatewayResource>(
    `${BASE}${collectionPath(collection)}/${enc(code)}`,
    body,
    writeCfg(),
  );
}

export function deleteResource(collection: string, code: string) {
  return request.delete(`${BASE}${collectionPath(collection)}/${enc(code)}`, writeCfg());
}

// ---------------------------------------------------------------------------
// 密钥：只写，列表只有指纹
// ---------------------------------------------------------------------------

export interface SecretInfo {
  account_code: string;
  name: string;
  /** 明文 SHA-256 前 16 位，用于比对，不可还原 */
  fingerprint: string;
  master_key_id: string;
  updated_at: string;
  updated_by?: string | null;
}

export function listSecrets(accountCode: string) {
  return request
    .get<unknown>(`${BASE}/accounts/${enc(accountCode)}/secrets`, cfg())
    .then(itemsOf<SecretInfo>);
}

/** 立即生效（密钥不进配置快照），返回新指纹 */
export function putSecret(accountCode: string, name: string, value: string) {
  return request.put<SecretInfo>(
    `${BASE}/accounts/${enc(accountCode)}/secrets/${enc(name)}`,
    { value },
    writeCfg(),
  );
}

export function deleteSecret(accountCode: string, name: string) {
  return request.delete(`${BASE}/accounts/${enc(accountCode)}/secrets/${enc(name)}`, writeCfg());
}

// ---------------------------------------------------------------------------
// 配置：草稿 → 校验 → 发布 → 版本 / 回滚
// ---------------------------------------------------------------------------

export interface ConfigIssue {
  /** RFC 6901 位置，如 `/deployments/uu-gpt-image/price_model_code` */
  path: string;
  check: string;
  message: string;
}

export interface ConfigValidateResult {
  valid: boolean;
  draft_revision: number;
  errors?: ConfigIssue[];
  warnings?: ConfigIssue[];
}

export interface ConfigVersion {
  version: number;
  sha256: string;
  published_at: string;
  published_by: string;
  comment: string;
  current: boolean;
  rolled_back_from?: number | null;
}

export function validateConfig() {
  return request.post<ConfigValidateResult>(`${BASE}/config:validate`, {}, writeCfg());
}

/** draft_revision 必须等于当前草稿版本，否则 409（别人刚改过草稿） */
export function publishConfig(data: { draft_revision: number; comment: string }) {
  return request.post<ConfigVersion>(`${BASE}/config:publish`, data, writeCfg());
}

/** 把旧快照重新发布成一个新版本 */
export function rollbackConfig(data: { to_version: number; comment: string }) {
  return request.post<ConfigVersion>(`${BASE}/config:rollback`, data, writeCfg());
}

export function listConfigVersions(limit = 50) {
  return request
    .get<unknown>(`${BASE}/config/versions`, cfg({ params: { limit } }))
    .then(itemsOf<ConfigVersion>);
}

// ---------------------------------------------------------------------------
// 运行态：健康、熔断、容量、余额；强制动作与探测
// ---------------------------------------------------------------------------

export interface DeploymentRuntime {
  deployment_code: string;
  circuit: string;
  forced?: string;
  forced_until?: string | null;
  failure_ewma: number;
  sample_count: number;
  consecutive_failures: number;
  cooldown_until?: string | null;
  rate_limited_until?: string | null;
  probe_failed_until?: string | null;
  submitting: number;
  running: number;
  max_submitting?: number | null;
  max_running?: number | null;
  last_outcome?: string | null;
  last_error?: string | null;
  updated_at: string;
  [key: string]: unknown;
}

export interface AccountRuntime {
  account_code: string;
  running: number;
  max_running?: number | null;
  balance?: string | null;
  balance_currency?: string | null;
  balance_checked_at?: string | null;
  excluded_until?: string | null;
  exclusion_reason?: string | null;
  [key: string]: unknown;
}

export interface RuntimeSnapshot {
  deployments: DeploymentRuntime[];
  accounts: AccountRuntime[];
  captured_at: string;
}

export const FORCE_ACTIONS = [
  'force_open',
  'force_closed',
  'clear_force',
  'reset_cooldown',
  'recheck_balance',
  'clear_exclusion',
] as const;
export type ForceActionType = (typeof FORCE_ACTIONS)[number] | string;

export interface ForceAction {
  action: ForceActionType;
  reason: string;
  /** 仅 force_open / force_closed；不填 = 直到清除 */
  ttl_s?: number | null;
}

export function getRuntime() {
  return request.get<RuntimeSnapshot>(`${BASE}/runtime`, cfg());
}

export function forceDeployment(code: string, data: ForceAction) {
  return request.post<RuntimeSnapshot>(
    `${BASE}/runtime/deployments/${enc(code)}:force`,
    data,
    writeCfg(),
  );
}

export function forceAccount(code: string, data: ForceAction) {
  return request.post<RuntimeSnapshot>(
    `${BASE}/runtime/accounts/${enc(code)}:force`,
    data,
    writeCfg(),
  );
}

export interface ProbeResult {
  deployment_code: string;
  ok: boolean;
  latency_ms?: number | null;
  outcome_class?: string | null;
  check?: string | null;
  message?: string | null;
  probed_at: string;
}

/** auth / balance 不花钱；minimal_call 是一次真实计费调用 */
export function probeDeployment(deploymentCode: string, kind: 'auth' | 'balance' | 'minimal_call') {
  return request.post<ProbeResult>(
    `${BASE}/probes`,
    { deployment_code: deploymentCode, kind },
    writeCfg({ timeout: 120000 }),
  );
}

// ---------------------------------------------------------------------------
// 调用检索
// ---------------------------------------------------------------------------

export const CALL_STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELLED'];

export const OPERATIONS = [
  'chat.completion',
  'image.generate',
  'image.edit',
  'image.segment',
  'image.layer',
  'ocr.recognize',
  'video.generate',
  'video.enhance',
  'video.subtitle_erase',
  'asr.transcribe',
  'tts.synthesize',
  'moderation.text',
  'moderation.image',
];

export interface CallSummary {
  id: string;
  idempotency_key: string;
  caller_id: string;
  operation: string;
  model_group: string;
  status: string;
  attempt_count: number;
  last_deployment?: string | null;
  cost_amount_cny?: string | null;
  money_at_risk: boolean;
  labels?: Record<string, string>;
  created_at: string;
  completed_at?: string | null;
}

export interface CallSearchParams {
  status?: string;
  operation?: string;
  model_group?: string;
  deployment?: string;
  execution_ref?: string;
  idempotency_key?: string;
  money_at_risk?: boolean;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface AdminCallDetail {
  record: Record<string, unknown>;
  request: Record<string, unknown>;
  events?: Record<string, unknown>[];
}

function cleanParams(params: object) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export function searchCalls(params: CallSearchParams) {
  return request.get<CursorPage<CallSummary>>(
    `${BASE}/calls`,
    cfg({ params: cleanParams(params) }),
  );
}

export function getCall(callId: string) {
  return request.get<AdminCallDetail>(`${BASE}/calls/${enc(callId)}`, cfg());
}

// ---------------------------------------------------------------------------
// 告警（只暴露状态与事件，通知渠道由监控栈负责）
// ---------------------------------------------------------------------------

export interface GatewayAlert {
  id: number;
  type: string;
  scope: string;
  severity: string;
  status: string;
  message: string;
  count: number;
  first_at: string;
  last_at: string;
  resolved_at?: string | null;
}

export function listAlerts(params: { status?: string; cursor?: string; limit?: number }) {
  return request.get<CursorPage<GatewayAlert>>(
    `${BASE}/alerts`,
    cfg({ params: cleanParams(params) }),
  );
}

// ---------------------------------------------------------------------------
// 模型组选项（能力绑定的模型角色、音色模型、AI 模型的网关模型组）
// ---------------------------------------------------------------------------

export interface ModelGroupOption {
  code: string;
  display_name?: string;
  operations: string[];
  enabled?: boolean;
  description?: string | null;
}

let modelGroupCache: Promise<ModelGroupOption[]> | null = null;

/**
 * 已发布配置的模型组（`catalog/model-groups`）；透传没开这个口时回退到草稿列表 `model-groups`。
 * 缓存到页面刷新：一个页面多处下拉共用一次请求。失败不缓存。
 */
export function listModelGroupOptions(force = false): Promise<ModelGroupOption[]> {
  if (!modelGroupCache || force) {
    modelGroupCache = request
      .get<unknown>(`${BASE}/catalog/model-groups`, cfg({ silentError: true }))
      .then(itemsOf<ModelGroupOption>)
      .catch(() =>
        request
          .get<unknown>(`${BASE}/model-groups`, cfg({ silentError: true }))
          .then(itemsOf<ModelGroupOption>),
      )
      .catch((e) => {
        modelGroupCache = null;
        throw e;
      });
  }
  return modelGroupCache;
}

/** 下拉选项；operation 为空表示不过滤。停用的组置灰但仍列出（已绑定的值要能显示出来） */
export function toModelGroupSelectOptions(
  groups: ModelGroupOption[],
  operation?: string | string[],
) {
  const ops = operation ? (Array.isArray(operation) ? operation : [operation]) : [];
  return groups
    .filter((g) => !ops.length || (g.operations || []).some((op) => ops.includes(op)))
    .map((g) => ({
      label:
        g.display_name && g.display_name !== g.code ? `${g.code}（${g.display_name}）` : g.code,
      value: g.code,
      disabled: g.enabled === false,
    }));
}
