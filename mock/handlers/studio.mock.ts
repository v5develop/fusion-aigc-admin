import { defineMock } from 'vite-plugin-mock-dev-server';

// studio 运营后台 mock（信封：{ code: 0, msg, data }）。VITE_USE_MOCK=true 时生效。
const now = Date.now();
const kinds = ['tryon', 'pose', 'imagegen'];

const batches = Array.from({ length: 45 }, (_, i) => {
  const total = 4 + (i % 3);
  const status = [4, 5, 6, 3, 0, 7, 8][i % 7];
  const failed = status === 5 ? total : status === 6 ? 1 : 0;
  return {
    id: 1000 - i,
    user_id: 20000 + (i % 7),
    workspace_id: 1,
    kind: kinds[i % 3],
    status,
    request_id: `req-${1000 - i}`,
    payload: JSON.stringify({ models: 1, shots: total }),
    task_total: total,
    task_done: status === 4 ? total : status === 6 ? total - 1 : 0,
    task_failed: failed,
    estimated_points: total * 10,
    cost_cny: (total * 0.039).toFixed(4),
    model_group: 'gemini-image',
    error_reason: status === 5 ? 'upstream timeout' : '',
    cover_url: '',
    created_at: now - i * 3600_000,
    updated_at: now - i * 3600_000 + 60_000,
  };
});

const img = (n: number) => `https://picsum.photos/seed/studio${n}/200/200`;

function tasksOf(b: (typeof batches)[number]) {
  return Array.from({ length: b.task_total }, (_, i) => {
    const status =
      i < b.task_failed
        ? 3
        : b.status === 4 || i < b.task_done
          ? 2
          : i === b.task_total - 1 && b.status === 3
            ? 5
            : 1;
    return {
      id: b.id * 10 + i,
      task_id: `st_${b.id}_${i}`,
      model_index: 0,
      shot_index: i,
      pose_index: 0,
      status,
      result_url: status === 2 ? img(b.id + i) : '',
      result_width: 1024,
      result_height: 1536,
      error_reason: status === 3 ? 'gateway 502' : '',
      model_group: b.model_group,
      prompt_text: `图 1 为模特，图 2 为服装。\n生成第 ${i + 1} 张棚拍图，正面站姿，柔光。`,
      prompt_meta: JSON.stringify({ lang: 'zh', shot: i }),
      input_images: JSON.stringify([{ id: 'm-0', url: img(1), role: 'model' }]),
      gateway_call_id: `gw_${b.id}_${i}`,
      gateway_status: status === 2 ? 'succeeded' : status === 3 ? 'failed' : 'running',
      attempt: 1,
      admin_locked: false,
      cost_cny: status === 2 ? '0.0390' : '0',
      billing_request_id: `bill_${b.id}_${i}`,
      billing_status: status === 2 ? 2 : status === 3 ? 3 : 1,
      duration_ms: 18000,
      created_at: b.created_at,
      started_at: b.created_at + 1000,
      finished_at: status === 2 || status === 3 ? b.created_at + 19000 : 0,
    };
  });
}

