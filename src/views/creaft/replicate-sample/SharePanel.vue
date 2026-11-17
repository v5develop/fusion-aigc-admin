<template>
  <div>
    <div class="filter-bar">
      <a-radio-group v-model:value="status" button-style="solid" @change="reloadFirst">
        <a-radio-button v-for="o in STATUS_TABS" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-radio-button>
      </a-radio-group>
      <a-button @click="() => load()">刷新</a-button>
    </div>

    <a-alert
      v-if="loadFailed"
      type="error"
      show-icon
      message="投稿列表加载失败，请稍后重试"
      style="margin-bottom: 12px"
    />

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="middle"
      :scroll="{ x: 1000 }"
    >
      <template #emptyText>
        <a-empty :description="`暂无${currentLabel}的投稿`" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'video'">
          <SampleThumb
            label="成片"
            :configured="!!(record.videoUrl || record.coverUrl)"
            :url="record.videoUrl || record.coverUrl"
          />
        </template>
        <template v-else-if="column.key === 'change'">
          {{ record.change.label || '-' }}
        </template>
        <template v-else-if="column.key === 'user'">
          {{ record.userIdMasked }}
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ fmtTime(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="STATUS_COLOR[record.status as ShareStatus]">
            {{ STATUS_LABEL[record.status as ShareStatus] ?? record.status }}
          </a-tag>
          <div v-if="record.status === 'rejected' && record.rejectReason" class="muted">
            {{ record.rejectReason }}
          </div>
          <div v-if="record.status === 'approved'" class="muted">
            <a v-if="record.sampleId" @click="emit('open-sample', record.sampleId)">
              示例 #{{ record.sampleId }}
            </a>
            <span v-if="record.rewardStatus === 'granted'"> · 奖励已发放</span>
          </div>
        </template>
        <template v-else-if="column.key === 'operation'">
          <template v-if="record.status === 'pending'">
            <a-button
              v-permission="'replicate:sample'"
              size="small"
              type="link"
              @click="openApprove(record)"
            >
              通过
            </a-button>
            <a-button
              v-permission="'replicate:sample'"
              size="small"
              type="link"
              danger
              @click="openReject(record)"
            >
              驳回
            </a-button>
          </template>
          <template v-else-if="record.status === 'approved' && record.rewardStatus === 'none'">
            <a-tooltip
              :title="
                record.rewardAllowed
                  ? ''
                  : `本月已发放 ${record.monthRewardCount}/${record.rewardLimit} 次`
              "
            >
              <a-button
                v-permission="'replicate:sample'"
                size="small"
                type="link"
                :disabled="!record.rewardAllowed"
                @click="openReward(record)"
              >
                发放奖励
              </a-button>
            </a-tooltip>
          </template>
        </template>
      </template>
    </a-table>

    <div class="pager">
      <span class="muted">共 {{ total }} 条</span>
      <a-pagination
        v-model:current="page"
        v-model:page-size="size"
        :total="total"
        show-size-changer
        :page-size-options="['20', '50', '100']"
        @change="() => load()"
      />
    </div>

    <!-- 通过 -->
    <a-modal
      v-model:open="approve.open"
      title="通过投稿"
      ok-text="通过并上线"
      :confirm-loading="approve.busy"
      @ok="doApprove"
    >
      <p class="hint">通过后会生成一条已启用的示例，用户可在示例库看到。</p>
      <a-input
        v-model:value="approve.title"
        :maxlength="40"
        show-count
        allow-clear
        placeholder="示例标题（可选，不填则自动生成）"
      />
    </a-modal>

    <!-- 驳回 -->
    <a-modal
      v-model:open="reject.open"
      title="驳回投稿"
      ok-text="确认驳回"
      :ok-button-props="{ danger: true }"
      :confirm-loading="reject.busy"
      @ok="doReject"
    >
      <p class="hint">驳回原因会展示给投稿用户。</p>
      <div class="reason-wrap">
        <a-textarea
          v-model:value="reject.reason"
          :maxlength="200"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="驳回原因（必填）"
        />
        <span class="count">{{ reject.reason.length }} / 200</span>
      </div>
    </a-modal>

    <!-- 发放奖励 -->
    <a-modal
      v-model:open="reward.open"
      title="发放奖励"
      ok-text="确认发放"
      :confirm-loading="reward.busy"
      @ok="doReward"
    >
      <p>给该用户（{{ reward.row?.userIdMasked }}）发放 {{ REWARD_POINTS }} 点？</p>
      <a-alert
        v-if="reward.retryHint"
        type="warning"
        show-icon
        message="点数已发放成功，但投稿状态还没更新。请直接再点一次「确认发放」补记状态，不会重复发点。"
      />
    </a-modal>

    <!-- 通过成功：给出示例入口 -->
    <a-modal v-model:open="done.open" title="已通过" :footer="null">
      <p>已生成示例 #{{ done.sampleId }}，并已上线。</p>
      <a-button type="primary" @click="gotoSample">查看示例</a-button>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 用户投稿审核（CONTRACT §T）：待审核 / 已通过 / 已驳回 / 已撤回四个状态页签。
 * 发放奖励的顺序：先调 Java 积分接口（幂等键 = row.rewardKey），成功后再调 Go 标记；两步都幂等，
 * 若 Go 标记失败，保留弹窗并提示重试即可（Java 侧同键重放不会重复发点）。
 */
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import { adjustPoints } from '@/api/points';
import {
  REWARD_MONTHLY_LIMIT,
  ReplicateError,
  approveShare,
  getShares,
  markShareRewarded,
  rejectShare,
  type ShareRow,
  type ShareStatus,
} from '@/api/replicate-admin';

import { fmtTime } from '../replicate-job/job-meta';
import SampleThumb from './SampleThumb.vue';

const emit = defineEmits<{ 'open-sample': [id: number] }>();

/** 每条投稿奖励的点数（DECISIONS 2026-11-17） */
const REWARD_POINTS = 30;

const STATUS_TABS: { label: string; value: ShareStatus }[] = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '已撤回', value: 'withdrawn' },
];
const STATUS_LABEL: Record<ShareStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
};
const STATUS_COLOR: Record<ShareStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  withdrawn: 'default',
};

