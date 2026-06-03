<!-- src/views/template/builder/props/ChipInputProps.vue -->
<!--
  ChipInputProps — chip-input 类型 widget 的特有字段编辑器。
  编辑 ChipInputWidgetConfig 特有字段：minHeight、maxLength、allowCustomInput、
  customKeyPrefix、chipTheme、removable、promptHint、maxChips、
  presetChips(ChipOption[] 行增删/排序)。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="chip-input-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.chipPromptHint')">
      <a-input
        :value="widget.promptHint"
        allow-clear
        @update:value="onUpdate('promptHint', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.chipMinHeight')">
      <a-input-number
        :value="widget.minHeight ?? 120"
        :min="40"
        :max="400"
        :step="10"
        style="width: 100%"
        @update:value="onUpdate('minHeight', toNumber($event, 120))"
      />
    </a-form-item>

    <a-form-item :label="$t('template.maxChips')">
      <a-input-number
        :value="widget.maxChips ?? 0"
        :min="0"
        :max="50"
        style="width: 100%"
        @update:value="onUpdate('maxChips', toNumber($event, 0))"
      />
    </a-form-item>

    <a-form-item :label="$t('template.chipTheme')">
      <a-select
        :value="widget.chipTheme ?? 'default'"
        :options="chipThemeOptions"
        @update:value="onUpdate('chipTheme', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.allowCustomInput')">
      <a-switch
        :checked="widget.allowCustomInput ?? true"
        size="small"
        @update:checked="onUpdate('allowCustomInput', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.chipRemovable')">
      <a-switch
        :checked="widget.removable ?? true"
        size="small"
        @update:checked="onUpdate('removable', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.presetChips')">
      <draggable
        v-if="presetChips.length > 0"
        class="chip-input-props__list"
        :model-value="presetChips"
        item-key="key"
        handle=".chip-input-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="chip-input-props__row">
            <span class="chip-input-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="chip-input-props__fields">
              <div class="chip-input-props__line">
                <a-input
                  :value="presetChips[index].key"
                  placeholder="key"
                  allow-clear
                  @update:value="onChipUpdate(index, 'key', $event)"
                />
                <a-input
                  :value="presetChips[index].label"
                  :placeholder="$t('template.buttonLabel')"
                  allow-clear
                  @update:value="onChipUpdate(index, 'label', $event)"
                />
              </div>
              <a-input
                :value="presetChips[index].insertText"
                :placeholder="$t('template.chipInsertText')"
                allow-clear
                @update:value="onChipUpdate(index, 'insertText', $event)"
              />
            </div>
            <a-button
              type="text"
              class="chip-input-props__remove"
              @click="onRemoveChip(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.selectOptionsEmpty')" :image="undefined" />

      <a-button block class="chip-input-props__add" @click="onAddChip">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addPresetChip') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import draggable from 'vuedraggable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { ChipInputWidgetConfig, ChipOption } from '@/types/template-builder'

const props = defineProps<{
  widget: ChipInputWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

type ChipTheme = NonNullable<ChipInputWidgetConfig['chipTheme']>

const chipThemeOptions: { label: string; value: ChipTheme }[] = [
  { label: 'Default', value: 'default' },
  { label: 'Colorful', value: 'colorful' },
  { label: 'Outlined', value: 'outlined' },
]

const presetChips = computed<ChipOption[]>(() => props.widget.presetChips ?? [])

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function onUpdate<K extends keyof ChipInputWidgetConfig>(
  field: K,
  value: ChipInputWidgetConfig[K],
): void {
  emit('update', { [field]: value })
}

function commitChips(next: ChipOption[]): void {
  emit('update', { presetChips: next })
}

function onChipUpdate(
  index: number,
  field: 'key' | 'label' | 'insertText',
  value: string,
): void {
  const next = presetChips.value.map((chip, i) => {
    if (i !== index) return { ...chip }
    const updated: ChipOption = { ...chip }
    if (field === 'insertText') {
      if (value === '') delete updated.insertText
      else updated.insertText = value
    } else {
      updated[field] = value
    }
    return updated
  })
  commitChips(next)
}

function onRemoveChip(index: number): void {
  commitChips(presetChips.value.filter((_, i) => i !== index))
}

function onAddChip(): void {
  commitChips([...presetChips.value.map((c) => ({ ...c })), { key: '', label: '' }])
}

function onReorder(next: ChipOption[]): void {
  commitChips(next.map((c) => ({ ...c })))
}
</script>

<style scoped>
.chip-input-props {
  display: flex;
  flex-direction: column;
}

.chip-input-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.chip-input-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.chip-input-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.chip-input-props__row:hover {
  border-color: var(--color-border);
}

.chip-input-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.chip-input-props__handle:active {
  cursor: grabbing;
}

.chip-input-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.chip-input-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.chip-input-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.chip-input-props__add {
  margin-top: var(--spacing-sm);
}
</style>
