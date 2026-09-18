<!-- src/views/template/builder/props/ColorPickerProps.vue -->
<!--
  ColorPickerProps — color-picker 类型 widget 的特有字段编辑器。
  仅编辑 ColorPickerWidgetConfig 特有字段：presetColors（颜色字符串数组，行增删）、
  showAlpha（布尔）、format（hex/rgb/hsl 下拉）。公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="color-picker-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.colorFormat')">
      <a-select
        :value="widget.format ?? 'hex'"
        :options="formatOptions"
        @update:value="onUpdate('format', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.colorShowAlpha')">
      <a-switch
        :checked="widget.showAlpha ?? false"
        size="small"
        @update:checked="onUpdate('showAlpha', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.colorPresetColors')">
      <div v-if="presetColors.length > 0" class="color-picker-props__list">
        <div v-for="(color, index) in presetColors" :key="index" class="color-picker-props__row">
          <span class="color-picker-props__swatch" :style="{ background: color }" />
          <a-input
            :value="color"
            placeholder="#1677ff"
            allow-clear
            @update:value="onColorUpdate(index, $event)"
          />
          <a-button type="text" class="color-picker-props__remove" @click="onRemoveColor(index)">
            <Icon icon="antdv-next:DeleteOutlined" />
          </a-button>
        </div>
      </div>
      <a-empty v-else :description="$t('template.colorPresetEmpty')" :image="undefined" />

      <a-button block class="color-picker-props__add" @click="onAddColor">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.colorAddPreset') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { ColorPickerWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = defineProps<{
  widget: ColorPickerWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

type ColorFormat = NonNullable<ColorPickerWidgetConfig['format']>;

const formatOptions: { label: string; value: ColorFormat }[] = [
  { label: 'HEX', value: 'hex' },
  { label: 'RGB', value: 'rgb' },
  { label: 'HSL', value: 'hsl' },
];

const presetColors = computed<string[]>(() => props.widget.presetColors ?? []);

function onUpdate<K extends keyof ColorPickerWidgetConfig>(
  field: K,
  value: ColorPickerWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function commitColors(next: string[]): void {
  emit('update', { presetColors: next.length === 0 ? undefined : next });
}

function onColorUpdate(index: number, value: string): void {
  const next = presetColors.value.map((c, i) => (i === index ? value : c));
  commitColors(next);
}

function onRemoveColor(index: number): void {
  commitColors(presetColors.value.filter((_, i) => i !== index));
}

function onAddColor(): void {
  commitColors([...presetColors.value, '#1677ff']);
}
</script>

<style scoped>
.color-picker-props {
  display: flex;
  flex-direction: column;
}

.color-picker-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.color-picker-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.color-picker-props__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.color-picker-props__swatch {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.color-picker-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.color-picker-props__add {
  margin-top: var(--spacing-sm);
}
</style>
