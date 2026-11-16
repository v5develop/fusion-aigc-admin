import { message } from 'antdv-next';
import { create, type AxiosResponse } from 'axios';
import { reactive } from 'vue';

import router from '@/router';
import { clearTokens, getToken } from '@/utils/storage';

/**
 * 广场模板域后台接口（Go admin-api，前缀 /api/v1/plaza/admin）。
 * 契约以 fusion_aigc_go 代码为准：app/plaza/core/admin_*.go、app/plaza/headline/{httpapi,service}、
 * app/admin/api/internal/handler/plaza/plaza.go；文档 docs/api/api-plaza.md、plaza-slot-schema-v1.md 与代码不一致处以代码为准。
 *
 * 信封：{code, reason?, msg, data}，字段 camelCase。业务失败 HTTP 恒 200、看 code；
 * 唯一例外是未登录：code 2001 / reason UNAUTHORIZED，HTTP 401（所以 axios 要放行 4xx 才读得到 body）。
 * 权限：整个前缀默认 GET=creaft_catalog:view、其余=creaft_catalog:edit；
 *   plaza:publish（发布 / 下线，含批量）、plaza:delete（删除 / 恢复 / 彻底删除，含批量）、plaza:audit（审计）为路由级覆盖。
 *
 * mock 开关：.env.development.local 里设 VITE_PLAZA_ADMIN_MOCK=true，本文件的全部请求改走
 * ./plaza-admin.mock.ts 的内存假后端（带状态，增删改会生效，刷新页面重置），不经网络，
 * 与 VITE_USE_MOCK（vite-plugin-mock-dev-server）互相独立，后端就绪后关掉即可。
 */
const PREFIX = '/api/v1/plaza/admin';

/** Go xerr.Unauthorized（HTTP 401）。注意 Go 的 1002 是 PARAM_MISSING，不是未登录 */
export const PLAZA_CODE_UNAUTHORIZED = 2001;

const http = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  // 4xx 也要读 body（401 的信封里有 code / msg）；5xx 与网络错误仍走异常
  validateStatus: (status) => status < 500,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Envelope<T> {
  code: number;
  reason?: string;
  msg: string;
  data: T;
}

export type PlazaMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const isPlazaMock = (): boolean => import.meta.env.VITE_PLAZA_ADMIN_MOCK === 'true';

async function send<T>(
  method: PlazaMethod,
  path: string,
  params?: Record<string, unknown>,
  data?: unknown,
): Promise<Envelope<T>> {
  if (isPlazaMock()) {
    const { handleMock } = await import('./plaza-admin.mock');
    return (await handleMock(method, path, params ?? {}, data)) as Envelope<T>;
  }
  const res: AxiosResponse<Envelope<T>> = await http.request<Envelope<T>>({
    method,
    url: `${PREFIX}${path}`,
    params,
    data,
  });
  return res.data;
}

/** 入参 schema 校验的一处错误（SLOTS_INVALID 的 data.errors） */
export interface SlotFieldError {
  field: string;
  rule: string;
  message: string;
}

/** 头条参数校验的一处错误（HEADLINE_PARAMS_INVALID 的 data.fields） */
export interface ParamFieldError {
  field: string;
  reason: string;
}

/** 业务错误携带的 reason（如 INDUSTRY_HAS_TEMPLATES），页面据此分支处理 */
export class PlazaError extends Error {
  reason?: string;
  code: number;
  /** 校验失败时的第一处字段路径，如 items[2].options（取自 data.field） */
  field?: string;
  /** SLOTS_INVALID：全部错误 */
  errors?: SlotFieldError[];
  /** HEADLINE_PARAMS_INVALID：全部字段错误 */
  fields?: ParamFieldError[];
  constructor(code: number, msg: string, reason?: string, data?: unknown) {
    super(msg);
    this.code = code;
    this.reason = reason;
    const d = data as
      | {
          field?: string;
          errors?: SlotFieldError[];
          fields?: ParamFieldError[];
        }
      | null
      | undefined;
    this.field = d?.field;
    this.errors = Array.isArray(d?.errors) ? d.errors : undefined;
    this.fields = Array.isArray(d?.fields) ? d.fields : undefined;
  }
}

/** 乐观并发冲突：整体编辑是 TEMPLATE_CONFLICT，只改入参（PUT /slots）是 CONFLICT，都是 4002 */
export const isConflictError = (e: unknown): boolean =>
  e instanceof PlazaError && (e.reason === 'TEMPLATE_CONFLICT' || e.reason === 'CONFLICT');

interface CallOptions {
  /** 不弹全局错误提示，由页面自己处理（如删除行业时按 reason 弹迁移框） */
  silent?: boolean;
  /** 写操作分组：后端返回 ADMIN_WRITE_DISABLED 时把该组标为「还在原后台修改」，页面据此置灰按钮 */
  op?: WriteOp;
}

/**
 * 交接期写权（模板写权还在 Java 时 Go 返回 7003 · ADMIN_WRITE_DISABLED）。
 * 按操作分组记住「被拒过」的组，页面用 isOpBlocked(op) 把按钮置灰并提示；能写的组不受影响。
 * 记在 sessionStorage：刷新后仍置灰，不必每次再点一下才知道；换会话后重新探测。
 */
export type WriteOp =
  | 'status' // 发布 / 下线
  | 'trash' // 删除 / 恢复 / 彻底删除 / 复制
  | 'edit' // 整体编辑 / 新建
  | 'slots' // 入参配置
  | 'industryRel' // 挂行业 / 移出行业 / 覆盖行业 / 置顶
  | 'industryOrder' // 行业内排序
  | 'attrs' // 渠道 / 媒体类型
  | 'samples'; // 示例素材

export const WRITE_DISABLED_REASON = 'ADMIN_WRITE_DISABLED';
export const WRITE_DISABLED_TIP = '这项还在原后台修改';
const BLOCK_KEY = 'plaza_admin_blocked_ops';
const blockedOps = reactive<Record<string, boolean>>({});
try {
  for (const k of JSON.parse(sessionStorage.getItem(BLOCK_KEY) ?? '[]') as string[])
    blockedOps[k] = true;
} catch {
  /* 无存储或内容损坏：当作都没被拒过 */
}
const markBlocked = (op: WriteOp) => {
  blockedOps[op] = true;
  try {
    sessionStorage.setItem(
      BLOCK_KEY,
      JSON.stringify(Object.keys(blockedOps).filter((k) => blockedOps[k])),
    );
  } catch {
    /* 忽略 */
  }
};
/**
 * GET /capabilities：{adminWriteEnabled, writable{status, recycle, fullEdit, slots, industryRelation, industryOrder, attrs, samples}}。
 * 进页面就取一次，据此置灰；没取到（接口失败 / 旧后端）时退回「被拒过一次才置灰」。
 */
export interface PlazaCapabilities {
  adminWriteEnabled: boolean;
  writable: {
    status: boolean;
    recycle: boolean;
    fullEdit: boolean;
    slots: boolean;
    industryRelation: boolean;
    industryOrder: boolean;
    attrs: boolean;
    samples: boolean;
    /** 模板素材直传已装配（与写权属无关；旧后端没有该键） */
    uploads?: boolean;
  };
}
const OP_CAP: Record<WriteOp, keyof PlazaCapabilities['writable']> = {
  status: 'status',
  trash: 'recycle',
  edit: 'fullEdit',
  slots: 'slots',
  industryRel: 'industryRelation',
  industryOrder: 'industryOrder',
  attrs: 'attrs',
  samples: 'samples',
};
const capState = reactive<{ caps: PlazaCapabilities | null }>({ caps: null });
export const getPlazaCapabilities = () =>
  call<PlazaCapabilities>('GET', '/capabilities', { silent: true });
