import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 视频做同款后台接口（Go admin-api，前缀 /api/v1/replicate/admin；契约 fusion_aigc_go docs/api/api-replicate.md §9，
 * 实现 app/replicate/admin/admin.go、app/admin/api/internal/handler/replicate/replicate.go，以代码为准）。
 * - 权限码：replicate:view（读）、replicate:refund（人工退点）、replicate:force（强制收尾）、
 *   replicate:sample（示例增删改 / 触发预分析，契约 §11）、replicate:switch（总开关写，契约 §9.x）。
 * - 退点 / 收尾带请求头 Idempotency-Key：同键重放返回第一次结果；退点部分失败（code 5001、无明细）用同一键重试补退剩下的。
 * - Moderation / Delivery / AdminAction 在 Go 侧没有 json tag，键名可能是 PascalCase，这里统一归一化成 camelCase。
 *
 * mock：.env.development.local 里设 VITE_REPLICATE_ADMIN_MOCK=true，全部请求改走 ./replicate-admin.mock.ts 的内存假后端。
 */
const PREFIX = '/api/v1/replicate/admin';
const CODE_UNAUTHORIZED = 2001;

const http = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: (status) => status < 500,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Envelope<T> {
  code: number;
  reason?: string;
  msg: string;
  data: T;
}

export type ReplicateMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const isReplicateMock = (): boolean =>
  (import.meta.env as Record<string, string | undefined>).VITE_REPLICATE_ADMIN_MOCK === 'true';

export class ReplicateError extends Error {
  code: number;
  reason?: string;
  data?: unknown;
  constructor(code: number, msg: string, reason?: string, data?: unknown) {
    super(msg);
    this.code = code;
    this.reason = reason;
    this.data = data;
  }
}

