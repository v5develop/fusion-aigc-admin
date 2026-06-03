<!-- src/views/template/builder/props/ImageSelectProps.vue -->
<!--
  ImageSelectProps — image-select widget 的特有字段编辑器。

  编辑字段：options (ImageSelectOption[]，可加减/拖拽排序，每项含
            label/value/imageUrl/thumbnailUrl?/description?/badge?) /
            mode (single|multiple) / columns / imageSize (small|medium|large) /
            showLabel。

  公共字段 (key/label/placeholder/required/helpText 等) 由 CommonProps 负责，
  此处不重复。数据流：任意字段变化即 emit('update', { 字段: 新值 })；数组字段
  基于 props.widget.options 复制后整体回传，不直接 mutate props。
-->
<template>
  <a-form class="image-select-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.imageSelectMode')">
      <a-select
        :value="widget.mode ?? 'single'"
        :options="modeOptions"
        @update:value="onUpdate('mode', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.imageSelectImageSize')">
      <a-select
        :value="widget.imageSize ?? 'medium'"
        :options="imageSizeOptions"
        @update:value="onUpdate('imageSize', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.imageSelectColumns')">
      <a-input-number
        class="image-select-props__number"
        :value="widget.columns"
        :min="1"
        :max="8"
        :step="1"
        :placeholder="$t('template.imageSelectColumnsHint')"
        @update:value="onColumnsUpdate"
      />
    </a-form-item>

    <a-form-item :label="$t('template.imageSelectShowLabel')">
      <a-switch
        :checked="widget.showLabel !== false"
        size="small"
        @update:checked="onUpdate('showLabel', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.imageSelectOptions')">
      <draggable
        v-if="widget.options.length > 0"
        class="image-select-props__list"
        :model-value="widget.options"
        item-key="value"
        handle=".image-select-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="image-select-props__row">
            <span class="image-select-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="image-select-props__fields">
              <div class="image-select-props__line">
                <a-input
                  :value="widget.options[index].label"
                  :placeholder="$t('template.imageSelectOptionLabel')"
                  allow-clear
                  @update:value="onOptionUpdate(index, 'label', $event)"
                />
                <a-input
                  :value="widget.options[index].value"
                  :placeholder="$t('template.imageSelectOptionValue')"
                  allow-clear
                  @update:value="onOptionUpdate(index, 'value', $event)"
                />
              </div>
              <a-input
                :value="widget.options[index].imageUrl"
                :placeholder="$t('template.imageSelectOptionImageUrl')"
                allow-clear
                @update:value="onOptionUpdate(index, 'imageUrl', $event)"
              />
              <a-input
                :value="widget.options[index].thumbnailUrl"
                :placeholder="$t('template.imageSelectOptionThumbnailUrl')"
                allow-clear
                @update:value="onOptionUpdate(index, 'thumbnailUrl', $event)"
              />
              <a-input
                :value="widget.options[index].description"
                :placeholder="$t('template.imageSelectOptionDescription')"
                allow-clear
                @update:value="onOptionUpdate(index, 'description', $event)"
              />
              <a-input
                :value="widget.options[index].badge"
                :placeholder="$t('template.imageSelectOptionBadge')"
                allow-clear
                @update:value="onOptionUpdate(index, 'badge', $event)"
              />
            </div>
            <a-button
              type="text"
              class="image-select-props__remove"
              @click="onRemoveOption(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty
        v-else
        :description="$t('template.imageSelectOptionsEmpty')"
        :image="undefined"
      />

      <a-button block class="image-select-props__add" @click="onAddOption">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.imageSelectAddOption') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type {
  ImageSelectOption,
  ImageSelectWidgetConfig,
} from '@/types/template-builder'

const props = defineProps<{
  widget: ImageSelectWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

type ImageSelectMode = NonNullable<ImageSelectWidgetConfig['mode']>
type ImageSelectImageSize = NonNullable<ImageSelectWidgetConfig['imageSize']>

const modeOptions: { label: string; value: ImageSelectMode }[] = [
  { label: $t('template.imageSelectModeSingle'), value: 'single' },
  { label: $t('template.imageSelectModeMultiple'), value: 'multiple' },
]

const imageSizeOptions: { label: string; value: ImageSelectImageSize }[] = [
  { label: $t('template.imageSelectSizeSmall'), value: 'small' },
  { label: $t('template.imageSelectSizeMedium'), value: 'medium' },
  { label: $t('template.imageSelectSizeLarge'), value: 'large' },
]

/** 可选文本字段：清空回传 undefined，避免落地空串 */
type OptionalOptionField = 'thumbnailUrl' | 'description' | 'badge'
const OPTIONAL_FIELDS: ReadonlySet<OptionalOptionField> = new Set([
  'thumbnailUrl',
  'description',
  'badge',
])

function onUpdate<K extends keyof ImageSelectWidgetConfig>(
  field: K,
  value: ImageSelectWidgetConfig[K],
): void {
  emit('update', { [field]: value })
}

function onColumnsUpdate(value: number | string | null): void {
  if (value === null || value === '') {
    onUpdate('columns', undefined)
    return
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return
  onUpdate('columns', num)
}

function isOptionalField(field: keyof ImageSelectOption): field is OptionalOptionField {
  return OPTIONAL_FIELDS.has(field as OptionalOptionField)
}

function onOptionUpdate(
  index: number,
  field: keyof ImageSelectOption,
  value: string,
): void {
  const next = props.widget.options.map((opt, i) => {
    if (i !== index) return { ...opt }
    const updated: ImageSelectOption = { ...opt }
    if (isOptionalField(field)) {
      if (value === '') delete updated[field]
      else updated[field] = value
    } else {
      updated[field] = value
    }
    return updated
  })
  onUpdate('options', next)
}

function onRemoveOption(index: number): void {
  const next = props.widget.options.filter((_, i) => i !== index)
  onUpdate('options', next)
}

function onAddOption(): void {
  const next: ImageSelectOption[] = [
    ...props.widget.options.map((opt) => ({ ...opt })),
    { label: '', value: '', imageUrl: '' },
  ]
  onUpdate('options', next)
}

function onReorder(next: ImageSelectOption[]): void {
  onUpdate(
    'options',
    next.map((opt) => ({ ...opt })),
  )
}
</script>

<style scoped>
.image-select-props {
  display: flex;
  flex-direction: column;
}

.image-select-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.image-select-props__number {
  width: 100%;
}

.image-select-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.image-select-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.image-select-props__row:hover {
  border-color: var(--color-border);
}

.image-select-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.image-select-props__handle:active {
  cursor: grabbing;
}

.image-select-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.image-select-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.image-select-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.image-select-props__add {
  margin-top: var(--spacing-sm);
}
</style>
