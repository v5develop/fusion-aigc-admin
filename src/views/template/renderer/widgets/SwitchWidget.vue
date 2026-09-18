<!-- src/views/template/renderer/widgets/SwitchWidget.vue -->
<!--
  SwitchWidget — 开关渲染器。

  value 形态：
    - 选中   → config.checkedValue   (默认 true)
    - 未选中 → config.uncheckedValue (默认 false)
    类型由 config.checkedValue / config.uncheckedValue 决定 (默认 boolean)。

  双模式：
    - builder: 只读预览 (a-switch 禁用)，isSelected 时高亮，不 emit。
    - viewer : 完全可交互，change 时 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="switch-widget__header">
      <span class="switch-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="switch-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="switch-widget__help" />
      </a-tooltip>
    </div>

    <div class="switch-widget__control">
      <a-switch
        :checked="currentChecked"
        :disabled="isDisabled"
        :checked-children="config.checkedText"
        :un-checked-children="config.uncheckedText"
        @change="onChange"
      />
      <span v-if="stateText" class="switch-widget__state">
        {{ stateText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RenderMode, SwitchWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: SwitchWidgetConfig;
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
  'switch-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
]);

/** builder 永远只读；viewer 下尊重 widget 级 disabled */
const isDisabled = computed(() => props.mode === 'builder' || props.config.disabled === true);

/** 选中 / 未选中对应的业务值，默认 boolean true / false */
const checkedValue = computed<string | number | boolean>(() => props.config.checkedValue ?? true);
const uncheckedValue = computed<string | number | boolean>(
  () => props.config.uncheckedValue ?? false,
);

/** 原始值：viewer 优先取表单值，否则回退默认值 */
const rawValue = computed<unknown>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key];
    if (fromForm !== undefined) return fromForm;
  }
  return props.config.defaultValue;
});

/** 业务值反向映射为 a-switch 的 boolean 受控状态 */
const currentChecked = computed<boolean>(() => {
  const raw = rawValue.value;
  if (raw === checkedValue.value) return true;
  if (raw === uncheckedValue.value) return false;
  // 兜底：未匹配到任一映射值时按真值性判断
  return Boolean(raw);
});

/** 当前状态文本，优先使用选中/未选中文案 */
const stateText = computed<string>(() =>
  currentChecked.value ? (props.config.checkedText ?? '') : (props.config.uncheckedText ?? ''),
);

function onChange(checked: unknown): void {
  if (props.mode !== 'viewer') return;
  const next = checked === true ? checkedValue.value : uncheckedValue.value;
  emit('update:form-values', props.config.key, next);
}
</script>

<style scoped>
.switch-widget {
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

.switch-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.switch-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.switch-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.switch-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.switch-widget__control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.switch-widget__state {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}
</style>
