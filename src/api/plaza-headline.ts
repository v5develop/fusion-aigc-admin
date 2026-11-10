import type { PageResult } from '@/types/api';

import { request } from '@/utils/request';

/**
 * 智能体首页「本周头条」（Java AdminPlazaHeadlineController，权限 creaft_catalog:view / edit）。
 *
 * 头条只挂广场模板 id + 一句推荐语 + 生效窗口；标题 / 封面 / 标签都读模板本身。
 * 用户端 GET /api/v1/plaza-headlines 只显示「今天在窗口内 + 启用 + 模板仍启用」的头条，按近 7 天复刻次数排序。
 */
export type PlazaHeadlinePhase = 'CURRENT' | 'UPCOMING' | 'EXPIRED';

export interface PlazaHeadlineRow {
  id: number;
  plazaTemplateId: number;
  templateTitle: string | null;
  templateCover: string | null;
  templateTags: string[];
  /** 模板已被删除时为 false */
  templateExists: boolean;
  templateEnabled: boolean;
  why: string;
  /** yyyy-MM-dd，闭区间 */
  startDate: string;
  endDate: string;
  sortOrder: number | null;
  enabled: number | null;
  phase: PlazaHeadlinePhase;
  /** 近 7 天复刻次数（10 分钟缓存） */
  uses: number;
  previousUses: number;
  /** 趋势百分比；前 7 天为 0 时为 null（新上榜） */
  trend: number | null;
  isNew: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createTime?: string;
  updateTime?: string;
}

export interface PlazaHeadlineSuggestion {
  plazaTemplateId: number;
  title: string;
  cover: string | null;
  tags: string[];
  uses: number;
  previousUses: number;
  trend: number | null;
  isNew: boolean;
  /** 已在当前或待生效的头条里 */
  headlined: boolean;
}

export interface PlazaHeadlineSaveData {
  plazaTemplateId: number;
  why: string;
  startDate: string;
  endDate: string;
  sortOrder?: number;
  enabled?: number;
}

const BASE = '/api/v1/admin/creaft/plaza-headlines';

export function getPlazaHeadlines(params: {
  phase?: 'current' | 'upcoming' | 'expired' | 'all';
  keyword?: string;
  enabled?: number;
  page?: number;
  pageSize?: number;
}) {
  return request.get<PageResult<PlazaHeadlineRow>>(BASE, { params });
}

export function getPlazaHeadlineSuggestions(limit = 10) {
  return request.get<PlazaHeadlineSuggestion[]>(`${BASE}/suggestions`, { params: { limit } });
}

export function createPlazaHeadline(data: PlazaHeadlineSaveData) {
  return request.post<number>(BASE, data);
}

/** 整体替换语义 */
export function updatePlazaHeadline(id: number, data: PlazaHeadlineSaveData) {
  return request.put<void>(`${BASE}/${id}`, data);
}

export function deletePlazaHeadline(id: number) {
  return request.delete<void>(`${BASE}/${id}`);
}
