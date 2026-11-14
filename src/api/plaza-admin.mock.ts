import type {
  AdminSkill,
  AuditEntry,
  AuditPage,
  ChannelDict,
  ChannelSpec,
  Envelope,
  HeadlineAlgoItem,
  HeadlineBoard,
  HeadlineBrief,
  HeadlineCompareCell,
  HeadlineCompareView,
  HeadlineConfig,
  HeadlineDiff,
  HeadlineItem,
  HeadlineNearMiss,
  HeadlineOverride,
  HeadlineParamMeta,
  HeadlineParamValues,
  HeadlineParamsView,
  HeadlinePage,
  HeadlinePreviewResult,
  HeadlineRefreshResult,
  HeadlineRule,
  HeadlineRuleBase,
  HeadlineRuleRequest,
  HeadlineRuleUpdate,
  HeadlineScopeStats,
  HeadlineScopeSummary,
  HeadlineScopesView,
  HeadlineSignalDetail,
  HeadlineSnapshotMeta,
  HeadlineSource,
  HeadlineStats,
  HeadlineSuppressRequest,
  HeadlineSuppression,
  HeadlineTemplateBrief,
  HeadlineTemplateScopeStatus,
  HeadlineTemplateStatus,
  HeadlineWriteResult,
  IndustryNode,
  IndustrySaveData,
  IndustrySortItem,
  IndustrySuggestion,
  IndustrySuggestionPage,
  IndustryTemplatesView,
  IndustryUpdateResult,
  ParamFieldError,
  PlazaMethod,
  PlazaTemplateDetail,
  PlazaTemplatePage,
  PlazaTemplateRow,
  PlazaTemplateSaveData,
  PreviewTemplateItem,
  PreviewTemplatesPage,
  PublishResult,
  SampleAsset,
  SaveAttrsResult,
  SaveSlotsResult,
  SearchMiss,
  SearchMissPage,
  SlotFieldError,
  TemplateWriteResult,
  UploadConfirmResult,
  UploadPresign,
  SlotItem,
  SlotsConfig,
  TemplateBatchResult,
  TemplateChannelRef,
  TemplateDisplayState,
  TemplateIndustryRef,
  TemplateMediaType,
  TemplateState,
} from './plaza-admin';

/**
 * plaza-admin 的内存假后端（VITE_PLAZA_ADMIN_MOCK=true 时由 plaza-admin.ts 动态加载）。
 * 带状态：增删改在本次页面会话内生效，刷新重置。只为联调前跑通页面，不模拟并发与审计。
 *
 * 响应形状、错误码、reason、校验口径对齐 Go admin-api（fusion_aigc_go：app/plaza/core/admin_*.go、
 * app/plaza/headline/{httpapi,service,algo}）；代码与文档不一致处以代码为准。
 * 时间串一律是无时区的 CST（yyyy-MM-ddTHH:mm:ss），与浏览器所在时区无关。
 */

// ---------------- 信封与错误 ----------------
const ok = <T>(data: T): Envelope<T> => ({ code: 0, msg: 'ok', data });
const fail = (
  code: number,
  reason: string,
  msg: string,
  data: unknown = null,
): Envelope<unknown> => ({
  code,
  reason,
  msg,
  data,
});

/** Go xerr 业务错误：HTTP 恒 200，看 code / reason */
class GoError extends Error {
  code: number;
  reason: string;
  data: unknown;
  constructor(code: number, reason: string, msg: string, data: unknown = null) {
    super(msg);
    this.code = code;
    this.reason = reason;
    this.data = data;
  }
}
/** xerr.ParamError 1003 */
const paramErr = (msg: string, reason = 'PARAM_INVALID') => new GoError(1003, reason, msg);
/** xerr.NotFound 4001 */
const notFoundErr = (msg: string, reason = 'RESOURCE_NOT_FOUND') => new GoError(4001, reason, msg);
/** xerr.Conflict 4002 */
const conflictErr = (msg: string, reason = 'RESOURCE_CONFLICT') => new GoError(4002, reason, msg);

// ---------------- 时间 ----------------
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const CST_OFFSET = 8 * HOUR;
const now = () => Date.now();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
/** CST 无时区串 yyyy-MM-ddTHH:mm:ss */
const fmt = (ms: number) => new Date(ms + CST_OFFSET).toISOString().slice(0, 19);
const fmtDate = (ms: number) => fmt(ms).slice(0, 10);
/** RFC3339（+08:00），只有条目的 enteredAt 用 */
const rfc3339 = (ms: number) => `${fmt(ms)}+08:00`;
/** CST 无时区串 → 毫秒（内部存的串都合法） */
const ms = (s: string) => Date.parse(`${s}Z`) - CST_OFFSET;
/** CST 当日 00:00 的毫秒 */
const dayStartMs = (d: string) => Date.parse(`${d}T00:00:00Z`) - CST_OFFSET;
const todayStr = (at = now()) => fmtDate(at);

/** 严格解析 yyyy-MM-dd；非法 → null（Go time.Parse 拒绝 2月30 这类） */
const parseDate = (s: string): number | null => {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const v = dayStartMs(t);
  return Number.isNaN(v) || fmtDate(v) !== t ? null : v;
};

/**
 * 对应 Go parseAdminTime：空串 = null（清空）；认 RFC3339、"YYYY-MM-DD HH:mm:ss"、"YYYY-MM-DDTHH:mm:ss"、
 * "YYYY-MM-DD HH:mm"（按北京时间）；纯日期等其余格式 → 1003「时间格式不对：xxx」。
 */
const parseAdminTime = (raw: unknown): number | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  let m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(s);
  let norm = m ? `${m[1]}T${m[2]}` : '';
  if (!m) {
    m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(s);
    norm = m ? `${m[1]}T${m[2]}:00` : '';
  }
  if (m) {
    const t = ms(norm);
    if (!Number.isNaN(t) && fmt(t) === norm) return t;
  }
  throw paramErr(`时间格式不对：${s}`);
};

/** 头条 /snapshots/at、/compare 的 at：另认 yyyy-MM-ddTHH:mm 与纯日期 */
const parseAt = (raw: unknown): number => {
  const s = String(raw ?? '').trim();
  const layouts: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/, (m) => `${m[1]}T${m[2]}`],
    [/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, (m) => `${m[1]}T${m[2]}`],
    [/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/, (m) => `${m[1]}T${m[2]}:00`],
    [/^(\d{4}-\d{2}-\d{2})$/, (m) => `${m[1]}T00:00:00`],
  ];
  for (const [re, f] of layouts) {
    const m = re.exec(s);
    if (!m) continue;
    const norm = f(m);
    const t = ms(norm);
    if (!Number.isNaN(t) && fmt(t) === norm) return t;
  }
  throw paramErr('时间格式应为 yyyy-MM-ddTHH:mm:ss');
};

// ---------------- 通用小工具 ----------------
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const runeLen = (s: string) => Array.from(s).length;
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: unknown): number => {
  const n = Number(v);
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? 0 : Math.trunc(n);
};
const bool = (v: unknown) => v === true || v === 'true' || v === '1';
const bodyOf = <T>(b: unknown): T => (b && typeof b === 'object' ? b : {}) as T;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const dedupeNums = (xs: unknown): number[] =>
  Array.from(new Set((Array.isArray(xs) ? xs : []).map((x) => Number(x)).filter((x) => x > 0)));
const normPage = (q: Record<string, unknown>, def = 20) => {
  const page = Math.max(1, num(q.page) || 1);
  let size = num(q.size);
  if (size < 1) size = def;
  if (size > 100) size = 100;
  return { page, size };
};
const slicePage = <T>(list: T[], page: number, size: number) =>
  list.slice((page - 1) * size, page * size);
const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });
/** 参数的稳定 hash（64 位十六进制，非加密） */
const hashOf = (s: string): string => {
  let out = '';
  for (let k = 0; k < 8; k++) {
    let h = 2166136261 ^ (k * 16777619);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;
};

const OPERATOR_ID = 1;

// =====================================================================
// 行业
// =====================================================================
interface Ind {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  iconUrl: string | null;
  coverUrl: string | null;
  hint: string | null;
  audienceName: string | null;
  examples: string[];
  nextActions: string[];
  enabled: boolean;
  showWhenEmpty: boolean;
  sortOrder: number;
  userCount: number;
}

let nextIndId = 20;
const IND_SEED: [string, string, string, string, string[]][] = [
  ['foot_bath', '足浴', '按摩 / 泡脚门店', '足浴人', ['bluev:蓝V号', 'creator:达人号']],
  ['apparel', '服装', '女装 / 男装 / 童装', '服装人', []],
  ['restaurant', '餐饮', '正餐 / 小吃 / 茶饮', '餐饮人', ['tea:茶饮']],
  ['beauty', '美业', '美容 / 美发 / 美甲', '美业人', []],
  ['pet', '宠物店', '洗护 / 寄养', '宠物人', []],
];
const inds: Ind[] = IND_SEED.flatMap(([code, name, hint, aud, kids], i) => {
  const id = i + 1;
  const parent: Ind = {
    id,
    parentId: null,
    code,
    name,
    iconUrl: null,
    coverUrl: `https://picsum.photos/seed/industry${id}/320/200`,
    hint,
    audienceName: aud,
    examples: ['做一张今日团购海报'],
    nextActions: ['做成抖音竖版'],
    enabled: code !== 'pet',
    showWhenEmpty: false,
    sortOrder: (i + 1) * 10,
    userCount: 120 - i * 17,
  };
  const children = kids.map((k, j): Ind => {
    const [c, n] = k.split(':');
    return {
      id: 10 + id * 2 + j,
      parentId: id,
      code: `${code}_${c}`,
      name: n,
      iconUrl: null,
      coverUrl: null,
      hint: `${n}相关门店`,
      audienceName: null,
      examples: [],
      nextActions: [],
      enabled: true,
      showWhenEmpty: false,
      sortOrder: (j + 1) * 10,
      userCount: 8,
    };
  });
  return [parent, ...children];
});

const indById = (id: number) => inds.find((x) => x.id === id);
const indByCode = (code: string) => inds.find((x) => x.code === code);
const descendants = (id: number) => [id, ...inds.filter((x) => x.parentId === id).map((x) => x.id)];

// =====================================================================
// 模板
// =====================================================================
interface Tpl {
  id: number;
  title: string;
  description: string;
  category: string;
  tags: string[];
  mediaType: TemplateMediaType;
  payload: Record<string, unknown> | null;
  agentSkillId: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  channels: unknown;
  slots: SlotsConfig | null;
  textOverlay: boolean;
  mediaStatus: string;
  mediaError?: string | null;
  mediaNote?: string | null;
  mediaAttempts?: number;
  needsProductImage: boolean;
  state: TemplateState;
  onlineAt: string | null;
  offlineAt: string | null;
  sortOrder: number;
  /** 行业 id → 该行业内的排序位 */
  industrySort: Record<number, number>;
  uses7d: number;
  prevUses: number;
  createdBy: number;
  createTime: string;
  updateTime: string;
  /** 乐观并发版本：每次写 +1 */
  revision: number;
  deleted: boolean;
  deletedAt: string | null;
}

const TRASH_DAYS = 30;
const TITLES = [
  '今日团购海报',
  '门头氛围图',
  '新品上新通知',
  '节日促销长图',
  '员工风采展示',
  '探店短视频',
  '价目表海报',
  '会员日活动图',
];
const CHANNEL_DICT: ChannelSpec[] = [
  {
    code: 'douyin',
    name: '抖音竖版',
    width: 1080,
    height: 1920,
    ratio: '9:16',
  },
  {
    code: 'wechat',
    name: '朋友圈方图',
    width: 1080,
    height: 1080,
    ratio: '1:1',
  },
  { code: 'xhs', name: '小红书', width: 1242, height: 1660, ratio: '3:4' },
];

let nextTplId = 136;
const tpls: Tpl[] = Array.from({ length: 36 }, (_, i): Tpl => {
  const top = inds.filter((x) => x.parentId === null);
  const ind = top[i % top.length];
  const kids = inds.filter((x) => x.parentId === ind.id);
  const ids = [ind.id];
  if (kids.length && i % 3 === 0) ids.push(kids[i % kids.length].id);
  const states: TemplateState[] = ['PUBLISHED', 'PUBLISHED', 'PUBLISHED', 'DRAFT', 'OFFLINE'];
  const state = states[i % 5];
  const scheduled = state === 'PUBLISHED' && i % 13 === 0 && i > 0;
  const video = i % 4 === 3;
  const cover = `https://picsum.photos/seed/plaza${i}/240/320`;
  const unassigned = i === 7 || i === 8;
  return {
    id: 100 + i,
    title: `${ind.name}${TITLES[i % TITLES.length]} ${i + 1}`,
    description: '示例模板描述，用于联调展示。',
    category: i % 2 ? '促销' : '品牌',
    tags: i % 3 === 0 ? ['爆款', '节日'] : ['日常'],
    mediaType: video ? 'video' : 'image',
    // 第 13 号草稿没有效果图：用来演示「发布需要至少一张效果图」
    payload:
      i === 13
        ? { result: [], description: '' }
        : { result: [cover], description: '示例模板描述，用于联调展示。' },
    agentSkillId: null,
    videoUrl: video ? 'https://www.w3schools.com/html/mov_bbb.mp4' : null,
    posterUrl: video ? cover : null,
    channels: i % 3 === 0 ? [{ code: 'douyin' }, { code: 'wechat', width: 1200 }] : null,
    slots: null,
    textOverlay: i % 4 === 0,
    mediaStatus: i === 3 ? 'PROCESSING' : i === 7 && video ? 'FAILED' : 'READY',
    mediaError: i === 7 && video ? '封面抽帧失败: 媒体服务 503' : null,
    mediaAttempts: i === 7 && video ? 3 : 0,
    needsProductImage: i % 6 === 0,
    state,
    onlineAt: scheduled ? fmt(now() + 2 * DAY) : null,
    offlineAt: null,
    sortOrder: i * 10,
    industrySort: Object.fromEntries((unassigned ? [] : ids).map((x) => [x, i * 10])),
    uses7d: i >= 32 ? i - 30 : Math.max(0, 400 - i * 11),
    prevUses: Math.max(0, 300 - i * 7),
    createdBy: i % 2 ? 2 : 1,
    createTime: fmt(now() - i * 30 * HOUR),
    updateTime: fmt(now() - i * 5 * HOUR),
    revision: 1,
    deleted: false,
    deletedAt: null,
  };
});
// 种子：回收站里放两个、第一个模板自带一份入参配置，便于直接看回显
tpls[34].deleted = true;
tpls[34].deletedAt = fmt(now() - 3 * DAY);
tpls[29].deleted = true;
tpls[29].deletedAt = fmt(now() - 10 * DAY);

const tplById = (id: number) => tpls.find((t) => t.id === id);
const liveTpl = (id: number): Tpl => {
  const t = tplById(id);
  if (!t || t.deleted) throw notFoundErr('模板不存在', 'TEMPLATE_NOT_FOUND');
  return t;
};
const idsOf = (t: Tpl) => Object.keys(t.industrySort).map(Number);

const refOf = (id: number): TemplateIndustryRef | null => {
  const x = indById(id);
  if (!x) return null;
  const p = x.parentId === null ? undefined : indById(x.parentId);
  const ref: TemplateIndustryRef = { id: x.id, code: x.code, name: x.name };
  if (p) ref.parentCode = p.code;
  return ref;
};
const refsOf = (t: Tpl): TemplateIndustryRef[] =>
  idsOf(t)
    .map(refOf)
    .filter((x): x is TemplateIndustryRef => x !== null);

const firstResult = (t: Tpl): string => {
  const r = t.payload?.result;
  return Array.isArray(r) && typeof r[0] === 'string' ? r[0] : '';
};
const coverOf = (t: Tpl): string => firstResult(t) || t.posterUrl || '';

const visibleNow = (t: Tpl, at = now()) =>
  !t.deleted &&
  t.state === 'PUBLISHED' &&
  (!t.onlineAt || ms(t.onlineAt) <= at) &&
  (!t.offlineAt || ms(t.offlineAt) > at);

const displayStateOf = (t: Tpl): TemplateDisplayState => {
  if (t.deleted) return 'DELETED';
  if (t.state === 'PUBLISHED') {
    if (t.onlineAt && ms(t.onlineAt) > now()) return 'SCHEDULED';
    if (t.offlineAt && ms(t.offlineAt) <= now()) return 'EXPIRED';
  }
  return t.state;
};

const channelsOf = (t: Tpl): ChannelSpec[] => {
  if (!Array.isArray(t.channels)) return [];
  const out: ChannelSpec[] = [];
  for (const c of t.channels as {
    code?: string;
    width?: number;
    height?: number;
  }[]) {
    const base = CHANNEL_DICT.find((x) => x.code === c?.code);
    if (!base) continue;
    const width = c.width ?? base.width;
    const height = c.height ?? base.height;
    out.push({
      ...base,
      width,
      height,
      ratio: width === base.width && height === base.height ? base.ratio : `${width}:${height}`,
    });
  }
  return out;
};

/** 入口：在某个行业内追加一个排序位（该行业当前最大值 + 10） */
const attachIndustry = (t: Tpl, indId: number) => {
  if (indId in t.industrySort) return;
  const max = Math.max(0, ...tpls.map((x) => x.industrySort[indId] ?? 0));
  t.industrySort[indId] = max + 10;
};
const minIndustrySort = (indId: number) => {
  const all = tpls.map((x) => x.industrySort[indId]).filter((v): v is number => v !== undefined);
  return all.length ? Math.min(...all) : 0;
};

// ---- 变更历史（对应 afv_plaza_audit_log）：写操作记前后快照与字段级 diff，大字段（prompt / payload）diff 里只留长度 ----
const MOCK_SKILLS: AdminSkill[] = [
  {
    agentSkillId: '1001',
    code: 'poster_design',
    title: '海报设计',
    description: '门店海报 / 活动图',
    icon: null,
    category: '设计',
    enabled: true,
  },
  {
    agentSkillId: '1002',
    code: 'shop_video',
    title: '探店短视频',
    description: '口播 + 镜头脚本',
    icon: null,
    category: '视频',
    enabled: true,
  },
  {
    agentSkillId: '1003',
    code: 'product_shot',
    title: '商品精修',
    description: null,
    icon: null,
    category: '设计',
    enabled: true,
  },
  {
    agentSkillId: '1009',
    code: 'legacy_copy',
    title: '旧版文案（已停用）',
    description: null,
    icon: null,
    category: null,
    enabled: false,
  },
];
const auditLog: AuditEntry[] = [];
let nextAuditId = 1;
const BIG_FIELD = 200;
const auditSnap = (t: Tpl): Record<string, unknown> => ({
  id: t.id,
  title: t.title,
  description: t.description || null,
  category: t.category || null,
  tags: [...t.tags],
  payload: clone(t.payload ?? {}),
  agentSkillId: t.agentSkillId,
  mediaType: t.mediaType,
  videoUrl: t.videoUrl,
  posterUrl: t.posterUrl,
  state: t.state,
  onlineAt: t.onlineAt,
  offlineAt: t.offlineAt,
  channels: clone(t.channels ?? null),
  slots: clone(t.slots ?? null),
  needsProductImage: t.needsProductImage,
  textOverlay: t.textOverlay,
  sortOrder: t.sortOrder,
  mediaStatus: t.mediaStatus,
  industryIds: Object.keys(t.industrySort)
    .map(Number)
    .sort((a, b) => a - b),
});
const shrinkBig = (v: unknown): unknown => {
  const text =
    typeof v === 'string' ? v : v !== null && typeof v === 'object' ? JSON.stringify(v) : null;
  if (text === null || text.length <= BIG_FIELD) return v;
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { len: text.length, sha256: h.toString(16).padStart(8, '0') };
};
const recordAudit = (t: Tpl, action: string, before: Record<string, unknown> | null) => {
  const after = auditSnap(t);
  let diff: AuditEntry['diff'] = null;
  if (before) {
    diff = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k] ?? null) === JSON.stringify(after[k] ?? null)) continue;
      diff[k] = { from: shrinkBig(before[k] ?? null), to: shrinkBig(after[k] ?? null) };
    }
  }
  auditLog.unshift({
    id: nextAuditId++,
    operatorId: OPERATOR_ID,
    operatorName: '演示管理员',
    action,
    resourceType: 'TEMPLATE',
    resourceId: String(t.id),
    batchId: null,
    before,
    after,
    diff,
    status: 'SUCCESS',
    requestId: `mock-${nextAuditId}`,
    clientIp: '127.0.0.1',
    createTime: fmt(now()),
  });
};
const touch = (t: Tpl) => {
  t.updateTime = fmt(now());
  t.revision += 1;
};

// 种子：第一个模板自带一份入参配置
tpls[0].slots = {
  schemaVersion: 1,
  items: [
    {
      key: 'storefront',
      type: 'image',
      label: '门头照',
      required: true,
      minCount: 1,
      maxCount: 1,
      order: 1,
    },
    {
      key: 'shop_name',
      type: 'text',
      label: '店名',
      required: true,
      maxLength: 16,
      order: 2,
    },
  ],
};

