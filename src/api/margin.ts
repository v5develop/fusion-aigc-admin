import { request } from '@/utils/request'
import type {
  MarginSummary,
  MarginByModel,
  MarginTrendPoint,
  MarginByReservation,
  MarginConfig,
} from '@/types/api'

export function getMarginSummary(params: { startDate?: string; endDate?: string }) {
  return request.get<MarginSummary>('/api/v1/admin/margin/summary', { params })
}

export function getMarginByModel(params: { startDate?: string; endDate?: string }) {
  return request.get<MarginByModel[]>('/api/v1/admin/margin/by-model', { params })
}

export function getMarginTrend(params: { startDate?: string; endDate?: string }) {
  return request.get<MarginTrendPoint[]>('/api/v1/admin/margin/trend', { params })
}

export function getMarginByReservation(reservationNo: string) {
  return request.get<MarginByReservation>('/api/v1/admin/margin/by-reservation', {
    params: { reservationNo },
  })
}

export function getMarginConfig() {
  return request.get<MarginConfig>('/api/v1/admin/settings/margin')
}

export function updateMarginConfig(data: MarginConfig) {
  return request.put('/api/v1/admin/settings/margin', data)
}
