import { request } from '@/utils/request'
import type { BillingException, BillingExceptionListParams, PageResult } from '@/types/api'

export function getExceptionList(params: BillingExceptionListParams) {
  return request.get<PageResult<BillingException>>('/api/admin/billing/exceptions', { params })
}

export function retryException(id: number) {
  return request.post(`/api/admin/billing/exceptions/${id}/retry`)
}

export function ignoreException(data: { id: number; remark: string }) {
  return request.post('/api/admin/billing/exceptions/ignore', data)
}