// ---------------- 入参 schema 校验（对齐 core/slots.go） ----------------
const SLOT_TYPES = [
  'image',
  'video',
  'text',
  'textarea',
  'price',
  'number',
  'select',
  'multiselect',
  'switch',
  'color',
];
const SLOT_FIELDS = new Set([
  'key',
  'type',
  'label',
  'help',
  'placeholder',
  'required',
  'default',
  'order',
  'group',
  'minCount',
  'maxCount',
  'guidance',
  'exampleUrl',
  'acceptRatio',
  'maxDurationSec',
  'maxLength',
  'layout',
  'min',
  'max',
  'step',
  'unit',
  'options',
  'visibleWhen',
]);
const IMG_VID = ['image', 'video'];
const NUM_TYPES = ['number', 'price'];
const TEXT_TYPES = ['text', 'textarea'];
const SEL_TYPES = ['select', 'multiselect'];
const APPLICABLE: Record<string, string[]> = {
  minCount: IMG_VID,
  maxCount: [...IMG_VID, 'multiselect'],
  guidance: IMG_VID,
  exampleUrl: IMG_VID,
  acceptRatio: IMG_VID,
  maxDurationSec: ['video'],
  maxLength: TEXT_TYPES,
  layout: TEXT_TYPES,
  min: NUM_TYPES,
  max: NUM_TYPES,
  step: NUM_TYPES,
  unit: NUM_TYPES,
  options: SEL_TYPES,
};

interface SlotErr {
  path: string;
  rule: string;
  msg: string;
}
/** SLOTS_INVALID：1003，data {field（第一处路径）, errors（全部）} */
const slotsError = (errs: SlotErr[]): GoError => {
  const parts = errs.map((e) => `${e.path}：${e.msg}`);
  const shown = parts.length > 5 ? [...parts.slice(0, 5), `……共 ${errs.length} 处`] : parts;
  const fields: SlotFieldError[] = errs.map((e) => ({
    field: e.path,
    rule: e.rule,
    message: e.msg,
  }));
  return new GoError(1003, 'SLOTS_INVALID', shown.join('；'), {
    field: errs[0].path,
    errors: fields,
  });
};
const oneSlotErr = (path: string, rule: string, msg: string) => slotsError([{ path, rule, msg }]);

const isScalar = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

/** 默认值按类型校验 */
const checkSlotDefault = (it: Record<string, unknown>, p: string): SlotErr[] => {
  const d = it.default;
  if (d === undefined || d === null) return [];
  const type = String(it.type);
  const bad = (rule: string, msg: string): SlotErr[] => [
    {
      path: `${p}.default`,
      rule: `default.${rule}`,
      msg: `默认值不合法：${msg}`,
    },
  ];
  if (IMG_VID.includes(type))
    return [
      {
        path: `${p}.default`,
        rule: 'default.not_allowed',
        msg: '图片 / 视频入参不支持 default',
      },
    ];
  const opts = Array.isArray(it.options) ? (it.options as { value?: string }[]) : [];
  switch (type) {
    case 'text':
    case 'textarea':
      if (typeof d !== 'string') return bad('type', '必须是字符串');
      if (typeof it.maxLength === 'number' && runeLen(d) > it.maxLength)
        return bad('too_long', `最多 ${it.maxLength} 个字`);
      return [];
    case 'number':
    case 'price':
      return typeof d === 'number' ? [] : bad('type', '必须是数字');
    case 'switch':
      return typeof d === 'boolean' ? [] : bad('type', '必须是布尔值');
    case 'color':
      return typeof d === 'string' && /^#[0-9A-Fa-f]{6}$/.test(d)
        ? []
        : bad('format', '必须是 #RRGGBB');
    case 'select':
      return typeof d === 'string' && opts.some((o) => o.value === d)
        ? []
        : bad('option', '不在选项里');
    case 'multiselect':
      return Array.isArray(d) && d.every((x) => opts.some((o) => o.value === x))
        ? []
        : bad('option', '不在选项里');
  }
  return [];
};

/** 对应 ParseSlotSchema：规整成 {schemaVersion:1, items}；空 / null / [] / items 为空 → null */
const parseSlotSchema = (raw: unknown): SlotsConfig | null => {
  if (raw === undefined || raw === null) return null;
  let list: unknown;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (isObj(raw)) {
    for (const k of Object.keys(raw)) {
      if (!['schemaVersion', 'items', 'slots'].includes(k))
        throw oneSlotErr(
          'schemaVersion',
          'slots.json',
          `不是合法的入参 schema：json: unknown field "${k}"`,
        );
    }
    if (raw.schemaVersion !== 1)
      throw oneSlotErr('schemaVersion', 'slots.version', 'schemaVersion 必须是 1');
    const hasItems = raw.items !== undefined && raw.items !== null;
    const hasSlots = raw.slots !== undefined && raw.slots !== null;
    if (hasItems && hasSlots)
      throw oneSlotErr('items', 'slots.both_keys', 'items 与旧键 slots 不能同时出现');
    list = hasItems ? raw.items : raw.slots;
    if (list === undefined || list === null) return null;
    if (!Array.isArray(list))
      throw oneSlotErr('items', 'slots.json', 'items 必须是入参数组：json: 不是数组');
  } else {
    throw oneSlotErr('items', 'slots.json', '必须是对象 {schemaVersion, items}');
  }
  const arr = list as unknown[];
  if (!arr.length) return null;
  for (const it of arr) {
    if (!isObj(it))
      throw oneSlotErr('items', 'slots.json', 'items 必须是入参数组：json: 元素不是对象');
    for (const k of Object.keys(it)) {
      if (!SLOT_FIELDS.has(k))
        throw oneSlotErr('items', 'slots.json', `items 必须是入参数组：json: unknown field "${k}"`);
    }
  }
  const items = clone(arr as Record<string, unknown>[]);
  const errs: SlotErr[] = [];
  const add = (path: string, rule: string, msg: string) => errs.push({ path, rule, msg });
  if (items.length > 20) add('items', 'slots.too_many', '最多 20 个入参');
  const byKey = new Map<string, Record<string, unknown>>();
  items.forEach((it, i) => {
    const p = `items[${i}]`;
    const key = typeof it.key === 'string' ? it.key : '';
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(key))
      add(`${p}.key`, 'key.format', 'key 必须是小写字母开头的字母、数字、下划线，最长 32');
    else if (byKey.has(key)) add(`${p}.key`, 'key.duplicate', `key 在模板内必须唯一：${key}`);
    else byKey.set(key, it);
  });
  items.forEach((it, i) => {
    const p = `items[${i}]`;
    const type = typeof it.type === 'string' ? it.type : '';
    if (!SLOT_TYPES.includes(type)) {
      add(`${p}.type`, 'type.invalid', `type 不合法：${type}`);
      return;
    }
    const label = typeof it.label === 'string' ? it.label.trim() : '';
    it.label = label;
    if (!label || runeLen(label) > 32)
      add(`${p}.label`, 'label.invalid', 'label 必填，最多 32 个字');
    if (runeLen(String(it.help ?? '')) > 200)
      add(`${p}.help`, 'help.too_long', 'help 最多 200 个字');
    if (runeLen(String(it.placeholder ?? '')) > 100)
      add(`${p}.placeholder`, 'placeholder.too_long', 'placeholder 最多 100 个字');
    if (runeLen(String(it.group ?? '')) > 16)
      add(`${p}.group`, 'group.too_long', 'group 最多 16 个字');
    const order = Number(it.order ?? 0);
    if (!(order >= 0 && order <= 9999)) add(`${p}.order`, 'order.range', 'order 需在 0~9999');
    for (const [field, types] of Object.entries(APPLICABLE)) {
      const v = it[field];
      const present = Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
      if (present && !types.includes(type))
        add(`${p}.${field}`, 'field.not_applicable', `${type} 类型不支持 ${field}`);
    }
    if (IMG_VID.includes(type)) {
      const max = it.maxCount === undefined ? 1 : Number(it.maxCount);
      const required = it.required === true;
      const min = it.minCount === undefined ? (required ? 1 : 0) : Number(it.minCount);
      it.maxCount = max;
      it.minCount = min;
      if (min < 0 || max < 1 || max > 9)
        add(`${p}.maxCount`, 'count.range', 'minCount ≥ 0，maxCount 需在 1~9');
      if (min > max) add(`${p}.minCount`, 'count.min_gt_max', 'minCount 不能大于 maxCount');
      if (required && min < 1)
        add(`${p}.minCount`, 'count.required_zero', '必填的入参 minCount 至少为 1');
      if (runeLen(String(it.guidance ?? '')) > 200)
        add(`${p}.guidance`, 'guidance.too_long', 'guidance 最多 200 个字');
      if (it.exampleUrl && !/^https?:\/\/\S+$/i.test(String(it.exampleUrl)))
        add(`${p}.exampleUrl`, 'exampleUrl.invalid', 'exampleUrl 必须是 http(s) 地址');
      if (it.acceptRatio && !/^[1-9]\d{0,4}:[1-9]\d{0,4}$/.test(String(it.acceptRatio)))
        add(`${p}.acceptRatio`, 'acceptRatio.format', 'acceptRatio 形如 正整数:正整数（如 9:16）');
      if (type === 'video') {
        const sec = it.maxDurationSec === undefined ? 60 : Number(it.maxDurationSec);
        it.maxDurationSec = sec;
        if (sec < 1 || sec > 600)
          add(`${p}.maxDurationSec`, 'duration.range', 'maxDurationSec 需在 1~600');
      }
    } else if (TEXT_TYPES.includes(type)) {
      const ml =
        it.maxLength === undefined ? (type === 'textarea' ? 500 : 100) : Number(it.maxLength);
      it.maxLength = ml;
      if (ml < 1 || ml > 2000) add(`${p}.maxLength`, 'maxLength.range', 'maxLength 需在 1~2000');
      if (it.layout !== undefined && !isObj(it.layout))
        add(`${p}.layout`, 'layout.not_object', 'layout 必须是对象');
    } else if (NUM_TYPES.includes(type)) {
      for (const name of ['min', 'max', 'step']) {
        const v = it[name];
        if (v !== undefined && v !== null && !Number.isFinite(Number(v)))
          add(`${p}.${name}`, 'number.invalid', `${name} 不是有效数字`);
      }
      if (typeof it.min === 'number' && typeof it.max === 'number' && it.min > it.max)
        add(`${p}.min`, 'number.min_gt_max', 'min 不能大于 max');
      if (typeof it.step === 'number' && it.step <= 0)
        add(`${p}.step`, 'number.step', 'step 必须大于 0');
      if (runeLen(String(it.unit ?? '')) > 8) add(`${p}.unit`, 'unit.too_long', 'unit 最多 8 个字');
      if (type === 'price' && it.min === undefined) it.min = 0;
    } else if (SEL_TYPES.includes(type)) {
      const opts = Array.isArray(it.options) ? (it.options as Record<string, unknown>[]) : [];
      if (!opts.length) {
        add(`${p}.options`, 'options.empty', 'select / multiselect 必须有 options');
      } else {
        if (opts.length > 50) add(`${p}.options`, 'options.too_many', 'options 最多 50 个');
        const seen = new Set<string>();
        opts.forEach((o, j) => {
          const op = `${p}.options[${j}]`;
          const v = String(o?.value ?? '');
          if (!v.trim() || runeLen(v) > 64)
            add(`${op}.value`, 'option.value', 'value 必填，最多 64 个字符');
          else if (seen.has(v)) add(`${op}.value`, 'option.duplicate', `value 重复：${v}`);
          seen.add(v);
          const l = String(o?.label ?? '');
          if (!l.trim() || runeLen(l) > 32)
            add(`${op}.label`, 'option.label', 'label 必填，最多 32 个字');
        });
        if (type === 'multiselect' && it.maxCount !== undefined) {
          const mc = Number(it.maxCount);
          if (mc < 1 || mc > opts.length)
            add(`${p}.maxCount`, 'count.range', 'multiselect 的 maxCount 需在 1~选项数');
        }
      }
    }
    errs.push(...checkSlotDefault(it, p));
    const vw = it.visibleWhen;
    if (vw !== undefined && vw !== null) {
      const v = isObj(vw) ? vw : {};
      const refKey = String(v.key ?? '');
      const ref = byKey.get(refKey);
      if (!refKey.trim())
        add(
          `${p}.visibleWhen.key`,
          'visibleWhen.key_missing',
          'visibleWhen.key 必填（指向本模板内另一个入参的 key）',
        );
      else if (!ref)
        add(`${p}.visibleWhen.key`, 'visibleWhen.unknown_key', `引用的入参不存在：${refKey}`);
      else if (ref === it) add(`${p}.visibleWhen.key`, 'visibleWhen.self', '不能引用自己');
      else if (ref.visibleWhen)
        add(
          `${p}.visibleWhen.key`,
          'visibleWhen.nested',
          '只支持单层条件，被引用的入参自己不能再有 visibleWhen',
        );
      else if (!['select', 'switch', 'text'].includes(String(ref.type)))
        add(
          `${p}.visibleWhen.key`,
          'visibleWhen.ref_type',
          '只能引用 select / switch / text 类入参',
        );
      if (v.equals === undefined || v.equals === null)
        add(`${p}.visibleWhen.equals`, 'visibleWhen.equals_missing', 'visibleWhen.equals 必填');
      else if (!isScalar(v.equals))
        add(`${p}.visibleWhen.equals`, 'visibleWhen.equals', 'equals 必须是字符串、数字或布尔值');
    }
  });
  if (errs.length) throw slotsError(errs);
  items.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  return { schemaVersion: 1, items: items as unknown as SlotItem[] };
};

// ---------------- 模板视图 ----------------
const KNOWN_PAYLOAD_KEYS = ['result', 'image_urls', 'description', 'guidance', 'prompt'];

const rowOf = (t: Tpl, industryId = 0): PlazaTemplateRow => {
  const row: PlazaTemplateRow = {
    id: t.id,
    title: t.title,
    mediaType: t.mediaType,
    coverUrl: coverOf(t),
    state: t.state,
    displayState: displayStateOf(t),
    onlineAt: t.onlineAt,
    offlineAt: t.offlineAt,
    industries: refsOf(t),
    uses7d: t.uses7d,
    createdBy: t.createdBy,
    createTime: t.createTime,
    updateTime: t.updateTime,
    sortOrder: t.sortOrder,
    enabled: visibleNow(t),
    deleted: t.deleted,
    needsProductImage: t.needsProductImage,
    mediaStatus: (t.mediaType === 'video'
      ? t.mediaStatus
      : 'READY') as PlazaTemplateRow['mediaStatus'],
    mediaError: t.mediaError ?? null,
    mediaNote: t.mediaNote ?? null,
    mediaAttempts: t.mediaAttempts ?? 0,
    headlineBrief: briefOfTpl(t),
    revision: t.revision,
  };
  if (industryId > 0) row.industrySortOrder = t.industrySort[industryId] ?? 0;
  if (t.deleted && t.deletedAt) {
    row.deletedAt = t.deletedAt;
    row.purgeAt = fmt(ms(t.deletedAt) + TRASH_DAYS * DAY);
  }
  return row;
};

const detailOf = (t: Tpl): PlazaTemplateDetail => {
  const payload = t.payload;
  const known: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload ?? {})) {
    if (KNOWN_PAYLOAD_KEYS.includes(k)) known[k] = v;
    else extra[k] = v;
  }
  return {
    ...rowOf(t),
    description: t.description,
    category: t.category,
    tags: t.tags,
    payload,
    payloadKnown: known,
    payloadExtra: extra,
    agentSkillId: t.agentSkillId,
    videoUrl: t.videoUrl,
    posterUrl: t.posterUrl,
    channels: t.channels,
    slots: t.slots,
    textOverlay: t.textOverlay,
    mediaStatus: t.mediaStatus as PlazaTemplateDetail['mediaStatus'],
    industryIds: idsOf(t),
    industrySlots: refsOf(t).map((r) => ({
      ...r,
      sortOrder: t.industrySort[r.id] ?? 0,
    })),
    targetChannels: channelsOf(t),
    headlineStatus: inCatalog(t) ? templateStatusOf(t) : null,
  };
};

// =====================================================================
// 头条：数据与算法（对齐 headline/algo）
// =====================================================================
const DEFAULT_PARAMS: HeadlineParamValues = {
  'top-n': 10,
  'max-visible': 12,
  'half-life-hours': 24,
  velocity: { 'min-base': 3, min: -1, max: 2 },
  'fresh-days': 14,
  weight: { decay: 1.0, velocity: 0.6, fresh: 0.8, users: 0.5, ctr: 0 },
  'min-decayed': 3,
  'min-unique-users': 3,
  'rel-min-ratio': 0.1,
  'per-user-daily-cap': 3,
  'rapid-dedupe-seconds': 60,
  'max-per-media': 7,
  'hysteresis-delta': 0.15,
  'min-dwell-minutes': 120,
  'max-rank-move': 3,
  'cold-start-fill': true,
  'snapshot-retention-days': 7,
  'score-normalize': 'none',
  'norm-scale': 1,
  'global-top-n': 20,
  'display-min-uses': 20,
};

/** headline/service/admin_write.go 的 paramMeta（key 是点路径） */
const PARAM_META: HeadlineParamMeta[] = [
  {
    key: 'top-n',
    min: 3,
    max: 30,
    industryOverride: true,
    note: '每个行业榜的算法 + 补位名额',
  },
  {
    key: 'max-visible',
    min: 3,
    max: 50,
    industryOverride: false,
    note: '榜单最多条数（含人工），≥ top-n',
  },
  {
    key: 'half-life-hours',
    min: 1,
    max: 168,
    industryOverride: false,
    note: '时间衰减半衰期（小时）',
  },
  {
    key: 'velocity.min-base',
    min: 1,
    max: 100,
    industryOverride: false,
    note: '增速的最小基数（次/天）',
  },
  {
    key: 'velocity.min',
    min: -1,
    max: 0,
    industryOverride: false,
    note: '增速下限',
  },
  {
    key: 'velocity.max',
    min: 0,
    max: 10,
    industryOverride: false,
    note: '增速上限',
  },
  {
    key: 'fresh-days',
    min: 0,
    max: 60,
    industryOverride: false,
    note: '新鲜度加成天数',
  },
  {
    key: 'weight.decay',
    min: 0,
    max: 5,
    industryOverride: false,
    note: '权重：衰减热度',
  },
  {
    key: 'weight.velocity',
    min: 0,
    max: 5,
    industryOverride: false,
    note: '权重：24h 增速',
  },
  {
    key: 'weight.fresh',
    min: 0,
    max: 5,
    industryOverride: false,
    note: '权重：新鲜度',
  },
  {
    key: 'weight.users',
    min: 0,
    max: 5,
    industryOverride: false,
    note: '权重：去重用户数',
  },
  {
    key: 'weight.ctr',
    min: 0,
    max: 5,
    industryOverride: false,
    note: '权重：点击率（预留，曝光管道落地前为 0）',
  },
  {
    key: 'min-decayed',
    min: 0,
    max: 1000,
    industryOverride: true,
    note: '入选门槛：衰减热度',
  },
  {
    key: 'min-unique-users',
    min: 1,
    max: 1000,
    industryOverride: true,
    note: '入选门槛：去重用户数',
  },
  {
    key: 'rel-min-ratio',
    min: 0,
    max: 1,
    industryOverride: false,
    note: '相对阈值系数（小行业按自身量级筛选）',
  },
  {
    key: 'per-user-daily-cap',
    min: 1,
    max: 20,
    industryOverride: false,
    note: '同用户同模板每天最多计数（改后历史在下次小时校准重算）',
  },
  {
    key: 'rapid-dedupe-seconds',
    min: 0,
    max: 3600,
    industryOverride: false,
    note: '快速重复点击去重秒数（同上）',
  },
  {
    key: 'max-per-media',
    min: 1,
    max: 30,
    industryOverride: false,
    note: '每种媒体类型最多几个，≤ top-n',
  },
  {
    key: 'hysteresis-delta',
    min: 0,
    max: 0.5,
    industryOverride: false,
    note: '迟滞：在榜项分数打折门槛',
  },
  {
    key: 'min-dwell-minutes',
    min: 0,
    max: 1440,
    industryOverride: false,
    note: '上榜最短驻留（分钟）',
  },
  {
    key: 'max-rank-move',
    min: 1,
    max: 30,
    industryOverride: false,
    note: '每次刷新名次最多变化',
  },
  {
    key: 'cold-start-fill',
    min: 0,
    max: 1,
    industryOverride: false,
    note: '冷启动补位开关',
  },
  {
    key: 'snapshot-retention-days',
    min: 1,
    max: 90,
    industryOverride: false,
    note: '历史快照保留天数',
  },
  {
    key: 'score-normalize',
    min: 0,
    max: 0,
    industryOverride: false,
    note: 'none / scope_max（按范围归一化衰减项）',
  },
  {
    key: 'norm-scale',
    min: 0,
    max: 100,
    industryOverride: false,
    note: '归一化系数',
  },
  {
    key: 'global-top-n',
    min: 3,
    max: 100,
    industryOverride: false,
    note: '全站总榜条数（仅后台）',
  },
  {
    key: 'display-min-uses',
    min: 0,
    max: 1000,
    industryOverride: false,
    note: '近 7 天少于它不展示具体数字',
  },
];

let cfg: HeadlineConfig = { global: clone(DEFAULT_PARAMS), overrides: {} };
let paramsVersion = 3;

