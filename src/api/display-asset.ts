import type { PageResult } from '@/types/api'

import { request } from '@/utils/request'

export type DisplayAssetType = 'image' | 'video'

/**
 * 展示素材（灵感广场瀑布流 / 推荐位 / 热门位），对应用户端 /api/v1/asset/public/display。
 * 「做同款」配方存在 extra.sameStyle 子键下，不占独立列。
 */
export interface DisplayAsset {
  id: number
  category: string
  type: DisplayAssetType
  isRecommend: number
  isHot: number
  title: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  /** 0-下架 1-上架 */
  status: number
  /** 扩展属性 JSON 字符串，含 sameStyle 子键 */
  extra?: string
  /** 是否已配做同款（extra.sameStyle 存在且未停用） */
  sameStyle?: boolean
  createTime?: string
  updateTime?: string
}

export interface DisplayAssetFormData {
  category?: string
  type: DisplayAssetType
  isRecommend?: number
  isHot?: number
  title?: string
  url: string
  width?: number
  height?: number
  sortOrder?: number
  status?: number
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
  category?: string
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

/** 上下架：status 0-下架 1-上架 */
export function updateDisplayAssetStatus(id: number, status: number) {
  return request.put(`/api/v1/admin/display/assets/${id}/status`, null, { params: { status } })
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
