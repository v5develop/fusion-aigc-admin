import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

export type TemplateAssetType = 'image' | 'video'

// 物料（拆分后：id=物料ID，同一 bizType+url 唯一；module/slot 由投放位承载）
export interface TemplateMaterial {
  /** 物料ID：CRUD 与打标接口均用此 id */
  id: number
  bizType: string
  type: TemplateAssetType
  title: string
  url: string
  width?: number
  height?: number
  extra?: string
  /** 已挂投放位数量 */
  placementCount?: number
  createTime?: string
  updateTime?: string
}

// 投放位（物料出现在某 module/slot 的一条记录）
export interface TemplatePlacement {
  id: number
  bizType: string
  moduleCode: string
  slotCode: string
  assetId: number
  sortOrder?: number
  status: number
  createTime?: string
  updateTime?: string
}

export interface MaterialFormData {
  bizType: string
  type: TemplateAssetType
  title: string
  url: string
  width?: number
  height?: number
  extra?: string
}

export interface PlacementFormData {
  moduleCode: string
  slotCode?: string
  sortOrder?: number
  status: number
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

// ---- 物料 CRUD ----
export function getTemplateMaterialList(params: {
  bizType?: string
  type?: TemplateAssetType
  keyword?: string
  moduleCode?: string
  slotCode?: string
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<TemplateMaterial>>('/api/v1/admin/template/assets', { params })
}

export function getTemplateMaterial(id: number) {
  return request.get<TemplateMaterial>(`/api/v1/admin/template/assets/${id}`)
}

// 创建物料（可选同时批量落投放位）
export function createTemplateMaterial(
  data: MaterialFormData & { placements?: PlacementFormData[] },
) {
  return request.post<number>('/api/v1/admin/template/assets', data)
}

export function updateTemplateMaterial(id: number, data: Partial<MaterialFormData>) {
  return request.put(`/api/v1/admin/template/assets/${id}`, data)
}

// 删除物料（级联删除其投放位与打标）
export function deleteTemplateMaterial(id: number) {
  return request.delete(`/api/v1/admin/template/assets/${id}`)
}

// ---- 投放位（物料子资源）----
export function getPlacements(materialId: number) {
  return request.get<TemplatePlacement[]>(
    `/api/v1/admin/template/assets/${materialId}/placements`,
  )
}

export function addPlacement(materialId: number, data: PlacementFormData) {
  return request.post<number>(
    `/api/v1/admin/template/assets/${materialId}/placements`,
    data,
  )
}

export function updatePlacement(placementId: number, data: Partial<PlacementFormData>) {
  return request.put(`/api/v1/admin/template/assets/placements/${placementId}`, data)
}

export function deletePlacement(placementId: number) {
  return request.delete(`/api/v1/admin/template/assets/placements/${placementId}`)
}

// ---- 打标（入参为物料ID）----
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