/** 某范围生效的参数（全局叠加该范围覆盖；ALL 不吃覆盖） */
const paramsFor = (c: HeadlineConfig, scope: string): HeadlineParamValues => {
  const p = clone(c.global);
  const o = scope === 'ALL' ? undefined : c.overrides[scope];
  if (o?.['top-n'] !== undefined) p['top-n'] = o['top-n'];
  if (o?.['min-decayed'] !== undefined) p['min-decayed'] = o['min-decayed'];
  if (o?.['min-unique-users'] !== undefined) p['min-unique-users'] = o['min-unique-users'];
  return p;
};

/** 规范化：空覆盖剔除 */
const canonical = (c: HeadlineConfig): HeadlineConfig => {
  const overrides: Record<string, HeadlineOverride> = {};
  for (const [k, v] of Object.entries(c.overrides ?? {})) {
    if (v && Object.values(v).some((x) => x !== undefined && x !== null)) overrides[k] = v;
  }
  return { global: c.global, overrides };
};

/** 对应 Config.Validate：逐项范围 + 跨字段 + 覆盖范围必须是现存行业 */
const validateConfig = (c: HeadlineConfig, known: Set<string>): ParamFieldError[] => {
  const errs: ParamFieldError[] = [];
  const g = (c?.global ?? {}) as Partial<HeadlineParamValues>;
  const n = (v: unknown) =>
    typeof v === 'number' ? v : v === undefined || v === null ? 0 : Number(v);
  const vel = (g.velocity ?? {}) as Partial<HeadlineParamValues['velocity']>;
  const wt = (g.weight ?? {}) as Partial<HeadlineParamValues['weight']>;
  const topN = n(g['top-n']);
  const check = (prefix: string, field: string, v: number, lo: number, hi: number) => {
    if (Number.isNaN(v) || v < lo || v > hi)
      errs.push({
        field: prefix + field,
        reason: `须在 ${lo}~${hi} 之间，当前 ${v}`,
      });
  };
  const rows: [string, number, number, number][] = [
    ['top-n', topN, 3, 30],
    ['max-visible', n(g['max-visible']), topN, 50],
    ['half-life-hours', n(g['half-life-hours']), 1, 168],
    ['velocity.min-base', n(vel['min-base']), 1, 100],
    ['velocity.min', n(vel.min), -1, 0],
    ['velocity.max', n(vel.max), 0, 10],
    ['fresh-days', n(g['fresh-days']), 0, 60],
    ['weight.decay', n(wt.decay), 0, 5],
    ['weight.velocity', n(wt.velocity), 0, 5],
    ['weight.fresh', n(wt.fresh), 0, 5],
    ['weight.users', n(wt.users), 0, 5],
    ['weight.ctr', n(wt.ctr), 0, 5],
    ['min-decayed', n(g['min-decayed']), 0, 1000],
    ['min-unique-users', n(g['min-unique-users']), 1, 1000],
    ['rel-min-ratio', n(g['rel-min-ratio']), 0, 1],
    ['per-user-daily-cap', n(g['per-user-daily-cap']), 1, 20],
    ['rapid-dedupe-seconds', n(g['rapid-dedupe-seconds']), 0, 3600],
    ['max-per-media', n(g['max-per-media']), 1, topN],
    ['hysteresis-delta', n(g['hysteresis-delta']), 0, 0.5],
    ['min-dwell-minutes', n(g['min-dwell-minutes']), 0, 1440],
    ['max-rank-move', n(g['max-rank-move']), 1, topN],
    ['snapshot-retention-days', n(g['snapshot-retention-days']), 1, 90],
    ['norm-scale', n(g['norm-scale']), 0, 100],
    ['global-top-n', n(g['global-top-n']), 3, 100],
    ['display-min-uses', n(g['display-min-uses']), 0, 1000],
  ];
  for (const [f, v, lo, hi] of rows) check('global.', f, v, lo, hi);
  if (g['score-normalize'] !== 'none' && g['score-normalize'] !== 'scope_max')
    errs.push({
      field: 'global.score-normalize',
      reason: '只能是 none 或 scope_max',
    });
  for (const s of Object.keys(c?.overrides ?? {}).sort()) {
    const o = c.overrides[s] ?? {};
    const prefix = `overrides.${s}.`;
    if (s === 'ALL' || s === '*' || s === '') {
      errs.push({ field: `overrides.${s}`, reason: '保留范围不接受覆盖' });
      continue;
    }
    if (!known.has(s)) {
      errs.push({ field: `overrides.${s}`, reason: '行业不存在' });
      continue;
    }
    if (o['top-n'] !== undefined && o['top-n'] !== null) {
      check(prefix, 'top-n', o['top-n'], 3, 30);
      if (o['top-n'] > n(g['max-visible']))
        errs.push({
          field: `${prefix}top-n`,
          reason: `不能大于 max-visible（${n(g['max-visible'])}）`,
        });
      if (n(g['max-per-media']) > o['top-n'])
        errs.push({
          field: `${prefix}top-n`,
          reason: `不能小于 max-per-media（${n(g['max-per-media'])}）`,
        });
    }
    if (o['min-decayed'] !== undefined && o['min-decayed'] !== null)
      check(prefix, 'min-decayed', o['min-decayed'], 0, 1000);
    if (o['min-unique-users'] !== undefined && o['min-unique-users'] !== null)
      check(prefix, 'min-unique-users', o['min-unique-users'], 1, 1000);
  }
  return errs;
};

// ---- 范围 / 目录 ----
interface ScopeDef {
  code: string;
  name: string;
  parentCode?: string;
}
/** 范围：启用的行业（一级在前，二级跟在其后） */
const scopeList = (): ScopeDef[] => {
  const out: ScopeDef[] = [];
  const tops = inds.filter((x) => x.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of tops) {
    if (!p.enabled) continue;
    out.push({ code: p.code, name: p.name });
    for (const c of inds
      .filter((x) => x.parentId === p.id && x.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder))
      out.push({ code: c.code, name: c.name, parentCode: p.code });
  }
  return out;
};
const scopeName = (code: string): string => {
  if (code === 'ALL') return '全站总榜';
  if (code === '*') return '所有适用行业';
  return indByCode(code)?.name ?? code;
};
/** 范围覆盖的行业 id（一级含其子级） */
const scopeIndustryIds = (code: string): number[] => {
  const x = indByCode(code);
  if (!x) return [];
  return x.parentId === null ? descendants(x.id) : [x.id];
};
const inScope = (t: Tpl, code: string) => {
  const ids = scopeIndustryIds(code);
  return idsOf(t).some((i) => ids.includes(i));
};
const scopesOfTpl = (t: Tpl): string[] =>
  scopeList()
    .filter((s) => inScope(t, s.code))
    .map((s) => s.code);
/** 目录：未删除且非草稿（草稿 / 回收站不在榜单目录里） */
const inCatalog = (t: Tpl) => !t.deleted && t.state !== 'DRAFT';
const scopeMembers = (scope: string, at: number): Tpl[] =>
  tpls.filter((t) => visibleNow(t, at) && (scope === 'ALL' || inScope(t, scope)));

const briefOf = (id: number): HeadlineTemplateBrief => {
  const t = tplById(id);
  if (!t || !inCatalog(t))
    return {
      id,
      title: '',
      cover: '',
      mediaType: '',
      tags: [],
      visible: false,
      exists: false,
    };
  return {
    id,
    title: t.title,
    cover: coverOf(t),
    mediaType: t.mediaType,
    tags: t.tags,
    visible: visibleNow(t),
    exists: true,
  };
};

// ---- 人工规则 / 抑制 ----
interface RuleRow {
  id: number;
  tplId: number;
  scope: string;
  batchId: string | null;
  startDate: string;
  endDate: string;
  why: string;
  sortOrder: number;
  enabled: 0 | 1;
  pinPosition: number | null;
  adoptedFromAuto: 0 | 1;
  createdBy: number;
  updatedBy: number;
}
interface BlockRow {
  id: number;
  tplId: number;
  scope: string;
  kind: 'CANCEL' | 'BLOCK';
  reason: string;
  batchId: string | null;
  createdBy: number;
  untilMs: number | null;
}
const rules: RuleRow[] = [];
const blocks: BlockRow[] = [];
let nextRuleId = 1;
let nextBlockId = 1;

const ruleActiveOn = (r: RuleRow, at = now()) =>
  r.enabled === 1 && r.startDate <= todayStr(at) && todayStr(at) <= r.endDate;
const blockActive = (b: BlockRow, at = now()) =>
  b.kind === 'BLOCK' || b.untilMs === null || b.untilMs > at;
/** 范围内被取消 / 屏蔽的模板（抑制的范围 ∈ {scope, *}） */
const suppressedSet = (scope: string, at = now()): Set<number> =>
  new Set(
    scope === 'ALL'
      ? []
      : blocks
          .filter((b) => blockActive(b, at) && (b.scope === scope || b.scope === '*'))
          .map((b) => b.tplId),
  );

const ruleBaseOf = (r: RuleRow): HeadlineRuleBase => ({
  id: r.id,
  plazaTemplateId: r.tplId,
  scope: r.scope,
  batchId: r.batchId,
  why: r.why,
  sortOrder: r.sortOrder,
  enabled: r.enabled,
  pinPosition: r.pinPosition,
  adoptedFromAuto: r.adoptedFromAuto,
  createdBy: r.createdBy,
  updatedBy: r.updatedBy,
});
const ruleViewOf = (r: RuleRow): HeadlineRule => {
  const today = todayStr();
  const phase = r.startDate > today ? 'UPCOMING' : r.endDate < today ? 'EXPIRED' : 'CURRENT';
  return {
    ...ruleBaseOf(r),
    startDate: r.startDate,
    endDate: r.endDate,
    scopeName: scopeName(r.scope),
    phase,
    template: briefOf(r.tplId),
  };
};
const blockViewOf = (b: BlockRow): HeadlineSuppression => ({
  id: b.id,
  plazaTemplateId: b.tplId,
  scope: b.scope,
  kind: b.kind,
  reason: b.reason,
  batchId: b.batchId,
  createdBy: b.createdBy,
  untilAt: b.untilMs === null ? null : fmt(b.untilMs),
  permanent: b.untilMs === null,
  scopeName: scopeName(b.scope),
  templateTitle: tplById(b.tplId)?.title ?? '',
});

// ---- 评分 ----
interface Scored {
  t: Tpl;
  st: HeadlineStats;
  signals: Record<string, HeadlineSignalDetail>;
  score: number;
}

const scoreTpl = (t: Tpl, p: HeadlineParamValues, at: number): Scored => {
  const uses = t.uses7d;
  const decayed = r2(uses * 0.62 * Math.sqrt(p['half-life-hours'] / 24));
  const r24 = Math.round(uses * 0.16);
  const rate6d = r2((uses - r24) / 6);
  const base = Math.max(rate6d, p.velocity['min-base']);
  const velocity = r2(clamp((r24 - base) / base, p.velocity.min, p.velocity.max));
  const ageDays = Math.max(0, Math.floor((at - ms(t.createTime)) / DAY));
  const freshness = p['fresh-days'] > 0 ? r2(Math.max(0, 1 - ageDays / p['fresh-days'])) : 0;
  const uniqueUsers = Math.round(uses * 0.4);
  const usersRaw = r4(Math.log(1 + uniqueUsers));
  const w = p.weight;
  const signals: Record<string, HeadlineSignalDetail> = {
    decay: { raw: decayed, w: w.decay, v: r4(w.decay * decayed * 0.5) },
    velocity: {
      raw: velocity,
      w: w.velocity,
      v: r4(w.velocity * velocity * 10),
    },
    fresh: { raw: freshness, w: w.fresh, v: r4(w.fresh * freshness * 12) },
    users: { raw: usersRaw, w: w.users, v: r4(w.users * usersRaw * 10) },
    ctr: { raw: null, w: w.ctr, v: 0 },
  };
  const score = r4(Object.values(signals).reduce((s, x) => s + x.v, 0));
  return {
    t,
    st: {
      uses7d: uses,
      prevUses7d: t.prevUses,
      r24,
      rate6d,
      decayed,
      velocity,
      freshness,
      ageDays,
      uniqueUsers,
    },
    signals,
    score,
  };
};

const formatCount = (n: number): string => {
  const trim = (v: number, unit: string) =>
    `${(Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '')}${unit}`;
  if (n >= 10000) return trim(n / 10000, 'w');
  if (n >= 1000) return trim(n / 1000, 'k');
  return String(n);
};
const trendOf = (uses: number, prev: number): number | null =>
  prev > 0 ? Math.round(((uses - prev) / prev) * 100) : null;

/** 对应 algo.AutoWhy（14.5.6）：按顺序命中第一条 */
const autoWhy = (st: HeadlineStats, p: HeadlineParamValues): string => {
  const fresh = p['fresh-days'] > 0 && st.ageDays <= p['fresh-days'];
  const trend = trendOf(st.uses7d, st.prevUses7d);
  if (st.uses7d < p['display-min-uses']) {
    if (fresh && st.prevUses7d === 0) return '新上架 · 近期热门';
    if (st.velocity >= 0.5) return '今日热度上升';
    return '近 7 天热门';
  }
  const n = formatCount(st.uses7d);
  if (fresh && st.prevUses7d === 0) return `新上架 · 近 7 天 ${n} 次复刻`;
  if (st.velocity >= 0.5) return `今日热度上升 · 近 7 天 ${n} 次复刻`;
  if (trend !== null && trend >= 20) return `近 7 天复刻 ${n} 次，较前 7 天 +${trend}%`;
  if (st.prevUses7d === 0) return `近 7 天复刻 ${n} 次，新上榜`;
  return `近 7 天复刻 ${n} 次`;
};

interface ScopeBoard {
  items: HeadlineAlgoItem[];
  nearMiss: Omit<HeadlineNearMiss, 'template'>[];
  stats: HeadlineScopeStats;
}

/** 一个范围的榜单（纯函数：同样的输入同样的输出；prev 用来继承 enteredAt / 标 incumbent） */
const computeScope = (
  scope: string,
  c: HeadlineConfig,
  prev: HeadlineAlgoItem[],
  at: number,
): ScopeBoard => {
  const p = paramsFor(c, scope);
  const isAll = scope === 'ALL';
  const topN = isAll ? p['global-top-n'] : p['top-n'];
  const thresholds = {
    effMinDecayed: p['min-decayed'],
    effMinUsers: p['min-unique-users'],
  };
  const members = scopeMembers(scope, at);
  const blocked = suppressedSet(scope, at);
  const skip: Record<string, number> = {};
  const bump = (k: string) => {
    skip[k] = (skip[k] ?? 0) + 1;
  };
  const prevMap = new Map(prev.map((i) => [i.plazaTemplateId, i]));
  const pool = members
    .filter((t) => {
      if (!blocked.has(t.id)) return true;
      bump('SUPPRESSED');
      return false;
    })
    .map((t) => scoreTpl(t, p, at));
  const byScore = (a: Scored, b: Scored) => b.score - a.score || b.t.id - a.t.id;

  // 人工规则：规则范围 = 该范围或 *（所有适用行业），同模板取最新一条
  const ruleOf = new Map<number, RuleRow>();
  if (!isAll) {
    for (const r of rules) {
      if (!ruleActiveOn(r, at) || (r.scope !== scope && r.scope !== '*')) continue;
      if (!pool.some((x) => x.t.id === r.tplId)) continue;
      const old = ruleOf.get(r.tplId);
      if (!old || r.id > old.id) ruleOf.set(r.tplId, r);
    }
  }
  const manual = pool.filter((x) => ruleOf.has(x.t.id));
  const rest = pool.filter((x) => !ruleOf.has(x.t.id)).sort(byScore);
  const eff = (x: Scored) =>
    prevMap.has(x.t.id) ? x.score : r4(x.score * (1 - p['hysteresis-delta']));

  const eligible: Scored[] = [];
  const misses: { s: Scored; reason: string }[] = [];
  for (const x of rest) {
    if (x.st.decayed < thresholds.effMinDecayed) {
      bump('BELOW_MIN_DECAYED');
      misses.push({ s: x, reason: 'BELOW_MIN_DECAYED' });
    } else if (x.st.uniqueUsers < thresholds.effMinUsers) {
      bump('BELOW_MIN_USERS');
      misses.push({ s: x, reason: 'BELOW_MIN_USERS' });
    } else eligible.push(x);
  }
  const autoSlots = Math.max(0, topN - manual.length);
  const mediaCount: Record<string, number> = {};
  for (const x of manual) mediaCount[x.t.mediaType] = (mediaCount[x.t.mediaType] ?? 0) + 1;
  const auto: Scored[] = [];
  for (const x of eligible) {
    if ((mediaCount[x.t.mediaType] ?? 0) >= p['max-per-media']) {
      bump('DIVERSITY_MEDIA');
      misses.push({ s: x, reason: 'DIVERSITY_MEDIA' });
    } else if (auto.length >= autoSlots) {
      bump('CUT_BY_SLOTS');
      misses.push({ s: x, reason: 'CUT_BY_SLOTS' });
    } else {
      mediaCount[x.t.mediaType] = (mediaCount[x.t.mediaType] ?? 0) + 1;
      auto.push(x);
    }
  }
  const cutoff = auto.length ? Math.min(...auto.map(eff)) : 0;

  // 组榜：自由项按分数降序，定位项插到对应名次
  interface Entry {
    x: Scored;
    rule?: RuleRow;
  }
  const all: Entry[] = [
    ...auto.map((x): Entry => ({ x })),
    ...manual.map((x): Entry => ({ x, rule: ruleOf.get(x.t.id) })),
  ];
  const pinned = all
    .filter((e) => e.rule?.pinPosition)
    .sort((a, b) => a.rule!.pinPosition! - b.rule!.pinPosition!);
  const list = all.filter((e) => !e.rule?.pinPosition).sort((a, b) => byScore(a.x, b.x));
  for (const e of pinned) list.splice(Math.min(e.rule!.pinPosition! - 1, list.length), 0, e);
  const picked = list.slice(0, isAll ? topN : p['max-visible']);

  const items: HeadlineAlgoItem[] = picked.map((e, i) => {
    const old = prevMap.get(e.x.t.id);
    const source: HeadlineSource = e.rule ? 'MANUAL' : 'AUTO';
    const it: HeadlineAlgoItem = {
      scope,
      plazaTemplateId: e.x.t.id,
      rank: i + 1,
      source,
      score: e.x.score,
      scoreDetail: {
        scope,
        signals: e.x.signals,
        stats: e.x.st,
        thresholds,
        stability: {
          incumbent: !!old,
          effScore: eff(e.x),
          entryCutoff: cutoff,
          dwellProtected: false,
          rankMovedFrom: old && old.rank !== i + 1 ? old.rank : null,
          rankClampedBy: 0,
        },
        mediaCap: { mediaType: e.x.t.mediaType, mediaCount: 0 },
        pickedBy: 'SCORE',
      },
      why: e.rule ? e.rule.why : autoWhy(e.x.st, p),
      uses7d: e.x.st.uses7d,
      prevUses: e.x.st.prevUses7d,
      trend: trendOf(e.x.st.uses7d, e.x.st.prevUses7d),
      isNew: p['fresh-days'] > 0 && e.x.st.ageDays <= p['fresh-days'],
      uniqueUsers: e.x.st.uniqueUsers,
      enteredAt: old?.enteredAt ?? rfc3339(at),
    };
    if (e.rule) {
      it.headlineId = e.rule.id;
      if (e.rule.pinPosition) it.pinPosition = e.rule.pinPosition;
      if (e.rule.adoptedFromAuto === 1) it.adopted = true;
    }
    return it;
  });
  // 冷启动补位：不足名额用本范围最新上架补
  let fillCount = 0;
  if (items.length < topN && p['cold-start-fill']) {
    const used = new Set(items.map((i) => i.plazaTemplateId));
    const fills = pool
      .filter((x) => !used.has(x.t.id))
      .sort((a, b) => b.t.id - a.t.id)
      .slice(0, topN - items.length);
    for (const x of fills) {
      items.push({
        scope,
        plazaTemplateId: x.t.id,
        rank: items.length + 1,
        source: 'FILL',
        score: null,
        why: '新上架',
        uses7d: 0,
        prevUses: 0,
        trend: null,
        isNew: true,
        uniqueUsers: null,
        enteredAt: prevMap.get(x.t.id)?.enteredAt ?? rfc3339(at),
      });
      fillCount++;
    }
  }
  // 同媒体计数回填 mediaCap
  const counts: Record<string, number> = {};
  for (const i of items) {
    const mt = tplById(i.plazaTemplateId)?.mediaType ?? '';
    counts[mt] = (counts[mt] ?? 0) + 1;
  }
  for (const i of items) {
    if (!i.scoreDetail) continue;
    i.scoreDetail.mediaCap.mediaCount = counts[i.scoreDetail.mediaCap.mediaType] ?? 0;
  }

  const placed = new Set(items.map((i) => i.plazaTemplateId));
  const nearMiss: Omit<HeadlineNearMiss, 'template'>[] = misses
    .filter((m) => !placed.has(m.s.t.id))
    .sort((a, b) => eff(b.s) - eff(a.s))
    .slice(0, 10)
    .map(({ s, reason }) => ({
      plazaTemplateId: s.t.id,
      score: s.score,
      effScore: eff(s),
      reason,
      gap: r4(cutoff - eff(s)),
      uses7d: s.st.uses7d,
    }));
  return {
    items,
    nearMiss,
    stats: {
      candidates: members.length,
      eligible: eligible.length + manual.length,
      auto: auto.length,
      manual: manual.length,
      fill: fillCount,
      autoSlots,
      skip,
      thresholds,
    },
  };
};

