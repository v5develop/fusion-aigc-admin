import { request } from '@/utils/request'

export interface DashboardStats {
  totalUsers: number
  totalModels: number
  totalFeatures: number
  totalProjects: number
  todayNewUsers: number
  todayNewProjects: number
  todayTasks: number
  todaySuccessTasks: number
  todayFailedTasks: number
  todayConsumption: number
  todayGrantPoints: number
  todayGrantCount: number
  todayUnionRequests: number
  todayUnionSuccess: number
  todayPaidOrders: number
  todayRechargeAmount: number
  todayRechargePoints: number
  openDifferences: number
  trend?: {
    labels: string[]
    taskCounts: number[]
    userCounts: number[]
    consumeAmounts: number[]
    rechargeAmounts: number[]
  }
}

export function getDashboardStats() {
  return request.get<DashboardStats>('/api/v1/admin/dashboard/stats')
}
