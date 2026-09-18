<!-- src/views/template/builder/props/SelectProps.vue -->
<!--
  SelectProps — select 类型 widget 的特有字段编辑器。
  编辑 SelectWidgetConfig 特有字段：options(SelectOption[] 行增删/排序)、
  multiple/showSearch/allowClear（布尔）、tagRenderMode(default/chip 下拉)。
  公共字段由 CommonProps 负责；数组字段基于 props.widget.options 复制后整体回传。
-->
<template>
  <a-form class="select-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.selectMultiple')">
      <a-switch
        :checked="widget.multiple ?? false"
        size="small"
        @update:checked="onUpdate('multiple', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.selectShowSearch')">
      <a-switch
        :checked="widget.showSearch ?? false"
        size="small"
        @update:checked="onUpdate('showSearch', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.selectAllowClear')">
      <a-switch
        :checked="widget.allowClear ?? false"
        size="small"
        @update:checked="onUpdate('allowClear', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.selectTagRenderMode')">
      <a-select
        :value="widget.tagRenderMode ?? 'default'"
        :options="tagRenderModeOptions"
        @update:value="onUpdate('tagRenderMode', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.selectOptions')">
      <draggable
        v-if="options.length > 0"
        class="select-props__list"
        :model-value="options"
        item-key="value"
        handle=".select-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="select-props__row">
            <span class="select-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="select-props__fields">
              <div class="select-props__line">
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
                :value="options[index].icon"
                :placeholder="$t('template.selectOptionIcon')"
                allow-clear
                @update:value="onOptionUpdate(index, 'icon', $event)"
              />
              <a-input
                :value="options[index].description"
                :placeholder="$t('template.selectOptionDescription')"
                allow-clear
                @update:value="onOptionUpdate(index, 'description', $event)"
              />
              <a-checkbox
                :checked="options[index].disabled ?? false"
                @update:checked="onOptionDisabled(index, $event)"
              >
                {{ $t('template.selectOptionDisabled') }}
              </a-checkbox>
            </div>
            <a-button type="text" class="select-props__remove" @click="onRemoveOption(index)">
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.selectOptionsEmpty')" :image="undefined" />

      <a-button block class="select-props__add" @click="onAddOption">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.selectAddOption') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { SelectOption, SelectWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';
import draggable from 'vuedraggable';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = defineProps<{
  widget: SelectWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

type TagRenderMode = NonNullable<SelectWidgetConfig['tagRenderMode']>;

const tagRenderModeOptions: { label: string; value: TagRenderMode }[] = [
  { label: $t('template.selectTagDefault'), value: 'default' },
  { label: $t('template.selectTagChip'), value: 'chip' },
];

const options = computed<SelectOption[]>(() => props.widget.options ?? []);

type OptionalField = 'icon' | 'description';
const OPTIONAL_FIELDS: ReadonlySet<OptionalField> = new Set(['icon', 'description']);

function onUpdate<K extends keyof SelectWidgetConfig>(
  field: K,
  value: SelectWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function commitOptions(next: SelectOption[]): void {
  emit('update', { options: next });
}

function isOptional(field: keyof SelectOption): field is OptionalField {
  return OPTIONAL_FIELDS.has(field as OptionalField);
}

function onOptionUpdate(
  index: number,
  field: 'label' | 'value' | 'icon' | 'description',
  value: string,
): void {
  const next = options.value.map((opt, i) => {
    if (i !== index) return { ...opt };
    const updated: SelectOption = { ...opt };
    if (isOptional(field)) {
      if (value === '') delete updated[field];
      else updated[field] = value;
    } else {
      updated[field] = value;
    }
    return updated;
  });
  commitOptions(next);
}

function onOptionDisabled(index: number, checked: boolean): void {
  const next = options.value.map((opt, i) => {
    if (i !== index) return { ...opt };
    const updated: SelectOption = { ...opt };
    if (checked) updated.disabled = true;
    else delete updated.disabled;
    return updated;
  });
  commitOptions(next);
}

function onRemoveOption(index: number): void {
  commitOptions(options.value.filter((_, i) => i !== index));
}

function onAddOption(): void {
  commitOptions([...options.value.map((o) => ({ ...o })), { label: '', value: '' }]);
}

function onReorder(next: SelectOption[]): void {
  commitOptions(next.map((o) => ({ ...o })));
}
</script>

<style scoped>
.select-props {
  display: flex;
  flex-direction: column;
}

.select-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.select-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.select-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.select-props__row:hover {
  border-color: var(--color-border);
}

.select-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.select-props__handle:active {
  cursor: grabbing;
}

.select-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.select-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.select-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.select-props__add {
  margin-top: var(--spacing-sm);
}
</style>
