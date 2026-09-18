import type { PageResult } from '@/types/api';
import type {
  AdminNotification,
  NotificationPublishParams,
  NotificationQueryParams,
} from '@/types/api';

import { request } from '@/utils/request';

/**
 * 站内通知。
 *
 * 发布接口在管理端而不是用户端：creaft v1 把 publish 挂在用户端路由上、靠角色判断拦住，
 * 那在用户链上多留了一个只有管理员能用的写入口。这里走 admin 链（独立 token + RBAC）。
 *
 * 权限码分三级，**publish 与 delete 是分开的**：
 * `notification:view` / `notification:publish` / `notification:delete`（撤回只给 super_admin）。
 */
export function publishNotification(data: NotificationPublishParams) {
  return request.post<number>('/api/v1/admin/notifications', data);
}

/**
 * 列表口径与用户端**刻意不同**：这里能看到未到发布时间的排期稿和已撤回的历史，
 * 运营要据此判断「是不是已经发过了」。
 */
export function getNotifications(params: NotificationQueryParams) {
  return request.get<PageResult<AdminNotification>>('/api/v1/admin/notifications', { params });
}

/**
 * 撤回：用户端立即不可见，**已读记录保留**。
 * 保留是为了能回答「撤回前有多少人看过」，也避免误撤回后重新发布导致所有人再收到一次未读。
 */
export function revokeNotification(id: number) {
  return request.delete<boolean>(`/api/v1/admin/notifications/${id}`);
}
