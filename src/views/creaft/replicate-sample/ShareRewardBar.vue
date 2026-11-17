<template>
  <a-card variant="borderless" class="reward-card" :loading="loading && !view">
    <div v-if="view" class="reward-row">
      <span class="label">投稿奖励</span>
      <a-tag :color="view.enabled ? 'success' : 'warning'">
        {{ view.enabled ? '已开启' : '已关闭' }}
      </a-tag>
      <span v-if="view.enabled" class="summary">{{ summaryText }}</span>
      <span class="muted">{{ sourceText }}</span>
      <a-tooltip v-if="view.remark" :title="view.remark">
        <span class="muted remark">{{ view.remark }}</span>
      </a-tooltip>
      <span class="spacer" />
      <a-button v-permission="'replicate:sample'" size="small" @click="openEdit">
        修改规则
      </a-button>
      <a-button
        v-if="view.source === 'db'"
        v-permission="'replicate:sample'"
        size="small"
        type="link"
        @click="openReset"
      >
        恢复跟随配置文件
      </a-button>
    </div>
    <div v-else-if="failed" class="reward-row">
      <span class="muted">投稿奖励设置读取失败</span>
      <a-button size="small" type="link" @click="load">重试</a-button>
    </div>

    <!-- 修改规则 -->
    <a-modal
      v-model:open="edit.open"
      title="修改投稿奖励规则"
      ok-text="保存"
      :confirm-loading="edit.busy"
      @ok="submitEdit"
    >
      <a-form layout="vertical">
        <a-form-item label="开启奖励">
          <a-switch v-model:checked="edit.enabled" />
        </a-form-item>
        <a-form-item label="每条点数">
          <a-input-number
            v-model:value="edit.points"
            :min="1"
            :max="1000"
            :precision="0"
            style="width: 160px"
          />
        </a-form-item>
        <a-form-item label="每人每月上限">
          <a-input-number
            v-model:value="edit.monthlyLimit"
            :min="0"
            :max="100"
            :precision="0"
            style="width: 160px"
          />
          <div class="muted">0 表示不限</div>
        </a-form-item>
        <a-form-item label="原因" required>
          <div class="reason-wrap">
            <a-textarea
              v-model:value="edit.reason"
              :maxlength="200"
              :auto-size="{ minRows: 3, maxRows: 6 }"
              placeholder="原因（必填，会记在配置备注里）"
            />
            <span class="count">{{ edit.reason.length }} / 200</span>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 恢复跟随配置文件 -->
    <a-modal
      v-model:open="reset.open"
      title="恢复跟随配置文件"
      ok-text="恢复"
      :confirm-loading="reset.busy"
      @ok="submitReset"
    >
      <p class="hint">
        删除数据库里的设置，立即改为跟随配置文件（{{ ruleText(view?.configDefault) }}）。
      </p>
      <div class="reason-wrap">
        <a-textarea
          v-model:value="reset.reason"
          :maxlength="200"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="原因（必填，会记在配置备注里）"
        />
        <span class="count">{{ reset.reason.length }} / 200</span>
      </div>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
/**
 * 投稿奖励设置栏（Go /share-reward-settings）。数据库 > 配置文件：保存 = 写库，从此以库为准；
 * 「恢复跟随配置文件」= 删掉库里这一行。改动立即生效。查看要 replicate:view，修改要 replicate:sample。
 */
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  getShareRewardSettings,
  resetShareRewardSettings,
  setShareRewardSettings,
  type ShareRewardRule,
  type ShareRewardSettings,
} from '@/api/replicate-admin';

const emit = defineEmits<{ change: [settings: ShareRewardSettings] }>();

const view = ref<ShareRewardSettings | null>(null);
const loading = ref(false);
const failed = ref(false);
const edit = reactive({
  open: false,
  busy: false,
  enabled: true,
  points: 30 as number | null,
  monthlyLimit: 3 as number | null,
  reason: '',
});
const reset = reactive({ open: false, busy: false, reason: '' });

const limitText = (n: number) => (n === 0 ? '不限' : `最多 ${n} 次`);
/** 规则的一句话描述（配置默认值也用它） */
const ruleText = (r?: ShareRewardRule) => {
  if (!r) return '';
  if (!r.enabled) return '关闭';
  return `每条 ${r.points} 点 · 每人每月${limitText(r.monthlyLimit)}`;
};

const summaryText = computed(() => {
  const v = view.value;
  return v ? `每条 ${v.points} 点 · 每人每月${limitText(v.monthlyLimit)}` : '';
});
const sourceText = computed(() => {
  const v = view.value;
  if (!v) return '';
  return v.source === 'db'
    ? `以数据库为准（配置文件为${ruleText(v.configDefault)}）`
    : `跟随配置文件（${ruleText(v.configDefault)}）`;
});

function apply(v: ShareRewardSettings) {
  view.value = v;
  emit('change', v);
}

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    apply(await getShareRewardSettings());
  } catch {
    failed.value = !view.value;
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  const v = view.value;
  if (!v) return;
  Object.assign(edit, {
    open: true,
    enabled: v.enabled,
    points: v.points,
    monthlyLimit: v.monthlyLimit,
    reason: '',
  });
}

async function submitEdit() {
  const reason = edit.reason.trim();
  if (edit.points == null || edit.points < 1 || edit.points > 1000) {
    message.warning('每条点数须在 1–1000 之间');
    return;
  }
  if (edit.monthlyLimit == null || edit.monthlyLimit < 0 || edit.monthlyLimit > 100) {
    message.warning('每人每月上限须在 0–100 之间');
    return;
  }
  if (!reason) {
    message.warning('请填写原因');
    return;
  }
  edit.busy = true;
  try {
    apply(
      await setShareRewardSettings({
        enabled: edit.enabled,
        points: edit.points,
        monthlyLimit: edit.monthlyLimit,
        reason,
      }),
    );
    edit.open = false;
    message.success('已保存，立即生效');
  } catch {
    /* 已提示 */
  } finally {
    edit.busy = false;
  }
}

function openReset() {
  Object.assign(reset, { open: true, reason: '' });
}

async function submitReset() {
  const reason = reset.reason.trim();
  if (!reason) {
    message.warning('请填写原因');
    return;
  }
  reset.busy = true;
  try {
    apply(await resetShareRewardSettings({ reason }));
    reset.open = false;
    message.success('已保存，立即生效');
  } catch {
    /* 已提示 */
  } finally {
    reset.busy = false;
  }
}

// 供父组件在收到 REWARD_DISABLED 等情况时刷新
defineExpose({ reload: load });

onMounted(load);
</script>

<style scoped>
.reward-card {
  margin-bottom: 12px;
}
.reward-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.label {
  font-weight: 500;
}
.summary {
  font-size: 13px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.remark {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spacer {
  flex: 1;
}
.hint {
  margin: 0 0 8px;
  color: var(--ant-color-text-secondary, #666);
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
  font-size: 12px;
  line-height: 1;
}
</style>
