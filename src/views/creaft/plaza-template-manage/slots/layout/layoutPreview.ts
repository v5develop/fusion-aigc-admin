/** 叠字预览的纯函数：折行、缩放、省略；canvas 绘制只依赖 measure 回调，便于单测 */
import { DEFAULT_COLOR, DEFAULT_LINE_HEIGHT, type TextLayout } from './layout-model';

export type Measure = (text: string, fontPx: number) => number;

const TOKEN_RE = /[^\s!-~]|[!-~]+\s*|\s+/g;

/** 单个超宽 token 按字符硬拆 */
function splitLong(tok: string, maxW: number, fontPx: number, measure: Measure): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const ch of Array.from(tok)) {
    if (cur && measure(cur + ch, fontPx) > maxW) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** 贪心折行：中文逐字、英文按词，支持 \n，超宽单词硬拆 */
export function wrapText(text: string, maxW: number, fontPx: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let cur = '';
    const toks = para.match(TOKEN_RE) ?? [];
    for (const tok of toks) {
      if (!cur || measure((cur + tok).trimEnd(), fontPx) <= maxW) {
        if (!cur && measure(tok.trimEnd(), fontPx) > maxW) {
          const parts = splitLong(tok.trimEnd(), maxW, fontPx, measure);
          lines.push(...parts.slice(0, -1));
          cur = parts[parts.length - 1] ?? '';
        } else cur += tok;
        continue;
      }
      lines.push(cur.trimEnd());
      cur = '';
      if (measure(tok.trimEnd(), fontPx) > maxW) {
        const parts = splitLong(tok.trimEnd(), maxW, fontPx, measure);
        lines.push(...parts.slice(0, -1));
        cur = parts[parts.length - 1] ?? '';
      } else cur = tok.trimStart();
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}

/** 把一行截到 maxW 内并以「…」结尾 */
export function ellipsize(line: string, maxW: number, fontPx: number, measure: Measure): string {
  const chars = Array.from(line);
  while (chars.length && measure(chars.join('') + '…', fontPx) > maxW) chars.pop();
  return chars.join('') + '…';
}

export interface FitResult {
  fontPx: number;
  lines: string[];
  lineHeightPx: number;
  truncated: boolean;
}

const MIN_FONT_PX = 6;

/** 在框内排版：指定 size 则固定字号（超出截断），否则二分求最大可容字号 */
export function fitText(
  text: string,
  boxWpx: number,
  boxHpx: number,
  imgHpx: number,
  layout: Pick<TextLayout, 'size' | 'maxLines' | 'lineHeight'>,
  measure: Measure,
): FitResult {
  const lh = layout.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const maxLines = layout.maxLines ?? Infinity;
  const fits = (fontPx: number) => {
    const lines = wrapText(text, boxWpx, fontPx, measure);
    return lines.length <= maxLines && lines.length * fontPx * lh <= boxHpx + 1e-6;
  };
  let fontPx: number;
  if (layout.size && layout.size > 0) fontPx = Math.max(1, layout.size * imgHpx);
  else {
    let lo = MIN_FONT_PX;
    let hi = Math.max(MIN_FONT_PX, boxHpx / lh);
    if (fits(hi)) lo = hi;
    else if (fits(lo)) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
    }
    fontPx = lo;
  }
  let lines = wrapText(text, boxWpx, fontPx, measure);
  const cap = Math.max(1, Math.min(maxLines, Math.floor(boxHpx / (fontPx * lh) + 1e-6)));
  let truncated = false;
  if (lines.length > cap) {
    truncated = true;
    lines = lines.slice(0, cap);
    lines[cap - 1] = ellipsize(lines[cap - 1], boxWpx, fontPx, measure);
  }
  return { fontPx, lines, lineHeightPx: fontPx * lh, truncated };
}

export interface DrawOptions {
  text: string;
  layout: TextLayout;
  font?: string;
}

export const PREVIEW_FONT_FAMILY =
  '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Heiti SC",sans-serif';

/** 在 ctx 上绘制一个 layout（W/H 为画布 css 像素尺寸，ctx 已按 dpr 缩放） */
export function drawLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  { text, layout }: DrawOptions,
): void {
  const { box } = layout;
  const bx = box.x * W;
  const by = box.y * H;
  const bw = box.w * W;
  const bh = box.h * H;
  const measure: Measure = (s, px) => {
    ctx.font = `${px}px ${PREVIEW_FONT_FAMILY}`;
    return ctx.measureText(s).width;
  };
  const fit = fitText(text, bw, bh, H, layout, measure);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.font = `${fit.fontPx}px ${PREVIEW_FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  const align = layout.align ?? 'center';
  ctx.textAlign = align;
  const ax = align === 'left' ? bx : align === 'right' ? bx + bw : bx + bw / 2;
  const total = fit.lines.length * fit.lineHeightPx;
  const valign = layout.valign ?? 'middle';
  const top = valign === 'top' ? by : valign === 'bottom' ? by + bh - total : by + (bh - total) / 2;
  const sw = layout.stroke && layout.stroke.width > 0 ? layout.stroke.width * H : 0;
  fit.lines.forEach((ln, i) => {
    const y = top + fit.lineHeightPx * (i + 0.5);
    if (sw) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = sw * 2;
      ctx.strokeStyle = layout.stroke?.color ?? '#000000';
      ctx.strokeText(ln, ax, y);
    }
    ctx.fillStyle = layout.color ?? DEFAULT_COLOR;
    ctx.fillText(ln, ax, y);
  });
  ctx.restore();
}