const diffOf = (before: HeadlineAlgoItem[], after: HeadlineAlgoItem[]): HeadlineDiff => ({
  enter: after
    .filter((a) => !before.some((b) => b.plazaTemplateId === a.plazaTemplateId))
    .map((a) => a.plazaTemplateId),
  exit: before
    .filter((b) => !after.some((a) => a.plazaTemplateId === b.plazaTemplateId))
    .map((b) => b.plazaTemplateId),
  moved: after.flatMap((a) => {
    const b = before.find((x) => x.plazaTemplateId === a.plazaTemplateId);
    return b && b.rank !== a.rank
      ? [{ plazaTemplateId: a.plazaTemplateId, from: b.rank, to: a.rank }]
      : [];
  }),
});

// ---- 快照（保留最近 12 个版本，更早的 404 HEADLINE_SNAPSHOT_EXPIRED） ----
interface Snap {
  version: number;
  computedMs: number;
  trigger: string;
  operatorId: number | null;
  signalSource: 'REDIS' | 'DB';
  paramsHash: string;
  candidateCount: number;
  scopeCount: number;
  itemCount: number;
  durationMs: number;
  paramsRaw: string;
  boards: Record<string, ScopeBoard>;
}
const SNAP_KEEP = 12;
const REFRESH_INTERVAL = 10 * 60_000;
const snaps: Snap[] = [];
let nextVersion = 118;
const latestSnap = (): Snap | undefined => snaps[snaps.length - 1];

const makeSnapshot = (trigger: string, operatorId: number | null, at = now()): Snap => {
  const prev = latestSnap();
  const boards: Record<string, ScopeBoard> = {};
  for (const code of ['ALL', ...scopeList().map((s) => s.code)])
    boards[code] = computeScope(code, cfg, prev?.boards[code]?.items ?? [], at);
  const paramsRaw = JSON.stringify(canonical(cfg));
  const snap: Snap = {
    version: nextVersion++,
    computedMs: at,
    trigger,
    operatorId,
    signalSource: 'REDIS',
    paramsHash: hashOf(paramsRaw),
    candidateCount: scopeMembers('ALL', at).length,
    scopeCount: Object.keys(boards).length,
    itemCount: Object.values(boards).reduce((s, b) => s + b.items.length, 0),
    durationMs: 80 + ((nextVersion * 37) % 220),
    paramsRaw,
    boards,
  };
  snaps.push(snap);
  while (snaps.length > SNAP_KEEP) snaps.shift();
  return snap;
};

const snapMeta = (s: Snap, withParams: boolean): HeadlineSnapshotMeta => {
  const meta: HeadlineSnapshotMeta = {
    version: s.version,
    computedAt: fmt(s.computedMs),
    ageMinutes: Math.floor((now() - s.computedMs) / 60_000),
    trigger: s.trigger,
    operatorId: s.operatorId,
    signalSource: s.signalSource,
    paramsHash: s.paramsHash,
    candidateCount: s.candidateCount,
    scopeCount: s.scopeCount,
    itemCount: s.itemCount,
    durationMs: s.durationMs,
    stale: now() - s.computedMs > 3 * REFRESH_INTERVAL,
    windowStart: fmt(s.computedMs - 7 * DAY),
    windowEnd: fmt(s.computedMs),
  };
  if (withParams) meta.params = s.paramsRaw;
  return meta;
};

const snapshotExpired = () => notFoundErr('该版本已超过保留期', 'HEADLINE_SNAPSHOT_EXPIRED');

/** 写后同步刷新（OPS 触发） */
const afterWrite = (ids: number[], batchId?: string): HeadlineWriteResult => {
  const snap = makeSnapshot('OPS', OPERATOR_ID);
  const res: HeadlineWriteResult = {
    ids,
    version: snap.version,
    refreshed: true,
  };
  if (batchId) res.batchId = batchId;
  return res;
};

/** 模板列表行的头条摘要 */
function briefOfTpl(t: Tpl): HeadlineBrief {
  const snap = latestSnap();
  const scopes: HeadlineBrief['scopes'] = [];
  if (snap) {
    for (const [scope, b] of Object.entries(snap.boards)) {
      const it = b.items.find((i) => i.plazaTemplateId === t.id);
      if (it)
        scopes.push({
          scope,
          name: scopeName(scope),
          rank: it.rank,
          source: it.source,
        });
    }
  }
  return {
    onBoard: scopes.length > 0,
    version: scopes.length && snap ? snap.version : 0,
    scopes,
    activeRules: rules.filter((r) => r.tplId === t.id && ruleActiveOn(r)).length,
    suppressed: blocks.some((b) => b.tplId === t.id && blockActive(b)),
  };
}

/** GET /templates/{id}/headline-status 的内容；详情里的 headlineStatus 同形 */
function templateStatusOf(t: Tpl): HeadlineTemplateStatus {
  const snap = latestSnap();
  const codes = [...scopesOfTpl(t), 'ALL'];
  const scopes: HeadlineTemplateScopeStatus[] = codes.map((code) => {
    const board = snap?.boards[code];
    const it = board?.items.find((i) => i.plazaTemplateId === t.id);
    const st: HeadlineTemplateScopeStatus = {
      scope: code,
      name: scopeName(code),
      onBoard: !!it,
      rank: it ? it.rank : null,
      score: it ? it.score : null,
      uses7d: it ? it.uses7d : 0,
      suppressed: suppressedSet(code).has(t.id),
      nearMiss: false,
      gapToCutoff: null,
    };
    if (it) st.source = it.source;
    else {
      const nm = board?.nearMiss.find((n) => n.plazaTemplateId === t.id);
      if (nm) {
        st.nearMiss = true;
        st.skipReason = nm.reason;
        st.gapToCutoff = nm.gap;
        st.uses7d = nm.uses7d;
      }
    }
    return st;
  });
  return {
    template: briefOf(t.id),
    version: snap?.version ?? 0,
    scopes,
    rules: rules
      .filter((r) => r.tplId === t.id)
      .sort((a, b) => b.id - a.id)
      .map(ruleViewOf),
    blocks: blocks
      .filter((b) => b.tplId === t.id && blockActive(b))
      .sort((a, b) => b.id - a.id)
      .map(blockViewOf),
  };
}

/** 榜单条目 → 管理端条目（读时叠加规则 / 抑制 / 模板摘要） */
const adminItemOf = (
  it: HeadlineAlgoItem,
  scope: string,
  p: HeadlineParamValues,
  blocked: Set<number>,
): HeadlineItem => {
  const out: HeadlineItem = {
    ...it,
    template: briefOf(it.plazaTemplateId),
    suppressed: blocked.has(it.plazaTemplateId),
    usageVisible: it.uses7d >= p['display-min-uses'],
  };
  const rule = it.headlineId ? rules.find((r) => r.id === it.headlineId) : undefined;
  if (rule) {
    out.rule = ruleBaseOf(rule);
    out.ruleStartDate = rule.startDate;
    out.ruleEndDate = rule.endDate;
  }
  void scope;
  return out;
};

const boardView = (snap: Snap, scope: string): HeadlineBoard => {
  const b = snap.boards[scope];
  const p = paramsFor(cfg, scope);
  const blocked = suppressedSet(scope);
  const view: HeadlineBoard = {
    snapshot: snapMeta(snap, true),
    scope,
    items: (b?.items ?? []).map((i) => adminItemOf(i, scope, p, blocked)),
    nearMiss: (b?.nearMiss ?? []).map((n) => ({
      ...n,
      template: briefOf(n.plazaTemplateId),
    })),
    skip: b?.stats.skip ?? {},
    thresholds: b?.stats.thresholds ?? { effMinDecayed: 0, effMinUsers: 0 },
  };
  if (b) view.stats = b.stats;
  return view;
};

// ---- 规则 / 抑制的写入口校验（对应 admin_write.go） ----
const errTemplateAbsent = () =>
  notFoundErr('模板不存在或对用户不可见', 'HEADLINE_TEMPLATE_NOT_FOUND');
const errSuppressed = (scope: string) =>
  conflictErr(`该模板在 ${scope} 已被取消推荐或屏蔽，请先解除`, 'HEADLINE_TEMPLATE_SUPPRESSED');
const errDuplicate = (scope: string) =>
  conflictErr(`该模板在 ${scope} 已有时间重叠的生效推荐`, 'HEADLINE_DUPLICATE');
const errNotInScope = (scope: string) =>
  paramErr(`模板不属于行业 ${scope}，不能在该行业的榜单上操作`, 'HEADLINE_TEMPLATE_NOT_IN_SCOPE');

const dedupeStrs = (xs: unknown): string[] =>
  Array.from(
    new Set((Array.isArray(xs) ? xs : []).map((x) => String(x).trim()).filter((x) => x !== '')),
  );

/** 校验并规整范围：ALL 拒绝；* 原样保留；显式范围须是现存行业且包含该模板；alsoParent 补上一级 */
const resolveScopes = (t: Tpl, scopesIn: unknown, alsoParent: boolean): string[] => {
  const scopes = dedupeStrs(scopesIn);
  if (!scopes.length) throw paramErr('请选择至少一个行业范围');
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  for (const sc of scopes) {
    if (sc === 'ALL')
      throw paramErr('全站总榜不接受人工规则，请选择行业', 'HEADLINE_SCOPE_NOT_EDITABLE');
    if (sc === '*') {
      if (!scopesOfTpl(t).length) throw errNotInScope('（模板还没有归入任何行业）');
      push(sc);
      continue;
    }
    const def = scopeList().find((s) => s.code === sc);
    if (!def) throw notFoundErr('这个行业已调整，请重新选择', 'INDUSTRY_NOT_FOUND');
    if (!inScope(t, sc)) throw errNotInScope(def.name);
    push(sc);
    if (alsoParent && def.parentCode && inScope(t, def.parentCode)) push(def.parentCode);
  }
  return out;
};

const suppressedIn = (tplId: number, scope: string, at = now()): boolean =>
  blocks.some(
    (b) =>
      b.tplId === tplId &&
      blockActive(b, at) &&
      (scope === '*' || b.scope === scope || b.scope === '*'),
  );

const checkWhy = (raw: unknown): string => {
  const why = str(raw);
  if (!why) throw paramErr('推荐语不能为空');
  if (runeLen(why) > 60) throw paramErr('推荐语最多 60 字');
  return why;
};
const checkPin = (pin: unknown): number | null => {
  if (pin === undefined || pin === null) return null;
  const n = Number(pin);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw paramErr('名次须在 1~50 之间');
  return n;
};
/** 缺省今天起 7 天（含首尾） */
const dateWindow = (start: unknown, end: unknown): { sd: string; ed: string } => {
  let sd = dayStartMs(todayStr());
  let ed = sd + 6 * DAY;
  const s = str(start);
  const e = str(end);
  if (s) {
    const v = parseDate(s);
    if (v === null) throw paramErr('startDate 格式应为 yyyy-MM-dd');
    sd = v;
    if (!e) ed = sd + 6 * DAY;
  }
  if (e) {
    const v = parseDate(e);
    if (v === null) throw paramErr('endDate 格式应为 yyyy-MM-dd');
    ed = v;
  }
  if (ed < sd) throw paramErr('结束日期不能早于开始日期');
  return { sd: fmtDate(sd), ed: fmtDate(ed) };
};
const overlaps = (tplId: number, scope: string, sd: string, ed: string, except: Set<number>) =>
  rules.some(
    (r) =>
      !except.has(r.id) &&
      r.tplId === tplId &&
      r.scope === scope &&
      r.enabled === 1 &&
      r.startDate <= ed &&
      r.endDate >= sd,
  );

const newRule = (
  tplId: number,
  scope: string,
  why: string,
  pin: number | null,
  sd: string,
  ed: string,
  enabled: boolean,
  sortOrder: number,
  adopted: boolean,
  batchId: string | null,
): RuleRow => {
  const r: RuleRow = {
    id: nextRuleId++,
    tplId,
    scope,
    batchId,
    startDate: sd,
    endDate: ed,
    why,
    sortOrder,
    enabled: enabled ? 1 : 0,
    pinPosition: pin,
    adoptedFromAuto: adopted ? 1 : 0,
    createdBy: OPERATOR_ID,
    updatedBy: OPERATOR_ID,
  };
  rules.push(r);
  return r;
};

/** 找 scope 上该模板生效的显式规则；没有就接管（adoptedFromAuto=1，推荐语沿用榜单文案），再按 mutate 改 */
const adoptOrUpdate = (
  tplId: number,
  scope: string,
  mutate: (r: RuleRow) => void,
): HeadlineWriteResult => {
  if (!scope || scope === '*') throw paramErr('定位 / 改推荐语需要指定一个行业');
  const t = tplById(tplId);
  if (!t) throw errTemplateAbsent();
  resolveScopes(t, [scope], false);
  if (!inCatalog(t) || !visibleNow(t)) throw errTemplateAbsent();
  if (suppressedIn(tplId, scope)) throw errSuppressed(scopeName(scope));
  let target: RuleRow | undefined;
  for (const r of rules) {
    if (r.tplId === tplId && r.scope === scope && ruleActiveOn(r) && (!target || r.id > target.id))
      target = r;
  }
  if (!target) {
    const why =
      latestSnap()?.boards[scope]?.items.find((i) => i.plazaTemplateId === tplId && i.why)?.why ??
      '运营推荐';
    const sd = todayStr();
    target = newRule(
      tplId,
      scope,
      why,
      null,
      sd,
      fmtDate(dayStartMs(sd) + 6 * DAY),
      true,
      0,
      true,
      null,
    );
  }
  mutate(target);
  target.updatedBy = OPERATOR_ID;
  return afterWrite([target.id]);
};

const ruleTargets = (id: number, batch: boolean): RuleRow[] => {
  const r = rules.find((x) => x.id === id);
  if (!r) throw notFoundErr('头条规则不存在');
  if (!batch || !r.batchId) return [r];
  return rules.filter((x) => x.batchId === r.batchId);
};

/** 取消时长：24h | sunday | custom | permanent，或 kind + untilAt */
const suppressWindow = (
  req: HeadlineSuppressRequest,
): { kind: 'CANCEL' | 'BLOCK'; until: number | null } => {
  const at = now();
  if (req.duration) {
    switch (req.duration) {
      case '24h':
        return { kind: 'CANCEL', until: at + DAY };
      case 'sunday': {
        const dow = new Date(at + CST_OFFSET).getUTCDay();
        return {
          kind: 'CANCEL',
          until: dayStartMs(todayStr(at)) + (dow === 0 ? 1 : 8 - dow) * DAY,
        };
      }
      case 'custom': {
        const d = parseDate(str(req.customDate));
        if (d === null) throw paramErr('customDate 格式应为 yyyy-MM-dd');
        const until = d + DAY;
        if (until <= at) throw paramErr('截止时间必须晚于现在');
        return { kind: 'CANCEL', until };
      }
      case 'permanent':
        return { kind: 'BLOCK', until: null };
      default:
        throw paramErr('未知的取消时长');
    }
  }
  const kind = str(req.kind).toUpperCase();
  if (kind === 'BLOCK') return { kind: 'BLOCK', until: null };
  if (kind === 'CANCEL') {
    const raw = str(req.untilAt);
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})$/.exec(raw);
    const norm = m ? `${m[1]}T${m[2]}` : '';
    const t = m ? ms(norm) : NaN;
    if (!m || Number.isNaN(t) || fmt(t) !== norm)
      throw paramErr('untilAt 格式应为 yyyy-MM-ddTHH:mm:ss');
    if (t <= at) throw paramErr('截止时间必须晚于现在');
    return { kind: 'CANCEL', until: t };
  }
  throw paramErr('请选择取消时长（24h / sunday / custom / permanent）');
};

// 种子：一条人工定位、一条取消推荐（先于快照种子，榜单里能直接看到效果）
{
  const sd = todayStr();
  const ed = fmtDate(dayStartMs(sd) + 6 * DAY);
  newRule(110, 'foot_bath', '老板必做的爆款', 1, sd, ed, true, 0, false, null);
  blocks.push({
    id: nextBlockId++,
    tplId: 105,
    scope: 'foot_bath',
    kind: 'CANCEL',
    reason: '素材侵权待核实',
    batchId: null,
    createdBy: OPERATOR_ID,
    untilMs: now() + 2 * DAY,
  });
  for (const at of [now() - 60 * 60_000, now() - 30 * 60_000, now() - 3 * 60_000])
    makeSnapshot('SCHEDULED', null, at);
}

// =====================================================================
// 行业建议 / 搜索缺口
// =====================================================================
interface Sug extends IndustrySuggestion {}
const suggestions: Sug[] = (
  [
    ['宠物美容', 41, 33],
    ['汽修', 27, 22],
    ['健身房', 19, 17],
    ['花店', 12, 12],
    ['民宿', 8, 7],
    ['烘焙', 6, 6],
    ['瑜伽馆', 5, 4],
    ['摄影工作室', 3, 3],
  ] as [string, number, number][]
).map(([text, count, sids], i) => ({
  normText: text,
  text,
  count,
  sids,
  lastAt: fmt(now() - i * 9 * HOUR),
  status: 'NEW' as const,
  industryId: null,
  handledAt: null,
}));
const NO_TEXT_COUNT = 37;

const misses: SearchMiss[] = (
  [
    ['foot_bath', '艾灸', 58],
    ['foot_bath', '拔罐', 31],
    ['foot_bath', '刮痧', 12],
    ['apparel', '汉服', 44],
    ['apparel', '旗袍', 15],
    ['restaurant', '火锅', 23],
    ['restaurant', '烧烤', 19],
    ['beauty', '美甲', 17],
    ['beauty', '睫毛嫁接', 9],
    ['beauty', '纹绣', 6],
  ] as [string, string, number][]
).map(([code, term, count], i) => ({
  industryCode: code,
  normTerm: term,
  count: count + 20,
  firstDay: fmtDate(now() - (20 + i) * DAY),
  lastDay: fmtDate(now() - i * DAY),
  status: 'NEW' as const,
  handledAt: null,
}));

// =====================================================================
// 路由
// =====================================================================
type Handler = (m: RegExpMatchArray, q: Record<string, unknown>, body: unknown) => unknown;
const routes: { method: PlazaMethod; re: RegExp; fn: Handler }[] = [];
const on = (method: PlazaMethod, path: string, fn: Handler) =>
  routes.push({ method, re: new RegExp(`^${path}$`), fn });

// ---------------- 行业 ----------------
const publishedCountOf = (x: Ind) =>
  tpls.filter((t) => visibleNow(t) && idsOf(t).some((i) => descendants(x.id).includes(i))).length;

const treeNode = (x: Ind): IndustryNode => {
  const own = tpls.filter((t) => !t.deleted && idsOf(t).includes(x.id));
  const all =
    x.parentId === null
      ? tpls.filter((t) => !t.deleted && idsOf(t).some((i) => descendants(x.id).includes(i)))
      : own;
  const parent = x.parentId === null ? undefined : indById(x.parentId);
  return {
    id: x.id,
    parentId: x.parentId,
    code: x.code,
    name: x.name,
    iconUrl: x.iconUrl,
    coverUrl: x.coverUrl,
    hint: x.hint,
    audienceName: x.audienceName,
    examples: x.examples,
    nextActions: x.nextActions,
    enabled: x.enabled,
    showWhenEmpty: x.showWhenEmpty,
    sortOrder: x.sortOrder,
    templateCount: {
      total: all.length,
      published: all.filter((t) => visibleNow(t)).length,
      image: all.filter((t) => t.mediaType === 'image').length,
      video: all.filter((t) => t.mediaType === 'video').length,
    },
    userCount: x.userCount,
    replicate7d: all.reduce((s, t) => s + t.uses7d, 0) % 997,
    userVisible:
      x.enabled && (!parent || parent.enabled) && (x.showWhenEmpty || publishedCountOf(x) > 0),
    children: [],
  };
};

const tree = (): IndustryNode[] =>
  inds
    .filter((x) => x.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      ...treeNode(p),
      children: inds
        .filter((c) => c.parentId === p.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(treeNode),
    }));

type IndustryBody = IndustrySaveData & {
  coverUrl?: string | null;
  sortOrder?: number;
};

const strList = (name: string, v: unknown, max: number, maxRunes: number): string[] => {
  const out: string[] = [];
  for (const s of Array.isArray(v) ? v : []) {
    const x = str(s);
    if (!x) continue;
    if (runeLen(x) > maxRunes) throw paramErr(`${name}每条最多 ${maxRunes} 个字`);
    out.push(x);
  }
  if (out.length > max) throw paramErr(`${name}最多 ${max} 条`);
  return out;
};

