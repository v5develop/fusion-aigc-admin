<!-- src/views/template/builder/props/NumberProps.vue -->
<!--
  NumberProps — number 类型 widget 的特有字段编辑器。
  仅编辑 NumberWidgetConfig 特有字段：min/max/step/precision（数值，清空回 undefined）、
  unit（文本，清空回 undefined）、showButtons（布尔）。公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="number-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.numberMin')">
      <a-input-number
        class="number-props__number"
        :value="widget.min"
        @update:value="onUpdateNumber('min', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.numberMax')">
      <a-input-number
        class="number-props__number"
        :value="widget.max"
        @update:value="onUpdateNumber('max', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.numberStep')">
      <a-input-number
        class="number-props__number"
        :value="widget.step"
        :min="0"
        @update:value="onUpdateNumber('step', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.numberPrecision')">
      <a-input-number
        class="number-props__number"
        :value="widget.precision"
        :min="0"
        @update:value="onUpdateNumber('precision', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.numberUnit')">
      <a-input :value="widget.unit" allow-clear @update:value="onUpdateText('unit', $event)" />
    </a-form-item>

    <a-form-item :label="$t('template.numberShowButtons')">
      <a-switch
        :checked="widget.showButtons ?? false"
        size="small"
        @update:checked="onUpdate('showButtons', $event)"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { NumberWidgetConfig } from '@/types/template-builder';

import { $t } from '@/locales';

const props = defineProps<{
  widget: NumberWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

function onUpdate<K extends keyof NumberWidgetConfig>(
  field: K,
  value: NumberWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function onUpdateNumber(field: 'min' | 'max' | 'step' | 'precision', value: number | null): void {
  emit('update', { [field]: value === null ? undefined : value });
}

function onUpdateText(field: 'unit', value: string): void {
  emit('update', { [field]: value.length === 0 ? undefined : value });
}
</script>

<style scoped>
.number-props {
  display: flex;
  flex-direction: column;
}

.number-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.number-props__number {
  width: 100%;
}
</style>
