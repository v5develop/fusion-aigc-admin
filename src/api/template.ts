import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

export interface ExecutionConfig {
  handler: string
  model: string
  defaultParams?: Record<string, unknown>
  pricePoints?: number
}

export interface UiConfig {
  layout: string
  theme: string
  previewUrl?: string
  customStyles?: Record<string, unknown>
}

export interface TemplateRecord {
  id: string
  name: string
  coverUrl?: string
  iconUrl?: string
  category?: string
  mode?: string
  description?: string
  inputConfig?: unknown
  promptTemplate?: string
  variableMapping?: unknown
  executionConfig?: ExecutionConfig
  formSchema?: unknown
  uiConfig?: UiConfig
  workflowConfig?: unknown
  version?: number
  parentTemplateId?: string
  usageCount?: number
  enabled?: number
  sort?: number
  createTime?: string
  updateTime?: string
}

export interface TemplateFormData {
  id?: string
  name: string
  coverUrl?: string
  iconUrl?: string
  category?: string
  mode?: string
  description?: string
  formSchema?: unknown
  promptTemplate: string
  variableMapping?: unknown
  executionConfig?: ExecutionConfig
  uiConfig?: UiConfig
  enabled?: number
  sort?: number
}

export function getTemplateList(params: {
  category?: string
  mode?: string
  enabled?: number
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<TemplateRecord>>('/api/v1/admin/creation/templates', { params })
}

export function getTemplateDetail(id: string) {
  return request.get<TemplateRecord>(`/api/v1/admin/creation/templates/${id}`)
}

export function createTemplate(data: TemplateFormData) {
  return request.post('/api/v1/admin/creation/templates', data)
}

export function updateTemplate(id: string, data: TemplateFormData) {
  return request.put(`/api/v1/admin/creation/templates/${id}`, data)
}

export function deleteTemplate(id: string) {
  return request.delete(`/api/v1/admin/creation/templates/${id}`)
}
