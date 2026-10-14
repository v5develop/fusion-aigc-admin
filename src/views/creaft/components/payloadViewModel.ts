/**
 * creaft 公共模板载荷（广场 / 本地生活）的可视化模型，纯函数、不碰 Vue。
 *
 * 载荷是运营手工维护的 JSON 对象，形态不固定：本地生活是「图种 → { images: [{url, size}] }」，
 * 广场是顶层的 image_urls / result 等 URL 数组。这里按结构递归收集图片组、文字字段与标签，
 * 不认识的键照样列出来，不丢信息；只有 JSON 本身解析失败才给出 error。
 */

export type PayloadMediaKind = 'image' | 'video';

export interface PayloadMediaItem {
  url: string;
  /** 本地生活图种自带的尺寸，形如 2710x760；没有就是 null */
  size: string | null;
}

export interface PayloadMediaGroup {
  /** 路径（如 two_panel、payload.image_urls），做 v-for 的 key 用 */
  path: string;
  label: string;
  kind: PayloadMediaKind;
  items: PayloadMediaItem[];
}

export interface PayloadTextField {
  path: string;
  label: string;
  value: string;
  multiline: boolean;
  /** 提示词：广场下发时会被摘掉，表单里要标注出来 */
  sensitive: boolean;
}

export interface PayloadViewModel {
  media: PayloadMediaGroup[];
  texts: PayloadTextField[];
  tags: string[];
  /** 版本与绑定等元数据，不属于素材内容 */
  meta: { label: string; value: string }[];
  /** 仅 JSON 解析失败或顶层不是对象时非空 */
  error: string | null;
}

/** 已知键的中文名；不在表里的键按原名展示。 */
const LABELS: Record<string, string> = {
  two_panel: '双联图',
  five_panel: '五连图',
  entry_image: '入口图',
  closeup_image: '特写图',
  overview_image: '概览图',
  set_meal_image: '套餐图',
  image_urls: '参考图',
  imageUrls: '参考图',
  result: '结果图',
  video_urls: '视频',
  videoUrls: '视频',
  prompt: '提示词',
  description: '描述',
  guidance: '引导语',
  agentSkillId: '绑定技能',
};

/** 版本、判重与绑定键：只展示在元数据区，不混进素材或文字。 */
const META_KEYS = new Set([
  'v1PlazaTemplateId',
  'v1LocalLifeTemplateId',
  'v1Weight',
  'agentSkillId',
  'agent_skill_id',
]);

const SENSITIVE_KEYS = new Set(['prompt']);

const URL_RE = /^https?:\/\//i;

function labelOf(key: string): string {
  return LABELS[key] ?? key;
}

function isVideoKey(key: string): boolean {
  return /video/i.test(key);
}

/** 把一个 URL 或 {url, size} 归一成媒体项；不是可用地址就返回 null。 */
function toMediaItem(node: unknown): PayloadMediaItem | null {
  if (typeof node === 'string') {
    return URL_RE.test(node.trim()) ? { url: node.trim(), size: null } : null;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj.url === 'string' && URL_RE.test(obj.url.trim())) {
      return {
        url: obj.url.trim(),
        size: typeof obj.size === 'string' && obj.size.trim() ? obj.size.trim() : null,
      };
    }
  }
  return null;
}

/** 数组里全是媒体项时才算一组；混有别的内容时逐个递归，避免把对象吞掉。 */
function mediaItemsOf(list: unknown[]): PayloadMediaItem[] | null {
  const items = list.map(toMediaItem);
  if (items.length === 0 || items.some((item) => item === null)) return null;
  return items as PayloadMediaItem[];
}

function pathLabel(path: string[]): string {
  return labelOf(path[path.length - 1] ?? '');
}

class Collector {
  readonly model: PayloadViewModel = { media: [], texts: [], tags: [], meta: [], error: null };

  addMedia(path: string[], items: PayloadMediaItem[], key: string) {
    if (items.length === 0) return;
    this.model.media.push({
      path: path.join('.'),
      label: pathLabel(path),
      kind: isVideoKey(key) ? 'video' : 'image',
      items,
    });
  }

  walk(node: unknown, path: string[]): void {
    const key = path[path.length - 1] ?? '';

    if (node === null || node === undefined) return;

    if (Array.isArray(node)) {
      if (key === 'tags') {
        this.model.tags.push(
          ...node.filter((t): t is string => typeof t === 'string' && !!t.trim()),
        );
        return;
      }
      const media = mediaItemsOf(node);
      if (media) {
        this.addMedia(path, media, key);
        return;
      }
      if (node.every((v) => v === null || typeof v !== 'object')) {
        const text = node
          .filter((v) => v !== null && v !== undefined && v !== '')
          .map(String)
          .join('、');
        this.addText(path, text);
        return;
      }
      node.forEach((item, index) => this.walk(item, [...path, String(index)]));
      return;
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      // 图种对象：{ images: [{url, size}], prompt, ... }
      if (Array.isArray(obj.images)) {
        const media = mediaItemsOf(obj.images);
        if (media) this.addMedia(path, media, key);
      }
      for (const [childKey, value] of Object.entries(obj)) {
        if (childKey === 'images' && Array.isArray(obj.images)) continue;
        if (META_KEYS.has(childKey)) {
          this.addMeta(childKey, value);
          continue;
        }
        this.walk(value, [...path, childKey]);
      }
      return;
    }

    if (
      typeof node === 'string' &&
      URL_RE.test(node.trim()) &&
      (isVideoKey(key) || /image|url|result/i.test(key))
    ) {
      this.addMedia(path, [{ url: node.trim(), size: null }], key);
      return;
    }

    this.addText(path, typeof node === 'string' ? node : String(node));
  }

  addText(path: string[], value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = path[path.length - 1] ?? '';
    this.model.texts.push({
      path: path.join('.'),
      label: pathLabel(path),
      value: trimmed,
      multiline: trimmed.includes('\n') || trimmed.length > 80,
      sensitive: SENSITIVE_KEYS.has(key),
    });
  }

  addMeta(key: string, value: unknown) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    this.model.meta.push({ label: labelOf(key), value: text });
  }
}

export function buildPayloadViewModel(json: string | null): PayloadViewModel {
  if (!json || !json.trim()) {
    return { media: [], texts: [], tags: [], meta: [], error: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      media: [],
      texts: [],
      tags: [],
      meta: [],
      error: '载荷不是合法的 JSON，无法可视化，请看「原文 JSON」',
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { media: [], texts: [], tags: [], meta: [], error: '载荷顶层必须是 JSON 对象' };
  }
  const collector = new Collector();
  collector.walk(parsed, []);
  return collector.model;
}
