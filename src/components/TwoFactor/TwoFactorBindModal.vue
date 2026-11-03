<template>
  <!-- force：开关开着且未绑定，Esc / 遮罩 / 关闭按钮都关不掉，挡住后台页面直到绑定成功 -->
  <a-modal
    :open="open"
    :title="mode === 'rebind' ? t('twoFactor.rebindTitle') : t('twoFactor.bindTitle')"
    :closable="!isForce"
    :keyboard="!isForce"
    :mask="{ closable: !isForce }"
    :footer="null"
    :width="460"
    :z-index="isForce ? 2000 : undefined"
    destroy-on-hidden
    @cancel="handleCancel"
  >
    <a-alert v-if="isForce" type="warning" show-icon :message="t('twoFactor.forceTip')" />

    <a-steps :current="stepIndex" size="small" :items="stepItems" class="two-factor-steps" />

    <!-- 换绑：先校验当前验证码，通过后端校验才生成新密钥 -->
    <div v-if="step === 'current'" class="two-factor-body">
      <div class="two-factor-tip">{{ t('twoFactor.currentCodeTip') }}</div>
      <a-input-otp v-model:value="currentCode" :length="6" @change="clearError" />
      <a-alert v-if="errorMsg" type="error" show-icon :message="errorMsg" />
      <a-button
        type="primary"
        block
        :loading="loading"
        :disabled="currentCode.length !== 6"
        @click="runSetup(currentCode)"
      >
        {{ t('twoFactor.next') }}
      </a-button>
    </div>

    <div v-else-if="step === 'setup'" class="two-factor-body two-factor-center">
      <a-spin v-if="loading" />
      <template v-else>
        <a-alert type="error" show-icon :message="errorMsg || t('twoFactor.setupFailed')" />
        <a-button @click="runSetup()">{{ t('twoFactor.retry') }}</a-button>
      </template>
    </div>

    <div v-else class="two-factor-body">
      <div class="two-factor-tip">{{ t('twoFactor.scanTip') }}</div>
      <div class="two-factor-center">
        <a-qrcode :value="setup?.otpauthUri || ''" :size="180" />
      </div>
      <div v-if="setup?.secret" class="two-factor-secret">
        <span>{{ t('twoFactor.manualTip') }}</span>
        <a-typography-text code copyable>{{ setup.secret }}</a-typography-text>
      </div>

      <div class="two-factor-tip">{{ t('twoFactor.codeTip') }}</div>
      <a-input-otp v-model:value="code" :length="6" @change="clearError" />
      <a-alert v-if="errorMsg" type="error" show-icon :message="errorMsg" />
      <a-button
        type="primary"
        block
        :loading="loading"
        :disabled="code.length !== 6"
        @click="handleVerify"
      >
        {{ t('twoFactor.verify') }}
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { setupTwoFactor, verifyTwoFactor, type TwoFactorSetupResult } from '@/api/two-factor';

/**
 * 两步验证绑定弹窗，三种用法共用一套流程（setup → 二维码 → 验证码 → verify）：
 * - force：强制绑定，不可关闭；
 * - bind：个人中心主动绑定，可关闭；
 * - rebind：个人中心换绑，先输入当前验证码（setup 带 currentCode），可关闭。
 */
const props = defineProps<{
  open: boolean;
  mode: 'force' | 'bind' | 'rebind';
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  success: [];
}>();

const { t } = useI18n();

type Step = 'current' | 'setup' | 'verify';

const step = ref<Step>('setup');
const loading = ref(false);
const errorMsg = ref('');
const currentCode = ref('');
const code = ref('');
const setup = ref<TwoFactorSetupResult | null>(null);

const isForce = computed(() => props.mode === 'force');

const stepItems = computed(() => {
  const items = [
    { title: t('twoFactor.stepSetup') },
    { title: t('twoFactor.stepScan') },
    { title: t('twoFactor.stepVerify') },
  ];
  return props.mode === 'rebind' ? [{ title: t('twoFactor.stepCurrent') }, ...items] : items;
});

const stepIndex = computed(() => {
  const offset = props.mode === 'rebind' ? 1 : 0;
  if (step.value === 'current') return 0;
  if (step.value === 'setup') return offset;
  // 拿到二维码后「扫码」和「输入验证码」在同一屏，输入满 6 位视为进入第三步
  return offset + (code.value.length === 6 ? 2 : 1);
});

function errorText(e: unknown) {
  return e instanceof Error ? e.message : '';
}

function clearError() {
  errorMsg.value = '';
}

async function runSetup(withCurrentCode?: string) {
  step.value = withCurrentCode ? 'current' : 'setup';
  loading.value = true;
  errorMsg.value = '';
  try {
    const result = await setupTwoFactor(withCurrentCode);
    if (!result?.otpauthUri) throw new Error(t('twoFactor.setupFailed'));
    setup.value = result;
    code.value = '';
    step.value = 'verify';
  } catch (e) {
    // 换绑时当前验证码错了：停在当前步，展示后端原因
    errorMsg.value = errorText(e) || t('twoFactor.setupFailed');
  } finally {
    loading.value = false;
  }
}

async function handleVerify() {
  loading.value = true;
  errorMsg.value = '';
  try {
    await verifyTwoFactor(code.value);
    message.success(
      props.mode === 'rebind' ? t('twoFactor.rebindSuccess') : t('twoFactor.bindSuccess'),
    );
    emit('success');
    emit('update:open', false);
  } catch (e) {
    errorMsg.value = errorText(e) || t('twoFactor.verifyFailed');
    code.value = '';
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  if (isForce.value) return;
  emit('update:open', false);
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    setup.value = null;
    currentCode.value = '';
    code.value = '';
    errorMsg.value = '';
    if (props.mode === 'rebind') {
      step.value = 'current';
    } else {
      void runSetup();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.two-factor-steps {
  margin: 16px 0;
}

.two-factor-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.two-factor-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.two-factor-tip {
  color: var(--color-text-secondary);
}

.two-factor-secret {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
  word-break: break-all;
}
</style>
