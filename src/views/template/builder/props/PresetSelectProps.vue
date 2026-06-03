<!-- src/views/template/builder/props/PresetSelectProps.vue -->
<!--
  PresetSelectProps — preset-select widget 的特有字段编辑器。

  编辑字段：displayMode (cards|list|grid) / presets (PresetOption[]，可加减行，
            每项含 id/label/coverUrl?/description?/values(JSON 文本框编辑)) /
            linkedWidgets (PresetLinkedWidget[]，可加减行，每项含 widgetKey/fieldPath)。

  公共字段 (key/label/placeholder/required/helpText 等) 由 CommonProps 负责，
  此处不重复。数据流：任意字段变化即 emit('update', { 字段: 新值 })；数组字段
  基于 props.widget.<field> 复制后整体回传，不直接 mutate props。values 字段
  以 JSON 文本编辑，解析成功才回传，解析失败仅本地提示不 emit。
-->
<template>
  <a-form class="preset-select-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.presetSelectDisplayMode')">
      <a-select
        :value="widget.displayMode ?? 'cards'"
        :options="displayModeOptions"
        allow-clear
        @update:value="onDisplayModeUpdate"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.presetSelectPresets')">
      <div v-if="widget.presets.length > 0" class="preset-select-props__list">
        <div
          v-for="(preset, index) in widget.presets"
          :key="index"
          class="preset-select-props__row"
        >
          <div class="preset-select-props__fields">
            <div class="preset-select-props__line">
              <a-input
                :value="preset.id"
                :placeholder="$t('template.presetSelectPresetId')"
                allow-clear
                @update:value="onPresetTextUpdate(index, 'id', $event)"
              />
              <a-input
                :value="preset.label"
                :placeholder="$t('template.presetSelectPresetLabel')"
                allow-clear
                @update:value="onPresetTextUpdate(index, 'label', $event)"
              />
            </div>
            <a-input
              :value="preset.coverUrl"
              :placeholder="$t('template.presetSelectPresetCoverUrl')"
              allow-clear
              @update:value="onPresetTextUpdate(index, 'coverUrl', $event)"
            />
            <a-input
              :value="preset.description"
              :placeholder="$t('template.presetSelectPresetDescription')"
              allow-clear
              @update:value="onPresetTextUpdate(index, 'description', $event)"
            />
            <a-textarea
              :value="valuesText(index, preset.values)"
              :rows="4"
              :status="valuesError[index] ? 'error' : undefined"
              :placeholder="$t('template.presetSelectPresetValues')"
              @update:value="onPresetValuesInput(index, $event)"
            />
            <span v-if="valuesError[index]" class="preset-select-props__error">
              {{ $t('template.presetSelectValuesInvalid') }}
            </span>
          </div>
          <a-button
            type="text"
            class="preset-select-props__remove"
            @click="onRemovePreset(index)"
          >
            <Icon icon="antdv-next:DeleteOutlined" />
          </a-button>
        </div>
      </div>

      <a-empty
        v-else
        :description="$t('template.presetSelectPresetsEmpty')"
        :image="undefined"
      />

      <a-button block class="preset-select-props__add" @click="onAddPreset">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.presetSelectAddPreset') }}
      </a-button>
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.presetSelectLinkedWidgets')">
      <div
        v-if="(widget.linkedWidgets?.length ?? 0) > 0"
        class="preset-select-props__list"
      >
        <div
          v-for="(link, index) in widget.linkedWidgets"
          :key="index"
          class="preset-select-props__row"
        >
          <div class="preset-select-props__fields">
            <a-input
              :value="link.widgetKey"
              :placeholder="$t('template.presetSelectLinkedWidgetKey')"
              allow-clear
              @update:value="onLinkedUpdate(index, 'widgetKey', $event)"
            />
            <a-input
              :value="link.fieldPath"
              :placeholder="$t('template.presetSelectLinkedFieldPath')"
              allow-clear
              @update:value="onLinkedUpdate(index, 'fieldPath', $event)"
            />
          </div>
          <a-button
            type="text"
            class="preset-select-props__remove"
            @click="onRemoveLinked(index)"
          >
            <Icon icon="antdv-next:DeleteOutlined" />
          </a-button>
        </div>
      </div>

      <a-empty
        v-else
        :description="$t('template.presetSelectLinkedWidgetsEmpty')"
        :image="undefined"
      />

      <a-button block class="preset-select-props__add" @click="onAddLinked">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.presetSelectAddLinkedWidget') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type {
  PresetLinkedWidget,
  PresetOption,
  PresetSelectWidgetConfig,
} from '@/types/template-builder'

