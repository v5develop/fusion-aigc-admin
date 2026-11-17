<template>
  <div>
    <ShareRewardBar ref="barRef" @change="onSettings" />
    <div class="filter-bar">
      <a-radio-group v-model:value="status" button-style="solid" @change="reloadFirst">
        <a-radio-button v-for="o in STATUS_TABS" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-radio-button>
      </a-radio-group>
      <a-button @click="() => load()">刷新</a-button>
      <span v-if="rewardOff" class="muted">投稿奖励已关闭</span>
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
          <div v-if="record.rewardStatus === 'granting'" class="muted">
            <a-tag color="processing">发放中</a-tag>
            已占位 {{ record.rewardPoints }} 点，待发放完成
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
          <!-- 发放中：占位已定、点数快照已定（即使奖励后来被关闭也要能继续）；重新走 占位 → Java → 标记，三步都幂等 -->
          <template v-else-if="record.rewardStatus === 'granting'">
            <a-button
              v-permission="'replicate:sample'"
              size="small"
              type="link"
              @click="openReward(record)"
            >
              继续发放
            </a-button>
          </template>
          <template
            v-else-if="!rewardOff && record.status === 'approved' && record.rewardStatus === 'none'"
          >
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

    <!-- 发放奖励：占位（Go）→ 加点（Java）→ 标记（Go） -->
    <a-modal
      v-model:open="reward.open"
      :title="reward.row?.rewardStatus === 'granting' ? '继续发放奖励' : '发放奖励'"
      :confirm-loading="reward.busy"
      :mask-closable="!reward.busy"
    >
      <p v-if="reward.row?.rewardStatus === 'granting'">
        该投稿的奖励处于「发放中」（已占位 {{ reward.row?.rewardPoints }} 点），继续给该用户（{{
          reward.row?.userIdMasked
        }}）发放？重复点击不会重复发点。
      </p>
      <p v-else>
        给该用户（{{ reward.row?.userIdMasked }}）发放 {{ reward.row?.rewardPoints }} 点？
      </p>
      <a-alert
        v-if="reward.retryHint === 'java'"
        type="warning"
        show-icon
        :message="
          reward.javaFailed
            ? '点数发放失败（接口明确拒绝）。投稿保持「发放中」，可修正问题后点「继续发放」重试，或点「取消发放」放弃并释放本月次数。'
            : '点数发放结果未知（网络或服务异常）。投稿保持「发放中」，请点「继续发放」重试，不会重复发点；先不要取消。'
        "
      />
      <a-alert
        v-else-if="reward.retryHint === 'mark'"
        type="warning"
        show-icon
        message="点数已发放成功，但投稿状态还没更新。请直接再点一次「继续发放」补记状态，不会重复发点。"
      />
      <template #footer>
        <a-button v-if="reward.javaFailed" danger :disabled="reward.busy" @click="doRelease">
          取消发放
        </a-button>
        <a-button :disabled="reward.busy" @click="reward.open = false">关闭</a-button>
        <a-button type="primary" :loading="reward.busy" @click="doReward">
          {{
            reward.retryHint || reward.row?.rewardStatus === 'granting' ? '继续发放' : '确认发放'
          }}
        </a-button>
      </template>
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
 * 发放奖励三步（Go 占位 → Java 加点 → Go 标记），开关 / 月上限只在第 1 步判定，所以不会出现「Java 已加点、Go 拒收」：
 *   1) claim：Go 同事务校验并占位（none → granting），返回点数快照 rewardPoints 与幂等键 rewardKey；已占位时原样返回，可重试；
 *   2) adjustPoints：Java，amount = claim.rewardPoints，idempotencyKey = claim.rewardKey（同键重放不会重复发点）；
 *   3) mark：Go granting → granted（无条件，幂等）。
 * Java 失败：保留 granting 并提示重试；只有 Java 明确拒绝（HTTP 4xx 类错误）才允许「取消发放」（release）；
 * 结果不明（超时 / 5xx / 断网）不给取消，因为点数可能已经发出。
 */
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import { adjustPoints } from '@/api/points';
import {
  REWARD_ALREADY_GRANTED,
  REWARD_DISABLED,
  REWARD_MONTHLY_LIMIT,
  REWARD_NOT_CLAIMED,
  ReplicateError,
  SHARE_NOT_APPROVED,
  approveShare,
  claimShareReward,
  getShares,
  markShareRewarded,
  rejectShare,
  releaseShareReward,
  type ShareRewardSettings,
  type ShareRow,
  type ShareStatus,
} from '@/api/replicate-admin';

