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
  type: string
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
  type?: string
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
