<!-- src/views/template/builder/props/PromptInputProps.vue -->
<!--
  PromptInputProps — prompt-input 类型 widget 的特有字段编辑器。
  编辑 PromptInputWidgetConfig 特有字段：template、slots、minHeight。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="prompt-input-props" layout="vertical" :colon="false">
    <section class="prompt-input-props__section">
      <div class="prompt-input-props__section-head">
        <span class="prompt-input-props__section-title">{{ $t('template.promptTemplate') }}</span>
        <a-button type="link" size="small" class="prompt-input-props__ref" @click="pickerOpen = true">
          <Icon icon="antdv-next:LinkOutlined" />
          {{ $t('template.referencePrompt') }}
        </a-button>
      </div>
      <div class="prompt-input-props__toolbar">
        <span class="prompt-input-props__toolbar-label">{{ $t('prompt.insertSlotHint') }}</span>
        <a-button
          v-for="opt in slotTypeOptions"
          :key="opt.value"
          size="small"
          @click="onAddSlot(opt.value)"
        >
          + {{ opt.label }}
        </a-button>
      </div>
      <a-textarea
        :value="widget.template"
        :placeholder="$t('template.promptTemplatePlaceholder')"
        :rows="4"
        allow-clear
        @update:value="onUpdate('template', $event)"
      />
      <div class="prompt-input-props__hint">
        {{ $t('template.promptTemplateHint') }}
      </div>
    </section>

    <a-form-item :label="$t('template.promptMinHeight')">
      <a-input-number
        :value="widget.minHeight ?? 80"
        :min="40"
        :max="400"
        :step="10"
        style="width: 100%"
        @update:value="onUpdate('minHeight', toNumber($event, 80))"
      />
    </a-form-item>

    <a-divider class="prompt-input-props__divider" />

    <section class="prompt-input-props__section">
      <div class="prompt-input-props__section-head">
        <span class="prompt-input-props__section-title">{{ $t('template.promptSlots') }}</span>
      </div>

      <draggable
        v-if="slots.length > 0"
        class="prompt-input-props__list"
        :model-value="slots"
        item-key="key"
        handle=".prompt-input-props__handle"
        @update:model-value="onReorder"
      >
        <template #item="{ index }">
          <div class="prompt-input-props__row">
            <span class="prompt-input-props__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <div class="prompt-input-props__fields">
              <div class="prompt-input-props__line">
                <a-input
                  :value="slots[index].key"
                  placeholder="slot key"
                  allow-clear
                  @update:value="onSlotUpdate(index, 'key', $event)"
                />
                <a-select
                  :value="slots[index].slotType"
                  :options="slotTypeOptions"
                  style="width: 100px"
                  @update:value="onSlotUpdate(index, 'slotType', $event)"
                />
              </div>
              <a-input
                :value="slots[index].label"
                :placeholder="$t('template.slotLabel')"
                allow-clear
                @update:value="onSlotUpdate(index, 'label', $event)"
              />
              <a-input
                :value="slots[index].placeholder || ''"
                :placeholder="$t('template.slotPlaceholder')"
                allow-clear
                @update:value="onSlotUpdate(index, 'placeholder', $event)"
              />

              <div v-if="slots[index].slotType === 'select' || slots[index].slotType === 'chip'" class="prompt-input-props__sub">
                <a-form-item :label="$t('template.slotOptions')" style="margin-bottom: 0">
                  <div class="prompt-input-props__options">
                    <div
                      v-for="(opt, oi) in (slots[index].options || [])"
                      :key="oi"
                      class="prompt-input-props__option-row"
                    >
                      <a-input
                        :value="opt.value"
                        placeholder="value"
                        size="small"
                        @update:value="onOptionUpdate(index, oi, 'value', $event)"
                      />
                      <a-input
                        :value="opt.label"
                        placeholder="label"
                        size="small"
                        @update:value="onOptionUpdate(index, oi, 'label', $event)"
                      />
                      <a-button
                        type="text"
                        size="small"
                        class="prompt-input-props__opt-remove"
                        @click="onRemoveOption(index, oi)"
                      >
                        <Icon icon="antdv-next:CloseOutlined" />
                      </a-button>
                    </div>
                    <a-button
                      type="dashed"
                      size="small"
                      block
                      @click="onAddOption(index)"
                    >
                      <Icon icon="antdv-next:PlusOutlined" />
                      {{ $t('template.addOption') }}
                    </a-button>
                  </div>
                </a-form-item>
                <a-form-item :label="$t('template.slotMultiple')" style="margin-bottom: 0">
                  <a-switch
                    :checked="slots[index].multiple ?? false"
                    size="small"
                    @update:checked="onSlotUpdate(index, 'multiple', $event)"
                  />
                </a-form-item>
              </div>

              <div v-if="slots[index].slotType === 'image'" class="prompt-input-props__sub">
                <a-form-item :label="$t('template.slotMaxCount')" style="margin-bottom: 0">
                  <a-input-number
                    :value="slots[index].maxCount ?? 1"
                    :min="1"
                    :max="10"
                    size="small"
                    style="width: 100%"
                    @update:value="onSlotUpdate(index, 'maxCount', toNumber($event, 1))"
                  />
                </a-form-item>
                <a-form-item :label="$t('template.slotRecommendedSize')" style="margin-bottom: 0">
                  <a-input
                    :value="slots[index].recommendedSize || ''"
                    :placeholder="$t('template.slotRecommendedSizePlaceholder')"
                    size="small"
                    @update:value="onSlotUpdate(index, 'recommendedSize', $event)"
                  />
                </a-form-item>
              </div>

              <div v-if="slots[index].slotType === 'number'" class="prompt-input-props__sub prompt-input-props__number-grid">
                <a-form-item :label="$t('prompt.slotDefaultValue')" style="margin-bottom: 0">
                  <a-input-number
                    :value="toOptionalNumber(slots[index].defaultValue)"
                    size="small"
                    style="width: 100%"
                    @update:value="onSlotUpdate(index, 'defaultValue', $event)"
                  />
                </a-form-item>
                <a-form-item :label="$t('prompt.slotMin')" style="margin-bottom: 0">
                  <a-input-number
                    :value="slots[index].min"
                    size="small"
                    style="width: 100%"
                    @update:value="onSlotUpdate(index, 'min', $event)"
                  />
                </a-form-item>
                <a-form-item :label="$t('prompt.slotMax')" style="margin-bottom: 0">
                  <a-input-number
                    :value="slots[index].max"
                    size="small"
                    style="width: 100%"
                    @update:value="onSlotUpdate(index, 'max', $event)"
                  />
                </a-form-item>
                <a-form-item :label="$t('prompt.slotStep')" style="margin-bottom: 0">
                  <a-input-number
                    :value="slots[index].step ?? 1"
                    :min="0.1"
                    size="small"
                    style="width: 100%"
                    @update:value="onSlotUpdate(index, 'step', toNumber($event, 1))"
                  />
                </a-form-item>
              </div>
            </div>
            <a-button
              type="text"
              class="prompt-input-props__remove"
              @click="onRemoveSlot(index)"
            >
              <Icon icon="antdv-next:DeleteOutlined" />
            </a-button>
          </div>
        </template>
      </draggable>

      <a-empty v-else :description="$t('template.noSlotsDefined')" :image="undefined" />

      <a-button block class="prompt-input-props__add" @click="onAddSlot('text')">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addSlot') }}
      </a-button>
    </section>

    <PromptPickerModal v-model:open="pickerOpen" @select="onReferencePrompt" />
  </a-form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import draggable from 'vuedraggable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { PromptRecord } from '@/api/prompt'
