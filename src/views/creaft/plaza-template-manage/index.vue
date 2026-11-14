<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">模板管理</h2>
      <a-space>
        <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
        <a-badge :count="unassignedTotal" :overflow-count="999">
          <a-button
            :type="unassignedTotal > 0 ? 'primary' : 'default'"
            :danger="unassignedTotal > 0"
            @click="unassignedOpen = true"
          >
            待分配行业 {{ unassignedTotal }} 个
          </a-button>
        </a-badge>
        <span v-if="unassignedEnabled > 0" class="muted">
          其中 {{ unassignedEnabled }} 个已上线，挂上行业就对用户可见
        </span>
        <a-tooltip :title="tipOf('edit')">
          <a-button
            v-permission="'creaft_catalog:edit'"
            type="primary"
            :disabled="blocked('edit')"
            @click="openEditor()"
          >
            新建模板
          </a-button>
        </a-tooltip>
        <a-button @click="openOrder()">行业内排序</a-button>
        <a-button @click="openPreview()">以用户视角预览</a-button>
      </a-space>
    </div>

    <a-card variant="borderless">
      <a-tabs v-model:active-key="stateTab" @change="onTabChange">
        <a-tab-pane v-for="t in stateTabs" :key="t.value" :tab="t.label" />
      </a-tabs>

      <div class="filter-bar">
        <a-input
          v-model:value="filters.keyword"
          allow-clear
          placeholder="标题 / 描述 / 标签"
          style="width: 220px"
          @press-enter="reloadFirst"
          @change="onKeywordChange"
        />
        <a-tree-select
          v-model:value="filters.industryId"
          :tree-data="industryTree"
          allow-clear
          tree-default-expand-all
          placeholder="行业"
          style="width: 180px"
          @change="reloadFirst"
        />
        <a-checkbox
          v-if="filters.industryId"
          v-model:checked="filters.includeChildren"
          @change="reloadFirst"
        >
          含子级
        </a-checkbox>
        <a-select
          v-model:value="filters.mediaType"
          allow-clear
          placeholder="媒体类型"
          style="width: 120px"
          :options="mediaOptions"
          @change="reloadFirst"
        />
        <a-input
          v-model:value="filters.createdBy"
          allow-clear
          placeholder="创建人 ID"
          style="width: 120px"
          @press-enter="reloadFirst"
          @change="onKeywordChange"
        />
        <a-range-picker
          v-model:value="onlineRange"
          value-format="YYYY-MM-DD"
          :placeholder="['上线自', '上线至']"
          style="width: 240px"
          @change="reloadFirst"
        />
        <a-select
          v-model:value="sortKey"
          style="width: 150px"
          :options="sortOptions"
          @change="reloadFirst"
        />
        <a-checkbox v-model:checked="filters.unassigned" @change="reloadFirst"
          >未分配行业</a-checkbox
        >
      </div>

      <div v-if="selectedIds.length" class="bulk">
        <b>已选 {{ selectedIds.length }} 个</b>
        <template v-if="filters.state === 'DELETED'">
          <a-tooltip :title="tipOf('trash')">
            <a-button
              v-permission="'plaza:delete'"
              size="small"
              :disabled="blocked('trash')"
              @click="runBatch('restore')"
            >
              恢复
            </a-button>
          </a-tooltip>
        </template>
        <template v-else>
          <a-tooltip :title="tipOf('status')">
            <a-button
              v-permission="'plaza:publish'"
              size="small"
              :disabled="blocked('status')"
              @click="openSchedule()"
            >
              发布
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('status')">
            <a-button
              v-permission="'plaza:publish'"
              size="small"
              :disabled="blocked('status')"
              @click="runBatch('offline')"
            >
              下线
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('industryRel')">
            <a-button
              v-permission="'creaft_catalog:edit'"
              size="small"
              :disabled="blocked('industryRel')"
              @click="openIndustryOp('assign')"
            >
              挂行业
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('industryRel')">
            <a-button
              v-permission="'creaft_catalog:edit'"
              size="small"
              :disabled="blocked('industryRel')"
              @click="openIndustryOp('unassign')"
            >
              移出行业
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('industryRel')">
            <a-button
              v-permission="'creaft_catalog:edit'"
              size="small"
              :disabled="blocked('industryRel')"
              @click="openIndustryOp('replaceIndustries')"
            >
              覆盖行业
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('industryRel')">
            <a-button
              v-permission="'creaft_catalog:edit'"
              size="small"
              :disabled="blocked('industryRel')"
              @click="runBatch('setOrder')"
            >
              行业内置顶
            </a-button>
          </a-tooltip>
          <a-tooltip :title="tipOf('trash')">
            <a-button
              v-permission="'plaza:delete'"
              size="small"
              danger
              :disabled="blocked('trash')"
              @click="confirmBatchDelete"
            >
              移入回收站
            </a-button>
          </a-tooltip>
        </template>
        <a-button type="link" size="small" @click="selectedIds = []">取消选择</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :row-selection="{
          selectedRowKeys: selectedIds,
          onChange: (keys: (string | number)[]) => (selectedIds = keys.map(Number)),
        }"
        :scroll="{ x: 1200 }"
      >
        <template #emptyText>
          <a-empty description="没有符合条件的模板" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="tpl-cell">
              <img v-if="record.coverUrl" :src="record.coverUrl" class="thumb" alt="" />
              <div v-else class="thumb thumb-empty">无图</div>
              <div class="tpl-text">
                <div class="title-cell">{{ record.title }}</div>
                <code class="route-code">#{{ record.id }}</code>
              </div>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'state'">
            <a-tag :color="stateMeta[record.displayState as TemplateDisplayState].color">
              {{ stateMeta[record.displayState as TemplateDisplayState].label }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'industries'">
            <a-space v-if="record.industries.length" :size="4" wrap>
              <a-tag v-for="i in record.industries.slice(0, 2)" :key="i.id">{{ i.name }}</a-tag>
              <a-tooltip
                v-if="record.industries.length > 2"
                :title="record.industries.map((i: { name: string }) => i.name).join('、')"
              >
                <a-tag>+{{ record.industries.length - 2 }}</a-tag>
              </a-tooltip>
            </a-space>
            <a-tag v-else color="red">未分配</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'mediaType'">
            <div>{{ record.mediaType === 'video' ? '视频' : '图片' }}</div>
            <template v-if="record.mediaType === 'video' && record.mediaStatus">
              <a-tooltip
                v-if="record.mediaStatus === 'FAILED'"
                :title="`处理失败：${record.mediaError || '未知原因'}（已试 ${record.mediaAttempts ?? 0} 次）`"
              >
                <a-tag color="red" class="media-tag">处理失败</a-tag>
              </a-tooltip>
              <a-tooltip
                v-else-if="record.mediaStatus !== 'READY'"
                :title="
                  record.mediaError
                    ? `重试中，最近一次错误：${record.mediaError}`
                    : '后台正在抽封面 / 转码，完成后才能发布'
                "
              >
                <a-tag color="processing" class="media-tag">处理中</a-tag>
              </a-tooltip>
              <a-tooltip v-else-if="record.mediaNote" :title="record.mediaNote">
                <a-tag color="green" class="media-tag">已处理</a-tag>
              </a-tooltip>
            </template>
            <div
              v-if="record.mediaType === 'video' && record.mediaStatus === 'FAILED'"
              class="media-error"
              :title="record.mediaError || ''"
            >
              {{ record.mediaError || '处理失败' }}
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'window'">
            <div>{{ record.onlineAt || '立即' }}</div>
            <div class="muted">
              {{ record.offlineAt ? `至 ${record.offlineAt}` : '不限' }}
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'uses7d'">
            {{ record.uses7d }}
          </template>
          <template v-else-if="column.dataIndex === 'headline'">
            <a-tooltip v-if="record.headlineBrief?.onBoard">
              <template #title>
                <div v-for="s in record.headlineBrief.scopes" :key="s.scope">
                  {{ s.name }}：第 {{ s.rank }} 名{{ s.source === 'AUTO' ? '' : '（人工 / 补位）' }}
                </div>
              </template>
              <a-tag color="purple">在榜 {{ record.headlineBrief.scopes.length }}</a-tag>
            </a-tooltip>
            <a-tag v-else-if="record.headlineBrief?.suppressed" color="red">已抑制</a-tag>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-space :size="2" wrap>
              <a-button
                v-if="!record.deleted"
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="link"
                @click="openEditor(record)"
              >
                编辑
              </a-button>
              <a-button size="small" type="link" @click="openPreview(record)">预览</a-button>
              <a-button
                v-if="!record.deleted"
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="link"
                @click="openSlots(record)"
              >
                入参配置
              </a-button>
              <a-dropdown v-if="!record.deleted" :trigger="['click']">
                <a-button v-permission="'creaft_catalog:edit'" size="small" type="link">
                  行业与素材
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item
                      key="assign"
                      :disabled="blocked('industryRel')"
                      :title="tipOf('industryRel')"
                      @click="openRowIndustryOp('assign', record)"
                    >
                      挂行业
                    </a-menu-item>
                    <a-menu-item
                      key="unassign"
                      :disabled="blocked('industryRel') || !record.industries.length"
                      :title="tipOf('industryRel')"
                      @click="openRowIndustryOp('unassign', record)"
                    >
                      移出行业
                    </a-menu-item>
                    <a-menu-item
                      key="attrs"
                      :disabled="blocked('attrs')"
                      :title="tipOf('attrs')"
                      @click="openAttrs(record)"
                    >
                      渠道与媒体类型
                    </a-menu-item>
                    <a-menu-item key="samples" @click="openTemplateSamples(record)">
                      示例素材
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <template v-if="record.deleted">
                <a-tooltip :title="tipOf('trash')">
                  <a-button
                    v-permission="'plaza:delete'"
                    size="small"
                    type="link"
                    :disabled="blocked('trash')"
                    @click="rowAction('restore', record)"
                    >恢复</a-button
                  >
                </a-tooltip>
                <a-tooltip :title="tipOf('trash')">
                  <a-button
                    v-permission="'plaza:delete'"
                    size="small"
                    type="link"
                    danger
                    :disabled="blocked('trash')"
                    @click="rowAction('purge', record)"
                    >彻底删除</a-button
                  >
                </a-tooltip>
              </template>
              <template v-else>
                <a-tooltip :title="tipOf('status')">
                  <a-button
                    v-if="record.state !== 'PUBLISHED'"
                    v-permission="'plaza:publish'"
                    size="small"
                    type="link"
                    :disabled="blocked('status')"
                    @click="openSchedule(record)"
                  >
                    发布
                  </a-button>
                  <a-button
                    v-else
                    v-permission="'plaza:publish'"
                    size="small"
                    type="link"
                    :disabled="blocked('status')"
                    @click="rowAction('offline', record)"
                  >
                    下线
                  </a-button>
                </a-tooltip>
                <a-tooltip
                  v-if="record.mediaType === 'video' && record.mediaStatus === 'FAILED'"
                  :title="tipOf('edit') || '重新抽封面 / 转码'"
                >
                  <a-button
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    :disabled="blocked('edit')"
                    @click="rowAction('reprocess', record)"
                    >重新处理</a-button
                  >
                </a-tooltip>
                <a-tooltip :title="tipOf('trash')">
                  <a-button
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    :disabled="blocked('trash')"
                    @click="rowAction('duplicate', record)"
                    >复制</a-button
                  >
                </a-tooltip>
                <a-tooltip :title="tipOf('trash')">
                  <a-button
                    v-permission="'plaza:delete'"
                    size="small"
                    type="link"
                    danger
                    :disabled="blocked('trash')"
                    @click="rowAction('delete', record)"
                    >删除</a-button
                  >
                </a-tooltip>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>

      <div class="pager">
        <span class="muted">共 {{ total }} 条 · 软删除的模板在回收站保留 30 天</span>
        <a-pagination
          v-model:current="page"
          v-model:page-size="size"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="load"
        />
      </div>
    </a-card>

    <!-- 发布（可定时） -->
    <a-modal
      v-model:open="scheduleOpen"
      :title="
        scheduleTarget ? `发布「${scheduleTarget.title}」` : `批量发布 ${selectedIds.length} 个模板`
      "
      :confirm-loading="acting"
      @ok="doPublish"
    >
      <a-form :label-col="{ span: 5 }">
        <a-form-item label="上线时间" extra="留空 = 立即上线">
          <a-date-picker
            v-model:value="schedule.onlineAt"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="下线时间" extra="留空 = 不限">
          <a-date-picker
            v-model:value="schedule.offlineAt"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item
          label="行业"
          extra="没有绑定行业的模板默认不让发布；勾选后会发布，但用户端暂不可见"
        >
          <a-checkbox v-model:checked="schedule.force">没有行业也发布</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 行业追加 / 移除 / 覆盖（批量与单行共用） -->
    <IndustryPickModal
      v-model:open="industryOpOpen"
      :mode="industryOp"
      :count="opIds.length"
      :industries="roots"
      :loading="acting"
      @ok="doIndustryOp"
    />

    <!-- 批量结果 -->
    <a-modal v-model:open="resultOpen" title="批量操作结果" :footer="null">
      <p>
        成功 <b>{{ result?.ok.length ?? 0 }}</b> 个，失败
        <b>{{ result?.failed.length ?? 0 }}</b> 个。
      </p>
      <a-collapse v-if="result?.failed.length" ghost>
        <a-collapse-panel key="f" header="展开失败原因">
          <ul class="fail-list">
            <li v-for="f in result.failed" :key="f.id">#{{ f.id }}：{{ f.reason }}</li>
          </ul>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>

    <TemplateEditorDrawer
      v-model:open="editorOpen"
      :template="editorTarget"
      :industries="roots"
      @saved="reloadAll"
    />

    <SlotsDrawer v-model:open="slotsOpen" :template="slotsTarget" @saved="load" />

    <AttrsModal v-model:open="attrsOpen" :template="attrsTarget" @saved="load" />

    <SamplesModal
      v-model:open="samplesOpen"
      :scope-type="samplesScope"
      :target-id="samplesTargetId"
      :target-name="samplesTargetName"
    />

    <UnassignedDrawer v-model:open="unassignedOpen" :industries="roots" @changed="reloadAll" />

    <IndustryOrderDrawer
      v-model:open="orderOpen"
      :industries="roots"
      :initial-industry-id="orderInitialId"
      @samples="openIndustrySamples"
      @saved="load"
    />

    <UserPreview v-model:open="previewOpen" :initial-industry-code="previewIndustryCode" />
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
  batchTemplates,
  deleteTemplate,
  duplicateTemplate,
  getIndustries,
  getUnassignedSummary,
  isConflictError,
  isOpBlocked,
  loadPlazaCapabilities,
  reportWriteError,
  setTemplateIndustries,
  WRITE_DISABLED_TIP,
  type WriteOp,
  getPlazaTemplates,
  getTrashTemplates,
  isPlazaMock,
  dayStart,
  nextDayStart,
  offlineTemplate,
  publishTemplate,
  purgeTemplate,
  reprocessTemplateMedia,
  restoreTemplate,
  type IndustryNode,
  type PlazaTemplateQuery,
  type PlazaTemplateRow,
  type TemplateBatchAction,
  type TemplateBatchRequest,
  type TemplateBatchResult,
  type TemplateDisplayState,
} from '@/api/plaza-admin';

