import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type { Platform } from '@/api/display-category'

/** 推荐内容的来源：运营手灌的灵感素材 / 用户真实创作产物 */
export type RecommendSourceType = 'DISPLAY_ASSET' | 'CREATION_TASK'

/**
 * 一条推荐 = 某条内容挂在某个分类位置 + 分发平台 + 排序。
 * 移除推荐只解关系，源内容不动。
 */
export interface ContentRecommendItem {
  id: number
  sourceType: RecommendSourceType
  /** 数据ID：DISPLAY_ASSET 为素材ID，CREATION_TASK 为创作内容的数据ID */
  sourceId: number
  categoryL1Id: number
  categoryL1Name: string | null
  /** 仅挂一级时为 0 */
  categoryL2Id: number
  categoryL2Name: string | null
  platform: Platform
  sortOrder: number
  status: number
  createTime: string | null

  // 源内容快照，每次查询实时取
  title: string | null
  type: string | null
  thumbnail: string | null
  urls: string[]
  /** 源已失效（素材下架/删除、任务被删/屏蔽/未成功）；失效的不会出现在用户端 */
  sourceInvalid: boolean
  invalidReason: string | null
  /** 该条能否做同款。推一条不能做同款的上去，等于给用户一个死入口 */
  sameStyle: boolean
}

/** 已发布但还没挂任何推荐位的灵感素材 */
export interface PendingAsset {
  id: number
  title: string | null
  type: string
  thumbnail: string | null
  /** 素材身上配的默认推荐位，上推时可一键沿用 */
  categoryL1Id: number
  categoryL1Name: string | null
  categoryL2Id: number
  categoryL2Name: string | null
  sameStyle: boolean
  createTime: string | null
}

export interface ContentRecommendSaveData {
  sourceType?: RecommendSourceType
  sourceId?: number
  categoryL1Id?: number
  /** 0 或不传表示仅挂一级 */
  categoryL2Id?: number
  platform?: Platform
  sortOrder?: number
  status?: number
}

export function getRecommendList(params: {
  categoryL1Id?: number
  categoryL2Id?: number
  platform?: Platform
  sourceType?: RecommendSourceType
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<ContentRecommendItem>>('/api/v1/admin/content/recommends', {
    params,
  })
}

/** 待上推：已发布但还没挂推荐位的素材。发布不等于露出，这里是编排入口 */
export function getPendingAssets(params: { page?: number; pageSize?: number }) {
  return request.get<PageResult<PendingAsset>>(
    '/api/v1/admin/content/recommends/pending-assets',
    { params },
  )
}

/** 添加推荐。后端会校验源可用、二级归属一级、推荐平台被分类平台覆盖 */
export function addRecommend(data: ContentRecommendSaveData) {
  return request.post<number>('/api/v1/admin/content/recommends', data)
}

export function updateRecommend(id: number, data: ContentRecommendSaveData) {
  return request.put(`/api/v1/admin/content/recommends/${id}`, data)
}

/** 拖拽排序落库。只接受同一分类位置内的重排，跨分类请走 updateRecommend */
export function reorderRecommends(orderedIds: number[]) {
  return request.put('/api/v1/admin/content/recommends/reorder', { orderedIds })
}

/** 移除推荐：只解除关系，源内容不删 */
export function removeRecommend(id: number) {
  return request.delete(`/api/v1/admin/content/recommends/${id}`)
}
