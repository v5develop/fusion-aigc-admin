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
            <a-descriptions-item label="用户">{{ batch.userId }}</a-descriptions-item>
            <a-descriptions-item label="工作区">{{ batch.workspaceId }}</a-descriptions-item>
            <a-descriptions-item label="类型">{{
              KIND_LABEL[batch.kind] || batch.kind
            }}</a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="statusTag(BATCH_STATUS, batch.status).color">{{
                statusTag(BATCH_STATUS, batch.status).text
              }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="模型组">{{ batch.modelGroup || '-' }}</a-descriptions-item>
            <a-descriptions-item label="任务 完成 / 失败 / 总数">
              {{ batch.taskDone }} / {{ batch.taskFailed }} / {{ batch.taskTotal }}
            </a-descriptions-item>
            <a-descriptions-item label="预估点数">{{ batch.estimatedPoints }}</a-descriptions-item>
            <a-descriptions-item label="成本（元）">{{ batch.costCny || '-' }}</a-descriptions-item>
            <a-descriptions-item label="request_id" :span="2">{{
              batch.requestId || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="封面">
              <img v-if="batch.coverUrl" :src="batch.coverUrl" alt="" class="thumb" />
              <span v-else>-</span>
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">{{
              formatTime(batch.createdAt)
            }}</a-descriptions-item>
            <a-descriptions-item label="更新时间">{{
              formatTime(batch.updatedAt)
            }}</a-descriptions-item>
            <a-descriptions-item label="失败原因">{{
              batch.errorReason || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="payload" :span="3">
              <pre class="json">{{ pretty(batch.payload) }}</pre>
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card variant="borderless" title="批次步骤" class="block">
          <template #extra>
            <span class="muted">批次级各阶段的耗时与结果；单张子任务的完整链路见下方「子任务链路」</span>
          </template>
          <a-empty v-if="!stepRows.length" description="无记录" />
          <a-table
            v-else
            :columns="stepColumns"
            :data-source="stepRows"
            :pagination="false"
            row-key="key"
            size="small"
            :expand-row-by-click="true"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'at'">
                <span class="mono">{{ formatClock(record.at) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'label'">
                <b>{{ record.label }}</b>
                <code v-if="record.label !== record.step" class="step-code">{{ record.step }}</code>
              </template>
              <template v-else-if="column.dataIndex === 'ms'">{{ formatMs(record.ms) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.tagColor">{{ record.tagText }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'message'">
                <span :class="record.tagColor === 'error' ? 'bad' : ''">{{ record.message }}</span>
              </template>
            </template>
            <template #expandedRowRender="{ record }">
              <pre class="json">{{ JSON.stringify(record.raw, null, 2) }}</pre>
            </template>
          </a-table>
        </a-card>

        <template v-if="hasDiag">
          <a-card variant="borderless" title="任务链路 trace" class="block">
            <a-alert
              v-if="diag.trace.stuckAt"
              type="warning"
              show-icon
              :message="`卡在「${diag.trace.stuckAt.stage}」：${diag.trace.stuckAt.reason}`"
              style="margin-bottom: 12px"
            />
            <a-descriptions :column="2" size="small" bordered style="margin-bottom: 12px">
              <a-descriptions-item label="traceId">
                <span class="mono">{{ diag.trace.traceId || '-' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="生成时间">{{
                fmtIso(diag.trace.generatedAt)
              }}</a-descriptions-item>
            </a-descriptions>
            <a-empty v-if="!diag.trace.stages.length" description="无链路" />
            <a-table
              v-else
              :columns="traceColumns"
              :data-source="diag.trace.stages"
              :pagination="false"
              row-key="key"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'key'">
                  <code>{{ record.key }}</code>
                </template>
                <template v-else-if="column.dataIndex === 'status'">
                  <a-tag :color="STAGE_COLOR[record.status] || 'default'">{{
                    STAGE_LABEL[record.status] || record.status
                  }}</a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'duration'">
                  {{ record.durationMs != null ? `${record.durationMs} ms` : '-' }}
                </template>
                <template v-else-if="column.dataIndex === 'detail'">
                  <span :class="record.status === 'failed' ? 'bad' : ''">{{
                    record.detail || '-'
                  }}</span>
                  <code v-if="record.check" class="bad"> {{ record.check }}</code>
                </template>
              </template>
            </a-table>
          </a-card>

          <a-card variant="borderless" title="子任务链路" class="block">
            <template #extra>
              <span class="muted">每张图一条链路（排队 → 网关 → 厂商 → 转存 → 结算），点选子任务查看</span>
            </template>
            <a-empty v-if="!detail.tasks.length" description="无子任务" />
            <div v-else class="sub">
              <div class="sub-list">
                <div
                  v-for="t in detail.tasks"
                  :key="t.id"
                  class="sub-item"
                  :class="{ 'sub-item--on': selectedTask?.id === t.id }"
                  @click="selectTask(t)"
                >
                  <span class="sub-idx">#{{ t.modelIndex }}-{{ t.shotIndex }}-{{ t.poseIndex }}</span>
                  <a-tag :color="statusTag(TASK_STATUS, t.status).color" class="sub-tag">{{
                    statusTag(TASK_STATUS, t.status).text
                  }}</a-tag>
                </div>
              </div>
              <div class="sub-body">
                <template v-if="selectedTask">
                  <div class="sub-head">
                    <span class="mono">{{ selectedTask.taskId }}</span>
                    <span v-if="selectedMedia?.traceTaskId" class="muted">
                      链路号 <span class="mono">{{ selectedMedia.traceTaskId }}</span>
                    </span>
                  </div>
                  <a-spin :spinning="spansLoading">
                    <a-alert
                      v-if="spansError"
                      type="warning"
                      show-icon
                      :message="`链路加载失败：${spansError}`"
                      style="margin-bottom: 8px"
                    >
                      <template #action>
                        <a-button size="small" @click="loadSpans">重试</a-button>
                      </template>
                    </a-alert>
                    <a-empty
                      v-else-if="!spans && !spansLoading"
                      :description="
                        selectedMedia?.traceTaskId ? '暂无链路数据' : '该子任务没有链路号（后端未升级？）'
                      "
                    />
                    <TraceWaterfall v-if="spans" :data="spans" :show-hints="true" />
                  </a-spin>
                  <div v-if="selectedMedia" class="sub-media">
                    <div class="sec-title">送生图的图片（按顺序）</div>
                    <ImageGrid :images="selectedMedia.inputs" empty-text="无输入图（纯文生图）" />
                    <div v-if="selectedMedia.output" class="sec-title">成品</div>
                    <ImageGrid
                      v-if="selectedMedia.output"
                      :images="[selectedMedia.output]"
                      :numbered="false"
                    />
                    <div v-if="selectedMedia.mask || selectedMedia.maskParts.length" class="sec-title">
                      服装蒙版
                    </div>
                    <ImageGrid
                      v-if="selectedMedia.mask || selectedMedia.maskParts.length"
                      :images="maskImages(selectedMedia)"
                      :numbered="false"
                    />
                  </div>
                </template>
              </div>
            </div>
          </a-card>

          <a-card variant="borderless" title="诊断" class="block">
            <a-alert
              v-for="(h, i) in diag.diagnosis.hints"
              :key="i"
              type="info"
              show-icon
              :message="h.text"
              style="margin-bottom: 8px"
            />
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item label="批次状态">{{
                diag.diagnosis.task?.statusLabel || '-'
              }}</a-descriptions-item>
              <a-descriptions-item label="批次错误">{{
                diag.diagnosis.task?.errorMsg || '-'
              }}</a-descriptions-item>
              <a-descriptions-item label="失败步骤">
                <code v-if="diag.diagnosis.failingStep">{{
                  diag.diagnosis.failingStep.stepPath
                }}</code>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="失败原因">{{
                diag.diagnosis.failingStep?.failureMessage || '-'
              }}</a-descriptions-item>
              <a-descriptions-item label="网关调用">
                <span class="mono">{{ diag.diagnosis.failingStep?.gatewayCallId || '-' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="第几次">{{
                diag.diagnosis.failingStep?.attemptCount ?? '-'
              }}</a-descriptions-item>
              <a-descriptions-item label="计费状态">{{
                diag.diagnosis.billing.billingStatus
              }}</a-descriptions-item>
              <a-descriptions-item label="预留状态">{{
                diag.diagnosis.billing.reservationStatus
              }}</a-descriptions-item>
              <a-descriptions-item label="步骤统计" :span="2">
                共 {{ diag.diagnosis.steps.total }} 步
                <template v-for="(n, k) in diag.diagnosis.steps.byStatus" :key="k">
                  · {{ k }} {{ n }}
                </template>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </template>

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

        <a-card variant="borderless" title="送生图的图片（按顺序）" class="block">
          <template #extra>
            <span class="muted"
              >各模特组图后实际参与生成的图，角标 = 送生图的先后顺序；点图放大，打不开的可复制引用</span
            >
          </template>
          <a-empty v-if="!selectedGroups.length" description="无" />
          <div v-for="m in selectedGroups" :key="m.modelIndex" class="sel-group">
            <div class="sel-title">模特 #{{ m.modelIndex }}</div>
            <ImageGrid :images="m.images" />
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
                {{ record.modelIndex }} / {{ record.shotIndex }} / {{ record.poseIndex }}
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="statusTag(TASK_STATUS, record.status).color">{{
                  statusTag(TASK_STATUS, record.status).text
                }}</a-tag>
                <a-tag v-if="record.adminLocked" color="red">已封禁</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'resultUrl'">
                <a-image
                  v-if="record.resultUrl"
                  :src="record.resultUrl"
                  :width="56"
                  :height="56"
                  class="thumb"
                />
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'billingStatus'">
                <a-tag :color="statusTag(BILLING_STATUS, record.billingStatus).color">{{
                  statusTag(BILLING_STATUS, record.billingStatus).text
                }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'gatewayCallId'">
                <span class="mono">{{ record.gatewayCallId || '-' }}</span>
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
        <div class="muted">任务 {{ promptTask.taskId }}</div>
        <a-space style="margin: 8px 0">
          <a-button size="small" @click="copy(promptTask.promptText)">复制 prompt</a-button>
        </a-space>
        <pre class="json">{{ promptTask.promptText || '（空）' }}</pre>
        <h4>prompt_meta</h4>
        <pre class="json">{{ pretty(promptTask.promptMeta) }}</pre>
        <h4>送生图的图片（按顺序）</h4>
        <ImageGrid :images="mediaOf(promptTask)?.inputs ?? []" empty-text="无输入图" />
        <a-collapse ghost size="small">
          <a-collapse-panel key="raw" header="input_images 原始 JSON">
            <pre class="json">{{ pretty(promptTask.inputImages) }}</pre>
          </a-collapse-panel>
        </a-collapse>
        <h4>网关 / 其它</h4>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="gateway_status">{{
            promptTask.gatewayStatus || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="attempt">{{ promptTask.attempt }}</a-descriptions-item>
          <a-descriptions-item label="billing_request_id">{{
            promptTask.billingRequestId || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="耗时(ms)">{{ promptTask.durationMs }}</a-descriptions-item>
          <a-descriptions-item label="结果尺寸"
            >{{ promptTask.resultWidth }} x {{ promptTask.resultHeight }}</a-descriptions-item
          >
        </a-descriptions>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  forceFailTask,
  getBatch,
  retryTask,
  type BatchDetail,
  type StepLog,
  type StudioDiagnostics,
  type StudioImage,
  type StudioTaskMedia,
  type Task,
} from '@/api/studio-admin';
import { getTaskSpans, type TaskSpans } from '@/api/creation-task';
import ImageGrid from './ImageGrid.vue';
import TraceWaterfall from '@/components/TraceWaterfall/index.vue';
import { formatTime } from '@/utils/format';
import {
  BATCH_STATUS,
  BILLING_STATUS,
  KIND_LABEL,
  TASK_STATUS,
  formatClock,
  formatMs,
  parseJson,
  statusTag,
  stepLabel,
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
  const v = parseJson<StepLog[]>(detail.value?.stepLog, []);
  return Array.isArray(v) ? v : [];
});

const EMPTY_DIAG: StudioDiagnostics = {
  trace: { taskId: '', traceId: '', generatedAt: '', stuckAt: null, stages: [], terminal: false },
  workflowSteps: [],
  diagnosis: {
    task: null,
    failingStep: null,
    steps: { total: 0, byStatus: {} },
    billing: { billingStatus: '-', reservationStatus: '-', pricePoints: 0, settled: false },
    hints: [],
  },
  timeline: [],
};
const diag = computed<StudioDiagnostics>(() => {
  const v = parseJson<StudioDiagnostics | null>(detail.value?.diagnostics, null);
  if (!v || typeof v !== 'object') return EMPTY_DIAG;
  return {
    ...EMPTY_DIAG,
    ...v,
    trace: { ...EMPTY_DIAG.trace, ...v.trace, stages: v.trace?.stages ?? [] },
    diagnosis: { ...EMPTY_DIAG.diagnosis, ...v.diagnosis, hints: v.diagnosis?.hints ?? [] },
    workflowSteps: v.workflowSteps ?? [],
    timeline: v.timeline ?? [],
  };
});
const hasDiag = computed(() => !!detail.value?.diagnostics);
const STAGE_COLOR: Record<string, string> = {
  done: 'success',
  running: 'processing',
  failed: 'error',
  pending: 'default',
  skipped: 'default',
};
const STAGE_LABEL: Record<string, string> = {
  done: '完成',
  running: '进行中',
  failed: '失败',
  pending: '未开始',
  skipped: '跳过',
};
const traceColumns = [
  { title: '阶段', dataIndex: 'name', width: 140 },
  { title: 'key', dataIndex: 'key', width: 200 },
  { title: '来源', dataIndex: 'source', width: 90 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '耗时', dataIndex: 'duration', width: 110 },
  { title: '说明', dataIndex: 'detail' },
];
function fmtIso(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('zh-CN', { hour12: false });
}

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
  const raw = parseJson<unknown>(detail.value?.cropPlan, []);
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
  const raw = parseJson<unknown>(detail.value?.cropCheck, []);
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
  modelIndex: number;
  images?: { id?: string; url?: string; role?: string }[];
}
/** 优先用后端解析好的 media（url 已签名）；旧后端没有 media 时回退原始 JSON（只有 http 地址能预览） */
const selectedGroups = computed<{ modelIndex: number; images: StudioImage[] }[]>(() => {
  const m = diag.value.media?.selectedImages;
  if (m?.length) return m;
  const v = parseJson<SelGroup[]>(detail.value?.selectedImages, []);
  if (!Array.isArray(v)) return [];
  return v.map((g) => ({
    modelIndex: g.modelIndex ?? (g as { model_index?: number }).model_index ?? 0,
    images: (g.images ?? []).map((i) => ({
      ref: i.url ?? '',
      url: i.url && /^https?:\/\//.test(i.url) ? i.url : null,
      id: i.id,
      role: i.role,
    })),
  }));
});

function mediaOf(t: Task | null): StudioTaskMedia | undefined {
  if (!t) return undefined;
  return diag.value.media?.tasks.find((x) => x.taskId === t.taskId);
}
function maskImages(m: StudioTaskMedia): StudioImage[] {
  const out: StudioImage[] = [];
  if (m.mask) out.push({ ...m.mask, id: '整体蒙版' });
  for (const p of m.maskParts) out.push({ ...p.image, id: p.part });
  return out;
}

// ---- 批次步骤（step_log）：中文名 / 时间 / 耗时 / 状态 / 说明，原始 JSON 折叠
const stepColumns = [
  { title: '时间', dataIndex: 'at', width: 120 },
  { title: '步骤', dataIndex: 'label', width: 220 },
  { title: '耗时', dataIndex: 'ms', width: 100 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '说明', dataIndex: 'message' },
];
const stepRows = computed(() =>
  steps.value.map((s, i) => {
    const bits: string[] = [];
    if (s.images != null) bits.push(`图 ${s.images}`);
    if (s.crops != null) bits.push(`切图 ${s.crops}`);
    if (s.taskTotal != null) bits.push(`子任务 ${s.taskTotal}`);
    if (s.costCny != null) bits.push(`成本 ¥${s.costCny}`);
    const failed = !!s.detail && !s.degraded;
    return {
      key: `${i}-${s.step}`,
      step: s.step,
      label: stepLabel(s.step),
      at: s.at,
      ms: s.ms,
      tagText: s.degraded ? '降级' : failed ? '失败' : '正常',
      tagColor: s.degraded ? 'warning' : failed ? 'error' : 'success',
      message: [s.degraded ? '读图失败，已改用文字信息' : '', s.detail || '', bits.join(' · ')]
        .filter(Boolean)
        .join('；'),
      raw: s,
    };
  }),
);

// ---- 子任务链路：选中子任务 -> 拉 /spans -> TraceWaterfall
const selectedTask = ref<Task | null>(null);
const selectedMedia = computed(() => mediaOf(selectedTask.value));
const spans = ref<TaskSpans | null>(null);
const spansLoading = ref(false);
const spansError = ref('');
let spansSeq = 0;
function selectTask(t: Task) {
  selectedTask.value = t;
}
async function loadSpans() {
  const seq = ++spansSeq;
  spans.value = null;
  spansError.value = '';
  const tid = selectedMedia.value?.traceTaskId;
  if (!tid) return;
  spansLoading.value = true;
  try {
    const sp = await getTaskSpans(tid);
    if (seq === spansSeq) spans.value = sp && Array.isArray(sp.spans) ? sp : null;
  } catch (e) {
    if (seq === spansSeq) spansError.value = e instanceof Error ? e.message : '请求失败';
  } finally {
    if (seq === spansSeq) spansLoading.value = false;
  }
}
watch(
  () => [selectedTask.value?.id, selectedMedia.value?.traceTaskId],
  () => {
    loadSpans();
  },
);
// 详情加载 / 刷新后：默认选第一张失败的，否则第一张；已选的保持
watch(
  () => detail.value,
  (d) => {
    if (!d?.tasks.length) {
      selectedTask.value = null;
      return;
    }
    const keep = selectedTask.value && d.tasks.find((t) => t.id === selectedTask.value!.id);
    selectedTask.value = keep || d.tasks.find((t) => t.status === 3) || d.tasks[0];
  },
);

const taskColumns = [
  { title: '任务号', dataIndex: 'taskId', width: 200, ellipsis: true },
  { title: 'model / shot / pose', dataIndex: 'index', width: 130 },
  { title: 'model_group', dataIndex: 'modelGroup', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 130 },
  { title: 'gateway_call_id', dataIndex: 'gatewayCallId', width: 200, ellipsis: true },
  { title: '结果', dataIndex: 'resultUrl', width: 90 },
  { title: '成本（元）', dataIndex: 'costCny', width: 100 },
  { title: '计费', dataIndex: 'billingStatus', width: 100 },
  { title: '失败原因', dataIndex: 'errorReason', width: 200, ellipsis: true },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];

function pretty(text?: string) {
  const v = parseJson<unknown>(text, null);
  return v == null ? text || '-' : JSON.stringify(v, null, 2);
}

// 重做仅对失败 / 已取消的任务有意义；已封禁的不允许
function canRetry(t: Task) {
  return (t.status === 3 || t.status === 4) && !t.adminLocked;
}
// 未终结（0 排队 / 1 生成中）：强制失败，置失败并退回冻结点数、封禁重做
function isUnfinished(t: Task) {
  return t.status === 0 || t.status === 1;
}
function canForceFail(t: Task) {
  return isUnfinished(t) && !t.adminLocked;
}
// 已终结（3 失败 / 4 已取消）且未封禁：仅封禁重做，不动账
function canBanRetry(t: Task) {
  return (t.status === 3 || t.status === 4) && !t.adminLocked;
}

function confirmRetry(t: Task) {
  Modal.confirm({
    title: '重做子任务',
    content: `确认重做任务 ${t.taskId}？将重新提交生图。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      await retryTask(t.taskId);
      message.success('已提交重做');
      load();
    },
  });
}

function confirmForceFail(t: Task) {
  Modal.confirm({
    title: '强制失败',
    content: `确认强制失败任务 ${t.taskId}？将置为失败并退回本次冻结的点数，并禁止重做。`,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await forceFailTask(t.taskId);
      message.success('已强制失败，点数已退回');
      load();
    },
  });
}

function confirmBanRetry(t: Task) {
  Modal.confirm({
    title: '封禁重做',
    content: `确认封禁任务 ${t.taskId} 的重做？不改变计费，只禁止之后重做。`,
    okText: '确认',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await forceFailTask(t.taskId);
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
.sel-group {
  margin-bottom: 12px;
}
.step-code {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ant-color-text-tertiary, #999);
}
.sec-title {
  margin: 12px 0 6px;
  font-weight: 600;
}
.sub {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.sub-list {
  flex: 0 0 180px;
  max-height: 560px;
  overflow: auto;
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  border-radius: 6px;
}
.sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.sub-item:hover {
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.04));
}
.sub-item--on {
  background: var(--ant-color-primary-bg, #e6f4ff);
}
.sub-idx {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
}
.sub-tag {
  margin: 0;
}
.sub-body {
  flex: 1;
  min-width: 0;
}
.sub-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 8px;
}
.ellipsis {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
