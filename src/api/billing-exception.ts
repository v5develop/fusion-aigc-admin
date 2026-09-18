import type {
  BillingExceptionTask,
  AgedHeldReservation,
  CompensationParams,
  PageResult,
} from '@/types/api';

import { request } from '@/utils/request';

export function getExceptionTasks(params: {
  taskType?: string;
  userId?: number;
  billingStatus?: string;
  page: number;
  pageSize: number;
}) {
  return request.get<PageResult<BillingExceptionTask>>('/api/v1/admin/billing/exceptions/tasks', {
    params,
  });
}

export function getAgedHeldReservations(params?: { expiredBefore?: string; limit?: number }) {
  return request.get<AgedHeldReservation[]>(
    '/api/v1/admin/billing/exceptions/aged-held-reservations',
    { params },
  );
}

export function executeCompensation(data: CompensationParams) {
  return request.post('/api/v1/admin/billing/compensations/execute', data);
}

/** 手动触发过期占用扣费单恢复 */
export function recoverAgedHeldReservations() {
  return request.post<number>('/api/v1/admin/billing/exceptions/aged-held-reservations/recover');
}
