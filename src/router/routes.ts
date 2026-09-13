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
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: {
          title: 'profile.title',
          requiresAuth: true,
          hidden: true,
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
    path: '/creation',
    name: 'Creation',
    redirect: '/creation/dashboard',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.creationManagement',
      icon: 'ThunderboltOutlined',
      requiresAuth: true,
      order: 25,
    },
    children: [
      {
        path: 'dashboard',
        name: 'CreationDashboard',
        component: () => import('@/views/creation/dashboard/index.vue'),
        meta: {
          title: 'menu.creationDashboard',
          icon: 'DashboardOutlined',
          requiresAuth: true,
          requiredPermissions: 'task:dashboard',
        },
      },
      {
        path: 'task',
        name: 'CreationTaskList',
        component: () => import('@/views/creation/task/index.vue'),
        meta: {
          title: 'menu.creationTaskList',
          icon: 'UnorderedListOutlined',
          requiresAuth: true,
          requiredPermissions: 'task:view',
        },
      },
      {
        path: 'content',
        name: 'CreationContentList',
        component: () => import('@/views/creation/content.vue'),
        meta: {
          title: 'menu.creationContentList',
          icon: 'PictureOutlined',
          requiresAuth: true,
          requiredPermissions: 'task:view',
        },
      },
      {
        path: 'task/detail/:id',
        name: 'CreationTaskDetail',
        component: () => import('@/views/creation/task/detail.vue'),
        meta: {
          title: 'menu.creationTaskDetail',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/creation/task',
          requiredPermissions: 'task:view',
        },
      },
      {
        path: 'moderation-log',
        name: 'ModerationLogList',
        component: () => import('@/views/creation/moderation-log/index.vue'),
        meta: {
          title: 'menu.moderationLog',
          icon: 'SafetyCertificateOutlined',
          requiresAuth: true,
          requiredPermissions: 'task:view',
        },
      },
      {
        path: 'backfill',
        name: 'CreationBackfill',
        component: () => import('@/views/creation/backfill.vue'),
        meta: {
          title: 'menu.creationBackfill',
          icon: 'DatabaseOutlined',
          requiresAuth: true,
          // 进页面只是看欠账；真正写库的按钮另按 task:force_complete 显隐
          requiredPermissions: 'task:view',
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
      {
        path: 'cost-pricing',
        name: 'ModelCostPricing',
        component: () => import('@/views/model/cost-pricing/index.vue'),
        meta: {
          title: 'menu.modelCostPricing',
          icon: 'ProfileOutlined',
          requiresAuth: true,
          requiredPermissions: 'cost_pricing:view',
        },
      },
      {
        path: 'margin',
        name: 'ModelMargin',
        component: () => import('@/views/model/margin/index.vue'),
        meta: {
          title: 'menu.modelMargin',
          icon: 'FundOutlined',
          requiresAuth: true,
          requiredPermissions: 'cost:view',
        },
      },
      {
        path: 'queue-monitor',
        name: 'ModelQueueMonitor',
        component: () => import('@/views/model/queue-monitor/index.vue'),
        meta: {
          title: 'menu.modelQueueMonitor',
          icon: 'DashboardOutlined',
          requiresAuth: true,
          requiredPermissions: 'model:view',
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
      {
        path: 'action-type',
        name: 'BillingActionType',
        component: () => import('@/views/billing/action-type/index.vue'),
        meta: {
          title: 'menu.billingActionType',
          icon: 'TagOutlined',
          requiresAuth: true,
          requiredPermissions: 'action_type:view',
        },
      },
      {
        path: 'offers',
        name: 'BillingOffer',
        component: () => import('@/views/billing/offer/index.vue'),
        meta: {
          title: 'menu.billingOffer',
          icon: 'ShopOutlined',
          requiresAuth: true,
          requiredPermissions: 'billing_offer:view',
        },
      },
      {
        path: 'rules',
        name: 'BillingRule',
        component: () => import('@/views/billing/rule/index.vue'),
        meta: {
          title: 'menu.billingRule',
          icon: 'ThunderboltOutlined',
          requiresAuth: true,
          requiredPermissions: 'billing_rule:view',
        },
      },
      {
        // 点数包是下单金额的唯一出处，权限跟定价同一把钥匙（pricing:update 才能改）
        path: 'points-packages',
        name: 'BillingPointsPackage',
        component: () => import('@/views/billing/points-package/index.vue'),
        meta: {
          title: 'menu.billingPointsPackage',
          icon: 'GiftOutlined',
          requiresAuth: true,
          requiredPermissions: 'pricing:view',
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
    path: '/template-asset',
    name: 'TemplateAsset',
    redirect: '/template-asset/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.templateAssetParent',
      icon: 'PictureOutlined',
      requiresAuth: true,
      order: 80.5,
    },
    children: [
      {
        path: 'list',
        name: 'TemplateAssetList',
        component: () => import('@/views/template-asset/index.vue'),
        meta: {
          title: 'menu.templateAssetList',
          requiresAuth: true,
          requiredPermissions: 'template_filter:view',
        },
      },
      {
        path: 'filter',
        name: 'TemplateFilterList',
        component: () => import('@/views/template-filter/index.vue'),
        meta: {
          title: 'menu.templateFilterList',
          requiresAuth: true,
          requiredPermissions: 'template_filter:view',
        },
      },
      {
        path: 'display',
        name: 'DisplayAssetList',
        component: () => import('@/views/display-asset/index.vue'),
        meta: {
          title: 'menu.displayAssetList',
          requiresAuth: true,
          requiredPermissions: 'display_asset:view',
        },
      },
      {
        path: 'display-category',
        name: 'DisplayCategoryList',
        component: () => import('@/views/display-asset/category.vue'),
        meta: {
          title: 'menu.displayCategoryList',
          requiresAuth: true,
          requiredPermissions: 'display_asset:view',
        },
      },
      {
        path: 'content-recommend',
        name: 'ContentRecommendList',
        component: () => import('@/views/display-asset/recommend.vue'),
        meta: {
          title: 'menu.contentRecommendList',
          requiresAuth: true,
          requiredPermissions: 'content_recommend:view',
        },
      },
      {
        path: 'entry-route',
        name: 'CreationEntryRouteList',
        component: () => import('@/views/display-asset/entry-route.vue'),
        meta: {
          title: 'menu.entryRouteList',
          requiresAuth: true,
          requiredPermissions: 'display_asset:view',
        },
      },
      {
        path: 'asset-category',
        name: 'AssetCategoryList',
        component: () => import('@/views/display-asset/asset-category.vue'),
        meta: {
          title: 'menu.assetCategoryList',
          requiresAuth: true,
          requiredPermissions: 'asset_category:view',
        },
      },
      {
        // 用户素材（afv_asset，产物粒度），与上面的「灵感素材」「素材分类」不是一回事，
        // 各自套自己的权限：只有 display_asset:view 的运营进不来这页
        path: 'user-asset',
        name: 'UserAssetList',
        component: () => import('@/views/display-asset/user-asset.vue'),
        meta: {
          title: 'menu.userAssetList',
          requiresAuth: true,
          requiredPermissions: 'user_asset:view',
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
    path: '/prompt-lab',
    name: 'PromptLab',
    redirect: '/prompt-lab/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.promptLab',
      icon: 'ExperimentOutlined',
      requiresAuth: true,
      order: 82,
    },
    children: [
      {
        path: 'list',
        name: 'PromptLabList',
        component: () => import('@/views/prompt-lab/index.vue'),
        meta: {
          title: 'menu.promptLabList',
          icon: 'UnorderedListOutlined',
          requiresAuth: true,
          requiredPermissions: 'prompt_lab:view',
        },
      },
      {
        path: 'create',
        name: 'PromptLabCreate',
        component: () => import('@/views/prompt-lab/create.vue'),
        meta: {
          title: 'menu.promptLabCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/prompt-lab/list',
          requiredPermissions: 'prompt_lab:create',
        },
      },
      {
        path: 'test',
        name: 'PromptLabTest',
        component: () => import('@/views/prompt-lab/test-console.vue'),
        meta: {
          title: 'menu.promptLabTest',
          icon: 'ExperimentOutlined',
          requiresAuth: true,
          requiredPermissions: 'prompt_lab:test',
        },
      },
      {
        path: 'meta',
        name: 'PromptLabMeta',
        component: () => import('@/views/prompt-lab/meta.vue'),
        meta: {
          title: 'menu.promptLabMeta',
          icon: 'TagsOutlined',
          requiresAuth: true,
          requiredPermissions: 'prompt_lab:view',
        },
      },
      {
        path: 'detail/:id',
        name: 'PromptLabDetail',
        component: () => import('@/views/prompt-lab/detail.vue'),
        meta: {
          title: 'menu.promptLabDetail',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/prompt-lab/list',
          requiredPermissions: 'prompt_lab:view',
        },
      },
      {
        path: 'editor/:promptId',
        name: 'PromptLabEditor',
        component: () => import('@/views/prompt-lab/editor.vue'),
        meta: {
          title: 'menu.promptLabEditor',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/prompt-lab/list',
          requiredPermissions: 'prompt_lab:edit',
        },
      },
    ],
  },
  {
    path: '/mode',
    name: 'Mode',
    redirect: '/mode/list',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.modeManagement',
      icon: 'PartitionOutlined',
      requiresAuth: true,
      order: 83,
    },
    children: [
      {
        path: 'flows',
        name: 'ModeFlows',
        component: () => import('@/views/mode/flow-list.vue'),
        meta: {
          title: 'menu.modeFlows',
          icon: 'PartitionOutlined',
          requiresAuth: true,
          requiredPermissions: 'mode:view',
        },
      },
      {
        path: 'flows/:flowId/versions',
        name: 'ModeFlowVersions',
        component: () => import('@/views/mode/flow-versions.vue'),
        meta: {
          title: 'menu.modeFlowVersions',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/mode/flows',
          requiredPermissions: 'mode:view',
        },
      },
      {
        path: 'flow-editor/:flowId',
        name: 'ModeFlowEditor',
        component: () => import('@/views/mode/flow-editor.vue'),
        meta: {
          title: 'menu.modeFlowEditor',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/mode/flows',
          requiredPermissions: 'mode:edit',
        },
      },
      {
        path: 'list',
        name: 'ModeList',
        component: () => import('@/views/mode/index.vue'),
        meta: {
          title: 'menu.modeList',
          icon: 'ApartmentOutlined',
          requiresAuth: true,
          requiredPermissions: 'mode:view',
        },
      },
    ],
  },
  {
    path: '/settings',
    name: 'Settings',
    redirect: '/settings/ai-provider',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.systemSettings',
      icon: 'SettingOutlined',
      requiresAuth: true,
      order: 70,
    },
    children: [
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
      {
        path: 'user-level',
        name: 'SettingsUserLevel',
        component: () => import('@/views/settings/user-level/index.vue'),
        meta: {
          title: 'menu.settingsUserLevel',
          icon: 'TrophyOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:param_config',
        },
      },
      {
        path: 'check-in',
        name: 'SettingsCheckIn',
        component: () => import('@/views/settings/check-in/index.vue'),
        meta: {
          title: 'menu.settingsCheckIn',
          icon: 'CalendarOutlined',
          requiresAuth: true,
          requiredPermissions: 'system:param_config',
        },
      },
      {
        // 通知有自己的一组权限码（notification:view/publish/delete，V1.0.99 落库），
        // 不跟着系统参数走：发公告与改系统参数是两类完全不同的授权
        path: 'notification',
        name: 'SettingsNotification',
        component: () => import('@/views/settings/notification/index.vue'),
        meta: {
          title: 'menu.settingsNotification',
          icon: 'NotificationOutlined',
          requiresAuth: true,
          requiredPermissions: 'notification:view',
        },
      },
    ],
  },
  {
    path: '/open-platform',
    name: 'OpenPlatform',
    redirect: '/open-platform/apps',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.openPlatform',
      icon: 'ApiOutlined',
      requiresAuth: true,
      order: 1000,
    },
    children: [
      {
        path: 'apps',
        name: 'OpenPlatformApps',
        component: () => import('@/views/settings/open-app/index.vue'),
        meta: {
          title: 'menu.openPlatformApps',
          icon: 'AppstoreOutlined',
          requiresAuth: true,
          requiredPermissions: 'open:app:query',
        },
      },
      {
        path: 'union',
        name: 'OpenPlatformUnion',
        component: () => import('@/views/settings/union/index.vue'),
        meta: {
          title: 'menu.openPlatformUnion',
          icon: 'LinkOutlined',
          requiresAuth: true,
        },
      },
    ],
  },
];
