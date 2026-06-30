import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type { OpenApp, OpenAppCreateReq, OpenAppSecretResp, OpenAppListParams } from '@/types/open-app'

/** 应用分页列表（不含密钥） */
export function getOpenAppList(params: OpenAppListParams) {
  return request.get<PageResult<OpenApp>>('/api/v1/admin/open-apps', { params })
}

/** 创建应用申请（不生成密钥，状态置为待审核） */
export function createOpenApp(data: OpenAppCreateReq) {
  return request.post<OpenApp>('/api/v1/admin/open-apps', data)
}

/** 审批通过：生成密钥，明文仅此次返回 */
export function approveOpenApp(id: number) {
  return request.post<OpenAppSecretResp>(`/api/v1/admin/open-apps/${id}/approve`)
}

/** 驳回申请 */
export function rejectOpenApp(id: number, reason?: string) {
  return request.post(`/api/v1/admin/open-apps/${id}/reject`, { reason })
}

/** 禁用应用（验签即时失效） */
export function disableOpenApp(id: number) {
  return request.post(`/api/v1/admin/open-apps/${id}/disable`)
}

/** 重新启用应用 */
export function enableOpenApp(id: number) {
  return request.post(`/api/v1/admin/open-apps/${id}/enable`)
}

/** 轮换密钥：旧密钥进入宽限期，明文仅此次返回 */
export function rotateOpenAppSecret(id: number) {
  return request.post<OpenAppSecretResp>(`/api/v1/admin/open-apps/${id}/rotate-secret`)
}
