import type { PageResult } from '@/types/api';

import { request } from '@/utils/request';

export type ModeKind = 'LOCAL' | 'AIGC' | 'VOLC' | 'GENERATION';

export interface Mode {
  id: number;
  mode?: number | null;
  code: string;
  name: string;
  kind: ModeKind;
  handler?: string;
  formSchema?: unknown;
  description?: string;
  sortOrder?: number;
  status: number;
  createTime?: string;
  updateTime?: string;
}

export interface ModeFlow {
  id: number;
  code: string;
  name: string;
  targetModelCode?: string;
  entryCode?: string;
  activeVersionId: number;
  description?: string;
  status: number;
  createTime?: string;
  updateTime?: string;
}

export interface ModeFlowVersion {
  id: number;
  flowId: number;
  versionNo: number;
  status: 'draft' | 'published' | 'archived';
  graphJson?: unknown;
  planJson?: unknown;
  topology?: string;
  settlementType?: string;
  changelog?: string;
  createdBy?: string;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}
export interface ModeFlowDetail {
  flow: ModeFlow;
  versions: ModeFlowVersion[];
}


const MODE = '/api/v1/admin/modes';
const FLOW = '/api/v1/admin/mode-flows';

// ===== mode 节点 =====
export function pageModes(params: {
  keyword?: string;
  kind?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}) {
  return request.get<PageResult<Mode>>(MODE, { params });
}
export function listEnabledModes() {
  return request.get<Mode[]>(`${MODE}/enabled`);
}
export function getMode(id: number | string) {
  return request.get<Mode>(`${MODE}/${id}`);
}
export interface ModeMeta {
  /** 已注册 LOCAL handler 编码 */
  handlers: string[];
  /** 已注册 AIGC mode 号 */
  modes: number[];
  /** mode 流「细分入口」可选值 = 已配置计费场景 afv_billing_offer.entry_code */
  entryCodes: string[];
}
/** 编辑元数据：可选 Handler / Mode / entryCode（从代码与计费配置读取，免翻代码） */
export function getModeMeta() {
  return request.get<ModeMeta>(`${MODE}/meta`);
}

// ===== mode 流 =====
export function pageFlows(params: {
  keyword?: string;
  targetModelCode?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}) {
  return request.get<PageResult<ModeFlow>>(FLOW, { params });
}
export function getFlowDetail(id: number | string) {
  return request.get<ModeFlowDetail>(`${FLOW}/${id}`);
}
export function listFlowVersions(id: number | string) {
  return request.get<ModeFlowVersion[]>(`${FLOW}/${id}/versions`);
}
export function getFlowVersion(versionId: number | string) {
  return request.get<ModeFlowVersion>(`${FLOW}/versions/${versionId}`);
}

export interface ModePlanPreview {
  type?: string;
  topology?: string;
  settlementType?: string;
  steps: {
    code: string;
    kind: string;
    handler?: string;
    mode?: number;
    modelId?: number;
    costType?: string;
  }[];
  locals?: Record<string, unknown>;
}
/** 干跑预览：该版本组装后的可执行 plan（版本列拓扑权威+locals注入+costType缺省，不执行/不计费/不落库） */
export function previewFlowVersion(versionId: number | string, locals?: Record<string, unknown>) {
  return request.post<ModePlanPreview>(`${FLOW}/versions/${versionId}/preview`, locals || {});
}
