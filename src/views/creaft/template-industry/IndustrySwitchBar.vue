<template>
  <a-card variant="borderless" class="switch-card" :loading="loading && !view">
    <div v-if="view" class="switch-row">
      <span class="label">行业功能（用户端行业门）</span>
      <a-tag :color="view.enabled ? 'success' : 'warning'">
        {{ view.enabled ? '已开启' : '已关闭' }}
      </a-tag>
      <span class="muted">{{ sourceText }}</span>
      <a-tooltip v-if="view.remark" :title="view.remark">
        <span class="muted remark">{{ view.remark }}</span>
      </a-tooltip>
      <span class="spacer" />
      <a-button
        v-permission="'creaft_catalog:edit'"
        :type="view.enabled ? 'default' : 'primary'"
        :danger="view.enabled"
        size="small"
        @click="ask(view.enabled ? 'close' : 'open')"
      >
        {{ view.enabled ? '关闭行业功能' : '开启行业功能' }}
      </a-button>
      <a-button
        v-if="view.source === 'db'"
        v-permission="'creaft_catalog:edit'"
        size="small"
        type="link"
        @click="ask('reset')"
      >
        恢复跟随配置文件
      </a-button>
    </div>
    <div v-else-if="failed" class="switch-row">
      <span class="muted">行业功能开关读取失败</span>
      <a-button size="small" type="link" @click="load">重试</a-button>
    </div>

    <a-modal
      v-model:open="modal.open"
      :title="modalTitle"
      :confirm-loading="modal.busy"
      :ok-text="modalOk"
      :ok-button-props="{ danger: modal.action === 'close' }"
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
 * 行业功能总开关（plaza-admin /industry-switch）。数据库 > 配置文件：页面切换 = 写库，从此以库为准；
 * 「恢复跟随配置文件」= 删掉库里这一行。关闭后用户端行业门显示「模板正在准备中」。
 * 网关 60 秒内生效。查看要 creaft_catalog:view，切换要 creaft_catalog:edit。
 */
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  getIndustrySwitch,
  resetIndustrySwitch,
  setIndustrySwitch,
  type IndustrySwitch,
} from '@/api/plaza-admin';

type Action = 'open' | 'close' | 'reset';

const view = ref<IndustrySwitch | null>(null);
const loading = ref(false);
const failed = ref(false);
const modal = reactive({ open: false, busy: false, action: 'open' as Action, reason: '' });

const onOff = (v: boolean) => (v ? '开' : '关');

const sourceText = computed(() => {
  const v = view.value;
  if (!v) return '';
  if (v.source === 'db') return `以数据库为准（配置文件为${onOff(v.configDefault)}）`;
  if (v.dbValue !== undefined)
    return `数据库值「${v.dbValue}」无法识别，跟随配置文件（${onOff(v.configDefault)}）`;
  return `跟随配置文件（${onOff(v.configDefault)}）`;
});

const modalTitle = computed(
  () => ({ open: '开启行业功能', close: '关闭行业功能', reset: '恢复跟随配置文件' })[modal.action],
);
const modalOk = computed(() => ({ open: '开启', close: '关闭', reset: '恢复' })[modal.action]);
const modalHint = computed(() => {
  const sec = view.value?.effectSeconds ?? 60;
  if (modal.action === 'close')
    return `${sec} 秒内用户端行业门会显示「模板正在准备中」，已在行业里的模板和用户偏好不会被删除。`;
  if (modal.action === 'open') return `${sec} 秒内用户端恢复显示行业门。`;
  return `删除数据库里的开关，${sec} 秒内改为跟随配置文件（当前配置文件为${onOff(view.value?.configDefault ?? false)}）。`;
});

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    view.value = await getIndustrySwitch();
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
        ? await resetIndustrySwitch({ reason })
        : await setIndustrySwitch({ enabled: modal.action === 'open', reason });
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
