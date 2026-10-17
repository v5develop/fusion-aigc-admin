import { useAuthStore } from '@/stores/auth';

/**
 * 本地生活后台的权限码，与 Go 服务的校验一一对应（见 fusion_aigc_go 的迁移 Go_V1.0.14）：
 * GET 要 view，增删改要 update。
 *
 * 只做精确匹配，不认 '*'：Go 端没有通配，Java 的 /auth/info 返回的也是库里的真实权限码，
 * 前端放行的范围不能比服务端宽，否则会出现「看得到按钮、点了 403」。
 */
export const LOCAL_LIFE_VIEW = 'local_life:view';
export const LOCAL_LIFE_UPDATE = 'local_life:update';

export function hasLocalLifePermission(code: string): boolean {
  const auth = useAuthStore();
  return (auth.user?.permissions ?? []).includes(code);
}
