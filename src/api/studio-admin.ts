import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 创作商拍（studio：商拍 / 姿态 / 图片生成）运营后台接口。
 * fusion_aigc_go 的 admin-api，前缀 /api/v1/studio/admin。
 *
 * 信封与鉴权与 local-life-admin 一致：HTTP 恒为 200，业务结果看 code（0 成功；1002 未登录）。
 * local-life-admin 的 axios 实例是模块私有的，这里照抄一份，互不影响。
 */
const PREFIX = '/api/v1/studio/admin';

const http = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface Envelope<T> {
  code: number;
  msg: string;
  data: T;
}

export const STUDIO_CODE_UNAUTHORIZED = 1002;

async function call<T>(request: Promise<AxiosResponse<Envelope<T>>>): Promise<T> {
  let body: Envelope<T>;
  try {
    body = (await request).data;
  } catch {
    message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === STUDIO_CODE_UNAUTHORIZED) {
    clearTokens();
    if (router.currentRoute.value.path !== '/login') {
      router.push({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } else {
    message.error(body.msg || '操作失败');
  }
  throw new Error(body.msg || 'error');
}

// ---------------- 类型 ----------------

export type StudioKind = 'tryon' | 'pose' | 'imagegen';

export interface PageList<T> {
  list: T[];
  total: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  /** tryon 商拍 / pose 姿态 / imagegen 图片生成；空 = 全部 */
  kind?: StudioKind | '';
  /** -1 全部；0 排队 1 切图中 2 反推中 3 生图中 4 全部成功 5 全部失败 6 部分成功 7 已取消 */
  status?: number;
  /** 创建时间起（unix 毫秒，含） */
  startAt?: number;
  /** 创建时间止（unix 毫秒，不含） */
  endAt?: number;
}

export interface Batch {
  id: number;
  userId: number;
  workspaceId: number;
  kind: StudioKind | string;
  status: number;
  requestId: string;
  /** JSON 文本 */
  payload: string;
  taskTotal: number;
  taskDone: number;
  taskFailed: number;
  estimatedPoints: number;
  costCny: string;
  modelGroup: string;
  errorReason: string;
  coverUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: number;
  taskId: string;
  modelIndex: number;
  shotIndex: number;
  poseIndex: number;
  /** 0 排队 1 生成中 2 成功 3 失败 4 已取消 */
  status: number;
  resultUrl: string;
  resultWidth: number;
  resultHeight: number;
  errorReason: string;
  modelGroup: string;
  /** 完整提示词 */
  promptText: string;
  /** JSON 文本 */
  promptMeta: string;
  /** 送生图的图序（JSON 文本） */
  inputImages: string;
  gatewayCallId: string;
  gatewayStatus: string;
  attempt: number;
  adminLocked: boolean;
  costCny: string;
  billingRequestId: string;
  /** 0 未计费 1 已冻结 2 已结算 3 已退回 4 影子模式 */
  billingStatus: number;
  durationMs: number;
  createdAt: number;
  startedAt: number;
  finishedAt: number;
}

/** step_log 数组的一项（后端以 JSON 文本返回，页面里 JSON.parse） */
export interface StepLog {
  step: string;
  ms: number;
  images?: number;
  crops?: number;
  degraded?: boolean;
  costCny?: number;
  taskTotal?: number;
  detail?: string;
  at: number;
}

export interface BatchDetail {
  batch: Batch;
  /** 切图框（JSON 文本，0–1 归一化） */
  cropPlan: string;
  /** 切图质检（JSON 文本） */
  cropCheck: string;
  /** 组图（JSON 文本） */
  selectedImages: string;
  /** 每步耗时与成本（JSON 文本） */
  stepLog: string;
  tasks: Task[];
  /** 排查视图（JSON 文本，解析为 StudioDiagnostics）：任务链路 / 工作流步骤 / 诊断 / 时间线 */
  diagnostics?: string;
}

/** 与 Java 任务详情的 TaskTrace / WorkflowStep / Diagnosis / TimelineEvent 口径对齐 */
export interface StudioTraceStage {
  key: string;
  source: string;
  name: string;
  /** done / running / failed / pending */
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  check: string | null;
  detail: string | null;
}

/** 一张图：ref 是库里的原始引用（可复制），url 是后端现签的短期预览地址，签不出为 null */
export interface StudioImage {
  ref: string;
  url: string | null;
  id?: string;
  role?: string;
}

export interface StudioTaskMedia {
  taskId: string;
  /** 统一链路 /creation/tasks/{id}/spans 用的任务号（AiCreation_LF_…） */
  traceTaskId: string;
  /** 送生图的图序 */
  inputs: StudioImage[];
  output: StudioImage | null;
  mask: StudioImage | null;
  maskParts: { part: string; image: StudioImage }[];
}

export interface StudioMedia {
  selectedImages: { modelIndex: number; images: StudioImage[] }[];
  tasks: StudioTaskMedia[];
}

export interface StudioDiagnostics {
  media?: StudioMedia;
  trace: {
    taskId: string;
    traceId: string;
    generatedAt: string;
    stuckAt: {
      stage: string;
      source: string;
      since: string;
      elapsedMs: number;
      reason: string;
    } | null;
    stages: StudioTraceStage[];
    terminal: boolean;
  };
  workflowSteps: {
    stepPath: string;
    taskId?: string;
    traceTaskId?: string;
    status: string;
    operation: string;
    modelGroup: string | null;
    gatewayCallId: string | null;
    attempt: number;
    startedAt: string | null;
    finishedAt: string | null;
    errorMsg: string | null;
  }[];
  diagnosis: {
    task: {
      taskId: string;
      type: string;
      status: string;
      statusLabel: string;
      errorMsg: string;
      createTime: string;
      updateTime: string;
    } | null;
    failingStep: {
      stepPath: string;
      status: string;
      operation: string;
      failureMessage: string;
      gatewayCallId: string | null;
      attemptCount: number;
      startedAt: string | null;
      completedAt: string | null;
    } | null;
    steps: { total: number; byStatus: Record<string, number> };
    billing: {
      billingStatus: string;
      reservationStatus: string;
      pricePoints: number;
      settled: boolean;
    };
    hints: { text: string }[];
  };
  timeline: {
    id: number;
    ts: string;
    stepPath: string;
    kind: string;
    status: string;
    message?: string;
    source: string;
  }[];
}

export interface CostRow {
  key: string;
  taskTotal: number;
  taskSucceeded: number;
  taskFailed: number;
  costCny: string;
  points: number;
}

export interface CostSummary {
  rows: CostRow[];
  total: CostRow;
}

export interface Dependency {
  /** sidecar / ai-gateway / media */
  name: string;
  ok: boolean;
  baseUrl: string;
  latencyMs: number;
  version: string;
  detail: string;
}

export interface SidecarStatus {
  deps: Dependency[];
  runningTasks: number;
  queuedBatches: number;
}

export interface CostQuery {
  startAt?: number;
  endAt?: number;
  groupBy?: 'kind' | 'model_group';
}

// ---------------- 接口 ----------------

export function listBatches(query: ListQuery) {
  return call<PageList<Batch>>(http.get(`${PREFIX}/batches`, { params: query }));
}

export function getBatch(id: number | string) {
  return call<BatchDetail>(http.get(`${PREFIX}/batches/${id}`));
}

export function retryTask(taskId: string) {
  return call<unknown>(http.post(`${PREFIX}/tasks/${encodeURIComponent(taskId)}/retry`));
}

export function forceFailTask(taskId: string) {
  return call<unknown>(http.post(`${PREFIX}/tasks/${encodeURIComponent(taskId)}/force-fail`));
}

export function getSidecarStatus() {
  return call<SidecarStatus>(http.get(`${PREFIX}/sidecar/status`));
}

export function getCostSummary(query: CostQuery) {
  return call<CostSummary>(http.get(`${PREFIX}/cost-summary`, { params: query }));
}