/** 对应 applyIndustryFields：把入参合并进行业副本并校验，成功返回合并后的副本 */
const applyIndustry = (row: Ind, b: IndustryBody): Ind => {
  const r: Ind = clone(row);
  const nullStr = (v: unknown): string | null =>
    v === null || v === undefined ? null : str(v) || null;
  if (b.name !== undefined) r.name = str(b.name);
  if (!r.name || runeLen(r.name) > 32) throw paramErr('行业名称必填，最多 32 个字');
  if (b.iconUrl !== undefined) r.iconUrl = nullStr(b.iconUrl);
  if (b.coverUrl !== undefined) r.coverUrl = nullStr(b.coverUrl);
  if (b.hint !== undefined) r.hint = nullStr(b.hint);
  if (r.hint && runeLen(r.hint) > 120) throw paramErr('行业说明最多 120 个字');
  if (b.audienceName !== undefined) r.audienceName = nullStr(b.audienceName);
  if (r.audienceName && runeLen(r.audienceName) > 32) throw paramErr('人群称呼最多 32 个字');
  if (b.examples !== undefined) r.examples = strList('输入示例', b.examples, 5, 40);
  if (b.nextActions !== undefined) r.nextActions = strList('下一步建议', b.nextActions, 4, 20);
  if (b.sortOrder !== undefined) r.sortOrder = Number(b.sortOrder);
  if (b.enabled !== undefined) r.enabled = !!b.enabled;
  if (b.showWhenEmpty !== undefined) r.showWhenEmpty = !!b.showWhenEmpty;
  if (r.enabled && !r.hint) throw paramErr('启用的行业必须填写说明（行业门按钮下的副标题）');
  return r;
};

on('GET', '/industries', () => tree());

on('POST', '/industries', (_m, _q, body) => {
  const b = bodyOf<IndustryBody>(body);
  const code = str(b.code);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(code))
    throw paramErr('行业 code 只能是小写字母开头的字母、数字、下划线，长度 2~64');
  if (code.toLowerCase() === 'all')
    throw paramErr('ALL 是保留字，不能作为行业 code', 'INDUSTRY_CODE_DUPLICATE');
  const base: Ind = {
    id: 0,
    parentId: null,
    code,
    name: '',
    iconUrl: null,
    coverUrl: null,
    hint: null,
    audienceName: null,
    examples: [],
    nextActions: [],
    enabled: true,
    showWhenEmpty: false,
    sortOrder: 0,
    userCount: 0,
  };
  const row = applyIndustry(base, b);
  if (b.parentId !== undefined && b.parentId !== null) {
    const parent = indById(Number(b.parentId));
    if (!parent) throw paramErr('父行业不存在');
    if (parent.parentId !== null)
      throw paramErr('只支持两级行业，二级下面不能再建子级', 'INDUSTRY_DEPTH_EXCEEDED');
    row.parentId = parent.id;
  }
  if (inds.some((x) => x.code === code))
    throw conflictErr('行业 code 已存在', 'INDUSTRY_CODE_DUPLICATE');
  row.id = nextIndId++;
  if (b.sortOrder === undefined) {
    const siblings = inds.filter((x) => x.parentId === row.parentId);
    row.sortOrder = Math.max(0, ...siblings.map((s) => s.sortOrder)) + 10;
  }
  inds.push(row);
  return { id: row.id };
});

on('PUT', '/industries/sort', (_m, _q, body) => {
  const items = (Array.isArray(body) ? body : []) as IndustrySortItem[];
  if (!items.length) throw paramErr('排序项不能为空');
  const final = new Map<number, number>(inds.map((x) => [x.id, x.parentId ?? 0]));
  const seen = new Set<number>();
  for (const it of items) {
    if (!indById(it.id)) throw paramErr(`行业 ${it.id} 不存在`);
    if (seen.has(it.id)) throw paramErr('排序项里有重复的行业');
    seen.add(it.id);
    const p = it.parentId ?? 0;
    if (p === it.id) throw paramErr('行业不能挂在自己下面');
    final.set(it.id, p);
  }
  for (const [id, p] of final) {
    if (p === 0) continue;
    if (!final.has(p)) throw paramErr(`父行业 ${p} 不存在`);
    if ((final.get(p) ?? 0) !== 0)
      throw paramErr('只支持两级行业，不能挂到二级下面', 'INDUSTRY_DEPTH_EXCEEDED');
    for (const cp of final.values())
      if (cp === id) throw paramErr('有子级的一级行业不能降为二级', 'INDUSTRY_DEPTH_EXCEEDED');
  }
  for (const it of items) {
    const x = indById(it.id)!;
    x.parentId = it.parentId ?? null;
    x.sortOrder = it.sortOrder;
  }
  return null;
});

on('PUT', '/industries/(\\d+)', (m, _q, body) => {
  const b = bodyOf<IndustryBody>(body);
  const x = indById(Number(m[1]));
  if (b.code && x && str(b.code) !== x.code) throw paramErr('行业 code 创建后不可修改');
  if (!x) throw notFoundErr('行业不存在');
  const next = applyIndustry(x, b);
  const res: IndustryUpdateResult = {
    id: x.id,
    affectedTemplates: 0,
    affectedUsers: 0,
  };
  if (x.enabled && !next.enabled) {
    const ids = descendants(x.id);
    res.affectedTemplates = tpls.filter((t) => idsOf(t).some((i) => ids.includes(i))).length;
    res.affectedUsers = inds.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.userCount, 0);
  }
  Object.assign(x, next);
  return res;
});

on('DELETE', '/industries/(\\d+)', (m, q) => {
  const id = Number(m[1]);
  const src = indById(id);
  if (!src) throw notFoundErr('行业不存在');
  const kids = inds.filter((c) => c.parentId === id);
  const mine = tpls.filter((t) => id in t.industrySort);
  const target = num(q.reassignTo);
  if ((mine.length || kids.length) && !target)
    throw conflictErr('该行业下还有模板或子级，请选择迁移到哪个行业', 'INDUSTRY_HAS_TEMPLATES');
  if (target) {
    const tgt = indById(target);
    if (!tgt) throw paramErr('迁移目标行业不存在');
    if (tgt.id === src.id) throw paramErr('迁移目标不能是自己');
    const sameLevel = (src.parentId === null) === (tgt.parentId === null);
    if (!sameLevel && src.parentId !== tgt.id) throw paramErr('迁移目标必须是同级行业或其父级');
    if (kids.length && tgt.parentId !== null)
      throw paramErr('有子级的行业只能迁移到一级行业', 'INDUSTRY_DEPTH_EXCEEDED');
    for (const t of mine) {
      const v = t.industrySort[id];
      delete t.industrySort[id];
      if (!(target in t.industrySort)) t.industrySort[target] = v;
    }
    tgt.userCount += src.userCount;
    for (const c of kids) c.parentId = target;
  }
  inds.splice(inds.indexOf(src), 1);
  return null;
});

// ---------------- 模板 ----------------
const checkIndustryIds = (ids: unknown): number[] => {
  const list = dedupeNums(ids);
  if (list.some((i) => !indById(i)))
    throw notFoundErr('有行业不存在或已删除', 'INDUSTRY_NOT_FOUND');
  return list;
};

type TemplateBody = PlazaTemplateSaveData & { slots?: unknown };

/** 对应 validatePayload：已知键的形状与长度（其余键放行） */
const validatePayload = (p: Record<string, unknown>) => {
  for (const key of ['result', 'image_urls']) {
    const v = p[key];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) throw paramErr(`payload.${key} 必须是地址数组`);
    if (v.length > 20) throw paramErr(`payload.${key} 最多 20 张`);
    v.forEach((x, i) => {
      if (typeof x !== 'string' || !/^https?:\/\//i.test(x) || x.length > 1000)
        throw paramErr(`payload.${key}[${i}] 必须是 http(s) 地址`);
    });
  }
  const limits: Record<string, number> = { description: 1000, guidance: 1000, prompt: 8000 };
  for (const [key, max] of Object.entries(limits)) {
    const v = p[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') throw paramErr(`payload.${key} 必须是文本`);
    if (runeLen(v) > max) throw paramErr(`payload.${key} 最多 ${max} 个字`);
  }
};

/** 对应 validateTemplateInput（不碰库） */
const validateTemplateBody = (b: TemplateBody, cur?: Tpl) => {
  const title = str(b.title);
  if (!title || runeLen(title) > 255) throw paramErr('标题必填，最多 255 个字');
  if (b.description !== undefined && runeLen(str(b.description)) > 1000)
    throw paramErr('说明最多 1000 个字');
  if (b.category !== undefined && runeLen(str(b.category)) > 64) throw paramErr('分类最多 64 个字');
  const mediaType = b.mediaType ?? cur?.mediaType ?? 'image';
  if (mediaType !== 'image' && mediaType !== 'video')
    throw paramErr('mediaType 只能是 image 或 video');
  const videoUrl = b.videoUrl !== undefined ? str(b.videoUrl) : (cur?.videoUrl ?? '');
  if (mediaType === 'video' && !videoUrl) throw paramErr('视频模板必须填写预览视频');
  const slots = 'slots' in b ? parseSlotSchema(b.slots) : undefined;
  if (b.payload !== undefined && b.payload !== null && !isObj(b.payload))
    throw paramErr('payload 必须是 JSON 对象');
  const skill = b.agentSkillId;
  if (skill !== undefined && skill !== null && skill !== '' && !/^\d+$/.test(String(skill)))
    throw paramErr('agentSkillId 必须是数字 id（字符串）');
  if (skill && !MOCK_SKILLS.some((x) => x.agentSkillId === String(skill)))
    throw notFoundErr(`技能不存在（agentSkillId=${String(skill)}）`);
  if (b.payload && isObj(b.payload)) validatePayload(b.payload);
  const isUrl = (x: string) => /^https?:\/\//i.test(x) && x.length <= 1000;
  if (videoUrl && !isUrl(videoUrl))
    throw paramErr('videoUrl 必须是 http(s) 地址（最长 1000 字符）');
  if (b.posterUrl && !isUrl(str(b.posterUrl)))
    throw paramErr('posterUrl 必须是 http(s) 地址（最长 1000 字符）');
  if (Array.isArray(b.tags)) {
    if (b.tags.length > 20) throw paramErr('标签最多 20 个');
    if (b.tags.some((x) => runeLen(String(x).trim()) > 32)) throw paramErr('单个标签最多 32 个字');
  }
  if (
    b.mediaStatus !== undefined &&
    b.mediaStatus !== 'READY' &&
    b.mediaStatus !== 'PENDING' &&
    b.mediaStatus !== 'PROCESSING'
  )
    throw paramErr('mediaStatus 只能是 READY、PENDING 或 PROCESSING');
  return { title, mediaType, videoUrl, slots };
};

/** 演示用的后台处理任务：约 2.5 秒后完成；视频地址含 fail 的模拟失败（对应真实流水线重试 3 次后 FAILED） */
const queueMockMedia = (t: Tpl) => {
  t.mediaStatus = 'PROCESSING';
  t.mediaError = null;
  t.mediaNote = null;
  t.mediaAttempts = 0;
  const url = t.videoUrl;
  setTimeout(() => {
    if (t.mediaStatus !== 'PROCESSING' || t.videoUrl !== url) return; // 期间换了视频 / 重新排队：旧结果作废
    t.revision += 1;
    if (url?.includes('fail')) {
      t.mediaStatus = 'FAILED';
      t.mediaError = '视频无法解码: Invalid data found when processing input';
      t.mediaAttempts = 3;
      return;
    }
    t.mediaStatus = 'READY';
    t.mediaAttempts = 1;
    t.mediaNote = '未转码：没有转码能力（未配置 FFmpeg），视频沿用上传时的编码';
    if (!t.posterUrl) t.posterUrl = coverOf(t) || 'https://picsum.photos/seed/auto/240/320';
  }, 2500);
};

const applyTemplateBody = (t: Tpl, b: TemplateBody, v: ReturnType<typeof validateTemplateBody>) => {
  const prevVideo = t.videoUrl;
  const prevPoster = t.posterUrl;
  const prevType = t.mediaType;
  t.title = v.title;
  t.mediaType = v.mediaType;
  t.videoUrl = v.mediaType === 'video' ? v.videoUrl || null : null;
  if (b.posterUrl !== undefined) t.posterUrl = str(b.posterUrl) || null;
  if (b.description !== undefined) t.description = str(b.description);
  if (b.category !== undefined) t.category = str(b.category);
  if (b.tags !== undefined) t.tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
  if (b.payload !== undefined && b.payload !== null) t.payload = clone(b.payload);
  if (b.agentSkillId !== undefined) t.agentSkillId = b.agentSkillId ? String(b.agentSkillId) : null;
  if (b.channels !== undefined) t.channels = b.channels ?? null;
  if (v.slots !== undefined) t.slots = v.slots;
  if (b.needsProductImage !== undefined) t.needsProductImage = !!b.needsProductImage;
  if (b.textOverlay !== undefined) t.textOverlay = !!b.textOverlay;
  if (b.sortOrder !== undefined) t.sortOrder = Number(b.sortOrder);
  // 与后端一致：处理状态由「视频地址是否变化」决定，请求里的 mediaStatus 被忽略
  if (t.mediaType !== 'video' || !t.videoUrl) {
    if (t.mediaStatus !== 'READY') {
      t.mediaStatus = 'READY';
      t.mediaError = null;
      t.mediaNote = null;
      t.mediaAttempts = 0;
    }
  } else if (t.videoUrl !== prevVideo || prevType !== 'video') {
    queueMockMedia(t);
  } else if (t.mediaStatus === 'FAILED' && t.posterUrl && t.posterUrl !== prevPoster) {
    queueMockMedia(t); // 运营补了封面：重新排队
  }
};

/** 乐观并发：带 revision 只按它比对，否则比 updatedAt（秒级）；与 api-plaza.md 一致 */
const checkRevision = (
  t: Tpl,
  b: { revision?: number; updatedAt?: string },
  reason: 'CONFLICT' | 'TEMPLATE_CONFLICT',
) => {
  if (b.revision !== undefined && b.revision !== null) {
    if (Number(b.revision) !== t.revision) throw conflictErr('他人已修改，刷新后再试', reason);
    return;
  }
  const want = parseAdminTime(b.updatedAt);
  if (want !== null && Math.floor(want / 1000) !== Math.floor(ms(t.updateTime) / 1000))
    throw conflictErr('他人已修改，刷新后再试', reason);
};

const setIndustries = (t: Tpl, ids: number[]) => {
  for (const k of idsOf(t)) if (!ids.includes(k)) delete t.industrySort[k];
  for (const i of ids) attachIndustry(t, i);
};

on('GET', '/templates/trash', (_m, q) => {
  const { page, size } = normPage(q);
  const l = tpls
    .filter((t) => t.deleted)
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '') || b.id - a.id);
  const out: PlazaTemplatePage = {
    total: l.length,
    page,
    size,
    unassignedCount: 0,
    items: slicePage(l, page, size).map((t) => rowOf(t)),
  };
  return out;
});

on('GET', '/templates', (_m, q) => {
  const { page, size } = normPage(q);
  const mediaType = str(q.mediaType);
  if (mediaType && mediaType !== 'image' && mediaType !== 'video')
    throw paramErr('mediaType 只能是 image 或 video');
  const sortKey = str(q.sort) || 'sortOrder';
  const industryId = num(q.industryId);
  if (sortKey === 'industryOrder' && !industryId) throw paramErr('行业内顺序需要先选择行业');
  const state = str(q.state).toUpperCase();
  const states = ['', 'DELETED', 'DRAFT', 'OFFLINE', 'SCHEDULED', 'EXPIRED', 'PUBLISHED'];
  if (!states.includes(state)) throw paramErr(`state 不合法：${str(q.state)}`);
  if (!['sortOrder', 'updatedAt', 'createdAt', 'uses7d', 'industryOrder'].includes(sortKey))
    throw paramErr(`sort 不合法：${sortKey}`);
  const kw = str(q.keyword);
  const createdBy = num(q.createdBy);
  const ids = industryId ? (bool(q.includeChildren) ? descendants(industryId) : [industryId]) : [];
  const timeFilters: [string | null | undefined, (t: Tpl) => string | null, 'ge' | 'lt'][] = [];
  const addTime = (key: string, pick: (t: Tpl) => string | null, op: 'ge' | 'lt') => {
    const v = parseAdminTime(q[key]);
    if (v !== null) timeFilters.push([String(v), pick, op]);
  };
  addTime('onlineFrom', (t) => t.onlineAt, 'ge');
  addTime('onlineTo', (t) => t.onlineAt, 'lt');
  addTime('offlineFrom', (t) => t.offlineAt, 'ge');
  addTime('offlineTo', (t) => t.offlineAt, 'lt');

  const stateMatch = (t: Tpl): boolean => {
    if (state === 'DELETED') return t.deleted;
    if (t.deleted) return false;
    const cur = now();
    switch (state) {
      case '':
        return true;
      case 'DRAFT':
      case 'OFFLINE':
        return t.state === state;
      case 'SCHEDULED':
        return t.state === 'PUBLISHED' && !!t.onlineAt && ms(t.onlineAt) > cur;
      case 'EXPIRED':
        return t.state === 'PUBLISHED' && !!t.offlineAt && ms(t.offlineAt) <= cur;
      default:
        return visibleNow(t, cur);
    }
  };
  const l = tpls.filter(
    (t) =>
      stateMatch(t) &&
      (!kw || t.title.includes(kw) || t.description.includes(kw)) &&
      (!mediaType || t.mediaType === mediaType) &&
      (!createdBy || t.createdBy === createdBy) &&
      (!industryId || idsOf(t).some((i) => ids.includes(i))) &&
      (!bool(q.unassigned) || idsOf(t).length === 0) &&
      timeFilters.every(([v, pick, op]) => {
        const cell = pick(t);
        if (cell === null) return false;
        return op === 'ge' ? ms(cell) >= Number(v) : ms(cell) < Number(v);
      }),
  );
  const desc = str(q.order).toLowerCase() !== 'asc';
  const val = (t: Tpl): number | string =>
    sortKey === 'updatedAt'
      ? t.updateTime
      : sortKey === 'createdAt'
        ? t.createTime
        : sortKey === 'uses7d'
          ? t.uses7d
          : sortKey === 'industryOrder'
            ? (t.industrySort[industryId] ?? 0)
            : t.sortOrder;
  l.sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === vb) return b.id - a.id;
    // industryOrder / uses7d 在 Go 里走内存排序，降序 = 反过来；其余走 SQL ORDER BY，同样升降
    return (va < vb ? -1 : 1) * (desc ? -1 : 1);
  });
  const out: PlazaTemplatePage = {
    total: l.length,
    page,
    size,
    unassignedCount: tpls.filter((t) => !t.deleted && idsOf(t).length === 0).length,
    items: slicePage(l, page, size).map((t) =>
      rowOf(t, sortKey === 'industryOrder' ? industryId : 0),
    ),
  };
  return out;
});

on('POST', '/templates', (_m, _q, body) => {
  const b = bodyOf<TemplateBody>(body);
  const v = validateTemplateBody(b);
  const indIds = b.industryIds !== undefined ? checkIndustryIds(b.industryIds) : [];
  const t: Tpl = {
    id: nextTplId++,
    revision: 1,
    title: v.title,
    description: '',
    category: '',
    tags: [],
    mediaType: 'image',
    payload: { result: [] },
    agentSkillId: null,
    videoUrl: null,
    posterUrl: null,
    channels: null,
    slots: null,
    textOverlay: false,
    mediaStatus: 'READY',
    needsProductImage: false,
    state: 'DRAFT',
    onlineAt: null,
    offlineAt: null,
    sortOrder: Math.max(0, ...tpls.filter((x) => !x.deleted).map((x) => x.sortOrder)) + 10,
    industrySort: {},
    uses7d: 0,
    prevUses: 0,
    createdBy: OPERATOR_ID,
    createTime: fmt(now()),
    updateTime: fmt(now()),
    deleted: false,
    deletedAt: null,
  };
  applyTemplateBody(t, b, v);
  setIndustries(t, indIds);
  tpls.push(t);
  recordAudit(t, 'TEMPLATE_CREATE', null);
  return { id: t.id };
});

/** 批量 / 单个发布共用：返回 {id,state,warnings} */
const publishTpl = (
  id: number,
  inp: { onlineAt?: unknown; offlineAt?: unknown; force?: unknown },
): PublishResult => {
  const onAt = parseAdminTime(inp.onlineAt);
  const offAt = parseAdminTime(inp.offlineAt);
  const t = liveTpl(id);
  if (!t.title.trim()) throw paramErr('发布需要标题');
  if (!firstResult(t)) throw paramErr('发布需要至少一张效果图');
  if (t.mediaType === 'video') {
    if (!t.videoUrl) throw paramErr('视频模板必须填写预览视频');
    if (t.mediaStatus === 'FAILED')
      throw paramErr(
        `视频处理失败${t.mediaError ? `（${t.mediaError}）` : ''}，请点「重新处理」或更换视频后再发布`,
      );
    if (t.mediaStatus !== 'READY')
      throw paramErr('视频还在处理中（抽封面 / 转码），处理完成后才能发布');
  }
  if (onAt !== null && offAt !== null && offAt <= onAt) throw paramErr('下线时间必须晚于上线时间');
  const warnings: string[] = [];
  if (!idsOf(t).length) {
    if (!bool(inp.force)) throw paramErr('发布前请先绑定行业（没有行业的模板用户端看不到）');
    warnings.push('没有绑定行业：已发布，但用户端暂不可见');
  }
  const before = auditSnap(t);
  t.state = 'PUBLISHED';
  t.onlineAt = onAt === null ? null : fmt(onAt);
  t.offlineAt = offAt === null ? null : fmt(offAt);
  touch(t);
  recordAudit(t, 'TEMPLATE_PUBLISH', before);
  return { id: t.id, state: 'PUBLISHED', warnings };
};
const offlineTpl = (id: number) => {
  const t = liveTpl(id);
  const before = auditSnap(t);
  t.state = 'OFFLINE';
  touch(t);
  recordAudit(t, 'TEMPLATE_OFFLINE', before);
};
const deleteTpl = (id: number) => {
  const t = liveTpl(id);
  t.deleted = true;
  t.deletedAt = fmt(now());
  touch(t);
};
const restoreTpl = (id: number) => {
  const t = tplById(id);
  if (!t) throw notFoundErr('模板不存在', 'TEMPLATE_NOT_FOUND');
  if (!t.deleted) throw paramErr('模板不在回收站里');
  t.deleted = false;
  t.deletedAt = null;
  t.state = 'OFFLINE';
  touch(t);
};

