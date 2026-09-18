import { request } from '@/utils/request';

/** 分发平台。BOTH=两端共用；分类与推荐记录共用这套取值。 */
export type Platform = 'APP' | 'PC' | 'BOTH';

/**
 * 内容分类（两级树）。一级 parentId=0 / level=1，二级 parentId=父ID / level=2。
 * 一级用于用户端顶部 Tab 与灵感素材归类，二级只用于推荐内容归类。
 * APP 与 PC 的分类可以不一样，由 platform 表达。
 */
export interface DisplayCategoryNode {
  id: number;
  categoryCode: string;
  categoryName: string;
  parentId: number;
  level: number;
  platform: Platform;
  sortOrder: number;
  /** 0-停用 1-启用 */
  status: number;
  /** 二级子分类；二级节点恒为空数组 */
  children: DisplayCategoryNode[];
}

export interface DisplayCategorySaveData {
  categoryCode: string;
  categoryName?: string;
  /** 1-一级 2-二级，默认 1。创建后不可改。 */
  level?: number;
  /** 二级必填；一级忽略。创建后不可改。 */
  parentId?: number;
  /** 默认 BOTH；二级必须被父级覆盖 */
  platform?: Platform;
  sortOrder?: number;
  status?: number;
}

/**
 * 分类树。
 * @param onlyEnabled true 只返回启用项（后台默认要看到停用项，故默认 false）
 * @param platform 传 APP/PC 只返回该端可见的分类（含 BOTH）；不传返回全部
 */
export function getCategoryTree(onlyEnabled = false, platform?: Platform) {
  return request.get<DisplayCategoryNode[]>('/api/v1/admin/display/categories', {
    params: { onlyEnabled, platform },
  });
}

export function createCategory(data: DisplayCategorySaveData) {
  return request.post<number>('/api/v1/admin/display/categories', data);
}

/** 层级与父级不可改：改了会让已挂其下的素材与推荐记录语义漂移 */
export function updateCategory(id: number, data: Partial<DisplayCategorySaveData>) {
  return request.put(`/api/v1/admin/display/categories/${id}`, data);
}

/** 删一级会连带删其全部二级；分类下仍有素材或推荐内容时后端拒绝 */
export function deleteCategory(id: number) {
  return request.delete(`/api/v1/admin/display/categories/${id}`);
}
