import { defineMock } from 'vite-plugin-mock-dev-server';

// 画布 / 提示词库运营后台 mock（信封：{ code: 0, msg, data }）。VITE_USE_MOCK=true 时生效。
const now = Date.now();
const kinds = ['image', 'video', 'tool_crop', 'tool_upscale', 'tool_tryon'];
const backends = ['gateway', 'media', 'java', 'studio'];
const statuses = ['succeeded', 'failed', 'running', 'queued', 'cancelled', 'submitting'];

const runs = Array.from({ length: 45 }, (_, i) => {
  const status = statuses[i % 6];
  return {
    id: 5000 - i,
    run_id: `run_${5000 - i}`,
    task_id: `t_${5000 - i}`,
    user_id: 20000 + (i % 7),
    canvas_id: `cv_${100 + (i % 6)}`,
    node_id: `node_${i % 9}`,
    kind: kinds[i % 5],
    status,
    progress: status === 'succeeded' ? 100 : 30,
    model: 'gemini-image',
    model_group: i % 2 ? 'gemini-image' : 'seedream',
    backend: backends[i % 4],
    backend_ref: `gw_${i}`,
    billing_request_id: `bill_${i}`,
    billing_status: i % 12 === 0 ? 'unsettled' : status === 'submitting' ? 'none' : 'settled',
    credits: 10,
    cost_cny: status === 'succeeded' ? '0.0390' : '0',
    attempt: 1,
    candidates:
      status === 'succeeded'
        ? [1, 2].map((n) => `https://picsum.photos/seed/cv${i}${n}/200/200`)
        : [],
    video_url: '',
    text: '',
    error: status === 'failed' ? 'upstream timeout' : '',
    error_code: status === 'failed' ? 'UPSTREAM_TIMEOUT' : '',
    request: JSON.stringify({ params: { mask_rid: `rid_${i}` } }),
    created_at: now - i * 3600_000,
    started_at: now - i * 3600_000 + 1000,
    finished_at: status === 'succeeded' || status === 'failed' ? now - i * 3600_000 + 20_000 : 0,
  };
});

const templates = Array.from({ length: 12 }, (_, i) => ({
  id: 300 - i,
  scope: i % 4 === 3 ? 'user' : 'official',
  user_id: i % 4 === 3 ? 20001 : 0,
  title: `画布模板 ${i + 1}`,
  description: '电商主图流程：生图 -> 放大 -> 试穿',
  cover_url: `https://picsum.photos/seed/tpl${i}/200/200`,
  sort: i,
  enabled: i % 3 !== 0,
  node_count: 3 + (i % 4),
  edge_count: 2 + (i % 4),
  snapshot: JSON.stringify({
    nodes: [{ id: 'n1', type: 'image' }],
    edges: [],
  }),
  created_at: now - i * 86400_000,
  updated_at: now - i * 3600_000,
}));

const prompts = Array.from({ length: 25 }, (_, i) => ({
  id: 700 - i,
  user_id: 0,
  title: `官方提示词 ${i + 1}`,
  prompt: '纯白背景，棚拍柔光，产品居中，高清细节。',
  vertical: i % 2 ? 'general' : 'ecommerce',
  group: ['主图', '场景图', '细节图'][i % 3],
  models: i % 2 ? ['gemini-image'] : ['gemini-image', 'seedream'],
  tags: ['白底', '柔光'],
  source: 'ops',
  owner: 'official',
  enabled: i % 4 !== 0,
  sort: i,
  created_at: now - i * 86400_000,
  updated_at: now - i * 3600_000,
}));

const ok = (data: unknown = {}) => ({ code: 0, msg: 'ok', data });
const paged = <T>(list: T[], q: Record<string, unknown>) => {
  const page = Number(q.page || 1);
  const size = Number(q.page_size || 20);
  return ok({ list: list.slice((page - 1) * size, page * size), total: list.length });
};

export default defineMock([
  {
    url: '/api/v1/canvas/admin/runs',
    method: 'GET',
    body: ({ query }) => {
      const status = Number(query.status ?? -1);
      const names = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'submitting'];
      return paged(
        runs.filter(
          (r) =>
            (!query.kind || r.kind === query.kind) &&
            (!query.backend || r.backend === query.backend) &&
            (!query.canvas_id || r.canvas_id === query.canvas_id) &&
            (!query.user_id || r.user_id === Number(query.user_id)) &&
            (status < 0 || r.status === names[status]),
        ),
        query,
      );
    },
  },
  {
    url: '/api/v1/canvas/admin/runs/:id/force-fail',
    method: 'POST',
    body: () => ok(),
  },
  {
    url: '/api/v1/canvas/admin/cost-summary',
    method: 'GET',
    body: ({ query }) => {
      const keys = query.group_by === 'model_group' ? ['gemini-image', 'seedream'] : kinds;
      return ok({
        rows: keys.map((key, i) => ({
          key,
          runs: 100 + i * 20,
          succeeded: 90 + i * 15,
          failed: 8 + i * 3,
          canceled: 2 + i,
          cost_cny: (3.9 + i).toFixed(4),
          points: 1000 + i * 200,
        })),
      });
    },
  },
  {
    url: '/api/v1/canvas/admin/templates',
    method: 'GET',
    body: ({ query }) =>
      paged(
        templates.filter(
          (t) =>
            (!query.scope || t.scope === query.scope) &&
            (!query.q || t.title.includes(String(query.q))),
        ),
        query,
      ),
  },
  { url: '/api/v1/canvas/admin/templates', method: 'POST', body: () => ok(templates[0]) },
  { url: '/api/v1/canvas/admin/templates/:id', method: 'PUT', body: () => ok(templates[0]) },
  { url: '/api/v1/canvas/admin/templates/:id/toggle', method: 'POST', body: () => ok() },
  {
    url: '/api/v1/prompt-library/admin/prompts',
    method: 'GET',
    body: ({ query }) =>
      paged(
        prompts.filter(
          (p) =>
            (!query.vertical || p.vertical === query.vertical) &&
            (!query.group || p.group === query.group) &&
            (!query.q || p.title.includes(String(query.q))),
        ),
        query,
      ),
  },
  { url: '/api/v1/prompt-library/admin/prompts', method: 'POST', body: () => ok(prompts[0]) },
  { url: '/api/v1/prompt-library/admin/prompts/:id', method: 'PUT', body: () => ok(prompts[0]) },
  { url: '/api/v1/prompt-library/admin/prompts/:id/toggle', method: 'POST', body: () => ok() },
]);
