<!-- src/views/template/builder/props/TextareaProps.vue -->
<!--
  TextareaProps — textarea 类型 widget 的特有字段编辑器。
  仅编辑 TextareaWidgetConfig 特有字段：minRows/maxRows/maxLength（数值，清空回 undefined）、
  autoSize/showCount（布尔）。公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="textarea-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.textareaMinRows')">
      <a-input-number
        class="textarea-props__number"
        :value="widget.minRows"
        :min="1"
        @update:value="onUpdateNumber('minRows', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.textareaMaxRows')">
      <a-input-number
        class="textarea-props__number"
        :value="widget.maxRows"
        :min="1"
        @update:value="onUpdateNumber('maxRows', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.textareaMaxLength')">
      <a-input-number
        class="textarea-props__number"
        :value="widget.maxLength"
        :min="0"
        @update:value="onUpdateNumber('maxLength', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.textareaAutoSize')">
      <a-switch
        :checked="widget.autoSize ?? false"
        size="small"
        @update:checked="onUpdate('autoSize', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.textareaShowCount')">
      <a-switch
        :checked="widget.showCount ?? false"
        size="small"
        @update:checked="onUpdate('showCount', $event)"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { TextareaWidgetConfig } from '@/types/template-builder';

import { $t } from '@/locales';

const props = defineProps<{
  widget: TextareaWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

function onUpdate<K extends keyof TextareaWidgetConfig>(
  field: K,
  value: TextareaWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function onUpdateNumber(field: 'minRows' | 'maxRows' | 'maxLength', value: number | null): void {
  emit('update', { [field]: value === null ? undefined : value });
}
</script>

<style scoped>
.textarea-props {
  display: flex;
  flex-direction: column;
}

.textarea-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.textarea-props__number {
  width: 100%;
}
</style>