import { fmtTime } from '../replicate-job/job-meta';
import SampleThumb from './SampleThumb.vue';
import ShareRewardBar from './ShareRewardBar.vue';

const emit = defineEmits<{ 'open-sample': [id: number] }>();

// 奖励规则由 ShareRewardBar 读取并上报；读到之前不隐藏，避免闪烁
const barRef = ref<InstanceType<typeof ShareRewardBar> | null>(null);
const settings = ref<ShareRewardSettings | null>(null);
const rewardOff = computed(() => settings.value?.enabled === false);
function onSettings(v: ShareRewardSettings) {
  const first = !settings.value;
  settings.value = v;
  // 规则改了，行里的 rewardPoints / rewardAllowed 要重取（首次读取时列表已在自己加载）
  if (!first) load();
}

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
  /** 失败提示：java = 加点没成功（投稿保持发放中）；mark = Java 已成功、Go 标记失败 */
  retryHint: '' as '' | 'java' | 'mark',
  /** Java 明确拒绝（4xx 类，未加点）：才允许取消发放 */
  javaFailed: false,
});
function openReward(r: ShareRow) {
  Object.assign(reward, { open: true, row: r, retryHint: '', javaFailed: false });
}

/** Java 调用是否「明确没加点」：HTTP / 业务 4xx（不含 401 登录失效、408 超时、429 限流）；网络错误、5xx、超时都算结果不明 */
function isDefiniteFailure(e: unknown): boolean {
  const x = e as { status?: number; code?: number } | null;
  const n = x?.status ?? x?.code;
  return typeof n === 'number' && n >= 400 && n < 500 && n !== 401 && n !== 408 && n !== 429;
}

async function doReward() {
  const row = reward.row;
  if (!row) return;
  reward.busy = true;
  reward.javaFailed = false;
  try {
    // 1) Go 占位：校验开关 / 月上限并锁定点数快照；已占位则原样返回
    let claim;
    try {
      claim = await claimShareReward(row.id);
    } catch (e) {
      handleClaimError(e);
      return;
    }
    if (!claim.granted) {
      // 2) Java 积分：amount 与幂等键都取自占位结果，重放不会重复发点
      try {
        await adjustPoints({
          userId: row.userId,
          adjustType: 'ADD',
          amount: claim.rewardPoints,
          reason: `示例投稿奖励（投稿 #${row.id}）`,
          idempotencyKey: claim.rewardKey,
          grantSource: 'ADMIN_GIFT',
        });
      } catch (e) {
        reward.retryHint = 'java';
        reward.javaFailed = isDefiniteFailure(e);
        load(); // 行已是发放中，刷新让列表也显示「继续发放」
        return;
      }
      // 3) Go 标记（granting → granted，无条件、幂等）
      try {
        await markShareRewarded(row.id);
      } catch (e) {
        if (e instanceof ReplicateError && e.reason === REWARD_NOT_CLAIMED) {
          message.error('占位已被取消，请刷新后重新发放（点数已发出，请先到积分流水核对）');
          reward.open = false;
          load();
        } else {
          reward.retryHint = 'mark';
        }
        return;
      }
    }
    reward.open = false;
    message.success(`已发放 ${claim.rewardPoints} 点`);
    load();
  } finally {
    reward.busy = false;
  }
}

/** 占位被拒：此时 Java 还没调用，什么都没发出 */
function handleClaimError(e: unknown) {
  const reason = e instanceof ReplicateError ? e.reason : '';
  if (reason === REWARD_DISABLED) {
    message.error('投稿奖励已关闭，无法发放');
    barRef.value?.reload();
  } else if (reason === REWARD_MONTHLY_LIMIT) {
    message.error('该用户本月奖励次数已达上限');
  } else if (reason === SHARE_NOT_APPROVED) {
    message.error('投稿已不是「已通过」状态（可能被用户撤回），无法发放');
  } else {
    message.error(e instanceof Error && e.message ? e.message : '占位失败，请稍后重试');
    return;
  }
  reward.open = false;
  load();
}

/** 取消发放：仅在 Java 明确失败后可用；释放占位与本月次数 */
async function doRelease() {
  const row = reward.row;
  if (!row) return;
  reward.busy = true;
  try {
    await releaseShareReward(row.id);
    reward.open = false;
    message.success('已取消发放');
    load();
  } catch (e) {
    if (e instanceof ReplicateError && e.reason === REWARD_ALREADY_GRANTED) {
      message.error('这条奖励已经发放完成，不能取消');
      reward.open = false;
      load();
    } else {
      message.error(e instanceof Error && e.message ? e.message : '取消失败，请稍后重试');
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
