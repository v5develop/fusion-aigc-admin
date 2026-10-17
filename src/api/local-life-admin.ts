import { message } from 'antdv-next';
import axios, { type AxiosResponse } from 'axios';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 本地生活运营后台接口（fusion_aigc_go 的 admin-api，前缀 /api/v1/local-life/admin）。
 *
 * 令牌与 Java 后台共用（Go 签发，写入 Java 的会话 Redis），所以这里直接取 Java 的 token。
 * 与 Java 的 request 不同：HTTP 状态恒为 200，业务结果看响应里的 code：
 * 0 成功；1002 未登录 / 已过期（清会话回 /login）；其余为业务错误，直接提示 msg。
 */
const PREFIX = '/api/v1/local-life/admin';

const http = axios.create({
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

export const LOCAL_LIFE_CODE_UNAUTHORIZED = 1002;

async function call<T>(request: Promise<AxiosResponse<Envelope<T>>>, silent = false): Promise<T> {
  let body: Envelope<T>;
  try {
    body = (await request).data;
  } catch {
    if (!silent) message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === LOCAL_LIFE_CODE_UNAUTHORIZED) {
    clearTokens();
    if (router.currentRoute.value.path !== '/login') {
      router.push({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } else if (!silent) {
    message.error(body.msg || '操作失败');
  }
  throw new Error(body.msg || 'error');
}

// ---------------- 类型 ----------------

export interface LocalLifeAdmin {
  id: number;
  username: string;
  real_name: string;
  roles: string[];
}

export interface Option {
  id: number;
  option_type: string;
  code: string;
  label: string;
  value: string;
  sort_order: number;
  status: number;
}

export interface OptionForm {
  option_type: string;
  code: string;
  label: string;
  value?: string;
  sort_order?: number;
  status: number;
}

export interface ModelInfo {
  id: number;
  name: string;
  code: string;
  platform: string;
}

export interface CopywritingItem {
  id: number;
  source: string;
  content_type: string;
  content_type_label: string;
  title: string;
  body: string;
  word_count: number;
  status: number;
  fail_reason: string;
  create_time: number;
}

export interface Voice {
  id: number;
  name: string;
  voice: string;
  gender: string;
  style: string;
  categories: string[];
  preview_url: string;
  sort_order: number;
  status: number;
}

export interface VoiceForm {
  name: string;
  voice: string;
  gender: 'female' | 'male';
  style?: string;
  categories?: string[];
  preview_url?: string;
  sort_order?: number;
  status: number;
}

export interface DigitalHumanItem {
  id: number;
  user_id: number;
  name: string;
  portrait_source: string;
  image_url: string;
  voice_id: number;
  voice_name: string;
  script: string;
  video_url: string;
  duration: number;
  status: number;
  fail_reason: string;
  create_time: number;
}

export interface NoteItem {
  id: number;
  user_id: number;
  note_type: string;
  note_type_label: string;
  topic: string;
  title: string;
  content: string;
  tags: string[];
  image_urls: string[];
  status: number;
  fail_reason: string;
  create_time: number;
}

export interface ImageCreationItem {
  id: number;
  user_id: number;
  kind: string;
  content: string;
  image_urls: string[];
  status: number;
  fail_reason: string;
  create_time: number;
}

export interface VideoCreationItem {
  id: number;
  user_id: number;
  kind: string;
  user_text: string;
  selling_points: string;
  duration: number;
  size: string;
  model: string;
  video_url: string;
  status: number;
  fail_reason: string;
  create_time: number;
}

export interface PageList<T> {
  list: T[];
  total: number;
}

export interface ListQuery {
  user_id?: number;
  status?: number;
  page?: number;
  page_size?: number;
}

// ---------------- 文案 ----------------

export function listCopywritingOptions(optionType?: string) {
  return call<{ list: Option[] }>(
    http.get(`${PREFIX}/copywriting/options`, { params: { option_type: optionType } }),
  );
}

export function createCopywritingOption(data: OptionForm) {
  return call<Option>(http.post(`${PREFIX}/copywriting/options`, data));
}

export function updateCopywritingOption(id: number, data: OptionForm) {
  return call<Option>(http.put(`${PREFIX}/copywriting/options/${id}`, data));
}

export function deleteCopywritingOption(id: number) {
  return call<unknown>(http.delete(`${PREFIX}/copywriting/options/${id}`));
}

export function getCopywritingModel() {
  return call<ModelInfo>(http.get(`${PREFIX}/copywriting/model`), true);
}

export function listCopywriting(query: ListQuery & { keyword?: string }) {
  return call<PageList<CopywritingItem>>(http.get(`${PREFIX}/copywriting`, { params: query }));
}

export function deleteCopywriting(id: number) {
  return call<unknown>(http.delete(`${PREFIX}/copywriting/${id}`));
}

// ---------------- AI 数字人 ----------------

export function listDhOptions(optionType?: string) {
  return call<{ list: Option[] }>(
    http.get(`${PREFIX}/digital-humans/options`, { params: { option_type: optionType } }),
  );
}

export function createDhOption(data: OptionForm) {
  return call<Option>(http.post(`${PREFIX}/digital-humans/options`, data));
}

export function updateDhOption(id: number, data: OptionForm) {
  return call<Option>(http.put(`${PREFIX}/digital-humans/options/${id}`, data));
}

export function deleteDhOption(id: number) {
  return call<unknown>(http.delete(`${PREFIX}/digital-humans/options/${id}`));
}

export function listVoices(category?: string) {
  return call<{ list: Voice[] }>(
    http.get(`${PREFIX}/digital-humans/voices`, { params: { category } }),
  );
}

export function createVoice(data: VoiceForm) {
  return call<Voice>(http.post(`${PREFIX}/digital-humans/voices`, data));
}

export function updateVoice(id: number, data: VoiceForm) {
  return call<Voice>(http.put(`${PREFIX}/digital-humans/voices/${id}`, data));
}

export function deleteVoice(id: number) {
  return call<unknown>(http.delete(`${PREFIX}/digital-humans/voices/${id}`));
}

export function generateVoicePreview(id: number) {
  return call<Voice>(http.post(`${PREFIX}/digital-humans/voices/${id}/preview`));
}

export function getDhTtsModel() {
  return call<ModelInfo>(http.get(`${PREFIX}/digital-humans/tts-model`), true);
}

export function listDigitalHumans(query: ListQuery) {
  return call<PageList<DigitalHumanItem>>(http.get(`${PREFIX}/digital-humans`, { params: query }));
}

// ---------------- 图文笔记 / 海报长图 / 视频（只读） ----------------

export function listNotes(query: ListQuery) {
  return call<PageList<NoteItem>>(http.get(`${PREFIX}/notes`, { params: query }));
}

export function listImageCreations(query: ListQuery & { kind?: string }) {
  return call<PageList<ImageCreationItem>>(
    http.get(`${PREFIX}/image-creations`, { params: query }),
  );
}

export function listVideoCreations(query: ListQuery & { kind?: string }) {
  return call<PageList<VideoCreationItem>>(
    http.get(`${PREFIX}/video-creations`, { params: query }),
  );
}

// ---------------- 生成配置（模型 / 比例 / 时长） ----------------

export interface GenOptionItem {
  id: number;
  group: string;
  code: string;
  label: string;
  sort_order: number;
  enabled: boolean;
  is_default: boolean;
}

export interface GenOptionUpdate {
  label: string;
  sort_order: number;
  enabled: boolean;
  is_default: boolean;
}

export interface GenKindItem {
  kind: string;
  template_required: boolean;
}

export function listGenOptions() {
  return call<{ list: GenOptionItem[]; kinds: GenKindItem[] }>(http.get(`${PREFIX}/gen-options`));
}

export function updateGenKind(kind: string, data: { template_required: boolean }) {
  return call<GenKindItem>(http.put(`${PREFIX}/gen-kinds/${kind}`, data));
}

export function updateGenOption(id: number, data: GenOptionUpdate) {
  return call<GenOptionItem>(http.put(`${PREFIX}/gen-options/${id}`, data));
}
