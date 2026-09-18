import { request } from '@/utils/request';

export interface DashboardStats {
  totalUsers: number;
  totalModels: number;
  totalFeatures: number;
  totalProjects: number;
  todayNewUsers: number;
  todayNewProjects: number;
  todayTasks: number;
  todaySuccessTasks: number;
  todayFailedTasks: number;
  todayConsumption: number;
  todayUnionRequests: number;
  todayUnionSuccess: number;
  /**
   * 联盟是否还连着 = 有启用的接入方 **且** 最近 24 小时内有成功请求。
   * 只看配置会永远显示已连接，只看流量会夜里变红天亮自愈，两者都不可信。
   */
  unionConnected: boolean;
  /** 启用中的接入方数量。用来区分「没配」和「配了但对方很久没来」 */
  unionEnabledApps: number;
  /** 最后一次成功请求时间；从没有过则为 null */
  unionLastSuccessTime: string | null;
  todayPaidOrders: number;
  todayRechargeAmount: number;
  todayRechargePoints: number;
  openDifferences: number;
  trend?: {
    labels: string[];
    taskCounts: number[];
    userCounts: number[];
    consumeAmounts: number[];
    rechargeAmounts: number[];
  };
}

export function getDashboardStats() {
  return request.get<DashboardStats>('/api/v1/admin/dashboard/stats');
}
