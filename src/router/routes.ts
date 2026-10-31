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
        path: 'cover-pending',
        name: 'CreationCoverPending',
        component: () => import('@/views/creation/cover-pending.vue'),
        meta: {
          title: 'menu.creationCoverPending',
          icon: 'PictureOutlined',
          requiresAuth: true,
          requiredPermissions: 'task:view',
        },
      },
      {
        path: 'free-video-pending',
        name: 'CreationFreeVideoPending',
        component: () => import('@/views/creation/free-video-pending.vue'),
        meta: {
          title: 'menu.creationFreeVideoPending',
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
        path: 'reconcile',
        name: 'BillingReconcile',
        component: () => import('@/views/billing/reconcile/index.vue'),
        meta: {
          title: 'menu.billingReconcile',
          icon: 'AuditOutlined',
          requiresAuth: true,
          requiredPermissions: 'reconciliation:handle',
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
      // 这四条从 /billing 挪到了 /creaft（见下方 Creaft 管理分组）。
      // 留重定向而不是直接删：这些路径发给过运营与对接方，删掉就是 404，
      // 而 404 不会告诉人"它搬去哪儿了"。hidden 让它们不进菜单。
      {
        path: 'creaft-bindings',
        name: 'CreaftBindingMoved',
        redirect: '/workflow/bindings',
        meta: { title: 'menu.creaftBinding', hidden: true, requiresAuth: true },
      },
      {
        path: 'creaft-catalog',
        name: 'CreaftCatalogMoved',
        redirect: '/creaft/catalog',
        meta: { title: 'menu.creaftCatalog', hidden: true, requiresAuth: true },
      },
      {
        path: 'creaft-templates',
        name: 'CreaftTemplateMoved',
        redirect: '/creaft/plaza-templates',
        meta: { title: 'menu.creaftPlazaTemplate', hidden: true, requiresAuth: true },
      },
      {
        path: 'creaft-skills',
        name: 'CreaftSkillMoved',
        redirect: '/creaft/skills',
        meta: { title: 'menu.creaftSkill', hidden: true, requiresAuth: true },
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
    // creaft v1 兼容面的后台：能力绑定、目录、公共模板、技能目录。
    // 这四页原先挂在「计费管理」下，但只有「能力绑定」与计费真有关系——
    // 目录/模板/技能是运营内容配置，放在计费里既不好找，也会让人以为改它们会动钱。
    path: '/creaft',
    name: 'Creaft',
    redirect: '/creaft/catalog',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.creaftManagement',
      icon: 'ApiOutlined',
      requiresAuth: true,
      order: 55,
    },
    children: [
      {
        // 工具就绪页已搬到「工作流 → 能力」下，旧链接转过去
        path: 'tool-readiness',
        name: 'CreaftToolReadinessMoved',
        redirect: '/workflow/capabilities/tool-readiness',
        meta: { title: 'menu.creaftToolReadiness', hidden: true, requiresAuth: true },
      },
      {
        path: 'catalog',
        name: 'CreaftCatalog',
        component: () => import('@/views/creaft/catalog/index.vue'),
        meta: {
          title: 'menu.creaftCatalog',
          icon: 'ProfileOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // 创意广场模板：读 /plaza-templates/*（带标签、多标签取并集）。此前没有任何管理入口，铺数据只能直连 SQL——
        // 而没数据时下发接口照样回 200 + 空信封，端上分不清「没铺」和「没通」
        path: 'plaza-templates',
        name: 'CreaftPlazaTemplate',
        component: () => import('@/views/creaft/plaza-template/index.vue'),
        meta: {
          title: 'menu.creaftPlazaTemplate',
          icon: 'AppstoreOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // 用户自建本地生活模板：只读。这是用户的私有内容，后台不代改、不代删；查看详情写审计
        path: 'user-local-life-templates',
        name: 'CreaftUserLocalLifeTemplate',
        component: () => import('@/views/creaft/user-local-life-template/index.vue'),
        meta: {
          title: 'menu.creaftUserLocalLifeTemplate',
          icon: 'UserOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // 本地生活官方模板：读 /local-life-templates/*（按分类筛）。与创意广场分表、分菜单管理
        path: 'local-life-templates',
        name: 'CreaftLocalLifeTemplate',
        component: () => import('@/views/creaft/local-life-template/index.vue'),
        meta: {
          title: 'menu.creaftLocalLifeTemplate',
          icon: 'EnvironmentOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // 技能编辑独立页：单条技能的提示词上万字，放弹窗里只能层层滚动、点遮罩就全丢
        path: 'skills/:id/edit',
        name: 'CreaftSkillEdit',
        component: () => import('@/views/creaft/skill/edit.vue'),
        meta: {
          title: 'menu.creaftSkillEdit',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/creaft/skills',
          requiredPermissions: 'creaft_catalog:edit',
        },
      },
      {
        // /voices/list 的数据源：没有启用的音色时，视频翻译选不了音色
        path: 'voices',
        name: 'CreaftVoice',
        component: () => import('@/views/creaft/voice/index.vue'),
        meta: {
          title: 'menu.creaftVoice',
          icon: 'SoundOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // 批量托管（电商生图）的技能绑定。这张表此前没有任何写入口——建表与加列的迁移都只改结构，
        // 没有一条往里插过数据，所以上线至今只可能是空的，用户点批量托管必然报「尚未配置」
        path: 'batch-bindings',
        name: 'CreaftBatchBinding',
        component: () => import('@/views/creaft/batch-binding/index.vue'),
        meta: {
          title: 'menu.creaftBatchBinding',
          icon: 'BlockOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        // @技能 列表的数据源。分类为空的行会被整行跳过，所以「弹窗空着」多半是这页没配
        path: 'skills',
        name: 'CreaftSkill',
        component: () => import('@/views/creaft/skill/index.vue'),
        meta: {
          title: 'menu.creaftSkill',
          icon: 'ExperimentOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
    ],
  },
  {
    path: '/workflow',
    name: 'Workflow',
    redirect: '/workflow/definitions',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.workflowManagement',
      icon: 'ApartmentOutlined',
      requiresAuth: true,
      order: 26,
    },
    children: [
      {
        path: 'definitions',
        name: 'WorkflowDefinitions',
        component: () => import('@/views/workflow-definition/index.vue'),
        meta: {
          title: 'menu.workflowDefinition',
          icon: 'ApartmentOutlined',
          requiresAuth: true,
          requiredPermissions: 'mode:view',
        },
      },
      {
        path: 'definitions/:id',
        name: 'WorkflowDefinitionDetail',
        component: () => import('@/views/workflow-definition/detail.vue'),
        meta: {
          title: 'menu.workflowDefinition',
          requiresAuth: true,
          hidden: true,
          requiredPermissions: 'mode:view',
        },
      },
      {
        // 配的是"这条路由用哪个模型按哪条价计费、卖不卖"——这一页仍与计费强相关，
        // 所以权限是独立的 creaft_binding:*，与下面三页的 creaft_catalog:* 分开
        path: 'bindings',
        name: 'CreaftBinding',
        component: () => import('@/views/creaft/binding/index.vue'),
        meta: {
          title: 'menu.creaftBinding',
          icon: 'ApiOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_binding:view',
        },
      },
      {
        // 只读：creaft 工具各档与工作流定义所用模型组的网关就绪状态与原因，
        // 回答「用户为什么读不到某一档」「哪条定义的模型组没就绪」
        path: 'capabilities/tool-readiness',
        name: 'CreaftToolReadiness',
        component: () => import('@/views/creaft/readiness/index.vue'),
        meta: {
          title: 'menu.creaftToolReadiness',
          icon: 'CheckCircleOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_binding:view',
        },
      },
      {
        // /workflows/templates/{category} 的数据源。某分类一条都没启用时下发接口退回旧列表，
        // 所以「端上只有一条 video」多半是这页没导入 / 没启用
        path: 'workflow-templates',
        name: 'CreaftWorkflowTemplate',
        component: () => import('@/views/creaft/workflow-template/index.vue'),
        meta: {
          title: 'menu.creaftWorkflowTemplate',
          icon: 'PartitionOutlined',
          requiresAuth: true,
          requiredPermissions: 'creaft_catalog:view',
        },
      },
      {
        path: 'modes/flows',
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
        path: 'modes/flows/:flowId/versions',
        name: 'ModeFlowVersions',
        component: () => import('@/views/mode/flow-versions.vue'),
        meta: {
          title: 'menu.modeFlowVersions',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/workflow/modes/flows',
          requiredPermissions: 'mode:view',
        },
      },
      {
        path: 'modes/flow-editor/:flowId',
        name: 'ModeFlowEditor',
        component: () => import('@/views/mode/flow-editor.vue'),
        meta: {
          title: 'menu.modeFlowEditor',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/workflow/modes/flows',
          requiredPermissions: 'mode:view',
        },
      },
      {
        // Mode 节点页已下线（旧编辑器的积木，不是可切换单位），旧链接转到 Mode 流列表
        path: 'modes/list',
        name: 'ModeList',
        redirect: '/workflow/modes/flows',
        meta: { title: 'menu.modeList', hidden: true, requiresAuth: true },
      },
    ],
  },
  {
    // AI 网关：供应商、账户、密钥、部署、模型组、价格、配置发布、运行态、调用与告警。
    // 数据全在网关，Java 只做通用透传（/api/v1/admin/ai-gateway/** → 网关 /admin/v1/**），
    // 表单由网关下发的 JSON Schema 渲染，网关加配置项这里不用改。
    // 权限：ai_gateway:view 看；ai_gateway:config 改草稿/发布/回滚；ai_gateway:secret 写密钥；
    // ai_gateway:runtime 强制动作与探测。
    path: '/ai-gateway',
    name: 'AiGateway',
    redirect: '/ai-gateway/providers',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.aiGatewayManagement',
      icon: 'GatewayOutlined',
      requiresAuth: true,
      order: 57,
    },
    children: [
      {
        path: 'providers',
        name: 'AiGatewayProviders',
        component: () => import('@/views/ai-gateway/providers/index.vue'),
        meta: {
          title: 'menu.aiGatewayProviders',
          icon: 'CloudServerOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'accounts',
        name: 'AiGatewayAccounts',
        component: () => import('@/views/ai-gateway/accounts/index.vue'),
        meta: {
          title: 'menu.aiGatewayAccounts',
          icon: 'IdcardOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'secrets',
        name: 'AiGatewaySecrets',
        component: () => import('@/views/ai-gateway/secrets/index.vue'),
        meta: {
          title: 'menu.aiGatewaySecrets',
          icon: 'KeyOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'deployments',
        name: 'AiGatewayDeployments',
        component: () => import('@/views/ai-gateway/deployments/index.vue'),
        meta: {
          title: 'menu.aiGatewayDeployments',
          icon: 'ClusterOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'model-groups',
        name: 'AiGatewayModelGroups',
        component: () => import('@/views/ai-gateway/model-groups/index.vue'),
        meta: {
          title: 'menu.aiGatewayModelGroups',
          icon: 'AppstoreAddOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'pricing',
        name: 'AiGatewayPricing',
        component: () => import('@/views/ai-gateway/pricing/index.vue'),
        meta: {
          title: 'menu.aiGatewayPricing',
          icon: 'MoneyCollectOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        // 输入来源白名单：管理端写草稿，发布后生效（替代原先只能设环境变量的 AIG_INPUT_SOURCE_HOSTS）
        path: 'input-sources',
        name: 'AiGatewayInputSources',
        component: () => import('@/views/ai-gateway/input-sources/index.vue'),
        meta: {
          title: 'menu.aiGatewayInputSources',
          icon: 'LinkOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'config-versions',
        name: 'AiGatewayConfigVersions',
        component: () => import('@/views/ai-gateway/config-versions/index.vue'),
        meta: {
          title: 'menu.aiGatewayConfigVersions',
          icon: 'HistoryOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'runtime',
        name: 'AiGatewayRuntime',
        component: () => import('@/views/ai-gateway/runtime/index.vue'),
        meta: {
          title: 'menu.aiGatewayRuntime',
          icon: 'DashboardOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'calls',
        name: 'AiGatewayCalls',
        component: () => import('@/views/ai-gateway/calls/index.vue'),
        meta: {
          title: 'menu.aiGatewayCalls',
          icon: 'SearchOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
        },
      },
      {
        path: 'alerts',
        name: 'AiGatewayAlerts',
        component: () => import('@/views/ai-gateway/alerts/index.vue'),
        meta: {
          title: 'menu.aiGatewayAlerts',
          icon: 'AlertOutlined',
          requiresAuth: true,
          requiredPermissions: 'ai_gateway:view',
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
    path: '/content',
    name: 'Content',
    redirect: '/content/templates',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.groupContent',
      icon: 'FileTextOutlined',
      requiresAuth: true,
      order: 80,
    },
    children: [
      {
        path: 'templates',
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
        path: 'templates/create',
        name: 'TemplateCreate',
        component: () => import('@/views/template/TemplateEditor.vue'),
        meta: {
          title: 'menu.templateCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/templates',
          requiredPermissions: 'template:create',
        },
      },
      {
        path: 'templates/edit/:id',
        name: 'TemplateEdit',
        component: () => import('@/views/template/TemplateEditor.vue'),
        meta: {
          title: 'menu.templateEdit',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/templates',
          requiredPermissions: 'template:edit',
        },
      },
      {
        path: 'prompts',
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
        path: 'prompts/create',
        name: 'PromptCreate',
        component: () => import('@/views/prompt/PromptEditor.vue'),
        meta: {
          title: 'menu.promptCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/prompts',
          requiredPermissions: 'prompt:create',
        },
      },
      {
        path: 'prompts/edit/:id',
        name: 'PromptEdit',
        component: () => import('@/views/prompt/PromptEditor.vue'),
        meta: {
          title: 'menu.promptEdit',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/prompts',
          requiredPermissions: 'prompt:edit',
        },
      },
      {
        path: 'prompt-lab/list',
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
        path: 'prompt-lab/create',
        name: 'PromptLabCreate',
        component: () => import('@/views/prompt-lab/create.vue'),
        meta: {
          title: 'menu.promptLabCreate',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/prompt-lab/list',
          requiredPermissions: 'prompt_lab:create',
        },
      },
      {
        path: 'prompt-lab/test',
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
        path: 'prompt-lab/meta',
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
        path: 'prompt-lab/detail/:id',
        name: 'PromptLabDetail',
        component: () => import('@/views/prompt-lab/detail.vue'),
        meta: {
          title: 'menu.promptLabDetail',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/prompt-lab/list',
          requiredPermissions: 'prompt_lab:view',
        },
      },
      {
        path: 'prompt-lab/editor/:promptId',
        name: 'PromptLabEditor',
        component: () => import('@/views/prompt-lab/editor.vue'),
        meta: {
          title: 'menu.promptLabEditor',
          requiresAuth: true,
          hidden: true,
          activeMenu: '/content/prompt-lab/list',
          requiredPermissions: 'prompt_lab:edit',
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
        // 运行参数：DB > 配置文件的运行时可调参数，权限码独立（runtime_settings:view/update）
        path: 'runtime',
        name: 'SettingsRuntime',
        component: () => import('@/views/settings/runtime/index.vue'),
        meta: {
          title: 'menu.settingsRuntime',
          icon: 'ControlOutlined',
          requiresAuth: true,
          requiredPermissions: 'runtime_settings:view',
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
        // 画质增强（超分）各档位预设：整表保存，后端写入权限 settings:update
        path: 'video-enhance-presets',
        name: 'SettingsVideoEnhancePresets',
        component: () => import('@/views/settings/video-enhance-presets/index.vue'),
        meta: {
          title: 'menu.settingsVideoEnhancePresets',
          icon: 'ThunderboltOutlined',
          requiresAuth: true,
          requiredPermissions: 'settings:update',
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
  {
    path: '/local-life',
    name: 'LocalLife',
    redirect: '/local-life/copywriting',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.localLifeAdmin',
      icon: 'AppstoreOutlined',
      requiresAuth: true,
      requiredPermissions: 'local_life:view',
      order: 90,
    },
    children: [
      {
        path: 'copywriting',
        name: 'LocalLifeCopywriting',
        component: () => import('@/views/local-life/copywriting/index.vue'),
        meta: { title: 'menu.llCopywriting', icon: 'EditOutlined' },
      },
      {
        path: 'digital-human',
        name: 'LocalLifeDigitalHuman',
        component: () => import('@/views/local-life/digital-human/index.vue'),
        meta: { title: 'menu.llDigitalHuman', icon: 'UserOutlined' },
      },
      {
        path: 'note',
        name: 'LocalLifeNote',
        component: () => import('@/views/local-life/note/index.vue'),
        meta: { title: 'menu.llNote', icon: 'FileTextOutlined' },
      },
      {
        path: 'gen-options',
        name: 'LocalLifeGenOptions',
        component: () => import('@/views/local-life/gen-options/index.vue'),
        meta: { title: 'menu.llGenOptions', icon: 'SettingOutlined' },
      },
      {
        // 入口：素材页 / 筛选页，业务域固定为本地生活
        path: 'templates',
        name: 'LocalLifeTemplates',
        redirect: () => ({ path: '/template-asset/list', query: { bizType: 'localLife' } }),
        meta: { title: 'menu.llTemplates', icon: 'PictureOutlined' },
      },
      {
        path: 'poster-types',
        name: 'LocalLifePosterTypes',
        redirect: () => ({ path: '/template-asset/filter', query: { bizType: 'localLife' } }),
        meta: { title: 'menu.llPosterTypes', icon: 'TagsOutlined' },
      },
      {
        path: 'creations',
        name: 'LocalLifeCreations',
        component: () => import('@/views/local-life/creations/index.vue'),
        meta: { title: 'menu.llCreations', icon: 'PictureOutlined' },
      },
    ],
  },
  {
    path: '/studio',
    name: 'Studio',
    redirect: '/studio/batches',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.studio',
      icon: 'PictureOutlined',
      requiresAuth: true,
      requiredPermissions: 'studio:view',
      order: 91,
    },
    children: [
      {
        path: 'batches',
        name: 'StudioBatches',
        component: () => import('@/views/studio/batches/index.vue'),
        meta: { title: 'menu.studioBatches', icon: 'UnorderedListOutlined' },
      },
      {
        path: 'batches/:id',
        name: 'StudioBatchDetail',
        component: () => import('@/views/studio/batches/detail.vue'),
        meta: {
          title: 'menu.studioBatchDetail',
          hidden: true,
          activeMenu: '/studio/batches',
        },
      },
      {
        path: 'cost',
        name: 'StudioCost',
        component: () => import('@/views/studio/cost/index.vue'),
        meta: { title: 'menu.studioCost', icon: 'DollarOutlined' },
      },
      {
        path: 'sidecar',
        name: 'StudioSidecar',
        component: () => import('@/views/studio/sidecar/index.vue'),
        meta: { title: 'menu.studioSidecar', icon: 'ApiOutlined' },
      },
    ],
  },
  {
    path: '/asset-library',
    name: 'AssetLibrary',
    redirect: '/asset-library/kind-stats',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.assetLib',
      icon: 'FolderOpenOutlined',
      requiresAuth: true,
      requiredPermissions: 'asset_library:view',
      order: 92,
    },
    children: [
      {
        path: 'kind-stats',
        name: 'AssetLibKindStats',
        component: () => import('@/views/asset-library/kind-stats/index.vue'),
        meta: { title: 'menu.assetLibKindStats', icon: 'BarChartOutlined' },
      },
      {
        path: 'tags',
        name: 'AssetLibTags',
        component: () => import('@/views/asset-library/tags/index.vue'),
        meta: { title: 'menu.assetLibTags', icon: 'TagsOutlined' },
      },
    ],
  },
  {
    path: '/canvas',
    name: 'Canvas',
    redirect: '/canvas/runs',
    component: () => import('@/components/Layout/AdminLayout.vue'),
    meta: {
      title: 'menu.canvas',
      icon: 'ApartmentOutlined',
      requiresAuth: true,
      requiredPermissions: 'canvas:view',
      order: 93,
    },
    children: [
      {
        path: 'runs',
        name: 'CanvasRuns',
        component: () => import('@/views/canvas/runs/index.vue'),
        meta: { title: 'menu.canvasRuns', icon: 'UnorderedListOutlined' },
      },
      {
        path: 'templates',
        name: 'CanvasTemplates',
        component: () => import('@/views/canvas/templates/index.vue'),
        meta: { title: 'menu.canvasTemplates', icon: 'AppstoreOutlined' },
      },
      {
        path: 'prompts',
        name: 'CanvasPrompts',
        component: () => import('@/views/canvas/prompts/index.vue'),
        meta: { title: 'menu.canvasPrompts', icon: 'FileTextOutlined' },
      },
      {
        path: 'cost',
        name: 'CanvasCost',
        component: () => import('@/views/canvas/cost/index.vue'),
        meta: { title: 'menu.canvasCost', icon: 'DollarOutlined' },
      },
    ],
  },
  {
    path: '/template/list',
    redirect: '/content/templates',
    meta: { title: 'menu.templateManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/template/create',
    redirect: '/content/templates/create',
    meta: { title: 'menu.templateManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/template/edit/:id',
    redirect: (to) => ({ path: `/content/templates/edit/${to.params.id}` }),
    meta: { title: 'menu.templateManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt/list',
    redirect: '/content/prompts',
    meta: { title: 'menu.promptManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt/create',
    redirect: '/content/prompts/create',
    meta: { title: 'menu.promptManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt/edit/:id',
    redirect: (to) => ({ path: `/content/prompts/edit/${to.params.id}` }),
    meta: { title: 'menu.promptManagement', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/list',
    redirect: '/content/prompt-lab/list',
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/create',
    redirect: '/content/prompt-lab/create',
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/test',
    redirect: '/content/prompt-lab/test',
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/meta',
    redirect: '/content/prompt-lab/meta',
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/detail/:id',
    redirect: (to) => ({ path: `/content/prompt-lab/detail/${to.params.id}` }),
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
  {
    path: '/prompt-lab/editor/:promptId',
    redirect: (to) => ({ path: `/content/prompt-lab/editor/${to.params.promptId}` }),
    meta: { title: 'menu.promptLab', hidden: true, requiresAuth: true },
  },
];