/** 取一次能力并缓存；失败静默（页面照常用，按需被拒再置灰） */
export async function loadPlazaCapabilities(): Promise<PlazaCapabilities | null> {
  try {
    capState.caps = await getPlazaCapabilities();
  } catch {
    /* 旧后端没有该接口 */
  }
  return capState.caps;
}
export const isOpBlocked = (op: WriteOp): boolean =>
  capState.caps ? !capState.caps.writable[OP_CAP[op]] : !!blockedOps[op];
/** 能写了（后端切了写权）：手动清除置灰记录 */
export const clearBlockedOps = () => {
  for (const k of Object.keys(blockedOps)) delete blockedOps[k];
  try {
    sessionStorage.removeItem(BLOCK_KEY);
  } catch {
    /* 忽略 */
  }
};
export const isWriteDisabledError = (e: unknown): boolean =>
  e instanceof PlazaError && e.reason === WRITE_DISABLED_REASON;

/**
 * 页面自己处理（silent）的写操作失败统一提示：交接期未开放 → 「这项还在原后台修改」；
 * 乐观并发冲突 → 提示刷新；其余用后端文案。网络异常 call() 已提示过，这里不重复。
 */
export function reportWriteError(e: unknown, conflictText = '他人已修改，请刷新后再改') {
  if (isWriteDisabledError(e)) message.warning(WRITE_DISABLED_TIP);
  else if (isConflictError(e)) message.error(conflictText);
  else if (e instanceof PlazaError) message.error(e.message || '操作失败');
}

