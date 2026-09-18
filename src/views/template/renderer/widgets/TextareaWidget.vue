<!-- src/views/template/renderer/widgets/TextareaWidget.vue -->
<!--
  TextareaWidget — 多行文本输入渲染器。

  value 形态：string
  - builder 模式：禁用交互，仅作预览；isSelected 时高亮。
  - viewer 模式：完全可交互，值变化时 emit('update:form-values', config.key, value)。
-->
<template>
  <div class="widget-wrapper" :class="{ 'widget-selected': isSelected }">
    <label v-if="config.label" class="widget-label">
      <span class="widget-label-text">
        {{ config.label }}
        <span v-if="config.required" class="widget-required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon class="widget-help-icon" icon="antdv-next:QuestionCircleOutlined" />
      </a-tooltip>
    </label>

    <a-textarea
      :value="currentValue"
      :placeholder="config.placeholder"
      :maxlength="config.maxLength"
      :show-count="config.showCount"
      :auto-size="autoSize"
      :disabled="mode === 'builder'"
      :allow-clear="mode === 'viewer'"
      :class="config.className"
      class="widget-textarea"
      @update:value="onInput"
    />
  </div>
</template>

<script setup lang="ts">
import type { RenderMode, TextareaWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: TextareaWidgetConfig;
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

/**
 * a-textarea 的 auto-size：
 * - 配置了 minRows/maxRows 时，使用对象形式精确控制行数范围。
 * - 仅开启 autoSize 开关时，使用 boolean 形式自适应。
 * - 都未设置时返回 false，使用固定高度。
 */
const autoSize = computed<boolean | { minRows?: number; maxRows?: number }>(() => {
  const { minRows, maxRows, autoSize: enabled } = props.config;
  if (minRows != null || maxRows != null) {
    return { minRows, maxRows };
  }
  return enabled ?? false;
});

/** 当前值：viewer 优先读 formValues，回退 defaultValue；统一收窄为 string */
const currentValue = computed<string>(() => {
  const raw = props.formValues?.[props.config.key];
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof props.config.defaultValue === 'string') {
    return props.config.defaultValue;
  }
  return '';
});

/** viewer 模式下回写表单值；builder 模式只读，不 emit */
function onInput(value: string) {
  if (props.mode !== 'viewer') {
    return;
  }
  emit('update:form-values', props.config.key, value);
}
</script>

<style scoped>
.widget-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}

.widget-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.widget-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-base);
  color: var(--color-text-primary);
}

.widget-required {
  margin-left: 2px;
  color: var(--color-error);
}

.widget-help-icon {
  color: var(--color-text-tertiary);
  cursor: help;
}

.widget-textarea {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text-primary);
  border-radius: var(--radius-base);
}
</style>
