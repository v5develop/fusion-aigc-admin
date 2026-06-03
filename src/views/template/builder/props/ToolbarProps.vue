<!-- src/views/template/builder/props/ToolbarProps.vue -->
<!--
  ToolbarProps — toolbar 类型 widget 的特有字段编辑器。
  编辑 ToolbarWidgetConfig 特有字段：position、showLabel、iconSize、
  items(ToolbarItem[] 行增删/排序)。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="toolbar-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.toolbarPosition')">
      <a-select
        :value="widget.position ?? 'inline'"
        :options="positionOptions"
        @update:value="onUpdate('position', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.showLabel')">
      <a-switch
        :checked="widget.showLabel ?? true"
        size="small"
        @update:checked="onUpdate('showLabel', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.iconSize')">
      <a-select
        :value="widget.iconSize ?? 'medium'"
        :options="iconSizeOptions"
        @update:value="onUpdate('iconSize', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.toolbarItems')">
      <draggable
        v-if="items.length > 0"
        class="toolbar-props__list"
        :model-value="items"
        item-key="key"
        handle=".toolbar-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="toolbar-props__row">
            <span class="toolbar-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="toolbar-props__fields">
              <div class="toolbar-props__line">
                <a-input
                  :value="items[index].key"
                  placeholder="key"
                  allow-clear
                  @update:value="onItemUpdate(index, 'key', $event)"
                />
                <a-input
                  :value="items[index].label"
                  :placeholder="$t('template.buttonLabel')"
                  allow-clear
                  @update:value="onItemUpdate(index, 'label', $event)"
                />
              </div>
              <a-input
                :value="items[index].icon"
                :placeholder="$t('template.buttonIcon')"
                allow-clear
                @update:value="onItemUpdate(index, 'icon', $event)"
              />
              <a-checkbox
                :checked="items[index].active ?? false"
                @update:checked="onItemActive(index, $event)"
              >
                {{ $t('template.toolbarItemActive') }}
              </a-checkbox>
            </div>
            <a-button
              type="text"
              class="toolbar-props__remove"
              @click="onRemoveItem(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.selectOptionsEmpty')" :image="undefined" />

      <a-button block class="toolbar-props__add" @click="onAddItem">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addToolbarItem') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import draggable from 'vuedraggable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { ToolbarItem, ToolbarWidgetConfig } from '@/types/template-builder'

const props = defineProps<{
  widget: ToolbarWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

type Position = NonNullable<ToolbarWidgetConfig['position']>
type IconSize = NonNullable<ToolbarWidgetConfig['iconSize']>

const positionOptions: { label: string; value: Position }[] = [
  { label: 'Inline', value: 'inline' },
  { label: 'Fixed Bottom', value: 'fixed-bottom' },
]

const iconSizeOptions: { label: string; value: IconSize }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
]

const items = computed<ToolbarItem[]>(() => props.widget.items ?? [])

function onUpdate<K extends keyof ToolbarWidgetConfig>(
  field: K,
  value: ToolbarWidgetConfig[K],
): void {
  emit('update', { [field]: value })
}

function commitItems(next: ToolbarItem[]): void {
  emit('update', { items: next })
}

function onItemUpdate(
  index: number,
  field: 'key' | 'label' | 'icon',
  value: string,
): void {
  const next = items.value.map((item, i) =>
    i === index ? { ...item, [field]: value } : { ...item },
  )
  commitItems(next)
}

function onItemActive(index: number, checked: boolean): void {
  const next = items.value.map((item, i) => {
    if (i !== index) return { ...item }
    const updated: ToolbarItem = { ...item }
    if (checked) updated.active = true
    else delete updated.active
    return updated
  })
  commitItems(next)
}

function onRemoveItem(index: number): void {
  commitItems(items.value.filter((_, i) => i !== index))
}

function onAddItem(): void {
  commitItems([
    ...items.value.map((item) => ({ ...item })),
    { key: '', label: '', icon: 'antdv-next:AppstoreOutlined' },
  ])
}

function onReorder(next: ToolbarItem[]): void {
  commitItems(next.map((item) => ({ ...item })))
}
</script>

<style scoped>
.toolbar-props {
  display: flex;
  flex-direction: column;
}

.toolbar-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.toolbar-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.toolbar-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.toolbar-props__row:hover {
  border-color: var(--color-border);
}

.toolbar-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.toolbar-props__handle:active {
  cursor: grabbing;
}

.toolbar-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.toolbar-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.toolbar-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.toolbar-props__add {
  margin-top: var(--spacing-sm);
}
</style>
