<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">广场审计检索</h2>
      <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
    </div>

    <a-alert
      v-if="!allowed"
      type="warning"
      show-icon
      message="没有查看审计的权限（需要 plaza:audit）"
    />
    <template v-else>
      <a-card variant="borderless" style="margin-bottom: 12px">
        <div class="bar">
          <a-auto-complete
            v-model:value="q.resourceType"
            allow-clear
            placeholder="对象类型（可输入前缀）"
            :options="typeOptions"
            :filter-option="filterOption"
            style="width: 190px"
          />
          <a-input
            v-model:value="q.resourceId"
            allow-clear
            placeholder="对象 id（如模板 id）"
            style="width: 170px"
            @press-enter="search"
          />
          <a-auto-complete
            v-model:value="q.action"
            allow-clear
            placeholder="动作（可输入前缀，如 TEMPLATE_）"
            :options="actionOptions"
            :filter-option="filterOption"
            style="width: 260px"
          />
          <a-input
            v-model:value="q.operatorName"
            allow-clear
            placeholder="操作人姓名（模糊）"
            style="width: 160px"
            @press-enter="search"
          />
          <a-input-number
            v-model:value="q.operatorId"
            :min="1"
            :controls="false"
            placeholder="操作人 id"
            style="width: 110px"
          />
          <a-input
            v-model:value="q.batchId"
            allow-clear
            placeholder="批次 id"
            style="width: 200px"
            @press-enter="search"
          />
          <a-range-picker
            v-model:value="q.range"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            style="width: 340px"
          />
          <a-button type="primary" :loading="loading" @click="search">查询</a-button>
          <a-button @click="reset">重置</a-button>
        </div>
        <div class="muted" style="margin-top: 6px">
          操作人姓名模糊匹配（审计里记的名字，或管理员表的姓名 /
          账号）；动作、对象类型选中下拉项为精确匹配，直接输入文字按前缀匹配，也可自己写 *（如
          *_PUBLISH、*MEDIA*）；批次 id 来自批量操作；结束时间不含；每页最多 100 条。
        </div>
      </a-card>

      <a-alert v-if="failed" type="error" show-icon style="margin-bottom: 12px" :message="failed" />

      <a-card variant="borderless">
        <a-table
          :columns="columns"
          :data-source="items"
          :loading="loading"
          :pagination="{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (t: number) => `共 ${t} 条`,
          }"
          row-key="id"
          size="middle"
          :scroll="{ x: 1000 }"
          @change="onTableChange"
        >
          <template #emptyText>
            <a-empty description="没有符合条件的审计记录" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'createTime'">
              {{ record.createTime.replace('T', ' ') }}
            </template>
            <template v-else-if="column.dataIndex === 'operator'">
              {{
                record.operatorName || (record.operatorId ? `管理员 #${record.operatorId}` : '系统')
              }}
              <span v-if="record.operatorId" class="muted">#{{ record.operatorId }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <a-tag :color="colorOf(record.action)">{{ actionLabel(record.action) }}</a-tag>
              <div class="muted">{{ record.action }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'object'">
              {{ typeLabel(record.resourceType) }}
              <span v-if="record.resourceId">#{{ record.resourceId }}</span>
              <div v-if="titleOf(record)" class="muted">{{ titleOf(record) }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :color="record.status === 'SUCCESS' ? 'green' : 'red'">{{
                record.status
              }}</a-tag>
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-button size="small" type="link" @click="openDetail(record)">查看变更</a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </template>

    <a-drawer v-model:open="detailOpen" title="变更详情" width="860" destroy-on-close>
      <template v-if="detail">
        <a-descriptions size="small" :column="2" bordered style="margin-bottom: 12px">
          <a-descriptions-item label="时间">{{
            detail.createTime.replace('T', ' ')
          }}</a-descriptions-item>
          <a-descriptions-item label="操作人">{{
            detail.operatorName || (detail.operatorId ? `#${detail.operatorId}` : '系统')
          }}</a-descriptions-item>
          <a-descriptions-item label="动作"
            >{{ actionLabel(detail.action) }}（{{ detail.action }}）</a-descriptions-item
          >
          <a-descriptions-item label="对象"
            >{{ typeLabel(detail.resourceType) }}
            {{ detail.resourceId ? `#${detail.resourceId}` : '' }}</a-descriptions-item
          >
          <a-descriptions-item label="请求 id">{{ detail.requestId || '—' }}</a-descriptions-item>
          <a-descriptions-item label="来源 IP">{{ detail.clientIp || '—' }}</a-descriptions-item>
          <a-descriptions-item v-if="detail.batchId" label="批次" :span="2">{{
            detail.batchId
          }}</a-descriptions-item>
        </a-descriptions>

        <div v-if="!changes.length" class="muted" style="margin-bottom: 12px">
          {{ detail.diff ? '没有字段变化' : '创建 / 删除类操作没有逐字段对比，见下方快照' }}
        </div>
        <table v-else class="dt">
          <thead>
            <tr>
              <th style="width: 140px">字段</th>
              <th>改前</th>
              <th>改后</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in changes" :key="c.field">
              <td>{{ c.field }}</td>
              <td class="del"><HistoryValue :entry="detail" :change="c" side="before" /></td>
              <td class="add"><HistoryValue :entry="detail" :change="c" side="after" /></td>
            </tr>
          </tbody>
        </table>

        <a-collapse ghost style="margin-top: 12px">
          <a-collapse-panel v-if="detail.before" key="before" header="改前快照">
            <pre class="pre">{{ JSON.stringify(detail.before, null, 2) }}</pre>
          </a-collapse-panel>
          <a-collapse-panel v-if="detail.after" key="after" header="改后快照">
            <pre class="pre">{{ JSON.stringify(detail.after, null, 2) }}</pre>
          </a-collapse-panel>
        </a-collapse>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import {
  AUDIT_RESOURCE_TYPES,
  getAudit,
  isPlazaMock,
  type AuditEntry,
  type AuditQuery,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

import HistoryValue, { type HistoryChange } from '../plaza-template-manage/editor/HistoryValue.vue';

const { can } = usePermission();
const allowed = computed(() => can('plaza:audit'));

const TYPE_LABEL: Record<string, string> = {
  TEMPLATE: '模板',
  INDUSTRY: '行业',
  CHANNEL: '渠道',
  SAMPLE: '示例素材',
  SUGGESTION: '行业建议',
  SEARCH_MISS: '搜索缺口',
  HEADLINE_RULE: '头条推荐规则',
  HEADLINE_BLOCK: '头条屏蔽',
  HEADLINE_PARAMS: '头条参数',
};
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;
const typeOptions = AUDIT_RESOURCE_TYPES.map((t) => ({
  value: t as string,
  label: `${TYPE_LABEL[t] ?? t}（${t}）`,
}));

const ACTION_LABEL: Record<string, string> = {
  TEMPLATE_CREATE: '新建模板',
  TEMPLATE_UPDATE: '整体编辑',
  TEMPLATE_DUPLICATE: '复制模板',
  TEMPLATE_PUBLISH: '发布 / 设置上下线时间',
  TEMPLATE_OFFLINE: '下线',
  TEMPLATE_DELETE: '移入回收站',
  TEMPLATE_RESTORE: '恢复',
  TEMPLATE_PURGE: '彻底删除',
  TEMPLATE_SET_INDUSTRIES: '调整行业',
  TEMPLATE_UPDATE_ATTRS: '修改渠道 / 媒体类型',
  TEMPLATE_UPDATE_SLOTS: '修改入参配置',
  INDUSTRY_CREATE: '新建行业',
  INDUSTRY_UPDATE: '编辑行业',
  INDUSTRY_DELETE: '删除行业',
  INDUSTRY_SORT: '行业排序',
  INDUSTRY_TEMPLATE_ORDER: '行业内模板排序',
  CHANNEL_CREATE: '新建渠道',
  CHANNEL_UPDATE: '编辑渠道',
  CHANNEL_DELETE: '删除渠道',
  TEMPLATE_MEDIA_REPROCESS: '重新处理视频',
  TEMPLATE_MEDIA_READY: '视频处理完成',
  TEMPLATE_MEDIA_FAILED: '视频处理失败',
  SAMPLE_CREATE: '新建示例素材',
  SAMPLE_UPDATE: '编辑示例素材',
  SAMPLE_DELETE: '删除示例素材',
  HEADLINE_CREATE: '头条·新建推荐',
  HEADLINE_UPDATE: '头条·改推荐',
  HEADLINE_DELETE: '头条·取消推荐',
  HEADLINE_ADOPT: '头条·接管算法项',
  HEADLINE_SUPPRESS: '头条·屏蔽 / 取消',
  HEADLINE_UNSUPPRESS: '头条·解除屏蔽',
  PARAMS_UPDATE: '头条·改参数',
};
const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;
const actionOptions = Object.entries(ACTION_LABEL).map(([value, label]) => ({
  value,
  label: `${label}（${value}）`,
}));
/**
 * 输入框里的文字 → 后端匹配串：已含 * 原样（通配）；等于下拉里的某个码 = 精确；其余当前缀（补 *）。
 * 后端 action / resourceType 不含 * 时是精确匹配。
 */
const toPattern = (v: string | undefined, known: string[]): string | undefined => {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  if (t.includes('*') || known.includes(t)) return t;
  return `${t}*`;
};
const filterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
const colorOf = (a: string) =>
  /DELETE|PURGE|SUPPRESS$/.test(a) && !/UNSUPPRESS/.test(a)
    ? 'red'
    : /PUBLISH|CREATE|RESTORE|UNSUPPRESS/.test(a)
      ? 'green'
      : /OFFLINE/.test(a)
        ? 'orange'
        : 'blue';

const titleOf = (e: AuditEntry): string => {
  const snap = e.after ?? e.before;
  const t = snap?.title ?? snap?.name;
  return typeof t === 'string' ? t : '';
};

const q = reactive({
  resourceType: undefined as string | undefined,
  resourceId: '',
  action: undefined as string | undefined,
  operatorName: '',
  batchId: '',
  operatorId: undefined as number | undefined,
  range: undefined as [string, string] | undefined,
});
const page = ref(1);
const size = ref(20);
const total = ref(0);
const items = ref<AuditEntry[]>([]);
const loading = ref(false);
const failed = ref('');

const columns = [
  { title: '时间', dataIndex: 'createTime', width: 170 },
  { title: '操作人', dataIndex: 'operator', width: 150 },
  { title: '动作', dataIndex: 'action', width: 210 },
  { title: '对象', dataIndex: 'object' },
  { title: '结果', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'operation', width: 100, fixed: 'right' as const },
];

function params(): AuditQuery {
  return {
    resourceType: toPattern(q.resourceType, [...AUDIT_RESOURCE_TYPES]),
    resourceId: q.resourceId.trim() || undefined,
    action: toPattern(q.action, Object.keys(ACTION_LABEL)),
    operatorName: q.operatorName.trim() || undefined,
    batchId: q.batchId.trim() || undefined,
    operatorId: q.operatorId || undefined,
    from: q.range?.[0] || undefined,
    to: q.range?.[1] || undefined,
    page: page.value,
    size: size.value,
  };
}

let seq = 0;
async function load() {
  if (!allowed.value) return;
  const s = ++seq;
  loading.value = true;
  failed.value = '';
  try {
    const r = await getAudit(params());
    if (s !== seq) return;
    items.value = r?.items ?? [];
    total.value = r?.total ?? 0;
  } catch (e) {
    if (s !== seq) return;
    failed.value = e instanceof Error && e.message !== 'network' ? e.message : '审计加载失败';
  } finally {
    if (s === seq) loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}
function reset() {
  Object.assign(q, {
    resourceType: undefined,
    resourceId: '',
    action: undefined,
    operatorName: '',
    batchId: '',
    operatorId: undefined,
    range: undefined,
  });
  search();
}
function onTableChange(p: { current?: number; pageSize?: number }) {
  size.value = p.pageSize ?? 20;
  page.value = p.current ?? 1;
  load();
}

const detailOpen = ref(false);
const detail = ref<AuditEntry | null>(null);
const changes = computed<HistoryChange[]>(() =>
  detail.value?.diff
    ? Object.entries(detail.value.diff).map(([field, c]) => ({ field, from: c.from, to: c.to }))
    : [],
);
function openDetail(e: AuditEntry) {
  detail.value = e;
  detailOpen.value = true;
}

load();
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
.dt {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dt th,
.dt td {
  padding: 6px 8px;
  vertical-align: top;
  text-align: left;
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  word-break: break-all;
}
.dt th {
  background: var(--ant-color-fill-quaternary, #fafafa);
  font-weight: 500;
}
.dt .del {
  background: #fff1f0;
}
.dt .add {
  background: #f6ffed;
}
.pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
}
</style>
