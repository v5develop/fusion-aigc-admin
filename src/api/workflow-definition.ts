import type { AxiosRequestConfig } from 'axios';

import { errorDataOf, request } from '@/utils/request';

/**
 * 工作流定义管理：草稿、校验、发布、版本。
 * 基路径 `/api/v1/admin/workflow-definitions`，应答为 CommonResult，拦截器已解包。
 */
const BASE = '/api/v1/admin/workflow-definitions';

function cfg(extra?: Record<string, unknown>): AxiosRequestConfig {
  return { noErrorRedirect: true, ...extra } as AxiosRequestConfig;
}

/** 发布/新建不是幂等操作，不自动重传 */
function writeCfg(extra?: Record<string, unknown>): AxiosRequestConfig {
  return cfg({ noRetry: true, ...extra });
}

export interface WorkflowDefinitionItem {
  id: number | string;
  code: string;
  name: string;
  status?: string;
  currentVersion?: number | null;
  updateTime?: string;
}

/** 画布节点坐标：步骤 id → {x, y}。与版本无关，单独存取，不参与校验 */
export type WorkflowDefinitionLayout = Record<string, { x: number; y: number }>;

export interface WorkflowDefinitionDetail extends WorkflowDefinitionItem {
  /** currentVersion 的内容；未发布过为 null */
  content?: unknown;
  /** 编辑器画布坐标（后端未上线时没有该字段） */
  layout?: WorkflowDefinitionLayout | null;
}

export interface WorkflowDefinitionVersion {
  version: number;
  publishedAt?: string;
  publishedBy?: string;
}

/** 校验错误：字符串或 {path, message} */
export type WorkflowValidationError = string | { path?: string; message?: string };

export interface WorkflowValidateResult {
  valid: boolean;
  errors?: WorkflowValidationError[];
}

export function formatValidationError(e: WorkflowValidationError): string {
  if (typeof e === 'string') return e;
  if (!e) return '';
  return e.path ? `${e.path}: ${e.message ?? ''}` : (e.message ?? JSON.stringify(e));
}

function listOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: T[] }).items;
  }
  return [];
}

export interface WorkflowDefinitionPage {
  list: WorkflowDefinitionItem[];
  total: number;
}

/** 后端分页：PageResult { list, total }，参数 page（从 1 起）、pageSize（≤100） */
export function listWorkflowDefinitions(page = 1, pageSize = 20) {
  return request
    .get<unknown>(BASE, { ...cfg(), params: { page, pageSize } })
    .then((res): WorkflowDefinitionPage => {
      const r = (res ?? {}) as { list?: unknown; total?: unknown };
      const list = Array.isArray(r.list) ? (r.list as WorkflowDefinitionItem[]) : listOf<WorkflowDefinitionItem>(res);
      return { list, total: typeof r.total === 'number' ? r.total : list.length };
    });
}

export function createWorkflowDefinition(data: { code: string; name: string }) {
  return request.post<number | string>(BASE, data, writeCfg());
}

export function getWorkflowDefinition(id: number | string) {
  return request.get<WorkflowDefinitionDetail>(`${BASE}/${id}`, cfg());
}

export function validateWorkflowDefinition(id: number | string, definition: unknown) {
  return request.post<WorkflowValidateResult>(`${BASE}/${id}/validate`, definition, cfg());
}

/** 校验失败时 reject，错误对象的 data.errors 为错误列表（用 publishErrorsOf 读取） */
export function publishWorkflowDefinition(id: number | string, definition: unknown) {
  return request.post<{ version: number }>(`${BASE}/${id}/publish`, definition, writeCfg());
}

export function listWorkflowDefinitionVersions(id: number | string) {
  return request
    .get<unknown>(`${BASE}/${id}/versions`, cfg())
    .then(listOf<WorkflowDefinitionVersion>);
}

export function getWorkflowDefinitionVersion(id: number | string, version: number) {
  return request.get<unknown>(`${BASE}/${id}/versions/${version}`, cfg());
}

export function listWorkflowStepKinds() {
  return request.get<unknown>(`${BASE}/step-kinds`, cfg()).then(listOf<string>);
}

export interface WorkflowStepParamSchema {
  name: string;
  /** 参数类型：string | integer | boolean | object | list | media | any（与后端 StepKindSchema 一致） */
  type?: string;
  required?: boolean;
  description?: string;
}

export interface WorkflowStepKindSchema {
  kind: string;
  description?: string;
  params: WorkflowStepParamSchema[];
  outputs: string[];
}

export type WorkflowDefinitionStatus = 'ENABLED' | 'DISABLED';

/** 步骤类型的参数说明；后端未上线时 404（用 isEndpointMissing 判断） */
export function listWorkflowStepKindSchemas() {
  return request
    .get<unknown>(`${BASE}/step-kinds/schema`, cfg({ silentError: true, noRetry: true }))
    .then((res) =>
      listOf<WorkflowStepKindSchema>(res)
        .filter((k) => k && typeof k.kind === 'string')
        .map((k) => ({
          kind: k.kind,
          description: k.description,
          params: Array.isArray(k.params) ? k.params.filter((p) => p && p.name) : [],
          outputs: Array.isArray(k.outputs) ? k.outputs : [],
        })),
    );
}

/** 启用/停用定义 */
export function setWorkflowDefinitionStatus(id: number | string, status: WorkflowDefinitionStatus) {
  return request.post<unknown>(`${BASE}/${id}/status`, { status }, writeCfg({ silentError: true }));
}

/** 把旧版本重新发布为新的最新版本 */
export function restoreWorkflowDefinitionVersion(id: number | string, version: number) {
  return request.post<{ version: number }>(
    `${BASE}/${id}/versions/${version}/restore`,
    undefined,
    writeCfg({ silentError: true }),
  );
}

/** 保存画布坐标（整表覆盖）；不发布版本 */
export function saveWorkflowDefinitionLayout(
  id: number | string,
  layout: WorkflowDefinitionLayout,
) {
  return request.put<unknown>(`${BASE}/${id}/layout`, layout, writeCfg({ silentError: true }));
}

/** 接口不存在（后端尚未上线）：HTTP 404 或 CommonResult code 404 */
export function isEndpointMissing(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { status?: number; code?: number; response?: { status?: number } };
  return err.status === 404 || err.code === 404 || err.response?.status === 404;
}

/** 当前账号无权访问（403）：页面上的附属区块据此静默隐藏，而不是报错 */
export function isForbidden(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { status?: number; code?: number; response?: { status?: number } };
  return err.status === 403 || err.code === 403 || err.response?.status === 403;
}

/** 从发布失败的错误里取校验错误列表；不是校验失败返回 undefined */
export function publishErrorsOf(e: unknown): WorkflowValidationError[] | undefined {
  const d = errorDataOf<{ errors?: WorkflowValidationError[] }>(e);
  return d && Array.isArray(d.errors) ? d.errors : undefined;
}
