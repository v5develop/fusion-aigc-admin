import type { PageResult } from '@/types/api'

import { request } from '@/utils/request'

export type DisplayAssetType = 'image' | 'video'

/**
 * 展示素材（灵感广场瀑布流 / 推荐位 / 热门位），对应用户端 /api/v1/asset/public/display。
 * 「做同款」配方存在 extra.sameStyle 子键下，不占独立列。
 */
/** 0-草稿 1-已发布 2-已下架 */
export const DISPLAY_ASSET_STATUS = { DRAFT: 0, PUBLISHED: 1, OFFLINE: 2 } as const

export interface DisplayAsset {
  id: number
  /** 默认推荐位-一级分类ID，0=未指定 */
  categoryL1Id: number
  /** 默认推荐位-二级分类ID，0=仅一级或未指定 */
  categoryL2Id: number
  /** 来源创作任务ID；非空时做同款配方从该任务反解，运营不必手配 */
  sourceTaskId: number | null
  type: DisplayAssetType
  isRecommend: number
  isHot: number
  title: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  /** 0-草稿 1-已发布 2-已下架 */
  status: number
  /** 扩展属性 JSON 字符串，含 sameStyle 子键 */
  extra?: string
  /** 是否已配做同款（extra.sameStyle 存在且未停用） */
  sameStyle?: boolean
  createTime?: string
  updateTime?: string
}

export interface DisplayAssetFormData {
  /**
   * 默认推荐位-一级分类ID。语义是「发布时默认推到哪个分类位」，不是素材的归属分类：
   * 同一条素材本就能挂多个分类位，身上存唯一归属会跟推荐表打架。
   * 不指定则发布后落到推荐管理的「待上推」。
   */
  categoryL1Id?: number
  /** 默认推荐位-二级分类ID；指定时必须属于 categoryL1Id */
  categoryL2Id?: number
  /**
   * 来源创作任务ID（创作内容列表里的「数据ID」）。给了就不用手配做同款配方——
   * 配方从该任务的提交参数自动反解。手灌的外部图没有来源任务，必须手配。
   */
  sourceTaskId?: number
  type: DisplayAssetType
  isRecommend?: number
  isHot?: number
  title?: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  extra?: string
}

/** 做同款配方，字段与后端 extra.sameStyle 一一对应 */
export interface SameStyleRecipe {
  /** 是否开放做同款，默认 true */
  enabled?: boolean
  /** 创作入口 code，必填；必须已在计费 Offer 注册 */
  entryCode: string
  /** 模型编码；与 modelId 至少给一个 */
  modelCode?: string
  /** 模型ID；与 modelCode 至少给一个 */
  modelId?: number
  prompt?: string
  params?: Record<string, unknown>
  /** 需用户上传的参考图张数 */
  requiredImages?: number
  /** 允许用户改动的字段名，空表示不限制 */
  editableFields?: string[]
  tips?: string
}

export interface DisplayCategory {
  id: number
  categoryCode: string
  categoryName: string
  sortOrder?: number
  status: number
}

export interface EntryCodeOption {
  entryCode: string
  entryName: string
}

// ---- 素材 CRUD ----
export function getDisplayAssetList(params: {
  categoryL1Id?: number
  categoryL2Id?: number
  type?: DisplayAssetType
  isRecommend?: number
  isHot?: number
  status?: number
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<DisplayAsset>>('/api/v1/admin/display/assets', { params })
}

export function getDisplayAsset(id: number) {
  return request.get<DisplayAsset>(`/api/v1/admin/display/assets/${id}`)
}

export function createDisplayAsset(data: DisplayAssetFormData) {
  return request.post<number>('/api/v1/admin/display/assets', data)
}

export function updateDisplayAsset(id: number, data: Partial<DisplayAssetFormData>) {
  return request.put(`/api/v1/admin/display/assets/${id}`, data)
}

/**
 * 发布。素材配了默认推荐位时顺带挂上推荐位、用户端立即可见；没配则只是发布，
 * 落到推荐管理的「待上推」等编排。重新发布不会重复挂，原排序保留。
 */
export function publishDisplayAsset(id: number, platform?: string) {
  return request.put(`/api/v1/admin/display/assets/${id}/publish`, null, { params: { platform } })
}

/** 下架。推荐记录一律保留，用户端不出、后台标「源已失效」，重新发布自动恢复 */
export function offlineDisplayAsset(id: number) {
  return request.put(`/api/v1/admin/display/assets/${id}/offline`)
}

/** 撤回为草稿。与下架的区别：草稿是「还没编好」，下架是「编好了但不再露出」 */
export function withdrawDisplayAssetToDraft(id: number) {
  return request.put(`/api/v1/admin/display/assets/${id}/draft`)
}

export function deleteDisplayAsset(id: number) {
  return request.delete(`/api/v1/admin/display/assets/${id}`)
}

// ---- 做同款配方（只改写 extra.sameStyle，extra 其它键保留）----
export function saveSameStyle(id: number, data: SameStyleRecipe) {
  return request.put(`/api/v1/admin/display/assets/${id}/same-style`, data)
}

export function removeSameStyle(id: number) {
  return request.delete(`/api/v1/admin/display/assets/${id}/same-style`)
}

// ---- 表单下拉数据源 ----
/** 创作入口枚举（来自计费 Offer），供同款配方 entryCode 下拉 */
export function getDisplayEntryCodes() {
  return request.get<EntryCodeOption[]>('/api/v1/admin/display/assets/entry-codes')
}

/** 内容分类字典（含停用项，后台表单下拉用） */
export function getDisplayCategories() {
  return request.get<DisplayCategory[]>('/api/v1/admin/display/assets/categories')
}
