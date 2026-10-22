import { request } from '@/utils/request';

export type ReconcileStatus = 'PENDING_REVIEW' | 'BILLED' | 'NOT_BILLED';

export interface ReconcileItem {
  reconcileNo: string;
  taskId: string;
  stepPath: string;
  gatewayRunNo: number;
  stepStatus: string;
  gatewayCallId?: string | null;
  reservationNo?: string | null;
  estimatedPoints?: number | null;
  moneyAtRisk: boolean;
  status: ReconcileStatus;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  retryRequestedBy?: string | null;
  retryRequestedAt?: string | null;
  createTime: string;
}

export interface ReconcilePage {
  items: ReconcileItem[];
  total: number;
  /** 下一页游标；为空表示没有更多 */
  nextBeforeId: number | null;
}

export interface ReconcileQuery {
  status?: ReconcileStatus;
  limit?: number;
  beforeId?: number;
}

export function getReconciliations(params: ReconcileQuery) {
  return request.get<ReconcilePage>('/api/v1/admin/billing/reconciliations', { params });
}
