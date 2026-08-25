import { request } from '@/utils/request'

/** 分类下的成员创作入口 */
export interface AssetCategoryEntryItem {
  entryCode: string
  /** 展示名；后端取不到名时回退成 entryCode 本身 */
  entryName: string
}

/**
 * 素材库聚合分类：把创作入口归成几组，用户端素材库据此出 tab。
 * 纯展示概念，与计费/提交口径解耦——改分组不会动到 offer。
 */
export interface AssetCategory {
  id: number
  /** 小驼峰；用户端按它传参筛素材，是对外契约的一部分 */
  categoryCode: string
  categoryName: string
  sortOrder: number
  /** 0-停用 1-启用；停用的分类不下发给用户端，但后台仍要能看到并改它 */
  status: number
  entries: AssetCategoryEntryItem[]
}

/** 入口候选项，带当前归属；categoryId 为 null 即尚未归类 */
export interface AssetCategoryEntryOption {
  entryCode: string
  entryName: string
  categoryId: number | null
  categoryName: string | null
}

export interface AssetCategoryEntryOptions {
  /** 未归到任何分类的入口编码 */
  unclassified: string[]
  options: AssetCategoryEntryOption[]
}

export interface AssetCategorySaveData {
  categoryCode: string
  categoryName: string
  sortOrder: number
  status: number
  /** 成员入口按全量覆盖：不在这个数组里的入口会被移出该分类 */
  entryCodes: string[]
}

/** 全量列表（含停用项）：停用只表示「用户不该看见」，运营还得能在后台改它 */
export function getAssetCategories() {
  return request.get<AssetCategory[]>('/api/v1/admin/asset-category/list')
}

/** 候选入口与未归类清单一次取回，避免两个口径各查一遍后对不上 */
export function getAssetCategoryEntryOptions() {
  return request.get<AssetCategoryEntryOptions>('/api/v1/admin/asset-category/entry-options')
}

export function createAssetCategory(data: AssetCategorySaveData) {
  return request.post<number>('/api/v1/admin/asset-category/create', data)
}

/** categoryCode 建好后不该再改：用户端按它筛素材，改了等于换了个分类 */
export function updateAssetCategory(id: number, data: AssetCategorySaveData) {
  return request.put(`/api/v1/admin/asset-category/${id}`, data)
}

/** 删除后其成员入口退回未归类，这些入口的素材在所有 tab 里都不再出现 */
export function deleteAssetCategory(id: number) {
  return request.delete(`/api/v1/admin/asset-category/${id}`)
}

/** 整表重排；后端按数组次序重写 sortOrder */
export function reorderAssetCategories(ids: number[]) {
  return request.put('/api/v1/admin/asset-category/reorder', { ids })
}
