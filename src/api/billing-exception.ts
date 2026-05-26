import { request } from '@/utils/request'
import type { BillingExceptionTask, AgedHeldReservation, PageResult } from '@/types/api'

export function getExceptionTasks(params: {
  taskType?: string
  billingStatus?: string
  pageNo: number
  pageSize: number
}) {
  return request.get<PageResult<BillingExceptionTask>>('/api/v1/admin/billing/exceptions/tasks', { params })
}

export function getAgedHeldReservations(params?: {
  expiredBefore?: string
  limit?: number
}) {
  return request.get<AgedHeldReservation[]>('/api/v1/admin/billing/exceptions/aged-held-reservations', { params })
}

export function executeCompensation(data: {
  actionType: 'RETRY' | 'IGNORE' | 'REFUND'
  reservationNo: string
  requestId?: string
  reason?: string
}) {
  return request.post('/api/v1/admin/billing/compensation/execute', data)
}
