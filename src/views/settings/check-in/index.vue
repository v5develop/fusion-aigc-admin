<template>
  <div class="page-container">
    <a-card :bordered="false" :loading="loading">
      <a-alert type="warning" show-icon class="mb-4" :message="$t('checkIn.hint')" />

      <a-form layout="vertical" class="settings-form">
        <a-form-item :label="$t('checkIn.enabled')">
          <!-- 切换即保存，且只提交 enabled：后端是部分更新，没传的字段沿用当前值。
               把整个对象一起回传，会把运营正在编辑但还没确认的奖励梯度顺手写进去 -->
          <a-switch
            v-model:checked="settings.enabled"
            :loading="savingEnabled"
            @change="handleToggle"
          />
          <div class="form-hint">{{ $t('checkIn.enabledDesc') }}</div>
        </a-form-item>

        <a-form-item :label="$t('checkIn.rewards')">
          <a-input v-model:value="rewardsText" placeholder="10,10,10,10,10,10,60" />
          <div class="form-hint">{{ $t('checkIn.rewardsDesc') }}</div>
          <div class="preview">
            <a-tag v-for="(item, index) in previewRewards" :key="index">
              {{ $t('checkIn.day', { day: index + 1 }) }}: {{ item }}
            </a-tag>
          </div>
        </a-form-item>

        <a-form-item :label="$t('checkIn.pointsValidDays')">
          <a-input-number v-model:value="settings.pointsValidDays" :min="0" class="w-full" />
          <div class="form-hint">{{ $t('checkIn.pointsValidDaysDesc') }}</div>
        </a-form-item>

        <a-form-item>
          <a-button type="primary" :loading="savingRules" @click="handleSaveRules">
            {{ $t('common.save') }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
/**
 * 每日签到规则。
 *
 * 签到发的是**赠送批次**（CAMPAIGN_GIFT，paid=false）：它计入赠送额度，
 * 但**不会把用户变成付费用户** —— 水印这类权利边界看的是免费/付费分层，
 * 签到送再多点数也不改变那个判断。
 *
 * 这里的每一次保存都直接改变送出去多少点数，属于资金侧配置，全部进审计日志。
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { getCheckInSettings, saveCheckInSettings } from '@/api/check-in';

const { t } = useI18n();

const loading = ref(false);
const savingEnabled = ref(false);
const savingRules = ref(false);

const settings = reactive({ enabled: false, pointsValidDays: 0 });
const rewardsText = ref('');

/** 逗号分隔的输入解析成数组；非法项在这里就被滤掉，不等到后端再报错。 */
const previewRewards = computed(() =>
  rewardsText.value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0),
);

async function load() {
  loading.value = true;
  try {
    const data = await getCheckInSettings();
    settings.enabled = data.enabled ?? false;
    settings.pointsValidDays = data.pointsValidDays ?? 0;
    rewardsText.value = (data.rewards ?? []).join(',');
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}

async function handleToggle(checked: boolean) {
  savingEnabled.value = true;
  try {
    await saveCheckInSettings({ enabled: checked });
    message.success(checked ? t('checkIn.enabledOn') : t('checkIn.enabledOff'));
  } catch {
    settings.enabled = !checked;
  } finally {
    savingEnabled.value = false;
  }
}

async function handleSaveRules() {
  if (previewRewards.value.length === 0) {
    message.error(t('checkIn.rewardsRequired'));
    return;
  }
  savingRules.value = true;
  try {
    await saveCheckInSettings({
      rewards: previewRewards.value,
      pointsValidDays: settings.pointsValidDays,
    });
    message.success(t('common.saveSuccess'));
    // 重新拉一次：后端返回的是「数据库优先 + yaml 兜底」之后的实际生效值，
    // 直接用本地表单值当作已生效，会在后端做了归一化时显示成另一回事
    await load();
  } catch {
    /* 梯度非法时后端会拒绝并给出原因 */
  } finally {
    savingRules.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
/* 这两个局部工具类沿用各设置页的写法；说明文字的 .form-hint 已提到 global.css，不要再在这里复制一份 */
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
.settings-form {
  max-width: 520px;
}
.preview {
  margin-top: 8px;
}
</style>
