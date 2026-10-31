import { useAuthStore } from '@/stores/auth';

/** 资产库后台权限码：GET 要 view（精确匹配，不认 '*'）。 */
export const ASSET_LIBRARY_VIEW = 'asset_library:view';

export function hasAssetLibraryPermission(code: string): boolean {
  const auth = useAuthStore();
  return (auth.user?.permissions ?? []).includes(code);
}