import AttrsModal from './AttrsModal.vue';
import TemplateEditorDrawer from './editor/TemplateEditorDrawer.vue';
import IndustryOrderDrawer from './IndustryOrderDrawer.vue';
import IndustryPickModal, { type IndustryOpMode } from './IndustryPickModal.vue';
import SamplesModal from './SamplesModal.vue';
import SlotsDrawer from './slots/SlotsDrawer.vue';
import UnassignedDrawer from './UnassignedDrawer.vue';
import UserPreview from './UserPreview.vue';

const route = useRoute();

// 交接期：后端回 ADMIN_WRITE_DISABLED 的操作组置灰并提示（见 api 的 WriteOp）
const blocked = (op: WriteOp) => isOpBlocked(op);
const tipOf = (op: WriteOp) => (isOpBlocked(op) ? WRITE_DISABLED_TIP : '');

const stateMeta: Record<TemplateDisplayState, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'orange' },
  SCHEDULED: { label: '定时上线中', color: 'blue' },
  EXPIRED: { label: '已过期', color: 'red' },
  DELETED: { label: '已删除', color: 'default' },
};
const stateTabs = [
  { label: '全部', value: 'ALL' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已下线', value: 'OFFLINE' },
  { label: '定时上线中', value: 'SCHEDULED' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '回收站', value: 'DELETED' },
];
const mediaOptions = [
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];
const sortOptions = [
  { label: '全局排序', value: 'sortOrder:asc' },
  { label: '最近更新', value: 'updatedAt:desc' },
  { label: '创建时间', value: 'createdAt:desc' },
  { label: '近 7 天复刻', value: 'uses7d:desc' },
  { label: '行业内顺序', value: 'industryOrder:asc' },
];

const columns = [
  { title: '模板', dataIndex: 'title', width: 280 },
  { title: '状态', dataIndex: 'state', width: 110 },
  { title: '行业', dataIndex: 'industries', width: 170 },
  { title: '类型 / 处理', dataIndex: 'mediaType', width: 110 },
  { title: '上线 / 下线', dataIndex: 'window', width: 170 },
  { title: '近 7 天复刻', dataIndex: 'uses7d', width: 100 },
  { title: '头条', dataIndex: 'headline', width: 70 },
  { title: '创建人', dataIndex: 'createdBy', width: 100 },
  { title: '更新时间', dataIndex: 'updateTime', width: 160 },
  { title: '操作', key: 'operation', width: 360, fixed: 'right' as const },
];

// ---- 筛选 ----
const stateTab = ref('ALL');
const filters = reactive({
  keyword: '',
  industryId: undefined as number | undefined,
  includeChildren: true,
  mediaType: undefined as 'image' | 'video' | undefined,
  createdBy: '',
  state: undefined as TemplateDisplayState | undefined,
  unassigned: false,
});
const onlineRange = ref<[string, string] | undefined>();
const sortKey = ref('sortOrder:asc');
const page = ref(1);
const size = ref(20);

const rows = ref<PlazaTemplateRow[]>([]);
const total = ref(0);
const unassignedTotal = ref(0);
const unassignedEnabled = ref(0);
const summaryOk = ref(false);
function reloadAll() {
  load();
  loadUnassignedSummary();
}
async function loadUnassignedSummary() {
  try {
    const r = await getUnassignedSummary();
    unassignedTotal.value = r?.total ?? unassignedTotal.value;
    unassignedEnabled.value = r?.enabled ?? 0;
    summaryOk.value = true;
  } catch {
    /* 旧后端没有该接口：沿用列表带回的 unassignedCount */
  }
}
const loading = ref(false);
const selectedIds = ref<number[]>([]);

const roots = ref<IndustryNode[]>([]);
const industryTree = computed(() =>
  roots.value.map((r) => ({
    title: r.enabled ? r.name : `${r.name}（停用）`,
    value: r.id,
    children: (r.children ?? []).map((c) => ({ title: c.name, value: c.id })),
  })),
);

function onTabChange(key: string | number) {
  filters.state = key === 'ALL' ? undefined : (key as TemplateDisplayState);
  reloadFirst();
}

let kwTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(kwTimer);
  kwTimer = setTimeout(reloadFirst, 350);
}
function reloadFirst() {
  clearTimeout(kwTimer);
  page.value = 1;
  load();
}

