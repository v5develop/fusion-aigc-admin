import type {
  TaskTrace,
  TaskTraceSource,
  TaskTraceStage,
  TaskTraceStageStatus,
} from '@/api/creation-task';

/**
 * 任务链路面板的纯函数：状态/来源兜底、耗时格式化、卡点行判定、轮询决策。
 * 不依赖 Vue / DOM / 时钟，便于单测；后端字段一律可能为 null 或出现未知枚举值，这里统一兜住。
 *
 * 契约：GET /api/v1/admin/creation/tasks/{taskId}/trace
 *   → { taskId, traceId, generatedAt, stuckAt, stages[], terminal? }（类型见 @/api/creation-task 的 TaskTrace）。
 *   traceId 等于 taskId；terminal 为增量字段，旧后端不返回。
 *
 * stages[].key 由后端产出，前端只做展示与按 key 匹配 stuckAt.stage，不在前端拼造。
 * 后端当前会产出的 key（仅供阅读参考）：
 *   task.billing_reserve
 *   task.submit
 *   task.dispatch
 *   task.gateway_submit
 *   task.execute                 （老的在途任务：无工作流步骤记录时的整体执行阶段）
 *   gateway.call.created
 *   gateway.attempt.sending
 *   gateway.attempt.accepted
 *   gateway.rehost.output.<i>    （<i> 为产物序号，0 起）
 *   gateway.call.read
 *   media.<stage>                （媒体服务阶段，如 media.copy；source=media，name「媒体服务 <stage>（第 n 张）」）
 *   gateway.<stage>              （转存产物时网关侧的分段计时，如 gateway.mediasvc_http / gateway.persist /
 *                                 gateway.sign / gateway.digest / gateway.decode_b64 / gateway.upload_body /
 *                                 gateway.mediasvc_retry_wait；source=gateway，name「网关 <stage>（第 n 张）」，
 *                                 status 恒为 done、startedAt/endedAt 为 null、只有 durationMs；
 *                                 失败只体现在父阶段 gateway.rehost.output.<i> 上）
 *   task.settle
 *   task.asset_sync
 * 后缀：
 *   @<步骤路径>   多步骤工作流里网关类 key 追加所属步骤路径（形如 <key>@<步骤路径>）
 *   #n           同一 key 重复出现时追加序号（形如 <key>#n）：首次出现不带后缀，重复依列表顺序为 #2、#3…
 * 唯一性：同一条链路内 key（含后缀）唯一，数组顺序即展示顺序，前端不排序、不按基础 key 合并行。
 *   基础 key = 先去掉 #n 再去掉 @<步骤路径>；本面板目前不需要基础 key，卡点匹配也用完整 key。
 * 来源样式只看 source、不看 key 前缀：source=gateway（含上面的网关分段计时）一律按网关标签/颜色渲染，
 *   source=media 按媒体渲染。本面板不按 key 前缀推导任何「预期耗时 / 时间预算」，只展示后端给的 durationMs；
 *   以后若要加预算，须按完整的阶段族匹配（如 media. / gateway.call. / gateway.rehost.），
 *   不能用宽泛的 gateway. 前缀，否则网关分段计时会套用到网关调用阶段的预算。
 * 本面板不依赖这份清单完整：任何未知 key / 后缀照常渲染（name 兜底为 key），
 * 卡点匹配只做 key 全等比较，轮询决策不看具体 key。后端新增/改名 key 时可顺手更新这里。
 */

const KNOWN_STATUSES: readonly TaskTraceStageStatus[] = [
  'done',
  'running',
  'failed',
  'pending',
  'skipped',
];
const KNOWN_SOURCES: readonly TaskTraceSource[] = ['java', 'gateway', 'media'];

/** 未知状态按 pending 处理 */
export function normalizeStageStatus(status: unknown): TaskTraceStageStatus {
  return KNOWN_STATUSES.includes(status as TaskTraceStageStatus)
    ? (status as TaskTraceStageStatus)
    : 'pending';
}

/** 未知来源按 java 处理 */
export function normalizeSource(source: unknown): TaskTraceSource {
  return KNOWN_SOURCES.includes(source as TaskTraceSource) ? (source as TaskTraceSource) : 'java';
}

/**
 * 毫秒格式化：<1s 显示 ms，<1min 显示 s（一位小数），<1h 显示 min+s，否则 h+min。
 * null / 非数 / 负数 → '-'。
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${(Math.floor(totalSec * 10) / 10).toFixed(1)}s`;
  const sec = Math.floor(totalSec);
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}min ${s}s` : `${m}min`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

function parseTime(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Date.parse(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * 行展示用耗时：优先后端 durationMs；运行中且无 durationMs 时，
 * 用 generatedAt（服务端时钟，避免本机时钟偏差）减 startedAt 估算已运行时长。
 * 返回 { ms, ongoing }，ongoing=true 表示仍在计时。
 */
