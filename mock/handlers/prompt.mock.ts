import { defineMock } from 'vite-plugin-mock-dev-server';

import { mockPrompts, type MockPromptRecord } from '../data/prompt.data';

// In-memory storage
const prompts: MockPromptRecord[] = mockPrompts.map((item) => ({ ...item }));

export default defineMock([
  // List prompts (paginated + filtered)
  {
    url: '/api/v1/admin/creation/prompts',
    method: 'GET',
    body: (req) => {
      const { pageNo = 1, pageSize = 10, keyword, category, enabled } = req.query || {};
      let filtered = [...prompts];
      if (keyword) {
        const kw = String(keyword).toLowerCase();
        filtered = filtered.filter(
          (p) => p.name.toLowerCase().includes(kw) || (p.code || '').toLowerCase().includes(kw),
        );
      }
      if (category) {
        filtered = filtered.filter((p) => p.category === category);
      }
      if (enabled !== undefined && enabled !== '') {
        filtered = filtered.filter((p) => p.enabled === Number(enabled));
      }
      const start = (Number(pageNo) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      return {
        code: 0,
        message: 'Success',
        data: {
          list: filtered.slice(start, end),
          total: filtered.length,
        },
        success: true,
      };
    },
  },

  // Get prompt detail
  {
    url: '/api/v1/admin/creation/prompts/:id',
    method: 'GET',
    body: (req) => {
      const prompt = prompts.find((p) => p.id === req.params.id);
      return {
        code: prompt ? 0 : 404,
        message: prompt ? 'Success' : 'Not Found',
        data: prompt || null,
        success: !!prompt,
      };
    },
  },

  // Create prompt
  {
    url: '/api/v1/admin/creation/prompts',
    method: 'POST',
    body: (req) => {
      const id = `prompt_${Date.now()}`;
      const now = new Date().toISOString();
      const newPrompt = {
        ...req.body,
        id,
        version: 1,
        usageCount: 0,
        createTime: now,
        updateTime: now,
      } as MockPromptRecord;
      prompts.unshift(newPrompt);
      return { code: 0, message: 'Success', data: id, success: true };
    },
  },

  // Update prompt
  {
    url: '/api/v1/admin/creation/prompts/:id',
    method: 'PUT',
    body: (req) => {
      const index = prompts.findIndex((p) => p.id === req.params.id);
      if (index === -1) {
        return { code: 404, message: 'Not Found', data: null, success: false };
      }
      prompts[index] = {
        ...prompts[index],
        ...req.body,
        version: (prompts[index].version || 1) + 1,
        updateTime: new Date().toISOString(),
      };
      return { code: 0, message: 'Success', data: req.params.id, success: true };
    },
  },

  // Delete prompt
  {
    url: '/api/v1/admin/creation/prompts/:id',
    method: 'DELETE',
    body: (req) => {
      const index = prompts.findIndex((p) => p.id === req.params.id);
      if (index !== -1) {
        prompts.splice(index, 1);
      }
      return { code: 0, message: 'Success', data: null, success: true };
    },
  },
]);
