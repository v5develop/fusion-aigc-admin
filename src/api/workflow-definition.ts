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

export interface WorkflowDefinitionDetail extends WorkflowDefinitionItem {
  /** currentVersion 的内容；未发布过为 null */
  content?: unknown;
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

export function listWorkflowDefinitions() {
  return request.get<unknown>(BASE, cfg()).then(listOf<WorkflowDefinitionItem>);
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

/** 从发布失败的错误里取校验错误列表；不是校验失败返回 undefined */
export function publishErrorsOf(e: unknown): WorkflowValidationError[] | undefined {
  const d = errorDataOf<{ errors?: WorkflowValidationError[] }>(e);
  return d && Array.isArray(d.errors) ? d.errors : undefined;
}
