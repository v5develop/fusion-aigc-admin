import { defineMock } from 'vite-plugin-mock-dev-server';

// 资产库增强运营后台 mock（信封：{ code: 0, msg, data }）。VITE_USE_MOCK=true 时生效。
const now = Date.now();
const KINDS = [
  ['model', '模特'],
  ['garment', '服装'],
  ['scene', '场景'],
  ['prop', '道具'],
  ['other', '其他'],
  ['uncategorized', '未分类'],
];
const SOURCES = ['upload', 'generated', 'official'];

const tags = Array.from({ length: 53 }, (_, i) => ({
  id: 500 - i,
  user_id: 20000 + (i % 6),
  name: `标签${53 - i}`,
  asset_count: (i * 7) % 41,
  created_at: now - i * 7200_000,
}));

export default defineMock([
  {
    url: '/api/v1/asset-library/admin/tags',
    method: 'GET',
    body: ({ query }) => {
      const page = Number(query.page) || 1;
      const size = Number(query.page_size) || 20;
      const uid = Number(query.user_id) || 0;
      const q = String(query.q || '');
      const all = tags.filter((t) => (!uid || t.user_id === uid) && t.name.includes(q));
      return {
        code: 0,
        msg: 'ok',
        data: { list: all.slice((page - 1) * size, page * size), total: all.length },
      };
    },
  },
  {
    url: '/api/v1/asset-library/admin/kind-stats',
    method: 'GET',
    body: ({ query }) => {
      const factor = query.media === 'video' ? 1 : query.media === 'image' ? 3 : 4;
      const rows = KINDS.flatMap(([kind], ki) =>
        SOURCES.map((source, si) => ({ kind, source, count: (ki + 1) * (si + 2) * factor })),
      );
      const kinds = KINDS.map(([key, label]) => ({
        key,
        label,
        count: rows.filter((r) => r.kind === key).reduce((a, r) => a + r.count, 0),
      }));
      const sources = SOURCES.map((key) => ({
        key,
        label: key,
        count: rows.filter((r) => r.source === key).reduce((a, r) => a + r.count, 0),
      }));
      const all = { key: 'all', label: '全部', count: rows.reduce((a, r) => a + r.count, 0) };
      return { code: 0, msg: 'ok', data: { rows, kinds: [all, ...kinds], sources } };
    },
  },
]);
