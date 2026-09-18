<!-- src/views/template/renderer/widgets/SliderWidget.vue -->
<!--
  SliderWidget — 滑块渲染器。

  value 形态：
    - 单值 (range=false)  → number
    - 范围 (range=true)   → [number, number]

  双模式：
    - builder: 只读预览 (a-slider / a-input-number 禁用)，isSelected 时高亮，不 emit。
    - viewer : 完全可交互，change 时 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="slider-widget__header">
      <span class="slider-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="slider-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="slider-widget__help" />
      </a-tooltip>
    </div>

    <div class="slider-widget__control">
      <a-slider
        class="slider-widget__slider"
        :value="sliderValue"
        :range="isRange"
        :min="min"
        :max="max"
        :step="step"
        :marks="config.marks"
        :disabled="isDisabled"
        @change="onSliderChange"
      />

      <template v-if="config.showInput">
        <div v-if="isRange" class="slider-widget__inputs">
          <a-input-number
            class="slider-widget__input"
            :value="rangeValue[0]"
            :min="min"
            :max="rangeValue[1]"
            :step="step"
            :disabled="isDisabled"
            @change="onRangeMinChange"
          />
          <span class="slider-widget__separator">~</span>
          <a-input-number
            class="slider-widget__input"
            :value="rangeValue[1]"
            :min="rangeValue[0]"
            :max="max"
            :step="step"
            :disabled="isDisabled"
            @change="onRangeMaxChange"
          />
        </div>
        <a-input-number
          v-else
          class="slider-widget__input"
          :value="singleValue"
          :min="min"
          :max="max"
          :step="step"
          :disabled="isDisabled"
          @change="onSingleInputChange"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RenderMode, SliderWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: SliderWidgetConfig;
    mode: RenderMode;
    formValues?: Record<string, unknown>;
    isSelected?: boolean;
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
);

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void;
}>();

const rootClass = computed(() => [
  'slider-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
]);

/** builder 永远只读；viewer 下尊重 widget 级 disabled */
const isDisabled = computed(() => props.mode === 'builder' || props.config.disabled === true);

const isRange = computed(() => props.config.range === true);

const min = computed(() => props.config.min ?? 0);
const max = computed(() => props.config.max ?? 100);
const step = computed(() => props.config.step ?? 1);

/** 原始值：viewer 优先取表单值，否则回退默认值 */
const rawValue = computed<unknown>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key];
    if (fromForm !== undefined) return fromForm;
  }
  return props.config.defaultValue;
});

/** 将任意输入夹紧到 [min, max] 区间 */
function clamp(value: number): number {
  return Math.min(Math.max(value, min.value), max.value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 单值受控值 */
const singleValue = computed<number>(() => clamp(toNumber(rawValue.value, min.value)));

/** 范围受控值，归一化为 [number, number] */
const rangeValue = computed<[number, number]>(() => {
  const raw = rawValue.value;
  if (Array.isArray(raw)) {
    const lo = clamp(toNumber(raw[0], min.value));
    const hi = clamp(toNumber(raw[1], max.value));
    return lo <= hi ? [lo, hi] : [hi, lo];
  }
  return [min.value, max.value];
});

/** a-slider 受控值：range 模式给数组，单值模式给数字 */
const sliderValue = computed<number | [number, number]>(() =>
  isRange.value ? rangeValue.value : singleValue.value,
);

function emitValue(value: number | [number, number]): void {
  if (props.mode !== 'viewer') return;
  emit('update:form-values', props.config.key, value);
}

function onSliderChange(value: number | [number, number]): void {
  emitValue(value);
}

function onSingleInputChange(value: number | string | null): void {
  emitValue(clamp(toNumber(typeof value === 'string' ? Number(value) : value, min.value)));
}

function onRangeMinChange(value: number | string | null): void {
  const lo = clamp(toNumber(typeof value === 'string' ? Number(value) : value, min.value));
  const hi = rangeValue.value[1];
  emitValue([Math.min(lo, hi), hi]);
}

function onRangeMaxChange(value: number | string | null): void {
  const hi = clamp(toNumber(typeof value === 'string' ? Number(value) : value, max.value));
  const lo = rangeValue.value[0];
  emitValue([lo, Math.max(hi, lo)]);
}
</script>

<style scoped>
.slider-widget {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  font-family: var(--font-family);
}

.widget-wrapper {
  border-radius: var(--radius-base);
  transition: box-shadow var(--duration-fast) ease;
}

.widget-selected {
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.slider-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.slider-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.slider-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.slider-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.slider-widget__control {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  width: 100%;
}

.slider-widget__slider {
  flex: 1 1 auto;
  min-width: 0;
}

.slider-widget__inputs {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: none;
}

.slider-widget__separator {
  color: var(--color-text-tertiary);
}

.slider-widget__input {
  flex: none;
  width: 88px;
}
</style>