on('POST', '/templates/batch/([A-Za-z]+)', (m, _q, body) => {
  const action = m[1] as string;
  const b = bodyOf<{
    ids?: number[];
    industryIds?: number[];
    onlineAt?: string;
    offlineAt?: string;
    force?: boolean;
  }>(body);
  const actions = [
    'publish',
    'offline',
    'delete',
    'restore',
    'assign',
    'unassign',
    'replaceIndustries',
    'setOrder',
  ];
  if (!actions.includes(action)) throw paramErr(`不支持的批量动作：${action}`);
  const ids = dedupeNums(b.ids);
  if (!ids.length || ids.length > 200) throw paramErr('ids 需要 1~200 个');
  const indIds = dedupeNums(b.industryIds);
  const needInd = ['assign', 'unassign', 'replaceIndustries', 'setOrder'].includes(action);
  if (needInd && !indIds.length && action !== 'replaceIndustries')
    throw paramErr('需要 industryIds');
  if (action === 'setOrder' && indIds.length !== 1) throw paramErr('置顶需要指定且仅指定一个行业');
  const res: TemplateBatchResult = { batchId: uuid(), ok: [], failed: [] };
  for (const id of ids) {
    try {
      if (action === 'publish') publishTpl(id, b);
      else if (action === 'offline') offlineTpl(id);
      else if (action === 'delete') deleteTpl(id);
      else if (action === 'restore') restoreTpl(id);
      else {
        const t = liveTpl(id);
        const inds2 = checkIndustryIds(indIds);
        if (action === 'assign') for (const i of inds2) attachIndustry(t, i);
        else if (action === 'unassign') for (const i of inds2) delete t.industrySort[i];
        else if (action === 'replaceIndustries') setIndustries(t, inds2);
        else {
          const ind = inds2[0];
          const min = minIndustrySort(ind);
          attachIndustry(t, ind);
          t.industrySort[ind] = min - 10;
        }
        touch(t);
      }
      res.ok.push(id);
    } catch (e) {
      if (!(e instanceof GoError)) throw e;
      res.failed.push({ id, reason: e.message });
    }
  }
  return res;
});

on('GET', '/templates/(\\d+)', (m) => {
  const t = tplById(Number(m[1]));
  if (!t) throw notFoundErr('模板不存在', 'TEMPLATE_NOT_FOUND');
  return detailOf(t);
});

on('PUT', '/templates/(\\d+)', (m, _q, body): TemplateWriteResult => {
  const id = Number(m[1]);
  const b = bodyOf<TemplateBody>(body);
  const cur = tplById(id);
  const v = validateTemplateBody(b, cur && !cur.deleted ? cur : undefined);
  const t = liveTpl(id);
  checkRevision(t, b, 'TEMPLATE_CONFLICT');
  const indIds = b.industryIds !== undefined ? checkIndustryIds(b.industryIds) : undefined;
  const before = auditSnap(t);
  applyTemplateBody(t, b, v);
  if (indIds) setIndustries(t, indIds);
  touch(t);
  recordAudit(t, 'TEMPLATE_UPDATE', before);
  return { id: t.id, updatedAt: t.updateTime, revision: t.revision };
});

on('POST', '/templates/(\\d+)/reprocess-media', (m): TemplateWriteResult => {
  const t = liveTpl(Number(m[1]));
  if (t.mediaType !== 'video' || !t.videoUrl) throw paramErr('只有带预览视频的视频模板才需要处理');
  if (t.mediaStatus === 'PROCESSING') throw paramErr('视频正在处理中，请稍后再看结果');
  const before = auditSnap(t);
  queueMockMedia(t);
  touch(t);
  recordAudit(t, 'TEMPLATE_MEDIA_REPROCESS', before);
  return { id: t.id, updatedAt: t.updateTime, revision: t.revision };
});

on('PUT', '/templates/(\\d+)/slots', (m, _q, body) => {
  const id = Number(m[1]);
  const b = bodyOf<{ slots?: unknown; updatedAt?: string; revision?: number }>(body);
  const slots = parseSlotSchema(b.slots);
  const t = liveTpl(id);
  if (isHandover() && (b.revision === undefined || b.revision === null))
    throw new GoError(1002, 'PARAM_MISSING', '交接期修改入参需要 revision（带上读到的 revision）');
  checkRevision(t, b, 'CONFLICT');
  t.slots = slots;
  touch(t);
  const out: SaveSlotsResult = {
    id: t.id,
    slots: t.slots,
    updatedAt: t.updateTime,
    revision: t.revision,
  };
  return out;
});

on('POST', '/templates/(\\d+)/publish', (m, _q, body) =>
  publishTpl(
    Number(m[1]),
    bodyOf<{ onlineAt?: string; offlineAt?: string; force?: boolean }>(body),
  ),
);
on('POST', '/templates/(\\d+)/offline', (m) => {
  offlineTpl(Number(m[1]));
  return null;
});
on('POST', '/templates/(\\d+)/duplicate', (m) => {
  const src = liveTpl(Number(m[1]));
  const title = Array.from(src.title).slice(0, 251).join('');
  const copy: Tpl = {
    ...clone(src),
    id: nextTplId++,
    revision: 1,
    title: `${title}（副本）`,
    state: 'DRAFT',
    onlineAt: null,
    offlineAt: null,
    sortOrder: Math.max(0, ...tpls.filter((x) => !x.deleted).map((x) => x.sortOrder)) + 10,
    uses7d: 0,
    prevUses: 0,
    createdBy: OPERATOR_ID,
    createTime: fmt(now()),
    updateTime: fmt(now()),
    deleted: false,
    deletedAt: null,
  };
  copy.industrySort = {};
  for (const i of idsOf(src)) attachIndustry(copy, i);
  tpls.push(copy);
  return { id: copy.id };
});
on('DELETE', '/templates/(\\d+)', (m) => {
  deleteTpl(Number(m[1]));
  return null;
});
on('POST', '/templates/(\\d+)/restore', (m) => {
  restoreTpl(Number(m[1]));
  return null;
});
on('DELETE', '/templates/(\\d+)/purge', (m) => {
  const i = tpls.findIndex((t) => t.id === Number(m[1]));
  if (i < 0) throw notFoundErr('模板不存在', 'TEMPLATE_NOT_FOUND');
  if (!tpls[i].deleted) throw paramErr('只能彻底删除回收站里的模板');
  tpls.splice(i, 1);
  return null;
});

on('GET', '/preview/templates', (_m, q) => {
  const code = str(q.industry);
  if (!code) throw new GoError(1002, 'PARAM_MISSING', '请先选择行业');
  const mediaType = str(q.mediaType);
  if (mediaType && mediaType !== 'image' && mediaType !== 'video')
    throw paramErr('mediaType 只能是 image 或 video');
  const page = Math.max(1, num(q.page) || 1);
  let size = num(q.size);
  if (size < 1) size = 24;
  if (size > 100) size = 100;
  const at = parseAdminTime(q.asOf) ?? now();
  const kw = str(q.keyword);
  const gone = () => notFoundErr('这个行业已调整，请重新选择', 'INDUSTRY_NOT_FOUND');
  const ind = indByCode(code);
  if (!ind || !ind.enabled || ind.parentId !== null) throw gone();
  const subCode = str(q.subIndustry);
  const sub = subCode ? indByCode(subCode) : undefined;
  if (subCode && (!sub || sub.parentId !== ind.id || !sub.enabled)) throw gone();
  const ids = sub ? [sub.id] : descendants(ind.id);
  const includeDraft = bool(q.includeDraft);
  const minUses = cfg.global['display-min-uses'];
  const l = tpls
    .filter(
      (t) =>
        !t.deleted &&
        idsOf(t).some((i) => ids.includes(i)) &&
        (!mediaType || t.mediaType === mediaType) &&
        (!kw || t.title.includes(kw)) &&
        (includeDraft || visibleNow(t, at)),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id);
  const data: PreviewTemplateItem[] = slicePage(l, page, size).map((t) => ({
    plazaTemplateId: t.id,
    title: t.title,
    agentSkillId: t.agentSkillId,
    tags: t.tags,
    payload: t.payload,
    authorName: '官方',
    usageCount: t.uses7d >= minUses ? t.uses7d : null,
    usageVisible: t.uses7d >= minUses,
    mediaType: t.mediaType,
    videoUrl: t.videoUrl,
    posterUrl: t.posterUrl,
    coverThumbUrl: coverOf(t),
    isNew: at - ms(t.createTime) <= cfg.global['fresh-days'] * DAY,
    createdAt: t.createTime,
    needsProductImage: t.needsProductImage,
    targetChannels: channelsOf(t),
    industries: refsOf(t),
    state: t.state,
    userVisible: visibleNow(t, at),
  }));
  const out: PreviewTemplatesPage = {
    current: page,
    pages: Math.ceil(l.length / size),
    total: l.length,
    asOf: fmt(at),
    data,
  };
  return out;
});

// ---------------- 头条 ----------------
const needSnap = (): Snap => {
  const s = latestSnap();
  if (!s) throw notFoundErr('还没有生成过榜单，请先立即刷新', 'HEADLINE_SNAPSHOT_EXPIRED');
  return s;
};

on('GET', '/headlines/scopes', () => {
  const snap = latestSnap();
  const row = (
    code: string,
    name: string,
    parentCode: string | undefined,
  ): HeadlineScopeSummary => {
    const b = snap?.boards[code];
    const s: HeadlineScopeSummary = {
      scope: code,
      name,
      memberCount:
        code === 'ALL'
          ? tpls.filter((t) => inCatalog(t)).length
          : tpls.filter((t) => inCatalog(t) && inScope(t, code)).length,
      itemCount: b?.items.length ?? 0,
      auto: b?.stats.auto ?? 0,
      manual: b?.stats.manual ?? 0,
      fill: b?.stats.fill ?? 0,
      coldStart: (b?.stats.fill ?? 0) > 0,
      computed: !!b,
    };
    if (parentCode) s.parentCode = parentCode;
    return s;
  };
  const out: HeadlineScopesView = {
    snapshot: snap ? snapMeta(snap, false) : null,
    scopes: [
      row('ALL', '全站总榜', undefined),
      ...scopeList().map((s) => row(s.code, s.name, s.parentCode)),
    ],
  };
  return out;
});

on('GET', '/headlines/current', (_m, q) => boardView(needSnap(), str(q.scope) || 'ALL'));

on('GET', '/headlines/snapshots', (_m, q) => {
  const { page, size } = normPage(q);
  const all = [...snaps].reverse();
  const out: HeadlinePage<HeadlineSnapshotMeta> = {
    total: all.length,
    list: slicePage(all, page, size).map((s) => snapMeta(s, false)),
  };
  return out;
});

on('GET', '/headlines/snapshots/at', (_m, q) => {
  const at = parseAt(q.time);
  const snap = [...snaps].reverse().find((s) => s.computedMs <= at);
  if (!snap) throw snapshotExpired();
  return boardView(snap, str(q.scope) || 'ALL');
});

on('GET', '/headlines/snapshots/(\\d+)', (m, q) => {
  const snap = snaps.find((s) => s.version === Number(m[1]));
  if (!snap) throw snapshotExpired();
  return boardView(snap, str(q.scope) || 'ALL');
});

on('GET', '/headlines/compare', (_m, q) => {
  const scopes = dedupeStrs(String(q.scopes ?? '').split(','));
  if (!scopes.length || scopes.length > 4) throw paramErr('scopes 需要 1~4 个范围');
  const atRaw = str(q.at);
  let snap: Snap | undefined;
  if (atRaw) {
    const at = parseAt(atRaw);
    snap = [...snaps].reverse().find((s) => s.computedMs <= at);
  } else snap = latestSnap();
  if (!snap) throw snapshotExpired();
  const lists: Record<string, HeadlineAlgoItem[]> = {};
  const byTpl = new Map<number, HeadlineCompareView['rows'][number]>();
  for (const sc of scopes) {
    const items = snap.boards[sc]?.items;
    if (!items) continue;
    lists[sc] = items.map((i) => {
      const { scoreDetail: _drop, ...rest } = i;
      void _drop;
      return rest;
    });
    for (const it of items) {
      let row = byTpl.get(it.plazaTemplateId);
      if (!row) {
        const t = tplById(it.plazaTemplateId);
        row = {
          template: briefOf(it.plazaTemplateId),
          cells: Object.fromEntries(scopes.map((s) => [s, null])),
          memberOf: t ? scopesOfTpl(t) : [],
        };
        byTpl.set(it.plazaTemplateId, row);
      }
      const cell: HeadlineCompareCell = {
        rank: it.rank,
        source: it.source,
        score: it.score,
        uses7d: it.uses7d,
      };
      row.cells[sc] = cell;
    }
  }
  const best = (r: HeadlineCompareView['rows'][number]) =>
    Math.min(...Object.values(r.cells).map((c) => c?.rank ?? 1 << 30));
  const out: HeadlineCompareView = {
    snapshot: snapMeta(snap, false),
    scopes,
    rows: [...byTpl.values()].sort((a, b) => best(a) - best(b)),
    lists,
  };
  return out;
});

on('GET', '/headlines/templates/(\\d+)/headline-status', (m) => {
  const t = tplById(Number(m[1]));
  if (!t || !inCatalog(t)) throw notFoundErr('模板不存在', 'HEADLINE_TEMPLATE_NOT_FOUND');
  return templateStatusOf(t);
});

on('POST', '/headlines/refresh', () => {
  const prev = latestSnap();
  const snap = makeSnapshot('REFRESH_NOW', OPERATOR_ID);
  const diff: Record<string, HeadlineDiff> = {};
  for (const [code, b] of Object.entries(snap.boards)) {
    const d = diffOf(prev?.boards[code]?.items ?? [], b.items);
    if (d.enter.length || d.exit.length || d.moved.length) diff[code] = d;
  }
  const out: HeadlineRefreshResult = {
    version: snap.version,
    refreshed: true,
    diff,
  };
  return out;
});

/** 试算的参数覆盖：叠加在当前参数上（global 逐键合并、嵌套对象同理，overrides 按范围整条替换） */
const mergeObj = (target: Record<string, unknown>, patch: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(patch)) {
    if (isObj(v) && isObj(target[k])) mergeObj(target[k] as Record<string, unknown>, v);
    else target[k] = v;
  }
};

on('POST', '/headlines/preview', (_m, _q, body) => {
  const b = bodyOf<{
    scope?: string;
    paramsOverride?: {
      global?: Partial<HeadlineParamValues>;
      overrides?: Record<string, HeadlineOverride>;
    };
  }>(body);
  const scope = str(b.scope) || 'ALL';
  const merged = clone(cfg);
  if (b.paramsOverride) {
    if (!isObj(b.paramsOverride)) throw paramErr('paramsOverride 非法：不是对象');
    if (b.paramsOverride.global)
      mergeObj(
        merged.global as unknown as Record<string, unknown>,
        b.paramsOverride.global as Record<string, unknown>,
      );
    for (const [k, v] of Object.entries(b.paramsOverride.overrides ?? {})) merged.overrides[k] = v;
  }
  const snap = latestSnap();
  const base = snap?.boards[scope]?.items ?? [];
  const board = computeScope(scope, merged, base, now());
  const out: HeadlinePreviewResult = {
    scope,
    paramsHash: hashOf(JSON.stringify(canonical(merged))),
    items: board.items,
    stats: board.stats,
    diff: diffOf(base, board.items),
    baseVersion: snap?.version ?? 0,
  };
  return out;
});

on('GET', '/headlines/params', (_m, q) => {
  const scope = str(q.scope);
  const out: HeadlineParamsView = {
    defaults: clone(DEFAULT_PARAMS),
    current: clone(canonical(cfg)),
    version: paramsVersion,
    hash: hashOf(JSON.stringify(canonical(cfg))),
    meta: PARAM_META,
    industries: scopeList().map((s) => s.code),
  };
  if (scope) out.effective = paramsFor(cfg, scope);
  return out;
});

on('PUT', '/headlines/params', (_m, _q, body) => {
  const b = bodyOf<{ config?: HeadlineConfig; version?: number }>(body);
  const config = bodyOf<HeadlineConfig>(b.config);
  config.overrides = isObj(config.overrides) ? config.overrides : {};
  const errs = validateConfig(config, new Set(scopeList().map((s) => s.code)));
  if (errs.length)
    throw new GoError(
      1003,
      'HEADLINE_PARAMS_INVALID',
      `参数不合法：${errs.map((e) => `${e.field}: ${e.reason}`).join('; ')}`,
      { fields: errs },
    );
  if (Number(b.version) !== paramsVersion)
    throw conflictErr('参数已被他人修改，请刷新后再改', 'HEADLINE_PARAMS_CONFLICT');
  cfg = clone(canonical(config));
  paramsVersion += 1;
  return afterWrite([1]);
});

on('GET', '/headlines/rules', (_m, q) => {
  const { page, size } = normPage(q);
  const scope = str(q.scope);
  const tplId = num(q.plazaTemplateId);
  const phase = str(q.phase);
  const l = rules
    .map(ruleViewOf)
    .filter(
      (r) =>
        (!scope || r.scope === scope) &&
        (!tplId || r.plazaTemplateId === tplId) &&
        (!phase || r.phase === phase),
    )
    .sort((a, b) => b.id - a.id);
  const out: HeadlinePage<HeadlineRule> = {
    total: l.length,
    list: slicePage(l, page, size),
  };
  return out;
});

on('POST', '/headlines/rules', (_m, _q, body) => {
  const b = bodyOf<HeadlineRuleRequest>(body);
  const t = tplById(num(b.plazaTemplateId));
  if (!t || !inCatalog(t) || !visibleNow(t)) throw errTemplateAbsent();
  const why = checkWhy(b.why);
  const pin = checkPin(b.pinPosition);
  const { sd, ed } = dateWindow(b.startDate, b.endDate);
  const scopes = resolveScopes(t, b.scopes, false);
  const enabled = b.enabled === undefined || !!b.enabled;
  for (const sc of scopes) {
    if (suppressedIn(t.id, sc)) throw errSuppressed(scopeName(sc));
    if (enabled && overlaps(t.id, sc, sd, ed, new Set())) throw errDuplicate(scopeName(sc));
  }
  const batchId = scopes.length > 1 ? uuid() : null;
  const ids = scopes.map(
    (sc) =>
      newRule(t.id, sc, why, pin, sd, ed, enabled, Number(b.sortOrder ?? 0), false, batchId).id,
  );
  return afterWrite(ids, batchId ?? undefined);
});

on('PUT', '/headlines/rules/(\\d+)', (m, _q, body) => {
  const b = bodyOf<HeadlineRuleUpdate>(body);
  const why = checkWhy(b.why);
  const pin = checkPin(b.pinPosition);
  const { sd, ed } = dateWindow(b.startDate, b.endDate);
  const enabled = !(b.enabled === false);
  const targets = ruleTargets(Number(m[1]), !!b.applyToBatch);
  const except = new Set(targets.map((r) => r.id));
  for (const r of targets) {
    if (enabled && overlaps(r.tplId, r.scope, sd, ed, except))
      throw errDuplicate(scopeName(r.scope));
    if (enabled && suppressedIn(r.tplId, r.scope)) throw errSuppressed(scopeName(r.scope));
  }
  for (const r of targets) {
    r.why = why;
    r.startDate = sd;
    r.endDate = ed;
    r.enabled = enabled ? 1 : 0;
    r.sortOrder = Number(b.sortOrder ?? 0);
    r.pinPosition = pin;
    r.updatedBy = OPERATOR_ID;
  }
  return afterWrite(targets.map((r) => r.id));
});

on('DELETE', '/headlines/rules/(\\d+)', (m, q) => {
  const targets = ruleTargets(Number(m[1]), bool(q.applyToBatch));
  for (const r of targets) rules.splice(rules.indexOf(r), 1);
  return afterWrite(targets.map((r) => r.id));
});

on('POST', '/headlines/position', (_m, _q, body) => {
  const b = bodyOf<{
    plazaTemplateId?: number;
    scope?: string;
    position?: number | null;
  }>(body);
  const pin = checkPin(b.position);
  return adoptOrUpdate(num(b.plazaTemplateId), str(b.scope), (r) => {
    r.pinPosition = pin;
  });
});

on('POST', '/headlines/why', (_m, _q, body) => {
  const b = bodyOf<{ plazaTemplateId?: number; scope?: string; why?: string }>(body);
  const why = checkWhy(b.why);
  return adoptOrUpdate(num(b.plazaTemplateId), str(b.scope), (r) => {
    r.why = why;
  });
});

