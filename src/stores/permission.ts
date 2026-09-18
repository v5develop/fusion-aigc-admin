import type { AppRouteRecordRaw, MenuItem } from '@/types/router';
import type { RouteRecordRaw } from 'vue-router';

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { basicRoutes, asyncRoutes } from '@/router/routes';
import { filterRoutesByPermission, routesToMenuTree } from '@/router/utils';

function cloneRoutes(routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] {
  return routes.map((route) => ({
    ...route,
    meta: route.meta ? { ...route.meta } : undefined,
    children: route.children ? cloneRoutes(route.children) : undefined,
  }));
}

export const usePermissionStore = defineStore('permission', () => {
  const routes = ref<RouteRecordRaw[]>([]);
  const menuTree = ref<MenuItem[]>([]);
  const isRoutesGenerated = ref(false);

  const generateRoutes = async (
    _roles: string[],
    permissions: string[],
  ): Promise<RouteRecordRaw[]> => {
    const clonedAsyncRoutes = cloneRoutes(asyncRoutes);
    const clonedBasicChildren = cloneRoutes(basicRoutes.flatMap((route) => route.children || []));

    let accessedRoutes = filterRoutesByPermission(clonedAsyncRoutes, permissions);

    routes.value = accessedRoutes as unknown as RouteRecordRaw[];
    menuTree.value = routesToMenuTree([...clonedBasicChildren, ...accessedRoutes]);
    isRoutesGenerated.value = true;

    return routes.value;
  };

  const getAccessibleMenus = (permissions: string[]): MenuItem[] => {
    const hasAllPermission = permissions.includes('*');

    const filterMenu = (menus: MenuItem[]): MenuItem[] => {
      return menus
        .filter((menu) => {
          if (hasAllPermission) {
            return true;
          }
          if (!menu.requiredPermissions) {
            return true;
          }
          const perms = Array.isArray(menu.requiredPermissions)
            ? menu.requiredPermissions
            : [menu.requiredPermissions];
          if (perms.length === 0) {
            return true;
          }
          return perms.some((perm: string) => permissions.includes(perm));
        })
        .map((menu) => {
          if (menu.children) {
            return {
              ...menu,
              children: filterMenu(menu.children),
            };
          }
          return menu;
        });
    };

    return filterMenu(menuTree.value);
  };

  const setRoutes = (newRoutes: RouteRecordRaw[]) => {
    routes.value = newRoutes;
  };

  const setMenuTree = (newMenuTree: MenuItem[]) => {
    menuTree.value = newMenuTree;
  };

  const resetPermission = () => {
    routes.value = [];
    menuTree.value = [];
    isRoutesGenerated.value = false;
  };

  return {
    routes,
    menuTree,
    isRoutesGenerated,
    generateRoutes,
    getAccessibleMenus,
    setRoutes,
    setMenuTree,
    resetPermission,
  };
});
