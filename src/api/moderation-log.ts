import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'

// 内容审核日志（afv_moderation_log）——含命中目标与上游原始响应，仅后台可见（未脱敏）
export interface ModerationLog {
  id: number
  /** 关联创作任务 taskId */
  taskId?: string
  userId?: number
  username?: string
  /** 审核对象：IMAGE 图片 / TEXT 文本 / VIDEO 视频抽帧 */
  bizType: string
  /** 审核提供方：yidun 易盾 / green 绿网 / template 策展素材免审 */
  provider: string
  passed: boolean
  /** 命中场景：porn/terrorism/antispam/whitelist/error 等 */
  scene?: string
  label?: string
  /** 命中目标（违规图 URL / 未通过文本摘要，未脱敏；通过为空） */
  rejectedTarget?: string
  reason?: string
  /** 审核请求内容（送审原始文本全文 / 图片URL列表，未脱敏） */
  requestContent?: string
  /** 上游原始响应（排障用） */
  rawResponse?: string
  requestId?: string
  createTime: string
}

export interface ModerationLogQuery {
  taskId?: string
  userId?: number
  passed?: boolean
  provider?: string
  bizType?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}

// 任务详情关联：某创作任务（含子任务）的审核日志
export function getCreationTaskModerationLogs(id: number) {
  return request.get<ModerationLog[]>(`/api/v1/admin/creation/tasks/${id}/moderation-logs`)
}

// 独立查询页：内容审核日志分页
export function getModerationLogList(params: ModerationLogQuery) {
  return request.get<PageResult<ModerationLog>>('/api/v1/admin/moderation-logs/page', { params })
}
