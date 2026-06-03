<!-- src/views/template/builder/props/RadioImageProps.vue -->
<!--
  RadioImageProps — radio-image 类型 widget 的特有字段编辑器。
  编辑 RadioImageWidgetConfig 特有字段：columns、imageSize、showCheckmark、
  options(RadioImageOption[] 行增删/排序)。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="radio-image-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.columns')">
      <a-input-number
        :value="widget.columns ?? 3"
        :min="1"
        :max="6"
        style="width: 100%"
        @update:value="onUpdate('columns', toNumber($event, 3))"
      />
    </a-form-item>

    <a-form-item :label="$t('template.imageSize')">
      <a-select
        :value="widget.imageSize ?? 'medium'"
        :options="imageSizeOptions"
        @update:value="onUpdate('imageSize', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.showCheckmark')">
      <a-switch
        :checked="widget.showCheckmark ?? true"
        size="small"
        @update:checked="onUpdate('showCheckmark', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.imageOptions')">
      <draggable
        v-if="options.length > 0"
        class="radio-image-props__list"
        :model-value="options"
        item-key="value"
        handle=".radio-image-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="radio-image-props__row">
            <span class="radio-image-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="radio-image-props__fields">
              <div class="radio-image-props__line">
                <a-input
                  :value="options[index].label"
                  :placeholder="$t('template.selectOptionLabel')"
                  allow-clear
                  @update:value="onOptionUpdate(index, 'label', $event)"
                />
                <a-input
                  :value="options[index].value"
                  :placeholder="$t('template.selectOptionValue')"
                  allow-clear
                  @update:value="onOptionUpdate(index, 'value', $event)"
                />
              </div>
              <a-input
                :value="options[index].imageUrl"
                placeholder="image URL"
                allow-clear
                @update:value="onOptionUpdate(index, 'imageUrl', $event)"
              />
              <a-input
                :value="options[index].previewUrl"
                placeholder="preview URL (hover)"
                allow-clear
                @update:value="onOptionUpdate(index, 'previewUrl', $event)"
              />
            </div>
            <a-button
              type="text"
              class="radio-image-props__remove"
              @click="onRemoveOption(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.selectOptionsEmpty')" :image="undefined" />

      <a-button block class="radio-image-props__add" @click="onAddOption">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addImageOption') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import draggable from 'vuedraggable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { RadioImageOption, RadioImageWidgetConfig } from '@/types/template-builder'

const props = defineProps<{
  widget: RadioImageWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

type ImageSize = NonNullable<RadioImageWidgetConfig['imageSize']>

const imageSizeOptions: { label: string; value: ImageSize }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
]

const options = computed<RadioImageOption[]>(() => props.widget.options ?? [])

type OptionalField = 'previewUrl' | 'thumbnailUrl' | 'description'
const OPTIONAL_FIELDS: ReadonlySet<OptionalField> = new Set([
  'previewUrl',
  'thumbnailUrl',
  'description',
])

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function onUpdate<K extends keyof RadioImageWidgetConfig>(
  field: K,
  value: RadioImageWidgetConfig[K],
): void {
  emit('update', { [field]: value })
}

function commitOptions(next: RadioImageOption[]): void {
  emit('update', { options: next })
}

function isOptional(field: keyof RadioImageOption): field is OptionalField {
  return OPTIONAL_FIELDS.has(field as OptionalField)
}

function onOptionUpdate(
  index: number,
  field: 'label' | 'value' | 'imageUrl' | 'previewUrl',
  value: string,
): void {
  const next = options.value.map((opt, i) => {
    if (i !== index) return { ...opt }
    const updated: RadioImageOption = { ...opt }
    if (isOptional(field)) {
      if (value === '') delete updated[field]
      else updated[field] = value
    } else {
      updated[field] = value
    }
    return updated
  })
  commitOptions(next)
}

function onRemoveOption(index: number): void {
  commitOptions(options.value.filter((_, i) => i !== index))
}

function onAddOption(): void {
  commitOptions([
    ...options.value.map((o) => ({ ...o })),
    { label: '', value: '', imageUrl: '' },
  ])
}

function onReorder(next: RadioImageOption[]): void {
  commitOptions(next.map((o) => ({ ...o })))
}
</script>

<style scoped>
.radio-image-props {
  display: flex;
  flex-direction: column;
}

.radio-image-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.radio-image-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.radio-image-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.radio-image-props__row:hover {
  border-color: var(--color-border);
}

.radio-image-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.radio-image-props__handle:active {
  cursor: grabbing;
}

.radio-image-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.radio-image-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.radio-image-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.radio-image-props__add {
  margin-top: var(--spacing-sm);
}
</style>
