import type { PageResult } from '@/types/api';

import { request } from '@/utils/request';

// ============ 枚举 ============
export type PromptType = 'optimize' | 'agent';
export type AgentRole = 'system' | 'instruction' | 'override';
export type VersionStatus = 'draft' | 'published' | 'archived';
export type SlotType = 'text' | 'select' | 'chip' | 'image' | 'number' | 'separator';
export type VarType = 'text' | 'enum' | 'block';
export type FilterType = 'select' | 'multi';
export type TestStatus = 'success' | 'failed';

// ============ 提示词主体 ============
export interface Prompt {
  id: number;
  code: string;
  /** 目标生成模型编码（专用提示词专用模型）；空=通用默认 */
  targetModelCode?: string;
  type: PromptType;
  agentRole?: AgentRole | null;
  agentCode?: string | null;
  subAgentKey?: string | null;
  name: string;
  categoryId?: number;
  description?: string;
  tags?: string[];
  status: number;
  activeVersionId: number;
  owner?: string;
  /**
   * 导入来源文件路径；空 = 管理端手工创建、无源文件，「同步文件」对它无效。
   * 注意历史数据（source_path 列加上之前导入的）也为空，故仅用于「是否禁用按钮」的提示性判断。
   */
  sourcePath?: string;
  usageCount?: number;
  lastUsedTime?: string;
  createTime?: string;
  updateTime?: string;
}

