<template>
  <div class="hs">
    <div class="hs-head">
      <div>
        <b>头条情况</b>
        <span v-if="status" class="muted">
          · 版本 v{{ status.version || '—' }} · 在 {{ onBoardCount }} 个榜上
        </span>
      </div>
      <a-space>
        <a-button size="small" :loading="loading" @click="load">刷新</a-button>
        <template v-if="status">
          <a-button v-permission="'creaft_catalog:edit'" size="small" @click="openRecommend()">
            推荐
          </a-button>
          <a-button
            v-permission="'creaft_catalog:edit'"
            size="small"
            danger
            @click="openSuppress()"
          >
            取消推荐 / 屏蔽
          </a-button>
        </template>
      </a-space>
    </div>

    <a-alert
      v-if="absent"
      type="info"
      show-icon
      message="这个模板不在头条目录里（草稿、回收站或用户不可见），上线后才会参与头条评选"
    />
    <a-alert v-else-if="failed" type="error" show-icon :message="failed" />

    <a-spin :spinning="loading && !status">
      <template v-if="status">
        <a-table
          :columns="scopeColumns"
          :data-source="status.scopes"
          :pagination="false"
          row-key="scope"
          size="small"
          :scroll="{ x: 760 }"
        >
          <template #emptyText>
            <a-empty description="没有所属行业" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'name'">
              {{ record.scope === GLOBAL_SCOPE ? '全站总榜' : record.name }}
              <a-tag v-if="record.scope === GLOBAL_SCOPE" color="orange">仅后台可见</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'rank'">
              <b v-if="record.onBoard">第 {{ record.rank }} 名</b>
              <span v-else class="muted">未上榜</span>
            </template>
            <template v-else-if="column.dataIndex === 'source'">
              <template v-if="record.onBoard && record.source">
                <a-tag :color="SOURCE_META[record.source as HeadlineSource].color">
                  {{ SOURCE_META[record.source as HeadlineSource].label }}
                </a-tag>
              </template>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.dataIndex === 'score'">
              {{ record.score === null ? '—' : Math.round(record.score * 100) / 100 }}
              <span class="muted">· 近 7 天 {{ record.uses7d }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'state'">
              <a-tag v-if="record.suppressed" color="red">已屏蔽 / 取消</a-tag>
              <template v-else-if="!record.onBoard">
                <a-tag v-if="record.nearMiss" color="gold">差一点</a-tag>
                <span v-if="record.skipReason" class="muted">{{
                  skipText(record.skipReason)
                }}</span>
                <span v-if="record.gapToCutoff !== null" class="muted">
                  · 距门槛 {{ Math.round(record.gapToCutoff * 100) / 100 }}
                </span>
              </template>
              <span v-else class="muted">正常</span>
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-space v-if="record.scope !== GLOBAL_SCOPE" size="small">
                <template v-if="record.suppressed">
                  <a-button
                    v-for="b in blocksOf(record.scope)"
                    :key="b.id"
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    @click="removeBlock(b)"
                  >
                    解除{{ b.kind === 'BLOCK' ? '屏蔽' : '取消' }}
                  </a-button>
                </template>
                <template v-else>
                  <a-button
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    @click="openRecommend(record.scope)"
                  >
                    推荐
                  </a-button>
                  <a-button
                    v-if="currentRuleOf(record.scope)"
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    @click="cancelRule(currentRuleOf(record.scope)!)"
                  >
                    取消推荐
                  </a-button>
                  <a-button
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    danger
                    @click="openSuppress(record.scope)"
                  >
                    屏蔽
                  </a-button>
                </template>
              </a-space>
              <span v-else class="muted">总榜不可写</span>
            </template>
          </template>
        </a-table>

        <div v-if="status.rules.length" class="sub">
          <div class="sub-title">人工推荐规则</div>
          <div v-for="r in status.rules" :key="r.id" class="sub-row">
            <a-tag
              :color="r.phase === 'CURRENT' ? 'green' : r.phase === 'UPCOMING' ? 'blue' : 'default'"
            >
              {{ PHASE_TEXT[r.phase] }}
            </a-tag>
            <span>{{ r.scopeName || r.scope }}</span>
            <span class="muted">{{ r.startDate }} ~ {{ r.endDate }}</span>
            <span v-if="r.pinPosition" class="muted">· 定位第 {{ r.pinPosition }} 名</span>
            <span class="why">{{ r.why }}</span>
          </div>
        </div>
        <div v-if="status.blocks.length" class="sub">
          <div class="sub-title">屏蔽 / 取消推荐</div>
          <div v-for="b in status.blocks" :key="b.id" class="sub-row">
            <a-tag :color="b.kind === 'BLOCK' ? 'red' : 'orange'">
              {{ b.kind === 'BLOCK' ? '屏蔽' : '取消推荐' }}
            </a-tag>
            <span>{{ b.scopeName || b.scope }}</span>
            <span class="muted">{{
              b.permanent ? '永久' : `至 ${(b.untilAt ?? '').replace('T', ' ')}`
            }}</span>
            <span class="why">{{ b.reason }}</span>
          </div>
        </div>
      </template>
    </a-spin>

    <RecommendModal
      v-model:open="recommendOpen"
      :fixed-target="target"
      :default-scope="actionScope"
      :suppressions="status?.blocks ?? []"
      @done="load"
    />
    <SuppressModal
      v-model:open="suppressOpen"
      :target="target"
      :default-scope="actionScope"
      :scope-catalog="catalog"
      @done="load"
    />
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, ref, watch } from 'vue';

