import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

/**
 * 子资产（afv_asset_item）。只有 customizedModel / realPersonModel 这类
 * 「一条素材下面还挂着多张图」的素材才有，普通产物恒为空数组，且**只在详情接口返回**。
 */
export interface UserAssetItem {
  id: number
  assetId: number
  /** front / side / back / detail / expression / pose / variant / original */
  itemType: string | null
  name: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  /** 动态属性 JSON 字符串，原样透出 */
  properties: string | null
  sortOrder: number | null
  /** 1-用户上传 2-AI生成 */
  sourceType: number | null
  aiPrompt: string | null
  createTime?: string
}

/**
 * 用户素材（afv_asset）。
 *
 * 与另外两块粒度不同，别搞混：
 * - 「展示素材管理」是运营手灌的运营位内容（afv_public_display_assets）；
 * - 「创作内容列表」是「一次生成」的任务粒度（afv_creation_task）；
 * - 本接口是**产物**粒度——一个 num=4 的任务落 4 条素材，单条产物的宽高、比例、
 *   封面对不对，只有在这一层才看得见。
 */
export interface UserAsset {
  id: number
  userId: number | null
  /** 昵称 → 登录名 → 脱敏手机号，后端保证非空 */
  username: string
  /** 来源创作主任务ID；用户自己上传的素材没有这个值 */
  sourceTaskId: string | null
  /** 资产类型，值域不统一（image/video 或电商 entryCode），仅供展示 */
  type: string | null
  entryCode: string | null
  /** 入口中文名，取自计费 offer；查不到时后端已回退成 entryCode */
  entryName: string | null
  name: string | null
  /**
   * 归一化媒体类型：image / video。**渲染判断只能用它**。
   * 别拿 type 自己判：它混着大小写两套约定，且电商视频入口的字面量里根本没有
   * "video"（productReplacement / personReplacement），怎么比都会把视频渲染成裂图。
   */
  mediaType: string
  /** 封面。视频素材这里可能仍是 mp4 地址本身（存量未回填），前端要按 mediaType 兜底 */
  coverUrl: string | null
  resultUrl: string | null
  /** 0 = 未知（探测失败或还没探到），不是「宽 0 像素」 */
  width: number
  height: number
  /** 归一化标准比例；空串/null = 还没算出来 */
  aspectRatio: string | null
  /** 1-用户上传 2-AI生成 */
  sourceType: number | null
  aiPrompt: string | null
  /** 0-草稿 1-正常 */
  status: number | null
  /** 用户端是否已删除（逻辑删除位）。列表默认连已删的一起给，排查「我的图没了」正需要 */
  userDeleted: boolean
  createTime: string
  /** 仅详情返回 */
  items?: UserAssetItem[] | null
}

export interface UserAssetQuery {
  /** 名称 / 素材ID / 来源任务ID */
  keyword?: string
  userId?: number
  /**
   * 聚合分类编码（一级或二级都行），后端展开成入口集合再筛。
   * 与 entryCode 同传时**以 entryCode 为准**：分类是入口的集合，两者求交会让人
   * 选了具体入口却查不到。
   */
  assetCategory?: string
  entryCode?: string
  aspectRatio?: string
  /** image / video；其余值后端一律当不筛 */
  mediaType?: string
  /** 1-用户上传 2-AI生成 */
  sourceType?: number
  /** 三态：不传=不限、true=仅已删除、false=仅未删除。别写成 `x || undefined`，会把 false 吞掉 */
  deleted?: boolean
  /** ISO 本地日期时间，如 2026-08-28T00:00:00 */
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}

export function getUserAssetList(params: UserAssetQuery) {
  return request.get<PageResult<UserAsset>>('/api/v1/admin/user-assets', { params })
}

/**
 * 比例筛选可选值。**不要硬编码**：比例集跟着后端归一化规则走，
 * 两边各写一份，加比例时必然漏改一边，下拉里就会出现永远筛不到东西的死选项。
 */
export function getUserAssetAspectRatios() {
  return request.get<string[]>('/api/v1/admin/user-assets/aspect-ratios')
}

/** 详情：比列表多一个 items（子资产）。已被用户删除的素材同样查得到 */
export function getUserAssetDetail(id: number) {
  return request.get<UserAsset>(`/api/v1/admin/user-assets/${id}`)
}

/**
 * 删除素材：**逻辑删除**，用户端随即不可见。
 * 后端不做物理删除（文件还在 OSS 上、也可能已被推荐位引用），所以还有人工恢复的余地，
 * 但删的是用户自己的东西，调用前必须二次确认。
 */
export function deleteUserAsset(id: number) {
  return request.delete<boolean>(`/api/v1/admin/user-assets/${id}`)
}
