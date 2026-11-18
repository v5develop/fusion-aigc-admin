<template>
  <a-drawer
    :open="open"
    :title="`任务详情 #${jobId}`"
    width="1020"
    destroy-on-close
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <template #extra>
      <a-space>
        <a-tooltip :title="refundTip">
          <a-button
            v-permission="'replicate:refund'"
            danger
            :disabled="!canRefund"
            @click="openRefund"
          >
            人工退点
          </a-button>
        </a-tooltip>
        <a-tooltip :title="forceTip">
          <a-button
            v-permission="'replicate:force'"
            danger
            :disabled="!canForce"
            @click="openForce"
          >
            强制收尾
          </a-button>
        </a-tooltip>
      </a-space>
    </template>

    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-alert
          v-if="!detail.billingOn"
          type="error"
          show-icon
          style="margin-bottom: 12px"
          message="后台没有开计费对接（ReplicateAdmin.Billing 与网关侧不一致），退点和收尾会被拒绝"
        />
        <a-alert
          v-if="detail.job.error"
          type="error"
          show-icon
          style="margin-bottom: 12px"
          message="失败原因"
          :description="detail.job.error"
        />
        <a-alert
          v-if="mismatch.length"
          type="warning"
          show-icon
          style="margin-bottom: 12px"
          :message="`有 ${mismatch.length} 张预留单的镜像状态与计费真实状态不一致`"
          description="以计费真实状态为准；退点前请先确认，不要凭镜像状态判断钱的去向。"
        />

        <a-descriptions :column="3" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(detail.job.status)">{{ detail.job.statusLabel }}</a-tag>
            <span v-if="detail.job.stopReason === 'admin_force'" class="muted">后台强制收尾</span>
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.job.continuity" label="画面连贯度">
            <a-tag :color="detail.job.continuity === 'smooth' ? 'blue' : 'default'">{{
              continuityLabel(detail.job.continuity)
            }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="用户 ID">{{ detail.job.userId }}</a-descriptions-item>
          <a-descriptions-item label="模型组">{{ detail.job.modelGroup }}</a-descriptions-item>
          <a-descriptions-item label="任务号" :span="2">
            <code>{{ detail.job.taskId }}</code>
            <a-button type="link" size="small" @click="copy(detail.job.taskId)">复制</a-button>
          </a-descriptions-item>
          <a-descriptions-item label="方案号">{{ detail.job.planNo }}</a-descriptions-item>
          <a-descriptions-item label="创建">{{
            fmtTime(detail.job.createdAt)
          }}</a-descriptions-item>
          <a-descriptions-item label="完成">{{
            fmtTime(detail.job.finishedAt)
          }}</a-descriptions-item>
          <a-descriptions-item label="段进度">
            {{ detail.job.segDone }}/{{ detail.job.segTotal }}，失败
            {{ detail.job.segFailed }}，重做
            {{ detail.job.redoCount }}
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="detail.subjectText.length">
          <h4>按人点名说明</h4>
          <ul class="subject-text">
            <li v-for="(t, i) in detail.subjectText" :key="i">{{ t }}</li>
          </ul>
        </template>

        <h4>段</h4>
        <a-table
          :columns="segColumns"
          :data-source="detail.segments"
          :pagination="false"
          row-key="index"
          size="small"
          :scroll="{ x: 860 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'index'">第 {{ record.index }} 段</template>
            <template v-else-if="column.dataIndex === 'bridge'">
              <a-tag v-if="record.bridge" :color="record.bridge === 'used' ? 'green' : 'orange'">{{
                BRIDGE_LABEL[record.bridge as SegmentBridge] ?? record.bridge
              }}</a-tag>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.dataIndex === 'state'">
              <a-tag :color="stepColor(record.state)">{{ record.state }}</a-tag>
              <div v-if="record.failReason" class="bad small">{{ record.failReason }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'gatewayCallIds'">
              <div v-for="g in record.gatewayCallIds ?? []" :key="g">
                <code class="small">{{ g }}</code>
                <a-button type="link" size="small" @click="copy(g)">复制</a-button>
              </div>
              <span v-if="!record.gatewayCallIds?.length" class="muted">—</span>
            </template>
            <template v-else-if="column.dataIndex === 'refundablePoints'">
              <b v-if="record.refundablePoints">{{ record.refundablePoints }}</b>
              <span v-else class="muted">0</span>
            </template>
          </template>
        </a-table>

        <template v-if="detail.feedback.length">
          <h4 style="margin-top: 20px">用户反馈</h4>
          <div v-for="f in detail.feedback" :key="f.id" class="fb-block">
            <a-tag :color="f.rating === 'up' ? 'green' : 'red'">{{
              f.rating === 'up' ? '满意' : '不满意'
            }}</a-tag>
            <span class="muted small">{{ f.segIndex ? `第 ${f.segIndex} 段` : '整条' }}</span>
            <a-tag v-for="r in f.reasons" :key="r" color="orange">{{ reasonLabel(r) }}</a-tag>
            <span class="muted small">{{ fmtTime(f.updatedAt || f.createdAt) }}</span>
            <div v-if="f.note" class="fb-note">备注：{{ f.note }}</div>
          </div>
        </template>

        <h4 style="margin-top: 20px">步骤时间线</h4>
        <a-timeline class="steps">
          <a-timeline-item v-for="s in detail.steps" :key="s.id" :color="stepColor(s.status)">
            <div>
              <b>{{ s.stepKey }}</b>
              <a-tag style="margin-left: 8px">{{ s.status }}</a-tag>
              <span v-if="s.attempt > 1" class="muted">第 {{ s.attempt }} 次</span>
              <span v-if="s.retryOf" class="muted">（重试自 {{ s.retryOf }}）</span>
            </div>
            <div class="muted small">
              {{ fmtTime(s.startedAt ?? s.createdAt) }}
              <template v-if="s.finishedAt"> → {{ fmtTime(s.finishedAt) }}</template>
              <template v-if="s.gatewayCallId">
                · 网关调用
                <code>{{ s.gatewayCallId }}</code>
                <a-button type="link" size="small" @click="copy(s.gatewayCallId)">复制</a-button>
                <span v-if="s.gatewayStatus">（{{ s.gatewayStatus }}）</span>
              </template>
            </div>
            <div v-if="s.errorMsg || s.errorCode" class="bad small">
              {{ s.errorClass }} {{ s.errorCode }} {{ s.errorMsg }}
            </div>
          </a-timeline-item>
        </a-timeline>

        <h4 style="margin-top: 20px">预留单：镜像与计费真实状态</h4>
        <a-table
          :columns="chargeColumns"
          :data-source="detail.charges"
          :pagination="false"
          row-key="id"
          size="small"
          :scroll="{ x: 900 }"
        >
          <template #emptyText><a-empty description="没有预留单" /></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'segIndex'">
              {{ record.segIndex ? `第 ${record.segIndex} 段` : '整单' }}
            </template>
            <template v-else-if="column.dataIndex === 'mirrorLabel'">
              <a-tag>{{ record.mirrorLabel }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'billingStatus'">
              <a-tag :color="reservationColor(record.billingStatus)">
                {{ record.billingStatus || '没有单' }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'mismatch'">
              <a-tag v-if="record.mismatch" color="red">不一致</a-tag>
              <a-tag v-else color="green">一致</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'refundablePoints'">
              <b v-if="record.refundablePoints">{{ record.refundablePoints }}</b>
              <span v-else class="muted">{{ record.blockedReason || 0 }}</span>
            </template>
          </template>
        </a-table>

        <h4 style="margin-top: 20px">审核记录</h4>
        <a-table
          :columns="modColumns"
          :data-source="detail.moderations"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #emptyText><a-empty description="没有审核记录" /></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'status'">
              <a-tag :color="record.status === 'REJECTED' ? 'red' : 'green'">{{
                record.status
              }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'createdAt'">
              {{ fmtTime(record.createdAt) }}
            </template>
          </template>
        </a-table>
        <a-table
          v-if="detail.moderationLogs.length"
          :columns="logColumns"
          :data-source="detail.moderationLogs"
          :pagination="false"
          row-key="id"
          size="small"
          style="margin-top: 8px"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'passed'">
              <a-tag :color="record.passed ? 'green' : 'red'">{{
                record.passed ? '通过' : '拒绝'
              }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'createTime'">
              {{ fmtTime(record.createTime) }}
            </template>
          </template>
        </a-table>

        <h4 style="margin-top: 20px">人工操作记录</h4>
        <a-empty v-if="!detail.actions.length" description="还没有人工操作" />
        <a-timeline v-else>
          <a-timeline-item
            v-for="a in detail.actions"
            :key="a.id"
            :color="a.status === 'FAILED' ? 'red' : 'blue'"
          >
            <b>{{ a.action === 'REFUND' ? '人工退点' : '强制收尾' }}</b>
            <a-tag style="margin-left: 8px" :color="a.status === 'FAILED' ? 'red' : 'default'">
              {{ a.status }}
            </a-tag>
            · 管理员 {{ a.adminId }} · <span class="muted">{{ fmtTime(a.createdAt) }}</span>
            <div v-if="a.points">{{ a.points }} 点</div>
            <div class="muted small">原因：{{ a.reason }}</div>
          </a-timeline-item>
        </a-timeline>

        <a-collapse ghost style="margin-top: 12px">
          <a-collapse-panel key="input" header="方案输入（原样）">
            <pre class="json">{{ JSON.stringify(detail.input, null, 2) }}</pre>
          </a-collapse-panel>
        </a-collapse>
      </template>
    </a-spin>

    <!-- 人工退点 -->
    <a-modal
      v-model:open="refundOpen"
      title="人工退点"
      :confirm-loading="acting"
      :ok-button-props="{ disabled: !refundSegs.length || !reason.trim() }"
      :ok-text="retry ? '用同一个幂等键重试补退' : '下一步：确认'"
      @ok="confirmRefund"
    >
      <a-alert
        v-if="retry"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="上一次只退了一部分。再点会用同一个幂等键重试，只补退剩下的，已退的不会重复退。"
      />
      <p v-else class="muted">
        只列出现在还能退的段；点数退给用户本人，走幂等退点并写审计，同一段不会重复退。
      </p>
      <a-checkbox-group v-model:value="refundSegs" style="display: block" :disabled="!!retry">
        <div v-for="s in refundable" :key="s.index" class="seg-pick">
          <a-checkbox :value="s.index">
            第 {{ s.index }} 段 <b>{{ s.refundablePoints }} 点</b>
          </a-checkbox>
        </div>
      </a-checkbox-group>
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="退点原因（必填，≤200 字，进审计）">
          <a-textarea
            v-model:value="reason"
            :rows="3"
            :maxlength="200"
            show-count
            :disabled="!!retry"
            placeholder="如：供应商超时未出片，用户投诉，工单 #1234"
          />
        </a-form-item>
      </a-form>
      <div class="total">
        将退 <b>{{ retry ? retry.expected : refundTotal }}</b> 点
      </div>
    </a-modal>

    <!-- 强制收尾 -->
    <a-modal
      v-model:open="forceOpen"
      title="强制收尾"
      :confirm-loading="acting"
      :ok-button-props="{ disabled: !reason.trim(), danger: true }"
      ok-text="确认收尾"
      @ok="doForce"
    >
      <a-alert
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="只收非在途的任务：待继续的只交付第 1 段，没开始的段取消，未结清的预留按步骤状态结清（成功的确认扣除、其余退回）。结清不了的会如实提示，由系统继续补扫。"
      />
      <a-form layout="vertical">
        <a-form-item label="收尾原因（必填，≤200 字，进审计）">
          <a-textarea v-model:value="reason" :rows="3" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, ref, watch } from 'vue';

import {
  ReplicateError,
  forceFinishJob,
  getAdminJob,
  isInFlight,
  newIdempotencyKey,
  refundJobSegments,
  type AdminJobDetail,
  type SegmentBridge,
} from '@/api/replicate-admin';

import {
  BRIDGE_LABEL,
  continuityLabel,
  copyText,
  fmtTime,
  reasonLabel,
  reservationColor,
  statusColor,
} from './job-meta';

const props = defineProps<{ open: boolean; jobId: number }>();
const emit = defineEmits<{ 'update:open': [v: boolean]; changed: [] }>();

const detail = ref<AdminJobDetail | null>(null);
const loading = ref(false);
const acting = ref(false);

const segColumns = computed(() => [
  { title: '段', dataIndex: 'index', width: 80 },
  // 衔接只在 smooth 任务（后端给了 bridge）时出现
  ...((detail.value?.segments ?? []).some((s) => s.bridge)
    ? [{ title: '衔接', dataIndex: 'bridge', width: 170 }]
    : []),
  { title: '链尾状态', dataIndex: 'state', width: 220 },
  { title: '可退点数', dataIndex: 'refundablePoints', width: 90 },
  { title: '网关调用 id', dataIndex: 'gatewayCallIds' },
]);
const chargeColumns = [
  { title: '对应段', dataIndex: 'segIndex', width: 80 },
  { title: '阶段', dataIndex: 'stage', width: 70 },
  { title: '秒数', dataIndex: 'seconds', width: 60 },
  { title: '点数', dataIndex: 'points', width: 70 },
  { title: '镜像状态', dataIndex: 'mirrorLabel', width: 110 },
  { title: '计费真实状态', dataIndex: 'billingStatus', width: 130 },
  { title: '是否一致', dataIndex: 'mismatch', width: 90 },
  { title: '预留单', dataIndex: 'reservationNo', width: 130 },
  { title: '现在可退', dataIndex: 'refundablePoints', width: 150 },
];
const modColumns = [
  { title: '方案号', dataIndex: 'planNo', width: 150 },
  { title: '结论', dataIndex: 'status', width: 120 },
  { title: '原因', dataIndex: 'reason' },
  { title: '时间', dataIndex: 'createdAt', width: 180 },
];
const logColumns = [
  { title: '审核调用', dataIndex: 'bizType', width: 150 },
  { title: '结果', dataIndex: 'passed', width: 80 },
  { title: '标签', dataIndex: 'label', width: 100 },
  { title: '命中对象', dataIndex: 'rejectedTarget' },
  { title: '时间', dataIndex: 'createTime', width: 180 },
];
const stepColor = (s: string) =>
  ({
    done: 'green',
    succeeded: 'green',
    failed: 'red',
    running: 'blue',
    pending: 'gray',
    skipped: 'gray',
    canceled: 'gray',
  })[s] ?? 'gray';

const mismatch = computed(() => (detail.value?.charges ?? []).filter((c) => c.mismatch));
const refundable = computed(() =>
  (detail.value?.segments ?? []).filter((s) => s.refundablePoints > 0),
);
const canRefund = computed(() => !!detail.value && detail.value.canRefund);
const canForce = computed(() => {
  const d = detail.value;
  return !!d && d.canForce && !isInFlight(d.job.status);
});
const refundTip = computed(() =>
  detail.value && !canRefund.value ? '没有可退的点数（已退清、还在生成或已扣除不可退）' : '',
);
const forceTip = computed(() => {
  const d = detail.value;
  if (!d || canForce.value) return '';
  return d.forceBlocker || '任务还在系统处理中，等它自己结束后再收尾';
});

async function load() {
  if (!props.jobId) return;
  loading.value = true;
  try {
    detail.value = await getAdminJob(props.jobId);
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
watch(
  () => props.open,
  (v) => {
    if (v) {
      detail.value = null;
      retry.value = null;
      load();
    }
  },
);

async function copy(text?: string) {
  if (!text) return;
  if (await copyText(text)) message.success('已复制');
  else message.warning('复制失败，请手动选择');
}

const reason = ref('');
/** 409 / 参数类错误统一提示；需要刷新数据的 reason 顺手刷新 */
function reportError(e: unknown, fallback: string) {
  if (!(e instanceof ReplicateError)) return;
  message.error(e.message || fallback);
  if (['POINTS_CHANGED', 'NOTHING_TO_REFUND', 'IN_FLIGHT'].includes(e.reason ?? '')) load();
}

// ---- 人工退点 ----
const refundOpen = ref(false);
const refundSegs = ref<number[]>([]);
const refundTotal = computed(() =>
  refundable.value
    .filter((s) => refundSegs.value.includes(s.index))
    .reduce((a, s) => a + s.refundablePoints, 0),
);
/**
 * 部分失败（code 5001、无明细）后冻结本次请求的全部参数和幂等键：重试必须原样重发同一个键，
 * 后端才只补退剩下的；换了段 / 原因 / 合计就是另一次动作，要新键。
 */
const retry = ref<{ key: string; segs: number[]; reason: string; expected: number } | null>(null);

function openRefund() {
  if (!retry.value) {
    reason.value = '';
    refundSegs.value = refundable.value.map((s) => s.index);
  } else {
    reason.value = retry.value.reason;
    refundSegs.value = retry.value.segs;
  }
  refundOpen.value = true;
}
function confirmRefund() {
  const d = detail.value;
  if (!d) return;
  const frozen = retry.value;
  const segs = frozen ? frozen.segs : [...refundSegs.value].sort((a, b) => a - b);
  const total = frozen ? frozen.expected : refundTotal.value;
  const why = frozen ? frozen.reason : reason.value.trim();
  // 二次确认：把用户、段、点数再摆一遍，防手滑
  Modal.confirm({
    title: `确认给用户 ${d.job.userId} ${frozen ? '补退' : '退'} ${total} 点？`,
    content: `任务 #${d.job.jobId}，第 ${segs.join('、')} 段。退点不可撤销。原因：${why}`,
    okText: frozen ? '确认重试补退' : `确认退 ${total} 点`,
    okType: 'danger',
    onOk: async () => {
      const key = frozen?.key ?? newIdempotencyKey();
      acting.value = true;
      try {
        const r = await refundJobSegments(
          d.job.jobId,
          { segIndexes: segs, reason: why, expectedPoints: total },
          key,
        );
        const bad = r.lines.filter((x) => x.error);
        if (bad.length)
          message.warning(
            `已退 ${r.points} 点；第 ${bad.map((x) => x.segIndex).join('、')} 段失败`,
          );
        else
          message.success(
            r.replay ? `这是重复请求，沿用第一次结果：${r.points} 点` : `已退 ${r.points} 点`,
          );
        retry.value = null;
        refundOpen.value = false;
        emit('changed');
        await load();
      } catch (e) {
        if (e instanceof ReplicateError && e.code === 5001) {
          retry.value = { key, segs, reason: why, expected: total };
          message.error('部分退点没成功（已记录审计）。再点「人工退点」会用同一个幂等键补退剩下的');
          emit('changed');
          await load();
          refundOpen.value = false;
        } else {
          reportError(e, '退点失败');
        }
      } finally {
        acting.value = false;
      }
    },
  });
}

// ---- 强制收尾 ----
const forceOpen = ref(false);
function openForce() {
  reason.value = '';
  forceOpen.value = true;
}
async function doForce() {
  const d = detail.value;
  if (!d) return;
  acting.value = true;
  try {
    const r = await forceFinishJob(
      d.job.jobId,
      { reason: reason.value.trim() },
      newIdempotencyKey(),
    );
    if (r.openCharges > 0)
      message.warning(
        `已收尾为「${r.status}」，但还有 ${r.openCharges} 张预留单没结清，系统会继续补扫`,
      );
    else message.success(r.message || '已收尾');
    forceOpen.value = false;
    emit('changed');
    await load();
  } catch (e) {
    reportError(e, '收尾失败');
  } finally {
    acting.value = false;
  }
}
</script>

<style scoped>
h4 {
  margin: 0 0 8px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
}
.small {
  font-size: 12px;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.subject-text {
  margin: 0 0 16px;
  padding-left: 20px;
}
.fb-block {
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
}
.fb-block > * {
  margin-right: 6px;
}
.fb-note {
  margin-top: 4px;
  white-space: pre-wrap;
}
.seg-pick {
  padding: 4px 0;
}
.total {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
}
.json {
  max-height: 260px;
  overflow: auto;
  font-size: 12px;
}
</style>
