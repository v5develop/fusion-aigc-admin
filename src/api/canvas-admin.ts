import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';

import router from '@/router';
import { toSnakeKeys } from '@/utils/api-keys';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 画布 / 提示词库运营后台接口。
 * fusion_aigc_go 的 admin-api，前缀 /api/v1/canvas/admin 与 /api/v1/prompt-library/admin。
 *
 * 信封与鉴权与 local-life-admin 一致：HTTP 恒为 200，业务结果看 code（0 成功；1002 未登录）。
 * local-life-admin 的 axios 实例是模块私有的，这里照抄一份，互不影响。
 */
const CANVAS = '/api/v1/canvas/admin';
const PROMPT = '/api/v1/prompt-library/admin';

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

export const CANVAS_CODE_UNAUTHORIZED = 1002;

async function call<T>(request: Promise<AxiosResponse<Envelope<T>>>): Promise<T> {
  let body: Envelope<T>;
  try {
    body = (await request).data;
  } catch {
    message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === CANVAS_CODE_UNAUTHORIZED) {
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

export interface PageList<T> {
  list: T[];
  total: number;
}

export type RunKind =
  | 'image'
  | 'video'
  | 'tool_crop'
  | 'tool_upscale'
  | 'tool_outpaint'
  | 'tool_inpaint'
  | 'tool_i2p'
  | 'tool_tryon';

export type RunBackend = 'gateway' | 'media' | 'java' | 'studio';

export interface RunsQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  canvasId?: string;
  kind?: RunKind | '';
  /** -1 全部；0 排队 1 运行中 2 成功 3 失败 4 已取消 5 提交中 */
  status?: number;
  backend?: RunBackend | '';
  /** unix 毫秒 */
  start?: number;
  end?: number;
}

export interface CanvasRun {
  /** = request_id */
  id: number;
  runId: string;
  taskId: string;
  userId: number;
  canvasId: string;
  nodeId: string;
  kind: string;
  /** submitting / queued / running / succeeded / failed / cancelled */
  status: string;
  progress: number;
  model: string;
  modelGroup: string;
  backend: string;
  backendRef: string;
  billingRequestId: string;
  /** none / held / settled / unsettled（已交付但确认扣费失败，待对账）/ refunded / shadow / java / studio / review */
  billingStatus: string;
  credits: number;
  costCny: string;
  attempt: number;
  candidates: string[];
  videoUrl: string;
  text: string;
  error: string;
  errorCode: string;
  /** RunNodeRequest JSON 文本；蒙版只存 mask_rid，不再有 mask_data_url */
  request: string;
  createdAt: number;
  startedAt: number;
  finishedAt: number;
}

export interface CostQuery {
  start?: number;
  end?: number;
  groupBy?: 'kind' | 'model_group';
}

export interface CostRow {
  key: string;
  runs: number;
  succeeded: number;
  failed: number;
  canceled: number;
  costCny: string;
  points: number;
}

export interface TemplatesQuery {
  page?: number;
  pageSize?: number;
  scope?: '' | 'official' | 'user';
  /** -1 全部 */
  enabled?: number;
  q?: string;
}

export interface CanvasTemplate {
  id: number;
  scope: string;
  userId: number;
  title: string;
  description: string;
  coverUrl: string;
  sort: number;
  enabled: boolean;
  nodeCount: number;
  edgeCount: number;
  /** JSON 文本 {nodes, edges} */
  snapshot: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateUpsert {
  title: string;
  description?: string;
  snapshot: string;
  coverUrl?: string;
  sort?: number;
  enabled?: boolean;
}

export interface PromptsQuery {
  page?: number;
  pageSize?: number;
  scope?: 'official' | 'user' | 'all';
  vertical?: string;
  group?: string;
  /** -1 全部 */
  enabled?: number;
  q?: string;
}

export interface PromptItem {
  id: number;
  /** 0 = 官方 */
  userId: number;
  title: string;
  prompt: string;
  vertical: string;
  group: string;
  models: string[];
  tags: string[];
  source: string;
  owner: string;
  enabled: boolean;
  sort: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptUpsert {
  title: string;
  prompt: string;
  vertical: 'ecommerce' | 'general';
  group: string;
  models?: string[];
  tags?: string[];
  source?: string;
  sort?: number;
  enabled?: boolean;
}

// ---------------- 接口：画布 ----------------

export function listRuns(query: RunsQuery) {
  return call<PageList<CanvasRun>>(http.get(`${CANVAS}/runs`, { params: toSnakeKeys(query) }));
}

export function forceFailRun(id: number, reason?: string) {
  return call<unknown>(
    http.post(`${CANVAS}/runs/${id}/force-fail`, { reason: reason || undefined }),
  );
}

export function getCostSummary(query: CostQuery) {
  return call<{ rows: CostRow[] }>(
    http.get(`${CANVAS}/cost-summary`, { params: toSnakeKeys(query) }),
  );
}

export function listTemplates(query: TemplatesQuery) {
  return call<PageList<CanvasTemplate>>(
    http.get(`${CANVAS}/templates`, { params: toSnakeKeys(query) }),
  );
}

export function createTemplate(body: TemplateUpsert) {
  return call<CanvasTemplate>(http.post(`${CANVAS}/templates`, body));
}

export function updateTemplate(id: number, body: TemplateUpsert) {
  return call<CanvasTemplate>(http.put(`${CANVAS}/templates/${id}`, body));
}

export function toggleTemplate(id: number, enabled: boolean) {
  return call<unknown>(http.post(`${CANVAS}/templates/${id}/toggle`, { enabled }));
}

// ---------------- 接口：提示词库 ----------------

export function listPrompts(query: PromptsQuery) {
  return call<PageList<PromptItem>>(http.get(`${PROMPT}/prompts`, { params: toSnakeKeys(query) }));
}

export function createPrompt(body: PromptUpsert) {
  return call<PromptItem>(http.post(`${PROMPT}/prompts`, body));
}

export function updatePrompt(id: number, body: PromptUpsert) {
  return call<PromptItem>(http.put(`${PROMPT}/prompts/${id}`, body));
}

export function togglePrompt(id: number, enabled: boolean) {
  return call<unknown>(http.post(`${PROMPT}/prompts/${id}/toggle`, { enabled }));
}
