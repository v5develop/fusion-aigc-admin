import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

export type ModeKind = 'LOCAL' | 'AIGC' | 'VOLC' | 'GENERATION'

export interface Mode {
  id: number
  mode?: number | null
  code: string
  name: string
  kind: ModeKind
  handler?: string
  formSchema?: unknown
  description?: string
  sortOrder?: number
  status: number
  createTime?: string
  updateTime?: string
}

export interface ModeFlow {
  id: number
  code: string
  name: string
  targetModelCode?: string
  entryCode?: string
  activeVersionId: number
  description?: string
  status: number
  createTime?: string
  updateTime?: string
}

export interface ModeFlowVersion {
  id: number
  flowId: number
  versionNo: number
  status: 'draft' | 'published' | 'archived'
  graphJson?: unknown
  planJson?: unknown
  topology?: string
  settlementType?: string
  changelog?: string
  createdBy?: string
  publishedAt?: string
  createTime?: string
  updateTime?: string
}
export interface ModeFlowDetail {
  flow: ModeFlow
  versions: ModeFlowVersion[]
}

export interface ModeSaveReq {
  mode?: number | null
  code?: string
  name?: string
  kind?: string
  handler?: string
  formSchema?: unknown
  description?: string
  sortOrder?: number
  status?: number
}
export interface FlowSaveReq {
  code?: string
  name?: string
  targetModelCode?: string
  entryCode?: string
  description?: string
  status?: number
}
export interface FlowVersionSaveReq {
  graphJson?: unknown
  planJson?: unknown
  topology?: string
  settlementType?: string
  changelog?: string
  cloneFromVersionId?: number
}

const MODE = '/api/v1/admin/modes'
const FLOW = '/api/v1/admin/mode-flows'

// ===== mode 节点 =====
export function pageModes(params: { keyword?: string; kind?: string; status?: number; page?: number; pageSize?: number }) {
  return request.get<PageResult<Mode>>(MODE, { params })
}
export function listEnabledModes() {
  return request.get<Mode[]>(`${MODE}/enabled`)
}
export function getMode(id: number | string) {
  return request.get<Mode>(`${MODE}/${id}`)
}
export function createMode(data: ModeSaveReq) {
  return request.post<number>(MODE, data)
}
export function updateMode(id: number | string, data: ModeSaveReq) {
  return request.put(`${MODE}/${id}`, data)
}
export function deleteMode(id: number | string) {
  return request.delete(`${MODE}/${id}`)
}
export interface ModeMeta {
  /** 已注册 LOCAL handler 编码 */
  handlers: string[]
  /** 已注册 AIGC mode 号 */
  modes: number[]
  /** mode 流「细分入口」可选值 = 已配置计费场景 afv_billing_offer.entry_code */
  entryCodes: string[]
}
/** 编辑元数据：可选 Handler / Mode / entryCode（从代码与计费配置读取，免翻代码） */
export function getModeMeta() {
  return request.get<ModeMeta>(`${MODE}/meta`)
}

// ===== mode 流 =====
export function pageFlows(params: { keyword?: string; targetModelCode?: string; status?: number; page?: number; pageSize?: number }) {
  return request.get<PageResult<ModeFlow>>(FLOW, { params })
}
export function getFlowDetail(id: number | string) {
  return request.get<ModeFlowDetail>(`${FLOW}/${id}`)
}
export function createFlow(data: FlowSaveReq) {
  return request.post<number>(FLOW, data)
}
export function updateFlow(id: number | string, data: FlowSaveReq) {
  return request.put(`${FLOW}/${id}`, data)
}
export function deleteFlow(id: number | string) {
  return request.delete(`${FLOW}/${id}`)
}
export function listFlowVersions(id: number | string) {
  return request.get<ModeFlowVersion[]>(`${FLOW}/${id}/versions`)
}
export function getFlowVersion(versionId: number | string) {
  return request.get<ModeFlowVersion>(`${FLOW}/versions/${versionId}`)
}
export function createFlowDraft(id: number | string, data: FlowVersionSaveReq) {
  return request.post<number>(`${FLOW}/${id}/versions`, data)
}
export function updateFlowDraft(versionId: number | string, data: FlowVersionSaveReq) {
  return request.put(`${FLOW}/versions/${versionId}`, data)
}
export function deleteFlowDraft(versionId: number | string) {
  return request.delete(`${FLOW}/versions/${versionId}`)
}
export function publishFlowVersion(versionId: number | string) {
  return request.post(`${FLOW}/versions/${versionId}/publish`)
}
export function rollbackFlowVersion(id: number | string, versionId: number | string) {
  return request.post(`${FLOW}/${id}/rollback/${versionId}`)
}

export interface ModePlanPreview {
  type?: string
  topology?: string
  settlementType?: string
  steps: { code: string; kind: string; handler?: string; mode?: number; modelId?: number; costType?: string }[]
  locals?: Record<string, unknown>
}
/** 干跑预览：该版本组装后的可执行 plan（版本列拓扑权威+locals注入+costType缺省，不执行/不计费/不落库） */
export function previewFlowVersion(versionId: number | string, locals?: Record<string, unknown>) {
  return request.post<ModePlanPreview>(`${FLOW}/versions/${versionId}/preview`, locals || {})
}
