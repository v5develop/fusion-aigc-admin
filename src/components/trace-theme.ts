import type { CSSProperties } from 'vue';

import { computed } from 'vue';

import { useThemeStore } from '@/stores/theme';

/**
 * 链路相关组件（耗时汇总 / 瀑布图 / 分析页 / 标签）共用的主题色工具。
 * 所有颜色都是「亮 / 暗」两套低饱和取值，由调用方按 isDark 取其一；组件内不再写死十六进制。
 */
export interface DualColor {
  light: string;
  dark: string;
}

export function pickColor(c: DualColor, dark: boolean): string {
  return dark ? c.dark : c.light;
}

/** 当前是否暗色（跟随 useThemeStore，含「跟随系统」） */
export function useIsDark() {
  const theme = useThemeStore();
  return computed(() => theme.isDark);
}

// ---------------- 色调（标签 / 状态点共用） ----------------
export type ToneName =
  | 'blue'
  | 'cyan'
  | 'gold'
  | 'gray'
  | 'green'
  | 'magenta'
  | 'orange'
  | 'purple'
  | 'red';

export const TONES: Record<ToneName, DualColor> = {
  green: { light: '#52b02c', dark: '#4f9a45' },
  red: { light: '#e5484d', dark: '#c9585b' },
  orange: { light: '#e07b39', dark: '#c4713f' },
  gold: { light: '#d89614', dark: '#b8923a' },
  blue: { light: '#1677ff', dark: '#4f8fd6' },
  cyan: { light: '#13a8a8', dark: '#3f9ea0' },
  purple: { light: '#8a4fd0', dark: '#9378c4' },
  magenta: { light: '#d4478a', dark: '#b8628c' },
  gray: { light: '#8c8c8c', dark: '#7a7a7a' },
};

/** 兼容 antd 预设色名 / 状态名 → 色调；未知回退 gray */
const TONE_ALIASES: Record<string, ToneName> = {
  success: 'green',
  error: 'red',
  warning: 'gold',
  processing: 'blue',
  default: 'gray',
  volcano: 'orange',
  geekblue: 'blue',
  lime: 'green',
  pink: 'magenta',
};

export function resolveTone(name: string | undefined | null): ToneName {
  if (!name) return 'gray';
  if (name in TONES) return name as ToneName;
  return TONE_ALIASES[name] ?? 'gray';
}

// ---------------- 取色 ----------------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 与黑 / 白混合：amt 0~1 */
export function mix(hex: string, target: '#000000' | '#ffffff', amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [tr, tg, tb] = hexToRgb(target);
  const f = (a: number, t: number) => Math.round(a + (t - a) * amt);
  return `#${[f(r, tr), f(g, tg), f(b, tb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 标签样式：亮色 = 浅底 + 深字；暗色 = 深色半透明底 + 亮字 + 细边。
 * solid 是该色调当前主题下的实色（TONES / 类别色）。
 */
export function tagStyle(solid: string, dark: boolean): CSSProperties {
  return dark
    ? {
        color: mix(solid, '#ffffff', 0.5),
        background: alpha(solid, 0.18),
        borderColor: alpha(solid, 0.45),
      }
    : {
        color: mix(solid, '#000000', 0.38),
        background: alpha(solid, 0.1),
        borderColor: alpha(solid, 0.35),
      };
}

// ---------------- 其它共用 token ----------------
/** 关键路径强调色（品牌紫，避开红色——红色只表示失败） */
export const ACCENT: DualColor = { light: '#722ed1', dark: '#a58de0' };

/** 瀑布图网格线 */
export const GRID_LINE: DualColor = { light: 'rgba(0, 0, 0, 0.06)', dark: 'rgba(255, 255, 255, 0.06)' };
