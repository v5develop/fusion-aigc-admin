<template>
  <div class="poll-latency-learning">
    <a-card :loading="loading" :title="t('aiGateway.pollLatencyLearning.title')">
      <a-alert
        v-if="loadError"
        type="error"
        show-icon
        :message="t('aiGateway.pollLatencyLearning.loadFailed')"
        :description="t('aiGateway.pollLatencyLearning.loadFailedHint')"
        style="margin-bottom: 16px"
      >
        <template #action>
          <a-button size="small" :loading="loading" @click="load">
            {{ t('aiGateway.pollLatencyLearning.retry') }}
          </a-button>
        </template>
      </a-alert>
      <a-alert
        v-else-if="loaded"
        :type="data.configured ? 'success' : 'warning'"
        show-icon
        :message="
          data.configured
            ? t('aiGateway.pollLatencyLearning.statusConfigured')
            : t('aiGateway.pollLatencyLearning.statusFallback')
        "
        :description="t('aiGateway.pollLatencyLearning.hint')"
        style="margin-bottom: 16px"
      />

      <a-form layout="vertical" style="max-width: 720px">
        <a-form-item :label="t('aiGateway.pollLatencyLearning.enabledLabel')">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
        <a-form-item
          :label="t('aiGateway.pollLatencyLearning.minSamplesLabel')"
          :validate-status="minSamplesError ? 'error' : ''"
          :help="minSamplesError || minSamplesHelp"
        >
          <a-input-number
            v-model:value="form.min_samples"
            :min="MIN_SAMPLES.min"
            :max="MIN_SAMPLES.max"
            :precision="0"
            :step="1"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item
          :label="t('aiGateway.pollLatencyLearning.windowHoursLabel')"
          :validate-status="windowHoursError ? 'error' : ''"
          :help="windowHoursError || windowHoursHelp"
        >
          <a-input-number
            v-model:value="form.window_hours"
            :min="WINDOW_HOURS.min"
            :max="WINDOW_HOURS.max"
            :precision="0"
            :step="1"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="saving" :disabled="!loaded || invalid" @click="save">
              {{ t('aiGateway.pollLatencyLearning.save') }}
            </a-button>
            <a-button :disabled="saving || !loaded" @click="reset">{{
              t('common.reset')
            }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
  getPollLatencyLearning,
  putPollLatencyLearning,
  type PollLatencyLearning,
} from '@/api/ai-gateway';

const { t } = useI18n();
const router = useRouter();

// 与网关校验一致：整数区间
const MIN_SAMPLES = { min: 5, max: 1000 } as const;
const WINDOW_HOURS = { min: 1, max: 72 } as const;
// 网关默认值（开 / 20 / 6）；仅作首屏占位，未成功读取前禁止保存
const GATEWAY_DEFAULTS = { enabled: true, min_samples: 20, window_hours: 6 } as const;

interface FormState {
  enabled: boolean;
  min_samples: number | null;
  window_hours: number | null;
}

const loading = ref(false);
const saving = ref(false);
// 成功读取过一次才允许保存，避免把占位值写进草稿
const loaded = ref(false);
const loadError = ref(false);
const data = reactive<PollLatencyLearning>({ ...GATEWAY_DEFAULTS, configured: false });
const form = reactive<FormState>({ ...GATEWAY_DEFAULTS });

function rangeError(value: number | null, range: { min: number; max: number }) {
  const ok =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= range.min &&
    value <= range.max;
  return ok ? '' : t('aiGateway.pollLatencyLearning.rangeError', range);
}

const minSamplesError = computed(() => rangeError(form.min_samples, MIN_SAMPLES));
const windowHoursError = computed(() => rangeError(form.window_hours, WINDOW_HOURS));
const minSamplesHelp = computed(() =>
  t('aiGateway.pollLatencyLearning.minSamplesHelp', MIN_SAMPLES),
);
const windowHoursHelp = computed(() =>
  t('aiGateway.pollLatencyLearning.windowHoursHelp', WINDOW_HOURS),
);
const invalid = computed(() => Boolean(minSamplesError.value || windowHoursError.value));

function apply(value: PollLatencyLearning) {
  data.enabled = value.enabled === true;
  data.min_samples = value.min_samples;
  data.window_hours = value.window_hours;
  data.configured = value.configured !== false;
  reset();
}

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    apply(await getPollLatencyLearning());
    loaded.value = true;
  } catch {
    loadError.value = true;
    message.error(t('aiGateway.pollLatencyLearning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function reset() {
  form.enabled = data.enabled;
  form.min_samples = data.min_samples;
  form.window_hours = data.window_hours;
}

async function save() {
  if (!loaded.value || invalid.value) {
    return;
  }
  saving.value = true;
  try {
    const saved = await putPollLatencyLearning({
      enabled: form.enabled,
      min_samples: form.min_samples as number,
      window_hours: form.window_hours as number,
    });
    apply(saved);
    // 草稿已写入，发布后才生效：提示里给出去发布的入口（VNode，不用函数）
    message.success({
      content: h('span', [
        t('aiGateway.pollLatencyLearning.saved'),
        ' ',
        h(
          'a',
          { onClick: () => router.push({ name: 'AiGatewayConfigVersions' }) },
          t('aiGateway.goPublish'),
        ),
      ]),
      duration: 6,
    });
  } catch {
    message.error(t('aiGateway.pollLatencyLearning.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.poll-latency-learning {
  padding: 16px;
}
</style>
