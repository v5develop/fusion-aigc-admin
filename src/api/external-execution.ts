import { request } from '@/utils/request';

/**
 * 外部执行面（`afv_external_execution`，执行号 `exe_` 前缀）的管理入口。
 *
 * 为什么需要它：线上出现过五笔执行永久停在 `RUNNING` —— 执行方的终态回推没通、预占被超时
 * 回收（钱退了），但任务状态没人推到终态。而后台此前**只有创作任务有强制收口入口**，
 * 外部执行面一个界面都没有，收口只能定向改数据库。所以这个页面就是处置手段本身。
 */

/** 非终态才可被强制收口；终态集合见后端 `ExternalExecutionAdminService`。 */
export interface ExternalExecutionListItem {
  id: number;
  executionNo: string;
  userId?: number | null;
  capabilityCode?: string | null;
  featureCode?: string | null;
  providerSystem?: string | null;
  remoteExecutionId?: string | null;
  aggregateType?: string | null;
  aggregateId?: string | null;
  status: string;
  billingStatus?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  submittedTime?: string | null;
  finishedTime?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  /** 后端算出来的「这条能不能强制收口」。按钮显隐只看它，前端不自己判状态机 */
  forceable?: boolean | null;
  /** 交付取回失败、停在人工审核的执行可重新交付一次。后端下发，缺省按 false */
  canRedeliver?: boolean | null;
  /** 早先只存进私有桶、用户拿不到图的交付，可补发公开副本。后端下发，缺省按 false */
  canPublishPrivate?: boolean | null;
}

export interface ExternalExecutionDetail extends ExternalExecutionListItem {
  reservationNo?: string | null;
  executionOwner?: string | null;
  resultManifest?: string | null;
  externalStatus?: string | null;
  submitAttempts?: number | null;
  settlementAttempts?: number | null;
  nextRetryTime?: string | null;
  settledTime?: string | null;
  version?: number | null;
}

export interface BatchForceTerminalItem {
  executionNo: string;
  success: boolean;
  message?: string | null;
}

export interface BatchForceTerminalResult {
  total: number;
  success: number;
  failed: number;
  items: BatchForceTerminalItem[];
}

export interface ExecutionStatusCount {
  status: string;
  count: number;
}

export interface ExecutionProviderSummary {
  providerSystem: string;
  active: number;
  total24h: number;
  succeeded24h: number;
  abnormal24h: number;
}

export interface ExecutionStuckFinding {
  kind: string;
  tag: string;
  label: string;
  count: number;
  saturated: boolean;
  samples: string[];
  stuckMinutes?: number | null;
}

export interface ExecutionObservabilityOverview {
  health: 'HEALTHY' | 'DEGRADED' | 'DISABLED' | 'UNAVAILABLE';
  enabled: boolean;
  message?: string | null;
  generatedAt: string;
  totalExecutions: number;
  activeExecutions: number;
  total24h: number;
  succeeded24h: number;
  abnormal24h: number;
  successRate24h: number | null;
  statusCounts: ExecutionStatusCount[];
  providers: ExecutionProviderSummary[];
  /** 五类卡点可以重叠，所以这是卡点命中数，不是去重后的执行单数。 */
  totalStuck: number;
  stuckFindings: ExecutionStuckFinding[];
}

