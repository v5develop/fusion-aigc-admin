<!-- src/views/template/renderer/widgets/ColorPickerWidget.vue -->
<!--
  ColorPickerWidget — 颜色选择器渲染器。

  value 形态：string (颜色字符串，按 config.format 输出 hex/rgb/hsl)；未选择时为 ''。

  双模式：
    - builder: 只读预览 (a-color-picker 与预设色块均禁用)，isSelected 时高亮，不 emit。
    - viewer : 完全可交互，选色或点击预设色块时 emit('update:form-values', config.key, value)。

  说明：a-color-picker 仅支持 hex/rgb/hsb 输出，config.format 为 'hsl' 时按最接近的 'hsb' 渲染。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="color-picker__header">
      <span class="color-picker__label">
        {{ config.label }}
        <span v-if="config.required" class="color-picker__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon
          icon="antdv-next:QuestionCircleOutlined"
          class="color-picker__help"
        />
      </a-tooltip>
    </div>

    <div class="color-picker__control">
      <a-color-picker
        :value="currentValue || undefined"
        :format="pickerFormat"
        :value-format="pickerFormat"
        :disabled-alpha="!showAlpha"
        :disabled="isDisabled"
        :allow-clear="mode === 'viewer'"
        :presets="presets"
        show-text
        @update:value="onUpdate"
      />
      <span v-if="formatLabel" class="color-picker__format">{{ formatLabel }}</span>
    </div>

    <div v-if="presetColors.length" class="color-picker__presets">
      <button
        v-for="color in presetColors"
        :key="color"
        type="button"
        class="color-picker__swatch"
        :class="{
          'swatch-selected': isActiveSwatch(color),
          'swatch-disabled': isDisabled,
        }"
        :style="{ backgroundColor: color }"
        :title="color"
        :disabled="isDisabled"
        @click="onSwatchClick(color)"
      >
        <Icon
          v-if="isActiveSwatch(color)"
          icon="antdv-next:CheckOutlined"
          class="color-picker__swatch-check"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { ColorPickerWidgetConfig, RenderMode } from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: ColorPickerWidgetConfig
    mode: RenderMode
    formValues?: Record<string, unknown>
    isSelected?: boolean
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
)

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void
}>()

const rootClass = computed(() => [
  'color-picker',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
])

/** builder 永远只读；viewer 下尊重 widget 级 disabled */
const isDisabled = computed(
  () => props.mode === 'builder' || props.config.disabled === true,
)

/** 是否支持透明度通道；a-color-picker 用 disabled-alpha 反向控制 */
const showAlpha = computed(() => props.config.showAlpha === true)

/**
 * a-color-picker 仅支持 hex/rgb/hsb；
 * config.format 为 'hsl' 时映射到最接近的 'hsb'。
 */
const pickerFormat = computed<'hex' | 'rgb' | 'hsb'>(() => {
  switch (props.config.format) {
    case 'rgb':
      return 'rgb'
    case 'hsl':
      return 'hsb'
    default:
      return 'hex'
  }
})

/** 非 hex 格式时在控件旁标注当前输出格式 */
const formatLabel = computed<string>(() =>
  props.config.format && props.config.format !== 'hex'
    ? props.config.format.toUpperCase()
    : '',
)

/** 预设色块列表 */
const presetColors = computed<string[]>(() =>
  Array.isArray(props.config.presetColors)
    ? props.config.presetColors.filter((c): c is string => typeof c === 'string')
    : [],
)

/** 注入到 a-color-picker 弹层的预设分组 */
const presets = computed<{ label: string; colors: string[] }[]>(() =>
  presetColors.value.length
    ? [{ label: $t('template.colorPickerPresets'), colors: presetColors.value }]
    : [],
)

/** 当前值：viewer 优先读 formValues，回退 defaultValue；统一收窄为 string */
const currentValue = computed<string>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key]
    if (typeof fromForm === 'string') {
      return fromForm
    }
  }
  if (typeof props.config.defaultValue === 'string') {
    return props.config.defaultValue
  }
  return ''
})

/** 预设色块是否处于选中态 (大小写不敏感的字符串比较) */
function isActiveSwatch(color: string): boolean {
  return currentValue.value.trim().toLowerCase() === color.trim().toLowerCase()
}

/** a-color-picker 回写：value-format 已保证为字符串；清空时回写 '' */
function onUpdate(value: unknown): void {
  if (props.mode !== 'viewer') {
    return
  }
  emit('update:form-values', props.config.key, typeof value === 'string' ? value : '')
}

/** 点击预设色块直接选色 */
function onSwatchClick(color: string): void {
  if (props.mode !== 'viewer') {
    return
  }
  emit('update:form-values', props.config.key, color)
}
</script>

<style scoped>
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  font-family: var(--font-family);
}

.widget-wrapper {
  border-radius: var(--radius-base);
  transition: box-shadow var(--duration-fast) ease;
}

.widget-selected {
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.color-picker__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.color-picker__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-base);
  color: var(--color-text-primary);
}

.color-picker__required {
  margin-left: 2px;
  color: var(--color-error);
}

.color-picker__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.color-picker__control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.color-picker__format {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.color-picker__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.color-picker__swatch {
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-clip: padding-box;
  cursor: pointer;
  transition:
    transform var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease,
    border-color var(--duration-fast) ease;
}

.color-picker__swatch:hover:not(.swatch-disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
}

.swatch-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.swatch-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.color-picker__swatch-check {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* 装饰性白色对勾，叠在任意底色之上 */
  color: #ffffff;
  font-size: var(--font-size-sm);
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.45));
}
</style>