let seq = 0;
async function load() {
  const s = ++seq;
  loading.value = true;
  selectedIds.value = [];
  try {
    const [sort, order] = sortKey.value.split(':');
    const creator = Number(filters.createdBy.trim());
    const q: PlazaTemplateQuery = {
      keyword: filters.keyword.trim() || undefined,
      industryId: filters.industryId,
      includeChildren: filters.industryId ? filters.includeChildren : undefined,
      mediaType: filters.mediaType,
      state: filters.state,
      createdBy: Number.isInteger(creator) && creator > 0 ? creator : undefined,
      // Go 不认纯日期；onlineTo 是开区间（<），取结束日次日 0 点才含结束日当天
      onlineFrom: onlineRange.value?.[0] ? dayStart(onlineRange.value[0]) : undefined,
      onlineTo: onlineRange.value?.[1] ? nextDayStart(onlineRange.value[1]) : undefined,
      unassigned: filters.unassigned || undefined,
      sort: sort as PlazaTemplateQuery['sort'],
      order: order as 'asc' | 'desc',
      page: page.value,
      size: size.value,
    };
    const res =
      filters.state === 'DELETED'
        ? await getTrashTemplates({ page: page.value, size: size.value })
        : await getPlazaTemplates(q);
    if (s !== seq) return;
    rows.value = res?.items ?? [];
    total.value = res?.total ?? 0;
    // 回收站接口不带未分配计数（恒为 0），沿用上一次的
    if (filters.state !== 'DELETED' && !summaryOk.value)
      unassignedTotal.value = res?.unassignedCount ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
    scheduleMediaPoll();
  }
}

