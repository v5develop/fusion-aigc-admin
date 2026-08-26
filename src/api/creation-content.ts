import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

/**
 * 创作内容（afv_creation_task 的内容运营视角）。
 * 与「创作任务列表」同源不同视角：那边面向运维（计费/重试/屏蔽），这边面向内容运营
 * （产物长什么样、有没有被推荐、用户端是不是已经删了）。
 */
export interface CreationContentItem {
  /** 数据ID（afv_creation_task.id），推荐内容按此 id 引用 */
  id: number
  taskId: string
  userId: number | null
  username: string
  /**
   * 任务原始类型，仅供展示。混着两套约定：多数是小驼峰（image / productSetImages），
   * 电商那条路存请求原值（IMAGE / PRODUCTSETIMAGES）。
   */
  type: string
  /**
   * 归一化媒体类型：image / video。决定用 <img> 还是 <video> 渲染，判断只能用它。
   * 别拿 type 自己比：大小写两套约定混着，更要命的是电商视频入口的字面量里根本没有
   * "video"（productReplacement / personReplacement），怎么比都会把视频渲染成裂图。
   */
  mediaType: string
  entryCode: string
  /** 0 排队 1 处理中 2 成功 3 失败 */
  status: number
  mode: number | null
  /** 列表缩略图：视频优先封面，否则首张产物 */
  thumbnail: string | null
  /** 全部产物（已按水印图优先逐位对齐），多图可幻灯片查看 */
  urls: string[]
  /** 提示词（取自原始提交体） */
  prompt: string | null
  /**
   * 用户原始提交体（整个 request_params 原样下发）。
   * 用户上传的素材在顶层（submit 是 images/video/audio，submit-by-template 是
   * imageUrls/videoUrl/audioUrl），不在 params 子对象里，所以后端不挑子对象。
   * 后台是管理员视角，此处不脱敏——运营要看到用户传了什么才能判断内容能不能推。
   */
  submitPayload: Record<string, unknown> | null
  /** 0 未屏蔽 / 1 屏蔽 / 2 永久屏蔽 */
  blockStatus: number | null
  userDeleted: boolean
  recommended: boolean
  createTime: string
}

export interface CreationContentQuery {
  /** 任务ID 或 数据ID */
  keyword?: string
  entryCode?: string
  /**
   * 按媒体形态筛：image / video。
   * 后端不是拿它跟任务 type 精确匹配，而是按 offer 的 category 展开成入口集合——
   * 传 'image' 能筛到 PRODUCTSETIMAGES 这类电商图片任务。传别的值会被当成不筛。
   */
  mediaType?: string
  status?: number
  userDeleted?: boolean
  recommended?: boolean
  page?: number
  pageSize?: number
}

export interface EntryCodeOption {
  entryCode: string
  entryName: string
}

export function getCreationContentList(params: CreationContentQuery) {
  return request.get<PageResult<CreationContentItem>>('/api/v1/admin/creation/contents', { params })
}

/** 创作入口下拉。与展示素材侧同源，但各自套权限，别跨着调 */
export function getContentEntryCodes() {
  return request.get<EntryCodeOption[]>('/api/v1/admin/creation/contents/entry-codes')
}
