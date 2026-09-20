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
