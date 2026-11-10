<template>
  <div class="page-container">
    <a-card :bordered="false" :loading="loading">
      <a-alert type="info" show-icon class="mb-4" :message="$t('videoEnhancePresets.intro')" />
      <a-alert type="warning" show-icon class="mb-4" :message="$t('videoEnhancePresets.hint')" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane
          v-for="tier in VIDEO_ENHANCE_TIERS"
          :key="tier"
          :tab="$t(`videoEnhancePresets.tiers.${tier}`)"
        >
          <div class="form-hint mb-4">
            {{
              $t('videoEnhancePresets.resolutionsHint', {
                resolutions: rulesOf(tier).resolutions.join(' / '),
              })
            }}
          </div>

          <a-form layout="vertical" class="settings-form">
            <template v-for="field in FIELD_ORDER" :key="field">
              <a-form-item
                v-if="supports(tier, field)"
                :label="$t(`videoEnhancePresets.fields.${field}`)"
              >
                <a-select
                  v-if="isEnum(tier, field)"
                  :value="fieldValue(tier, field)"
                  allow-clear
                  class="w-full"
                  :placeholder="$t('videoEnhancePresets.unsetPlaceholder')"
                  :options="enumOptions(tier, field)"
                  @update:value="(v: unknown) => setField(tier, field, v)"
                />
                <a-input-number
                  v-else
                  :value="fieldValue(tier, field)"
                  :min="rangeOf(tier, field)?.min"
                  :max="rangeOf(tier, field)?.max"
                  :precision="0"
                  class="w-full"
                  :placeholder="$t('videoEnhancePresets.unsetPlaceholder')"
                  @update:value="(v: unknown) => setField(tier, field, v)"
                />
                <div class="form-hint">{{ helpOf(tier, field) }}</div>
              </a-form-item>
            </template>

            <a-empty
              v-if="rulesOf(tier).params.length === 0"
              :description="$t('videoEnhancePresets.noParams')"
            />
          </a-form>
        </a-tab-pane>
      </a-tabs>

      <div class="actions">
        <a-button type="primary" :loading="saving" @click="handleSave">
          {{ $t('common.save') }}
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import type { VideoEnhanceTier, VideoEnhanceTierPreset } from '@/types/api';

import { message } from 'antdv-next';
/**
 * 画质增强档位预设（管理端）。
 *
 * 每档只渲染后端白名单允许的控件（规则镜像见 presetRules.ts，后端 VideoEnhancePresetRules 为准）。
 * 留空 = 不设预设，由用户值或默认生效。保存是整表 PUT，四档一起提交。
 */
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getVideoEnhanceTierPresets,
  saveVideoEnhanceTierPresets,
} from '@/api/video-enhance-preset';

import {
  BIT_DEPTH_16_MAX_SECONDS,
  VIDEO_ENHANCE_TIERS,
  VIDEO_ENHANCE_TIER_RULES,
  allowedBitDepths,
  buildPresetPayload,
  pickTierPreset,
  validatePresetMap,
  type PresetIssue,
  type VideoEnhanceParam,
} from './preset-rules';

const { t } = useI18n();

/** 字段展示顺序（各档只显示其白名单内的字段） */
const FIELD_ORDER: VideoEnhanceParam[] = [
  'enhance_style',
  'scene',
  'codec',
  'bit_depth',
  'bitrate_level',
  'bitrate',
  'fps',
  'resolution_limit',
];

const ENUM_FIELDS: VideoEnhanceParam[] = [
  'enhance_style',
  'scene',
  'bitrate_level',
  'bit_depth',
  'codec',
];

const loading = ref(false);
const saving = ref(false);
const activeTab = ref<VideoEnhanceTier>('fast');

const form = reactive<Record<VideoEnhanceTier, VideoEnhanceTierPreset>>({
  fast: {},
  standard: {},
  professional: {},
  generative: {},
});

function rulesOf(tier: VideoEnhanceTier) {
  return VIDEO_ENHANCE_TIER_RULES[tier];
}

