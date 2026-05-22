import { request } from '@/utils/request'
import type { ReconciliationSummary, ReconciliationDifference, PageResult } from '@/types/api'

export function getReconciliationSummary(params: { startDate: string; endDate: string }) {
  return request.get<ReconciliationSummary>('/api/admin/reconciliation/summary', { params })
}

export function getDifferenceList(params: {
  status?: string
  differenceType?: string
  pageNo: number
  pageSize: number
}) {
  return request.get<PageResult<ReconciliationDifference>>('/api/admin/reconciliation/differences', { params })
}

export function handleDifference(data: { id: number; action: string; remark: string }) {
  return request.post('/api/admin/reconciliation/differences/handle', data)
}