on('POST', '/headlines/suppress', (_m, _q, body) => {
  const b = bodyOf<HeadlineSuppressRequest>(body);
  const t = tplById(num(b.plazaTemplateId));
  if (!t || !inCatalog(t)) throw errTemplateAbsent();
  const reason = str(b.reason);
  if (!reason) throw paramErr('请填写原因');
  if (runeLen(reason) > 200) throw paramErr('原因最多 200 字');
  const { kind, until } = suppressWindow(b);
  const scopes = resolveScopes(t, b.scopes, !!b.alsoParent);
  const batchId = scopes.length > 1 ? uuid() : null;
  const ids: number[] = [];
  for (const sc of scopes) {
    // 再次操作同范围同模板 = 覆盖（沿用原 id）
    let row = blocks.find((x) => x.tplId === t.id && x.scope === sc);
    if (!row) {
      row = {
        id: nextBlockId++,
        tplId: t.id,
        scope: sc,
        kind,
        reason,
        batchId,
        createdBy: OPERATOR_ID,
        untilMs: until,
      };
      blocks.push(row);
    } else Object.assign(row, { kind, reason, batchId, untilMs: until });
    ids.push(row.id);
  }
  return afterWrite(ids, batchId ?? undefined);
});

on('GET', '/headlines/suppressions', (_m, q) => {
  const scope = str(q.scope);
  const activeOnly = str(q.active) !== 'false';
  const out: HeadlineSuppression[] = blocks
    .filter((b) => (!scope || b.scope === scope) && (!activeOnly || blockActive(b)))
    .sort((a, b) => b.id - a.id)
    .map(blockViewOf);
  return out;
});

on('DELETE', '/headlines/suppressions/(\\d+)', (m, q) => {
  const b = blocks.find((x) => x.id === Number(m[1]));
  if (!b) throw notFoundErr('抑制规则不存在');
  const targets =
    bool(q.applyToBatch) && b.batchId ? blocks.filter((x) => x.batchId === b.batchId) : [b];
  for (const x of targets) blocks.splice(blocks.indexOf(x), 1);
  return afterWrite(targets.map((x) => x.id));
});

// ---------------- 行业建议 / 搜索缺口 ----------------
on('GET', '/industry-suggestions', (_m, q) => {
  const { page, size } = normPage(q);
  const status = str(q.status);
  if (status && !['NEW', 'ADOPTED', 'IGNORED'].includes(status))
    throw paramErr('status 只能是 NEW / ADOPTED / IGNORED');
  const from = parseAdminTime(q.from);
  const to = parseAdminTime(q.to);
  const l = suggestions.filter(
    (s) =>
      (!status || s.status === status) &&
      (from === null || ms(s.lastAt) >= from) &&
      (to === null || ms(s.lastAt) < to),
  );
  l.sort((a, b) =>
    str(q.sort) === 'recent'
      ? b.lastAt.localeCompare(a.lastAt) || b.count - a.count
      : b.count - a.count || b.lastAt.localeCompare(a.lastAt),
  );
  const out: IndustrySuggestionPage = {
    total: l.length,
    page,
    size,
    noTextCount: NO_TEXT_COUNT,
    items: slicePage(l, page, size),
  };
  return out;
});

const handleSuggestion = (normText: string, status: 'ADOPTED' | 'IGNORED', industryId: number) => {
  if (!normText) throw paramErr('缺少 normText');
  if (status === 'ADOPTED' && industryId <= 0) throw paramErr('采纳需要关联新建的行业 industryId');
  const s = suggestions.find((x) => x.normText === normText);
  if (!s) throw notFoundErr('行业建议不存在');
  if (status === 'ADOPTED' && !indById(industryId))
    throw notFoundErr('关联的行业不存在', 'INDUSTRY_NOT_FOUND');
  s.status = status;
  s.industryId = industryId > 0 ? industryId : null;
  s.handledAt = fmt(now());
  return null;
};
on('POST', '/industry-suggestions/([^/]+)/adopt', (m, _q, body) =>
  handleSuggestion(
    decodeURIComponent(m[1]).trim(),
    'ADOPTED',
    num(bodyOf<{ industryId?: number }>(body).industryId),
  ),
);
on('POST', '/industry-suggestions/([^/]+)/ignore', (m) =>
  handleSuggestion(decodeURIComponent(m[1]).trim(), 'IGNORED', 0),
);

on('GET', '/search-misses', (_m, q) => {
  const { page, size } = normPage(q);
  const status = str(q.status);
  if (status && !['NEW', 'HANDLED', 'IGNORED'].includes(status))
    throw paramErr('status 只能是 NEW / HANDLED / IGNORED');
  // from / to 按日（含两端）：只取日期部分；mock 的聚合没有按日明细，只按首末日是否与区间相交过滤
  const from = parseAdminTime(q.from);
  const to = parseAdminTime(q.to);
  const fromDay = from === null ? null : fmtDate(from);
  const toDay = to === null ? null : fmtDate(to);
  const industry = str(q.industry);
  const l = misses.filter(
    (x) =>
      (!industry || x.industryCode === industry) &&
      (!status || x.status === status) &&
      (fromDay === null || x.lastDay >= fromDay) &&
      (toDay === null || x.firstDay <= toDay),
  );
  l.sort((a, b) =>
    str(q.sort) === 'recent'
      ? b.lastDay.localeCompare(a.lastDay) || b.count - a.count
      : b.count - a.count || b.lastDay.localeCompare(a.lastDay),
  );
  const out: SearchMissPage = {
    total: l.length,
    page,
    size,
    items: slicePage(l, page, size),
  };
  return out;
});

on('POST', '/search-misses/status', (_m, _q, body) => {
  const b = bodyOf<{ industry?: string; term?: string; status?: string }>(body);
  const status = str(b.status);
  if (status !== 'HANDLED' && status !== 'IGNORED' && status !== 'NEW')
    throw paramErr('status 只能是 HANDLED / IGNORED / NEW');
  const industry = str(b.industry);
  const term = str(b.term);
  if (!industry || !term) throw paramErr('缺少 industry 或 term');
  const x = misses.find((r) => r.industryCode === industry && r.normTerm === term);
  if (!x) throw notFoundErr('搜索词不存在');
  x.status = status;
  x.handledAt = fmt(now());
  return null;
});

// ---------------- 入口 ----------------

// ---------------- 交接期：行业内排序 / 渠道 / 示例素材 ----------------
/**
 * 交接期模拟：Java 仍是模板基础字段的写者，Go 对这些写返回 7003 · ADMIN_WRITE_DISABLED（HTTP 200）。
 * 默认开启，行业关系 / 行业内排序 / 渠道与媒体类型 / 入参 / 示例素材照常可写；
 * 设 VITE_PLAZA_ADMIN_MOCK_WRITE=true 模拟「Go 已是写者」，全部放开。
 */
const isHandover = (): boolean =>
  (import.meta.env as Record<string, string | undefined>).VITE_PLAZA_ADMIN_MOCK_WRITE !== 'true';

const handoverDenied = (method: PlazaMethod, path: string): boolean => {
  if (
    (import.meta.env as Record<string, string | undefined>).VITE_PLAZA_ADMIN_MOCK_WRITE === 'true'
  )
    return false;
  if (
    method === 'POST' &&
    /^\/templates\/(\d+\/(publish|offline|duplicate|restore)|batch\/(publish|offline|delete|restore))$/.test(
      path,
    )
  )
    return true;
  if (method === 'DELETE' && /^\/templates\/\d+(\/purge)?$/.test(path)) return true;
  if (method === 'PUT' && /^\/templates\/\d+$/.test(path)) return true;
  return method === 'POST' && path === '/templates';
};

on('GET', '/capabilities', () => {
  const h = isHandover();
  return {
    adminWriteEnabled: !h,
    writable: {
      status: !h,
      recycle: !h,
      fullEdit: !h,
      slots: true,
      industryRelation: true,
      industryOrder: true,
      attrs: true,
      samples: true,
      uploads: true,
    },
  };
});

on('GET', '/templates/unassigned-summary', () => {
  const l = tpls.filter((t) => !t.deleted && idsOf(t).length === 0);
  return {
    total: l.length,
    enabled: l.filter((t) => visibleNow(t)).length,
    adminWriteEnabled: !isHandover(),
  };
});

on('PUT', '/templates/(\\d+)/industries', (m, _q, body) => {
  const b = bodyOf<{
    assign?: number[];
    unassign?: number[];
    industryIds?: number[];
    revision?: number;
  }>(body);
  const replace = b.industryIds !== undefined && b.industryIds !== null;
  if (replace && (b.assign?.length || b.unassign?.length))
    throw paramErr('industryIds（整体替换）不能与 assign / unassign 同时传');
  if (!replace && !b.assign?.length && !b.unassign?.length)
    throw paramErr('需要 assign / unassign 或 industryIds');
  if (replace && (b.revision === undefined || b.revision === null))
    throw new GoError(1002, 'PARAM_MISSING', '整体替换行业需要 revision（带上读到的 revision）');
  const t = liveTpl(Number(m[1]));
  if (b.revision !== undefined && b.revision !== null) checkRevision(t, b, 'CONFLICT');
  const before = idsOf(t).sort().join(',');
  if (replace) setIndustries(t, checkIndustryIds(b.industryIds));
  else {
    for (const i of checkIndustryIds(b.assign)) attachIndustry(t, i);
    for (const i of dedupeNums(b.unassign)) delete t.industrySort[i];
  }
  const changed = before !== idsOf(t).sort().join(',');
  if (changed) touch(t);
  return {
    id: t.id,
    industryIds: idsOf(t),
    updatedAt: t.updateTime,
    revision: t.revision,
    changed,
  };
});

on('GET', '/industries/(\\d+)/templates', (m) => {
  const id = Number(m[1]);
  const x = indById(id);
  if (!x) throw notFoundErr('行业不存在', 'INDUSTRY_NOT_FOUND');
  const ids = x.parentId === null ? descendants(id) : [id];
  const list = tpls
    .filter((t) => !t.deleted && idsOf(t).some((i) => ids.includes(i)))
    .map((t) => ({
      t,
      pos: Math.min(
        ...idsOf(t)
          .filter((i) => ids.includes(i))
          .map((i) => t.industrySort[i]),
      ),
      direct: idsOf(t).includes(id),
    }))
    .sort((a, b) => a.pos - b.pos || a.t.id - b.t.id);
  const readOnly = list.some((r) => !r.direct);
  const out: IndustryTemplatesView = {
    industryId: id,
    readOnly,
    items: list.map((r) => ({ ...rowOf(r.t, id), industrySortOrder: r.pos })),
  };
  if (readOnly) out.hint = '含仅挂在二级的模板，请进入具体二级行业排序，或筛选「直挂本级」后排序';
  return out;
});

on('PUT', '/industries/(\\d+)/templates/order', (m, _q, body) => {
  const id = Number(m[1]);
  if (!indById(id)) throw notFoundErr('行业不存在', 'INDUSTRY_NOT_FOUND');
  const ordered = dedupeNums(bodyOf<{ orderedTemplateIds?: number[] }>(body).orderedTemplateIds);
  const cur = tpls.filter((t) => !t.deleted && id in t.industrySort).map((t) => t.id);
  if (ordered.length !== cur.length || ordered.some((x) => !cur.includes(x)))
    throw paramErr('排序列表必须是该行业当前全部模板（刚有人改过，刷新后再排）');
  ordered.forEach((tid, i) => {
    const t = liveTpl(tid);
    t.industrySort[id] = (i + 1) * 10;
  });
  return null;
});

const chans: ChannelDict[] = [
  ...CHANNEL_DICT.map(
    (c, i): ChannelDict => ({
      id: i + 1,
      code: c.code,
      name: c.name,
      mediaType: 'image',
      width: c.width,
      height: c.height,
      ratio: c.ratio,
      note: null,
      sortOrder: i * 10,
      enabled: true,
    }),
  ),
  {
    id: 4,
    code: 'shipinhao',
    name: '视频号竖屏',
    mediaType: 'video',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    note: '时长 ≤ 60s',
    sortOrder: 30,
    enabled: true,
  },
];
/** 渠道被模板引用的数量（含回收站里的；channels 元素是 code 字符串或 {code,...}） */
const channelRefs = (code: string) => {
  let total = 0;
  let trash = 0;
  const ids: number[] = [];
  for (const t of tpls) {
    const arr = Array.isArray(t.channels) ? (t.channels as unknown[]) : [];
    if (!arr.some((x) => (typeof x === 'string' ? x : (x as { code?: string })?.code) === code))
      continue;
    total += 1;
    if (t.deleted) trash += 1;
    ids.push(t.id);
  }
  return { total, trash, ids };
};
on('GET', '/channels', () =>
  clone(
    chans
      .filter((c) => !deletedChannels.has(c.id))
      .map((c) => {
        const r = channelRefs(c.code);
        return { ...c, templateCount: r.total, trashCount: r.trash };
      }),
  ),
);
const deletedChannels = new Set<number>();
on('DELETE', '/channels/(\\d+)', (m) => {
  const row = chans.find((c) => c.id === Number(m[1]) && !deletedChannels.has(c.id));
  if (!row) throw notFoundErr('渠道');
  const r = channelRefs(row.code);
  if (r.total > 0)
    throw conflictErr(
      `渠道「${row.name}」被 ${r.total} 个模板引用，不能删除；请先把这些模板改投其它渠道${
        r.trash ? `（其中 ${r.trash} 个在回收站）` : ''
      }，例如模板 ${r.ids.slice(0, 5).join('、')}`,
    );
  deletedChannels.add(row.id);
  pushAudit('CHANNEL_DELETE', 'CHANNEL', String(row.id), { ...row }, null);
  return { id: row.id };
});

/** 非模板对象的审计（渠道等）：只有前后快照与字段级 diff */
const pushAudit = (
  action: string,
  resourceType: string,
  resourceId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  at = now(),
  operator: { id: number; name: string } = { id: OPERATOR_ID, name: '演示管理员' },
) => {
  let diff: AuditEntry['diff'] = null;
  if (before && after) {
    diff = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k] ?? null) === JSON.stringify(after[k] ?? null)) continue;
      diff[k] = { from: before[k] ?? null, to: after[k] ?? null };
    }
  }
  auditLog.unshift({
    id: nextAuditId++,
    operatorId: operator.id,
    operatorName: operator.name,
    action,
    resourceType,
    resourceId,
    batchId: null,
    before,
    after,
    diff,
    status: 'SUCCESS',
    requestId: `mock-${nextAuditId}`,
    clientIp: '127.0.0.1',
    createTime: fmt(at),
  });
};

const CHANNEL_CODE_RE = /^[a-z][a-z0-9_]{1,47}$/;
/** 对应 Go applyChannel：逐项校验并就地改写 */
const applyChannelMock = (row: ChannelDict, b: Record<string, unknown>) => {
  if (b.name !== undefined && b.name !== null) row.name = str(b.name);
  if (!row.name || runeLen(row.name) > 32) throw paramErr('渠道名称必填，最多 32 个字');
  if (b.mediaType !== undefined && b.mediaType !== null) row.mediaType = str(b.mediaType) as never;
  if (!row.mediaType) row.mediaType = 'image';
  if (row.mediaType !== 'image' && row.mediaType !== 'video')
    throw paramErr('渠道 mediaType 只能是 image 或 video');
  if (b.width !== undefined && b.width !== null) row.width = num(b.width);
  if (b.height !== undefined && b.height !== null) row.height = num(b.height);
  if (row.width <= 0 || row.height <= 0 || row.width > 20000 || row.height > 20000)
    throw paramErr('渠道宽高必须是 1~20000 的整数');
  if (b.ratio !== undefined && b.ratio !== null) row.ratio = str(b.ratio);
  if (!row.ratio || row.ratio.length > 8) throw paramErr('渠道比例必填（如 9:16），最多 8 个字符');
  if (b.note !== undefined) row.note = b.note === null || str(b.note) === '' ? null : str(b.note);
  if (row.note && runeLen(row.note) > 120) throw paramErr('渠道备注最多 120 个字');
  if (b.sortOrder !== undefined && b.sortOrder !== null) row.sortOrder = num(b.sortOrder);
  if (b.enabled !== undefined && b.enabled !== null) row.enabled = bool(b.enabled);
};

on('POST', '/channels', (_m, _q, body) => {
  const b = bodyOf<Record<string, unknown>>(body);
  const code = str(b.code);
  if (!CHANNEL_CODE_RE.test(code))
    throw paramErr('渠道 code 只能是小写字母开头的字母、数字、下划线，长度 2~48');
  const row: ChannelDict = {
    id: Math.max(0, ...chans.map((c) => c.id)) + 1,
    code,
    name: '',
    mediaType: 'image',
    width: 0,
    height: 0,
    ratio: '',
    note: null,
    sortOrder: 0,
    enabled: true,
  };
  applyChannelMock(row, b);
  if (chans.some((c) => c.code === code))
    throw conflictErr('渠道 code 已存在（已删除渠道的 code 也不可复用）');
  chans.push(row);
  pushAudit('CHANNEL_CREATE', 'CHANNEL', String(row.id), null, { ...row });
  return { id: row.id };
});

on('PUT', '/channels/(\\d+)', (m, _q, body) => {
  const row = chans.find((c) => c.id === Number(m[1]));
  if (!row) throw notFoundErr('渠道');
  const b = bodyOf<Record<string, unknown>>(body);
  const c = str(b.code);
  if (c && c !== row.code) throw paramErr('渠道 code 创建后不可修改');
  const before = { ...row };
  const next = { ...row };
  applyChannelMock(next, b);
  Object.assign(row, next);
  pushAudit('CHANNEL_UPDATE', 'CHANNEL', String(row.id), before, { ...row });
  return null;
});

// 演示用的历史审计：行业 / 渠道 / 头条（模板的审计随编辑产生）
(() => {
  const ops = [
    { id: 1, name: '演示管理员' },
    { id: 2, name: '运营小王' },
  ];
  const T = (h: number) => now() - h * HOUR;
  pushAudit(
    'INDUSTRY_UPDATE',
    'INDUSTRY',
    '3',
    { name: '餐饮美食', sortOrder: 10 },
    { name: '餐饮', sortOrder: 20 },
    T(70),
    ops[1],
  );
  pushAudit(
    'CHANNEL_UPDATE',
    'CHANNEL',
    '2',
    { width: 1080, height: 1350 },
    { width: 1080, height: 1440 },
    T(50),
    ops[1],
  );
  pushAudit(
    'HEADLINE_CREATE',
    'HEADLINE_RULE',
    '11',
    null,
    { scope: 'food', why: '本周爆款', pinPosition: 1 },
    T(30),
    ops[0],
  );
  pushAudit(
    'HEADLINE_SUPPRESS',
    'HEADLINE_BLOCK',
    '5',
    null,
    { scope: 'food', kind: 'BLOCK', reason: '素材侵权' },
    T(8),
    ops[1],
  );
  pushAudit(
    'PARAMS_UPDATE',
    'HEADLINE_PARAMS',
    '1',
    { 'top-n': 10 },
    { 'top-n': 12 },
    T(2),
    ops[0],
  );
})();

on('PUT', '/templates/(\\d+)/attrs', (m, _q, body) => {
  const b = bodyOf<{
    mediaType?: string;
    channels?: TemplateChannelRef[];
    updatedAt?: string;
    revision?: number;
  }>(body);
  const t = liveTpl(Number(m[1]));
  if (isHandover() && (b.revision === undefined || b.revision === null))
    throw new GoError(1002, 'PARAM_MISSING', '交接期修改属性需要 revision（带上读到的 revision）');
  checkRevision(t, b, 'CONFLICT');
  if (b.mediaType !== undefined) {
    if (b.mediaType !== 'image' && b.mediaType !== 'video')
      throw paramErr('mediaType 只能是 image 或 video');
    if (b.mediaType === 'video' && !t.videoUrl) throw paramErr('视频模板必须先有预览视频');
    t.mediaType = b.mediaType;
  }
  if (b.channels !== undefined) {
    const list = Array.isArray(b.channels) ? b.channels : [];
    for (const c of list)
      if (!chans.some((x) => x.code === c?.code && x.enabled))
        throw paramErr(`渠道 ${String(c?.code)} 不存在或已停用`);
    if (new Set(list.map((c) => c.code)).size !== list.length) throw paramErr('渠道不能重复');
    t.channels = list.length ? clone(list) : null;
  }
  touch(t);
  const out: SaveAttrsResult = {
    id: t.id,
    updatedAt: t.updateTime,
    revision: t.revision,
  };
  return out;
});

let nextSampleId = 10;
const samples: SampleAsset[] = [
  ['OUTPUT', '示例：门头成品'],
  ['INPUT', '示例：原始门头照'],
].map(
  ([role, title], i): SampleAsset => ({
    id: i + 1,
    scopeType: 'TEMPLATE',
    industryId: null,
    templateId: tpls[0].id,
    kind: 'image',
    role: role as SampleAsset['role'],
    url: `https://picsum.photos/seed/sample${i}/480/640`,
    thumbUrl: null,
    title,
    sortOrder: i * 10,
    enabled: true,
  }),
);
const sampleScopeKey = (s: { scopeType?: string; industryId?: unknown; templateId?: unknown }) =>
  s.scopeType === 'INDUSTRY' ? `I${num(s.industryId)}` : `T${num(s.templateId)}`;