async function call<T>(
  method: ReplicateMethod,
  path: string,
  opts: {
    params?: Record<string, unknown>;
    data?: unknown;
    silent?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  let body: Envelope<T>;
  try {
    if (isReplicateMock()) {
      const { handleMock } = await import('./replicate-admin.mock');
      body = (await handleMock(method, path, opts.params ?? {}, opts.data)) as Envelope<T>;
    } else {
      const res: AxiosResponse<Envelope<T>> = await http.request<Envelope<T>>({
        method,
        url: `${PREFIX}${path}`,
        params: opts.params,
        data: opts.data,
        headers: opts.headers,
      });
      body = res.data;
    }
  } catch {
    message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === CODE_UNAUTHORIZED) {
    clearTokens();
    if (router.currentRoute.value.path !== '/login') {
      router.push({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } else if (!opts.silent) {
    message.error(body.msg || '操作失败');
  }
  throw new ReplicateError(body.code, body.msg || 'error', body.reason, body.data);
}

// ---------------------------------------------------------------- 类型

/** 对外状态码（与用户端 JobView.status 一致） */
export type JobStatus =
  | 'submitting'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'continuing'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'canceled';

/** 在途：系统还在逐段预留 / 排队 / 生成，人工不能强制收尾（后端 canForce / forceBlocker 为准，这是兜底） */
export const IN_FLIGHT_STATUSES: JobStatus[] = ['submitting', 'queued', 'running', 'continuing'];
export const isInFlight = (s: JobStatus): boolean => IN_FLIGHT_STATUSES.includes(s);

export interface AdminJobRow {
  jobId: number;
  taskId: string;
  planNo: string;
  userId: number;
  status: JobStatus;
  statusLabel: string;
  title: string;
  modelGroup: string;
  segTotal: number;
  segDone: number;
  segFailed: number;
  redoCount: number;
  error?: string;
  stopReason?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface AdminJobPage {
  total: number;
  page: number;
  size: number;
  items: AdminJobRow[];
}

export interface AdminJobQuery {
  userId?: number;
  /** 对外码，逗号分隔可多选，如 succeeded,partial */
  status?: string;
  /** RFC3339 / YYYY-MM-DD HH:mm:ss / YYYY-MM-DD（北京时间；日期形式的 to 含当天） */
  from?: string;
  to?: string;
  jobId?: number;
  taskId?: string;
  planNo?: string;
  page?: number;
  size?: number;
}

export interface AdminStep {
  id: number;
  stepKey: string;
  kind: string;
  /** 0 = 不属于某一段（分析 / gate 等） */
  segIndex: number;
  status: string;
  attempt: number;
  billingRequestId?: string;
  gatewayCallId?: string;
  gatewayStatus?: string;
  errorClass?: string;
  errorCode?: string;
  errorMsg?: string;
  retryOf?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

/** 预留单：镜像（replicate 自己存的状态）与计费真实状态并排，mismatch 就是该人工看的 */
export interface AdminCharge {
  id: number;
  segIndex: number;
  stage: string;
  requestId: string;
  seconds: number;
  points: number;
  mirrorStatus: number;
  mirrorLabel: string;
  reason?: string;
  /** afv_billing_reservation.status；没有单为空 */
  billingStatus: string;
  reservationNo?: string;
  mismatch: boolean;
  /** 现在人工退能退多少 */
  refundablePoints: number;
  blockedReason?: string;
  settledAt?: string;
}

export interface AdminSegment {
  index: number;
  /** 链尾步骤状态 */
  state: string;
  gatewayCallIds?: string[];
  failReason?: string;
  steps: AdminStep[];
  charges: AdminCharge[];
  refundablePoints: number;
  canRefund: boolean;
}

export interface AdminModeration {
  id: number;
  planNo: string;
  /** PASSED / REJECTED / ERROR_OPEN … */
  status: string;
  reason: string;
  createdAt: string;
}

export interface AdminModerationLog {
  id: number;
  bizType: string;
  provider: string;
  passed: number;
  label?: string;
  rejectedTarget?: string;
  reason?: string;
  createTime: string;
}

export interface AdminAction {
  id: number;
  action: 'REFUND' | 'FORCE_FINISH' | string;
  adminId: number;
  segIndex: number;
  reason: string;
  points: number;
  /** RUNNING / DONE / FAILED */
  status: string;
  createdAt: string;
}

export interface AdminJobDetail {
  job: AdminJobRow;
  /** 方案输入（原样 JSON，供排查） */
  input: unknown;
  result: unknown;
  segments: AdminSegment[];
  steps: AdminStep[];
  charges: AdminCharge[];
  moderations: AdminModeration[];
  moderationLogs: AdminModerationLog[];
  actions: AdminAction[];
  /** false = admin-api 的 ReplicateAdmin.Billing 没开，退点 / 收尾会回 7003 BILLING_OFF */
  billingOn: boolean;
  canRefund: boolean;
  canForce: boolean;
  forceBlocker?: string;
}

export interface RefundLine {
  segIndex: number;
  requestId: string;
  before: string;
  points: number;
  error?: string;
  mirrorDone: boolean;
}

export interface RefundResult {
  actionId: number;
  points: number;
  lines: RefundLine[];
  replay: boolean;
  status: string;
}

export interface ForceResult {
  actionId: number;
  replay: boolean;
  jobId: number;
  fromStatus: string;
  status: string;
  canceledSteps: number;
  /** 收尾后仍未结清的镜像（扣费 / 退点调用失败，轮询器继续补扫） */
  openCharges: number;
  message: string;
}

// ---------------------------------------------------------------- 归一化

type Obj = Record<string, unknown>;
const pick = (o: Obj, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);

const normModeration = (o: Obj): AdminModeration => ({
  id: Number(pick(o, 'id', 'ID') ?? 0),
  planNo: String(pick(o, 'planNo', 'PlanNo') ?? ''),
  status: String(pick(o, 'status', 'Status') ?? ''),
  reason: String(pick(o, 'reason', 'Reason') ?? ''),
  createdAt: String(pick(o, 'createdAt', 'CreatedAt') ?? ''),
});

const normAction = (o: Obj): AdminAction => ({
  id: Number(pick(o, 'id', 'ID') ?? 0),
  action: String(pick(o, 'action', 'Action') ?? ''),
  adminId: Number(pick(o, 'adminId', 'AdminID') ?? 0),
  segIndex: Number(pick(o, 'segIndex', 'SegIndex') ?? 0),
  reason: String(pick(o, 'reason', 'Reason') ?? ''),
  points: Number(pick(o, 'points', 'Points') ?? 0),
  status: String(pick(o, 'status', 'Status') ?? ''),
  createdAt: String(pick(o, 'createdAt', 'CreatedAt') ?? ''),
});

function normDetail(raw: Obj): AdminJobDetail {
  return {
    job: raw.job as AdminJobRow,
    input: raw.input ?? null,
    result: raw.result ?? null,
    segments: arr(raw.segments).map((x) => {
      const seg = x as unknown as AdminSegment;
      return { ...seg, steps: seg.steps ?? [], charges: seg.charges ?? [] };
    }),
    steps: (raw.steps as AdminStep[]) ?? [],
    charges: (raw.charges as AdminCharge[]) ?? [],
    moderations: arr(raw.moderations).map(normModeration),
    moderationLogs: (raw.moderationLogs as AdminModerationLog[]) ?? [],
    actions: arr(raw.actions).map(normAction),
    billingOn: raw.billingOn !== false,
    canRefund: !!raw.canRefund,
    canForce: !!raw.canForce,
    forceBlocker: (raw.forceBlocker as string) || undefined,
  };
}

// ---------------------------------------------------------------- 接口

export const getAdminJobs = (query: AdminJobQuery) =>
  call<AdminJobPage>('GET', '/jobs', {
    params: query as Record<string, unknown>,
  });

export const getAdminJob = async (jobId: number) =>
  normDetail(await call<Obj>('GET', `/jobs/${jobId}`));

/** 每次新的退点动作生成一个幂等键；部分失败（5001）重试时复用同一个，后端只补退剩下的 */
export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * 人工退点。expectedPoints 必填（页面展示的可退合计）。
 * 409 reason：POINTS_CHANGED（合计变了，不动钱）、NOTHING_TO_REFUND、IN_PROGRESS（同键正在处理）；
 * code 5001 = 部分单退失败且无明细，用同一个 idempotencyKey 重试。
 */
export const refundJobSegments = (
  jobId: number,
  body: { segIndexes: number[]; reason: string; expectedPoints: number },
  idempotencyKey: string,
) =>
  call<RefundResult>('POST', `/jobs/${jobId}/refund`, {
    data: body,
    silent: true,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

/** 强制收尾；有在途段 → 409 IN_FLIGHT */
export const forceFinishJob = (jobId: number, body: { reason: string }, idempotencyKey: string) =>
  call<ForceResult>('POST', `/jobs/${jobId}/force-finish`, {
    data: body,
    silent: true,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

// ---------------------------------------------------------------- 总开关（契约 §9.x，Go_V1.0.50）

/**
 * 视频做同款总开关：数据库 > 部署配置。库里 replicate.enabled 存在且合法时以库为准（source=db），否则跟随部署配置（source=config）。
 * 关着只拦新提交，历史 / 我的方案 / 在途任务照常；改动 effectSeconds 秒内在网关生效。
 */
export interface ReplicateSwitch {
  enabled: boolean;
  source: 'db' | 'config';
  /** 部署配置里的默认值（source=config 时生效） */
  configDefault: boolean;
  /** 库里的原值（库里有这一行才有；值非法时 source 仍是 config） */
  dbValue?: string;
  /** 最近一次改动说明（谁、何时、原因） */
  remark?: string;
  updatedAt?: string;
  effectSeconds: number;
}

export const getReplicateSwitch = () => call<ReplicateSwitch>('GET', '/switch');

/** 写库（从此以库为准），原因必填 ≤200 字 */
export const setReplicateSwitch = (body: { enabled: boolean; reason: string }) =>
  call<ReplicateSwitch>('PUT', '/switch', { data: body });

/** 恢复跟随部署配置（逻辑删除库里这一行），原因必填 */
export const resetReplicateSwitch = (body: { reason: string }) =>
  call<ReplicateSwitch>('DELETE', '/switch', { data: body });

// ---------------------------------------------------------------- 示例管理（契约 §11）

/** none 从没分析过；queued / running 有一轮在跑；ready 有已发布分析；failed 上一轮失败且无已发布分析 */
export type SampleAnalysisStatus = 'none' | 'queued' | 'running' | 'ready' | 'failed';

export const isSampleAnalyzing = (s: SampleAnalysisStatus): boolean =>
  s === 'queued' || s === 'running';

export interface SampleAdminRow {
  id: number;
  title: string;
  /** 行业 code（afv_template_industry.code）；空 = 通用 */
  industry: string;
  sourceRid: string;
  coverRid: string;
  resultRid: string;
  annotations: Record<string, unknown> | null;
  sortOrder: number;
  enabled: boolean;
  analysisStatus: SampleAnalysisStatus;
  analysisStatusLabel: string;
  /** 正在跑的一轮的当前阶段 */
  analysisStage: string;
  /** ready 时也可能有值（上一轮失败的原因，已发布的分析不受影响） */
  analysisError: string;
  analysisNo: string;
  pendingAnalysisNo: string;
  round: number;
  durationS: number;
  summary: string;
  analyzedAt?: string;
  published: boolean;
  /** 启用但还没有已发布分析 → false（用户端看不到） */
  userVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SampleAdminDetail extends SampleAdminRow {
  /** 已发布的分析结果（与用户端 AnalysisView.result 同结构），没有为 null */
  analysis: unknown;
}

export interface SampleAdminPage {
  items: SampleAdminRow[];
  total: number;
  page: number;
  size: number;
}

export interface SampleAdminQuery {
  industry?: string;
  /** '0' / '1' / 不传 */
  enabled?: '0' | '1';
  page?: number;
  /** 默认 20，最大 100 */
  size?: number;
}

export interface SampleSaveBody {
  /** 必填，≤40 字 */
  title: string;
  /** ≤64；空 = 通用 */
  industry: string;
  /** 裸 rid 或 mr://rid */
  sourceRid: string;
  coverRid?: string;
  resultRid?: string;
  /** 只认十一项 key 与三种改法，后端校验 */
  annotations?: Record<string, unknown> | null;
  sortOrder?: number;
  enabled?: boolean;
  /** true = 保存后立即预分析 */
  analyze?: boolean;
}

/** 上一轮预分析还在跑（POST /samples/{id}/analyze 的 409 reason） */
export const SAMPLE_ANALYZING = 'SAMPLE_ANALYZING';

export const getSamples = (query: SampleAdminQuery) =>
  call<SampleAdminPage>('GET', '/samples', {
    params: query as Record<string, unknown>,
  });

export const getSample = (id: number) => call<SampleAdminDetail>('GET', `/samples/${id}`);

export const createSample = (body: SampleSaveBody) =>
  call<SampleAdminRow>('POST', '/samples', { data: body });

/** 整体覆盖；换了 sourceRid 会清掉已发布的分析，须重新预分析 */
export const updateSample = (id: number, body: SampleSaveBody) =>
  call<SampleAdminRow>('PUT', `/samples/${id}`, { data: body });

export const deleteSample = (id: number) => call<{ id: number }>('DELETE', `/samples/${id}`);

/** 触发预分析；上一轮还在跑 → ReplicateError.reason === SAMPLE_ANALYZING（静默，由页面提示） */
export const analyzeSample = (id: number) =>
  call<SampleAdminRow>('POST', `/samples/${id}/analyze`, { silent: true });

// ---------------------------------------------------------------- 示例素材上传 / 解析（Go_V1.0.50 后台）

/** 运营看到的素材信息；previewUrl 是短时效签名地址，只用于页面预览，不存库 */
export interface SampleMediaPreview {
  rid: string;
  kind: 'video' | 'image' | 'other';
  mime: string;
  bytes: number;
  durationS: number;
  width: number;
  height: number;
  previewUrl: string;
}

/** 粘贴已有素材编号（裸 rid 或 mr://rid）：校验存在并取预览 */
export const resolveSampleMedia = (rid: string) =>
  call<SampleMediaPreview>('POST', '/samples/media/resolve', { data: { rid } });

/** 上传文件到媒体服务，返回 rid 与预览。大文件需要较长时间，超时放宽到 10 分钟 */
export async function uploadSampleMedia(file: File): Promise<SampleMediaPreview> {
  if (isReplicateMock()) {
    const { handleMock } = await import('./replicate-admin.mock');
    const body = (await handleMock(
      'POST',
      '/samples/media/upload',
      {},
      { fileName: file.name },
    )) as Envelope<SampleMediaPreview>;
    if (body.code !== 0) throw new ReplicateError(body.code, body.msg, body.reason, body.data);
    return body.data;
  }
  const fd = new FormData();
  fd.append('file', file);
  const res: AxiosResponse<Envelope<SampleMediaPreview>> = await http.post(
    `${PREFIX}/samples/media/upload`,
    fd,
    {
      headers: { 'Content-Type': undefined },
      timeout: 10 * 60 * 1000,
    },
  );
  const body = res.data;
  if (body.code !== 0) {
    message.error(body.msg || '上传失败');
    throw new ReplicateError(body.code, body.msg || 'error', body.reason, body.data);
  }
  return body.data;
}
