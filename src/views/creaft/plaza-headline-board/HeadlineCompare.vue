<template>
  <div>
    <a-card variant="borderless" style="margin-bottom: 12px">
      <div class="bar">
        <a-select
          v-model:value="picked"
          mode="multiple"
          :options="scopeOptions"
          :max-tag-count="4"
          placeholder="选 2~4 个范围（含全站总榜）"
          style="min-width: 420px; max-width: 640px"
          :filter-option="filterOption"
        />
        <a-date-picker
          v-model:value="at"
          show-time
          allow-clear
          placeholder="时间点（默认最新版本）"
          value-format="YYYY-MM-DDTHH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          :disabled-date="(d: Dayjs) => d.isAfter(dayjs(), 'day')"
          style="width: 220px"
        />
        <a-button type="primary" :loading="loading" :disabled="!valid" @click="run">对比</a-button>
        <span v-if="picked.length && !valid" class="muted">需要 2~4 个范围</span>
      </div>
      <div class="bar" style="margin-top: 12px">
        <a-radio-group v-model:value="mode" size="small" button-style="solid">
          <a-radio-button value="aligned">按模板对齐</a-radio-button>
          <a-radio-button value="lists">各榜原序</a-radio-button>
        </a-radio-group>
        <a-checkbox v-if="mode === 'aligned'" v-model:checked="onlyDiff">只看有差异的</a-checkbox>
        <span class="legend">
          <i class="sw sw-diff" />名次 / 来源与基准不同
          <i class="sw sw-miss" />应上榜却不在榜（属于该行业） <i class="sw sw-na" />不属于该行业
        </span>
      </div>
      <div class="muted" style="margin-top: 6px">
        基准 = 第一个选中的范围（{{
          baseName
        }}）；总榜没有行业归属，其余范围按模板所属行业判断是否该上榜。
      </div>
    </a-card>

    <a-alert
      v-if="expired"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="该时间点没有榜单版本（早于第一个版本，或超过保留期）"
    />
    <a-alert v-if="view" type="info" show-icon style="margin-bottom: 12px">
      <template #message>
        <a-space wrap>
          <span>版本 v{{ view.snapshot.version }}</span>
          <span>计算于 {{ fmtTime(view.snapshot.computedAt) }}</span>
          <span class="muted">触发：{{ triggerLabel(view.snapshot.trigger) }}</span>
          <span class="muted">共 {{ view.rows.length }} 个模板，{{ diffCount }} 个有差异</span>
        </a-space>
      </template>
    </a-alert>

    <a-card v-if="view" variant="borderless">
      <!-- 按模板对齐 -->
      <a-table
        v-if="mode === 'aligned'"
        :columns="columns"
        :data-source="shownRows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 260 + view.scopes.length * 200 }"
      >
        <template #emptyText>
          <a-empty :description="onlyDiff ? '所选范围的榜单没有差异' : '所选范围都没有榜单'" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="tpl">
              <img v-if="record.template.cover" :src="record.template.cover" class="thumb" alt="" />
              <div v-else class="thumb thumb-empty">无图</div>
              <div>
                <div class="t-title">
                  {{ record.template.exists ? record.template.title : '（模板已不在目录）' }}
                </div>
                <div class="muted">
                  #{{ record.template.id }}
                  <a-tag v-if="record.template.exists && !record.template.visible" color="orange"
                    >用户不可见</a-tag
                  >
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="isScopeCol(column.key)">
            <div :class="['cell', cellClass(record, scopeOfCol(column.key))]">
              <template v-if="cellOf(record, scopeOfCol(column.key))">
                <b>#{{ cellOf(record, scopeOfCol(column.key))!.rank }}</b>
                <a-tag
                  :color="SOURCE_META[cellOf(record, scopeOfCol(column.key))!.source].color"
                  style="margin-left: 6px"
                >
                  {{ SOURCE_META[cellOf(record, scopeOfCol(column.key))!.source].label }}
                </a-tag>
                <span class="delta">{{ deltaText(record, scopeOfCol(column.key)) }}</span>
                <div class="muted">
                  分数 {{ scoreText(cellOf(record, scopeOfCol(column.key))!.score) }} · 近 7 天
                  {{ cellOf(record, scopeOfCol(column.key))!.uses7d }}
                </div>
              </template>
              <span v-else-if="isMember(record, scopeOfCol(column.key))">未上榜</span>
              <span v-else class="muted">不属于该行业</span>
            </div>
          </template>
        </template>
      </a-table>

      <!-- 各榜原序 -->
      <div
        v-else
        class="lists"
        :style="{ gridTemplateColumns: `repeat(${view.scopes.length}, minmax(220px, 1fr))` }"
      >
        <div v-for="sc in view.scopes" :key="sc" class="list-col">
          <div class="list-head">
            {{ scopeName(sc) }}
            <span class="muted">（{{ (view.lists[sc] ?? []).length }} 条）</span>
          </div>
          <div v-if="!(view.lists[sc] ?? []).length" class="muted" style="padding: 12px">
            这个范围在该版本里没有榜单
          </div>
          <div
            v-for="it in view.lists[sc] ?? []"
            :key="it.plazaTemplateId"
            :class="['li', listItemClass(sc, it.plazaTemplateId)]"
          >
            <b class="li-rank">{{ String(it.rank).padStart(2, '0') }}</b>
            <span class="li-title">{{ titleOf(it.plazaTemplateId) }}</span>
            <a-tag :color="SOURCE_META[it.source].color">{{ SOURCE_META[it.source].label }}</a-tag>
          </div>
        </div>
      </div>
    </a-card>
    <a-empty
      v-else-if="!loading && !expired"
      description="选好范围后点「对比」"
      style="margin-top: 32px"
    />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import dayjs, { type Dayjs } from 'dayjs';
