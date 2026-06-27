import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

// 维度筛选项 UI 类型
export type FilterUiType = 'tab' | 'select' | 'multi_select'

// 维度（筛选下拉）—— 维度字典，全局唯一，不再绑 module/slot
export interface TemplateFilter {
  id: number
  bizType: string
  filterCode: string
  filterName: string
  uiType: FilterUiType
  multiSelect: number
  sortOrder?: number
  status: number
  createTime?: string
  updateTime?: string
}

// 选项（维度下的候选值）
export interface TemplateFilterOption {
  id: number
  filterId: number
  optionCode: string
  optionName: string
  sortOrder?: number
  status: number
  createTime?: string
  updateTime?: string
}

// slot↔维度绑定
export type OptionFilterType = 'all' | 'partial'

export interface TemplateSlotFilter {
  id: number
  bizType: string
  moduleCode: string
  slotCode: string
  filterId: number
  optionFilterType: OptionFilterType
  optionWhiteList?: number[] | null
  sortOrder?: number
  status: number
  createTime?: string
  updateTime?: string
}

export interface TemplateFilterFormData {
  bizType: string
  filterCode: string
  filterName: string
  uiType: FilterUiType
  multiSelect: number
  sortOrder?: number
  status: number
}

export interface TemplateFilterOptionFormData {
  optionCode: string
  optionName: string
  sortOrder?: number
  status: number
}

export interface SlotFilterFormData {
  bizType: string
  moduleCode: string
  slotCode: string
  filterId: number
  optionFilterType: OptionFilterType
  optionWhiteList?: number[] | null
  sortOrder?: number
  status: number
}

// ---- 维度 filter ----
export function getTemplateFilterList(params: {
  bizType?: string
  filterCode?: string
  filterName?: string
  uiType?: string
  status?: number
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<TemplateFilter>>('/api/v1/admin/template/filters', { params })
}

export function createTemplateFilter(data: TemplateFilterFormData) {
  return request.post('/api/v1/admin/template/filters', data)
}

export function updateTemplateFilter(id: number, data: Partial<TemplateFilterFormData>) {
  return request.put(`/api/v1/admin/template/filters/${id}`, data)
}

export function deleteTemplateFilter(id: number) {
  return request.delete(`/api/v1/admin/template/filters/${id}`)
}

// ---- 选项 option ----
export function getTemplateFilterOptions(filterId: number) {
  return request.get<TemplateFilterOption[]>(
    `/api/v1/admin/template/filters/${filterId}/options`,
  )
}

export function createTemplateFilterOption(filterId: number, data: TemplateFilterOptionFormData) {
  return request.post(`/api/v1/admin/template/filters/${filterId}/options`, data)
}

export function updateTemplateFilterOption(
  optionId: number,
  data: Partial<TemplateFilterOptionFormData>,
) {
  return request.put(`/api/v1/admin/template/filters/options/${optionId}`, data)
}

export function deleteTemplateFilterOption(optionId: number) {
  return request.delete(`/api/v1/admin/template/filters/options/${optionId}`)
}

// ---- slot↔维度绑定 ----
export function getSlotFilters(params: {
  bizType?: string
  moduleCode: string
  slotCode?: string
}) {
  return request.get<TemplateSlotFilter[]>('/api/v1/admin/template/filters/slots', { params })
}

export function bindSlotFilter(data: SlotFilterFormData) {
  return request.post('/api/v1/admin/template/filters/slots', data)
}

export function updateSlotFilter(
  id: number,
  data: Partial<Omit<SlotFilterFormData, 'bizType' | 'moduleCode' | 'slotCode' | 'filterId'>>,
) {
  return request.put(`/api/v1/admin/template/filters/slots/${id}`, data)
}

export function unbindSlotFilter(id: number) {
  return request.delete(`/api/v1/admin/template/filters/slots/${id}`)
}

// ---- 枚举数据源（下拉用） ----
export interface ModuleCodeOption {
  moduleCode: string
  moduleName: string
}

// 创作模块枚举（来自计费 Offer）
export function getModuleCodes() {
  return request.get<ModuleCodeOption[]>('/api/v1/admin/template/filters/module-codes')
}

// 页面区块联想（已有模板素材的 distinct slotCode）
export function getSlotCodes(params: { bizType?: string; moduleCode?: string }) {
  return request.get<string[]>('/api/v1/admin/template/filters/slot-codes', { params })
}
