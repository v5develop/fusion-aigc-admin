import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

export type TemplateAssetType = 'image' | 'video'

// 模板素材（拆分后：id=投放位ID，materialId=物料ID）
export interface TemplateAsset {
  /** 投放位ID：增删改/详情的目标 */
  id: number
  /** 物料ID：打标接口(getAssetTags/setAssetTags/batchTagAssets)使用；同一物料被多投放位共享 */
  materialId: number
  bizType: string
  moduleCode: string
  slotCode: string
  type: TemplateAssetType
  title: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  status: number
  extra?: string
  createTime?: string
  updateTime?: string
}

export interface TemplateAssetFormData {
  bizType: string
  moduleCode: string
  slotCode: string
  type: TemplateAssetType
  title: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  status: number
  extra?: string
}

// 素材已打的标签
export interface TemplateAssetTag {
  id: number
  assetId: number
  filterId: number
  optionId: number
  createTime?: string
}

// 筛选元数据：维度 + 选项
export interface TemplateFilterMetaOption {
  optionId: number
  optionCode: string
  optionName: string
}

export interface TemplateFilterMeta {
  filterId: number
  filterCode: string
  filterName: string
  uiType: string
  multiSelect: boolean
  options: TemplateFilterMetaOption[]
}

// ---- 素材 CRUD ----
export function getTemplateAssetList(params: {
  bizType?: string
  moduleCode?: string
  slotCode?: string
  type?: TemplateAssetType
  status?: number
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<TemplateAsset>>('/api/v1/admin/template/assets', { params })
}

export function getTemplateAsset(id: number) {
  return request.get<TemplateAsset>(`/api/v1/admin/template/assets/${id}`)
}

export function createTemplateAsset(data: TemplateAssetFormData) {
  return request.post('/api/v1/admin/template/assets', data)
}

export function updateTemplateAsset(id: number, data: Partial<TemplateAssetFormData>) {
  return request.put(`/api/v1/admin/template/assets/${id}`, data)
}

export function deleteTemplateAsset(id: number) {
  return request.delete(`/api/v1/admin/template/assets/${id}`)
}

// ---- 打标（入参为物料ID materialId，非投放位ID）----
export function getAssetTags(materialId: number) {
  return request.get<TemplateAssetTag[]>(
    `/api/v1/admin/template/filters/assets/${materialId}/tags`,
  )
}

export function setAssetTags(materialId: number, optionIds: number[]) {
  return request.put(`/api/v1/admin/template/filters/assets/${materialId}/tags`, { optionIds })
}

// 批量打标（追加模式）：对每个物料追加这些 option，返回插入数
export function batchTagAssets(materialIds: number[], optionIds: number[]) {
  return request.post<number>('/api/v1/admin/template/filters/assets/tags/batch', {
    assetIds: materialIds,
    optionIds,
  })
}

// ---- 筛选元数据（后台 admin 路径，带权限校验）----
export function getTemplateFilterMeta(params: {
  bizType?: string
  moduleCode?: string
  slotCode?: string
}) {
  return request.get<TemplateFilterMeta[]>('/api/v1/admin/template/filters/meta', { params })
}
