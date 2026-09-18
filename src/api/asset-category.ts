import { request } from '@/utils/request';

/** 分类下的成员创作入口 */
export interface AssetCategoryEntryItem {
  entryCode: string;
  /** 展示名；后端取不到名时回退成 entryCode 本身 */
  entryName: string;
}

/**
 * 素材库聚合分类（两级树）：一级是用户端素材库的 tab，二级是 tab 下的 chip。
 * 纯展示概念，与计费/提交口径解耦——改分组不会动到 offer。
 */
export interface AssetCategory {
  id: number;
  /** 小驼峰、全局唯一；用户端按它传参筛素材，是对外契约的一部分 */
  categoryCode: string;
  categoryName: string;
  /** 父级分类ID，0 表示一级 */
  parentId: number;
  /** 1-一级(tab) 2-二级(chip)；只支持这两级 */
  level: number;
  /**
   * 媒体形态(image/video)，**仅一级有意义**：设了它的一级会在用户端自动补一个虚拟二级
   * 「其他」，收纳该形态下还没归类的入口。二级恒为空串，别在二级表单里露出来——
   * 露出来运营就会填，填了也不生效。
   */
  mediaType: string;
  /** 0-停用 1-启用；停用的分类不下发给用户端，但后台仍要能看到并改它 */
  sortOrder: number;
  status: number;
  /** 该分类**自己**挂的入口。入口只挂在二级上，一级恒为空数组 */
  entries: AssetCategoryEntryItem[];
  /** 二级子分类；二级节点恒为空数组（后端给空数组而不是 null） */
  children: AssetCategory[];
}

/** 归属分类的最小引用（永远是二级） */
export interface AssetCategoryRef {
  id: number;
  name: string;
}

/**
 * 入口候选项，带它当前的**全部**归属。
 *
 * categories 是数组而不是单个 categoryId/categoryName：归属**允许重叠**，
 * 同一入口可以同时归到多个二级（商品套图既在「图片>商品图」也在「电商>电商图片」）。
 * 用单值只能装下其中随机一个，运营看到「归属：电商图片」就会以为图片那边的归属没了。
 */
export interface AssetCategoryEntryOption {
  entryCode: string;
  entryName: string;
  /** 空数组即未归类；不要拿它做「已被占用」的置灰依据，重叠是特性不是冲突 */
  categories: AssetCategoryRef[];
}

export interface AssetCategoryEntryOptions {
  /** 未归到任何分类的入口编码 */
  unclassified: string[];
  options: AssetCategoryEntryOption[];
}

export interface AssetCategorySaveData {
  categoryCode: string;
  categoryName: string;
  /**
   * 父级分类ID，0=一级。
   * 编辑二级时**必须原样回传**：不传会被后端当成一级，而一级不允许挂入口，
   * 于是带着 entryCodes 的保存直接被拒。
   */
  parentId: number;
  /** 1-一级 2-二级；后端最终按 parentId 推导，这里原样提交只是让请求自解释 */
  level: number;
  /** 仅一级有意义；空串=该一级不做未归类兜底 */
  mediaType: string;
  sortOrder: number;
  status: number;
  /** 成员入口按全量覆盖，且**只有二级能挂**；可与其它分类重叠，不必先从别处摘掉 */
  entryCodes: string[];
}

/**
 * 全量分类树（含停用项）：停用只表示「用户不该看见」，运营还得能在后台改它。
 * 一级在顶层、二级在其 children 里。
 */
export function getAssetCategories() {
  return request.get<AssetCategory[]>('/api/v1/admin/asset-category/list');
}

/** 候选入口与未归类清单一次取回，避免两个口径各查一遍后对不上 */
export function getAssetCategoryEntryOptions() {
  return request.get<AssetCategoryEntryOptions>('/api/v1/admin/asset-category/entry-options');
}

export function createAssetCategory(data: AssetCategorySaveData) {
  return request.post<number>('/api/v1/admin/asset-category/create', data);
}

/** categoryCode 建好后不该再改：用户端按它筛素材，改了等于换了个分类 */
export function updateAssetCategory(id: number, data: AssetCategorySaveData) {
  return request.put(`/api/v1/admin/asset-category/${id}`, data);
}

/**
 * 删除单个分类（不级联）：删一级不会连带删它的二级，那些二级会变成孤儿；
 * 删二级则其成员入口若不再属于任何分类就退回未归类。
 */
export function deleteAssetCategory(id: number) {
  return request.delete(`/api/v1/admin/asset-category/${id}`);
}

/** 按传入的 id 顺序重写 sortOrder；只传同一层级的兄弟节点 */
export function reorderAssetCategories(ids: number[]) {
  return request.put('/api/v1/admin/asset-category/reorder', { ids });
}
