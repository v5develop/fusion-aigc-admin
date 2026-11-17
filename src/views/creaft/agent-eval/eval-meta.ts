import type { EvalCaseStatus, EvalMode, EvalRun, EvalRunStatus } from '@/api/agent-eval';

export const RUN_STATUS: Record<EvalRunStatus, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
  interrupted: { label: '已中断', color: 'warning' },
  stopped_by_cap: { label: '到上限停止', color: 'warning' },
};

export const CASE_STATUS: Record<EvalCaseStatus, { label: string; color: string }> = {
  pass: { label: '通过', color: 'success' },
  fail: { label: '失败', color: 'error' },
  error: { label: '出错', color: 'volcano' },
  manual_review: { label: '需人工复核', color: 'gold' },
};

export const MODE_LABEL: Record<EvalMode, string> = { gateway: '网关', direct: '直连' };

export const isActive = (s: EvalRunStatus): boolean => s === 'queued' || s === 'running';

export const statusInfo = (s: string) =>
  RUN_STATUS[s as EvalRunStatus] ?? { label: s || '—', color: 'default' };

/** 已出结果的用例数 */
export const doneOf = (r: EvalRun): number => r.passed + r.failed + r.errored;

export const progressPct = (r: EvalRun): number =>
  r.total > 0 ? Math.min(100, Math.round((doneOf(r) / r.total) * 100)) : 0;

/** 通过率：分母取已出结果数，没有结果显示 — */
export function passRate(r: EvalRun): string {
  const d = doneOf(r);
  return d > 0 ? `${((r.passed / d) * 100).toFixed(1)}%` : '—';
}

/** 后端时间是北京时间无时区串，只做展示整形，不再换算 */
export function fmtTime(v?: string | null): string {
  if (!v) return '—';
  return v.replace('T', ' ').slice(0, 19);
}

/** 工具轨迹转可读文本：字符串先尝试按 JSON 美化，失败原样 */
export function prettyTrace(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  return JSON.stringify(v, null, 2);
}
