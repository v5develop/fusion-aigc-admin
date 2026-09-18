<!-- src/views/template/builder/props/ActionButtonsProps.vue -->
<!--
  ActionButtonsProps — action-buttons 类型 widget 的特有字段编辑器。
  编辑 ActionButtonsWidgetConfig 特有字段：direction、buttonStyle、buttonSize、
  block、columns、onClickAction、buttons(ActionButton[] 行增删/排序)。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="action-buttons-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.actionDirection')">
      <a-select
        :value="widget.direction ?? 'horizontal'"
        :options="directionOptions"
        @update:value="onUpdate('direction', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.buttonStyle')">
      <a-select
        :value="widget.buttonStyle ?? 'outlined'"
        :options="buttonStyleOptions"
        @update:value="onUpdate('buttonStyle', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.actionButtonSize')">
      <a-select
        :value="widget.buttonSize ?? 'medium'"
        :options="buttonSizeOptions"
        @update:value="onUpdate('buttonSize', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.columns')">
      <a-input-number
        :value="widget.columns ?? 0"
        :min="0"
        :max="6"
        style="width: 100%"
        @update:value="onUpdate('columns', toNumber($event, 0))"
      />
    </a-form-item>

    <a-form-item :label="$t('template.actionBlock')">
      <a-switch
        :checked="widget.block ?? false"
        size="small"
        @update:checked="onUpdate('block', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.actionOnClick')">
      <a-select
        :value="widget.onClickAction ?? 'fill-prompt'"
        :options="onClickOptions"
        @update:value="onUpdate('onClickAction', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.buttons')">
      <draggable
        v-if="buttons.length > 0"
        class="action-buttons-props__list"
        :model-value="buttons"
        item-key="key"
        handle=".action-buttons-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="action-buttons-props__row">
            <span class="action-buttons-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="action-buttons-props__fields">
              <div class="action-buttons-props__line">
                <a-input
                  :value="buttons[index].key"
                  placeholder="key"
                  allow-clear
                  @update:value="onButtonUpdate(index, 'key', $event)"
                />
                <a-input
                  :value="buttons[index].label"
                  :placeholder="$t('template.buttonLabel')"
                  allow-clear
                  @update:value="onButtonUpdate(index, 'label', $event)"
                />
              </div>
              <a-input
                :value="buttons[index].icon"
                :placeholder="$t('template.buttonIcon')"
                allow-clear
                @update:value="onButtonUpdate(index, 'icon', $event)"
              />
              <a-input
                :value="buttons[index].fillTemplate"
                :placeholder="$t('template.fillTemplate')"
                allow-clear
                @update:value="onButtonUpdate(index, 'fillTemplate', $event)"
              />
              <a-checkbox
                :checked="buttons[index].primary ?? false"
                @update:checked="onButtonPrimary(index, $event)"
              >
                {{ $t('template.actionPrimary') }}
              </a-checkbox>
            </div>
            <a-button
              type="text"
              class="action-buttons-props__remove"
              @click="onRemoveButton(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.selectOptionsEmpty')" :image="undefined" />

      <a-button block class="action-buttons-props__add" @click="onAddButton">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addButton') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { ActionButton, ActionButtonsWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';
import draggable from 'vuedraggable';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = defineProps<{
  widget: ActionButtonsWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

type Direction = NonNullable<ActionButtonsWidgetConfig['direction']>;
type ButtonStyle = NonNullable<ActionButtonsWidgetConfig['buttonStyle']>;
type ButtonSize = NonNullable<ActionButtonsWidgetConfig['buttonSize']>;
type OnClickAction = NonNullable<ActionButtonsWidgetConfig['onClickAction']>;

const directionOptions: { label: string; value: Direction }[] = [
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
];

const buttonStyleOptions: { label: string; value: ButtonStyle }[] = [
  { label: 'Outlined', value: 'outlined' },
  { label: 'Solid', value: 'solid' },
  { label: 'Text', value: 'text' },
];

const buttonSizeOptions: { label: string; value: ButtonSize }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
];

const onClickOptions: { label: string; value: OnClickAction }[] = [
  { label: 'Fill Prompt', value: 'fill-prompt' },
  { label: 'Switch Preset', value: 'switch-preset' },
  { label: 'Navigate', value: 'navigate' },
  { label: 'Custom', value: 'custom' },
];

const buttons = computed<ActionButton[]>(() => props.widget.buttons ?? []);

type OptionalField = 'icon' | 'fillTemplate';
const OPTIONAL_FIELDS: ReadonlySet<OptionalField> = new Set(['icon', 'fillTemplate']);

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

function onUpdate<K extends keyof ActionButtonsWidgetConfig>(
  field: K,
  value: ActionButtonsWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function commitButtons(next: ActionButton[]): void {
  emit('update', { buttons: next });
}

function isOptional(field: keyof ActionButton): field is OptionalField {
  return OPTIONAL_FIELDS.has(field as OptionalField);
}

function onButtonUpdate(
  index: number,
  field: 'key' | 'label' | 'icon' | 'fillTemplate',
  value: string,
): void {
  const next = buttons.value.map((btn, i) => {
    if (i !== index) return { ...btn };
    const updated: ActionButton = { ...btn };
    if (isOptional(field)) {
      if (value === '') delete updated[field];
      else updated[field] = value;
    } else {
      updated[field] = value;
    }
    return updated;
  });
  commitButtons(next);
}

function onButtonPrimary(index: number, checked: boolean): void {
  const next = buttons.value.map((btn, i) => {
    if (i !== index) return { ...btn };
    const updated: ActionButton = { ...btn };
    if (checked) updated.primary = true;
    else delete updated.primary;
    return updated;
  });
  commitButtons(next);
}

function onRemoveButton(index: number): void {
  commitButtons(buttons.value.filter((_, i) => i !== index));
}

function onAddButton(): void {
  commitButtons([...buttons.value.map((b) => ({ ...b })), { key: '', label: '' }]);
}

function onReorder(next: ActionButton[]): void {
  commitButtons(next.map((b) => ({ ...b })));
}
</script>

<style scoped>
.action-buttons-props {
  display: flex;
  flex-direction: column;
}

.action-buttons-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.action-buttons-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.action-buttons-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.action-buttons-props__row:hover {
  border-color: var(--color-border);
}

.action-buttons-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.action-buttons-props__handle:active {
  cursor: grabbing;
}

.action-buttons-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.action-buttons-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.action-buttons-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.action-buttons-props__add {
  margin-top: var(--spacing-sm);
}
</style>