const props = defineProps<{
  widget: PresetSelectWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

type DisplayMode = NonNullable<PresetSelectWidgetConfig['displayMode']>

const displayModeOptions: { label: string; value: DisplayMode }[] = [
  { label: $t('template.presetSelectModeCards'), value: 'cards' },
  { label: $t('template.presetSelectModeList'), value: 'list' },
  { label: $t('template.presetSelectModeGrid'), value: 'grid' },
]

/** values 字段的 JSON 编辑草稿与解析错误状态，按行下标维护 */
const valuesDraft = reactive<Record<number, string>>({})
const valuesError = reactive<Record<number, boolean>>({})

/** 可选文本字段：清空回传删除，避免落地空串 */
type OptionalPresetField = 'coverUrl' | 'description'
const OPTIONAL_PRESET_FIELDS: ReadonlySet<OptionalPresetField> = new Set([
  'coverUrl',
  'description',
])

function onUpdate<K extends keyof PresetSelectWidgetConfig>(
  field: K,
  value: PresetSelectWidgetConfig[K] | undefined,
): void {
  emit('update', { [field]: value })
}

function onDisplayModeUpdate(value: unknown): void {
  if (value === undefined || value === null || value === '') {
    onUpdate('displayMode', undefined)
    return
  }
  onUpdate('displayMode', value as DisplayMode)
}

/** 清空所有 values 草稿/错误状态（行增删时下标偏移，避免错位） */
function resetValuesState(): void {
  for (const key of Object.keys(valuesDraft)) delete valuesDraft[Number(key)]
  for (const key of Object.keys(valuesError)) delete valuesError[Number(key)]
}

function valuesText(index: number, values: Record<string, unknown>): string {
  const draft = valuesDraft[index]
  if (draft !== undefined) return draft
  return JSON.stringify(values ?? {}, null, 2)
}

function isOptionalPresetField(
  field: keyof PresetOption,
): field is OptionalPresetField {
  return OPTIONAL_PRESET_FIELDS.has(field as OptionalPresetField)
}

type PresetTextField = 'id' | 'label' | 'coverUrl' | 'description'

function onPresetTextUpdate(
  index: number,
  field: PresetTextField,
  value: string,
): void {
  const next = props.widget.presets.map((preset, i) => {
    if (i !== index) return { ...preset }
    const updated: PresetOption = { ...preset }
    if (isOptionalPresetField(field)) {
      if (value === '') delete updated[field]
      else updated[field] = value
    } else {
      updated[field] = value
    }
    return updated
  })
  onUpdate('presets', next)
}

function parseValues(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (trimmed === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return null
  }
  return parsed as Record<string, unknown>
}

function onPresetValuesInput(index: number, text: string): void {
  valuesDraft[index] = text
  const parsed = parseValues(text)
  if (parsed === null) {
    valuesError[index] = true
    return
  }
  valuesError[index] = false
  const next = props.widget.presets.map((preset, i) =>
    i === index ? { ...preset, values: parsed } : { ...preset },
  )
  onUpdate('presets', next)
}

function onRemovePreset(index: number): void {
  const next = props.widget.presets
    .filter((_, i) => i !== index)
    .map((preset) => ({ ...preset }))
  resetValuesState()
  onUpdate('presets', next)
}

function onAddPreset(): void {
  const next: PresetOption[] = [
    ...props.widget.presets.map((preset) => ({ ...preset })),
    { id: '', label: '', values: {} },
  ]
  resetValuesState()
  onUpdate('presets', next)
}

type LinkedField = 'widgetKey' | 'fieldPath'

function onLinkedUpdate(index: number, field: LinkedField, value: string): void {
  const current = props.widget.linkedWidgets ?? []
  const next = current.map((link, i) =>
    i === index ? { ...link, [field]: value } : { ...link },
  )
  onUpdate('linkedWidgets', next)
}

function onRemoveLinked(index: number): void {
  const current = props.widget.linkedWidgets ?? []
  const next: PresetLinkedWidget[] = current
    .filter((_, i) => i !== index)
    .map((link) => ({ ...link }))
  onUpdate('linkedWidgets', next)
}

function onAddLinked(): void {
  const current = props.widget.linkedWidgets ?? []
  const next: PresetLinkedWidget[] = [
    ...current.map((link) => ({ ...link })),
    { widgetKey: '', fieldPath: '' },
  ]
  onUpdate('linkedWidgets', next)
}
</script>

<style scoped>
.preset-select-props {
  display: flex;
  flex-direction: column;
}

.preset-select-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.preset-select-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.preset-select-props__row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-layout);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  transition: border-color var(--duration-fast);
}

.preset-select-props__row:hover {
  border-color: var(--color-border);
}

.preset-select-props__fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.preset-select-props__line {
  display: flex;
  gap: var(--spacing-xs);
}

.preset-select-props__error {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.preset-select-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.preset-select-props__add {
  margin-top: var(--spacing-sm);
}
</style>
