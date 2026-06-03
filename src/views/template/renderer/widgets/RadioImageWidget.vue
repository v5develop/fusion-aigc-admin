<!-- src/views/template/renderer/widgets/RadioImageWidget.vue -->
<!--
  RadioImageWidget — 图片单选渲染器 (如风格选择)。

  value 形态：
    - string (单选选中项的 value)；未选中时为 undefined。

  双模式：
    - builder: 只读预览，每个选项加 option-disabled，点击不改值；isSelected 时高亮，不 emit。
    - viewer : 完全可交互，点击图片选中并 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="radio-image__header">
      <span class="radio-image__label">
        {{ config.label }}
        <span v-if="config.required" class="radio-image__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon
          icon="antdv-next:QuestionCircleOutlined"
          class="radio-image__help"
        />
      </a-tooltip>
    </div>

    <div
      v-if="config.options.length"
      class="radio-image__grid"
      :class="gridColsClass"
    >
      <div
        v-for="opt in config.options"
        :key="opt.value"
        class="radio-image__option"
        :class="{
          'option-selected': selectedValue === opt.value,
          'option-disabled': mode === 'builder',
        }"
        :style="{ width: optionWidth }"
        @click="selectOption(opt.value)"
      >
        <div class="radio-image__image-wrapper">
          <img
            :src="opt.thumbnailUrl || opt.imageUrl"
            :alt="opt.label"
            class="radio-image__image"
          />
          <!-- 选中勾选图标 -->
          <div
            v-if="selectedValue === opt.value && config.showCheckmark !== false"
            class="radio-image__checkmark"
          >
            <Icon icon="antdv-next:CheckCircleOutlined" />
          </div>
          <!-- 预览效果图 (hover 展示) -->
          <div v-if="opt.previewUrl" class="radio-image__hover-preview">
            <img :src="opt.previewUrl" :alt="`${opt.label} preview`" />
          </div>
        </div>
        <span class="radio-image__option-label">{{ opt.label }}</span>
      </div>
    </div>

    <a-empty
      v-else
      class="radio-image__empty"
      :description="$t('template.radioImageEmpty')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { RadioImageWidgetConfig, RenderMode } from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: RadioImageWidgetConfig
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

/** 不同 imageSize 对应的选项宽度映射 */
const imageSizeMap: Record<'small' | 'medium' | 'large', string> = {
  small: '80px',
  medium: '120px',
  large: '160px',
}

const rootClass = computed(() => [
  'radio-image',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
])

/** 列数 → 栅格类名 (cols-N)，供 CSS 控制每行列数 */
const gridColsClass = computed(() => `cols-${props.config.columns ?? 3}`)

/** 单个选项宽度 */
const optionWidth = computed(
  () => imageSizeMap[props.config.imageSize ?? 'medium'],
)

/** 当前选中值：viewer 优先取表单值，否则回退默认值 */
const selectedValue = computed<string | undefined>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key]
    if (typeof fromForm === 'string') return fromForm
  }
  return typeof props.config.defaultValue === 'string'
    ? props.config.defaultValue
    : undefined
})

function selectOption(value: string): void {
  if (props.mode !== 'viewer') return
  if (props.config.disabled === true) return
  emit('update:form-values', props.config.key, value)
}
</script>

<style scoped>
.radio-image {
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

.radio-image__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.radio-image__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.radio-image__required {
  margin-left: 2px;
  color: var(--color-error);
}

.radio-image__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.radio-image__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.radio-image__option {
  cursor: pointer;
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-border-secondary);
  overflow: hidden;
  transition: all var(--duration-fast) ease;
}

.radio-image__option:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card-hover);
}

.radio-image__option.option-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.radio-image__option.option-disabled {
  cursor: default;
}

.radio-image__image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.radio-image__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.radio-image__checkmark {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--color-primary);
  font-size: var(--font-size-xl);
  background: #fff;
  border-radius: var(--radius-full);
  line-height: 1;
}

.radio-image__hover-preview {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.radio-image__hover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.radio-image__option:hover .radio-image__hover-preview {
  opacity: 1;
}

.radio-image__option-label {
  display: block;
  text-align: center;
  padding: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.radio-image__empty {
  margin: 0;
}
</style>