export function stageElapsed(
  stage: TaskTraceStage,
  generatedAt: string | null | undefined,
): { ms: number | null; ongoing: boolean } {
  if (stage.durationMs != null && Number.isFinite(stage.durationMs)) {
    return { ms: stage.durationMs, ongoing: false };
  }
  if (normalizeStageStatus(stage.status) !== 'running') return { ms: null, ongoing: false };
  const start = parseTime(stage.startedAt);
  const now = parseTime(generatedAt);
  if (start == null || now == null || now < start) return { ms: null, ongoing: true };
  return { ms: now - start, ongoing: true };
}

/**
 * 卡点行下标：stages 中 key === stuckAt.stage 的那一行；
 * 同 key 多行时优先「同来源且运行中」，其次「运行中」，其次同来源，最后取最后一条匹配。
 * stuckAt 为 null 或没有匹配行 → -1。
 */
export function pickStuckRow(trace: Pick<TaskTrace, 'stuckAt' | 'stages'> | null | undefined) {
  const stuck = trace?.stuckAt;
  const stages = trace?.stages || [];
  if (!stuck || !stuck.stage) return -1;
  const matches: number[] = [];
  stages.forEach((s, i) => {
    if (s && s.key === stuck.stage) matches.push(i);
  });
  if (!matches.length) return -1;
  const src = normalizeSource(stuck.source);
  const running = (i: number) => normalizeStageStatus(stages[i]!.status) === 'running';
  const sameSrc = (i: number) => normalizeSource(stages[i]!.source) === src;
  return (
    matches.find((i) => running(i) && sameSrc(i)) ??
    matches.find(running) ??
    matches.find(sameSrc) ??
    matches[matches.length - 1]!
  );
}

/** 链路完成：无卡点、至少一个阶段、且每个阶段都是 done（skipped 视为已跳过的完成） */
export function isChainComplete(trace: Pick<TaskTrace, 'stuckAt' | 'stages'> | null | undefined) {
  if (!trace || trace.stuckAt) return false;
  const stages = trace.stages || [];
  if (!stages.length) return false;
  return stages.every((s) => {
    const st = normalizeStageStatus(s?.status);
    return st === 'done' || st === 'skipped';
  });
}

/** 链路是否已经静止（没有 running / pending 阶段且无卡点），静止后无需继续轮询 */
export function isChainSettled(trace: Pick<TaskTrace, 'stuckAt' | 'stages'> | null | undefined) {
  if (!trace || trace.stuckAt) return false;
  const stages = trace.stages || [];
  if (!stages.length) return false;
  return stages.every((s) => {
    const st = normalizeStageStatus(s?.status);
    return st !== 'running' && st !== 'pending';
  });
}