export interface ExecutionTimelineOutboxRow {
  eventId?: string | null;
  destination?: string | null;
  eventType?: string | null;
  status?: string | null;
  attempts?: number | null;
  lastErrorMessage?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface ExecutionTimelineInboxRow {
  eventId?: string | null;
  eventType?: string | null;
  eventSequence?: number | null;
  status?: string | null;
  callbackStatus?: string | null;
  attempts?: number | null;
  errorMessage?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface ExecutionTimelineDeliveryRow {
  artifactSlot?: number | null;
  stage?: string | null;
  settlementStatus?: string | null;
  assetId?: number | null;
  reviewReason?: string | null;
  objectKeyPresent?: boolean | null;
  publicUrlPresent?: boolean | null;
  watermarkUrlPresent?: boolean | null;
  updateTime?: string | null;
}

export interface ExecutionTimelineProbe {
  state: 'OK' | 'SKIPPED' | 'FAILED' | 'DISABLED';
  reason?: string | null;
  status?: string | null;
  sequence?: number | null;
  remoteExecutionId?: string | null;
  errorCode?: string | null;
  resultCount?: number | null;
}

export interface ExternalExecutionTimeline {
  ref: string;
  matchedBy: 'EXECUTION_NO' | 'AGGREGATE_ID';
  aggregateMatchCount: number;
  verdict: string;
  verdictSummary: string;
  verdictNextStep: string;
  generatedAt: string;
  execution: ExternalExecutionDetail & {
    executionDeadline?: string | null;
    lastEventSequence?: number | null;
    resultManifestPresent?: boolean | null;
  };
  outbox: ExecutionTimelineOutboxRow[];
  inbox: ExecutionTimelineInboxRow[];
  deliveries: ExecutionTimelineDeliveryRow[];
  agentTurn?: {
    status?: string | null;
    lastSequence?: number | null;
    providerCode?: string | null;
    updateTime?: string | null;
  } | null;
  agentEventStats?: {
    eventCount?: number | null;
    minSequence?: number | null;
    maxSequence?: number | null;
  } | null;
  agentEventTail?: {
    sequence?: number | null;
    eventType?: string | null;
    phase?: string | null;
    occurredAt?: string | null;
  } | null;
  reservation?: {
    reservationNo?: string | null;
    status?: string | null;
    pricePoints?: number | null;
    retryCount?: number | null;
    updateTime?: string | null;
  } | null;
  probe: ExecutionTimelineProbe;
}

/**
 * 可强制置入的终态。
 *
 * **刻意不含 `SUCCEEDED`**：真正的成功交付要走执行态推进的 afterCommit 钩子（转存产物、
 * 同步素材库），管理员手动改状态绕不过那条链路 —— 强行落 SUCCEEDED 只会得到
 * 「标记成功但没有任何产物」的行，比停在 RUNNING 更糟。
 */
export const FORCE_TERMINAL_STATUSES = [
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
  'MANUAL_REVIEW',
] as const;

export function getExternalExecutions(params?: {
  status?: string;
  executionNo?: string;
  providerSystem?: string;
  aggregateId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}) {
  // 后端信封是 PageResult：只有 list + total 两个字段（核对过 common/PageResult.java），
  // 不要指望它回 page/pageSize —— 页码是请求参数，不在响应里
  return request.get<{ list: ExternalExecutionListItem[]; total: number }>(
    '/api/v1/admin/external-executions',
    { params },
  );
}

export function getExternalExecutionDetail(executionNo: string) {
  return request.get<ExternalExecutionDetail>(`/api/v1/admin/external-executions/${executionNo}`);
}

/** 执行面驾驶舱：状态/执行方聚合 + 五类卡点，只读且刷新不会制造告警。 */
export function getExternalExecutionObservability() {
  return request.get<ExecutionObservabilityOverview>(
    '/api/v1/admin/external-executions/observability/overview',
  );
}

/** 单笔闭集诊断；probe=true 时会向 creaft_serv 查询权威运行态。 */
export function getExternalExecutionTimeline(ref: string, probe = true) {
  return request.get<ExternalExecutionTimeline>(
    `/api/v1/admin/external-executions/${encodeURIComponent(ref)}/timeline`,
    { params: { probe } },
  );
}

/** 原因必填：这是人工介入，审计里要留下为什么。 */
export function forceTerminalExternalExecution(
  executionNo: string,
  targetStatus: string,
  reason: string,
) {
  return request.post<boolean>(`/api/v1/admin/external-executions/${executionNo}/force-terminal`, {
    targetStatus,
    reason,
  });
}

/** 单次上限 200 条；每条独立事务，一条失败不影响其它，逐条结果在 items 里。 */
export function batchForceTerminalExternalExecutions(
  executionNos: string[],
  targetStatus: string,
  reason: string,
) {
  return request.post<BatchForceTerminalResult>(
    '/api/v1/admin/external-executions/batch-force-terminal',
    { executionNos, targetStatus, reason },
  );
}

export interface RedeliverResult {
  executionNo: string;
  slots: number[];
  stage: string;
  /** true 表示重新取回仍失败、又回到人工审核（如冻结的结果地址已取不到），应改走退款 */
  pendingReview: boolean;
}

export interface PublishPrivateResult {
  executionNo: string;
  publishedSlots: number[];
  resultUrl: string | null;
}

export interface BatchPublishPrivateResult {
  succeeded: PublishPrivateResult[];
  failed: { executionNo: string; reason: string }[];
}

/** 批量发布公开副本单次上限。 */
export const PUBLISH_PRIVATE_BATCH_LIMIT = 100;

/**
 * 重新交付：只对交付取回失败、停在人工审核的执行有效，重置后重新取回一次，不改计费。
 * 判据不满足时后端回 409，msg 里写明没过的那条判据（拦截器会直接弹出）。
 */
export function redeliverExternalExecution(executionNo: string, reason: string) {
  return request.post<RedeliverResult>(
    `/api/v1/admin/external-executions/${encodeURIComponent(executionNo)}/redeliver`,
    { reason },
  );
}

/** 发布公开副本：把只存进私有桶的产物补发一份公开地址，回写任务与素材；不改计费。 */
export function publishPrivateExternalExecution(executionNo: string, reason: string) {
  return request.post<PublishPrivateResult>(
    `/api/v1/admin/external-executions/${encodeURIComponent(executionNo)}/publish-private`,
    { reason },
  );
}

/** 批量发布公开副本，1..100 条；逐条结果分 succeeded / failed 返回。 */
export function batchPublishPrivateExternalExecutions(executionNos: string[], reason: string) {
  return request.post<BatchPublishPrivateResult>(
    '/api/v1/admin/external-executions/publish-private/batch',
    { executionNos, reason },
  );
}
