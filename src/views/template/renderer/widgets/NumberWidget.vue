<!-- src/views/template/renderer/widgets/NumberWidget.vue -->
<!--
  NumberWidget — 数字输入渲染器。

  value 形态：number（无值时为 null）。

  支持：min / max / step / precision / showButtons(controls) / unit(addonAfter 后缀)。

  双模式：
    - builder: 只读预览 (a-input-number 禁用)，isSelected 时高亮，不 emit。
    - viewer : 完全可交互，change 时 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="number-widget__header">
      <span class="number-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="number-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="number-widget__help" />
      </a-tooltip>
    </div>

    <a-input-number
      class="number-widget__input"
      :value="numberValue"
      :min="config.min"
      :max="config.max"
      :step="step"
      :precision="config.precision"
      :controls="config.showButtons !== false"
      :placeholder="config.placeholder"
      :disabled="isDisabled"
      :addon-after="config.unit || undefined"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { NumberWidgetConfig, RenderMode } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: NumberWidgetConfig;
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
  'number-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
]);

/** builder 永远只读；viewer 下尊重 widget 级 disabled */
const isDisabled = computed(() => props.mode === 'builder' || props.config.disabled === true);

const step = computed(() => props.config.step ?? 1);

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** 受控值：viewer 优先取表单值，否则回退默认值；归一化为 number | null */
const numberValue = computed<number | null>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key];
    if (fromForm !== undefined) return toNumber(fromForm);
  }
  return toNumber(props.config.defaultValue);
});

function onChange(value: number | string | null): void {
  if (props.mode !== 'viewer') return;
  emit('update:form-values', props.config.key, toNumber(value));
}
</script>

<style scoped>
.number-widget {
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

.number-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.number-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.number-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.number-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.number-widget__input {
  width: 100%;
}
</style>
