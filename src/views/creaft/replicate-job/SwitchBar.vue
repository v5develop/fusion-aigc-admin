<template>
  <a-card variant="borderless" class="switch-card" :loading="loading && !view">
    <div v-if="view" class="switch-row">
      <span class="label">新提交</span>
      <a-tag :color="view.enabled ? 'success' : 'warning'">
        {{ view.enabled ? '开启中' : '已暂停' }}
      </a-tag>
      <span class="muted">
        {{ sourceText }}
      </span>
      <a-tooltip v-if="view.remark" :title="view.remark">
        <span class="muted remark">{{ view.remark }}</span>
      </a-tooltip>
      <span class="spacer" />
      <a-button
        v-permission="'replicate:switch'"
        :type="view.enabled ? 'default' : 'primary'"
        :danger="view.enabled"
        size="small"
        @click="ask(view.enabled ? 'pause' : 'resume')"
      >
        {{ view.enabled ? '暂停新提交' : '开启新提交' }}
      </a-button>
      <a-button
        v-if="view.source === 'db'"
        v-permission="'replicate:switch'"
        size="small"
        type="link"
        @click="ask('reset')"
      >
        恢复跟随部署配置
      </a-button>
    </div>
    <div v-else-if="failed" class="switch-row">
      <span class="muted">总开关读取失败</span>
      <a-button size="small" type="link" @click="load">重试</a-button>
    </div>

    <a-modal
      v-model:open="modal.open"
      :title="modalTitle"
      :confirm-loading="modal.busy"
      :ok-text="modalOk"
      :ok-button-props="{ danger: modal.action === 'pause' }"
      @ok="submit"
    >
      <p class="hint">{{ modalHint }}</p>
      <div class="reason-wrap">
        <a-textarea
          v-model:value="modal.reason"
          :maxlength="200"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="原因（必填，会记在配置备注里）"
        />
        <span class="count">{{ modal.reason.length }} / 200</span>
      </div>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
/**
 * 视频做同款总开关（admin-api /api/v1/replicate/admin/switch，契约 §9.x）。
 * 数据库 > 部署配置：页面上切换 = 写库，从此以库为准；「恢复跟随部署配置」= 删掉库里这一行。
 * 关着只拦新提交，历史 / 我的方案 / 在途任务照常；改动 60 秒内生效。查看要 replicate:view，切换要 replicate:switch。
 */
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  getReplicateSwitch,
  resetReplicateSwitch,
  setReplicateSwitch,
  type ReplicateSwitch,
} from '@/api/replicate-admin';

type Action = 'pause' | 'resume' | 'reset';

const view = ref<ReplicateSwitch | null>(null);
const loading = ref(false);
const failed = ref(false);
const modal = reactive({
  open: false,
  busy: false,
  action: 'pause' as Action,
  reason: '',
});

const onOff = (v: boolean) => (v ? '开' : '关');

const sourceText = computed(() => {
  const v = view.value;
  if (!v) return '';
  if (v.source === 'db') return `以数据库为准（部署配置为${onOff(v.configDefault)}）`;
  if (v.dbValue !== undefined)
    return `数据库值「${v.dbValue}」无法识别，跟随部署配置（${onOff(v.configDefault)}）`;
  return `跟随部署配置（${onOff(v.configDefault)}）`;
});

const modalTitle = computed(
  () => ({ pause: '暂停新提交', resume: '开启新提交', reset: '恢复跟随部署配置' })[modal.action],
);
const modalOk = computed(() => ({ pause: '暂停', resume: '开启', reset: '恢复' })[modal.action]);
const modalHint = computed(() => {
  const sec = view.value?.effectSeconds ?? 60;
  if (modal.action === 'pause')
    return `${sec} 秒内用户将不能新建分析和提交生成；历史、我的方案、进行中的任务不受影响。`;
  if (modal.action === 'resume') return `${sec} 秒内用户可以重新提交。`;
  return `删除数据库里的开关，${sec} 秒内改为跟随部署配置（当前部署配置为${onOff(view.value?.configDefault ?? false)}）。`;
});

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    view.value = await getReplicateSwitch();
  } catch {
    failed.value = !view.value;
  } finally {
    loading.value = false;
  }
}

function ask(action: Action) {
  modal.action = action;
  modal.reason = '';
  modal.open = true;
}

async function submit() {
  const reason = modal.reason.trim();
  if (!reason) {
    message.warning('请填写原因');
    return;
  }
  modal.busy = true;
  try {
    view.value =
      modal.action === 'reset'
        ? await resetReplicateSwitch({ reason })
        : await setReplicateSwitch({
            enabled: modal.action === 'resume',
            reason,
          });
    modal.open = false;
    message.success(`已保存，${view.value.effectSeconds} 秒内生效`);
  } catch {
    /* 已提示 */
  } finally {
    modal.busy = false;
  }
}

onMounted(load);
</script>

<style scoped>
.switch-card {
  margin-bottom: 12px;
}
.switch-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.label {
  font-weight: 500;
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
.reason-wrap {
  position: relative;
}
/* 字数统计叠在输入框右下角：文字区底部留出位置，输入到最后一行也不压字 */
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
.hint {
  margin: 0 0 8px;
  color: var(--ant-color-text-secondary, #666);
}
</style>
