<template>
  <div
    class="widget-wrapper"
    :class="{ 'widget-selected': mode === 'builder' && isSelected }"
  >
    <div v-if="config.label" class="widget-header">
      <label class="widget-label">{{ config.label }}</label>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon
          icon="antdv-next:QuestionCircleOutlined"
          class="help-icon"
        />
      </a-tooltip>
    </div>

    <!-- C-end 模式: 提示文案 -->
    <div
      v-if="mode === 'viewer' && config.promptHint"
      class="prompt-hint"
    >
      <Icon icon="antdv-next:BulbOutlined" />
      <span>{{ config.promptHint }}</span>
    </div>

    <div
      class="chip-input-container"
      :style="{ minHeight: `${config.minHeight || 120}px` }"
    >
      <!-- 文本输入区 (C-end 可编辑, Builder 预览禁用) -->
      <textarea
        v-model="inputText"
        class="chip-textarea"
        :placeholder="config.placeholder || $t('template.chipInputPlaceholder')"
        :disabled="mode === 'builder'"
        :maxlength="config.maxLength"
        @keydown.enter.prevent="handleEnterKey"
        @input="emitUpdate"
      />

      <!-- Chip 标签展示区 -->
      <div v-if="selectedChips.length > 0" class="chips-display">
        <a-tag
          v-for="chip in selectedChips"
          :key="chip.key"
          :color="chip.color || undefined"
          :closable="config.removable !== false && mode === 'viewer'"
          class="chip-tag"
          :class="{ 'chip-colorful': config.chipTheme === 'colorful' }"
          @close="removeChip(chip.key)"
        >
          <Icon v-if="chip.icon" :icon="chip.icon" class="chip-icon" />
          {{ chip.label }}
        </a-tag>
      </div>
    </div>

    <!-- 预置标签选择器 (C-end 模式) -->
    <div
      v-if="mode === 'viewer' && availablePresetChips.length > 0"
      class="preset-chips-area"
    >
      <span class="preset-label">{{ $t('template.presetTags') }}:</span>
      <div class="preset-chips-grid">
        <div
          v-for="chip in availablePresetChips"
          :key="chip.key"
          class="preset-chip-btn"
          :class="{ 'chip-selected': isChipSelected(chip.key) }"
          :style="{ '--chip-color': chip.color || 'var(--color-primary)' }"
          @click="toggleChip(chip)"
        >
          <Icon v-if="chip.icon" :icon="chip.icon" />
          <span>{{ chip.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type {
  ChipInputWidgetConfig,
  ChipOption,
  RenderMode,
} from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: ChipInputWidgetConfig
    mode: RenderMode
    formValues?: Record<string, unknown>
    isSelected?: boolean
  }>(),
  { formValues: undefined, isSelected: false },
)

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void
}>()

/** chip-input 的值形态：输入框文本 + 已选 chip 的 key 列表 */
interface ChipInputValue {
  text: string
  chips: string[]
}

// ─── 本地受控状态 ──────────────────────────────────────────
// 以 props 值为权威来源，本地 ref 仅作编辑缓冲，通过 watch 同步。
const inputText = ref('')
const chipKeys = ref<string[]>([])

/** 从 formValues / defaultValue 解析当前值，做防御性兜底 */
function readValue(): ChipInputValue {
  const raw = props.formValues?.[props.config.key] ?? props.config.defaultValue
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const text = typeof obj.text === 'string' ? obj.text : ''
    const chips = Array.isArray(obj.chips)
      ? obj.chips.filter((c): c is string => typeof c === 'string')
      : []
    return { text, chips }
  }
  return { text: '', chips: [] }
}

watch(
  () => [props.formValues?.[props.config.key], props.mode] as const,
  () => {
    const value = readValue()
    inputText.value = value.text
    chipKeys.value = value.chips
  },
  { immediate: true, deep: true },
)

/** 自定义 chip 的 key 前缀，默认 'custom_' */
const customKeyPrefix = computed(() => props.config.customKeyPrefix ?? 'custom_')

/** 是否达到最大 chip 数（maxChips=0 表示不限制） */
const atChipLimit = computed(() => {
  const max = props.config.maxChips ?? 0
  return max > 0 && chipKeys.value.length >= max
})

/**
 * 把存储的 key 还原成可渲染的 ChipOption：
 * - 命中 presetChips → 直接复用预设
 * - 否则视为自定义 chip，剥离前缀作为展示标签
 */
