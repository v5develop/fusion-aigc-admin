import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

// 维度筛选项 UI 类型
export type FilterUiType = 'tab' | 'select' | 'multi_select'

// 维度（筛选下拉）
export interface TemplateFilter {
  id: number
  bizType: string
  moduleCode: string
  slotCode: string
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

export interface TemplateFilterFormData {
  bizType: string
  moduleCode: string
  slotCode: string
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

// ---- 维度 filter ----
export function getTemplateFilterList(params: {
  bizType?: string
  moduleCode?: string
  slotCode?: string
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