async function call<T>(
  method: PlazaMethod,
  path: string,
  opts: {
    params?: Record<string, unknown>;
    data?: unknown;
  } & CallOptions = {},
): Promise<T> {
  let body: Envelope<T>;
  try {
    body = await send<T>(method, path, opts.params, opts.data);
  } catch {
    message.error('网络异常，请稍后重试');
    throw new Error('network');
  }
  if (body.code === 0) return body.data;
  if (body.code === PLAZA_CODE_UNAUTHORIZED) {
    clearTokens();
    if (router.currentRoute.value.path !== '/login') {
      router.push({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } else if (body.reason === WRITE_DISABLED_REASON) {
    if (opts.op) markBlocked(opts.op);
    if (!opts.silent) message.warning(WRITE_DISABLED_TIP);
  } else if (!opts.silent) {
    message.error(body.msg || '操作失败');
  }
  throw new PlazaError(body.code, body.msg || 'error', body.reason, body.data);
}

// =====================================================================
// 时间参数：Go 的 parseAdminTime 只认 RFC3339 / "YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DDTHH:mm:ss" / "YYYY-MM-DD HH:mm"，
// 不认纯日期（HTTP 200 + 1003「时间格式不对」）。日期选择器的 YYYY-MM-DD 要先补成整点。
// =====================================================================

/** 该日 00:00:00 */
export const dayStart = (d: string): string => `${d} 00:00:00`;

/** 次日 00:00:00（用于「到某日（含）」的开区间上界，如行业建议的 to 是 `<`） */
export const nextDayStart = (d: string): string => {
  const t = new Date(`${d}T00:00:00`);
  t.setDate(t.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} 00:00:00`;
};

// =====================================================================
// 行业
// =====================================================================

export interface IndustryTemplateCount {
  total: number;
  published: number;
  image: number;
  video: number;
}

export interface IndustryNode {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  iconUrl: string | null;
  coverUrl: string | null;
  /** 行业门副标题，启用时必填（≤120 字） */
  hint: string | null;
  audienceName: string | null;
  examples: string[];
  nextActions: string[];
  enabled: boolean;
  showWhenEmpty: boolean;
  sortOrder: number;
  templateCount: IndustryTemplateCount;
  /** 偏好该行业的用户数 */
  userCount: number;
  /** 近 7 天做同款轮次 */
  replicate7d: number;
  /** 用户端目录里此刻是否看得到 */
  userVisible: boolean;
  children: IndustryNode[];
}

export interface IndustrySaveData {
  /** 仅新建；之后只读 */
  code?: string;
  parentId?: number | null;
  name: string;
  iconUrl?: string | null;
  hint?: string | null;
  audienceName?: string | null;
  examples?: string[];
  nextActions?: string[];
  enabled?: boolean;
  showWhenEmpty?: boolean;
}

export interface IndustrySortItem {
  id: number;
  parentId: number | null;
  sortOrder: number;
}

/** 编辑行业的响应：停用 / 改 showWhenEmpty 的影响面 */
export interface IndustryUpdateResult {
  id: number;
  affectedTemplates: number;
  affectedUsers: number;
}

export const getIndustries = () => call<IndustryNode[]>('GET', '/industries');

/** 行业功能总开关（数据库 > 配置文件）：库里 plaza.industry.enabled 存在且合法时以库为准，否则跟随配置文件 */
export interface IndustrySwitch {
  enabled: boolean;
  source: 'db' | 'config';
  configDefault: boolean;
  dbValue?: string;
  remark?: string;
  updatedAt?: string;
  effectSeconds: number;
}

export const getIndustrySwitch = () => call<IndustrySwitch>('GET', '/industry-switch');

export const setIndustrySwitch = (body: { enabled: boolean; reason: string }) =>
  call<IndustrySwitch>('PUT', '/industry-switch', { data: body });

export const resetIndustrySwitch = (body: { reason: string }) =>
  call<IndustrySwitch>('DELETE', '/industry-switch', { data: body });

/** 新建只返回 id（不是整棵节点），要节点请重拉树 */
export const createIndustry = (data: IndustrySaveData) =>
  call<{ id: number }>('POST', '/industries', { data });

export const updateIndustry = (id: number, data: IndustrySaveData) =>
  call<IndustryUpdateResult>('PUT', `/industries/${id}`, { data });

export const sortIndustries = (items: IndustrySortItem[]) =>
  call<unknown>('PUT', '/industries/sort', { data: items });

export const deleteIndustry = (id: number, reassignTo?: number, opts?: CallOptions) =>
  call<unknown>('DELETE', `/industries/${id}`, {
    params: reassignTo ? { reassignTo } : undefined,
    ...opts,
  });

// =====================================================================
// 头条（共用的写结果 / 摘要类型，放在模板之前，模板行里要引用）
// =====================================================================

export const GLOBAL_SCOPE = 'ALL';
/** 规则 / 抑制的范围「所有适用行业」：存一行，动态跟随模板的行业 */
export const ANY_SCOPE = '*';

/** 后台模板列表行的头条摘要（最新版本；头条没配库为 null） */
export interface HeadlineBrief {
  onBoard: boolean;
  version: number;
  scopes: {
    scope: string;
    name: string;
    rank: number;
    source: HeadlineSource;
  }[];
  activeRules: number;
  suppressed: boolean;
}

// =====================================================================
// 模板
// =====================================================================

export type TemplateState = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';
/** 服务端 displayState：state 之上叠加上下线窗口与回收站 */
export type TemplateDisplayState = TemplateState | 'SCHEDULED' | 'EXPIRED' | 'DELETED';
export type TemplateMediaType = 'image' | 'video';

export interface TemplateIndustryRef {
  id: number;
  code: string;
  name: string;
  /** 二级行业才有 */
  parentCode?: string;
}

/** 后台列表行 / 回收站行（时间串无时区，CST，形如 2026-11-14T10:00:00） */
/** 视频处理状态（见 api-plaza.md「视频处理流水线」） */
export type MediaStatus = 'PROCESSING' | 'READY' | 'FAILED' | 'PENDING';

export interface PlazaTemplateRow {
  id: number;
  title: string;
  mediaType: TemplateMediaType;
  coverUrl: string;
  state: TemplateState;
  displayState: TemplateDisplayState;
  onlineAt: string | null;
  offlineAt: string | null;
  industries: TemplateIndustryRef[];
  /** 近 7 天做同款次数 */
  uses7d: number;
  /** 创建人（管理员 id） */
  createdBy: number | null;
  createTime: string;
  updateTime: string;
  sortOrder: number;
  /** 仅 sort=industryOrder 且指定行业时有 */
  industrySortOrder?: number;
  enabled: boolean;
  deleted: boolean;
  /** 回收站行才有 */
  deletedAt?: string;
  purgeAt?: string;
  needsProductImage: boolean;
  /** 视频处理状态：PROCESSING 处理中 / READY / FAILED（图片模板恒 READY；PENDING 为旧值，已回填） */
  mediaStatus?: MediaStatus;
  /** FAILED 时的原因（给运营看）；处理中重试期间也会带上最近一次错误 */
  mediaError?: string | null;
  /** 处理结果备注，如「未转码：没有转码能力」 */
  mediaNote?: string | null;
  /** 已尝试次数（满 3 次转 FAILED） */
  mediaAttempts?: number;
  headlineBrief: HeadlineBrief | null;
  /** 乐观并发版本号：每次写 +1；写时带上，冲突 → 4002（旧后端没有则为 undefined，退回按 updateTime 比对） */
  revision?: number;
}

export interface PlazaTemplateQuery {
  keyword?: string;
  industryId?: number;
  includeChildren?: boolean;
  mediaType?: TemplateMediaType;
  /** DRAFT / PUBLISHED（窗口内）/ OFFLINE / SCHEDULED / EXPIRED / DELETED；缺省不含回收站 */
  state?: TemplateDisplayState;
  /** 创建人管理员 id */
  createdBy?: number;
  /** 以下四个时间参数须带时分秒（见 dayStart / nextDayStart）；From 为 >=，To 为 < */
  onlineFrom?: string;
  onlineTo?: string;
  offlineFrom?: string;
  offlineTo?: string;
  unassigned?: boolean;
  /** industryOrder 必须同时指定 industryId */
  sort?: 'sortOrder' | 'updatedAt' | 'createdAt' | 'uses7d' | 'industryOrder';
  order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface PlazaTemplatePage {
  total: number;
  page: number;
  size: number;
  /** 全库未分配行业的（未删除）模板数；回收站接口恒为 0 */
  unassignedCount: number;
  items: PlazaTemplateRow[];
}

// ---- 入参配置（slots，schema v1，见 plaza-slot-schema-v1.md）----
export type SlotType =
  | 'image'
  | 'video'
  | 'text'
  | 'textarea'
  | 'price'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'switch'
  | 'color';

export interface SlotItem {
  /** [a-z][a-z0-9_]{0,31}，模板内唯一 */
  key: string;
  type: SlotType;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  default?: unknown;
  order?: number;
  group?: string;
  // image / video
  minCount?: number;
  maxCount?: number;
  guidance?: string;
  exampleUrl?: string;
  acceptRatio?: string;
  maxDurationSec?: number;
  // text / textarea
  maxLength?: number;
  /** 文字位的叠加布局，原样保存 */
  layout?: unknown;
  // number / price
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  // select / multiselect
  options?: { value: string; label: string }[];
  visibleWhen?: { key: string; equals: unknown };
}

export interface SlotsConfig {
  schemaVersion: 1;
  items: SlotItem[];
}

/** 渠道规格（逐模板覆盖宽高后的结果） */
export interface ChannelSpec {
  code: string;
  name: string;
  width: number;
  height: number;
  ratio: string;
}

export interface PlazaTemplateDetail extends PlazaTemplateRow {
  description: string;
  category: string;
  tags: string[];
  payload: Record<string, unknown> | null;
  payloadKnown: Record<string, unknown>;
  payloadExtra: Record<string, unknown>;
  agentSkillId: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  channels: unknown;
  /** 规整后的 {schemaVersion, items}；没有为 null */
  slots: SlotsConfig | null;
  textOverlay: boolean;
  mediaStatus: MediaStatus;
  industryIds: number[];
  industrySlots: (TemplateIndustryRef & { sortOrder: number })[];
  targetChannels: ChannelSpec[];
  /** 头条联动；草稿 / 回收站 / 读取失败为 null */
  headlineStatus: HeadlineTemplateStatus | null;
}

export const getPlazaTemplate = (id: number) =>
  call<PlazaTemplateDetail>('GET', `/templates/${id}`);

/** 整体编辑 PUT /templates/{id} 的入参：缺省语义见 api-plaza.md「未带字段」；updatedAt 带详情里的 updateTime 做乐观并发 */
export interface PlazaTemplateSaveData {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  /** 缺省 = 保留原载荷 */
  payload?: Record<string, unknown>;
  /** 缺省 = 不改；"" = 解绑 */
  agentSkillId?: string;
  mediaType?: TemplateMediaType;
  videoUrl?: string;
  posterUrl?: string;
  channels?: unknown;
  /** 缺省 = 保留原入参；显式 null / [] / items:[] = 清空 */
  slots?: SlotsConfig | null;
  needsProductImage?: boolean;
  textOverlay?: boolean;
  sortOrder?: number;
  /** 缺省 = 不改；[] = 清空关系 */
  industryIds?: number[];
  /**
   * 上传确认（/uploads/confirm）说视频封面没生成时带 PENDING：发布前必须补封面；
   * 补上封面后带 READY。缺省 = 沿用服务端旧规则
   */
  mediaStatus?: 'READY' | 'PENDING' | 'PROCESSING';
  updatedAt?: string;
  revision?: number;
}

/** 整体编辑的响应：新的 updatedAt / revision（下次保存带上） */
export interface TemplateWriteResult {
  id: number;
  updatedAt: string;
  revision?: number;
}

/** 整体编辑；冲突 4002 · TEMPLATE_CONFLICT（用 isConflictError 判断，页面自己提示） */
export const updatePlazaTemplate = (id: number, data: PlazaTemplateSaveData) =>
  call<TemplateWriteResult>('PUT', `/templates/${id}`, { data, silent: true, op: 'edit' });

/** 新建（默认 DRAFT）；页面自己提示错误 */
export const createPlazaTemplate = (data: PlazaTemplateSaveData) =>
  call<{ id: number }>('POST', '/templates', { data, silent: true, op: 'edit' });

/** 只改入参的响应：规整后的 slots 与新的 updateTime（下次保存带上） */
export interface SaveSlotsResult {
  id: number;
  slots: SlotsConfig | null;
  updatedAt: string;
  revision?: number;
}

/**
 * 保存入参配置：PUT /templates/{id}/slots，body {slots, updatedAt}（updatedAt = 详情里的 updateTime）。
 * 冲突 4002 · CONFLICT；校验失败 1003 · SLOTS_INVALID，PlazaError.field 为第一处路径、errors 为全部错误。
 */
export const saveTemplateSlots = (
  id: number,
  slots: SlotsConfig,
  updatedAt?: string,
  revision?: number,
) =>
  call<SaveSlotsResult>('PUT', `/templates/${id}/slots`, {
    data: { slots, updatedAt, revision },
    silent: true,
    op: 'slots',
  });

export type TemplateBatchAction =
  | 'publish'
  | 'offline'
  | 'delete'
  | 'restore'
  | 'assign'
  | 'unassign'
  | 'replaceIndustries'
  | 'setOrder';

export interface TemplateBatchRequest {
  ids: number[];
  /** assign / unassign 必填；replaceIndustries 可空（= 清空）；setOrder 必须恰好一个 */
  industryIds?: number[];
  onlineAt?: string;
  offlineAt?: string;
  /** publish：越过「没有绑定行业」的检查 */
  force?: boolean;
}

export interface TemplateBatchResult {
  batchId: string;
  ok: number[];
  failed: { id: number; reason: string }[];
}

export const getPlazaTemplates = (query: PlazaTemplateQuery) =>
  call<PlazaTemplatePage>('GET', '/templates', {
    params: query as Record<string, unknown>,
  });

export const getTrashTemplates = (query: { page?: number; size?: number }) =>
  call<PlazaTemplatePage>('GET', '/templates/trash', { params: query });

/** 动作在路径上（权限按路径判：publish/offline → plaza:publish；delete/restore → plaza:delete；其余 creaft_catalog:edit） */
export const batchTemplates = (action: TemplateBatchAction, data: TemplateBatchRequest) =>
  call<TemplateBatchResult>('POST', `/templates/batch/${action}`, {
    data,
    op: BATCH_OP[action],
  });

const BATCH_OP: Record<TemplateBatchAction, WriteOp> = {
  publish: 'status',
  offline: 'status',
  delete: 'trash',
  restore: 'trash',
  assign: 'industryRel',
  unassign: 'industryRel',
  replaceIndustries: 'industryRel',
  setOrder: 'industryRel',
};

export interface PublishResult {
  id: number;
  state: TemplateState;
  warnings: string[];
}

export const publishTemplate = (
  id: number,
  body?: { onlineAt?: string; offlineAt?: string; force?: boolean },
) =>
  call<PublishResult>('POST', `/templates/${id}/publish`, {
    data: body ?? {},
    op: 'status',
  });

/** 下线不接受任何参数（body 被忽略） */
export const offlineTemplate = (id: number) =>
  call<null>('POST', `/templates/${id}/offline`, { op: 'status' });

export const duplicateTemplate = (id: number) =>
  call<{ id: number }>('POST', `/templates/${id}/duplicate`, { op: 'trash' });

export const deleteTemplate = (id: number) =>
  call<unknown>('DELETE', `/templates/${id}`, { op: 'trash' });

export const restoreTemplate = (id: number) =>
  call<unknown>('POST', `/templates/${id}/restore`, { op: 'trash' });

export const purgeTemplate = (id: number) =>
  call<unknown>('DELETE', `/templates/${id}/purge`, { op: 'trash' });

/** 以用户视角预览：与用户端模板项同形，另带 state 与 userVisible（用户此刻是否真能看到） */
export interface PreviewTemplateItem {
  plazaTemplateId: number;
  title: string;
  agentSkillId: string | null;
  tags: string[];
  payload: Record<string, unknown> | null;
  authorName: string;
  /** 低于展示阈值时服务端不下发 */
  usageCount: number | null;
  usageVisible: boolean;
  mediaType: TemplateMediaType;
  videoUrl: string | null;
  posterUrl: string | null;
  coverThumbUrl: string;
  isNew: boolean;
  createdAt: string;
  needsProductImage: boolean;
  targetChannels: ChannelSpec[];
  industries: TemplateIndustryRef[];
  state: TemplateState | '';
  userVisible: boolean;
}

export interface PreviewTemplatesQuery {
  industry: string;
  subIndustry?: string;
  mediaType?: TemplateMediaType;
  keyword?: string;
  page?: number;
  size?: number;
  /** 预览某个时刻用户会看到什么（须带时分秒） */
  asOf?: string;
  includeDraft?: boolean;
}

export interface PreviewTemplatesPage {
  current: number;
  pages: number;
  total: number;
  asOf: string;
  data: PreviewTemplateItem[];
}

export const previewTemplates = (query: PreviewTemplatesQuery) =>
  call<PreviewTemplatesPage>('GET', '/preview/templates', {
    params: query as unknown as Record<string, unknown>,
  });

// =====================================================================
// 头条（app/plaza/headline）
// =====================================================================

/** 条目来源。Go 没有 MANUAL_ADOPTED：接管算法项产生的人工项是 source=MANUAL + adopted=true */
export type HeadlineSource = 'AUTO' | 'MANUAL' | 'FILL';

/** 快照 / 榜单的版本元信息 */
export interface HeadlineSnapshotMeta {
  version: number;
  computedAt: string;
  ageMinutes: number;
  /** SCHEDULED | OPS | REFRESH_NOW | STARTUP */
  trigger: string;
  operatorId: number | null;
  signalSource: 'REDIS' | 'DB';
  paramsHash: string;
  candidateCount: number;
  scopeCount: number;
  itemCount: number;
  durationMs: number | null;
  stale: boolean;
  windowStart: string;
  windowEnd: string;
  /** 当时的参数 JSON 原文（仅榜单接口带） */
  params?: string;
}

export interface HeadlineScopeSummary {
  /** 行业 code 或 ALL（ALL 在首位） */
  scope: string;
  name: string;
  parentCode?: string;
  /** 范围成员数 */
  memberCount: number;
  itemCount: number;
  auto: number;
  manual: number;
  fill: number;
  /** FILL>0：冷启动补位中 */
  coldStart: boolean;
  /** 最新版本里是否已有这个范围（新行业要等下一次刷新） */
  computed: boolean;
}

export interface HeadlineScopesView {
  /** 没有任何版本时为 null */
  snapshot: HeadlineSnapshotMeta | null;
  scopes: HeadlineScopeSummary[];
}

/** 榜单 / 规则 / 抑制里的模板摘要 */
export interface HeadlineTemplateBrief {
  id: number;
  title: string;
  cover: string;
  mediaType: TemplateMediaType | '';
  tags: string[];
  /** 对用户当前是否可见 */
  visible: boolean;
  /** 模板是否还在目录里 */
  exists: boolean;
}

export interface HeadlineSignalDetail {
  raw: number | null;
  /** 权重 */
  w: number;
  /** 贡献值 */
  v: number;
}

export interface HeadlineStats {
  uses7d: number;
  prevUses7d: number;
  r24: number;
  rate6d: number;
  decayed: number;
  velocity: number;
  freshness: number;
  ageDays: number;
  uniqueUsers: number;
}

export interface HeadlineScoreDetail {
  scope: string;
  /** 逐信号：decay / velocity / fresh / users / ctr */
  signals: Record<string, HeadlineSignalDetail>;
  stats: HeadlineStats;
  thresholds: { effMinDecayed: number; effMinUsers: number };
  stability: {
    incumbent: boolean;
    effScore: number;
    entryCutoff: number;
    dwellProtected: boolean;
    rankMovedFrom: number | null;
    rankClampedBy: number;
  };
  mediaCap: { mediaType: string; mediaCount: number };
  pickedBy: 'SCORE' | 'DWELL';
}

/** 算法条目（algo.Item）：快照 / 试算 / 对比 lists 里的形状，不带模板摘要 */
export interface HeadlineAlgoItem {
  scope: string;
  plazaTemplateId: number;
  rank: number;
  source: HeadlineSource;
  /** 命中的人工规则 id（取消推荐 / 取消接管用）；非人工项没有 */
  headlineId?: number;
  /** FILL 为 null */
  score: number | null;
  scoreDetail?: HeadlineScoreDetail;
  why: string;
  uses7d: number;
  prevUses: number;
  /** 较前 7 天百分比；前 7 天为 0 时 null */
  trend: number | null;
  isNew: boolean;
  uniqueUsers: number | null;
  /** RFC3339（+08:00） */
  enteredAt: string;
  pinPosition?: number;
  /** 接管算法项产生的人工项 */
  adopted?: boolean;
}

/** 人工规则（HeadlineRule）。enabled / adoptedFromAuto 是 0 / 1 */
export interface HeadlineRuleBase {
  id: number;
  plazaTemplateId: number;
  scope: string;
  batchId: string | null;
  why: string;
  sortOrder: number;
  enabled: number;
  pinPosition: number | null;
  adoptedFromAuto: number;
  createdBy: number | null;
  updatedBy: number | null;
}

/** GET /rules 的行 */
export interface HeadlineRule extends HeadlineRuleBase {
  startDate: string;
  endDate: string;
  scopeName: string;
  /** CURRENT | UPCOMING | EXPIRED */
  phase: 'CURRENT' | 'UPCOMING' | 'EXPIRED';
  template: HeadlineTemplateBrief;
}

/** 管理端榜单条目：算法条目 + 模板摘要 + 命中的规则 */
export interface HeadlineItem extends HeadlineAlgoItem {
  template: HeadlineTemplateBrief;
  rule?: HeadlineRuleBase;
  ruleStartDate?: string;
  ruleEndDate?: string;
  /** 在该范围当前被取消 / 屏蔽 */
  suppressed: boolean;
  /** 近 7 天数字是否达到展示阈值（用户端才显示具体数字） */
  usageVisible: boolean;
}

export interface HeadlineNearMiss {
  plazaTemplateId: number;
  score: number;
  effScore: number;
  /** 排除原因码：BELOW_MIN_DECAYED / BELOW_MIN_USERS / DIVERSITY_MEDIA / CUT_BY_SLOTS … */
  reason: string;
  /** 入榜门槛（末位有效分）− 本项有效分 */
  gap: number;
  uses7d: number;
  template: HeadlineTemplateBrief;
}

export interface HeadlineScopeStats {
  candidates: number;
  eligible: number;
  auto: number;
  manual: number;
  fill: number;
  autoSlots: number;
  skip: Record<string, number>;
  thresholds: { effMinDecayed: number; effMinUsers: number };
}

/** 某版本某范围的完整榜单（GET /current、/snapshots/{version}、/snapshots/at） */
export interface HeadlineBoard {
  snapshot: HeadlineSnapshotMeta;
  scope: string;
  items: HeadlineItem[];
  nearMiss: HeadlineNearMiss[];
  skip: Record<string, number>;
  thresholds: { effMinDecayed: number; effMinUsers: number };
  stats?: HeadlineScopeStats;
}

export interface HeadlineDiff {
  enter: number[];
  exit: number[];
  moved: { plazaTemplateId: number; from: number; to: number }[];
}

/** 写操作（规则 / 抑制 / 参数）的响应：受影响的行 + 写后同步刷新的结果 */
export interface HeadlineWriteResult {
  ids: number[];
  /** 多范围一次操作共用的批次号 */
  batchId?: string;
  version: number;
  refreshed: boolean;
}

/** POST /refresh 的响应 */
export interface HeadlineRefreshResult {
  version: number;
  refreshed: boolean;
  /** scope → diff */
  diff?: Record<string, HeadlineDiff>;
}

/** 一个范围生效的全部参数。键名即 JSON 键；velocity / weight 是嵌套对象 */
export interface HeadlineParamValues {
  'top-n': number;
  'max-visible': number;
  'half-life-hours': number;
  velocity: { 'min-base': number; min: number; max: number };
  'fresh-days': number;
  weight: {
    decay: number;
    velocity: number;
    fresh: number;
    users: number;
    ctr: number;
  };
  'min-decayed': number;
  'min-unique-users': number;
  'rel-min-ratio': number;
  'per-user-daily-cap': number;
  'rapid-dedupe-seconds': number;
  'max-per-media': number;
  'hysteresis-delta': number;
  'min-dwell-minutes': number;
  'max-rank-move': number;
  'cold-start-fill': boolean;
  'snapshot-retention-days': number;
  'score-normalize': 'none' | 'scope_max';
  'norm-scale': number;
  'global-top-n': number;
  'display-min-uses': number;
}

/** 行业覆盖：只开放这三项，缺省 = 用全局值 */
export interface HeadlineOverride {
  'top-n'?: number;
  'min-decayed'?: number;
  'min-unique-users'?: number;
}

export const OVERRIDE_KEYS = ['top-n', 'min-decayed', 'min-unique-users'] as const;

export interface HeadlineConfig {
  global: HeadlineParamValues;
  overrides: Record<string, HeadlineOverride>;
}

/** 参数项说明。key 是点路径（如 velocity.min-base、weight.decay）；score-normalize 的 min=max=0（枚举，非数字） */
export interface HeadlineParamMeta {
  key: string;
  min: number;
  max: number;
  industryOverride: boolean;
  note: string;
}

export interface HeadlineParamsView {
  defaults: HeadlineParamValues;
  current: HeadlineConfig;
  /** 并发版本：保存时原样带回，被他人改过 → 4002 · HEADLINE_PARAMS_CONFLICT */
  version: number;
  hash: string;
  meta: HeadlineParamMeta[];
  /** 现存行业范围 code */
  industries: string[];
  /** 传了 scope 才有：该范围叠加覆盖后的生效值 */
  effective?: HeadlineParamValues;
}

export interface HeadlinePreviewResult {
  scope: string;
  paramsHash: string;
  /** 试算榜单（算法条目，不带模板摘要） */
  items: HeadlineAlgoItem[];
  stats: HeadlineScopeStats;
  diff: HeadlineDiff;
  /** 对比基准版本 */
  baseVersion: number;
}

export interface HeadlineTemplateScopeStatus {
  scope: string;
  name: string;
  onBoard: boolean;
  rank: number | null;
  source?: HeadlineSource;
  score: number | null;
  uses7d: number;
  suppressed: boolean;
  nearMiss: boolean;
  skipReason?: string;
  gapToCutoff: number | null;
}

/** 抑制行（GET /suppressions、状态里的 blocks） */
export interface HeadlineSuppression {
  id: number;
  plazaTemplateId: number;
  scope: string;
  kind: 'CANCEL' | 'BLOCK';
  reason: string;
  batchId: string | null;
  createdBy: number | null;
  /** CANCEL 的截止时刻（CST，无时区）；永久为 null */
  untilAt: string | null;
  permanent: boolean;
  scopeName: string;
  templateTitle: string;
}

/** GET /templates/{id}/headline-status：模板在每个所属行业榜与 ALL 里的情况 + 适用的规则与抑制 */
export interface HeadlineTemplateStatus {
  template: HeadlineTemplateBrief;
  version: number;
  /** 所属行业榜 + ALL（最后） */
  scopes: HeadlineTemplateScopeStatus[];
  rules: HeadlineRule[];
  blocks: HeadlineSuppression[];
}

export interface HeadlineCompareCell {
  rank: number;
  source: HeadlineSource;
  score: number | null;
  uses7d: number;
}

export interface HeadlineCompareView {
  snapshot: HeadlineSnapshotMeta;
  scopes: string[];
  rows: {
    template: HeadlineTemplateBrief;
    /** 不在该榜为 null */
    cells: Record<string, HeadlineCompareCell | null>;
    memberOf: string[];
  }[];
  lists: Record<string, HeadlineAlgoItem[]>;
}

export interface HeadlineRuleRequest {
  plazaTemplateId: number;
  /** 行业 code；ALL 拒绝；* = 所有适用行业 */
  scopes: string[];
  /** 必填，≤60 字 */
  why: string;
  /** 1~50；缺省不定位 */
  pinPosition?: number | null;
  /** yyyy-MM-dd；缺省今天起 7 天（含首尾） */
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface HeadlineRuleUpdate {
  why: string;
  pinPosition?: number | null;
  /** 必填（整体替换可编辑字段） */
  startDate: string;
  endDate: string;
  enabled?: boolean;
  sortOrder?: number;
  /** 同批各范围的行一起改 */
  applyToBatch?: boolean;
}

export type SuppressDuration = '24h' | 'sunday' | 'custom' | 'permanent';

export interface HeadlineSuppressRequest {
  plazaTemplateId: number;
  scopes: string[];
  /** 时长快捷项（优先于 kind / untilAt）；sunday = 本周日 24:00，custom 须配 customDate（当日 24:00 结束） */
  duration?: SuppressDuration;
  /** yyyy-MM-dd，duration=custom */
  customDate?: string;
  /** 不传 duration 时：CANCEL + untilAt（须晚于现在）| BLOCK */
  kind?: 'CANCEL' | 'BLOCK';
  untilAt?: string;
  /** 必填，≤200 字 */
  reason: string;
  /** 同时作用于上级行业 */
  alsoParent?: boolean;
}

export interface HeadlinePage<T> {
  total: number;
  list: T[];
}

export const getHeadlineScopes = () => call<HeadlineScopesView>('GET', '/headlines/scopes');

/** 还没生成过榜单时 404 · HEADLINE_SNAPSHOT_EXPIRED，由页面决定怎么提示 */
export const getHeadlineCurrent = (scope: string, opts?: CallOptions) =>
  call<HeadlineBoard>('GET', '/headlines/current', {
    params: { scope },
    ...opts,
  });

export const getHeadlineSnapshots = (params: { page?: number; size?: number } = {}) =>
  call<HeadlinePage<HeadlineSnapshotMeta>>('GET', '/headlines/snapshots', {
    params,
  });

/** 超过保留期 404 · HEADLINE_SNAPSHOT_EXPIRED */
export const getHeadlineSnapshot = (version: number, scope: string, opts?: CallOptions) =>
  call<HeadlineBoard>('GET', `/headlines/snapshots/${version}`, {
    params: { scope },
    ...opts,
  });

/** time 形如 yyyy-MM-ddTHH:mm:ss（CST） */
export const getHeadlineSnapshotAt = (time: string, scope: string, opts?: CallOptions) =>
  call<HeadlineBoard>('GET', '/headlines/snapshots/at', {
    params: { time, scope },
    ...opts,
  });

/** scopes 1~4 个；at 缺省看最新版本 */
export const compareHeadlines = (scopes: string[], at?: string, opts?: CallOptions) =>
  call<HeadlineCompareView>('GET', '/headlines/compare', {
    params: { scopes: scopes.join(','), at },
    ...opts,
  });

/** 模板不在目录（草稿 / 回收站）时 404 · HEADLINE_TEMPLATE_NOT_FOUND */
export const getHeadlineTemplateStatus = (id: number, opts?: CallOptions) =>
  call<HeadlineTemplateStatus>('GET', `/headlines/templates/${id}/headline-status`, opts);

export const refreshHeadlines = () => call<HeadlineRefreshResult>('POST', '/headlines/refresh');

/** paramsOverride 可只给部分键，叠加在当前生效参数上（同 PUT /params 的 config 结构） */
export const previewHeadlines = (body: {
  scope: string;
  paramsOverride?: {
    global?: Partial<HeadlineParamValues>;
    overrides?: Record<string, HeadlineOverride>;
  };
}) => call<HeadlinePreviewResult>('POST', '/headlines/preview', { data: body });

export const getHeadlineParams = (scope?: string) =>
  call<HeadlineParamsView>('GET', '/headlines/params', {
    params: scope ? { scope } : undefined,
  });

/**
 * 保存参数。校验失败 1003 · HEADLINE_PARAMS_INVALID（PlazaError.fields 逐字段）；
 * 被他人改过 4002 · HEADLINE_PARAMS_CONFLICT。成功后同步刷新榜单。
 */
export const saveHeadlineParams = (body: { config: HeadlineConfig; version: number }) =>
  call<HeadlineWriteResult>('PUT', '/headlines/params', {
    data: body,
    silent: true,
  });

export const getHeadlineRules = (params: {
  scope?: string;
  plazaTemplateId?: number;
  phase?: 'CURRENT' | 'UPCOMING' | 'EXPIRED';
  page?: number;
  size?: number;
}) => call<HeadlinePage<HeadlineRule>>('GET', '/headlines/rules', { params });

/** 手动推荐：每个范围写一行、共用 batchId */
export const createHeadlineRule = (body: HeadlineRuleRequest) =>
  call<HeadlineWriteResult>('POST', '/headlines/rules', { data: body });

export const updateHeadlineRule = (id: number, body: HeadlineRuleUpdate) =>
  call<HeadlineWriteResult>('PUT', `/headlines/rules/${id}`, { data: body });

/** 取消人工推荐（删除规则；对接管产生的规则 = 取消接管） */
export const deleteHeadlineRule = (id: number, applyToBatch = false) =>
  call<HeadlineWriteResult>('DELETE', `/headlines/rules/${id}`, {
    params: applyToBatch ? { applyToBatch: true } : undefined,
  });

/** 定位到名次（position=null 取消定位）；算法项自动接管。scope 必须是具体行业 */
export const positionHeadline = (body: {
  plazaTemplateId: number;
  scope: string;
  position: number | null;
}) => call<HeadlineWriteResult>('POST', '/headlines/position', { data: body });

export const updateHeadlineWhy = (body: { plazaTemplateId: number; scope: string; why: string }) =>
  call<HeadlineWriteResult>('POST', '/headlines/why', { data: body });

export const suppressHeadline = (body: HeadlineSuppressRequest) =>
  call<HeadlineWriteResult>('POST', '/headlines/suppress', { data: body });

/** 注意：active 缺省 = true（只看生效中）；要含过期必须显式 active=false */
export const getHeadlineSuppressions = (params: { scope?: string; active?: boolean }) =>
  call<HeadlineSuppression[]>('GET', '/headlines/suppressions', {
    params: {
      scope: params.scope,
      active: params.active === false ? 'false' : undefined,
    },
  });

export const deleteHeadlineSuppression = (id: number, applyToBatch = false) =>
  call<HeadlineWriteResult>('DELETE', `/headlines/suppressions/${id}`, {
    params: applyToBatch ? { applyToBatch: true } : undefined,
  });

// =====================================================================
// 行业建议 / 搜索缺口
// =====================================================================

export type FeedbackStatus = 'NEW' | 'ADOPTED' | 'IGNORED' | 'HANDLED';

/** 按规范化文本聚合 */
export interface IndustrySuggestion {
  normText: string;
  text: string;
  /** 提交次数 */
  count: number;
  /** 去重会话数 */
  sids: number;
  lastAt: string;
  status: 'NEW' | 'ADOPTED' | 'IGNORED';
  industryId: number | null;
  handledAt: string | null;
}

export interface IndustrySuggestionPage {
  total: number;
  page: number;
  size: number;
  /** 不带文字、只表示「想要新行业」的提交总数 */
  noTextCount: number;
  items: IndustrySuggestion[];
}

/** 零结果搜索词（按行业 + 规范化词汇总，只有聚合） */
export interface SearchMiss {
  industryCode: string;
  normTerm: string;
  /** 区间内累计次数（不给 from / to 时为总累计） */
  count: number;
  firstDay: string;
  lastDay: string;
  status: 'NEW' | 'HANDLED' | 'IGNORED';
  handledAt: string | null;
}

export interface SearchMissPage {
  total: number;
  page: number;
  size: number;
  items: SearchMiss[];
}

/** from 含、to 不含（开区间上界）；时间须带时分秒（见 dayStart / nextDayStart） */
export const getIndustrySuggestions = (params: {
  status?: string;
  from?: string;
  to?: string;
  /** count（缺省）| recent */
  sort?: 'count' | 'recent';
  page?: number;
  size?: number;
}) => call<IndustrySuggestionPage>('GET', '/industry-suggestions', { params });

/** 采纳 = 先建好行业再回写：body {industryId}，行业须存在 */
export const adoptIndustrySuggestion = (normText: string, industryId: number) =>
  call<unknown>('POST', `/industry-suggestions/${encodeURIComponent(normText)}/adopt`, {
    data: { industryId },
  });

export const ignoreIndustrySuggestion = (normText: string) =>
  call<unknown>('POST', `/industry-suggestions/${encodeURIComponent(normText)}/ignore`);

/** from / to 都按日（含两端）：只取日期部分，所以传 dayStart(日期) 即可 */
export const getSearchMisses = (params: {
  industry?: string;
  from?: string;
  to?: string;
  status?: string;
  /** cnt（缺省）| recent */
  sort?: 'cnt' | 'recent';
  page?: number;
  size?: number;
}) => call<SearchMissPage>('GET', '/search-misses', { params });

/** 标记搜索缺口：POST /search-misses/status，body {industry, term, status}；term 用列表里的 normTerm */
export const markSearchMiss = (
  industryCode: string,
  normTerm: string,
  status: 'HANDLED' | 'IGNORED' | 'NEW',
) =>
  call<unknown>('POST', '/search-misses/status', {
    data: { industry: industryCode, term: normTerm, status },
  });

// =====================================================================
// 交接期可写：行业内排序 / 渠道字典 / 模板渠道与媒体类型 / 示例素材（P0-1）
// 以 Go app/plaza/core/admin_{query,misc,handover}.go 与 docs/api/api-plaza.md「交接期可写范围」为准。
// =====================================================================

/** 某行业内按「行业内顺序」排好的模板；一级行业含仅挂二级的模板时 readOnly=true（需进二级或筛直挂再排） */
export interface IndustryTemplatesView {
  industryId: number;
  readOnly: boolean;
  hint?: string;
  items: PlazaTemplateRow[];
}

export const getIndustryTemplates = (id: number) =>
  call<IndustryTemplatesView>('GET', `/industries/${id}/templates`);

/** 只改该行业内的排序位（不动全局 sortOrder、不动其他行业）；ids 须是该行业当前模板的全集排列 */
export const saveIndustryOrder = (id: number, orderedTemplateIds: number[]) =>
  call<unknown>('PUT', `/industries/${id}/templates/order`, {
    data: { orderedTemplateIds },
    op: 'industryOrder',
  });

/** 未分配行业的模板概况；enabled = 已被 Java 上线、只差挂行业就对用户可见的那批 */
export interface UnassignedSummary {
  total: number;
  enabled: number;
  adminWriteEnabled: boolean;
}
export const getUnassignedSummary = () =>
  call<UnassignedSummary>('GET', '/templates/unassigned-summary');

export interface TemplateIndustriesBody {
  /** 增量（幂等，revision 可选） */
  assign?: number[];
  unassign?: number[];
  /** 整体替换（revision 必填；与 assign / unassign 互斥） */
  industryIds?: number[];
  revision?: number;
}
export interface TemplateIndustriesResult {
  id: number;
  industryIds: number[];
  updatedAt: string;
  revision: number;
  /** false = 没有变化，没写、没记审计 */
  changed: boolean;
}
/** 单个模板挂 / 移出行业；冲突 4002 · CONFLICT。只写关系表，不碰 Java 列，交接期可用 */
export const setTemplateIndustries = (id: number, body: TemplateIndustriesBody) =>
  call<TemplateIndustriesResult>('PUT', `/templates/${id}/industries`, {
    data: body,
    silent: true,
    op: 'industryRel',
  });

export interface ChannelDict {
  id: number;
  code: string;
  name: string;
  mediaType: TemplateMediaType;
  width: number;
  height: number;
  ratio: string;
  note: string | null;
  sortOrder: number;
  enabled: boolean;
  /** 引用该渠道的模板数（含回收站里的）；旧后端没有该键。大于 0 时不能删除 */
  templateCount?: number;
  /** 其中在回收站的个数 */
  trashCount?: number;
}

export const getChannelDict = () => call<ChannelDict[]>('GET', '/channels');

/**
 * POST /channels（新建，creaft_catalog:edit）与 PUT /channels/{id}（编辑）。
 * code 创建后不可改（模板 channels_json 按它引用）；更新时 code 可省或必须与原值相同。
 * 校验（Go applyChannel）：name 必填 ≤32 字；mediaType image|video；width / height 1~20000；ratio 必填 ≤8 字符；note ≤120 字。
 * 删除见 deleteChannel（被模板引用时拒绝）。渠道属 Go 独写表，交接期也可写。
 */
export interface ChannelSaveData {
  /** 新建必填：小写字母开头的小写字母 / 数字 / 下划线，2~48 位 */
  code?: string;
  name: string;
  mediaType: TemplateMediaType;
  width: number;
  height: number;
  ratio: string;
  /** 缺省 = 不改，空串 = 清空（传 null 也是不改） */
  note?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}

export const createChannel = (data: ChannelSaveData) =>
  call<{ id: number }>('POST', '/channels', { data, silent: true });

export const updateChannel = (id: number, data: ChannelSaveData) =>
  call<null>('PUT', `/channels/${id}`, { data, silent: true });

/** DELETE /channels/{id}：逻辑删除；被模板引用（含回收站）时 4002 · RESOURCE_CONFLICT，msg 带引用数与示例模板；删除后 code 不可复用 */
export const deleteChannel = (id: number) =>
  call<{ id: number }>('DELETE', `/channels/${id}`, { silent: true });

/** POST /templates/{id}/reprocess-media：重新处理视频（FAILED / 想重做的 READY 重新排队）；处理中拒绝 */
export const reprocessTemplateMedia = (id: number) =>
  call<TemplateWriteResult>('POST', `/templates/${id}/reprocess-media`, {
    silent: true,
    op: 'edit',
  });

/** 模板 channels_json 的一项：字典 code，可覆盖宽高 */
export interface TemplateChannelRef {
  code: string;
  width?: number;
  height?: number;
}

export interface SaveAttrsData {
  mediaType?: TemplateMediaType;
  /** 整体替换；[] = 清空 */
  channels?: TemplateChannelRef[];
  updatedAt?: string;
  revision?: number;
}

export interface SaveAttrsResult {
  id: number;
  updatedAt: string;
  revision?: number;
}

/** PUT /templates/{id}/attrs：交接期必须带 revision（不接受只带 updatedAt）；冲突 4002 · CONFLICT */
export const saveTemplateAttrs = (id: number, data: SaveAttrsData) =>
  call<SaveAttrsResult>('PUT', `/templates/${id}/attrs`, {
    data,
    silent: true,
    op: 'attrs',
  });

export type SampleScope = 'INDUSTRY' | 'TEMPLATE';
/** 示例素材：放进去的（INPUT）/ 做出来的（OUTPUT）；无 revision，最后写入者胜 */
export type SampleRole = 'INPUT' | 'OUTPUT';
export const MAX_SAMPLES = 6;

export interface SampleAsset {
  id: number;
  scopeType: SampleScope;
  industryId: number | null;
  templateId: number | null;
  kind: string;
  role?: SampleRole;
  url: string;
  thumbUrl: string | null;
  title: string;
  sortOrder: number;
  enabled: boolean;
}

export interface SampleSaveData {
  scopeType?: SampleScope;
  industryId?: number;
  templateId?: number;
  role?: SampleRole;
  url: string;
  thumbUrl?: string | null;
  title: string;
  sortOrder?: number;
  enabled?: boolean;
}

export const getSamples = (scope: {
  scopeType: SampleScope;
  industryId?: number;
  templateId?: number;
}) =>
  call<SampleAsset[]>('GET', '/samples', {
    params: scope as Record<string, unknown>,
  });

export const createSample = (data: SampleSaveData) =>
  call<{ id: number }>('POST', '/samples', { data, op: 'samples' });

export const updateSample = (id: number, data: SampleSaveData) =>
  call<unknown>('PUT', `/samples/${id}`, { data, op: 'samples' });

export const deleteSample = (id: number) =>
  call<unknown>('DELETE', `/samples/${id}`, { op: 'samples' });

// =====================================================================
// 模板编辑器配套：素材直传（公有桶）/ 技能下拉 / 变更历史
// =====================================================================

export type UploadKind = 'image' | 'video';

/** 前端按后端同一份白名单先拦一道（服务端仍强制校验） */
export const UPLOAD_LIMITS = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 10 << 20,
    label: '图片 jpg / png / webp，≤ 10MB',
  },
  video: {
    types: ['video/mp4', 'video/webm'],
    maxBytes: 200 << 20,
    label: '视频 mp4 / webm，≤ 200MB',
  },
} as const;

/** POST /uploads/presign：前端把文件原样 PUT 到 uploadUrl（必须带 headers），传完调 confirm */
export interface UploadPresign {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  /** 传完后的公有地址；confirm 通过后才可写进模板 */
  url: string;
  key: string;
  kind: UploadKind;
  maxSize: number;
  expiresAt: number;
}

export const presignUpload = (body: {
  kind?: UploadKind;
  contentType: string;
  fileName?: string;
  size: number;
}) => call<UploadPresign>('POST', '/uploads/presign', { data: body, silent: true });

/** POST /uploads/confirm 的结果：url / coverUrl 可直接写进模板 */
export interface UploadConfirmResult {
  url: string;
  kind: UploadKind;
  contentType: string;
  size: number;
  width: number;
  height: number;
  durationSec?: number;
  /** 视频首帧封面（公有桶）；没抽出来为空 */
  coverUrl?: string;
  /** 视频恒为 PROCESSING（保存进模板后由后台任务抽封面 / 转码）；图片为 READY；PENDING 仅旧后端 */
  mediaStatus: 'READY' | 'PROCESSING' | 'PENDING';
  note?: string;
}

export const confirmUpload = (body: { url: string; kind?: UploadKind }) =>
  call<UploadConfirmResult>('POST', '/uploads/confirm', { data: body, silent: true });

/** GET /skills：技能下拉（不含执行配置）；停用的技能也列出，enabled=false 时禁止新绑定 */
export interface AdminSkill {
  agentSkillId: string;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  enabled: boolean;
}

export const getSkills = (keyword?: string) =>
  call<{ items: AdminSkill[] }>('GET', '/skills', {
    params: keyword ? { keyword } : undefined,
    silent: true,
  });

/** 变更历史的一处字段变化；大字段（prompt / payload）只有长度与哈希，全文在 before / after 快照里 */
export interface AuditFieldChange {
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: number;
  operatorId: number | null;
  operatorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  batchId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** 仅有前后快照的写操作有；创建 / 删除为 null */
  diff: Record<string, AuditFieldChange> | null;
  status: string;
  requestId: string | null;
  clientIp: string | null;
  createTime: string;
}

export interface AuditPage {
  total: number;
  page: number;
  size: number;
  items: AuditEntry[];
}

/** GET /templates/{id}/audit（权限 plaza:audit）：按模板分页的变更历史，新的在前 */
export const getTemplateAudit = (id: number, params: { page?: number; size?: number } = {}) =>
  call<AuditPage>('GET', `/templates/${id}/audit`, { params, silent: true });

/** 审计的对象类型（afv_plaza_audit_log.resource_type；头条写操作记 HEADLINE_*） */
export const AUDIT_RESOURCE_TYPES = [
  'TEMPLATE',
  'INDUSTRY',
  'CHANNEL',
  'SAMPLE',
  'SUGGESTION',
  'SEARCH_MISS',
  'NODE',
  'HEADLINE_RULE',
  'HEADLINE_BLOCK',
  'HEADLINE_PARAMS',
] as const;

export interface AuditQuery {
  resourceType?: string;
  resourceId?: string;
  /** 不含 * 精确匹配；含 * 通配（TEMPLATE_* 前缀、*_PUBLISH 后缀、*MEDIA* 包含） */
  action?: string;
  operatorId?: number;
  /** 操作人姓名模糊匹配（审计行里的名字，或管理员表 real_name / username） */
  operatorName?: string;
  /** 批量操作的批次 id（精确） */
  batchId?: string;
  /** 起（含）/ 止（不含）；Go 只认 RFC3339 / "YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DDTHH:mm:ss" / "YYYY-MM-DD HH:mm" */
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

/** GET /audit（权限 plaza:audit）：全局审计检索，新的在前，size 上限 100 */
export const getAudit = (params: AuditQuery) =>
  call<AuditPage>('GET', '/audit', {
    params: params as Record<string, unknown>,
    silent: true,
  });

// =====================================================================
// 营销节点（/nodes）：节点本身 + 节点按行业关联模板。
// afv_plaza_node / afv_plaza_node_template 是 Go 独占表，交接期（模板写权还在 Java）也可写，所以不标 op。
// 契约：fusion_aigc_go app/plaza/core/admin_nodes.go、docs/api/api-plaza.md「营销节点后台」。
// =====================================================================

/** UPCOMING 还没到展示窗口 / ACTIVE 窗口内 / ENDED 已过节点当天；与启停无关 */
export type MarketingNodeStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

export interface MarketingNode {
  id: number;
  /** 稳定代码（前端据此记「已关闭」），创建后不可改 */
  code: string;
  name: string;
  /** 一句推荐语（≤60 字；仅内容推荐，不含优惠 / 折扣 / 赠送） */
  why: string;
  /** yyyy-MM-dd，节点当天 */
  eventDate: string;
  /** 节点前多少天起展示（含节点当天） */
  leadDays: number;
  /** 展示起始日 = eventDate - leadDays */
  showFrom: string;
  sortOrder: number;
  enabled: boolean;
  status: MarketingNodeStatus;
  templateCount: number;
  createTime: string;
  updateTime: string;
}

export interface MarketingNodePage {
  total: number;
  page: number;
  size: number;
  items: MarketingNode[];
}

export interface MarketingNodeSaveData {
  /** 仅新建 */
  code?: string;
  name?: string;
  why?: string;
  eventDate?: string;
  leadDays?: number;
  sortOrder?: number;
  enabled?: boolean;
}

export const NODE_MAX_TEMPLATES = 300;
export const NODE_ADD_BATCH = 50;

export const getMarketingNodes = (params: {
  keyword?: string;
  enabled?: '1' | '0';
  page?: number;
  size?: number;
}) =>
  call<MarketingNodePage>('GET', '/nodes', {
    params: params as Record<string, unknown>,
  });

export const createMarketingNode = (data: MarketingNodeSaveData) =>
  call<{ id: number }>('POST', '/nodes', { data, silent: true });

export const updateMarketingNode = (id: number, data: MarketingNodeSaveData) =>
  call<unknown>('PUT', `/nodes/${id}`, { data, silent: true });

export const setMarketingNodeEnabled = (id: number, enabled: boolean) =>
  call<unknown>('PUT', `/nodes/${id}/enabled`, { data: { enabled }, silent: true });

export const deleteMarketingNode = (id: number) =>
  call<unknown>('DELETE', `/nodes/${id}`, { silent: true });

/** 节点下的一个模板（行业视角）；nodeSortOrder 是节点内的排序位 */
export interface NodeTemplateItem extends PlazaTemplateRow {
  nodeSortOrder: number;
}

export interface NodeTemplatesView {
  nodeId: number;
  industryId: number;
  /** 节点下全部行业的关联总数 */
  total: number;
  items: NodeTemplateItem[];
}

/** industryId>0 只列属于该行业（一级含二级）的；已删除的模板不返回 */
export const getNodeTemplates = (id: number, industryId?: number) =>
  call<NodeTemplatesView>('GET', `/nodes/${id}/templates`, {
    params: industryId ? { industryId } : undefined,
  });

/** 按行业添加（industryId 必填，模板须属于该行业）；已挂的跳过，追加到末尾；返回实际新增的 id */
export const addNodeTemplates = (id: number, industryId: number, templateIds: number[]) =>
  call<{ added: number[] }>('POST', `/nodes/${id}/templates`, {
    data: { industryId, templateIds },
    silent: true,
  });

/** 只排该行业：给定的模板（可为子集）按新顺序占用它们原有的排序槽位，不动其它行业 */
export const sortNodeTemplates = (id: number, industryId: number, templateIds: number[]) =>
  call<unknown>('PUT', `/nodes/${id}/templates/order`, {
    data: { industryId, templateIds },
    silent: true,
  });

export const removeNodeTemplate = (id: number, templateId: number) =>
  call<unknown>('DELETE', `/nodes/${id}/templates/${templateId}`, { silent: true });