const sampleBody = (b: Record<string, unknown>, cur?: SampleAsset): SampleAsset => {
  const url = b.url !== undefined ? str(b.url) : (cur?.url ?? '');
  if (!/^https?:\/\/[^/]+/.test(url)) throw paramErr('示例素材地址必须是 http(s) 地址');
  const thumb = b.thumbUrl !== undefined ? str(b.thumbUrl) || null : (cur?.thumbUrl ?? null);
  if (thumb && !/^https?:\/\/[^/]+/.test(thumb)) throw paramErr('缩略图地址必须是 http(s) 地址');
  const title = b.title !== undefined ? str(b.title) : (cur?.title ?? '');
  if (!title || runeLen(title) > 40) throw paramErr('示例标题必填，最多 40 个字');
  const role = (b.role ?? cur?.role ?? 'OUTPUT') as string;
  if (role !== 'INPUT' && role !== 'OUTPUT') throw paramErr('role 只能是 INPUT 或 OUTPUT');
  return {
    id: cur?.id ?? 0,
    scopeType: cur?.scopeType ?? 'TEMPLATE',
    industryId: cur?.industryId ?? null,
    templateId: cur?.templateId ?? null,
    kind: 'image',
    role,
    url,
    thumbUrl: thumb,
    title,
    sortOrder: b.sortOrder !== undefined ? Number(b.sortOrder) : (cur?.sortOrder ?? 0),
    enabled: b.enabled !== undefined ? !!b.enabled : (cur?.enabled ?? true),
  };
};

on('GET', '/samples', (_m, q) => {
  const scope = str(q.scopeType);
  if (scope !== 'INDUSTRY' && scope !== 'TEMPLATE')
    throw paramErr('scopeType 只能是 INDUSTRY 或 TEMPLATE');
  const key = sampleScopeKey({
    scopeType: scope,
    industryId: q.industryId,
    templateId: q.templateId,
  });
  return clone(
    samples
      .filter((x) => sampleScopeKey(x) === key)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  );
});

on('POST', '/samples', (_m, _q, body) => {
  const b = bodyOf<Record<string, unknown>>(body);
  const scope = str(b.scopeType);
  if (scope === 'INDUSTRY') {
    if (!indById(num(b.industryId))) throw notFoundErr('行业不存在', 'INDUSTRY_NOT_FOUND');
  } else if (scope === 'TEMPLATE') {
    liveTpl(num(b.templateId));
  } else throw paramErr('scopeType 只能是 INDUSTRY 或 TEMPLATE');
  const row = sampleBody(b);
  row.scopeType = scope;
  row.industryId = scope === 'INDUSTRY' ? num(b.industryId) : null;
  row.templateId = scope === 'TEMPLATE' ? num(b.templateId) : null;
  if (samples.filter((x) => sampleScopeKey(x) === sampleScopeKey(row)).length >= 6)
    throw paramErr('每个范围最多 6 条示例素材');
  row.id = nextSampleId++;
  samples.push(row);
  return { id: row.id };
});

on('PUT', '/samples/(\\d+)', (m, _q, body) => {
  const cur = samples.find((x) => x.id === Number(m[1]));
  if (!cur) throw notFoundErr('示例素材不存在');
  Object.assign(cur, sampleBody(bodyOf<Record<string, unknown>>(body), cur));
  return null;
});

on('DELETE', '/samples/(\\d+)', (m) => {
  const i = samples.findIndex((x) => x.id === Number(m[1]));
  if (i < 0) throw notFoundErr('示例素材不存在');
  samples.splice(i, 1);
  return null;
});

// ---------------- 模板编辑器配套：素材直传 / 技能 / 变更历史 ----------------
const UP_TYPES: Record<string, { kind: 'image' | 'video'; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/webm': { kind: 'video', ext: 'webm' },
};
const UP_BASE = 'https://mock-cdn.example.com/aigc-local-life/plaza-template';
/** 已 presign 的对象 → 声明的类型与大小（confirm 据此回填，模拟 HEAD） */
const presigned = new Map<string, { kind: 'image' | 'video'; contentType: string; size: number }>();

on('POST', '/uploads/presign', (_m, _q, body): UploadPresign => {
  const b = bodyOf<{ kind?: string; contentType?: string; fileName?: string; size?: number }>(body);
  const ct = str(b.contentType).toLowerCase();
  const t = UP_TYPES[ct];
  if (!t) throw paramErr(`不支持的文件类型 ${ct}（图片 jpg / png / webp，视频 mp4 / webm）`);
  if (b.kind && b.kind !== t.kind) throw paramErr('文件类型与 kind 不一致');
  const size = Number(b.size);
  if (!(size > 0)) throw paramErr('size 必填（文件字节数）');
  const max = (t.kind === 'image' ? 10 : 200) << 20;
  if (size > max)
    throw paramErr(`文件太大：${t.kind === 'image' ? '图片' : '视频'}最大 ${max >> 20} MB`);
  const key = `aigc-local-life/plaza-template/${fmtDate(now()).slice(0, 7).replace('-', '')}/${Math.random().toString(16).slice(2, 14)}.${t.ext}`;
  const url = `${UP_BASE}/${key.split('/').slice(2).join('/')}`;
  presigned.set(url, { kind: t.kind, contentType: ct, size });
  return {
    uploadUrl: `mock://upload/${key}`,
    method: 'PUT',
    headers: { 'Content-Type': ct },
    url,
    key,
    kind: t.kind,
    maxSize: max,
    expiresAt: now() + 30 * 60 * 1000,
  };
});

on('POST', '/uploads/confirm', (_m, _q, body): UploadConfirmResult => {
  const b = bodyOf<{ url?: string; kind?: string }>(body);
  const u = str(b.url);
  const meta = presigned.get(u);
  if (!u.startsWith(`${UP_BASE}/`)) throw paramErr('素材不在模板素材目录里，请通过上传接口上传');
  if (!meta) throw paramErr('没有找到上传的文件，请重新上传');
  if (b.kind && b.kind !== meta.kind) throw paramErr('文件类型与所选类型不符');
  const base = { url: u, kind: meta.kind, contentType: meta.contentType, size: meta.size };
  if (meta.kind === 'image') return { ...base, width: 1080, height: 1440, mediaStatus: 'READY' };
  // 约定：文件名含 nocover 的视频模拟「封面没抽出来」
  return u.includes('nocover')
    ? {
        ...base,
        width: 1080,
        height: 1920,
        durationSec: 12.5,
        mediaStatus: 'PROCESSING',
        note: '封面暂未生成，保存后由后台任务重试；多次失败可手动上传封面',
      }
    : {
        ...base,
        width: 1080,
        height: 1920,
        durationSec: 12.5,
        coverUrl: u.replace(/\.(mp4|webm)$/, '-cover.jpg'),
        mediaStatus: 'PROCESSING',
      };
});

on('GET', '/skills', (_m, q): { items: AdminSkill[] } => {
  const kw = str(q.keyword).toLowerCase();
  return {
    items: MOCK_SKILLS.filter(
      (x) => !kw || x.title.toLowerCase().includes(kw) || x.code.includes(kw),
    ),
  };
});

on('GET', '/templates/(\\d+)/audit', (m, q): AuditPage => {
  const { page, size } = normPage(q);
  const l = auditLog.filter((e) => e.resourceType === 'TEMPLATE' && e.resourceId === m[1]);
  return { total: l.length, page, size, items: slicePage(l, page, size) };
});

/** 与后端 auditMatch 一致：不含 * 精确，含 * 通配 */
const matchAudit = (v: string, pat: string) => {
  if (!pat.includes('*')) return v === pat;
  const re = pat.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${re.join('.*')}$`).test(v);
};

on('GET', '/audit', (_m, q): AuditPage => {
  const { page, size } = normPage(q);
  const from = parseAdminTime(q.from);
  const to = parseAdminTime(q.to);
  const opId = num(q.operatorId);
  const l = auditLog
    .filter((e) => !str(q.resourceId) || e.resourceId === str(q.resourceId))
    .filter((e) => !str(q.resourceType) || matchAudit(e.resourceType, str(q.resourceType)))
    .filter((e) => !str(q.action) || matchAudit(e.action, str(q.action)))
    .filter((e) => !str(q.batchId) || e.batchId === str(q.batchId))
    .filter(
      (e) =>
        !str(q.operatorName) ||
        (e.operatorName ?? '').toLowerCase().includes(str(q.operatorName).toLowerCase()),
    )
    .filter((e) => !opId || e.operatorId === opId)
    .filter((e) => from === null || ms(e.createTime) >= from)
    .filter((e) => to === null || ms(e.createTime) < to)
    .sort((a, b) => b.id - a.id);
  return { total: l.length, page, size, items: slicePage(l, page, size) };
});

// ---------------- 营销节点（Go 独占表，交接期也可写） ----------------
interface NodeRow {
  id: number;
  code: string;
  name: string;
  why: string;
  eventDate: string;
  leadDays: number;
  sortOrder: number;
  enabled: boolean;
  createTime: string;
  updateTime: string;
  deleted: boolean;
}
const NODE_LINK_MAX = 300;
let nextNodeId = 4;
const nodeDay = (off: number) => fmtDate(now() + off * DAY);
const nodes: NodeRow[] = [
  ['double12_demo', '双十二', '年终活动图该上新了', 29, 14, true],
  ['nianhuo_demo', '年货节', '年货节海报和短视频，现在就能做', 5, 14, true],
  ['spring_demo', '春季换季上新', '换季上新，新品图一起换', 120, 14, false],
].map(([code, name, why, off, lead, en], i) => ({
  id: i + 1,
  code: code as string,
  name: name as string,
  why: why as string,
  eventDate: nodeDay(off as number),
  leadDays: lead as number,
  sortOrder: 10,
  enabled: en as boolean,
  createTime: fmt(now() - 9 * DAY),
  updateTime: fmt(now() - 2 * DAY),
  deleted: false,
}));
/** nodeId → [{templateId, sort}]（节点内排序位，全行业共用一列，与 Go 一致） */
const nodeLinks = new Map<number, { templateId: number; sort: number }[]>();
nodeLinks.set(
  2,
  tpls
    .filter((t) => !t.deleted)
    .slice(0, 4)
    .map((t, i) => ({ templateId: t.id, sort: i })),
);

const liveNode = (id: number): NodeRow => {
  const n = nodes.find((x) => x.id === id && !x.deleted);
  if (!n) throw notFoundErr('营销节点不存在', 'NODE_NOT_FOUND');
  return n;
};
const linksOf = (id: number) => {
  let l = nodeLinks.get(id);
  if (!l) nodeLinks.set(id, (l = []));
  return l;
};
const nodeView = (n: NodeRow) => {
  const ev = dayStartMs(n.eventDate);
  const from = ev - n.leadDays * DAY;
  const today = dayStartMs(todayStr());
  return {
    id: n.id,
    code: n.code,
    name: n.name,
    why: n.why,
    eventDate: n.eventDate,
    leadDays: n.leadDays,
    showFrom: fmtDate(from),
    sortOrder: n.sortOrder,
    enabled: n.enabled,
    status: (today > ev ? 'ENDED' : today < from ? 'UPCOMING' : 'ACTIVE') as
      | 'ENDED'
      | 'UPCOMING'
      | 'ACTIVE',
    templateCount: linksOf(n.id).length,
    createTime: n.createTime,
    updateTime: n.updateTime,
  };
};
const nodeSnap = (n: NodeRow) => ({
  id: n.id,
  code: n.code,
  name: n.name,
  why: n.why,
  eventDate: n.eventDate,
  leadDays: n.leadDays,
  sortOrder: n.sortOrder,
  enabled: n.enabled,
});
const recordNodeAudit = (
  action: string,
  id: number,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => {
  auditLog.unshift({
    id: nextAuditId++,
    operatorId: OPERATOR_ID,
    operatorName: '演示管理员',
    action,
    resourceType: 'NODE',
    resourceId: String(id),
    batchId: null,
    before,
    after,
    diff: null,
    status: 'SUCCESS',
    requestId: `mock-${nextAuditId}`,
    clientIp: '127.0.0.1',
    createTime: fmt(now()),
  });
};
const applyNode = (n: NodeRow, b: Record<string, unknown>) => {
  if (b.name !== undefined && b.name !== null) n.name = str(b.name);
  if (!n.name || runeLen(n.name) > 40) throw paramErr('节点名称必填，最多 40 个字');
  if (b.why !== undefined && b.why !== null) n.why = str(b.why);
  if (runeLen(n.why) > 60) throw paramErr('推荐语最多 60 个字');
  if (b.eventDate !== undefined && b.eventDate !== null) {
    const d = str(b.eventDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || parseDate(d) === null)
      throw paramErr('节点日期格式不对，应为 yyyy-MM-dd');
    n.eventDate = d;
  }
  if (!n.eventDate) throw paramErr('节点日期必填');
  if (b.leadDays !== undefined && b.leadDays !== null) n.leadDays = num(b.leadDays);
  if (n.leadDays < 0 || n.leadDays > 365) throw paramErr('提前展示天数需在 0~365 之间');
  if (b.sortOrder !== undefined && b.sortOrder !== null) n.sortOrder = num(b.sortOrder);
  if (b.enabled !== undefined && b.enabled !== null) n.enabled = bool(b.enabled);
  n.updateTime = fmt(now());
};
/** 行业（一级含二级）覆盖的行业 id；不存在 → INDUSTRY_NOT_FOUND；缺 → 1003 */
const nodeIndustryScope = (industryId: number): number[] => {
  if (industryId <= 0) throw paramErr('请选择行业');
  if (!indById(industryId)) throw notFoundErr('行业不存在', 'INDUSTRY_NOT_FOUND');
  return descendants(industryId);
};
const nodeInScope = (t: Tpl, scope: number[]) => idsOf(t).some((i) => scope.includes(i));

on('GET', '/nodes', (_m, q) => {
  const { page, size } = normPage(q);
  const kw = str(q.keyword).toLowerCase();
  const en = str(q.enabled);
  const l = nodes
    .filter((n) => !n.deleted)
    .filter((n) => !kw || n.name.toLowerCase().includes(kw) || n.code.includes(kw))
    .filter((n) => en === '' || (en === '1') === n.enabled)
    .sort((a, b) => (a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : b.id - a.id));
  return { total: l.length, page, size, items: slicePage(l, page, size).map(nodeView) };
});

on('GET', '/nodes/(\\d+)', (m) => nodeView(liveNode(Number(m[1]))));

on('POST', '/nodes', (_m, _q, body) => {
  const b = bodyOf<Record<string, unknown>>(body);
  const code = str(b.code);
  if (!/^[a-z0-9][a-z0-9_]{1,63}$/.test(code))
    throw paramErr('节点 code 只能是小写字母 / 数字开头的字母、数字、下划线，长度 2~64');
  const n: NodeRow = {
    id: nextNodeId++,
    code,
    name: '',
    why: '',
    eventDate: '',
    leadDays: 14,
    sortOrder: 0,
    enabled: true,
    createTime: fmt(now()),
    updateTime: fmt(now()),
    deleted: false,
  };
  applyNode(n, b);
  if (nodes.some((x) => x.code === code))
    throw conflictErr('节点 code 已存在', 'NODE_CODE_DUPLICATE');
  nodes.push(n);
  recordNodeAudit('NODE_CREATE', n.id, null, nodeSnap(n));
  return { id: n.id };
});

on('PUT', '/nodes/(\\d+)', (m, _q, body) => {
  const n = liveNode(Number(m[1]));
  const b = bodyOf<Record<string, unknown>>(body);
  if (str(b.code) && str(b.code) !== n.code) throw paramErr('节点 code 创建后不能修改');
  const before = nodeSnap(n);
  const draft = { ...n };
  applyNode(draft, b);
  Object.assign(n, draft);
  recordNodeAudit('NODE_UPDATE', n.id, before, nodeSnap(n));
  return null;
});

on('PUT', '/nodes/(\\d+)/enabled', (m, _q, body) => {
  const n = liveNode(Number(m[1]));
  const b = bodyOf<{ enabled?: unknown }>(body);
  if (typeof b.enabled !== 'boolean') throw paramErr('enabled 必填');
  const before = nodeSnap(n);
  n.enabled = b.enabled;
  n.updateTime = fmt(now());
  recordNodeAudit(n.enabled ? 'NODE_ENABLE' : 'NODE_DISABLE', n.id, before, nodeSnap(n));
  return null;
});

on('DELETE', '/nodes/(\\d+)', (m) => {
  const n = liveNode(Number(m[1]));
  const before = { ...nodeSnap(n), templateCount: linksOf(n.id).length };
  n.deleted = true;
  n.enabled = false;
  n.code = `${n.code}~del${n.id}`;
  nodeLinks.delete(n.id);
  recordNodeAudit('NODE_DELETE', n.id, before, null);
  return null;
});

on('GET', '/nodes/(\\d+)/templates', (m, q) => {
  const n = liveNode(Number(m[1]));
  const industryId = num(q.industryId);
  const scope = industryId > 0 ? nodeIndustryScope(industryId) : null;
  const links = [...linksOf(n.id)].sort((a, b) => a.sort - b.sort);
  const items = links.flatMap((l) => {
    const t = tplById(l.templateId);
    if (!t || t.deleted || (scope && !nodeInScope(t, scope))) return [];
    return [{ ...rowOf(t, industryId), nodeSortOrder: l.sort }];
  });
  return { nodeId: n.id, industryId, total: links.length, items };
});

on('POST', '/nodes/(\\d+)/templates', (m, _q, body) => {
  const n = liveNode(Number(m[1]));
  const b = bodyOf<{ industryId?: unknown; templateIds?: unknown }>(body);
  const scope = nodeIndustryScope(num(b.industryId));
  const ids = dedupeNums(b.templateIds);
  if (!ids.length) throw paramErr('请选择要添加的模板');
  if (ids.length > 50) throw paramErr('一次最多添加 50 个模板');
  for (const id of ids) {
    const t = tplById(id);
    if (!t || t.deleted) throw notFoundErr(`模板 ${id} 不存在`, 'TEMPLATE_NOT_FOUND');
    if (!nodeInScope(t, scope)) throw paramErr(`模板 ${id} 不属于所选行业`);
  }
  const links = linksOf(n.id);
  let max = links.reduce((a, l) => Math.max(a, l.sort), -1);
  const added: number[] = [];
  for (const id of ids) {
    if (links.some((l) => l.templateId === id)) continue;
    if (links.length >= NODE_LINK_MAX) throw paramErr(`一个节点最多关联 ${NODE_LINK_MAX} 个模板`);
    links.push({ templateId: id, sort: ++max });
    added.push(id);
  }
  if (added.length)
    recordNodeAudit('NODE_TEMPLATE_ADD', n.id, null, {
      code: n.code,
      industryId: num(b.industryId),
      templateIds: added,
    });
  return { added };
});

on('PUT', '/nodes/(\\d+)/templates/order', (m, _q, body) => {
  const n = liveNode(Number(m[1]));
  const b = bodyOf<{ industryId?: unknown; templateIds?: unknown }>(body);
  const industryId = num(b.industryId);
  const scope = nodeIndustryScope(industryId);
  const raw = Array.isArray(b.templateIds) ? b.templateIds.map(Number) : [];
  if (!raw.length) throw paramErr('排序列表为空');
  if (new Set(raw).size !== raw.length) throw paramErr('排序列表里有重复的模板');
  const links = linksOf(n.id);
  const slots: number[] = [];
  for (const id of raw) {
    const l = links.find((x) => x.templateId === id);
    if (!l) throw paramErr(`模板 ${id} 没有关联到这个节点`);
    const t = tplById(id);
    if (!t || !nodeInScope(t, scope)) throw paramErr(`模板 ${id} 不属于所选行业`);
    slots.push(l.sort);
  }
  slots.sort((a, b2) => a - b2);
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1;
  raw.forEach((id, i) => {
    links.find((x) => x.templateId === id)!.sort = slots[i];
  });
  recordNodeAudit('NODE_TEMPLATE_SORT', n.id, null, {
    code: n.code,
    industryId,
    templateIds: raw,
  });
  return null;
});

on('DELETE', '/nodes/(\\d+)/templates/(\\d+)', (m) => {
  const n = liveNode(Number(m[1]));
  const links = linksOf(n.id);
  const i = links.findIndex((l) => l.templateId === Number(m[2]));
  if (i >= 0) {
    links.splice(i, 1);
    recordNodeAudit(
      'NODE_TEMPLATE_REMOVE',
      n.id,
      { code: n.code, templateIds: [Number(m[2])] },
      null,
    );
  }
  return null;
});

export async function handleMock(
  method: PlazaMethod,
  path: string,
  query: Record<string, unknown>,
  data: unknown,
): Promise<Envelope<unknown>> {
  await wait();
  // 没有调度器：读头条时若最新版本已过一个刷新周期，补跑一次定时刷新
  if (path.startsWith('/headlines') && method === 'GET') {
    const last = latestSnap();
    if (!last || now() - last.computedMs > REFRESH_INTERVAL) makeSnapshot('SCHEDULED', null);
  }
  const denied = handoverDenied(method, path);
  if (denied)
    return fail(7003, 'ADMIN_WRITE_DISABLED', '模板管理尚未迁移到新后台，请先在原后台操作');
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    try {
      return ok(r.fn(m, query, data));
    } catch (e) {
      if (e instanceof GoError) return fail(e.code, e.reason, e.message, e.data);
      throw e;
    }
  }
  return fail(404, 'RESOURCE_NOT_FOUND', `mock 未实现：${method} ${path}`);
}