// 有视频在处理中时每 8 秒静默刷新一次，处理完成 / 失败后状态自己变过来
let mediaTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleMediaPoll() {
  clearTimeout(mediaTimer);
  if (!rows.value.some((r) => r.mediaType === 'video' && r.mediaStatus === 'PROCESSING')) return;
  mediaTimer = setTimeout(() => {
    if (!loading.value) load();
  }, 8000);
}
onBeforeUnmount(() => clearTimeout(mediaTimer));

// ---- 新建 / 编辑 ----
const editorOpen = ref(false);
const editorTarget = ref<PlazaTemplateRow | null>(null);
function openEditor(row?: PlazaTemplateRow) {
  editorTarget.value = row ?? null;
  editorOpen.value = true;
}

// ---- 批量 / 单行 ----
const acting = ref(false);
const result = ref<TemplateBatchResult | null>(null);
const resultOpen = ref(false);

function showResult(r: TemplateBatchResult) {
  result.value = r;
  if (r.failed.length) resultOpen.value = true;
  else message.success(`已处理 ${r.ok.length} 个`);
}

async function runBatch(
  action: TemplateBatchAction,
  extra: Omit<TemplateBatchRequest, 'ids'> = {},
  ids: number[] = selectedIds.value,
) {
  // 置顶 = 在「所选行业」里排到最前，Go 要求恰好一个行业：取筛选里选中的那个
  if (action === 'setOrder') {
    if (!filters.industryId) {
      message.warning('置顶需要先在筛选里选一个行业');
      return false;
    }
    extra = { ...extra, industryIds: [filters.industryId] };
  }
  acting.value = true;
  try {
    const r = await batchTemplates(action, { ids, ...extra });
    showResult(r);
    await load();
    return true;
  } catch {
    return false;
  } finally {
    acting.value = false;
  }
}

