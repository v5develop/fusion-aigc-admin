import { defineMock } from 'vite-plugin-mock-dev-server';

import {
  mockUnionConfig,
  mockAIProviderConfig,
  mockStorageConfig,
  mockSystemConfig,
} from '../data/settings.data';

import {
  mockFeatures,
  mockModels,
  mockPricing,
  mockCostLogs,
  mockPointsLogs,
  mockCapabilityGrants,
  mockChangeLogs,
  mockDifferences,
  mockConsumptions,
  mockBillingExceptions,
} from '../data/billing.data';

// In-memory storage for settings updates
const unionConfig = { ...mockUnionConfig };
const aiProviderConfig = { ...mockAIProviderConfig };
const storageConfig = { ...mockStorageConfig };
const systemConfig = { ...mockSystemConfig };

// In-memory storage for billing data
const features = [...mockFeatures];
const models = [...mockModels];
const pricing = [...mockPricing];
const costLogs = [...mockCostLogs];
const pointsLogs = [...mockPointsLogs];
const capabilityGrants = [...mockCapabilityGrants];
const changeLogs = [...mockChangeLogs];
const differences = [...mockDifferences];
const consumptions = [...mockConsumptions];
const billingExceptions = [...mockBillingExceptions];

export default defineMock([
  // ========== Settings APIs ==========

  // Get union config
  {
    url: '/api/admin/settings/union',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: unionConfig,
      success: true,
    },
  },

  // Save union config
  {
    url: '/api/admin/settings/union',
    method: 'PUT',
    body: (req) => {
      Object.assign(unionConfig, req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Get AI provider config
  {
    url: '/api/admin/settings/ai-provider',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: aiProviderConfig,
      success: true,
    },
  },

  // Save AI provider config
  {
    url: '/api/admin/settings/ai-provider',
    method: 'PUT',
    body: (req) => {
      Object.assign(aiProviderConfig, req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Get storage config
  {
    url: '/api/admin/settings/storage',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: storageConfig,
      success: true,
    },
  },

  // Save storage config
  {
    url: '/api/admin/settings/storage',
    method: 'PUT',
    body: (req) => {
      Object.assign(storageConfig, req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Get system config
  {
    url: '/api/admin/settings/system',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: systemConfig,
      success: true,
    },
  },

  // Save system config
  {
    url: '/api/admin/settings/system',
    method: 'PUT',
    body: (req) => {
      Object.assign(systemConfig, req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // ========== Feature APIs ==========

  // Feature list
  {
    url: '/api/admin/capabilities/points',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10, featureCode, status } = req.query || {};
      let filtered = [...features];
      if (featureCode) {
        filtered = filtered.filter(f => f.featureCode.includes(featureCode));
      }
      if (status !== undefined && status !== '') {
        filtered = filtered.filter(f => f.status === Number(status));
      }
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          items: filtered.slice(start, end),
          total: filtered.length,
        },
        success: true,
      };
    },
  },

  // Create feature
  {
    url: '/api/admin/capabilities/points',
    method: 'POST',
    body: (req) => {
      const newFeature = {
        id: features.length + 1,
        ...req.body,
        createTime: new Date().toISOString(),
      };
      features.push(newFeature);
      return { code: 0, message: 'Success', data: newFeature.id, success: true };
    },
  },

  // Update feature
  {
    url: '/api/admin/capabilities/points/:id',
    method: 'PUT',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = features.findIndex(f => f.id === id);
      if (idx === -1) return { code: 404, message: '功能点不存在', data: null, success: false };
      Object.assign(features[idx], req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Delete feature
  {
    url: '/api/admin/capabilities/points/:id',
    method: 'DELETE',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = features.findIndex(f => f.id === id);
      if (idx === -1) return { code: 404, message: '功能点不存在', data: null, success: false };
      features[idx].status = 0;
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Feature model mapping
  {
    url: '/api/admin/capabilities/points/:id/models',
    method: 'GET',
    body: { code: 0, message: 'Success', data: { modelIds: [1, 2] }, success: true },
  },

  {
    url: '/api/admin/capabilities/points/:id/models',
    method: 'PUT',
    body: { code: 0, message: 'Success', data: true, success: true },
  },

  // Capability grant list
  {
    url: '/api/admin/capabilities/grants',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: capabilityGrants.slice(start, end),
          total: capabilityGrants.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  // Revoke capability
  {
    url: '/api/admin/capabilities/grants/:grantId/revoke',
    method: 'POST',
    body: (req) => {
      const grantId = Number(req.params.grantId);
      const grant = capabilityGrants.find(g => g.id === grantId);
      if (!grant) return { code: 404, message: '记录不存在', data: null, success: false };
      grant.status = 3;
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // Change log
  {
    url: '/api/admin/capabilities/change-log',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: changeLogs.slice(start, end),
          total: changeLogs.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  // ========== Model APIs ==========

  {
    url: '/api/admin/models',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: models.slice(start, end),
          total: models.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/models',
    method: 'POST',
    body: (req) => {
      const newModel = { id: models.length + 1, ...req.body, createTime: new Date().toISOString() };
      models.push(newModel);
      return { code: 0, message: 'Success', data: newModel.id, success: true };
    },
  },

  {
    url: '/api/admin/models/:id',
    method: 'PUT',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = models.findIndex(m => m.id === id);
      if (idx === -1) return { code: 404, message: '模型不存在', data: null, success: false };
      Object.assign(models[idx], req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  {
    url: '/api/admin/models/:id',
    method: 'DELETE',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = models.findIndex(m => m.id === id);
      if (idx === -1) return { code: 404, message: '模型不存在', data: null, success: false };
      models.splice(idx, 1);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // ========== Pricing APIs ==========

  {
    url: '/api/admin/pricing',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: pricing.slice(start, end),
          total: pricing.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/pricing',
    method: 'POST',
    body: (req) => {
      const newPricing = { id: pricing.length + 1, ...req.body, createTime: new Date().toISOString() };
      pricing.push(newPricing);
      return { code: 0, message: 'Success', data: newPricing.id, success: true };
    },
  },

  {
    url: '/api/admin/pricing/:id',
    method: 'PUT',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = pricing.findIndex(p => p.id === id);
      if (idx === -1) return { code: 404, message: '定价不存在', data: null, success: false };
      Object.assign(pricing[idx], req.body);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  {
    url: '/api/admin/pricing/:id',
    method: 'DELETE',
    body: (req) => {
      const id = Number(req.params.id);
      const idx = pricing.findIndex(p => p.id === id);
      if (idx === -1) return { code: 404, message: '定价不存在', data: null, success: false };
      pricing.splice(idx, 1);
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // ========== Cost APIs ==========

  {
    url: '/api/admin/costs',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: costLogs.slice(start, end),
          total: costLogs.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/costs/stats',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: {
        todayCost: 600,
        totalCount: 2,
        costByModel: { '1': 500, '2': 100 },
      },
      success: true,
    },
  },

  // ========== Consumption APIs ==========

  {
    url: '/api/admin/consumptions',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: consumptions.slice(start, end),
          total: consumptions.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  // ========== Points APIs ==========

  {
    url: '/api/admin/points/logs',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: pointsLogs.slice(start, end),
          total: pointsLogs.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/points/adjust',
    method: 'POST',
    body: { code: 0, message: 'Success', data: true, success: true },
  },

  // ========== Reconciliation APIs ==========

  {
    url: '/api/admin/reconciliation/summary',
    method: 'GET',
    body: {
      code: 0,
      message: 'Success',
      data: {
        totalGrant: 300,
        totalConsume: -60,
        totalRefund: 0,
        differenceAmount: 240,
        items: [
          {
            date: '2025-01-15',
            grantCount: 2,
            consumeCount: 2,
            refundCount: 0,
            grantAmount: 300,
            consumeAmount: -60,
            refundAmount: 0,
            difference: 240,
          },
        ],
      },
      success: true,
    },
  },

  {
    url: '/api/admin/reconciliation/differences',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10 } = req.query || {};
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: differences.slice(start, end),
          total: differences.length,
          pageNo: Number(pageNo),
          pageSize: Number(pageSize),
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/reconciliation/differences/handle',
    method: 'POST',
    body: (req) => {
      const { id, action } = req.body;
      const diff = differences.find(d => d.id === id);
      if (!diff) return { code: 404, message: '差异记录不存在', data: null, success: false };
      if (diff.status !== 'OPEN') return { code: 400, message: '该差异已处理', data: null, success: false };
      const statusMap: Record<string, string> = {
        compensate: 'COMPENSATED',
        deduct: 'DEDUCTED',
        ignore: 'IGNORED',
      };
      diff.status = statusMap[action] || 'IGNORED';
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // ========== Billing Exception APIs ==========

  {
    url: '/api/admin/billing/exceptions',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10, userId, bizType, billingStatus, status } = req.query || {};
      let filtered = [...billingExceptions];
      if (userId) {
        filtered = filtered.filter(e => e.userId === Number(userId));
      }
      if (bizType) {
        filtered = filtered.filter(e => e.bizType === bizType);
      }
      if (billingStatus) {
        filtered = filtered.filter(e => e.billingStatus === billingStatus);
      }
      if (status) {
        filtered = filtered.filter(e => e.status === status);
      }
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          items: filtered.slice(start, end),
          total: filtered.length,
        },
        success: true,
      };
    },
  },

  {
    url: '/api/admin/billing/exceptions/:id/retry',
    method: 'POST',
    body: (req) => {
      const id = Number(req.params.id);
      const ex = billingExceptions.find(e => e.id === id);
      if (!ex) return { code: 404, message: '异常记录不存在', data: null, success: false };
      ex.status = 'RESOLVED';
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  {
    url: '/api/admin/billing/exceptions/ignore',
    method: 'POST',
    body: (req) => {
      const { id, remark } = req.body;
      if (!remark) return { code: 400, message: '忽略原因不能为空', data: null, success: false };
      const ex = billingExceptions.find(e => e.id === id);
      if (!ex) return { code: 404, message: '异常记录不存在', data: null, success: false };
      ex.status = 'IGNORED';
      return { code: 0, message: 'Success', data: true, success: true };
    },
  },

  // ========== Consumption Stats API ==========

  {
    url: '/api/admin/consumptions/stats',
    method: 'GET',
    body: () => ({
      code: 0,
      message: 'Success',
      data: {
        todayConsumption: 1250,
        monthConsumption: 18750,
        todayThirdPartyCost: 12.50,
      },
      success: true,
    }),
  },
]);
