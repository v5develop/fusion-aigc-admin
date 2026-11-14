<template>
  <a-drawer
    :open="open"
    :title="node ? `关联模板：${node.name}` : '关联模板'"
    width="680"
    :mask-closable="false"
    destroy-on-close
    @update:open="onClose"
  >
    <template #extra>
      <a-button
        v-permission="'creaft_catalog:edit'"
        type="primary"
        :loading="saving"
        :disabled="!dirty"
        @click="saveOrder"
      >
        保存顺序
      </a-button>
    </template>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="按行业管理：用户端只会在所选行业下展示该行业的节点模板（最多 12 个，按这里的顺序）。同一模板可以同时挂在多个行业下；排序只影响本行业的先后。"
    />

    <a-tree-select
      v-model:value="industryId"
      :tree-data="tree"
      tree-default-expand-all
      placeholder="先选择行业"
      style="width: 100%; margin-bottom: 12px"
      @change="onIndustryChange"
    />

    <template v-if="industryId">
      <a-select
        v-model:value="pick"
        show-search
        allow-clear
        :filter-option="false"
        :options="searchOptions"
        :loading="searching"
        :disabled="!canEdit || adding"
        :not-found-content="searching ? '搜索中…' : '没有匹配的模板'"
        placeholder="搜索本行业的模板（标题）并添加到末尾"
        style="width: 100%; margin-bottom: 12px"
        @search="onSearch"
        @focus="() => !searchOptions.length && onSearch('')"
        @select="onPick"
      />

      <p v-if="otherCount > 0" class="muted">
        该节点在其它行业下还关联了 {{ otherCount }} 个模板，这里不显示。
      </p>
      <p v-if="items.length > 12" class="muted">
        本行业共 {{ items.length }} 个，用户端只展示前 12 个。
      </p>

      <a-spin :spinning="loading">
        <a-empty v-if="!loading && !items.length" description="本行业下还没有关联模板" />
        <draggable
          v-model="items"
          item-key="id"
          handle=".grip"
          :disabled="!canEdit"
          @change="dirty = true"
        >
          <template #item="{ element, index }">
            <div class="item" :class="{ cut: index >= 12 }">
              <span class="grip" :class="{ off: !canEdit }">⠿</span>
              <span class="no">{{ index + 1 }}</span>
              <img v-if="element.coverUrl" :src="element.coverUrl" class="thumb" alt="" />
              <div v-else class="thumb empty">无图</div>
              <div class="txt">
                <div class="t">{{ element.title }}</div>
                <div class="muted">
                  #{{ element.id }} · {{ stateLabel[element.displayState] ?? element.displayState }}
                  <a-tag v-if="element.displayState !== 'PUBLISHED'" color="orange"
                    >用户当前不可见</a-tag
                  >
                </div>
              </div>
              <a-button
                v-permission="'creaft_catalog:edit'"
                type="link"
                danger
                size="small"
                @click="remove(element)"
              >
                移除
              </a-button>
            </div>
          </template>
        </draggable>
      </a-spin>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, ref, watch } from 'vue';
import draggable from 'vuedraggable';

import {
  PlazaError,
  addNodeTemplates,
  getNodeTemplates,
  getPlazaTemplates,
  removeNodeTemplate,
  sortNodeTemplates,
  type IndustryNode,
  type MarketingNode,
  type NodeTemplateItem,
  type PlazaTemplateRow,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

const props = defineProps<{
  open: boolean;
  node: MarketingNode | null;
  industries: IndustryNode[];
}>();
const emit = defineEmits<{
  'update:open': [v: boolean];
  /** 关联数变了：列表页刷新计数 */
  changed: [];
}>();

const { can } = usePermission();
const canEdit = computed(() => can('creaft_catalog:edit'));

const stateLabel: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
  SCHEDULED: '定时上线中',
  EXPIRED: '已过期',
};

const tree = computed(() =>
  props.industries.map((r) => ({
    title: r.enabled ? r.name : `${r.name}（停用）`,
    value: r.id,
    children: (r.children ?? []).map((c) => ({
      title: c.enabled ? c.name : `${c.name}（停用）`,
      value: c.id,
    })),
  })),
);

