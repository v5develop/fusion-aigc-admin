import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * 链路耗时：类型与接口集中在这里（后端契约变动只改此文件）。
 * 类别码见 components/LatencySummary/categories.ts；未知类别一律按 other 兜底。
 */

export interface LatencyBreakdownItem {
  category: string;
  label?: string;
  ms: number;
  pct: number;
}

export interface LatencySlowSpan {
  spanId: string;
  key?: string;
  label?: string;
  category: string;
  selfMs: number;
  durationMs: number;
}

/** /spans 响应里的 summary；旧后端没有该字段 */
export interface TaskLatencySummary {
  submittedAt: string | number | null;
  deliveredAt: string | number | null;
  totalMs: number | null;
  firstResultMs: number | null;
  breakdown: LatencyBreakdownItem[];
  criticalPath: string[];
  slowest: LatencySlowSpan[];
}

export interface Percentiles {
  p50: number;
  p90: number;
  p99: number;
  avg: number;
}

export interface LatencyCategoryStat extends Percentiles {
  category: string;
  label?: string;
  sharePct: number;
}

export interface LatencyGroupStat {
  key: string;
  label?: string;
  sampleCount: number;
  total: Percentiles;
  categories: Record<string, { p50: number; p90: number }>;
  dominantCategory: string;
}

export type LatencyGroupBy = 'day' | 'entry' | 'model' | 'provider' | 'deployment';

export interface LatencyFilters {
  /** 'YYYY-MM-DD HH:mm:ss' */
  from?: string;
  to?: string;
  entryCode?: string;
  modelCode?: string;
  provider?: string;
  status?: number | string;
}

export interface LatencyStatsQuery extends LatencyFilters {
  groupBy?: LatencyGroupBy;
}

export interface LatencyStats {
  sampleCount: number;
  truncated?: boolean;
  /** 耗时无法完整计算、已按总耗时计入的任务数 */
  degradedCount?: number;
  /** 网关数据暂缺、待自动重算而未计入统计的任务数 */
  gatewayDegradedCount?: number;
  total: Percentiles;
  firstResult: Percentiles;
  categories: LatencyCategoryStat[];
  groups: LatencyGroupStat[];
}

export interface LatencySlowestQuery extends LatencyFilters {
  category?: string;
  limit?: number;
}

export interface LatencySlowTask {
  /** 数字主键，详情路由用；旧后端可能缺 */
  id?: number;
  taskId: string;
  entryCode?: string;
  entryName?: string;
  modelCode?: string;
  modelName?: string;
  provider?: string;
  deployment?: string;
  status?: number;
  totalMs: number;
  firstResultMs: number | null;
  dominantCategory: string;
  dominantMs: number;
  submittedAt: string | number | null;
}

export interface LatencyOptions {
  entries: { code: string; name: string }[];
  models: { code: string; name: string }[];
  providers: string[];
}

const BASE = '/api/v1/admin/creation/latency';
const quiet = { silentError: true } as AxiosRequestConfig;

/** 去掉空值，避免把 '' 当筛选条件 */
function clean<T extends object>(q: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

export function getLatencyStats(params: LatencyStatsQuery) {
  return request.get<LatencyStats>(`${BASE}/stats`, { ...quiet, params: clean(params) });
}

export function getLatencySlowest(params: LatencySlowestQuery) {
  return request.get<LatencySlowTask[]>(`${BASE}/slowest`, { ...quiet, params: clean(params) });
}

export function getLatencyOptions() {
  return request.get<LatencyOptions>(`${BASE}/options`, quiet);
}
