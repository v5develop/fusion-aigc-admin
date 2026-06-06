import type { AppRouteRecordRaw } from '@/types/router';

export const staticRoutes: AppRouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      title: 'Login',
      requiresAuth: false,
      hidden: true,
    },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: {
      title: '404',
      requiresAuth: false,
      hidden: true,
    },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: {
      title: '403',
      requiresAuth: false,
      hidden: true,
    },
  },
  {
    path: '/500',
    name: 'ServerError',
    component: () => import('@/views/error/500.vue'),
    meta: {
      title: '500',
      requiresAuth: false,
      hidden: true,
    },
  },
];

export const basicRoutes: AppRouteRecordRaw[] = [
  {
    path: '/',
    name: 'Root',
    redirect: '/dashboard',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'Dashboard',
      requiresAuth: true,
    },
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/redirect/index.vue'),
        meta: {
          title: 'Redirect',
          hidden: true,
        },
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: {
          title: 'menu.dashboard',
          icon: 'DashboardOutlined',
          requiresAuth: true,
          affix: true,
          order: 1,
        },
      },
    ],
  },
];

export const asyncRoutes: AppRouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Admin',
    redirect: '/admin/users',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.adminManagement',
      icon: 'TeamOutlined',
      requiresAuth: true,
      order: 10,
    },
    children: [
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/user/index.vue'),
        meta: {
          title: 'menu.adminUsers',
          icon: 'UserOutlined',
          requiresAuth: true,
          requiredPermissions: 'admin_user:view',
        },
      },
      {
        path: 'roles',
        name: 'AdminRoles',
        component: () => import('@/views/admin/role/index.vue'),
        meta: {
          title: 'menu.adminRoles',
          icon: 'SafetyOutlined',
          requiresAuth: true,
          requiredPermissions: 'admin_role:view',
        },
      },
      {
        path: 'permissions',
        name: 'AdminPermissions',
        component: () => import('@/views/admin/permission/index.vue'),
        meta: {
          title: 'menu.adminPermissions',
          icon: 'LockOutlined',
          requiresAuth: true,
          requiredPermissions: 'admin_role:view',
        },
      },
      {
        path: 'resources',
        name: 'AdminResources',
        component: () => import('@/views/admin/resource/index.vue'),
        meta: {
          title: 'menu.adminResources',
          icon: 'FolderOutlined',
          requiresAuth: true,
          requiredPermissions: 'admin_role:view',
        },
      },
    ],
  },
  {
    path: '/user',
    name: 'User',
    redirect: '/user/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.userManagement',
      icon: 'TeamOutlined',
      requiresAuth: true,
      order: 20,
    },
    children: [
      {
        path: 'list',
        name: 'UserList',
        component: () => import('@/views/user/list/index.vue'),
        meta: {
          title: 'menu.userList',
          icon: 'UserOutlined',
          requiresAuth: true,
          requiredPermissions: 'user:view',
        },
      },
      {
        path: 'detail/:id',
        name: 'UserDetail',
        component: () => import('@/views/user/detail/index.vue'),
        meta: {
          title: 'menu.userDetail',
          requiresAuth: true,
          hidden: true,
          requiredPermissions: 'user:view',
        },
      },
    ],
  },
  {
    path: '/feature',
    name: 'Feature',
    redirect: '/feature/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.featureManagement',
      icon: 'AppstoreOutlined',
      requiresAuth: true,
      order: 30,
    },
    children: [
      {
        path: 'list',
        name: 'FeatureList',
        component: () => import('@/views/feature/list/index.vue'),
        meta: {
          title: 'menu.featureList',
          icon: 'BarsOutlined',
          requiresAuth: true,
          requiredPermissions: 'feature:view',
        },
      },
      {
        path: 'model-mapping',
        name: 'FeatureModelMapping',
        component: () => import('@/views/feature/model-mapping/index.vue'),
        meta: {
          title: 'menu.featureModelMapping',
          icon: 'DeploymentUnitOutlined',
          requiresAuth: true,
          requiredPermissions: 'feature:manage',
        },
      },
      {
        path: 'grant',
        name: 'FeatureGrant',
        component: () => import('@/views/feature/grant/index.vue'),
        meta: {
          title: 'menu.featureGrant',
          icon: 'CloudDownloadOutlined',
          requiresAuth: true,
          requiredPermissions: 'feature:view',
        },
      },
      {
        path: 'change-log',
        name: 'FeatureChangeLog',
        component: () => import('@/views/feature/change-log/index.vue'),
        meta: {
          title: 'menu.featureChangeLog',
          icon: 'HistoryOutlined',
          requiresAuth: true,
          requiredPermissions: 'feature:view',
        },
      },
    ],
  },
  {
    path: '/model',
    name: 'Model',
    redirect: '/model/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.modelManagement',
      icon: 'RobotOutlined',
      requiresAuth: true,
      order: 40,
    },
    children: [
      {
        path: 'list',
        name: 'ModelList',
        component: () => import('@/views/model/list/index.vue'),
        meta: {
          title: 'menu.modelList',
          icon: 'CloudServerOutlined',
          requiresAuth: true,
          requiredPermissions: 'model:view',
        },
      },
      {
        path: 'pricing',
        name: 'ModelPricing',
        component: () => import('@/views/model/pricing/index.vue'),
        meta: {
          title: 'menu.modelPricing',
          icon: 'DollarOutlined',
          requiresAuth: true,
          requiredPermissions: 'pricing:view',
        },
      },
      {
        path: 'cost',
        name: 'ModelCost',
        component: () => import('@/views/model/cost/index.vue'),
        meta: {
          title: 'menu.modelCost',
          icon: 'LineChartOutlined',
          requiresAuth: true,
          requiredPermissions: 'cost:view',
        },
      },
    ],
  },
  {
    path: '/billing',
    name: 'Billing',
    redirect: '/billing/consumption',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.billingManagement',
      icon: 'AccountBookOutlined',
      requiresAuth: true,
      order: 50,
    },
    children: [
      {
        path: 'consumption',
        name: 'BillingConsumption',
        component: () => import('@/views/billing/consumption/index.vue'),
        meta: {
          title: 'menu.billingConsumption',
          icon: 'FileTextOutlined',
          requiresAuth: true,
          requiredPermissions: 'consumption:view',
        },
      },
      {
        path: 'points-log',
        name: 'BillingPointsLog',
        component: () => import('@/views/billing/points-log/index.vue'),
        meta: {
          title: 'menu.billingPointsLog',
          icon: 'TransactionOutlined',
          requiresAuth: true,
          requiredPermissions: 'points:view',
        },
      },
      {
        path: 'points-adjust',
        name: 'BillingPointsAdjust',
        component: () => import('@/views/billing/points-adjust/index.vue'),
        meta: {
          title: 'menu.billingPointsAdjust',
          icon: 'EditOutlined',
          requiresAuth: true,
          requiredPermissions: 'points:adjust',
        },
      },
      {
        path: 'exception',
        name: 'BillingException',
        component: () => import('@/views/billing/exception/index.vue'),
        meta: {
          title: 'menu.billingException',
          icon: 'WarningOutlined',
          requiresAuth: true,
          requiredPermissions: 'billing:exception',
        },
      },
    ],
  },
  {
    path: '/reconciliation',
    name: 'Reconciliation',
    redirect: '/reconciliation/summary',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.reconciliationManagement',
      icon: 'FileSyncOutlined',
      requiresAuth: true,
      order: 60,
    },
    children: [
      {
        path: 'summary',
        name: 'ReconciliationSummary',
        component: () => import('@/views/reconciliation/summary/index.vue'),
        meta: {
          title: 'menu.reconciliationSummary',
          icon: 'BarChartOutlined',
          requiresAuth: true,
          requiredPermissions: 'reconciliation:view',
        },
      },
      {
        path: 'difference',
        name: 'ReconciliationDifference',
        component: () => import('@/views/reconciliation/difference/index.vue'),
        meta: {
          title: 'menu.reconciliationDifference',
          icon: 'WarningOutlined',
          requiresAuth: true,
          requiredPermissions: 'reconciliation:handle',
        },
      },
    ],
  },
  {
    path: '/template',
    name: 'Template',
    redirect: '/template/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.templateManagement',
      icon: 'FormOutlined',
      requiresAuth: true,
      order: 80,
    },
    children: [
      {
        path: 'list',
        name: 'TemplateList',
        component: () => import('@/views/template/index.vue'),
        meta: {
          title: 'menu.templateList',
          icon: 'UnorderedListOutlined',
          requiresAuth: true,
          requiredPermissions: 'template:view',
        },
      },
      {
        path: 'create',
        name: 'TemplateCreate',
        component: () => import('@/views/template/TemplateEditor.vue'),
        meta: {
          title: 'menu.templateCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/template/list',
          requiredPermissions: 'template:create',
        },
      },
      {
        path: 'edit/:id',
        name: 'TemplateEdit',
        component: () => import('@/views/template/TemplateEditor.vue'),
        meta: {
          title: 'menu.templateEdit',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/template/list',
          requiredPermissions: 'template:edit',
        },
      },
    ],
  },
  {
    path: '/prompt',
    name: 'Prompt',
    redirect: '/prompt/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.promptManagement',
      icon: 'EditOutlined',
      requiresAuth: true,
      order: 81,
    },
    children: [
      {
        path: 'list',
        name: 'PromptList',
        component: () => import('@/views/prompt/index.vue'),
        meta: {
          title: 'menu.promptList',
          icon: 'UnorderedListOutlined',
          requiresAuth: true,
          requiredPermissions: 'prompt:view',
        },
      },
      {
        path: 'create',
        name: 'PromptCreate',
        component: () => import('@/views/prompt/PromptEditor.vue'),
        meta: {
          title: 'menu.promptCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/prompt/list',
          requiredPermissions: 'prompt:create',
        },
      },
      {
        path: 'edit/:id',
        name: 'PromptEdit',
        component: () => import('@/views/prompt/PromptEditor.vue'),
        meta: {
          title: 'menu.promptEdit',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/prompt/list',
          requiredPermissions: 'prompt:edit',
        },
      },
    ],
  },
  {
    path: '/settings',
    name: 'Settings',
    redirect: '/settings/union',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.systemSettings',
      icon: 'SettingOutlined',
      requiresAuth: true,
      order: 70,
    },
    children: [
      {
        path: 'union',
        name: 'SettingsUnion',
        component: () => import('@/views/settings/union/index.vue'),
        meta: {
          title: 'menu.settingsUnion',
          icon: 'LinkOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:union_config',
        },
      },
      {
        path: 'ai-provider',
        name: 'SettingsAIProvider',
        component: () => import('@/views/settings/ai-provider/index.vue'),
        meta: {
          title: 'menu.settingsAIProvider',
          icon: 'CloudOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:ai_config',
        },
      },
      {
        path: 'storage',
        name: 'SettingsStorage',
        component: () => import('@/views/settings/storage/index.vue'),
        meta: {
          title: 'menu.settingsStorage',
          icon: 'DatabaseOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:storage_config',
        },
      },
      {
        path: 'storage-system',
        name: 'SettingsStorageSystem',
        component: () => import('@/views/settings/storage-system/index.vue'),
        meta: {
          title: 'menu.settingsStorageSystem',
          icon: 'CloudServerOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:storage_config',
        },
      },
      {
        path: 'system',
        name: 'SettingsSystem',
        component: () => import('@/views/settings/system/index.vue'),
        meta: {
          title: 'menu.settingsSystem',
          icon: 'ToolOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:param_config',
        },
      },
    ],
  },
];
