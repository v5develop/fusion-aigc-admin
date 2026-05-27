import { request } from '@/utils/request'

export interface AuditLog {
  id: number
  operatorId: number
  operatorUsername: string
  operatorType: string
  action: string
  resourceType: string
  resourceId?: string
  requestId?: string
  clientIp?: string
  detail?: string
  status: number
  errorMessage?: string
  createTime: string
}

export interface AuditLogParams {
  pageNo: number
  pageSize: number
  operatorId?: number
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
}

export function getAuditLogList(params: AuditLogParams) {
  return request.get<{ list: AuditLog[]; total: number; pageNo: number; pageSize: number }>('/api/v1/admin/audit-logs/page', { params })
}

export function getAuditLogDetail(id: number) {
  return request.get<AuditLog>(`/api/v1/admin/audit-logs/${id}`)
}
