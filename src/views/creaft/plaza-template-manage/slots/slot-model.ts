import type { SlotItem, SlotType, SlotsConfig } from '@/api/plaza-admin';

import { parseLayoutText, validateLayout } from './layout/layout-model';

export const SLOT_TYPES: { value: SlotType; label: string }[] = [
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'text', label: '单行文字' },
  { value: 'textarea', label: '多行文字' },
  { value: 'price', label: '价格' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '单选' },
  { value: 'multiselect', label: '多选' },
  { value: 'switch', label: '开关' },
  { value: 'color', label: '颜色' },
];

export const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

export const isMedia = (t: SlotType) => t === 'image' || t === 'video';
export const isTextual = (t: SlotType) => t === 'text' || t === 'textarea';
export const isNumeric = (t: SlotType) => t === 'number' || t === 'price';
export const isChoice = (t: SlotType) => t === 'select' || t === 'multiselect';

/** 编辑中的草稿：layout 以 JSON 文本编辑，保存时再解析 */
export interface SlotDraft extends Omit<SlotItem, 'layout'> {
  layoutText?: string;
}

export function newSlot(type: SlotType, existingKeys: string[]): SlotDraft {
  let i = existingKeys.length + 1;
  while (existingKeys.includes(`slot_${i}`)) i++;
  const base: SlotDraft = { key: `slot_${i}`, type, label: '', required: false };
  if (type === 'image' || type === 'video') Object.assign(base, { minCount: 1, maxCount: 1 });
  if (isChoice(type)) base.options = [{ value: 'opt_1', label: '选项 1' }];
  return base;
}

