import { useAuthStore } from '@/stores/auth';

/**
 * 创作商拍后台的权限码，与 Go 服务的校验一一对应：
 * GET 要 view，重做 / 强制失败要 update。规则同 local-life-permission：精确匹配，不认 '*'。
 */
export const STUDIO_VIEW = 'studio:view';
export const STUDIO_UPDATE = 'studio:update';

export function hasStudioPermission(code: string): boolean {
  const auth = useAuthStore();
  return (auth.user?.permissions ?? []).includes(code);
}
