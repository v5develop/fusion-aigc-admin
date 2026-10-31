import { useAuthStore } from '@/stores/auth';

/**
 * 画布 / 提示词库后台的权限码：GET 要 view，强制失败 / 新建 / 编辑 / 启停要 update。
 * 规则同 studio-permission：精确匹配，不认 '*'。
 */
export const CANVAS_VIEW = 'canvas:view';
export const CANVAS_UPDATE = 'canvas:update';

export function hasCanvasPermission(code: string): boolean {
  const auth = useAuthStore();
  return (auth.user?.permissions ?? []).includes(code);
}
