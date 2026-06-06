import { request } from '@/utils/request'
import type { ActionType, ActionTypeListParams, PageResult } from '@/types/api'

export function getActionTypeList(params: ActionTypeListParams) {
  return request.get<PageResult<ActionType>>('/api/v1/admin/action-types', { params })
}

export function getActionTypesAll() {
  return request.get<ActionType[]>('/api/v1/admin/action-types/all')
}

export function createActionType(data: Partial<ActionType>) {
  return request.post('/api/v1/admin/action-types', data)
}

export function updateActionType(id: number, data: Partial<ActionType>) {
  return request.put(`/api/v1/admin/action-types/${id}`, data)
}

export function deleteActionType(id: number) {
  return request.delete(`/api/v1/admin/action-types/${id}`)
}