function supports(tier: VideoEnhanceTier, field: VideoEnhanceParam) {
  return rulesOf(tier).params.includes(field);
}

function isEnum(tier: VideoEnhanceTier, field: VideoEnhanceParam) {
  return ENUM_FIELDS.includes(field) && Boolean(rulesOf(tier).enums[field]);
}

function rangeOf(tier: VideoEnhanceTier, field: VideoEnhanceParam) {
  return rulesOf(tier).ranges[field];
}

function fieldValue(tier: VideoEnhanceTier, field: VideoEnhanceParam): string | number | undefined {
  return form[tier][field] as string | number | undefined;
}

function setField(tier: VideoEnhanceTier, field: VideoEnhanceParam, value: unknown) {
  (form[tier] as Record<string, unknown>)[field] = value === '' ? undefined : value;
}

/** 色深选项随本档已选编码收窄（编码与色深不合法的组合不给选） */
function enumOptions(tier: VideoEnhanceTier, field: VideoEnhanceParam) {
  const raw =
    field === 'bit_depth' ? allowedBitDepths(form[tier].codec) : (rulesOf(tier).enums[field] ?? []);
  return raw.map((value) => ({ value, label: optionLabel(field, value) }));
}

function optionLabel(field: VideoEnhanceParam, value: string | number) {
  if (field === 'bit_depth' || field === 'codec') {
    return String(value);
  }
  return t(`videoEnhancePresets.options.${field}.${value}`);
}

function helpOf(tier: VideoEnhanceTier, field: VideoEnhanceParam) {
  const range = rangeOf(tier, field);
  const parts: string[] = [];
  if (range) {
    parts.push(t('videoEnhancePresets.rangeHelp', { min: range.min, max: range.max }));
  }
  if (field === 'bit_depth') {
    parts.push(t('videoEnhancePresets.bitDepth16Help', { seconds: BIT_DEPTH_16_MAX_SECONDS }));
  }
  if (field === 'codec') {
    parts.push(t('videoEnhancePresets.codecHelp'));
  }
  return parts.join('；');
}

function issueText(tier: VideoEnhanceTier, issue: PresetIssue) {
  const field = t(`videoEnhancePresets.fields.${issue.field}`);
  const head = `${t(`videoEnhancePresets.tiers.${tier}`)} · ${field}`;
  switch (issue.reason) {
    case 'unsupported':
      return `${head}：${t('videoEnhancePresets.issue.unsupported')}`;
    case 'integer':
      return `${head}：${t('videoEnhancePresets.issue.integer')}`;
    case 'range':
      return `${head}：${t('videoEnhancePresets.issue.range', { min: issue.min, max: issue.max })}`;
    case 'enum':
      return `${head}：${t('videoEnhancePresets.issue.enum', { options: issue.options.join(' / ') })}`;
    case 'combination':
      return `${head}：${t('videoEnhancePresets.issue.combination', {
        codec: issue.codec,
        bitDepth: issue.bitDepth,
        allowed: issue.allowed.join(' / '),
      })}`;
  }
}

function applyServer(data: Partial<Record<VideoEnhanceTier, VideoEnhanceTierPreset>>) {
  for (const tier of VIDEO_ENHANCE_TIERS) {
    form[tier] = pickTierPreset(tier, data[tier]);
  }
}

async function load() {
  loading.value = true;
  try {
    applyServer(await getVideoEnhanceTierPresets());
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  // 前端只做体验层校验；后端整表重新校验，失败时其 msg 由拦截器提示
  const failed = validatePresetMap(form);
  if (failed.length > 0) {
    const first = failed[0];
    activeTab.value = first.tier;
    message.error(issueText(first.tier, first.issues[0]));
    return;
  }

  saving.value = true;
  try {
    const saved = await saveVideoEnhanceTierPresets(buildPresetPayload(form));
    applyServer(saved);
    message.success(t('common.saveSuccess'));
  } catch {
    /* 后端返回的 msg 已由拦截器提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
.settings-form {
  max-width: 520px;
}
.actions {
  margin-top: 16px;
}
</style>