function resolveChip(key: string): ChipOption {
  const preset = props.config.presetChips?.find((c) => c.key === key)
  if (preset) {
    return preset
  }
  const prefix = customKeyPrefix.value
  const label = key.startsWith(prefix) ? key.slice(prefix.length) : key
  return { key, label }
}

const selectedChips = computed<ChipOption[]>(() =>
  chipKeys.value.map(resolveChip),
)

const availablePresetChips = computed<ChipOption[]>(
  () => props.config.presetChips ?? [],
)

function isChipSelected(key: string): boolean {
  return chipKeys.value.includes(key)
}

function emitUpdate(): void {
  // builder 模式只读预览，不发任何值
  if (props.mode !== 'viewer') {
    return
  }
  const value: ChipInputValue = {
    text: inputText.value,
    chips: [...chipKeys.value],
  }
  emit('update:form-values', props.config.key, value)
}

/** 添加一个 chip（含上限校验与 insertText 文本注入） */
function addChip(key: string, insertText?: string): void {
  if (chipKeys.value.includes(key)) {
    return
  }
  if (atChipLimit.value) {
    message.warning($t('template.chipLimitReached'))
    return
  }
  chipKeys.value = [...chipKeys.value, key]
  if (insertText) {
    inputText.value = inputText.value
      ? `${inputText.value} ${insertText}`
      : insertText
  }
  emitUpdate()
}

function removeChip(key: string): void {
  if (props.mode !== 'viewer') {
    return
  }
  chipKeys.value = chipKeys.value.filter((k) => k !== key)
  emitUpdate()
}

function toggleChip(chip: ChipOption): void {
  if (props.mode !== 'viewer') {
    return
  }
  if (isChipSelected(chip.key)) {
    removeChip(chip.key)
  } else {
    addChip(chip.key, chip.insertText)
  }
}

/** 输入框回车：把当前文本作为自定义 chip 添加 */
function handleEnterKey(): void {
  if (props.mode !== 'viewer') {
    return
  }
  if (props.config.allowCustomInput === false) {
    return
  }
  const text = inputText.value.trim()
  if (!text) {
    return
  }
  const key = `${customKeyPrefix.value}${text}`
  if (chipKeys.value.includes(key)) {
    inputText.value = ''
    emitUpdate()
    return
  }
  if (atChipLimit.value) {
    message.warning($t('template.chipLimitReached'))
    return
  }
  chipKeys.value = [...chipKeys.value, key]
  inputText.value = ''
  emitUpdate()
}
</script>

<style scoped>
.widget-wrapper {
  border-radius: var(--radius-base);
  transition: box-shadow var(--duration-fast);
}

.widget-selected {
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.widget-header {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.widget-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.help-icon {
  margin-left: var(--spacing-xs);
  color: var(--color-text-tertiary);
  cursor: help;
}

.prompt-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-base);
  background: var(--color-primary-1);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
}

.chip-input-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-container);
  padding: var(--spacing-md);
  transition: border-color var(--duration-fast);
}

.chip-input-container:focus-within {
  border-color: var(--color-primary);
  /* spec 用 rgba(var(--color-primary-rgb),0.1)，项目无该令牌 → 改用浅色外发光 */
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.chip-textarea {
  width: 100%;
  min-height: 60px;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text-primary);
  background: transparent;
}

.chip-textarea:disabled {
  cursor: default;
  color: var(--color-text-secondary);
}

.chip-textarea::placeholder {
  color: var(--color-text-quaternary);
}

.chips-display {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-secondary);
}

.chip-tag {
  /* 胶囊圆角为组件固有视觉，保留字面量 */
  border-radius: 16px;
  padding: 2px 10px;
  font-size: var(--font-size-sm);
  cursor: default;
}

.chip-tag .chip-icon {
  margin-right: var(--spacing-xs);
  font-size: var(--font-size-base);
}

.preset-chips-area {
  margin-top: var(--spacing-md);
}

.preset-label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.preset-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.preset-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  /* 胶囊圆角为组件固有视觉，保留字面量 */
  border-radius: 16px;
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-container);
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

.preset-chip-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.preset-chip-btn.chip-selected {
  /* 选中态白字为固有视觉 */
  color: #fff;
  background: var(--chip-color, var(--color-primary));
  border-color: var(--chip-color, var(--color-primary));
}
</style>
