import type {
  AdminCharge,
  AdminJobPage,
  AdminJobRow,
  AdminSegment,
  AdminStep,
  Envelope,
  ForceResult,
  JobStatus,
  RefundResult,
  ReplicateMethod,
  SampleAdminPage,
  SampleAdminRow,
  SampleAnalysisStatus,
} from './replicate-admin';

/**
 * replicate-admin 的内存假后端（VITE_REPLICATE_ADMIN_MOCK=true 时加载）。带状态，刷新重置。
 * 形状对齐 Go app/replicate/admin（含 moderations / actions 无 json tag 的 PascalCase 键）。
 * 幂等：同 Idempotency-Key 重放第一次结果；种子里 #1004 的第一次退点会「部分失败」(5001)，同键重试补退成功。
 */
const ok = <T>(data: T): Envelope<T> => ({ code: 0, msg: 'ok', data });
const fail = (code: number, reason: string, msg: string): Envelope<unknown> => ({
  code,
  reason,
  msg,
  data: null,
});
class GoError extends Error {
  code: number;
  reason: string;
  constructor(code: number, reason: string, msg: string) {
    super(msg);
    this.code = code;
    this.reason = reason;
  }
}
const HOUR = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const BASE = Date.now();

const STATUS_LABEL: Record<JobStatus, string> = {
  submitting: '提交中',
  queued: '排队中',
  running: '生成中',
  waiting: '第 1 段做好了',
  continuing: '继续提交中',
  succeeded: '做好了',
  partial: '部分完成',
  failed: '没成功',
  canceled: '已取消',
};

type SegState = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'not_started';
interface Seg {
  state: SegState;
  points: number;
  /** 真实计费状态 */
  real: 'HELD' | 'CONFIRMED' | 'REFUNDED' | '';
  failReason: string;
}
interface Action {
  ID: number;
  JobID: number;
  AdminID: number;
  Action: string;
  SegIndex: number;
  Reason: string;
  Points: number;
  Status: string;
  CreatedAt: string;
}
interface Job {
  id: number;
  userId: number;
  status: JobStatus;
  segs: Seg[];
  createdMs: number;
  error: string;
  /** 镜像还停在 HELD，真实已退（制造不一致） */
  drift: boolean;
  actions: Action[];
  failOnce: boolean;
}

const P: { status: JobStatus; segs: [SegState, number, Seg['real']][]; reason?: string }[] = [
  {
    status: 'succeeded',
    segs: [
      ['succeeded', 120, 'CONFIRMED'],
      ['succeeded', 140, 'CONFIRMED'],
      ['succeeded', 80, 'CONFIRMED'],
    ],
  },
  {
    status: 'waiting',
    segs: [
      ['succeeded', 120, 'CONFIRMED'],
      ['not_started', 0, ''],
      ['not_started', 0, ''],
    ],
  },
  {
    status: 'partial',
    segs: [
      ['succeeded', 120, 'CONFIRMED'],
      ['failed', 140, 'CONFIRMED'],
      ['succeeded', 80, 'CONFIRMED'],
    ],
  },
  {
    status: 'failed',
    segs: [
      ['failed', 100, 'HELD'],
      ['failed', 100, 'HELD'],
      ['canceled', 0, ''],
    ],
    reason: '网关调用超时，供应商未返回结果',
  },
  {
    status: 'running',
    segs: [
      ['succeeded', 120, 'CONFIRMED'],
      ['running', 140, 'HELD'],
      ['queued', 80, 'HELD'],
    ],
  },
  { status: 'submitting', segs: [['queued', 120, 'HELD']] },
  {
    status: 'canceled',
    segs: [
      ['canceled', 0, ''],
      ['canceled', 0, ''],
    ],
  },
  {
    status: 'failed',
    segs: [
      ['failed', 90, 'REFUNDED'],
      ['failed', 90, 'REFUNDED'],
    ],
    reason: '输入审核未通过：参考图',
  },
];
const jobs: Job[] = Array.from({ length: 28 }, (_, i): Job => {
  const p = P[i % P.length];
  return {
    id: 1001 + i,
    userId: 20000 + (i % 7),
    status: p.status,
    segs: p.segs.map(([state, points, real]) => ({
      state,
      points,
      real,
      failReason: state === 'failed' ? (p.reason ?? '这一段这次没生成出来') : '',
    })),
    createdMs: BASE - i * 5 * HOUR,
    error: p.reason ?? '',
    drift: i === 11,
    actions: [],
    failOnce: i === 3,
  };
});
const jobById = (id: number) => {
  const j = jobs.find((x) => x.id === id);
  if (!j) throw new GoError(4001, 'RESOURCE_NOT_FOUND', '任务不存在');
  return j;
};
const inFlight = (j: Job) => ['submitting', 'queued', 'running', 'continuing'].includes(j.status);