export function toDrafts(cfg?: SlotsConfig | null): SlotDraft[] {
  return [...(cfg?.items ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => {
      const { layout, ...rest } = s;
      return {
        ...JSON.parse(JSON.stringify(rest)),
        layoutText: layout === undefined ? undefined : JSON.stringify(layout, null, 2),
      } as SlotDraft;
    });
}

const blank = (v: unknown) => v === undefined || v === null || v === '';

/** 按 type 只保留相关属性，order 重排为 1..n；layout 原样解析后保存 */
export function toConfig(drafts: SlotDraft[]): SlotsConfig {
  const items = drafts.map((d, i): SlotItem => {
    const o: SlotItem = { key: d.key, type: d.type, label: d.label.trim(), order: i + 1 };
    if (d.help?.trim()) o.help = d.help.trim();
    if (d.placeholder?.trim() && d.type !== 'switch') o.placeholder = d.placeholder.trim();
    if (d.required) o.required = true;
    if (!blank(d.default) && !(Array.isArray(d.default) && !d.default.length))
      o.default = d.default;
    if (d.group?.trim()) o.group = d.group.trim();
    if (isMedia(d.type)) {
      for (const k of ['minCount', 'maxCount'] as const) if (!blank(d[k])) o[k] = d[k];
      if (d.guidance?.trim()) o.guidance = d.guidance.trim();
      if (d.exampleUrl?.trim()) o.exampleUrl = d.exampleUrl.trim();
      if (d.acceptRatio?.trim()) o.acceptRatio = d.acceptRatio.trim();
      if (d.type === 'video' && !blank(d.maxDurationSec)) o.maxDurationSec = d.maxDurationSec;
    }
    if (isTextual(d.type)) {
      if (!blank(d.maxLength)) o.maxLength = d.maxLength;
      if (d.layoutText?.trim()) {
        try {
          o.layout = JSON.parse(d.layoutText);
        } catch {
          /* 校验阶段已报错 */
        }
      }
    }
    if (isNumeric(d.type)) {
      for (const k of ['min', 'max', 'step'] as const) if (!blank(d[k])) o[k] = d[k];
      if (d.unit?.trim()) o.unit = d.unit.trim();
    }
    if (isChoice(d.type))
      o.options = (d.options ?? []).map((x) => ({ value: x.value, label: x.label }));
    if (d.visibleWhen && !blank(d.visibleWhen.key)) o.visibleWhen = { ...d.visibleWhen };
    return o;
  });
  return { schemaVersion: 1, items };
}

export interface SlotIssue {
  /** 与服务端同口径的字段路径，如 items[2].options */
  path: string;
  message: string;
}

export function validateSlots(drafts: SlotDraft[]): SlotIssue[] {
  const out: SlotIssue[] = [];
  const add = (i: number, f: string, message: string) =>
    out.push({ path: `items[${i}]${f ? '.' + f : ''}`, message });
  const keys = new Map<string, number>();
  if (drafts.length > 20) add(drafts.length - 1, '', '一个模板最多 20 个入参');
  drafts.forEach((d, i) => {
    if (!KEY_RE.test(d.key ?? ''))
      add(i, 'key', 'key 需以小写字母开头，仅含小写字母、数字、下划线，最长 32 位');
    else if (keys.has(d.key)) add(i, 'key', `key 与第 ${keys.get(d.key)! + 1} 项重复`);
    else keys.set(d.key, i);
    if (!SLOT_TYPES.some((t) => t.value === d.type)) add(i, 'type', 'type 不合法');
    if (!d.label?.trim()) add(i, 'label', '名称必填');
    else if (Array.from(d.label.trim()).length > 32) add(i, 'label', '名称最多 32 个字');

    if (isMedia(d.type)) {
      const { minCount: mn, maxCount: mx } = d;
      if (!blank(mn) && (!Number.isInteger(mn) || mn! < 0))
        add(i, 'minCount', '最少张数需为 ≥0 的整数');
      if (!blank(mx) && (!Number.isInteger(mx) || mx! < 1 || mx! > 9))
        add(i, 'maxCount', '最多张数需为 1~9 的整数');
      if (!blank(mn) && !blank(mx) && mn! > mx!) add(i, 'maxCount', '最多张数不能小于最少张数');
      if (d.required && (blank(mn) || mn! < 1) && d.type === 'image')
        add(i, 'minCount', '必填的图片位最少张数至少为 1');
      // 与服务端同口径：两边都是 1~5 位正整数，不允许 0 / 小数 / 前导 0 / 空格
      if (d.acceptRatio?.trim() && !/^[1-9]\d{0,4}:[1-9]\d{0,4}$/.test(d.acceptRatio.trim()))
        add(i, 'acceptRatio', '比例格式如 3:4（两边为不带前导 0 的正整数）');
      if (
        d.type === 'video' &&
        !blank(d.maxDurationSec) &&
        !(Number.isInteger(d.maxDurationSec) && d.maxDurationSec! >= 1 && d.maxDurationSec! <= 600)
      )
        add(i, 'maxDurationSec', '最长时长需为 1~600 的整数（秒）');
    }
    if (isTextual(d.type)) {
      if (
        !blank(d.maxLength) &&
        !(Number.isInteger(d.maxLength) && d.maxLength! >= 1 && d.maxLength! <= 2000)
      )
        add(i, 'maxLength', '最大字数需为 1~2000 的整数');
      if (d.layoutText?.trim()) {
        const p = parseLayoutText(d.layoutText);
        if (d.type !== 'text') add(i, 'layout', 'layout 仅对单行文字（text）入参有效');
        else if (!p.ok) add(i, 'layout', 'layout 不是合法 JSON');
        else
          for (const x of validateLayout(p.value))
            add(i, 'layout', `items[${i}].layout${x.path ? '.' + x.path : ''}：${x.message}`);
      }
    }
    if (isNumeric(d.type)) {
      if (!blank(d.min) && !blank(d.max) && d.min! > d.max!) add(i, 'max', '最大值不能小于最小值');
      if (!blank(d.step) && !(d.step! > 0)) add(i, 'step', '步长需大于 0');
    }
    if (isChoice(d.type)) {
      const opts = d.options ?? [];
      if (!opts.length) add(i, 'options', '至少需要一个选项');
      else if (opts.length > 50) add(i, 'options', '选项最多 50 个');
      else if (opts.some((o) => !o.value?.trim() || !o.label?.trim()))
        add(i, 'options', '选项的 value 与名称都必填');
      else if (opts.some((o) => Array.from(o.value).length > 64 || Array.from(o.label).length > 32))
        add(i, 'options', '选项 value 最多 64 个字符、名称最多 32 个字');
      else if (new Set(opts.map((o) => o.value)).size !== opts.length)
        add(i, 'options', '选项 value 不能重复');
    }
    const def = d.default;
    if (!blank(def)) {
      if (d.type === 'switch' && typeof def !== 'boolean') add(i, 'default', '开关默认值需为布尔');
      else if (isNumeric(d.type) && typeof def !== 'number') add(i, 'default', '默认值需为数字');
      else if (isTextual(d.type) && typeof def !== 'string') add(i, 'default', '默认值需为文字');
      else if (d.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(String(def)))
        add(i, 'default', '颜色格式如 #FF8800');
      else if (d.type === 'select' && !(d.options ?? []).some((o) => o.value === def))
        add(i, 'default', '默认值必须是某个选项');
      else if (
        d.type === 'multiselect' &&
        !(Array.isArray(def) && def.every((v) => (d.options ?? []).some((o) => o.value === v)))
      )
        add(i, 'default', '默认值必须是选项的子集');
    }
    if (d.visibleWhen && !blank(d.visibleWhen.key)) {
      const target = d.visibleWhen.key;
      if (target === d.key) add(i, 'visibleWhen', '不能依赖自己');
      else if (!drafts.some((x) => x.key === target))
        add(i, 'visibleWhen', `依赖的 key「${target}」不存在`);
      else {
        // 被依赖项只能是 select / switch / text，且自己不能再有 visibleWhen（单层条件）
        const dep = drafts.find((x) => x.key === target)!;
        if (!['select', 'switch', 'text'].includes(dep.type))
          add(i, 'visibleWhen', '只能依赖选择 / 开关 / 单行文字类入参');
        else if (dep.visibleWhen && !blank(dep.visibleWhen.key))
          add(i, 'visibleWhen', '被依赖的入参自己不能再有显示条件');
      }
      if (blank(d.visibleWhen.equals)) add(i, 'visibleWhen', '请填写 equals');
    }
  });
  return out;
}

/** 解析服务端错误路径 items[2].options → {index:2, field:'options'} */
export function parsePath(path?: string): { index: number; field: string } | null {
  const m = path?.match(/items\[(\d+)\](?:\.([A-Za-z]+))?/);
  return m ? { index: Number(m[1]), field: m[2] ?? '' } : null;
}

export function isVisible(s: SlotItem | SlotDraft, values: Record<string, unknown>): boolean {
  const w = s.visibleWhen;
  if (!w || blank(w.key)) return true;
  const v = values[w.key];
  return Array.isArray(v) ? v.includes(w.equals) : v === w.equals;
}

export interface SlotPreset {
  id: string;
  name: string;
  desc: string;
  config: SlotsConfig;
}

export const SLOT_PRESETS: SlotPreset[] = [
  {
    id: 'storefront',
    name: '门头照 + 店名',
    desc: '一张门头照，加一行店名',
    config: {
      schemaVersion: 1,
      items: [
        {
          key: 'storefront',
          type: 'image',
          label: '门头照',
          required: true,
          minCount: 1,
          maxCount: 1,
          guidance: '正对门头、光线均匀、完整露出招牌',
          order: 1,
        },
        {
          key: 'shop_name',
          type: 'text',
          label: '店名',
          required: true,
          maxLength: 16,
          placeholder: '如：悦足堂',
          order: 2,
        },
      ],
    },
  },
  {
    id: 'product',
    name: '商品图 1–3 + 价格 + 风格',
    desc: '最多 3 张商品图、一个价格、一个风格单选',
    config: {
      schemaVersion: 1,
      items: [
        {
          key: 'product_images',
          type: 'image',
          label: '商品图',
          required: true,
          minCount: 1,
          maxCount: 3,
          guidance: '白底或干净背景，主体居中',
          order: 1,
        },
        {
          key: 'price',
          type: 'price',
          label: '价格',
          required: true,
          min: 0,
          step: 0.01,
          unit: '元',
          order: 2,
        },
        {
          key: 'style',
          type: 'select',
          label: '风格',
          default: 'fresh',
          options: [
            { value: 'fresh', label: '清新' },
            { value: 'luxury', label: '高级' },
            { value: 'festive', label: '喜庆' },
          ],
          order: 3,
        },
      ],
    },
  },
  {
    id: 'video',
    name: '视频素材 + 口播文案',
    desc: '一段视频素材，加口播文案',
    config: {
      schemaVersion: 1,
      items: [
        {
          key: 'clip',
          type: 'video',
          label: '视频素材',
          required: true,
          minCount: 1,
          maxCount: 1,
          maxDurationSec: 30,
          acceptRatio: '9:16',
          guidance: '竖屏拍摄，30 秒内',
          order: 1,
        },
        {
          key: 'voiceover',
          type: 'textarea',
          label: '口播文案',
          required: true,
          maxLength: 200,
          placeholder: '写下想让数字人说的话',
          order: 2,
        },
      ],
    },
  },
];
