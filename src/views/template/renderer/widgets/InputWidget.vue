<!-- src/views/template/renderer/widgets/InputWidget.vue -->
<!--
  InputWidget — 单行文本输入渲染器。

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

    <a-input
      :value="currentValue"
      :type="inputType"
      :placeholder="config.placeholder"
      :maxlength="config.maxLength"
      :minlength="config.minLength"
      :disabled="mode === 'builder'"
      :allow-clear="mode === 'viewer'"
      :class="config.className"
      class="widget-input"
      @update:value="onInput"
    >
      <template v-if="config.prefixIcon" #prefix>
        <Icon class="widget-input-prefix" :icon="config.prefixIcon" />
      </template>
      <template v-if="config.suffix" #suffix>
        <span class="widget-input-suffix">{{ config.suffix }}</span>
      </template>
    </a-input>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon/index.vue'
import type { InputWidgetConfig, RenderMode } from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: InputWidgetConfig
    mode: RenderMode
    formValues?: Record<string, unknown>
    isSelected?: boolean
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
)

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void
}>()

/** 输入框原生 type，仅限 InputWidgetConfig 允许的取值 */
const inputType = computed<'text' | 'password' | 'email' | 'url'>(
  () => props.config.inputType ?? 'text',
)

/** 当前值：viewer 优先读 formValues，回退 defaultValue；统一收窄为 string */
const currentValue = computed<string>(() => {
  const raw = props.formValues?.[props.config.key]
  if (typeof raw === 'string') {
    return raw
  }
  if (typeof props.config.defaultValue === 'string') {
    return props.config.defaultValue
  }
  return ''
})

/** viewer 模式下回写表单值；builder 模式只读，不 emit */
function onInput(value: string) {
  if (props.mode !== 'viewer') {
    return
  }
  emit('update:form-values', props.config.key, value)
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

.widget-input-prefix {
  color: var(--color-text-tertiary);
}

.widget-input-suffix {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}
</style>
