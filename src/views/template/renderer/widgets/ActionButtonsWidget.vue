<template>
  <div
    class="widget-wrapper"
    :class="{ 'widget-selected': mode === 'builder' && isSelected }"
  >
    <div v-if="config.label" class="widget-header">
      <label class="widget-label">{{ config.label }}</label>
    </div>

    <div
      class="action-buttons-container"
      :class="[
        `direction-${config.direction || 'horizontal'}`,
        `style-${config.buttonStyle || 'outlined'}`,
        `size-${config.buttonSize || 'medium'}`,
        columns > 0 ? `grid-cols-${columns}` : '',
        { 'is-block': config.block, 'is-builder': mode === 'builder' },
      ]"
    >
      <button
        v-for="btn in config.buttons"
        :key="btn.key"
        type="button"
        class="action-btn"
        :class="{
          'is-primary': btn.primary,
          'is-full-width': btn.fullWidth,
          'btn-primary': btn.color === 'primary',
          'btn-success': btn.color === 'success',
          'btn-warning': btn.color === 'warning',
          'btn-error': btn.color === 'error',
        }"
        @click="handleBtnClick(btn)"
      >
        <Icon v-if="btn.icon" :icon="btn.icon" class="btn-icon" />
        <span class="btn-label">{{ btn.label }}</span>
        <a-badge
          v-if="btn.badge"
          :count="btn.badge"
          :overflow-count="99"
          class="btn-badge"
        />
        <a-tooltip v-if="btn.description" :title="btn.description">
          <Icon icon="antdv-next:InfoCircleOutlined" class="btn-info" />
        </a-tooltip>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon/index.vue'
import type {
  ActionButton,
  ActionButtonsWidgetConfig,
  RenderMode,
} from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: ActionButtonsWidgetConfig
    mode: RenderMode
    formValues?: Record<string, unknown>
    isSelected?: boolean
  }>(),
  { formValues: undefined, isSelected: false },
)

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void
}>()

// columns 可选，比较前先兜底，避免对 undefined 做 > 0 比较
const columns = computed(() => props.config.columns ?? 0)

function handleBtnClick(btn: ActionButton): void {
  // builder 模式为只读预览：不触发任何副作用，点击仅用于父级选中
  if (props.mode !== 'viewer') {
    return
  }

  const action = props.config.onClickAction ?? 'fill-prompt'

  switch (action) {
    case 'fill-prompt':
      // 把按钮预设的文本填充到表单值；key 统一用 widget 自身 key
      emit('update:form-values', props.config.key, btn.fillTemplate ?? '')
      break
    case 'switch-preset':
      // TODO: 切换 targetPresetId 对应的预设方案（依赖 PresetSelect 联动，后续阶段实现）
      break
    case 'navigate':
      // TODO: 导航到 btn.navigateTo（后续阶段接入路由）
      break
    case 'custom':
      // TODO: 自定义点击行为（后续阶段实现）
      break
  }
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
  margin-bottom: var(--spacing-sm);
}

.widget-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.action-buttons-container {
  display: flex;
  gap: var(--spacing-sm);
}

.direction-horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.direction-vertical {
  flex-direction: column;
}

/* 网格排列 */
.grid-cols-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.grid-cols-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.grid-cols-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.is-block {
  width: 100%;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-container);
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  cursor: pointer;
  transition: all var(--duration-fast);
  position: relative;
  white-space: nowrap;
}

/* 主题色描边（color === 'primary'） */
.action-btn.btn-primary {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.action-btn.btn-success {
  color: var(--color-success);
  border-color: var(--color-success);
}

.action-btn.btn-warning {
  color: var(--color-warning);
  border-color: var(--color-warning);
}

.action-btn.btn-error {
  color: var(--color-error);
  border-color: var(--color-error);
}

/* 尺寸 */
.size-small .action-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-xs);
}

.size-large .action-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-base);
}

/* outlined 样式 */
.style-outlined .action-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-1);
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
}

.style-outlined .action-btn.is-primary {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.style-outlined .action-btn.is-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

/* solid 样式 */
.style-solid .action-btn {
  background: var(--color-bg-container);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.style-solid .action-btn:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

/* text 样式 */
.style-text .action-btn {
  border-color: transparent;
  background: transparent;
}

.style-text .action-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-1);
}

/* builder 预览态：禁用悬浮位移，避免误以为可交互 */
.is-builder .action-btn {
  cursor: default;
}

.is-builder .action-btn:hover {
  transform: none;
}

.btn-icon {
  font-size: var(--font-size-lg);
}

.btn-label {
  font-weight: var(--font-weight-medium);
}

.btn-info {
  font-size: var(--font-size-base);
  color: var(--color-text-tertiary);
}

.btn-badge {
  position: absolute;
  top: -6px;
  right: -6px;
}

.is-full-width {
  grid-column: 1 / -1;
  width: 100%;
  justify-content: center;
}
</style>