/** 时间线圆点颜色 */
export function stageColor(status: unknown): string {
  switch (normalizeStageStatus(status)) {
    case 'done':
      return 'green';
    case 'running':
      return 'blue';
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

/** 来源标签颜色 */
export function sourceColor(source: unknown): string {
  switch (normalizeSource(source)) {
    case 'gateway':
      return 'purple';
    case 'media':
      return 'cyan';
    default:
      return 'blue';
  }
}

/** 网关调用 labels.job 是否为创作任务号（与后端 GatewayCostAttribution.TASK_PREFIX 一致） */
export const CREATION_TASK_ID_PREFIX = 'AiCreation_';
export function creationTaskIdFromLabels(
  labels: Record<string, unknown> | null | undefined,
): string | null {
  const job = labels?.job;
  return typeof job === 'string' && job.startsWith(CREATION_TASK_ID_PREFIX) ? job : null;
}

// ======================== 轮询决策（纯函数，detail.vue 的链路轮询据此决定间隔与何时停） ========================

/** 默认轮询间隔 */
export const TRACE_POLL_BASE_MS = 5000;
/** 链路运行中但连续无变化时的放慢间隔 */
export const TRACE_POLL_SLOW_MS = 15000;
/** 连续多少次响应无变化后放慢 */
export const TRACE_UNCHANGED_POLLS_BEFORE_BACKOFF = 3;
/** 连续失败多少次后停止自动轮询（等人工重试） */
export const TRACE_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * 判断链路是否「有变化」用的指纹：只取会推进的字段（阶段 key/状态/起止/耗时/判据/说明 + 卡点阶段/来源/原因）。
 * 刻意排除 generatedAt 与 stuckAt.elapsedMs —— 它们每次请求都会变，纳入就永远「有变化」，退避失效。
 */
export function traceFingerprint(trace: Pick<TaskTrace, 'stuckAt' | 'stages'> | null | undefined) {
  if (!trace) return '';
  const stuck = trace.stuckAt;
  return JSON.stringify([
    stuck ? [stuck.stage, stuck.source, stuck.since, stuck.reason] : null,
    (trace.stages || []).map((s) =>
      s
        ? [s.key, s.source, s.status, s.startedAt, s.endedAt, s.durationMs, s.check, s.detail]
        : null,
    ),
  ]);
}

/** 本次响应后「连续无变化」计数：有变化清零，无变化 +1 */
export function nextUnchangedPolls(prevUnchangedPolls: number, changed: boolean): number {
  return changed ? 0 : Math.max(0, prevUnchangedPolls) + 1;
}

/**
 * 下一次轮询的延迟（毫秒）。
 * @param prev 截至本次响应（含本次）的连续无变化次数，即 nextUnchangedPolls 的结果
 * @param changed 本次响应相对上一次是否有变化
 * @param failures 截至本次的连续失败次数（成功即为 0）
 * 规则：失败中按默认间隔重试（次数上限由 shouldStopPolling 管）；有变化回到默认；
 * 连续无变化达到阈值后放慢到 TRACE_POLL_SLOW_MS。
 */
export function nextPollDelayMs(prev: number, changed: boolean, failures: number): number {
  if (failures > 0) return TRACE_POLL_BASE_MS;
  if (changed) return TRACE_POLL_BASE_MS;
  return prev >= TRACE_UNCHANGED_POLLS_BEFORE_BACKOFF ? TRACE_POLL_SLOW_MS : TRACE_POLL_BASE_MS;
}

export type TraceToggleAction = 'start' | 'resume' | 'pause' | 'none';

/**
 * 链路卡片展开/折叠时该做什么（卡片默认折叠，打开详情页不请求 trace）：
 * - 折叠 → 'pause'：撤掉定时器，折叠期间不再发请求（已在途的那一个落定后也不再排下一次）；
 * - 展开且本任务还没拉过 → 'start'（等同原先打开页面时的 startTrace，每个任务只走一次）；
 * - 展开且已拉过、仍处于轮询态 → 'resume'（立即补拉一次并按原节奏继续轮询）；
 * - 展开且已拉过、轮询已停（settled / failed / unavailable / 打开时已终态的 idle）→ 'none'，
 *   保持原状态与提示，需要时由「刷新 / 重试」按钮手动拉取。
 */
export function traceToggleAction(
  open: boolean,
  started: boolean,
  pollState: string,
): TraceToggleAction {
  if (!open) return 'pause';
  if (!started) return 'start';
  return pollState === 'polling' ? 'resume' : 'none';
}

export type TraceStopReason = 'terminal' | 'settled' | 'failures';

/**
 * 是否停止自动轮询；null 表示继续。按顺序：
 * - 连续失败达到上限 → 'failures'（界面给出错误与「重试」按钮）
 * - 后端给了 terminal 字段：true → 'terminal'（任务已终态，即使网关阶段仍显示 running 也停，
 *   剩余的网关收尾不属于生成卡点，继续轮询只给后端加负载）；false → 继续（任务未终态，即使链路暂时静止）
 * - 后端未给 terminal（旧版本）→ 链路已静止（无卡点、无 running/pending 阶段）则 'settled'
 * 任务是否终态只以 trace 响应为准（页面打开时加载的 task.status 不会随轮询刷新）。
 * 404（接口未就绪）由 isTraceEndpointMissing 在调用方直接停，不经过这里。
 */
export function shouldStopPolling(
  trace: Pick<TaskTrace, 'stuckAt' | 'stages' | 'terminal'> | null | undefined,
  failures: number,
): TraceStopReason | null {
  if (failures >= TRACE_MAX_CONSECUTIVE_FAILURES) return 'failures';
  if (typeof trace?.terminal === 'boolean') return trace.terminal ? 'terminal' : null;
  if (isChainSettled(trace)) return 'settled';
  return null;
}

/**
 * 请求错误是否表示 trace 接口不存在（HTTP 404，或 CommonResult code 404）：
 * 后端尚未上线该接口，立即停轮询并提示「trace 接口未就绪」，不再计入失败重试。
 */
export function isTraceEndpointMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  return e.status === 404 || e.response?.status === 404 || e.code === 404;
}
