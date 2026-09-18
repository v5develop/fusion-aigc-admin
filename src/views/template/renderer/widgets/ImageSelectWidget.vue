<!-- src/views/template/renderer/widgets/ImageSelectWidget.vue -->
<!--
  ImageSelectWidget — 图片选择器渲染器（从预设图片选项中单选/多选）。

  value 形态：
    - mode==='single'   → string  (选中项 value)
    - mode==='multiple' → string[] (选中项 value 列表)

  双模式：
    - builder: 只读预览，isSelected 时高亮，不 emit。
    - viewer : 可交互，选中变更时 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="is-widget__header">
      <span class="is-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="is-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="is-widget__help" />
      </a-tooltip>
    </div>

    <div class="is-grid" :class="`cols-${config.columns || 3}`">
      <div
        v-for="opt in config.options"
        :key="opt.value"
        class="is-option"
        :class="{
          'is-selected': isOptionSelected(opt.value),
          'is-readonly': mode === 'builder',
          [`size-${config.imageSize || 'medium'}`]: true,
        }"
        @click="toggleOption(opt.value)"
      >
        <div class="is-option__image-wrapper">
          <img :src="opt.thumbnailUrl || opt.imageUrl" :alt="opt.label" class="is-option__image" />
          <span v-if="opt.badge" class="is-option__badge">{{ opt.badge }}</span>
          <div v-if="isOptionSelected(opt.value)" class="is-option__check">
            <Icon icon="antdv-next:CheckCircleOutlined" />
          </div>
        </div>
        <span v-if="config.showLabel !== false" class="is-option__label">
          {{ opt.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImageSelectWidgetConfig, RenderMode } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: ImageSelectWidgetConfig;
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

const isMultiple = computed(() => props.config.mode === 'multiple');

const rootClass = computed(() => [
  'is-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
]);

/** 当前选中值（viewer 取表单值，否则回退默认值） */
const rawValue = computed<unknown>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key];
    if (fromForm !== undefined) return fromForm;
  }
  return props.config.defaultValue;
});

const selectedValues = computed<string[]>(() => {
  const raw = rawValue.value;
  if (isMultiple.value) {
    return Array.isArray(raw) ? (raw as string[]) : [];
  }
  return typeof raw === 'string' && raw ? [raw] : [];
});

function isOptionSelected(value: string): boolean {
  return selectedValues.value.includes(value);
}

function toggleOption(value: string): void {
  if (props.mode !== 'viewer' || props.config.disabled) return;

  if (isMultiple.value) {
    const current = selectedValues.value;
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    emit('update:form-values', props.config.key, next);
  } else {
    emit('update:form-values', props.config.key, value);
  }
}
</script>

<style scoped>
.is-widget {
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

.is-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.is-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.is-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.is-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.is-grid {
  display: grid;
  gap: var(--spacing-sm);
}

.cols-2 {
  grid-template-columns: repeat(2, 1fr);
}
.cols-3 {
  grid-template-columns: repeat(3, 1fr);
}
.cols-4 {
  grid-template-columns: repeat(4, 1fr);
}
.cols-5 {
  grid-template-columns: repeat(5, 1fr);
}
.cols-6 {
  grid-template-columns: repeat(6, 1fr);
}

.is-option {
  cursor: pointer;
  border-radius: var(--radius-base);
  border: 2px solid var(--color-border-secondary);
  overflow: hidden;
  transition: all var(--duration-fast) ease;
  background: var(--color-bg-container);
}

.is-option.is-readonly {
  cursor: default;
}

.is-option:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card-hover);
}

.is-option.is-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.is-option__image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.is-option__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.is-option__badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  padding: 1px 6px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-xs);
}

.is-option__check {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--color-primary);
  font-size: 20px;
  background: #fff;
  border-radius: var(--radius-full);
  line-height: 1;
}

.is-option__label {
  display: block;
  text-align: center;
  padding: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