function confirmBatchDelete() {
  Modal.confirm({
    title: `把 ${selectedIds.value.length} 个模板移入回收站？`,
    content: '回收站保留 30 天，期间可恢复；其人工头条规则会自动失效。',
    okText: '移入回收站',
    okType: 'danger',
    onOk: () => runBatch('delete'),
  });
}

const scheduleOpen = ref(false);
const scheduleTarget = ref<PlazaTemplateRow | null>(null);
const schedule = reactive({
  onlineAt: undefined as string | undefined,
  offlineAt: undefined as string | undefined,
  force: false,
});

function openSchedule(row?: PlazaTemplateRow) {
  scheduleTarget.value = row ?? null;
  schedule.onlineAt = undefined;
  schedule.offlineAt = undefined;
  schedule.force = false;
  scheduleOpen.value = true;
}

async function doPublish() {
  if (schedule.onlineAt && schedule.offlineAt && schedule.offlineAt <= schedule.onlineAt) {
    message.warning('下线时间必须晚于上线时间');
    return;
  }
  const body = {
    onlineAt: schedule.onlineAt,
    offlineAt: schedule.offlineAt,
    force: schedule.force || undefined,
  };
  if (!scheduleTarget.value) {
    if (await runBatch('publish', body)) scheduleOpen.value = false;
    return;
  }
  acting.value = true;
  try {
    const r = await publishTemplate(scheduleTarget.value.id, body);
    message.success(body.onlineAt ? '已设为定时上线' : '已发布');
    r?.warnings?.forEach((w) => message.warning(w));
    scheduleOpen.value = false;
    await load();
  } catch {
    /* 已提示 */
  } finally {
    acting.value = false;
  }
}

