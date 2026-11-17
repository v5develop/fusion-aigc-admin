import type { CreateRunBody, EvalCaseStatus } from './agent-eval';

/**
 * 智能体评测 mock：内存假后端。创建后按「每次读取推进几个用例」模拟 queued -> running -> succeeded，
 * 刷新页面重置。返回 camelCase 原始形状，交给 agent-eval.ts 的归一化。
 */
interface MockCase {
  caseId: string;
  sessionNo: number;
  status: EvalCaseStatus;
  failedAssertion: string;
  gatesFailed: string[];
  toolTrace: unknown;
  replyText: string;
  durationMs: number;
}
interface MockRun {
  id: string;
  mode: string;
  modelRef: string;
  modelLabel: string;
  status: string;
  total: number;
  done: number;
  maxCalls: number;
  llmCalls: number;
  startedAt: string;
  finishedAt: string;
  cases: MockCase[];
  cancelled: boolean;
}

const CASE_IDS = [
  'C01-上传即复刻',
  'C02-换装',
  'C03-改台词',
  'C04-多比例',
  'C05-换声音',
  'C06-发布文案',
];
const PASS5 = new Set(['C01-上传即复刻', 'C03-改台词']);
const runs: MockRun[] = [];
let seq = 1;

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function plan(): MockCase[] {
  const out: MockCase[] = [];
  CASE_IDS.forEach((c, i) => {
    const sessions = PASS5.has(c) ? 5 : 1;
    for (let s = 1; s <= sessions; s++) {
      const roll = (i * 7 + s * 3) % 10;
      const status: EvalCaseStatus =
        roll === 0 ? 'fail' : roll === 1 ? 'error' : roll === 2 ? 'manual_review' : 'pass';
      out.push({
        caseId: c,
        sessionNo: s,
        status,
        failedAssertion:
          status === 'fail' ? '应调用 replicate_start 且 ratio=9:16，实际未调用' : '',
        gatesFailed: status === 'fail' ? ['不得在未确认前扣点', '必须先报价'] : [],
        toolTrace: [
          { tool: 'replicate_quote', args: { sampleId: 12 }, result: { points: 30 } },
          { tool: 'replicate_start', args: { sampleId: 12, ratio: '16:9' }, result: { ok: true } },
        ],
        replyText: '好的，这条视频复刻预计消耗 30 点，要现在开始吗？',
        durationMs: 800 + ((i + s) % 5) * 700,
      });
    }
  });
  return out;
}

/** 每次读取推进一点 */
function tick(r: MockRun) {
  if (r.status === 'queued') r.status = 'running';
  else if (r.status === 'running') {
    r.done = Math.min(r.total, r.done + 3);
    r.llmCalls = Math.min(r.maxCalls, r.done * 4);
    if (r.llmCalls >= r.maxCalls) {
      r.status = 'stopped_by_cap';
      r.finishedAt = now();
    } else if (r.done >= r.total) {
      r.status = 'succeeded';
      r.finishedAt = now();
    }
  }
}

function view(r: MockRun) {
  const cs = r.cases.slice(0, r.done);
  const p5 = r.cases.filter((c) => PASS5.has(c.caseId)).length;
  const p5done = cs.filter((c) => PASS5.has(c.caseId));
  return {
    id: r.id,
    mode: r.mode,
    modelRef: r.modelRef,
    modelLabel: r.modelLabel,
    status: r.status,
    total: r.total,
    passed: cs.filter((c) => c.status === 'pass').length,
    failed: cs.filter((c) => c.status === 'fail').length,
    errored: cs.filter((c) => c.status === 'error').length,
    pass5Total: p5,
    pass5Passed: p5done.filter((c) => c.status === 'pass').length,
    llmCalls: r.llmCalls,
    maxCalls: r.maxCalls,
    tokensIn: r.llmCalls * 1800,
    tokensOut: r.llmCalls * 240,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    createdBy: 'admin',
    errorMsg: '',
  };
}

export function mockOptions() {
  return {
    defaultModel: { mode: 'gateway', ref: 'chat.qwen-max', label: 'Qwen Max（网关）' },
    gatewayModelGroups: [
      { code: 'chat.qwen-max', label: 'Qwen Max' },
      { code: 'chat.deepseek-v3', label: 'DeepSeek V3' },
    ],
    directModels: [
      { id: '101', label: 'qwen-plus', platform: '百炼' },
      { id: '102', label: 'deepseek-chat', platform: 'DeepSeek' },
    ],
    cases: { total: 24, tier2: 18, pass5: 6 },
    pass5CaseIds: [...PASS5],
  };
}

export function mockCreateRun(body: CreateRunBody) {
  if (runs.some((r) => r.status === 'queued' || r.status === 'running')) {
    throw new Error('已有评测在运行，请等待结束或先取消');
  }
  const opts = mockOptions();
  const label =
    body.mode === 'gateway'
      ? (opts.gatewayModelGroups.find((g) => g.code === body.ref)?.label ?? body.ref)
      : (opts.directModels.find((m) => m.id === body.ref)?.label ?? body.ref);
  const all = plan();
  const cases = body.caseIds?.length ? all.filter((c) => body.caseIds!.includes(c.caseId)) : all;
  const r: MockRun = {
    id: String(seq++),
    mode: body.mode,
    modelRef: body.ref,
    modelLabel: label,
    status: 'queued',
    total: cases.length,
    done: 0,
    maxCalls: body.maxCalls ?? 600,
    llmCalls: 0,
    startedAt: now(),
    finishedAt: '',
    cases,
    cancelled: false,
  };
  runs.unshift(r);
  return view(r);
}

export function mockListRuns() {
  runs.forEach(tick);
  return { list: runs.map(view), total: runs.length };
}

export function mockGetRun(id: string) {
  const r = runs.find((x) => x.id === id);
  if (!r) throw new Error('评测不存在');
  return view(r);
}

export function mockListCases(id: string, status?: EvalCaseStatus) {
  const r = runs.find((x) => x.id === id);
  if (!r) throw new Error('评测不存在');
  const list = r.cases.slice(0, r.done).filter((c) => !status || c.status === status);
  return { list, total: list.length };
}

export function mockCancelRun(id: string) {
  const r = runs.find((x) => x.id === id);
  if (r && (r.status === 'queued' || r.status === 'running')) {
    r.status = 'cancelled';
    r.finishedAt = now();
  }
}
