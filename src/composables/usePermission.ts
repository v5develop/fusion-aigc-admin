import { computed } from 'vue';

import { useAuthStore } from '@/stores/auth';

/**
 * Permission composable
 */
export function usePermission() {
  const authStore = useAuthStore();

  const permissions = computed(() => authStore.user?.permissions ?? []);
  const roles = computed(() => authStore.user?.roles ?? []);

  /**
   * Check if user has permission
   */
  const can = (permission: string): boolean => {
    if (permissions.value.includes('*')) return true;
    return permissions.value.includes(permission);
  };

  /**
   * Check if user has any of the permissions
   */
  const canAny = (permissionList: string[]): boolean => {
    if (permissions.value.includes('*')) return true;
    return permissionList.some((p) => permissions.value.includes(p));
  };

  /**
   * Check if user has all permissions
   */
  const canAll = (permissionList: string[]): boolean => {
    if (permissions.value.includes('*')) return true;
    return permissionList.every((p) => permissions.value.includes(p));
  };

  /**
   * Check if user does not have permission
   */
  const cannot = (permission: string): boolean => {
    return !can(permission);
  };

  /**
   * Check if user has role
   */
  const hasRole = (role: string): boolean => {
    return roles.value.includes(role);
  };

  /**
   * Check if user has any of the roles
   */
  const hasAnyRole = (roleList: string[]): boolean => {
    return roleList.some((r) => roles.value.includes(r));
  };

  /**
   * Check if user has all roles
   */
  const hasAllRoles = (roleList: string[]): boolean => {
    return roleList.every((r) => roles.value.includes(r));
  };

  return {
    permissions,
    roles,
    can,
    canAny,
    canAll,
    cannot,
    hasRole,
    hasAnyRole,
    hasAllRoles,
  };
}