const refundableOf = (s: Seg): number =>
  s.real === 'HELD' && !['running', 'queued'].includes(s.state)
    ? s.points
    : s.real === 'CONFIRMED' && s.state === 'failed'
      ? s.points
      : 0;
const callId = (j: Job, i: number) =>
  `gw_${j.id.toString(16)}${(i + 1).toString(16).padStart(2, '0')}c7e1`;

const rowOf = (j: Job): AdminJobRow => ({
  jobId: j.id,
  taskId: `AiCreation_RP_${(900000 + j.id).toString(36).toUpperCase()}`,
  planNo: `VRP${(7000000 + j.id * 13).toString(36).toUpperCase()}`,
  userId: j.userId,
  status: j.status,
  statusLabel: STATUS_LABEL[j.status],
  title: `看懂了：${j.segs.length} 个镜头`,
  modelGroup: 'vid.seedance-2.5',
  segTotal: j.segs.length,
  segDone: j.segs.filter((s) => s.state === 'succeeded').length,
  segFailed: j.segs.filter((s) => s.state === 'failed').length,
  redoCount: j.id % 3 === 0 ? 1 : 0,
  error: j.error || undefined,
  stopReason: j.actions.some((a) => a.Action === 'FORCE_FINISH') ? 'admin_force' : undefined,
  createdAt: iso(j.createdMs),
  finishedAt: inFlight(j) ? undefined : iso(j.createdMs + 40 * 60_000),
});

const chargesOf = (j: Job): AdminCharge[] =>
  j.segs.flatMap((s, i): AdminCharge[] => {
    if (s.points <= 0) return [];
    const mirrorLabel =
      j.drift && i === 1
        ? '冻结中'
        : { HELD: '冻结中', CONFIRMED: '已确认扣除', REFUNDED: '已退回', '': '' }[s.real];
    const mirrorStatus = mirrorLabel === '冻结中' ? 1 : mirrorLabel === '已确认扣除' ? 2 : 3;
    const refundable = refundableOf(s);
    return [
      {
        id: j.id * 10 + i,
        segIndex: i + 1,
        stage: 'first',
        requestId: `rp-${j.id}-${i + 1}`,
        seconds: 12,
        points: s.points,
        mirrorStatus,
        mirrorLabel,
        billingStatus: s.real,
        reservationNo: `RSV${j.id}${i + 1}`,
        mismatch: j.drift && i === 1,
        refundablePoints: refundable,
        blockedReason: !refundable && s.real === 'HELD' ? '该段还在生成，不能退' : undefined,
      },
    ];
  });

