import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type { PromptSlot } from '@/types/template-builder'

export type { PromptSlot }

/**
 * Prompt variable definition.
 * Variables are referenced inside the prompt content using {{name}} syntax.
 *
 * @deprecated 高级提示词请使用 `slots` (PromptSlot[])，与模板系统/用户端渲染器统一。
 *   `variables` 仅为兼容存量纯文本提示词保留。
 */
export interface PromptVariable {
  name: string
  label?: string
  description?: string
  defaultValue?: string
  required?: boolean
}

export interface PromptRecord {
  id: string
  name: string
  code?: string
  category?: string
  description?: string
  /** 首屏卡片图标（图标名或 URL） */
  icon?: string
  /** 首屏卡片封面缩略图 URL */
  coverImage?: string
  /**
   * 提示词正文，使用 {{slotKey}} 标记占位组件位置。
   * 例: "上传{{productImage}}，生成电商主图，商品名称是{{productName}}"
   */
  content: string
  /** 占位组件定义，与模板系统 PromptSlot 同构，供用户端 PromptInputWidget 直接渲染 */
  slots?: PromptSlot[]
  /** @deprecated 旧的简单变量定义，仅兼容存量数据 */
  variables?: PromptVariable[]
  tags?: string[]
  version?: number
  usageCount?: number
  enabled?: number
  sort?: number
  createTime?: string
  updateTime?: string
}

export interface PromptFormData {
  id?: string
  name: string
  code?: string
  category?: string
  description?: string
  icon?: string
  coverImage?: string
  content: string
  slots?: PromptSlot[]
  /** @deprecated 仅兼容存量数据 */
  variables?: PromptVariable[]
  tags?: string[]
  enabled?: number
  sort?: number
}

export function getPromptList(params: {
  keyword?: string
  category?: string
  enabled?: number
  pageNo?: number
  pageSize?: number
}) {
  return request.get<PageResult<PromptRecord>>('/api/v1/admin/creation/prompts', { params })
}

export function getPromptDetail(id: string) {
  return request.get<PromptRecord>(`/api/v1/admin/creation/prompts/${id}`)
}

export function createPrompt(data: PromptFormData) {
  return request.post('/api/v1/admin/creation/prompts', data)
}

export function updatePrompt(id: string, data: PromptFormData) {
  return request.put(`/api/v1/admin/creation/prompts/${id}`, data)
}

export function deletePrompt(id: string) {
  return request.delete(`/api/v1/admin/creation/prompts/${id}`)
}
