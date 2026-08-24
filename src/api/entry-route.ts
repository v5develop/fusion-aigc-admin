import { request } from '@/utils/request'

/** 路由按端一一对应，没有 BOTH：两端格式本来就不同，要两端就配两条 */
export type RoutePlatform = 'APP' | 'PC'

/**
 * 创作入口路由：entryCode → 各端创作表单页路由。
 * 用户在推荐流点「做同款」时，后端按端取这里配的 route 一并下发，前端据此跳转。
 * 漏配时同款接口的 targetRoute 返回 null，前端回退通用创作页并带上 entryCode。
 */
export interface CreationEntryRoute {
  id: number
  entryCode: string
  platform: RoutePlatform
  /** 该端创作表单页路由或 App scheme */
  route: string
  remark: string
  /** 0-停用 1-启用 */
  status: number
  createTime?: string
  updateTime?: string
}

export interface EntryRouteSaveData {
  entryCode: string
  platform: RoutePlatform
  route: string
  remark?: string
  status?: number
}

export function getEntryRoutes(params?: { entryCode?: string; platform?: RoutePlatform }) {
  return request.get<CreationEntryRoute[]>('/api/v1/admin/creation/entry-routes', { params })
}

export function createEntryRoute(data: EntryRouteSaveData) {
  return request.post<number>('/api/v1/admin/creation/entry-routes', data)
}

export function updateEntryRoute(id: number, data: Partial<EntryRouteSaveData>) {
  return request.put(`/api/v1/admin/creation/entry-routes/${id}`, data)
}

export function deleteEntryRoute(id: number) {
  return request.delete(`/api/v1/admin/creation/entry-routes/${id}`)
}