const industryOpOpen = ref(false);
const industryOp = ref<IndustryOpMode>('assign');
/** 本次行业操作的模板：批量 = 已选；单行 = 该行 */
const opIds = ref<number[]>([]);
function openIndustryOp(op: IndustryOpMode) {
  industryOp.value = op;
  opRow.value = null;
  opIds.value = [...selectedIds.value];
  industryOpOpen.value = true;
}
function openRowIndustryOp(op: IndustryOpMode, row: PlazaTemplateRow) {
  industryOp.value = op;
  opRow.value = row;
  opIds.value = [row.id];
  industryOpOpen.value = true;
}
/** 单行挂 / 移出：走 PUT /templates/{id}/industries（增量、幂等，带 revision 防覆盖他人改动） */
const opRow = ref<PlazaTemplateRow | null>(null);
async function doIndustryOp(industryIds: number[]) {
  const row = opRow.value;
  if (row && opIds.value.length === 1 && industryOp.value !== 'replaceIndustries') {
    acting.value = true;
    try {
      const body =
        industryOp.value === 'assign' ? { assign: industryIds } : { unassign: industryIds };
      const r = await setTemplateIndustries(row.id, { ...body, revision: row.revision });
      message.success(r.changed ? '已更新行业' : '没有变化');
      industryOpOpen.value = false;
      await Promise.all([load(), loadUnassignedSummary()]);
    } catch (e) {
      reportWriteError(e, '他人已修改该模板，已刷新列表，请重试');
      if (isConflictError(e)) await load();
    } finally {
      acting.value = false;
    }
    return;
  }
  if (await runBatch(industryOp.value, { industryIds }, opIds.value)) {
    industryOpOpen.value = false;
    loadUnassignedSummary();
  }
}

