import { request } from '@/utils/request';

/**
 * 智能体评测中心（Java，/api/v1/admin/agent-eval/**；契约 CONTRACT §W）。
 * 权限码：agent_eval:view（读）、agent_eval:run（发起 / 取消）。
 * 后端字段是 camelCase；这里的归一化同时容忍 snake_case，缺字段给安全默认值，页面只读归一化后的类型。
 *
 * mock：.env.development.local 里设 VITE_AGENT_EVAL_MOCK=true，全部请求改走 ./agent-eval.mock.ts 的内存假后端。
 */
const BASE = '/api/v1/admin/agent-eval';

export type EvalMode = 'gateway' | 'direct';
export type EvalRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'stopped_by_cap';
export type EvalCaseStatus = 'pass' | 'fail' | 'error' | 'manual_review';

export interface EvalDefaultModel {
  mode: EvalMode;
  ref: string;
  label: string;
}
export interface EvalOptions {
  defaultModel: EvalDefaultModel | null;
  gatewayModelGroups: { code: string; label: string }[];
  directModels: { id: string; label: string; platform?: string }[];
  cases: { total: number; tier2: number; pass5: number };
  /** 后端若下发 Pass^5 关键用例 id 才显示「只跑关键用例」 */
  pass5CaseIds: string[];
}

export interface EvalRun {
  id: string;
  mode: EvalMode;
  modelRef: string;
  modelLabel: string;
  status: EvalRunStatus;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  pass5Total: number;
  pass5Passed: number;
  llmCalls: number;
  maxCalls: number | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: string;
  finishedAt: string;
  createdBy: string;
  errorMsg: string;
}

export interface EvalCase {
  id: string;
  caseId: string;
  sessionNo: number;
  status: EvalCaseStatus;
  failedAssertion: string;
  gatesFailed: string[];
  /** 工具调用轨迹：后端存 JSON，可能是字符串或数组，统一给页面格式化后的文本 */
  toolTrace: unknown;
  replyText: string;
  durationMs: number;
}

export interface EvalRunPage {
  list: EvalRun[];
  total: number;
}

export interface CreateRunBody {
  mode: EvalMode;
  ref: string;
  maxCalls?: number;
  caseIds?: string[];
}