import {
  GLOBAL_SCOPE,
  PlazaError,
  deleteHeadlineRule,
  deleteHeadlineSuppression,
  getHeadlineScopes,
  getHeadlineTemplateStatus,
  type HeadlineRule,
  type HeadlineScopeSummary,
  type HeadlineSource,
  type HeadlineSuppression,
  type HeadlineTemplateStatus,
} from '@/api/plaza-admin';

import { SOURCE_META } from '../plaza-headline-board/labels';
import RecommendModal from '../plaza-headline-board/RecommendModal.vue';
import SuppressModal from '../plaza-headline-board/SuppressModal.vue';

const props = defineProps<{ templateId: number | null; active: boolean; reloadKey?: number }>();

const status = ref<HeadlineTemplateStatus | null>(null);
const catalog = ref<HeadlineScopeSummary[]>([]);
const loading = ref(false);
const absent = ref(false);
const failed = ref('');

const PHASE_TEXT = { CURRENT: '生效中', UPCOMING: '未开始', EXPIRED: '已过期' } as const;
const SKIP_TEXT: Record<string, string> = {
  NOT_IN_SCOPE: '不属于该范围',
  TEMPLATE_DISABLED: '模板不可见',
  SUPPRESSED: '被取消 / 屏蔽',
  MANUAL_EXISTS: '已有人工推荐',
  BELOW_MIN_DECAYED: '衰减热度未达门槛',
  BELOW_MIN_USERS: '去重用户数未达门槛',
  DIVERSITY_MEDIA: '同类媒体已满',
  CUT_BY_SLOTS: '名额已满',
};
const skipText = (r: string) => SKIP_TEXT[r] ?? r;

const scopeColumns = [
  { title: '榜单', dataIndex: 'name', width: 170 },
  { title: '名次', dataIndex: 'rank', width: 90 },
  { title: '来源', dataIndex: 'source', width: 80 },
  { title: '分数 / 热度', dataIndex: 'score', width: 140 },
  { title: '状态', dataIndex: 'state' },
  { title: '操作', key: 'operation', width: 210, fixed: 'right' as const },
];

const onBoardCount = computed(() => status.value?.scopes.filter((s) => s.onBoard).length ?? 0);
const blocksOf = (scope: string) => (status.value?.blocks ?? []).filter((b) => b.scope === scope);
const currentRuleOf = (scope: string): HeadlineRule | undefined =>
  (status.value?.rules ?? []).find(
    (r) => r.scope === scope && r.phase === 'CURRENT' && r.enabled === 1,
  );

let seq = 0;
async function load() {
  if (props.templateId == null) return;
  const s = ++seq;
  loading.value = true;
  absent.value = false;
  failed.value = '';
  try {
    const v = await getHeadlineTemplateStatus(props.templateId, { silent: true });
    if (s === seq) status.value = v;
  } catch (e) {
    if (s !== seq) return;
    status.value = null;
    if (e instanceof PlazaError && e.reason === 'HEADLINE_TEMPLATE_NOT_FOUND') absent.value = true;
    else failed.value = e instanceof Error ? e.message : '头条情况加载失败';
  } finally {
    if (s === seq) loading.value = false;
  }
}

async function loadCatalog() {
  if (catalog.value.length) return;
  try {
    catalog.value = (await getHeadlineScopes())?.scopes ?? [];
  } catch {
    /* 已提示；只影响「同时作用于上级」是否出现 */
  }
}

watch(
  () => [props.active, props.templateId, props.reloadKey] as const,
  ([active]) => {
    if (!active || props.templateId == null) return;
    load();
    loadCatalog();
  },
  { immediate: true },
);

// ---------------- 快捷操作（复用头条管理页的弹窗） ----------------
const target = computed(() =>
  status.value ? { id: status.value.template.id, title: status.value.template.title } : null,
);
const actionScope = ref<string | undefined>();
const recommendOpen = ref(false);
const suppressOpen = ref(false);
function openRecommend(scope?: string) {
  actionScope.value = scope;
  recommendOpen.value = true;
}
function openSuppress(scope?: string) {
  actionScope.value = scope;
  suppressOpen.value = true;
}

function cancelRule(rule: HeadlineRule) {
  Modal.confirm({
    title: `取消在「${rule.scopeName || rule.scope}」的推荐？`,
    content: '人工推荐规则会被删除，模板回到算法评选。',
    okText: '取消推荐',
    onOk: async () => {
      try {
        await deleteHeadlineRule(rule.id);
        message.success('已取消推荐');
        await load();
      } catch {
        /* 已提示 */
      }
    },
  });
}

function removeBlock(b: HeadlineSuppression) {
  const what = b.kind === 'BLOCK' ? '屏蔽' : '取消推荐';
  Modal.confirm({
    title: `解除在「${b.scopeName || b.scope}」的${what}？`,
    okText: '解除',
    onOk: async () => {
      try {
        await deleteHeadlineSuppression(b.id);
        message.success('已解除');
        await load();
      } catch {
        /* 已提示 */
      }
    },
  });
}
</script>

<style scoped>
.hs-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.sub {
  margin-top: 16px;
}
.sub-title {
  font-weight: 500;
  margin-bottom: 6px;
}
.sub-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
.why {
  color: var(--ant-color-text-secondary, #666);
}
</style>
