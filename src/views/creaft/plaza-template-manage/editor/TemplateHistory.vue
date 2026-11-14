<template>
  <div class="th">
    <a-alert
      v-if="!allowed"
      type="warning"
      show-icon
      message="没有查看变更历史的权限（需要 plaza:audit）"
    />
    <template v-else>
      <a-spin :spinning="loading && !entries.length">
        <a-empty v-if="!loading && !entries.length && !failed" description="还没有变更记录" />
        <a-alert v-if="failed" type="error" show-icon :message="failed" />
        <a-timeline v-if="entries.length">
          <a-timeline-item v-for="e in entries" :key="e.id" :color="colorOf(e.action)">
            <div class="th-head">
              <b>{{ actionLabel(e.action) }}</b>
              <span class="th-meta">
                {{ e.operatorName || (e.operatorId ? `管理员 #${e.operatorId}` : '系统') }} ·
                {{ e.createTime.replace('T', ' ') }}
              </span>
              <a-button size="small" type="link" @click="toggle(e.id)">
                {{
                  open[e.id]
                    ? '收起'
                    : changesOf(e).length
                      ? `展开 ${changesOf(e).length} 处变更`
                      : '展开'
                }}
              </a-button>
            </div>
            <div v-if="summary(e)" class="th-summary">{{ summary(e) }}</div>
            <div v-if="open[e.id]" class="th-body">
              <div v-if="!changesOf(e).length" class="th-meta">
                {{ e.diff ? '没有字段变化' : '创建 / 删除类操作没有逐字段对比' }}
              </div>
              <table v-else class="th-table">
                <thead>
                  <tr>
                    <th style="width: 110px">字段</th>
                    <th>改前</th>
                    <th>改后</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in changesOf(e)" :key="c.field">
                    <td>{{ fieldLabel(c.field) }}</td>
                    <td>
                      <HistoryValue :entry="e" :change="c" side="before" />
                    </td>
                    <td>
                      <HistoryValue :entry="e" :change="c" side="after" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </a-timeline-item>
        </a-timeline>
        <div v-if="entries.length < total" class="th-more">
          <a-button :loading="loading" @click="loadMore"
            >加载更多（{{ entries.length }} / {{ total }}）</a-button
          >
        </div>
      </a-spin>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { getTemplateAudit, type AuditEntry } from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

import HistoryValue, { type HistoryChange } from './HistoryValue.vue';

const props = defineProps<{ templateId: number | null; active: boolean; reloadKey?: number }>();

const { can } = usePermission();
const allowed = computed(() => can('plaza:audit'));

const entries = ref<AuditEntry[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(false);
const failed = ref('');
const open = reactive<Record<number, boolean>>({});
const SIZE = 20;

const ACTIONS: Record<string, string> = {
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
};
const actionLabel = (a: string) => ACTIONS[a] ?? a;
const colorOf = (a: string) =>
  /DELETE|PURGE/.test(a)
    ? 'red'
    : /PUBLISH|CREATE|RESTORE/.test(a)
      ? 'green'
      : /OFFLINE/.test(a)
        ? 'orange'
        : 'blue';

const FIELDS: Record<string, string> = {
  title: '标题',
  description: '说明',
  category: '分类',
  tags: '标签',
  payload: '内容（效果图 / 参考图 / 引导语 / 提示词）',
  agentSkillId: '绑定技能',
  mediaType: '媒体类型',
  videoUrl: '预览视频',
  posterUrl: '视频封面',
  state: '状态',
  onlineAt: '上线时间',
  offlineAt: '下线时间',
  channels: '投放渠道',
  slots: '入参配置',
  needsProductImage: '需要产品图',
  textOverlay: '文字叠加',
  sortOrder: '全局排序',
  enabled: '对用户可见',
  deleted: '已删除',
  mediaStatus: '视频处理状态',
  industryIds: '行业',
};
const fieldLabel = (f: string) => FIELDS[f] ?? f;

function changesOf(e: AuditEntry): HistoryChange[] {
  if (!e.diff) return [];
  return Object.entries(e.diff).map(([field, c]) => ({ field, from: c.from, to: c.to }));
}

/** 折叠态一行摘要：改了哪些字段 */
function summary(e: AuditEntry): string {
  const ch = changesOf(e);
  if (ch.length)
    return `改动：${ch.map((c) => fieldLabel(c.field).replace(/（.*）/, '')).join('、')}`;
  const t = e.after?.title;
  return typeof t === 'string' ? `标题：${t}` : '';
}

const toggle = (id: number) => (open[id] = !open[id]);

async function fetchPage(p: number) {
  if (props.templateId == null) return;
  loading.value = true;
  failed.value = '';
  try {
    const r = await getTemplateAudit(props.templateId, { page: p, size: SIZE });
    entries.value = p === 1 ? r.items : [...entries.value, ...r.items];
    total.value = r.total;
    page.value = p;
  } catch (e) {
    failed.value = e instanceof Error && e.message !== 'network' ? e.message : '变更历史加载失败';
  } finally {
    loading.value = false;
  }
}
const loadMore = () => fetchPage(page.value + 1);

/** 切到「变更历史」页签 / 保存后刷新时重新取第一页 */
watch(
  () => [props.active, props.templateId, props.reloadKey] as const,
  ([active]) => {
    if (!active || props.templateId == null || !allowed.value) return;
    entries.value = [];
    for (const k of Object.keys(open)) delete open[Number(k)];
    fetchPage(1);
  },
  { immediate: true },
);
</script>

<style scoped>
.th-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.th-meta {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.th-summary {
  color: var(--ant-color-text-secondary, #666);
  font-size: 13px;
}
.th-body {
  margin-top: 8px;
}
.th-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.th-table th,
.th-table td {
  padding: 6px 8px;
  vertical-align: top;
  text-align: left;
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  word-break: break-all;
}
.th-table th {
  background: var(--ant-color-fill-quaternary, #fafafa);
  font-weight: 500;
}
.th-more {
  margin-top: 8px;
  text-align: center;
}
</style>