const industryId = ref<number | undefined>();
const items = ref<NodeTemplateItem[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const otherCount = computed(() => Math.max(0, total.value - items.value.length));

let seq = 0;
async function load() {
  dirty.value = false;
  if (!props.node || !industryId.value) {
    items.value = [];
    total.value = 0;
    return;
  }
  const s = ++seq;
  loading.value = true;
  try {
    const r = await getNodeTemplates(props.node.id, industryId.value);
    if (s !== seq) return;
    items.value = r?.items ?? [];
    total.value = r?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
}

function confirmDiscard(go: () => void) {
  if (!dirty.value) return go();
  Modal.confirm({
    title: '顺序还没保存，确定放弃？',
    okText: '放弃修改',
    okType: 'danger',
    onOk: go,
  });
}

let lastIndustry: number | undefined;
function onIndustryChange(v: number | undefined) {
  if (!dirty.value) {
    lastIndustry = v;
    resetSearch();
    load();
    return;
  }
  const next = v;
  industryId.value = lastIndustry; // 先回退，确认后再切
  confirmDiscard(() => {
    industryId.value = next;
    lastIndustry = next;
    resetSearch();
    load();
  });
}

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    industryId.value = undefined;
    lastIndustry = undefined;
    items.value = [];
    total.value = 0;
    dirty.value = false;
    resetSearch();
  },
);

// ---------------- 搜索添加 ----------------
const pick = ref<number | undefined>();
const searching = ref(false);
const adding = ref(false);
const found = ref<PlazaTemplateRow[]>([]);
let searchSeq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const linked = computed(() => new Set(items.value.map((x) => x.id)));
const searchOptions = computed(() =>
  found.value.map((t) => ({
    value: t.id,
    label: `${t.title}（#${t.id}${t.displayState === 'PUBLISHED' ? '' : ` · ${stateLabel[t.displayState] ?? t.displayState}`}）${linked.value.has(t.id) ? ' · 已添加' : ''}`,
    disabled: linked.value.has(t.id),
  })),
);

function resetSearch() {
  pick.value = undefined;
  found.value = [];
}

function onSearch(kw: string) {
  clearTimeout(timer);
  timer = setTimeout(() => doSearch(kw), 250);
}

async function doSearch(kw: string) {
  if (!industryId.value) return;
  const s = ++searchSeq;
  searching.value = true;
  try {
    const r = await getPlazaTemplates({
      keyword: kw.trim() || undefined,
      industryId: industryId.value,
      includeChildren: true,
      page: 1,
      size: 20,
    });
    if (s === searchSeq) found.value = r?.items ?? [];
  } catch {
    if (s === searchSeq) found.value = [];
  } finally {
    if (s === searchSeq) searching.value = false;
  }
}

async function onPick(id: number) {
  pick.value = undefined;
  if (!props.node || !industryId.value) return;
  if (dirty.value) {
    message.warning('先保存当前的顺序，再添加模板');
    return;
  }
  adding.value = true;
  try {
    const r = await addNodeTemplates(props.node.id, industryId.value, [id]);
    message.success(r?.added?.length ? '已添加到末尾' : '已经在这个节点里了');
    await load();
    emit('changed');
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '添加失败');
  } finally {
    adding.value = false;
  }
}

// ---------------- 移除 / 排序 ----------------
function remove(t: NodeTemplateItem) {
  if (!props.node) return;
  const nodeId = props.node.id;
  Modal.confirm({
    title: `把「${t.title}」从该节点移除？`,
    content:
      '只取消与这个节点的关联，不影响模板本身；若它也挂在其它行业下，那些行业里同样会被移除。',
    okText: '移除',
    okType: 'danger',
    onOk: async () => {
      try {
        await removeNodeTemplate(nodeId, t.id);
        message.success('已移除');
        await load();
        emit('changed');
      } catch (e) {
        if (e instanceof PlazaError) message.error(e.message || '移除失败');
      }
    },
  });
}

async function saveOrder() {
  if (!props.node || !industryId.value) return;
  saving.value = true;
  try {
    await sortNodeTemplates(
      props.node.id,
      industryId.value,
      items.value.map((x) => x.id),
    );
    message.success('顺序已保存');
    dirty.value = false;
    await load();
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '保存失败');
    // 集合变了（有人移除 / 挂入）会被拒：重新拉取，避免继续拿旧列表保存
    await load();
  } finally {
    saving.value = false;
  }
}

function onClose(v: boolean) {
  if (v) {
    emit('update:open', v);
    return;
  }
  confirmDiscard(() => emit('update:open', false));
}
</script>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 8px;
  background: var(--ant-color-bg-container, #fff);
}
.item.cut {
  opacity: 0.55;
}
.grip {
  cursor: grab;
  color: var(--ant-color-text-tertiary, #888);
  user-select: none;
}
.grip.off {
  cursor: not-allowed;
  opacity: 0.4;
}
.no {
  width: 22px;
  text-align: center;
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.thumb {
  width: 44px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
}
.thumb.empty {
  display: grid;
  place-items: center;
  font-size: 11px;
  color: var(--ant-color-text-quaternary, #bbb);
}
.txt {
  flex: 1;
  min-width: 0;
}
.t {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
</style>