async function rowAction(
  action: 'offline' | 'duplicate' | 'delete' | 'restore' | 'purge' | 'reprocess',
  row: PlazaTemplateRow,
) {
  const run = async () => {
    try {
      if (action === 'offline') await offlineTemplate(row.id);
      else if (action === 'duplicate') await duplicateTemplate(row.id);
      else if (action === 'reprocess') await reprocessTemplateMedia(row.id);
      else if (action === 'delete') await deleteTemplate(row.id);
      else if (action === 'restore') await restoreTemplate(row.id);
      else await purgeTemplate(row.id);
      message.success(action === 'reprocess' ? '已重新排队，后台处理中' : '已完成');
      await load();
    } catch (e) {
      if (action === 'reprocess') reportWriteError(e);
    }
  };
  if (action === 'delete' || action === 'purge' || action === 'offline') {
    Modal.confirm({
      title:
        action === 'purge'
          ? `彻底删除「${row.title}」？`
          : action === 'delete'
            ? `把「${row.title}」移入回收站？`
            : `下线「${row.title}」？`,
      content:
        action === 'purge'
          ? '物理删除模板、行业关系与其头条规则，不可恢复。'
          : action === 'offline'
            ? '下线后用户端立即不可见，其头条名额由算法补位。'
            : '回收站保留 30 天，可恢复。',
      okText: '确认',
      okType: action === 'offline' ? 'primary' : 'danger',
      onOk: run,
    });
    return;
  }
  await run();
}