// ---- 归一化 ----
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {});
const pick = (o: Rec, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const str = (v: unknown, d = ''): string => (v === undefined || v === null ? d : String(v));
const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function normalizeRun(raw: unknown): EvalRun {
  const o = rec(raw);
  const max = pick(o, 'maxCalls', 'max_calls');
  return {
    id: str(pick(o, 'id', 'runId', 'run_id')),
    mode: str(o.mode) === 'direct' ? 'direct' : 'gateway',
    modelRef: str(pick(o, 'modelRef', 'model_ref', 'ref')),
    modelLabel: str(pick(o, 'modelLabel', 'model_label', 'label')),
    status: str(o.status, 'queued') as EvalRunStatus,
    total: num(o.total),
    passed: num(o.passed),
    failed: num(o.failed),
    errored: num(pick(o, 'errored', 'errors')),
    pass5Total: num(pick(o, 'pass5Total', 'pass5_total')),
    pass5Passed: num(pick(o, 'pass5Passed', 'pass5_passed')),
    llmCalls: num(pick(o, 'llmCalls', 'llm_calls')),
    maxCalls: max === undefined ? null : num(max),
    tokensIn: num(pick(o, 'tokensIn', 'tokens_in')),
    tokensOut: num(pick(o, 'tokensOut', 'tokens_out')),
    startedAt: str(pick(o, 'startedAt', 'started_at', 'createTime', 'createdAt')),
    finishedAt: str(pick(o, 'finishedAt', 'finished_at')),
    createdBy: str(pick(o, 'createdBy', 'created_by')),
    errorMsg: str(pick(o, 'errorMsg', 'error_msg', 'error')),
  };
}

export function normalizeCase(raw: unknown, idx = 0): EvalCase {
  const o = rec(raw);
  const gates = pick(o, 'gatesFailed', 'gates_failed');
  let gatesFailed: string[] = [];
  if (Array.isArray(gates)) gatesFailed = gates.map((g) => str(g));
  else if (typeof gates === 'string' && gates) {
    try {
      const p = JSON.parse(gates);
      gatesFailed = Array.isArray(p) ? p.map((g) => str(g)) : [gates];
    } catch {
      gatesFailed = gates.split(/[,;，；]/).filter(Boolean);
    }
  }
  const caseId = str(pick(o, 'caseId', 'case_id'));
  const sessionNo = num(pick(o, 'sessionNo', 'session_no'));
  return {
    id: str(o.id, `${caseId}#${sessionNo}#${idx}`),
    caseId,
    sessionNo,
    status: str(o.status, 'error') as EvalCaseStatus,
    failedAssertion: str(pick(o, 'failedAssertion', 'failed_assertion')),
    gatesFailed,
    toolTrace: pick(o, 'toolTrace', 'tool_trace'),
    replyText: str(pick(o, 'replyText', 'reply_text')),
    durationMs: num(pick(o, 'durationMs', 'duration_ms')),
  };
}

export function normalizeOptions(raw: unknown): EvalOptions {
  const o = rec(raw);
  const dm = rec(pick(o, 'defaultModel', 'default_model'));
  const cs = rec(o.cases);
  const hasDefault = dm.ref !== undefined || dm.label !== undefined;
  return {
    defaultModel: hasDefault
      ? {
          mode: str(dm.mode) === 'direct' ? 'direct' : 'gateway',
          ref: str(dm.ref),
          label: str(dm.label, str(dm.ref)),
        }
      : null,
    gatewayModelGroups: arr(pick(o, 'gatewayModelGroups', 'gateway_model_groups')).map((g) => {
      const r = rec(g);
      return { code: str(r.code), label: str(r.label, str(r.code)) };
    }),
    directModels: arr(pick(o, 'directModels', 'direct_models')).map((g) => {
      const r = rec(g);
      return {
        id: str(r.id),
        label: str(r.label, str(r.id)),
        platform: r.platform ? str(r.platform) : undefined,
      };
    }),
    cases: {
      total: num(cs.total),
      tier2: num(cs.tier2),
      pass5: num(cs.pass5),
    },
    pass5CaseIds: arr(pick(cs, 'pass5CaseIds', 'pass5_case_ids')).map((x) => str(x)),
  };
}

/** 分页接口形状不定：{list|records|items, total} 或直接数组都接 */
function listOf(raw: unknown): { items: unknown[]; total: number } {
  if (Array.isArray(raw)) return { items: raw, total: raw.length };
  const o = rec(raw);
  const items = arr(pick(o, 'list', 'records', 'items'));
  return { items, total: num(o.total, items.length) };
}

// ---- 接口 ----
const isMock = (): boolean =>
  (import.meta.env as Record<string, string | undefined>).VITE_AGENT_EVAL_MOCK === 'true';
const mock = () => import('./agent-eval.mock');

export const isAgentEvalMock = isMock;

export async function getEvalOptions(): Promise<EvalOptions> {
  if (isMock()) return normalizeOptions((await mock()).mockOptions());
  return normalizeOptions(await request.get(`${BASE}/options`));
}

export async function createEvalRun(body: CreateRunBody): Promise<EvalRun> {
  if (isMock()) return normalizeRun((await mock()).mockCreateRun(body));
  return normalizeRun(await request.post(`${BASE}/runs`, body, { noRetry: true } as never));
}

export async function listEvalRuns(page = 1, size = 20): Promise<EvalRunPage> {
  const raw = isMock()
    ? (await mock()).mockListRuns()
    : await request.get(`${BASE}/runs`, { params: { page, pageSize: size, size } });
  const { items, total } = listOf(raw);
  return { list: items.map(normalizeRun), total };
}

export async function getEvalRun(id: string): Promise<EvalRun> {
  if (isMock()) return normalizeRun((await mock()).mockGetRun(id));
  return normalizeRun(await request.get(`${BASE}/runs/${encodeURIComponent(id)}`));
}

export async function listEvalCases(id: string, status?: EvalCaseStatus): Promise<EvalCase[]> {
  const raw = isMock()
    ? (await mock()).mockListCases(id, status)
    : await request.get(`${BASE}/runs/${encodeURIComponent(id)}/cases`, {
        params: { status, page: 1, pageSize: 2000, size: 2000 },
      });
  return listOf(raw).items.map(normalizeCase);
}

export async function cancelEvalRun(id: string): Promise<void> {
  if (isMock()) {
    (await mock()).mockCancelRun(id);
    return;
  }
  await request.post(`${BASE}/runs/${encodeURIComponent(id)}/cancel`, undefined, {
    noRetry: true,
  } as never);
}
