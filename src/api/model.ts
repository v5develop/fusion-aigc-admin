import { request } from '@/utils/request'
import type { AIModel, ModelListParams, PageResult } from '@/types/api'

export function getModelList(params: ModelListParams) {
  return request.get<PageResult<AIModel>>('/api/v1/admin/models', { params })
}

export function getModelOptions() {
  return request.get<AIModel[]>('/api/v1/admin/models/list')
}

export function createModel(data: Partial<AIModel>) {
  return request.post('/api/v1/admin/models', data)
}

export function updateModel(id: number, data: Partial<AIModel>) {
  return request.put(`/api/v1/admin/models/${id}`, { ...data, id })
}

export function deleteModel(id: number) {
  return request.delete(`/api/v1/admin/models/${id}`)
}