// ---- 入参配置 ----
const slotsOpen = ref(false);
const slotsTarget = ref<PlazaTemplateRow | null>(null);
function openSlots(row: PlazaTemplateRow) {
  slotsTarget.value = row;
  slotsOpen.value = true;
}

// ---- 渠道与媒体类型 / 示例素材 / 排序 ----
const attrsOpen = ref(false);
const attrsTarget = ref<PlazaTemplateRow | null>(null);
function openAttrs(row: PlazaTemplateRow) {
  attrsTarget.value = row;
  attrsOpen.value = true;
}

const samplesOpen = ref(false);
const samplesScope = ref<'INDUSTRY' | 'TEMPLATE'>('TEMPLATE');
const samplesTargetId = ref(0);
const samplesTargetName = ref('');
function openTemplateSamples(row: PlazaTemplateRow) {
  samplesScope.value = 'TEMPLATE';
  samplesTargetId.value = row.id;
  samplesTargetName.value = row.title;
  samplesOpen.value = true;
}
function industryName(id: number): string {
  for (const r of roots.value) {
    if (r.id === id) return r.name;
    const c = r.children?.find((x) => x.id === id);
    if (c) return `${r.name} / ${c.name}`;
  }
  return `行业 #${id}`;
}
function openIndustrySamples(industryId: number) {
  samplesScope.value = 'INDUSTRY';
  samplesTargetId.value = industryId;
  samplesTargetName.value = industryName(industryId);
  samplesOpen.value = true;
}

const unassignedOpen = ref(false);
const orderOpen = ref(false);
const orderInitialId = ref<number | undefined>();
function openOrder() {
  orderInitialId.value = filters.industryId;
  orderOpen.value = true;
}

// ---- 预览 ----
const previewOpen = ref(false);
const previewIndustryCode = ref<string | undefined>();
function openPreview(row?: PlazaTemplateRow) {
  const first = row?.industries?.[0];
  previewIndustryCode.value = first?.code ?? filterIndustryCode.value;
  previewOpen.value = true;
}
const filterIndustryCode = computed(() => {
  const id = filters.industryId;
  if (!id) return undefined;
  for (const r of roots.value) {
    if (r.id === id) return r.code;
    const c = r.children?.find((x) => x.id === id);
    if (c) return c.code;
  }
  return undefined;
});

onMounted(async () => {
  // 进页面先取写权能力，被后端拒的操作一开始就置灰
  loadPlazaCapabilities();
  loadUnassignedSummary();
  if (route.query.unassigned) filters.unassigned = true;
  if (route.query.unassignedList) unassignedOpen.value = true;
  try {
    roots.value = (await getIndustries()) ?? [];
  } catch {
    /* 已提示 */
  }
  load();
});
</script>

<style scoped>
.media-tag {
  margin-top: 4px;
  margin-inline-end: 0;
}
.media-error {
  max-width: 100px;
  margin-top: 2px;
  overflow: hidden;
  color: #cf1322;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thumb {
  width: 44px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.thumb-empty {
  display: grid;
  place-items: center;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
  color: var(--ant-color-text-quaternary, #bbb);
  font-size: 12px;
}
.title-cell {
  font-weight: 600;
}
.route-code {
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: var(--ant-color-primary-bg, #e6f4ff);
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
.fail-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}
</style>
