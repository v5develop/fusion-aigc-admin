import type { Router, RouteLocationNormalized } from 'vue-router';

import { $t } from '@/locales';
import { useAuthStore } from '@/stores/auth';
import { usePermissionStore } from '@/stores/permission';
import { useTabsStore } from '@/stores/tabs';

import { basicRoutes } from './routes';

const MENU_HISTORY_KEY = 'app-menu-history';
const MAX_HISTORY_ITEMS = 10;

interface MenuHistoryItem {
  path: string;
  title: string;
  icon?: string;
  timestamp: number;
}

function recordMenuHistory(route: RouteLocationNormalized) {
  try {
    const history: MenuHistoryItem[] = JSON.parse(localStorage.getItem(MENU_HISTORY_KEY) || '[]');
    const title = String(route.meta?.title || route.name || route.path);

    const filtered = history.filter((item) => item.path !== route.path);

    filtered.unshift({
      path: route.path,
      title,
      icon: route.meta?.icon as string,
      timestamp: Date.now(),
    });

    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(MENU_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Setup router guards
 */
export function setupRouterGuards(router: Router) {
  // Before each route navigation
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore();
    const tabsStore = useTabsStore();

    const initTabsIfNeeded = () => {
      if (tabsStore.tabs.length > 0) return;

      const routeSources = [...basicRoutes];

      tabsStore.restoreTabsState(routeSources);

      if (tabsStore.tabs.length === 0) {
        tabsStore.initAffixTabs(routeSources);
      }
    };

    // Set page title
    if (to.meta.title) {
      const titleKey = String(to.meta.title);
      const translatedTitle = $t(titleKey);
      const appName = $t('common.appName');
      document.title = `${translatedTitle} - ${appName}`;
    }

    // Check if route requires authentication
    const requiresAuth = to.meta.requiresAuth !== false;

    if (requiresAuth) {
      // Check if user is logged in
      if (!authStore.isLoggedIn) {
        // Redirect to login page
        next({
          path: '/login',
          query: { redirect: to.fullPath },
        });
        return;
      }

      // Generate routes and menu tree if not already done
      const permissionStore = usePermissionStore();
      if (!permissionStore.isRoutesGenerated) {
        try {
          const roles = authStore.user?.roles ?? []
          // super_admin gets all routes, others get based on roles
          const permissions = roles.includes('super_admin') ? ['*'] : roles
          const accessedRoutes = await permissionStore.generateRoutes(roles, permissions)
          
          // Add dynamic routes to router
          accessedRoutes.forEach((route) => {
            router.addRoute(route)
          })
          
          // Retry the current navigation with newly added routes
          next({ ...to, replace: true })
          return
        } catch (error) {
          console.error('Failed to generate routes:', error);
        }
      }

      initTabsIfNeeded();
    }

    // Add to tabs. The tabs store handles hidden routes with activeMenu by
    // ensuring their parent list tab is present instead of adding a new tab.
    if (to.name && to.meta.requiresAuth !== false) {
      tabsStore.addTab(to);
    }

    next();
  });

  // After each route navigation
  router.afterEach((to) => {
    // Scroll to top
    window.scrollTo(0, 0);

    // Set active tab. Hidden pages can declare activeMenu so their parent list
    // tab stays highlighted and present after a direct refresh.
    const tabsStore = useTabsStore();
    const activeTabPath = to.meta.activeMenu ? String(to.meta.activeMenu) : to.path;
    if (activeTabPath) {
      tabsStore.setActiveTab(activeTabPath);
    }

    // Record menu visit history
    if (to.name && to.meta.requiresAuth !== false && !to.meta.hidden) {
      recordMenuHistory(to);
    }
  });

  // On error
  router.onError((error) => {
    console.error('Router error:', error);
  });
}