import type {
  PromptInputWidgetConfig,
  PromptSlot,
} from '@/types/template-builder'

import PromptPickerModal from '../PromptPickerModal.vue'

const props = defineProps<{
  widget: PromptInputWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

const slotTypeOptions: { label: string; value: PromptSlot['slotType'] }[] = [
  { label: $t('prompt.slotTypeText'), value: 'text' },
  { label: $t('prompt.slotTypeSelect'), value: 'select' },
  { label: $t('prompt.slotTypeImage'), value: 'image' },
  { label: $t('prompt.slotTypeChip'), value: 'chip' },
  { label: $t('prompt.slotTypeNumber'), value: 'number' },
]

const slots = computed<PromptSlot[]>(() => props.widget.slots ?? [])

const pickerOpen = ref(false)

function onReferencePrompt(payload: { prompt: PromptRecord; mapVariables: boolean }): void {
  const { prompt, mapVariables } = payload
  const patch: Record<string, unknown> = { template: prompt.content }
  if (mapVariables) {
    if (prompt.slots?.length) {
      // 高级提示词：直接搬运 slots（与模板系统同构，全保真）
      patch.slots = prompt.slots.map(s => ({ ...s }))
    } else if (prompt.variables?.length) {
      // 兼容存量纯文本提示词：variables 映射为 text slot
      const mapped: PromptSlot[] = prompt.variables.map(v => ({
        key: v.name,
        slotType: 'text',
        label: v.label || v.name,
        placeholder: v.defaultValue || '',
      }))
      patch.slots = mapped
    }
  }
  emit('update', patch)
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

function onUpdate<K extends keyof PromptInputWidgetConfig>(
  field: K,
  value: PromptInputWidgetConfig[K],
): void {
  emit('update', { [field]: value })
}

function commitSlots(next: PromptSlot[]): void {
  emit('update', { slots: next })
}

function onSlotUpdate(
  index: number,
  field: keyof PromptSlot,
  value: unknown,
): void {
  const next = slots.value.map((s, i) => {
    if (i !== index) return { ...s }
    return { ...s, [field]: value }
  })
  commitSlots(next)
}

function onRemoveSlot(index: number): void {
  commitSlots(slots.value.filter((_, i) => i !== index))
}

function genSlotKey(type: PromptSlot['slotType']): string {
  let index = slots.value.length + 1
  let key = `${type}${index}`
  while (slots.value.some(slot => slot.key === key)) {
    index += 1
    key = `${type}${index}`
  }
  return key
}

function createSlot(type: PromptSlot['slotType'], key: string): PromptSlot {
  const slot: PromptSlot = {
    key,
    slotType: type,
    label: '',
    placeholder: '',
  }

  if (type === 'select' || type === 'chip') {
    slot.options = []
  }
  if (type === 'image') {
    slot.maxCount = 1
  }
  if (type === 'number') {
    slot.defaultValue = 1
    slot.min = 1
    slot.step = 1
  }

  return slot
}

function onAddSlot(type: PromptSlot['slotType']): void {
  const key = genSlotKey(type)
  const newSlot = createSlot(type, key)
  commitSlots([...slots.value, newSlot])
  onUpdate('template', `${props.widget.template || ''}{{${key}}}`)
}

function onReorder(next: PromptSlot[]): void {
  commitSlots(next.map((s) => ({ ...s })))
}

// ─── Options management for select/chip slots ──────────────

function onAddOption(slotIndex: number): void {
  const slot = slots.value[slotIndex]
  const opts = slot.options ? [...slot.options] : []
  opts.push({ label: '', value: '' })
  const next = slots.value.map((s, i) =>
    i === slotIndex ? { ...s, options: opts } : { ...s },
  )
  commitSlots(next)
}

function onRemoveOption(slotIndex: number, optIndex: number): void {
  const slot = slots.value[slotIndex]
  const opts = (slot.options || []).filter((_, i) => i !== optIndex)
  const next = slots.value.map((s, i) =>
    i === slotIndex ? { ...s, options: opts } : { ...s },
  )
  commitSlots(next)
}

function onOptionUpdate(
  slotIndex: number,
  optIndex: number,
  field: 'label' | 'value',
  value: string,
): void {
  const slot = slots.value[slotIndex]
  const opts = (slot.options || []).map((o, i) =>
    i === optIndex ? { ...o, [field]: value } : { ...o },
  )
  const next = slots.value.map((s, i) =>
    i === slotIndex ? { ...s, options: opts } : { ...s },
  )
  commitSlots(next)
}
</script>

<style scoped>
.prompt-input-props {
  display: flex;
  flex-direction: column;
}

.prompt-input-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.prompt-input-props__section {
  display: flex;
  flex-direction: column;
}

.prompt-input-props__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.prompt-input-props__section-title {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.prompt-input-props__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-xs);
}

.prompt-input-props__ref {
  padding: 0;
  height: auto;
}

.prompt-input-props__settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--spacing-md);
  align-items: end;
}

.prompt-input-props__divider {
  margin: var(--spacing-md) 0;
}

.prompt-input-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.prompt-input-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.prompt-input-props__row:hover {
  border-color: var(--color-border);
}

.prompt-input-props__handle {
  display: flex;
  align-items: center;
  padding-top: var(--spacing-xs);
  color: var(--color-text-quaternary);
  cursor: grab;
}

.prompt-input-props__handle:active {
  cursor: grabbing;
}

.prompt-input-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.prompt-input-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.prompt-input-props__sub {
  padding-left: var(--spacing-sm);
  border-left: 2px solid var(--color-border-secondary);
}

.prompt-input-props__number-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xs);
}

.prompt-input-props__options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.prompt-input-props__option-row {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.prompt-input-props__opt-remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.prompt-input-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.prompt-input-props__add {
  margin-top: var(--spacing-sm);
}
</style>
