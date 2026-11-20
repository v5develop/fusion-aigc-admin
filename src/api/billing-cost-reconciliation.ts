import type { PageResult } from '@/types/api';
import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

const BASE = '/api/v1/admin/billing/cost-reconciliation';

/** 判据级别：ERROR 需处置、WARN 需关注、INFO 仅汇总（不出明细） */
export type CostReconLevel = 'ERROR' | 'WARN' | 'INFO';

/** 已知判据编码；后端新增判据时页面按 level 兜底展示 */
export type CostReconCheck =
  | 'recon.cost_refunded'
  | 'recon.cost_no_charge'
  | 'recon.cost_unkeyed'
  | 'recon.cost_over_revenue'
  | 'recon.cost_overhead'
  | 'recon.cost_free';

export interface CostReconDaily {
  date: string;
  check: string;
  checkLabel: string;
  level: CostReconLevel | null;
  source: string;
  orderCount: number;
  costCny: number;
  chargedPoints: number;
  revenueCny: number;
  sampleBizNos: string[];
  generatedAt: string;
}

export interface CostReconDetail {
  id: number;
  date: string;
  check: string;
  checkLabel: string;
  level: CostReconLevel | null;
  source: string;
  bizNo: string | null;
  callerId: string | null;
  callId: string | null;
  attemptId: number | null;
  attemptCount: number | null;
  idempotencyKey: string | null;
  modelGroup: string | null;
  costCny: number;
  reservationNo: string | null;
  reservationStatus: string | null;
  chargedPoints: number | null;
  revenueCny: number | null;
  generatedAt: string;
}

export interface CostReconDetailQuery {
  date: string;
  check?: string;
  source?: string;
  bizNo?: string;
  page: number;
  pageSize: number;
}

export interface CostReconRunResult {
  date: string;
  costRows: number;
  summaryRows: number;
  details: number;
}

/** 日汇总（日期 × 判据 × 来源）；不传日期时后端取最近 7 天，跨度最长 92 天 */
export function getCostReconDaily(params: { from?: string; to?: string }) {
  return request.get<CostReconDaily[]>(`${BASE}/daily`, { params });
}

/** 某日某判据明细，按成本降序分页（pageSize ≤ 200） */
export function getCostReconDetails(params: CostReconDetailQuery) {
  return request.get<PageResult<CostReconDetail>>(`${BASE}/details`, { params });
}

/**
 * 手动重跑某日对账（只能是昨天及以前）。静默错误交给页面处理：
 * 409 = 对账正在进行（定时任务或他人正在跑），需友好提示而不是通用报错。
 */
export function runCostRecon(date: string) {
  return request.post<CostReconRunResult>(`${BASE}/run`, undefined, {
    params: { date },
    silentError: true,
    noRetry: true,
    noErrorRedirect: true,
  } as AxiosRequestConfig);
}
