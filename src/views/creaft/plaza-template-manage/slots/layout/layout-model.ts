/** 文字叠加 layout v1（相对画面坐标）。与服务端同口径校验；未知键原样保留。 */

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface LayoutStroke {
  color?: string;
  width: number;
}
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface TextLayout {
  box: LayoutBox;
  size?: number;
  color?: string;
  align?: HAlign;
  valign?: VAlign;
  stroke?: LayoutStroke;
  maxLines?: number;
  lineHeight?: number;
  fontRid?: string;
  defaultText?: string;
  [unknown: string]: unknown;
}

export const DEFAULT_COLOR = '#FFFFFF';
export const DEFAULT_LINE_HEIGHT = 1.2;
export const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const EPS = 1e-9;

export const DEFAULT_LAYOUT = (): TextLayout => ({ box: { x: 0.1, y: 0.8, w: 0.8, h: 0.12 } });

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const len = (s: string) => Array.from(s).length;

export interface LayoutIssue {
  /** 相对 layout 的路径，如 box.x */
  path: string;
  message: string;
}

/** 校验已解析的 layout 对象；返回全部问题 */
export function validateLayout(raw: unknown): LayoutIssue[] {
  const out: LayoutIssue[] = [];
  const add = (path: string, message: string) => out.push({ path, message });
  if (!isObj(raw)) return [{ path: '', message: 'layout 必须是对象' }];

  const box = raw.box;
  if (!isObj(box)) add('box', 'box 必填，需包含 x/y/w/h');
  else {
    for (const k of ['x', 'y'] as const) {
      const v = box[k];
      if (!isNum(v) || v < 0 || v > 1) add(`box.${k}`, `${k} 需为 0~1 的数字`);
    }
    for (const k of ['w', 'h'] as const) {
      const v = box[k];
      if (!isNum(v) || v <= 0 || v > 1) add(`box.${k}`, `${k} 需大于 0 且不超过 1`);
    }
    if (isNum(box.x) && isNum(box.w) && box.w > 0 && box.x + box.w > 1 + EPS)
      add('box.w', 'x + w 不能超过 1');
    if (isNum(box.y) && isNum(box.h) && box.h > 0 && box.y + box.h > 1 + EPS)
      add('box.h', 'y + h 不能超过 1');
  }
  if (raw.size !== undefined && (!isNum(raw.size) || raw.size < 0 || raw.size > 0.5))
    add('size', 'size 需为 0~0.5 的数字（0 或不填 = 按框自适应）');
  if (raw.color !== undefined && !(typeof raw.color === 'string' && COLOR_RE.test(raw.color)))
    add('color', 'color 格式应为 #RRGGBB 或 #RRGGBBAA');
  if (raw.align !== undefined && !['left', 'center', 'right'].includes(raw.align as string))
    add('align', 'align 只能是 left / center / right');
  if (raw.valign !== undefined && !['top', 'middle', 'bottom'].includes(raw.valign as string))
    add('valign', 'valign 只能是 top / middle / bottom');
  if (raw.stroke !== undefined) {
    const s = raw.stroke;
    if (!isObj(s)) add('stroke', 'stroke 必须是对象');
    else {
      if (s.color !== undefined && !(typeof s.color === 'string' && COLOR_RE.test(s.color)))
        add('stroke.color', '描边颜色格式应为 #RRGGBB 或 #RRGGBBAA');
      if (!isNum(s.width) || s.width < 0 || s.width > 0.05)
        add('stroke.width', '描边粗细需为 0~0.05 的数字');
    }
  }
  if (
    raw.maxLines !== undefined &&
    !(isNum(raw.maxLines) && Number.isInteger(raw.maxLines) && raw.maxLines >= 1 && raw.maxLines <= 10)
  )
    add('maxLines', 'maxLines 需为 1~10 的整数');
  if (raw.lineHeight !== undefined && (!isNum(raw.lineHeight) || raw.lineHeight < 0.8 || raw.lineHeight > 3))
    add('lineHeight', 'lineHeight 需为 0.8~3 的数字');
  if (raw.fontRid !== undefined) {
    if (typeof raw.fontRid !== 'string' || !raw.fontRid.trim()) add('fontRid', 'fontRid 不能为空（不用请删除）');
    else if (len(raw.fontRid) > 128) add('fontRid', 'fontRid 最长 128 个字符');
  }
  if (raw.defaultText !== undefined) {
    if (typeof raw.defaultText !== 'string') add('defaultText', 'defaultText 需为文字');
    else if (len(raw.defaultText) > 100) add('defaultText', 'defaultText 最多 100 个字');
  }
  return out;
}

/** 解析 layoutText：空 → {ok, value: undefined}；非法 JSON → {ok:false} */
export function parseLayoutText(
  text?: string,
): { ok: true; value: unknown } | { ok: false } {
  if (!text?.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** 序列化回草稿文本；undefined → undefined（保存时不带 layout 键） */
export function stringifyLayout(layout: unknown): string | undefined {
  return layout === undefined ? undefined : JSON.stringify(layout, null, 2);
}

/** 可容错地取出可预览的 layout（非法返回 null） */
export function tolerantLayout(text?: string): TextLayout | null {
  const p = parseLayoutText(text);
  if (!p.ok || !isObj(p.value) || !isObj(p.value.box)) return null;
  const b = p.value.box;
  if (![b.x, b.y, b.w, b.h].every(isNum)) return null;
  return p.value as TextLayout;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** 把框限制到 0~1 内且 x+w≤1、y+h≤1、w/h≥minSize */
export function clampBox(b: LayoutBox, minSize = 0.01): LayoutBox {
  const w = clamp(b.w, minSize, 1);
  const h = clamp(b.h, minSize, 1);
  const x = clamp(b.x, 0, 1 - w);
  const y = clamp(b.y, 0, 1 - h);
  return { x: round4(x), y: round4(y), w: round4(w), h: round4(h) };
}