import { computed, onMounted, ref, watch } from 'vue';

import {
  GLOBAL_SCOPE,
  PlazaError,
  compareHeadlines,
  type HeadlineCompareCell,
  type HeadlineCompareView,
  type HeadlineScopeSummary,
} from '@/api/plaza-admin';

import { SOURCE_META, fmtTime, triggerLabel } from './labels';

const props = defineProps<{ scopes: HeadlineScopeSummary[] }>();

type Row = HeadlineCompareView['rows'][number] & { id: number };

const picked = ref<string[]>([]);
const at = ref<string | undefined>();
const mode = ref<'aligned' | 'lists'>('aligned');
const onlyDiff = ref(false);
const loading = ref(false);
const expired = ref(false);
const view = ref<HeadlineCompareView | null>(null);

const valid = computed(() => picked.value.length >= 2 && picked.value.length <= 4);

const scopeName = (code: string) =>
  code === GLOBAL_SCOPE ? '全站总榜' : (props.scopes.find((s) => s.scope === code)?.name ?? code);
const baseName = computed(() => (picked.value[0] ? scopeName(picked.value[0]) : '—'));

const scopeOptions = computed(() =>
  [...props.scopes]
    .sort((a, b) => (a.scope === GLOBAL_SCOPE ? -1 : b.scope === GLOBAL_SCOPE ? 1 : 0))
    .map((s) => ({
      value: s.scope,
      label:
        s.scope === GLOBAL_SCOPE
          ? '全站总榜（仅后台可见）'
          : `${s.parentCode ? '　' : ''}${s.name}`,
      disabled: picked.value.length >= 4 && !picked.value.includes(s.scope),
    })),
);
const filterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').includes(input);

// 默认：总榜 + 前两个行业
watch(
  () => props.scopes,
  (list) => {
    if (picked.value.length || !list.length) return;
    const inds = list.filter((s) => s.scope !== GLOBAL_SCOPE && s.computed).slice(0, 2);
    picked.value = [GLOBAL_SCOPE, ...inds.map((s) => s.scope)];
    if (valid.value) run();
  },
  { immediate: true },
);

let seq = 0;
async function run() {
  if (!valid.value) return;
  const s = ++seq;
  loading.value = true;
  expired.value = false;
  try {
    const v = await compareHeadlines(picked.value, at.value, { silent: true });
    if (s !== seq) return;
    view.value = v;
  } catch (e) {
    if (s !== seq) return;
    view.value = null;
    if (e instanceof PlazaError && e.reason === 'HEADLINE_SNAPSHOT_EXPIRED') expired.value = true;
    else if (e instanceof PlazaError) message.error(e.message || '对比失败');
  } finally {
    if (s === seq) loading.value = false;
  }
}
watch([picked, at], () => {
  if (valid.value) run();
});
onMounted(() => {
  if (valid.value && !view.value) run();
});

// ---------------- 差异 ----------------
const isScopeCol = (k: unknown) => String(k).startsWith('sc:');
const scopeOfCol = (k: unknown) => String(k).slice(3);
const baseScope = computed(() => view.value?.scopes[0] ?? picked.value[0] ?? '');
const cellOf = (r: Row, sc: string): HeadlineCompareCell | null => r.cells[sc] ?? null;
/** 总榜没有行业归属，视为恒属于；其余按模板所属行业 */
const isMember = (r: Row, sc: string) => sc === GLOBAL_SCOPE || r.memberOf.includes(sc);