// ============ 版本 ============
export interface PromptVersion {
  id: number;
  promptId: number;
  versionNo: number;
  status: VersionStatus;
  content?: string;
  structure?: unknown;
  slots?: unknown;
  variables?: unknown;
  outputSchema?: unknown;
  textModelId?: number | null;
  visionModelId?: number | null;
  modelParams?: unknown;
  safetyBlockId?: number | null;
  changelog?: string;
  createdBy?: string;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface PromptDetail {
  prompt: Prompt;
  versions: PromptVersion[];
}

export interface VersionDiff {
  versionNoA: number;
  versionNoB: number;
  contentA?: string;
  contentB?: string;
  identical: boolean;
}

export interface ImportResult {
  /** 新建的优化模板数（首次导入，直接发布为 v1） */
  optimizeImported: number;
  /** 新建的 Agent 提示词数（首次导入，直接发布为 v1） */
  agentImported: number;
  /** 源文件已变更、生成了待发布草稿的数量。生效版本未动，需人工 review 后发布 */
  updated: number;
  /** 源文件与上次导入一致、原样跳过的数量 */
  skipped: number;
  /** 逐条明细：optimize:xx(new) / agent:xx(draft v3) / xx(unchanged) / missing:xx(源文件未找到) */
  details: string[];
}

// ============ 测试 ============
export interface PromptTestRun {
  id: number;
  versionId: number;
  promptId: number;
  inputSnapshot?: { userInput?: string; imageUrls?: string[] };
  modelId?: number;
  output?: string;
  parseOk: number;
  latencyMs?: number;
  rating?: number;
  note?: string;
  evaluator?: string;
  status: TestStatus;
  createdBy?: string;
  createTime?: string;
}

// ============ 元数据 ============
export interface PromptCategory {
  id: number;
  parentId: number;
  name: string;
  code?: string;
  icon?: string;
  sortOrder: number;
  status: number;
}
export interface PromptSlotDef {
  id: number;
  slotKey: string;
  slotType: SlotType;
  label?: string;
  config?: unknown;
  scope: string;
  status: number;
}
export interface PromptVariableDef {
  id: number;
  varKey: string;
  name?: string;
  varType: VarType;
  varValue?: string;
  options?: unknown;
  scope: string;
  description?: string;
  status: number;
}
export interface PromptFilterDef {
  id: number;
  filterKey: string;
  name: string;
  filterType: FilterType;
  sortOrder: number;
  status: number;
}
export interface PromptFilterOption {
  id: number;
  filterId: number;
  label: string;
  value: string;
  sortOrder: number;
  status: number;
}
export interface PromptFilterVO {
  filter: PromptFilterDef;
  options: PromptFilterOption[];
}

// 请求体
export interface PromptSaveReq {
  code?: string;
  targetModelCode?: string;
  type?: PromptType;
  agentRole?: string;
  agentCode?: string;
  subAgentKey?: string;
  name?: string;
  categoryId?: number;
  description?: string;
  tags?: string[];
  status?: number;
  owner?: string;
  initialContent?: string;
}
export interface VersionSaveReq {
  content?: string;
  structure?: unknown;
  slots?: unknown;
  variables?: unknown;
  outputSchema?: unknown;
  textModelId?: number | null;
  visionModelId?: number | null;
  modelParams?: unknown;
  safetyBlockId?: number | null;
  changelog?: string;
  cloneFromVersionId?: number;
}

const BASE = '/api/v1/admin/prompts';
const META = `${BASE}/meta`;

// ============ 主体 + 版本 ============
export function pagePrompts(params: {
  keyword?: string;
  type?: string;
  categoryId?: number;
  status?: number;
  targetModelCode?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<PageResult<Prompt>>(BASE, { params });
}
export function getPromptDetail(id: number | string) {
  return request.get<PromptDetail>(`${BASE}/${id}`);
}
export function createPrompt(data: PromptSaveReq) {
  return request.post<number>(BASE, data);
}
export function updatePrompt(id: number | string, data: PromptSaveReq) {
  return request.put(`${BASE}/${id}`, data);
}
export function deletePrompt(id: number | string) {
  return request.delete(`${BASE}/${id}`);
}
export function listVersions(id: number | string) {
  return request.get<PromptVersion[]>(`${BASE}/${id}/versions`);
}
export function getVersion(versionId: number | string) {
  return request.get<PromptVersion>(`${BASE}/versions/${versionId}`);
}
export function createDraft(id: number | string, data: VersionSaveReq) {
  return request.post<number>(`${BASE}/${id}/versions`, data);
}
export function updateDraft(versionId: number | string, data: VersionSaveReq) {
  return request.put(`${BASE}/versions/${versionId}`, data);
}
export function deleteDraft(versionId: number | string) {
  return request.delete(`${BASE}/versions/${versionId}`);
}
export function publishVersion(versionId: number | string) {
  return request.post(`${BASE}/versions/${versionId}/publish`);
}
export function rollbackVersion(id: number | string, versionId: number | string) {
  return request.post(`${BASE}/${id}/rollback/${versionId}`);
}
export function diffVersions(a: number | string, b: number | string) {
  return request.get<VersionDiff>(`${BASE}/versions/diff`, { params: { a, b } });
}
/**
 * 导入/同步文件侧提示词。
 *
 * 按源文件内容 hash 与上次导入比对：未变跳过，已变生成【草稿】版本（不动生效版本），首次导入直接发布。
 *
 * @param codes 只同步这些 code；不传=全量。改一条却全量导入的话，其余变更过的文件会一并刷出草稿，
 *              还得在列表里逐条辨认哪个是自己要的。
 */
export function importExisting(codes?: string[]) {
  const params = codes?.length ? { codes: codes.join(',') } : undefined;
  return request.post<ImportResult>(`${BASE}/import`, undefined, { params });
}

/** 后台 AI 辅助优化/生成提示词内容（元提示词）。content 为空=按 instruction 从零生成。 */
export function aiOptimizeContent(data: {
  content?: string;
  instruction?: string;
  modelId?: number;
}) {
  return request.post<{ content: string }>(`${BASE}/ai-optimize`, data);
}

// ============ 测试 ============
export function runTest(data: {
  versionId: number;
  userInput?: string;
  imageUrls?: string[];
  overrideModelId?: number;
  /** 临时系统提示词（仅本次测试，不写回版本） */
  contentOverride?: string;
}) {
  return request.post<PromptTestRun>(`${BASE}/test/run`, data);
}
export function rateTest(testRunId: number, data: { rating?: number; note?: string }) {
  return request.post(`${BASE}/test/${testRunId}/rate`, data);
}
/** 干跑预览：返回组装后的系统提示词全文（渲染变量+安全块，不调模型/不计费/不落库） */
export function dryRunPreview(data: { versionId: number; contentOverride?: string }) {
  return request.post<{ versionId: number; systemPrompt: string }>(`${BASE}/test/dry-run`, data);
}
export function listTestRuns(versionId: number | string) {
  return request.get<PromptTestRun[]>(`${BASE}/test/version/${versionId}`);
}

// ============ 元数据 ============
export function listCategories() {
  return request.get<PromptCategory[]>(`${META}/categories`);
}
export function createCategory(data: Partial<PromptCategory>) {
  return request.post<number>(`${META}/categories`, data);
}
export function updateCategory(id: number, data: Partial<PromptCategory>) {
  return request.put(`${META}/categories/${id}`, data);
}
export function deleteCategory(id: number) {
  return request.delete(`${META}/categories/${id}`);
}

export function listSlots(scope?: string) {
  return request.get<PromptSlotDef[]>(`${META}/slots`, { params: { scope } });
}
export function createSlot(data: Partial<PromptSlotDef>) {
  return request.post<number>(`${META}/slots`, data);
}
export function updateSlot(id: number, data: Partial<PromptSlotDef>) {
  return request.put(`${META}/slots/${id}`, data);
}
export function deleteSlot(id: number) {
  return request.delete(`${META}/slots/${id}`);
}

export function listVariables(varType?: string) {
  return request.get<PromptVariableDef[]>(`${META}/variables`, { params: { varType } });
}
export function createVariable(data: Partial<PromptVariableDef>) {
  return request.post<number>(`${META}/variables`, data);
}
export function updateVariable(id: number, data: Partial<PromptVariableDef>) {
  return request.put(`${META}/variables/${id}`, data);
}
export function deleteVariable(id: number) {
  return request.delete(`${META}/variables/${id}`);
}

export function listFilters() {
  return request.get<PromptFilterVO[]>(`${META}/filters`);
}
export function createFilter(data: Partial<PromptFilterDef>) {
  return request.post<number>(`${META}/filters`, data);
}
export function updateFilter(id: number, data: Partial<PromptFilterDef>) {
  return request.put(`${META}/filters/${id}`, data);
}
export function deleteFilter(id: number) {
  return request.delete(`${META}/filters/${id}`);
}
export function addFilterOption(filterId: number, data: Partial<PromptFilterOption>) {
  return request.post<number>(`${META}/filters/${filterId}/options`, data);
}
export function deleteFilterOption(optionId: number) {
  return request.delete(`${META}/filter-options/${optionId}`);
}
