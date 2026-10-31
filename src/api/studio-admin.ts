import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 创作工坊（studio：商拍 / 姿态 / 图片生成）运营后台接口。
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
  page_size?: number;
  user_id?: number;
  /** tryon 商拍 / pose 姿态 / imagegen 图片生成；空 = 全部 */
  kind?: StudioKind | '';
  /** -1 全部；0 排队 1 切图中 2 反推中 3 生图中 4 全部成功 5 全部失败 6 部分成功 7 已取消 */
  status?: number;
  /** 创建时间起（unix 毫秒，含） */
  start_at?: number;
  /** 创建时间止（unix 毫秒，不含） */
  end_at?: number;
}

export interface Batch {
  id: number;
  user_id: number;
  workspace_id: number;
  kind: StudioKind | string;
  status: number;
  request_id: string;
  /** JSON 文本 */
  payload: string;
  task_total: number;
  task_done: number;
  task_failed: number;
  estimated_points: number;
  cost_cny: string;
  model_group: string;
  error_reason: string;
  cover_url: string;
  created_at: number;
  updated_at: number;
}

export interface Task {
  id: number;
  task_id: string;
  model_index: number;
  shot_index: number;
  pose_index: number;
  /** 0 排队 1 生成中 2 成功 3 失败 4 已取消 */
  status: number;
  result_url: string;
  result_width: number;
  result_height: number;
  error_reason: string;
  model_group: string;
  /** 完整提示词 */
  prompt_text: string;
  /** JSON 文本 */
  prompt_meta: string;
  /** 送生图的图序（JSON 文本） */
  input_images: string;
  gateway_call_id: string;
  gateway_status: string;
  attempt: number;
  admin_locked: boolean;
  cost_cny: string;
  billing_request_id: string;
  /** 0 未计费 1 已冻结 2 已结算 3 已退回 4 影子模式 */
  billing_status: number;
  duration_ms: number;
  created_at: number;
  started_at: number;
  finished_at: number;
}

/** step_log 数组的一项（后端以 JSON 文本返回，页面里 JSON.parse） */
export interface StepLog {
  step: string;
  ms: number;
  images?: number;
  crops?: number;
  degraded?: boolean;
  cost_cny?: number;
  task_total?: number;
  detail?: string;
  at: number;
}

export interface BatchDetail {
  batch: Batch;
  /** 切图框（JSON 文本，0–1 归一化） */
  crop_plan: string;
  /** 切图质检（JSON 文本） */
  crop_check: string;
  /** 组图（JSON 文本） */
  selected_images: string;
  /** 每步耗时与成本（JSON 文本） */
  step_log: string;
  tasks: Task[];
}

export interface CostRow {
  key: string;
  task_total: number;
  task_succeeded: number;
  task_failed: number;
  cost_cny: string;
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
  base_url: string;
  latency_ms: number;
  version: string;
  detail: string;
}

export interface SidecarStatus {
  deps: Dependency[];
  running_tasks: number;
  queued_batches: number;
}

export interface CostQuery {
  start_at?: number;
  end_at?: number;
  group_by?: 'kind' | 'model_group';
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
