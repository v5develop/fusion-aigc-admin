import { request } from '@/utils/request'

export interface DashboardStats {
  totalUsers: number
  totalModels: number
  totalFeatures: number
  todayConsumption: number
}

export function getDashboardStats() {
  return request.get<DashboardStats>('/api/admin/dashboard/stats')
}
