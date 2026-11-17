<template>
  <a-drawer
    :open="open"
    :width="960"
    :title="run ? `评测 #${run.id} · ${run.modelLabel || run.modelRef}` : '评测详情'"
    destroy-on-hidden
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <a-spin :spinning="loading && !run">
      <template v-if="run">
        <div class="summary">
          <a-card size="small" class="sum-card">
            <a-statistic title="状态" :value="statusInfo(run.status).label" />
          </a-card>
          <a-card size="small" class="sum-card">
            <a-statistic title="通过率" :value="passRate(run)" />
            <div class="muted">
              通过 {{ run.passed }} / 失败 {{ run.failed }} / 出错 {{ run.errored }}
            </div>
          </a-card>
          <a-card size="small" class="sum-card">
            <a-statistic title="Pass^5" :value="`${run.pass5Passed}/${run.pass5Total}`" />
          </a-card>
          <a-card size="small" class="sum-card">
            <a-statistic
              title="模型调用"
              :value="run.maxCalls ? `${run.llmCalls}/${run.maxCalls}` : run.llmCalls"
            />
            <div class="muted">
              token 入 {{ run.tokensIn.toLocaleString() }} / 出 {{ run.tokensOut.toLocaleString() }}
            </div>
          </a-card>
        </div>
        <div class="meta muted">
          {{ MODE_LABEL[run.mode] }} · 开始 {{ fmtTime(run.startedAt) }} · 结束
          {{ fmtTime(run.finishedAt) }}
          <span v-if="run.createdBy"> · 发起人 {{ run.createdBy }}</span>
        </div>
        <a-alert v-if="run.errorMsg" type="error" show-icon :message="run.errorMsg" class="gap" />
        <a-alert
          v-else-if="run.status === 'stopped_by_cap'"
          type="warning"
          show-icon
          message="模型调用达到上限，评测已自动停止，结果为部分用例"
          class="gap"
        />

        <div class="filter">
          <a-segmented v-model:value="filter" :options="filterOptions" />
        </div>

        <a-table
          :columns="columns"
          :data-source="shown"
          :loading="loading"
          :pagination="{ pageSize: 20, hideOnSinglePage: true }"
          row-key="id"
          size="small"
          :expanded-row-keys="expandedKeys"
          :row-expandable="expandable"
          @expand="onExpand"
        >
          <template #emptyText>
            <a-empty
              :description="run && isActive(run.status) ? '用例执行中…' : '没有符合条件的用例'"
            />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'caseId'">
              <code>{{ record.caseId }}</code>
              <a-tag v-if="p5Of(record.caseId)" class="p5" color="blue">
                Pass^5 {{ p5Of(record.caseId) }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'sessionNo'">
              {{ record.sessionNo || '—' }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :color="CASE_STATUS[record.status as EvalCaseStatus]?.color">
                {{ CASE_STATUS[record.status as EvalCaseStatus]?.label ?? record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'failedAssertion'">
              <span class="bad">{{ record.failedAssertion }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'durationMs'">
              {{ (record.durationMs / 1000).toFixed(1) }}s
            </template>
          </template>
          <template #expandedRowRender="{ record }">
            <div class="detail">
              <div v-if="record.failedAssertion" class="blk">
                <div class="h">失败断言</div>
                <div class="bad">{{ record.failedAssertion }}</div>
              </div>
              <div v-if="record.gatesFailed.length" class="blk">
                <div class="h">未通过的硬门禁</div>
                <a-tag v-for="g in record.gatesFailed" :key="g" color="error">{{ g }}</a-tag>
              </div>
              <div class="blk">
                <a-collapse ghost size="small">
                  <a-collapse-panel key="trace" header="工具调用轨迹">
                    <pre v-if="prettyTrace(record.toolTrace)" class="pre">{{
                      prettyTrace(record.toolTrace)
                    }}</pre>
                    <span v-else class="muted">没有调用工具</span>
                  </a-collapse-panel>
                </a-collapse>
              </div>
              <div class="blk">
                <div class="h">回复原文</div>
                <pre class="pre">{{ record.replyText || '（空）' }}</pre>
              </div>
            </div>
          </template>
        </a-table>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 评测详情抽屉：汇总卡 + 用例表（按状态筛选）；非通过行可展开看失败断言 / 门禁 / 工具轨迹 / 回复。
 * 评测进行中每 5 秒刷新；用例一次取全量在前端筛选，Pass^5 的 k/n 才不会被筛选打乱。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  getEvalRun,
  listEvalCases,
  type EvalCase,
  type EvalCaseStatus,
  type EvalRun,
} from '@/api/agent-eval';

import {
  CASE_STATUS,
  MODE_LABEL,
  fmtTime,
  isActive,
  passRate,
  prettyTrace,
  statusInfo,
} from './eval-meta';

const props = defineProps<{ open: boolean; runId: string }>();
const emit = defineEmits<{ 'update:open': [v: boolean] }>();

const run = ref<EvalRun | null>(null);
const cases = ref<EvalCase[]>([]);
const loading = ref(false);
const filter = ref<'all' | EvalCaseStatus>('all');
const expandedKeys = ref<string[]>([]);

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '通过', value: 'pass' },
  { label: '失败', value: 'fail' },
  { label: '出错', value: 'error' },
  { label: '需人工复核', value: 'manual_review' },
];

const columns = [
  { title: '用例', dataIndex: 'caseId' },
  { title: '场次', dataIndex: 'sessionNo', width: 70 },
  { title: '结果', dataIndex: 'status', width: 110 },
  { title: '失败断言', dataIndex: 'failedAssertion', ellipsis: true },
  { title: '耗时', dataIndex: 'durationMs', width: 80 },
];

const shown = computed(() =>
  filter.value === 'all' ? cases.value : cases.value.filter((c) => c.status === filter.value),
);

/** 同一用例有多场（Pass^5）时给出「通过场次/总场次」，如 5/5 */
const p5Map = computed(() => {
  const m = new Map<string, { pass: number; n: number }>();
  for (const c of cases.value) {
    const e = m.get(c.caseId) ?? { pass: 0, n: 0 };
    e.n++;
    if (c.status === 'pass') e.pass++;
    m.set(c.caseId, e);
  }
  return m;
});
const p5Of = (caseId: string): string => {
  const e = p5Map.value.get(caseId);
  return e && e.n > 1 ? `${e.pass}/${e.n}` : '';
};

const expandable = (r: EvalCase) =>
  r.status !== 'pass' || !!r.failedAssertion || !!r.replyText || r.toolTrace != null;
function onExpand(expanded: boolean, r: EvalCase) {
  expandedKeys.value = expanded
    ? [...expandedKeys.value, r.id]
    : expandedKeys.value.filter((k) => k !== r.id);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
async function load(silent = false) {
  const id = props.runId;
  if (!id) return;
  const s = ++seq;
  if (!silent) loading.value = true;
  try {
    const [r, cs] = await Promise.all([getEvalRun(id), listEvalCases(id)]);
    if (s !== seq || !props.open) return;
    run.value = r;
    cases.value = cs;
    if (isActive(r.status)) timer = setTimeout(() => load(true), 5000);
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
}
function stop() {
  seq++;
  if (timer) clearTimeout(timer);
  timer = undefined;
}

watch(
  () => [props.open, props.runId] as const,
  ([o]) => {
    stop();
    if (o) {
      run.value = null;
      cases.value = [];
      filter.value = 'all';
      expandedKeys.value = [];
      load();
    }
  },
  { immediate: true },
);
onBeforeUnmount(stop);
</script>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.meta {
  margin: 10px 0;
}
.gap {
  margin-bottom: 12px;
}
.filter {
  margin: 12px 0;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.p5 {
  margin-left: 8px;
}
.detail {
  padding: 4px 8px;
}
.blk {
  margin-bottom: 10px;
}
.h {
  font-weight: 500;
  margin-bottom: 4px;
}
.pre {
  margin: 0;
  padding: 8px 10px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  background: var(--ant-color-fill-quaternary, #fafafa);
  border-radius: 4px;
}
</style>
