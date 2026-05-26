import { request } from '@/utils/request'
import type { Consumption, ConsumptionParams, PageResult } from '@/types/api'

export interface ConsumptionStats {
  todayConsumption: number
  monthConsumption: number
  todayThirdPartyCost: number
}

export function getConsumptionList(params: ConsumptionParams) {
  return request.get<PageResult<Consumption>>('/api/v1/admin/consumptions', { params })
}

export function getConsumptionStats() {
  return request.get<ConsumptionStats>('/api/v1/admin/consumptions/stats')
}
