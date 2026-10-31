<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">批次详情 #{{ id }}</h2>
      <a-space>
        <a-button @click="router.push('/studio/batches')">返回列表</a-button>
        <a-button :loading="loading" @click="load">刷新</a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-card variant="borderless" title="基本信息" class="block">
          <a-descriptions :column="3" size="small" bordered>
            <a-descriptions-item label="批次 ID">{{ batch.id }}</a-descriptions-item>
            <a-descriptions-item label="用户">{{ batch.user_id }}</a-descriptions-item>
            <a-descriptions-item label="工作区">{{ batch.workspace_id }}</a-descriptions-item>
            <a-descriptions-item label="类型">{{
              KIND_LABEL[batch.kind] || batch.kind
            }}</a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="statusTag(BATCH_STATUS, batch.status).color">{{
                statusTag(BATCH_STATUS, batch.status).text
              }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="模型组">{{ batch.model_group || '-' }}</a-descriptions-item>
            <a-descriptions-item label="任务 完成 / 失败 / 总数">
              {{ batch.task_done }} / {{ batch.task_failed }} / {{ batch.task_total }}
            </a-descriptions-item>
            <a-descriptions-item label="预估点数">{{ batch.estimated_points }}</a-descriptions-item>
            <a-descriptions-item label="成本（元）">{{
              batch.cost_cny || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="request_id" :span="2">{{
              batch.request_id || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="封面">
              <img v-if="batch.cover_url" :src="batch.cover_url" alt="" class="thumb" />
              <span v-else>-</span>
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">{{
              formatTime(batch.created_at)
            }}</a-descriptions-item>
            <a-descriptions-item label="更新时间">{{
              formatTime(batch.updated_at)
            }}</a-descriptions-item>
            <a-descriptions-item label="失败原因">{{
              batch.error_reason || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="payload" :span="3">
              <pre class="json">{{ pretty(batch.payload) }}</pre>
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card variant="borderless" title="步骤时间线 step_log" class="block">
          <a-empty v-if="!steps.length" description="无记录" />
          <a-timeline v-else>
            <a-timeline-item
              v-for="(s, i) in steps"
              :key="i"
              :color="s.degraded || s.detail ? 'orange' : 'blue'"
            >
              <div>
                <b>{{ s.step }}</b>
                <span class="muted"> {{ formatTime(s.at) }}</span>
              </div>
              <div class="step-meta">
                耗时 {{ s.ms }} ms
                <template v-if="s.images != null"> · 图 {{ s.images }}</template>
                <template v-if="s.crops != null"> · 切图 {{ s.crops }}</template>
                <template v-if="s.task_total != null"> · 子任务 {{ s.task_total }}</template>
                <template v-if="s.cost_cny != null"> · 成本 ¥{{ s.cost_cny }}</template>
                <a-tag v-if="s.degraded" color="orange" style="margin-left: 6px">降级</a-tag>
              </div>
              <div v-if="s.detail" class="bad">{{ s.detail }}</div>
            </a-timeline-item>
          </a-timeline>
        </a-card>

        <a-card variant="borderless" title="切图方案 crop_plan" class="block">
          <a-empty v-if="!cropRows.length" description="无切图（仅商拍有）" />
          <a-table
            v-else
            :columns="cropColumns"
            :data-source="cropRows"
            :pagination="false"
            row-key="key"
            size="small"
          />
        </a-card>

        <a-card variant="borderless" title="切图质检 crop_check" class="block">
          <a-empty v-if="!checkRows.length" description="无质检结果" />
          <a-table
            v-else
            :columns="checkColumns"
            :data-source="checkRows"
            :pagination="false"
            row-key="key"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'ok'">
                <a-tag :color="record.ok ? 'success' : 'error'">{{
                  record.ok ? '通过' : '不通过'
                }}</a-tag>
              </template>
            </template>
          </a-table>
        </a-card>

        <a-card variant="borderless" title="组图 selected_images（送生图的图序）" class="block">
          <a-empty v-if="!selected.length" description="无" />
          <div v-for="m in selected" :key="m.model_index" class="sel-group">
            <div class="sel-title">模特 #{{ m.model_index }}</div>
            <ol class="sel-list">
              <li v-for="(img, i) in m.images || []" :key="i">
                <a-image v-if="img.url" :src="img.url" :width="40" :height="40" class="thumb" />
                <a-tag v-if="img.id">{{ img.id }}</a-tag>
                <a-tag v-if="img.role" color="blue">{{ img.role }}</a-tag>
                <span class="muted ellipsis">{{ img.url }}</span>
              </li>
            </ol>
          </div>
        </a-card>

        <a-card variant="borderless" :title="`子任务（${detail.tasks.length}）`" class="block">
          <a-table
            :columns="taskColumns"
            :data-source="detail.tasks"
            :pagination="false"
            row-key="id"
            size="small"
            :scroll="{ x: 1500 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'index'">
                {{ record.model_index }} / {{ record.shot_index }} / {{ record.pose_index }}
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="statusTag(TASK_STATUS, record.status).color">{{
                  statusTag(TASK_STATUS, record.status).text
                }}</a-tag>
                <a-tag v-if="record.admin_locked" color="red">已封禁</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'result_url'">
                <a-image
                  v-if="record.result_url"
                  :src="record.result_url"
                  :width="56"
                  :height="56"
                  class="thumb"
                />
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'billing_status'">
                <a-tag :color="statusTag(BILLING_STATUS, record.billing_status).color">{{
                  statusTag(BILLING_STATUS, record.billing_status).text
                }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'gateway_call_id'">
                <span class="mono">{{ record.gateway_call_id || '-' }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openPrompt(record)">prompt</a-button>
                  <a-button
                    v-if="canUpdate"
                    type="link"
                    size="small"
                    :disabled="!canRetry(record)"
                    @click="confirmRetry(record)"
                    >重做</a-button
                  >
                  <a-button
                    v-if="canUpdate && isUnfinished(record)"
                    type="link"
                    size="small"
                    danger
                    :disabled="!canForceFail(record)"
                    @click="confirmForceFail(record)"
                    >强制失败</a-button
                  >
                  <a-button
                    v-if="canUpdate && canBanRetry(record)"
                    type="link"
                    size="small"
                    danger
                    @click="confirmBanRetry(record)"
                    >封禁重做</a-button
                  >
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </template>
    </a-spin>

    <a-drawer v-model:open="promptOpen" title="完整 prompt" width="640">
      <template v-if="promptTask">
        <div class="muted">任务 {{ promptTask.task_id }}</div>
        <a-space style="margin: 8px 0">
          <a-button size="small" @click="copy(promptTask.prompt_text)">复制 prompt</a-button>
        </a-space>
        <pre class="json">{{ promptTask.prompt_text || '（空）' }}</pre>
        <h4>prompt_meta</h4>
        <pre class="json">{{ pretty(promptTask.prompt_meta) }}</pre>
        <h4>input_images</h4>
        <pre class="json">{{ pretty(promptTask.input_images) }}</pre>
        <h4>网关 / 其它</h4>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="gateway_status">{{
            promptTask.gateway_status || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="attempt">{{ promptTask.attempt }}</a-descriptions-item>
          <a-descriptions-item label="billing_request_id">{{
            promptTask.billing_request_id || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="耗时(ms)">{{ promptTask.duration_ms }}</a-descriptions-item>
          <a-descriptions-item label="结果尺寸"
            >{{ promptTask.result_width }} x {{ promptTask.result_height }}</a-descriptions-item
          >
        </a-descriptions>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  forceFailTask,
  getBatch,
  retryTask,
  type BatchDetail,
  type StepLog,
  type Task,
} from '@/api/studio-admin';
import { formatTime } from '@/utils/format';
import {
  BATCH_STATUS,
  BILLING_STATUS,
  KIND_LABEL,
  TASK_STATUS,
  parseJson,
  statusTag,
} from '@/utils/studio';
import { STUDIO_UPDATE, hasStudioPermission } from '@/utils/studio-permission';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const detail = ref<BatchDetail | null>(null);
const loading = ref(false);
const canUpdate = computed(() => hasStudioPermission(STUDIO_UPDATE));
const batch = computed(() => detail.value!.batch);

const steps = computed(() => {
  const v = parseJson<StepLog[]>(detail.value?.step_log, []);
  return Array.isArray(v) ? v : [];
});

/** crop_plan 形如 [{index, angle, garment_box, crops:[{label, box, confidence}]}]，也兼容 {plans:[…]} */
interface CropPlan {
  index?: number;
  angle?: string;
  crops?: { label?: string; box?: number[]; confidence?: number }[];
}
interface CheckResult {
  index?: number;
  ok?: boolean;
  confidence?: number;
}
interface CropRow {
  key: string;
  image: string;
  label: string;
  box: string;
  confidence: string;
}
const cropRows = computed<CropRow[]>(() => {
  const raw = parseJson<unknown>(detail.value?.crop_plan, []);
  const plans = (
    Array.isArray(raw) ? raw : ((raw as { plans?: unknown[] }).plans ?? [])
  ) as CropPlan[];
  const out: CropRow[] = [];
  plans.forEach((p, pi) => {
    const image = `#${p.index ?? pi}${p.angle ? ` (${p.angle})` : ''}`;
    const crops = p.crops ?? [];
    crops.forEach((c, ci) => {
      out.push({
        key: `${pi}-${ci}`,
        image,
        label: c.label ?? '-',
        box: Array.isArray(c.box) ? `[${c.box.map((n: number) => +n.toFixed(3)).join(', ')}]` : '-',
        confidence: c.confidence != null ? Number(c.confidence).toFixed(2) : '-',
      });
    });
  });
  return out;
});
const cropColumns = [
  { title: '图', dataIndex: 'image', width: 140 },
  { title: 'label', dataIndex: 'label' },
  { title: 'box [x, y, w, h]（0–1）', dataIndex: 'box', width: 240 },
  { title: 'confidence', dataIndex: 'confidence', width: 110 },
];

interface CheckRow {
  key: string;
  index: number | string;
  ok: boolean;
  confidence: string;
}
const checkRows = computed<CheckRow[]>(() => {
  const raw = parseJson<unknown>(detail.value?.crop_check, []);
  const list = (
    Array.isArray(raw) ? raw : ((raw as { results?: unknown[] }).results ?? [])
  ) as CheckResult[];
  return list.map((r, i) => ({
    key: String(i),
    index: r.index ?? i,
    ok: !!r.ok,
    confidence: r.confidence != null ? Number(r.confidence).toFixed(2) : '-',
  }));
});
const checkColumns = [
  { title: '序号', dataIndex: 'index', width: 100 },
  { title: '结果', dataIndex: 'ok', width: 120 },
  { title: 'confidence', dataIndex: 'confidence' },
];

interface SelGroup {
  model_index: number;
  images?: { id?: string; url?: string; role?: string }[];
}
const selected = computed(() => {
  const v = parseJson<SelGroup[]>(detail.value?.selected_images, []);
  return Array.isArray(v) ? v : [];
});

const taskColumns = [
  { title: '任务号', dataIndex: 'task_id', width: 200, ellipsis: true },
  { title: 'model / shot / pose', dataIndex: 'index', width: 130 },
  { title: 'model_group', dataIndex: 'model_group', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 130 },
  { title: 'gateway_call_id', dataIndex: 'gateway_call_id', width: 200, ellipsis: true },
  { title: '结果', dataIndex: 'result_url', width: 90 },
  { title: '成本（元）', dataIndex: 'cost_cny', width: 100 },
  { title: '计费', dataIndex: 'billing_status', width: 100 },
  { title: '失败原因', dataIndex: 'error_reason', width: 200, ellipsis: true },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];

function pretty(text?: string) {
  const v = parseJson<unknown>(text, null);
  return v == null ? text || '-' : JSON.stringify(v, null, 2);
}

// 重做仅对失败 / 已取消的任务有意义；已封禁的不允许
function canRetry(t: Task) {
  return (t.status === 3 || t.status === 4) && !t.admin_locked;
}
// 未终结（0 排队 / 1 生成中）：强制失败，置失败并退回冻结点数、封禁重做
function isUnfinished(t: Task) {
  return t.status === 0 || t.status === 1;
}
function canForceFail(t: Task) {
  return isUnfinished(t) && !t.admin_locked;
}
// 已终结（3 失败 / 4 已取消）且未封禁：仅封禁重做，不动账
function canBanRetry(t: Task) {
  return (t.status === 3 || t.status === 4) && !t.admin_locked;
}

function confirmRetry(t: Task) {
  Modal.confirm({
    title: '重做子任务',
    content: `确认重做任务 ${t.task_id}？将重新提交生图。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      await retryTask(t.task_id);
      message.success('已提交重做');
      load();
    },
  });
}

function confirmForceFail(t: Task) {
  Modal.confirm({
    title: '强制失败',
    content: `确认强制失败任务 ${t.task_id}？将置为失败并退回本次冻结的点数，并禁止重做。`,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await forceFailTask(t.task_id);
      message.success('已强制失败，点数已退回');
      load();
    },
  });
}

function confirmBanRetry(t: Task) {
  Modal.confirm({
    title: '封禁重做',
    content: `确认封禁任务 ${t.task_id} 的重做？不改变计费，只禁止之后重做。`,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await forceFailTask(t.task_id);
      message.success('已封禁重做，未改动点数');
      load();
    },
  });
}

const promptOpen = ref(false);
const promptTask = ref<Task | null>(null);
function openPrompt(t: Task) {
  promptTask.value = t;
  promptOpen.value = true;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text || '');
    message.success('已复制');
  } catch {
    message.error('复制失败，请手动选择文本');
  }
}

async function load() {
  loading.value = true;
  try {
    detail.value = await getBatch(id.value);
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

load();
</script>

<style scoped>
.page-container {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.ph-title {
  margin: 0;
  font-size: 18px;
}
.block {
  margin-bottom: 16px;
}
.thumb {
  object-fit: cover;
  border-radius: 4px;
  max-width: 56px;
  max-height: 56px;
}
.json {
  margin: 0;
  padding: 8px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.04));
  border-radius: 4px;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
}
.step-meta {
  font-size: 12px;
  color: var(--ant-color-text-secondary, #666);
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.sel-title {
  font-weight: 600;
  margin: 4px 0;
}
.sel-list {
  margin: 0 0 8px;
  padding-left: 22px;
}
.sel-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.ellipsis {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
