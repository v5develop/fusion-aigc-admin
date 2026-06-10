import { request } from '@/utils/request'
import type { ReconciliationSummary, ReconciliationMonthly, ReconciliationDifference, PageResult } from '@/types/api'

export function getReconciliationSummary(params: { startDate: string; endDate: string }) {
  return request.get<ReconciliationSummary>('/api/v1/admin/reconciliation/summary', { params })
}

export function getReconciliationMonthly(params?: { yearMonth?: string }) {
  return request.get<ReconciliationMonthly>('/api/v1/admin/reconciliation/monthly', { params })
}

export function exportReconciliation(params: { startDate: string; endDate: string }) {
  return request.get('/api/v1/admin/reconciliation/export', {
    params,
    responseType: 'blob',
  })
}

export function getDifferenceList(params: {
  status?: string
  differenceType?: string
  page: number
  pageSize: number
}) {
  return request.get<PageResult<ReconciliationDifference>>('/api/v1/admin/reconciliation/differences', { params })
}

export function handleDifference(data: { id: number; action: string; remark: string }) {
  return request.post('/api/v1/admin/reconciliation/differences/handle', data)
}