export default defineMock([
  {
    url: '/api/v1/studio/admin/batches',
    method: 'GET',
    body: ({ query }) => {
      const page = Number(query.page || 1);
      const size = Number(query.page_size || 20);
      const status = Number(query.status ?? -1);
      const list = batches.filter(
        (b) =>
          (!query.kind || b.kind === query.kind) &&
          (status < 0 || b.status === status) &&
          (!query.user_id || b.user_id === Number(query.user_id)),
      );
      return {
        code: 0,
        msg: 'ok',
        data: { list: list.slice((page - 1) * size, page * size), total: list.length },
      };
    },
  },
  {
    url: '/api/v1/studio/admin/batches/:id',
    method: 'GET',
    body: ({ params }) => {
      const b = batches.find((x) => x.id === Number(params.id)) ?? batches[0];
      return {
        code: 0,
        msg: 'ok',
        data: {
          batch: b,
          crop_plan: JSON.stringify([
            {
              index: 0,
              angle: 'front',
              garment_box: [0.1, 0.1, 0.8, 0.8],
              crops: [
                { label: '上衣·领口', box: [0.3, 0.1, 0.4, 0.25], confidence: 0.9 },
                { label: '上衣·下摆', box: [0.2, 0.6, 0.5, 0.3], confidence: 0.85 },
              ],
            },
          ]),
          crop_check: JSON.stringify([
            { index: 0, ok: true, confidence: 0.95 },
            { index: 1, ok: false, confidence: 0.9 },
          ]),
          selected_images: JSON.stringify([
            {
              model_index: 0,
              images: [
                { id: 'm-0', url: img(1), role: 'model' },
                { id: 'g-0-front-0', url: img(2), role: 'garment' },
              ],
            },
          ]),
          step_log: JSON.stringify([
            { step: 'submitted', ms: 12, task_total: b.task_total, at: b.created_at },
            {
              step: 'crop_plan',
              ms: 2300,
              images: 3,
              crops: 6,
              cost_cny: 0.002,
              at: b.created_at + 2300,
            },
            {
              step: 'analyze',
              ms: 4100,
              images: 6,
              degraded: true,
              detail: 'sidecar 降级',
              at: b.created_at + 6400,
            },
            { step: 'generate', ms: 18000, cost_cny: 0.156, at: b.created_at + 24400 },
          ]),
          tasks: tasksOf(b),
        },
      };
    },
  },
  {
    url: '/api/v1/studio/admin/tasks/:task_id/retry',
    method: 'POST',
    body: { code: 0, msg: 'ok', data: {} },
  },
  {
    url: '/api/v1/studio/admin/tasks/:task_id/force-fail',
    method: 'POST',
    body: { code: 0, msg: 'ok', data: {} },
  },
  {
    url: '/api/v1/studio/admin/sidecar/status',
    method: 'GET',
    body: {
      code: 0,
      msg: 'ok',
      data: {
        deps: [
          {
            name: 'sidecar',
            ok: true,
            base_url: 'http://127.0.0.1:8890',
            latency_ms: 12,
            version: '2026-10-30.1',
            detail: 'model=gemini-2.5-flash, key=已配置',
          },
          {
            name: 'ai-gateway',
            ok: true,
            base_url: 'http://127.0.0.1:18080',
            latency_ms: 8,
            version: '',
            detail: '',
          },
          {
            name: 'media',
            ok: false,
            base_url: 'http://127.0.0.1:9100',
            latency_ms: 0,
            version: '',
            detail: 'connection refused',
          },
        ],
        running_tasks: 3,
        queued_batches: 1,
      },
    },
  },
  {
    url: '/api/v1/studio/admin/cost-summary',
    method: 'GET',
    body: ({ query }) => {
      const keys = query.group_by === 'model_group' ? ['gemini-image', 'seedream'] : kinds;
      const rows = keys.map((key, i) => ({
        key,
        task_total: 100 + i * 20,
        task_succeeded: 90 + i * 15,
        task_failed: 10 + i * 5,
        cost_cny: (3.9 + i).toFixed(4),
        points: 1000 + i * 200,
      }));
      const total = rows.reduce(
        (a, r) => ({
          key: '',
          task_total: a.task_total + r.task_total,
          task_succeeded: a.task_succeeded + r.task_succeeded,
          task_failed: a.task_failed + r.task_failed,
          cost_cny: (Number(a.cost_cny) + Number(r.cost_cny)).toFixed(4),
          points: a.points + r.points,
        }),
        { key: '', task_total: 0, task_succeeded: 0, task_failed: 0, cost_cny: '0', points: 0 },
      );
      return { code: 0, msg: 'ok', data: { rows, total } };
    },
  },
]);