const stepsOf = (j: Job): AdminStep[] => {
  const stepList: Omit<AdminStep, 'id'>[] = [
    {
      stepKey: 'analysis',
      kind: 'analysis',
      segIndex: 0,
      status: 'done',
      attempt: 1,
      createdAt: iso(j.createdMs),
    },
  ];
  j.segs.forEach((s, i) => {
    const gw = s.state === 'not_started' || s.state === 'canceled' ? undefined : callId(j, i);
    stepList.push({
      stepKey: `seg${i + 1}.hold`,
      kind: 'hold',
      segIndex: i + 1,
      status: s.points > 0 ? 'done' : 'skipped',
      attempt: 1,
      createdAt: iso(j.createdMs + (i + 1) * 60_000),
    });
    stepList.push({
      stepKey: `seg${i + 1}.submit`,
      kind: 'submit',
      segIndex: i + 1,
      status:
        s.state === 'succeeded'
          ? 'done'
          : s.state === 'failed'
            ? 'failed'
            : s.state === 'running'
              ? 'running'
              : 'pending',
      attempt: s.state === 'failed' ? 2 : 1,
      gatewayCallId: gw,
      gatewayStatus: s.state === 'failed' ? 'FAILED' : undefined,
      errorClass: s.state === 'failed' ? 'timeout' : undefined,
      errorMsg: s.state === 'failed' ? s.failReason : undefined,
      createdAt: iso(j.createdMs + (i + 1) * 90_000),
      startedAt: gw ? iso(j.createdMs + (i + 1) * 90_000) : undefined,
      finishedAt:
        s.state === 'succeeded' || s.state === 'failed'
          ? iso(j.createdMs + (i + 1) * 90_000 + 3 * 60_000)
          : undefined,
    });
  });
  return stepList.map((x, n) => ({ ...x, id: j.id * 100 + n }));
};

const detailOf = (j: Job) => {
  const steps = stepsOf(j);
  const charges = chargesOf(j);
  const segments: AdminSegment[] = j.segs.map((s, i) => {
    const cs = charges.filter((c) => c.segIndex === i + 1);
    const ss = steps.filter((x) => x.segIndex === i + 1);
    return {
      index: i + 1,
      state: ss.at(-1)?.status ?? 'pending',
      gatewayCallIds: ss.map((x) => x.gatewayCallId).filter((x): x is string => !!x),
      failReason: s.failReason || undefined,
      steps: ss,
      charges: cs,
      refundablePoints: cs.reduce((a, c) => a + c.refundablePoints, 0),
      canRefund: cs.some((c) => c.refundablePoints > 0),
    };
  });
  const rejected = j.error.includes('审核');
  const blocker = inFlight(j)
    ? '还有段在生成或提交中，等它自己结束后再收尾'
    : ['succeeded', 'canceled'].includes(j.status) && !charges.some((c) => c.mismatch)
      ? '任务已经是终态且没有未结清的镜像'
      : '';
  return {
    job: rowOf(j),
    input: { dims: { product: { mode: 'replace', refs: [1] } }, audio: 'regenerate' },
    result: j.status === 'succeeded' ? { status: 'ready', kind: 'full' } : null,
    segments,
    steps,
    charges,
    // 无 json tag：PascalCase
    moderations: [
      {
        ID: j.id * 10 + 1,
        PlanNo: rowOf(j).planNo,
        Status: 'PASSED',
        Reason: '',
        CreatedAt: iso(j.createdMs),
      },
      {
        ID: j.id * 10 + 2,
        PlanNo: rowOf(j).planNo,
        Status: rejected ? 'REJECTED' : 'PASSED',
        Reason: rejected ? '疑似含有不适宜内容（参考图 1）' : '',
        CreatedAt: iso(j.createdMs + 1000),
      },
    ],
    moderationLogs: [
      {
        id: j.id,
        bizType: 'moderation.image',
        provider: 'gateway',
        passed: rejected ? 0 : 1,
        label: rejected ? 'porn' : undefined,
        rejectedTarget: rejected ? '参考图 1' : undefined,
        createTime: iso(j.createdMs),
      },
    ],
    deliveries: [],
    actions: j.actions,
    billingOn: true,
    canRefund: charges.some((c) => c.refundablePoints > 0),
    canForce: !blocker,
    forceBlocker: blocker || undefined,
  };
};

