import type { PageResult } from '@/types/api';

import { request } from '@/utils/request';

export interface ChargeRule {
  id?: number;
  ruleCode: string;
  scopeType: string;
  scopeCode: string;
  factorKey: string;
  operator: string;
  matchValue: string;
  effectType: string;
  effectValue: number;
  priority?: number;
  effectiveTime?: string;
  expireTime?: string;
  status: string;
  version?: number;
  remark?: string;
}

export function getRuleList(params: Record<string, unknown>) {
  return request.get<PageResult<ChargeRule>>('/api/v1/admin/billing/rules', { params });
}

export function createRule(data: Partial<ChargeRule>) {
  return request.post<ChargeRule>('/api/v1/admin/billing/rules', data);
}

export function updateRule(id: number, data: Partial<ChargeRule>) {
  return request.put<ChargeRule>(`/api/v1/admin/billing/rules/${id}`, data);
}

export function deleteRule(id: number) {
  return request.delete(`/api/v1/admin/billing/rules/${id}`);
}

export function refreshRuleCache() {
  return request.post('/api/v1/admin/billing/rules/refresh');
}