function cellClass(r: Row, sc: string): string {
  const c = cellOf(r, sc);
  if (!c) return isMember(r, sc) ? 'cell-miss' : 'cell-na';
  const base = cellOf(r, baseScope.value);
  if (sc === baseScope.value || !base) return '';
  return c.rank !== base.rank || c.source !== base.source ? 'cell-diff' : '';
}
const rowHasDiff = (r: Row) =>
  (view.value?.scopes ?? []).some((sc) => {
    if (sc === baseScope.value) return false;
    const k = cellClass(r, sc);
    return k === 'cell-diff' || k === 'cell-miss';
  }) ||
  // 基准列自己该上榜却不在榜
  cellClass(r, baseScope.value) === 'cell-miss';

function deltaText(r: Row, sc: string): string {
  const c = cellOf(r, sc);
  const base = cellOf(r, baseScope.value);
  if (!c || !base || sc === baseScope.value) return '';
  const d = base.rank - c.rank;
  return d === 0 ? '' : d > 0 ? `↑${d}` : `↓${-d}`;
}
const scoreText = (v: number | null) => (v === null ? '—' : String(Math.round(v * 100) / 100));

const rows = computed<Row[]>(() =>
  (view.value?.rows ?? []).map((r) => ({ ...r, id: r.template.id })),
);
const diffCount = computed(() => rows.value.filter(rowHasDiff).length);
const shownRows = computed(() => (onlyDiff.value ? rows.value.filter(rowHasDiff) : rows.value));

const columns = computed(() => [
  { title: '模板', dataIndex: 'title', width: 260, fixed: 'left' as const },
  ...(view.value?.scopes ?? []).map((sc, i) => ({
    title: `${scopeName(sc)}${i === 0 ? '（基准）' : ''}`,
    key: `sc:${sc}`,
    width: 200,
  })),
]);

// ---------------- 各榜原序 ----------------
const titleMap = computed(() => {
  const m = new Map<number, string>();
  for (const r of view.value?.rows ?? [])
    m.set(r.template.id, r.template.exists ? r.template.title : `#${r.template.id}`);
  return m;
});
const titleOf = (id: number) => titleMap.value.get(id) ?? `#${id}`;
const rowById = computed(() => new Map(rows.value.map((r) => [r.template.id, r])));
/** 在某榜的条目：若它在另一个选中的榜里「该上却不在」→ 高亮 */
function listItemClass(sc: string, id: number): string {
  const r = rowById.value.get(id);
  if (!r) return '';
  const lacking = (view.value?.scopes ?? []).some((o) => o !== sc && !r.cells[o] && isMember(r, o));
  return lacking ? 'li-diff' : '';
}
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 12px;
  color: var(--ant-color-text-secondary, #666);
}
.sw {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-left: 8px;
}
.sw-diff {
  background: #fff1b8;
  border: 1px solid #faad14;
}
.sw-miss {
  background: #ffccc7;
  border: 1px solid #ff4d4f;
}
.sw-na {
  background: #f5f5f5;
  border: 1px dashed #bfbfbf;
}
.tpl {
  display: flex;
  gap: 8px;
  align-items: center;
}
.thumb {
  width: 40px;
  height: 52px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.thumb-empty {
  background: var(--ant-color-fill-quaternary, #f5f5f5);
  color: var(--ant-color-text-quaternary, #bbb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.t-title {
  font-weight: 500;
}
.cell {
  padding: 6px 8px;
  border-radius: 4px;
  min-height: 52px;
}
.cell-diff {
  background: #fff1b8;
  border: 1px solid #faad14;
}
.cell-miss {
  background: #ffccc7;
  border: 1px solid #ff4d4f;
  color: #a8071a;
}
.cell-na {
  background: #f5f5f5;
  border: 1px dashed #bfbfbf;
}
.delta {
  margin-left: 6px;
  font-size: 12px;
  color: #d46b08;
}
.lists {
  display: grid;
  gap: 12px;
  overflow-x: auto;
}
.list-col {
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  border-radius: 6px;
  min-width: 220px;
}
.list-head {
  padding: 8px 12px;
  font-weight: 600;
  background: var(--ant-color-fill-quaternary, #fafafa);
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
}
.li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f5f5f5);
}
.li-diff {
  background: #fff1b8;
}
.li-rank {
  width: 24px;
  flex: none;
}
.li-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
