<!-- src/views/template/renderer/widgets/SelectWidget.vue -->
<!--
  SelectWidget — 下拉选择渲染器。

  value 形态：
    - 单选 (multiple=false)         → string | undefined
    - 多选 (multiple=true)          → string[]

  双模式：
    - builder: 只读预览 (a-select 禁用)，isSelected 时高亮，不 emit。
    - viewer : 完全可交互，change 时 emit('update:form-values', config.key, value)。
-->
<template>
  <div :class="rootClass">
    <div v-if="config.label" class="select-widget__header">
      <span class="select-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="select-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon
          icon="antdv-next:QuestionCircleOutlined"
          class="select-widget__help"
        />
      </a-tooltip>
    </div>

    <a-select
      class="select-widget__control"
      :value="currentValue"
      :mode="selectMode"
      :placeholder="placeholderText"
      :disabled="isDisabled"
      :show-search="config.showSearch"
      :allow-clear="config.allowClear"
      :option-filter-prop="'label'"
      :max-tag-count="'responsive'"
      :options="config.options"
      @change="onChange"
    >
      <!--
        选项内容（图标 / 描述）走 #optionRender，不能写 a-select-option 子标签：
        antdv-next 的 a-select 渲染底层 VcSelect 时 children 直接传 null，
        默认插槽全程没被引用，子标签写了也到不了下拉框——不报错，只是下拉框空着。
        optionRender 是它明确转发的插槽（见 dist/select/index.js:222）。
        插槽参数是 { option, info }，其中 option 是 FlattenOptionData，
        原始选项对象在 option.data 上——直接解构成 { data: opt } 会拿到 undefined。
      -->
      <template #optionRender="{ option: { data: opt } }">
        <div class="select-widget__option">
          <template v-if="opt.icon">
            <img
              v-if="isUrl(opt.icon)"
              :src="opt.icon"
              :alt="opt.label"
              class="select-widget__option-img"
            />
            <Icon
              v-else
              :icon="opt.icon"
              class="select-widget__option-icon"
            />
          </template>
          <span class="select-widget__option-label">{{ opt.label }}</span>
          <span
            v-if="opt.description"
            class="select-widget__option-desc"
          >
            {{ opt.description }}
          </span>
        </div>
      </template>

      <template
        v-if="isChipTags"
        #tagRender="{ label, closable, onClose }"
      >
        <a-tag
          class="select-widget__chip"
          :closable="closable && !isDisabled"
          @close="onClose"
        >
          {{ label }}
        </a-tag>
      </template>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon/index.vue'
import type { RenderMode, SelectWidgetConfig } from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: SelectWidgetConfig
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
  'select-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
])

/** builder 永远只读；viewer 下尊重 widget 级 disabled */
const isDisabled = computed(
  () => props.mode === 'builder' || props.config.disabled === true,
)

/** 多选时使用 antdv multiple 模式 */
const selectMode = computed<'multiple' | undefined>(() =>
  props.config.multiple ? 'multiple' : undefined,
)

/** 多选 + chip 标签渲染模式 */
const isChipTags = computed(
  () => props.config.multiple === true && props.config.tagRenderMode === 'chip',
)

const placeholderText = computed(
  () => props.config.placeholder ?? '请选择',
)

/** 原始值：viewer 优先取表单值，否则回退默认值 */
const rawValue = computed<unknown>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key]
    if (fromForm !== undefined) return fromForm
  }
  return props.config.defaultValue
})

/** 归一化后的受控值：单选 string|undefined，多选 string[] */
const currentValue = computed<string | string[] | undefined>(() => {
  const raw = rawValue.value
  if (props.config.multiple) {
    if (Array.isArray(raw)) {
      return raw.filter((v): v is string => typeof v === 'string')
    }
    if (typeof raw === 'string' && raw.length > 0) return [raw]
    return []
  }
  return typeof raw === 'string' ? raw : undefined
})

/** 判断字符串是否为图片地址（否则按 iconify/antdv 图标名处理） */
function isUrl(value: string): boolean {
  return /^(https?:\/\/|\/|data:|blob:)/.test(value)
}

function onChange(value: unknown): void {
  if (props.mode !== 'viewer') return
  emit('update:form-values', props.config.key, value)
}
</script>

<style scoped>
.select-widget {
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

.select-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.select-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.select-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.select-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.select-widget__control {
  width: 100%;
}

.select-widget__option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.select-widget__option-img {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex: none;
}

.select-widget__option-icon {
  color: var(--color-text-secondary);
  flex: none;
}

.select-widget__option-label {
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-widget__option-desc {
  margin-left: auto;
  padding-left: var(--spacing-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.select-widget__chip {
  display: inline-flex;
  align-items: center;
  margin: 2px var(--spacing-xs) 2px 0;
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-full);
  border-color: var(--color-border);
  background: var(--color-primary-1);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}
</style>