const columns = [
  { title: '成片', key: 'video', width: 100 },
  { title: '改法', key: 'change', width: 220 },
  { title: '投稿人', key: 'user', width: 120 },
  { title: '投稿时间', key: 'createdAt', width: 170 },
  { title: '状态', key: 'status', width: 220 },
  { title: '操作', key: 'operation', width: 180, fixed: 'right' as const },
];

const status = ref<ShareStatus>('pending');
const currentLabel = computed(() => STATUS_LABEL[status.value]);
const page = ref(1);
const size = ref(20);
const rows = ref<ShareRow[]>([]);
const total = ref(0);
const loading = ref(false);
const loadFailed = ref(false);

let seq = 0;
async function load() {
  const s = ++seq;
  loading.value = true;
  loadFailed.value = false;
  try {
    const res = await getShares({
      status: status.value,
      page: page.value,
      size: size.value,
    });
    if (s !== seq) return;
    rows.value = res.items;
    total.value = res.total ?? 0;
  } catch {
    if (s === seq) loadFailed.value = true;
  } finally {
    if (s === seq) loading.value = false;
  }
}
function reloadFirst() {
  page.value = 1;
  load();
}

// ---------------------------------------------------------------- 通过
const approve = reactive({
  open: false,
  busy: false,
  row: null as ShareRow | null,
  title: '',
});
function openApprove(r: ShareRow) {
  Object.assign(approve, { open: true, row: r, title: '' });
}
const done = reactive({ open: false, sampleId: 0 });
async function doApprove() {
  if (!approve.row) return;
  approve.busy = true;
  try {
    const res = await approveShare(approve.row.id, approve.title.trim());
    approve.open = false;
    if (res.sampleId) Object.assign(done, { open: true, sampleId: res.sampleId });
    else message.success('已通过');
    load();
  } catch {
    /* 已提示 */
  } finally {
    approve.busy = false;
  }
}
function gotoSample() {
  done.open = false;
  emit('open-sample', done.sampleId);
}

// ---------------------------------------------------------------- 驳回
const reject = reactive({
  open: false,
  busy: false,
  row: null as ShareRow | null,
  reason: '',
});
function openReject(r: ShareRow) {
  Object.assign(reject, { open: true, row: r, reason: '' });
}
async function doReject() {
  const reason = reject.reason.trim();
  if (!reject.row) return;
  if (!reason) {
    message.warning('请填写驳回原因');
    return;
  }
  reject.busy = true;
  try {
    await rejectShare(reject.row.id, reason);
    reject.open = false;
    message.success('已驳回');
    load();
  } catch {
    /* 已提示 */
  } finally {
    reject.busy = false;
  }
}

// ---------------------------------------------------------------- 发放奖励
const reward = reactive({
  open: false,
  busy: false,
  row: null as ShareRow | null,
  /** Java 已成功、Go 标记失败：提示重试 */
  retryHint: false,
});
function openReward(r: ShareRow) {
  Object.assign(reward, { open: true, row: r, retryHint: false });
}
async function doReward() {
  const row = reward.row;
  if (!row) return;
  reward.busy = true;
  try {
    // 1) Java 积分：用真实 userId，幂等键固定为 rewardKey，重放不会重复发点
    await adjustPoints({
      userId: row.userId,
      adjustType: 'ADD',
      amount: REWARD_POINTS,
      reason: `示例投稿奖励（投稿 #${row.id}）`,
      idempotencyKey: row.rewardKey,
      grantSource: 'ADMIN_GIFT',
    });
  } catch {
    // 积分没发成功：request 层通常已提示，这里不进入第二步
    reward.busy = false;
    return;
  }
  try {
    // 2) Go 标记（幂等）
    await markShareRewarded(row.id);
    reward.open = false;
    message.success(`已发放 ${REWARD_POINTS} 点`);
    load();
  } catch (e) {
    if (e instanceof ReplicateError && e.reason === REWARD_MONTHLY_LIMIT) {
      message.error('该用户本月奖励次数已达上限');
      reward.open = false;
      load();
    } else {
      reward.retryHint = true;
    }
  } finally {
    reward.busy = false;
  }
}

onMounted(load);
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.hint {
  color: var(--ant-color-text-secondary, #666);
  margin-bottom: 12px;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
.reason-wrap {
  position: relative;
}
.reason-wrap :deep(textarea) {
  padding-bottom: 22px;
}
.count {
  position: absolute;
  right: 11px;
  bottom: 6px;
  pointer-events: none;
  color: var(--ant-color-text-tertiary, #888);
}
</style>