const normNum = (v: unknown, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};
const parseT = (v: unknown, end: boolean): number | null => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))
    return Date.parse(`${s}T00:00:00+08:00`) + (end ? 24 * HOUR : 0);
  const t = Date.parse(/Z|[+-]\d\d:\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}+08:00`);
  return Number.isNaN(t) ? null : t;
};

function list(q: Record<string, unknown>): AdminJobPage {
  const page = normNum(q.page, 1);
  const size = Math.min(100, normNum(q.size, 20));
  const from = parseT(q.from, false);
  const to = parseT(q.to, true);
  const uid = Number(q.userId) || 0;
  const jid = Number(q.jobId) || 0;
  const statuses = String(q.status ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const task = String(q.taskId ?? '')
    .trim()
    .toLowerCase();
  const plan = String(q.planNo ?? '')
    .trim()
    .toLowerCase();
  const rows = jobs
    .filter((j) => !uid || j.userId === uid)
    .filter((j) => !jid || j.id === jid)
    .filter((j) => !statuses.length || statuses.includes(j.status))
    .filter((j) => from === null || j.createdMs >= from)
    .filter((j) => to === null || j.createdMs < to)
    .map(rowOf)
    .filter((r) => !task || r.taskId.toLowerCase().includes(task))
    .filter((r) => !plan || r.planNo.toLowerCase() === plan)
    .sort((a, b) => b.jobId - a.jobId);
  return { total: rows.length, page, size, items: rows.slice((page - 1) * size, page * size) };
}

// 幂等：key → 第一次成功的结果；部分失败的 key → 已退的段
const replayStore = new Map<string, unknown>();
const inProgress = new Set<string>();
const partial = new Map<string, number[]>();

function refund(j: Job, body: Record<string, unknown>, key: string): RefundResult {
  const reason = String(body.reason ?? '').trim();
  if (!reason) throw new GoError(1002, 'PARAM_MISSING', '退点原因必填');
  if (reason.length > 200) throw new GoError(1003, 'PARAM_INVALID', '退点原因最多 200 字');
  if (body.expectedPoints === undefined || body.expectedPoints === null)
    throw new GoError(1002, 'PARAM_MISSING', '缺少 expectedPoints（页面展示的可退合计）');
  const rk = `refund:${j.id}:${key}`;
  if (replayStore.has(rk)) return { ...(replayStore.get(rk) as RefundResult), replay: true };
  if (inProgress.has(rk)) throw new GoError(4002, 'IN_PROGRESS', '同一个请求正在处理中，稍后再试');
  const idx = Array.from(new Set((body.segIndexes as number[]) ?? []));
  if (!idx.length) throw new GoError(1003, 'PARAM_INVALID', '请选择要退点的段');
  const done = partial.get(rk) ?? [];
  const targets = idx.map((n) => {
    const s = j.segs[n - 1];
    if (!s) throw new GoError(1003, 'PARAM_INVALID', `第 ${n} 段不存在`);
    return { n, s };
  });
  // 重试补退：已退过的段不再计入现算可退
  const pending = targets.filter((t) => !done.includes(t.n));
  const sum = pending.reduce((a, t) => a + refundableOf(t.s), 0);
  if (!done.length) {
    if (sum === 0) throw new GoError(4002, 'NOTHING_TO_REFUND', '没有可退的点数');
    if (sum !== Number(body.expectedPoints))
      throw new GoError(
        4002,
        'POINTS_CHANGED',
        `可退点数已变化（现在是 ${sum} 点），请刷新后再确认`,
      );
  }
  if (j.failOnce && !done.length && pending.length > 1) {
    // 第一段退成功，第二段失败：部分失败，无明细
    j.failOnce = false;
    const first = pending[0];
    first.s.real = 'REFUNDED';
    partial.set(rk, [first.n]);
    throw new GoError(5001, 'INTERNAL', '部分单退点没成功，已记录；可用同一个幂等键重试补退');
  }
  const lines = pending.map((t) => {
    const pts = refundableOf(t.s);
    const before = t.s.real;
    t.s.real = 'REFUNDED';
    return { segIndex: t.n, requestId: `rp-${j.id}-${t.n}`, before, points: pts, mirrorDone: true };
  });
  const total = lines.reduce((a, l) => a + l.points, 0) + done.length * 0;
  const act: Action = {
    ID: Date.now(),
    JobID: j.id,
    AdminID: 1,
    Action: 'REFUND',
    SegIndex: 0,
    Reason: reason,
    Points: total,
    Status: 'DONE',
    CreatedAt: iso(Date.now()),
  };
  j.actions.unshift(act);
  const res: RefundResult = {
    actionId: act.ID,
    points: total,
    lines,
    replay: false,
    status: 'DONE',
  };
  replayStore.set(rk, res);
  partial.delete(rk);
  j.drift = false;
  return res;
}

function force(j: Job, body: Record<string, unknown>, key: string): ForceResult {
  const reason = String(body.reason ?? '').trim();
  if (!reason) throw new GoError(1002, 'PARAM_MISSING', '收尾原因必填');
  const rk = `force:${j.id}:${key}`;
  if (replayStore.has(rk)) return { ...(replayStore.get(rk) as ForceResult), replay: true };
  if (inFlight(j)) throw new GoError(4002, 'IN_FLIGHT', '还有段在生成或提交中，不能强制收尾');
  const from = j.status;
  let canceled = 0;
  for (const s of j.segs)
    if (s.state === 'not_started') {
      s.state = 'canceled';
      canceled++;
    }
  if (j.status === 'waiting') j.status = 'partial';
  j.drift = false;
  const act: Action = {
    ID: Date.now(),
    JobID: j.id,
    AdminID: 1,
    Action: 'FORCE_FINISH',
    SegIndex: 0,
    Reason: reason,
    Points: 0,
    Status: 'DONE',
    CreatedAt: iso(Date.now()),
  };
  j.actions.unshift(act);
  const res: ForceResult = {
    actionId: act.ID,
    replay: false,
    jobId: j.id,
    fromStatus: from,
    status: j.status,
    canceledSteps: canceled,
    openCharges: 0,
    message: '已收尾',
  };
  replayStore.set(rk, res);
  return res;
}

// ---------------------------------------------------------------- 示例管理（§11）
// 预分析按时间推进：触发后 3 秒内 queued，之后按阶段 running，约 15 秒后发布；sourceRid 含 "bad" 的那一轮会失败。

const SAMPLE_STAGES = ['probe', 'shots', 'vision', 'summary'];
const SAMPLE_LABEL: Record<SampleAnalysisStatus, string> = {
  none: '未分析',
  queued: '排队中',
  running: '分析中',
  ready: '已就绪',
  failed: '分析失败',
};
interface SampleRec {
  id: number;
  title: string;
  industry: string;
  sourceRid: string;
  coverRid: string;
  resultRid: string;
  annotations: Record<string, unknown> | null;
  sortOrder: number;
  enabled: boolean;
  round: number;
  /** 已发布那一轮 */
  publishedNo: string;
  analyzedMs: number;
  /** 正在跑的那一轮 */
  pendingNo: string;
  pendingMs: number;
  pendingFail: boolean;
  error: string;
  createdMs: number;
  updatedMs: number;
  deleted: boolean;
}
let sampleSeq = 10;
const analysisNo = (id: number, round: number) =>
  `VRA${(5000000 + id * 97 + round).toString(36).toUpperCase()}`;
const samples: SampleRec[] = [
  ['女装上新·模特换装', 'womenswear', 10, true, 2, false],
  ['餐饮探店·招牌菜特写', 'catering', 20, true, 1, false],
  ['通用·产品 360 度展示', '', 30, true, 0, false],
  ['美妆·口红试色', 'beauty', 40, false, 1, true],
  ['家居·沙发场景替换', 'furniture', 50, true, 0, false],
].map(([title, industry, sortOrder, enabled, round, failed], i): SampleRec => {
  const id = i + 1;
  const r = Number(round);
  return {
    id,
    title: String(title),
    industry: String(industry),
    sourceRid: `rid_src_${id}a7f3`,
    coverRid: id % 2 ? `rid_cov_${id}b21c` : '',
    resultRid: r > 0 ? `rid_res_${id}c9d0` : '',
    annotations:
      id === 1 ? { dims: { product: { mode: 'replace', refs: [1] } }, audio: 'regenerate' } : null,
    sortOrder: Number(sortOrder),
    enabled: Boolean(enabled),
    round: r,
    publishedNo: r > 0 && !failed ? analysisNo(id, r) : '',
    analyzedMs: r > 0 && !failed ? BASE - (i + 1) * 30 * HOUR : 0,
    pendingNo: '',
    pendingMs: 0,
    pendingFail: false,
    error: failed ? '原片解码失败：不支持的编码格式' : '',
    createdMs: BASE - (i + 2) * 48 * HOUR,
    updatedMs: BASE - (i + 1) * 30 * HOUR,
    deleted: false,
  };
});
const sampleById = (id: number) => {
  const x = samples.find((s) => s.id === id && !s.deleted);
  if (!x) throw new GoError(4001, 'RESOURCE_NOT_FOUND', '示例不存在');
  return x;
};
/** 惰性推进：读的时候把跑完的一轮发布 / 记失败 */
function advance(x: SampleRec) {
  if (!x.pendingNo) return;
  if (Date.now() - x.pendingMs < 15_000) return;
  if (x.pendingFail) {
    x.error = '视觉理解超时，供应商未返回结果';
  } else {
    x.publishedNo = x.pendingNo;
    x.analyzedMs = Date.now();
    x.error = '';
  }
  x.pendingNo = '';
}
function sampleRow(x: SampleRec): SampleAdminRow {
  advance(x);
  const elapsed = Date.now() - x.pendingMs;
  const status: SampleAnalysisStatus = x.pendingNo
    ? elapsed < 3000
      ? 'queued'
      : 'running'
    : x.publishedNo
      ? 'ready'
      : x.error
        ? 'failed'
        : 'none';
  const published = !!x.publishedNo;
  return {
    id: x.id,
    title: x.title,
    industry: x.industry,
    sourceRid: x.sourceRid,
    coverRid: x.coverRid,
    resultRid: x.resultRid,
    annotations: x.annotations,
    sortOrder: x.sortOrder,
    enabled: x.enabled,
    analysisStatus: status,
    analysisStatusLabel: SAMPLE_LABEL[status],
    analysisStage:
      status === 'running'
        ? SAMPLE_STAGES[Math.min(SAMPLE_STAGES.length - 1, Math.floor((elapsed - 3000) / 3000))]
        : status === 'queued'
          ? 'queued'
          : '',
    analysisError: x.error,
    analysisNo: x.publishedNo,
    pendingAnalysisNo: x.pendingNo,
    round: x.round,
    durationS: published ? 8 + x.id * 1.7 : 0,
    summary: published ? `看懂了：${2 + (x.id % 3)} 个镜头，${x.title}` : '',
    analyzedAt: published ? iso(x.analyzedMs) : undefined,
    published,
    userVisible: x.enabled && published,
    createdAt: iso(x.createdMs),
    updatedAt: iso(x.updatedMs),
  };
}
function sampleList(q: Record<string, unknown>): SampleAdminPage {
  const page = normNum(q.page, 1);
  const size = Math.min(100, normNum(q.size, 20));
  const ind = String(q.industry ?? '').trim();
  const en = String(q.enabled ?? '');
  const rows = samples
    .filter((x) => !x.deleted)
    .filter((x) => !ind || x.industry === ind)
    .filter((x) => en === '' || x.enabled === (en === '1'))
    .sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id)
    .map(sampleRow);
  const items = rows.slice((page - 1) * size, page * size);
  const previews: Record<string, string> = {};
  for (const r of items) {
    for (const rid of [r.sourceRid, r.coverRid, r.resultRid]) {
      if (rid) previews[rid.replace(/^mr:\/\//, '')] = mockPreview(rid);
    }
  }
  return { items, total: rows.length, page, size, previews };
}
const mockPreview = (rid: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#2a2b33"/><text x="60" y="84" fill="#9499a5" font-size="12" text-anchor="middle">${rid.slice(-6)}</text></svg>`,
  )}`;
const normRid = (v: unknown, field: string, required: boolean): string => {
  const s = String(v ?? '')
    .trim()
    .replace(/^mr:\/\//, '');
  if (!s) {
    if (required) throw new GoError(1002, 'PARAM_MISSING', `${field} 必填`);
    return '';
  }
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(s))
    throw new GoError(1003, 'PARAM_INVALID', `${field} 不是合法的 rid`);
  return s;
};
function startAnalysis(x: SampleRec) {
  if (x.pendingNo) throw new GoError(4002, 'SAMPLE_ANALYZING', '上一轮预分析还在跑');
  x.round += 1;
  x.pendingNo = analysisNo(x.id, x.round);
  x.pendingMs = Date.now();
  x.pendingFail = x.sourceRid.includes('bad');
}
function saveSample(x: SampleRec | null, body: Record<string, unknown>): SampleAdminRow {
  const title = String(body.title ?? '').trim();
  if (!title) throw new GoError(1002, 'PARAM_MISSING', '标题必填');
  if (title.length > 40) throw new GoError(1003, 'PARAM_INVALID', '标题最多 40 字');
  const industry = String(body.industry ?? '').trim();
  if (industry.length > 64) throw new GoError(1003, 'PARAM_INVALID', '行业最多 64 字');
  const sourceRid = normRid(body.sourceRid, 'sourceRid', true);
  const ann = body.annotations;
  if (ann !== undefined && ann !== null && (typeof ann !== 'object' || Array.isArray(ann)))
    throw new GoError(1003, 'PARAM_INVALID', 'annotations 必须是对象');
  const rec: SampleRec =
    x ??
    ({
      id: ++sampleSeq,
      round: 0,
      publishedNo: '',
      analyzedMs: 0,
      pendingNo: '',
      pendingMs: 0,
      pendingFail: false,
      error: '',
      createdMs: Date.now(),
      deleted: false,
    } as SampleRec);
  if (x && x.sourceRid !== sourceRid) {
    // 换原片：清掉已发布的分析
    x.publishedNo = '';
    x.analyzedMs = 0;
    x.error = '';
  }
  Object.assign(rec, {
    title,
    industry,
    sourceRid,
    coverRid: normRid(body.coverRid, 'coverRid', false),
    resultRid: normRid(body.resultRid, 'resultRid', false),
    annotations: (ann as Record<string, unknown> | null | undefined) ?? null,
    sortOrder: Number(body.sortOrder) || 0,
    enabled: body.enabled === undefined ? true : !!body.enabled,
    updatedMs: Date.now(),
  });
  if (!x) samples.push(rec);
  if (body.analyze) startAnalysis(rec);
  return sampleRow(rec);
}
function routeSample(
  method: ReplicateMethod,
  path: string,
  query: Record<string, unknown>,
  body: Record<string, unknown>,
): Envelope<unknown> | null {
  if (path === '/samples') {
    if (method === 'GET') return ok(sampleList(query));
    if (method === 'POST') return ok(saveSample(null, body));
  }
  let m = path.match(/^\/samples\/(\d+)$/);
  if (m) {
    const x = sampleById(Number(m[1]));
    if (method === 'GET') {
      const row = sampleRow(x);
      return ok({
        ...row,
        analysis: row.published
          ? {
              durationS: row.durationS,
              summary: row.summary,
              shots: [
                { index: 1, start: 0, end: 4.2, desc: '模特正面走近镜头' },
                { index: 2, start: 4.2, end: 8.9, desc: '产品特写，手部展示面料' },
              ],
              dims: {
                product: { present: true },
                person: { present: true },
                audio: { present: true },
              },
            }
          : null,
      });
    }
    if (method === 'PUT') return ok(saveSample(x, body));
    if (method === 'DELETE') {
      x.deleted = true;
      return ok({ id: x.id });
    }
  }
  m = path.match(/^\/samples\/(\d+)\/analyze$/);
  if (m && method === 'POST') {
    const x = sampleById(Number(m[1]));
    advance(x);
    startAnalysis(x);
    x.updatedMs = Date.now();
    return ok(sampleRow(x));
  }
  return null;
}

// 总开关：部署配置默认关，库里没有这一行
const sw: {
  db: boolean | null;
  configDefault: boolean;
  remark: string;
  updatedMs: number;
} = {
  db: null,
  configDefault: false,
  remark: '',
  updatedMs: 0,
};
function switchView() {
  return {
    enabled: sw.db ?? sw.configDefault,
    source: sw.db === null ? 'config' : 'db',
    configDefault: sw.configDefault,
    dbValue: sw.db === null ? undefined : String(sw.db),
    remark: sw.remark || undefined,
    updatedAt: sw.updatedMs ? new Date(sw.updatedMs).toISOString() : undefined,
    effectSeconds: 60,
  };
}
function routeSwitch(
  method: ReplicateMethod,
  body: Record<string, unknown>,
): Envelope<unknown> | null {
  if (method === 'GET') return ok(switchView());
  const reason = String(body.reason ?? '').trim();
  if (!reason) throw new GoError(1002, 'PARAM_MISSING', '请填写原因');
  if (method === 'PUT') {
    sw.db = !!body.enabled;
    sw.remark = `视频做同款总开关：管理员 1 设为${sw.db ? '开启（接新提交）' : '暂停新提交'}。原因：${reason}`;
  } else if (method === 'DELETE') {
    sw.db = null;
    sw.remark = `视频做同款总开关：管理员 1 恢复跟随部署配置。原因：${reason}`;
  } else {
    return null;
  }
  sw.updatedMs = Date.now();
  return ok(switchView());
}

export async function handleMock(
  method: ReplicateMethod,
  path: string,
  query: Record<string, unknown>,
  data: unknown,
  headers: Record<string, string> = {},
): Promise<Envelope<unknown>> {
  await new Promise((r) => setTimeout(r, 120));
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const key = headers['Idempotency-Key'] || `auto:${JSON.stringify(body)}`;
  try {
    if (method === 'GET' && path === '/jobs') return ok(list(query));
    let m = path.match(/^\/jobs\/(\d+)$/);
    if (method === 'GET' && m) return ok(detailOf(jobById(Number(m[1]))));
    m = path.match(/^\/jobs\/(\d+)\/refund$/);
    if (method === 'POST' && m) return ok(refund(jobById(Number(m[1])), body, key));
    m = path.match(/^\/jobs\/(\d+)\/force-finish$/);
    if (method === 'POST' && m) return ok(force(jobById(Number(m[1])), body, key));
    if (path === '/samples/media/upload' || path === '/samples/media/resolve') {
      const rid = path.endsWith('/upload')
        ? `mock-${Date.now().toString(36)}`
        : String(body.rid ?? '').replace(/^mr:\/\//, '');
      if (path.endsWith('/resolve') && !rid)
        throw new GoError(1003, 'PARAM_INVALID', '素材编号格式不对');
      const svg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#2a2b33"/><text x="120" y="164" fill="#9499a5" font-size="16" text-anchor="middle">mock 预览</text></svg>`,
      );
      return ok({
        rid,
        kind: 'image',
        mime: 'image/svg+xml',
        bytes: 1024,
        durationS: 0,
        width: 240,
        height: 320,
        previewUrl: `data:image/svg+xml,${svg}`,
      });
    }
    if (path === '/switch') {
      const res = routeSwitch(method, body);
      if (res) return res;
    }
    if (path.startsWith('/samples')) {
      const res = routeSample(method, path, query, body);
      if (res) return res;
    }
  } catch (e) {
    if (e instanceof GoError) return fail(e.code, e.reason, e.message);
    throw e;
  }
  return fail(404, 'RESOURCE_NOT_FOUND', `mock 未实现：${method} ${path}`);
}
