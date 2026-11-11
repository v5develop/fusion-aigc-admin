import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 资产库增强运营后台接口（只读：标签字典、分类统计）。
 * fusion_aigc_go 的 admin-api，前缀 /api/v1/asset-library/admin。
 *
 * 信封与鉴权与 local-life-admin 一致：HTTP 恒为 200，业务结果看 code（0 成功；1002 未登录）。
 * local-life-admin 的 axios 实例是模块私有的，这里照抄一份，互不影响。
 */
const PREFIX = '/api/v1/asset-library/admin';

const http = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface Envelope<T> {
  code: number;
  msg: string;
  data: T;
}

export const ASSETLIB_CODE_UNAUTHORIZED = 1002;

async function call<T>(request: Promise<AxiosResponse<Envelope<T>>>): Promise<T> {
  let body: Envelope<T>;
  try {
    body = (await request).data;
  } catch {
    message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === ASSETLIB_CODE_UNAUTHORIZED) {
    clearTokens();
    if (router.currentRoute.value.path !== '/login') {
      router.push({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } else {
    message.error(body.msg || '操作失败');
  }
  throw new Error(body.msg || 'error');
}

// ---------------- 类型 ----------------

export type AssetLibMedia = 'image' | 'video';

export interface AdminTagsQuery {
  page?: number;
  pageSize?: number;
  /** 0 / 空 = 全部用户 */
  userId?: number;
  /** 标签名模糊 */
  q?: string;
}

export interface AdminTag {
  id: number;
  userId: number;
  name: string;
  /** 使用该标签的资产数 */
  assetCount: number;
  createdAt: number;
}

export interface AdminTagsResp {
  list: AdminTag[];
  total: number;
}

export interface KindStatsQuery {
  /** 0 / 空 = 全部用户 */
  userId?: number;
  /** 空 = 图片 + 视频 */
  media?: AssetLibMedia | '';
}

export interface KindStat {
  /** 5 个 kind 或 uncategorized */
  kind: string;
  /** upload / generated / official */
  source: string;
  count: number;
}

export interface CountItem {
  key: string;
  label: string;
  count: number;
}

export interface KindStatsResp {
  rows: KindStat[];
  /** 按 kind 汇总（含 all） */
  kinds: CountItem[];
  /** 按来源汇总 */
  sources: CountItem[];
}

// ---------------- 接口 ----------------

export function listTags(query: AdminTagsQuery) {
  return call<AdminTagsResp>(http.get(`${PREFIX}/tags`, { params: query }));
}

export function getKindStats(query: KindStatsQuery) {
  return call<KindStatsResp>(http.get(`${PREFIX}/kind-stats`, { params: query }));
}
