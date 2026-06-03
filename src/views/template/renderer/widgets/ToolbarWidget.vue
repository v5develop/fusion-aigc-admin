<template>
  <div
    class="widget-wrapper toolbar-widget"
    :class="[
      `toolbar-${config.position || 'inline'}`,
      { 'widget-selected': mode === 'builder' && isSelected }
    ]"
  >
    <div class="toolbar-items">
      <div
        v-for="item in config.items"
        :key="item.key"
        class="toolbar-item"
        :class="{ 'item-active': isItemActive(item) }"
        @click="handleItemClick(item)"
      >
        <div class="item-icon-wrapper">
          <Icon :icon="item.icon" :class="`icon-${config.iconSize || 'medium'}`" />
        </div>
        <span v-if="config.showLabel !== false" class="item-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolbarWidgetConfig, ToolbarItem, RenderMode } from '@/types/template-builder'
import Icon from '@/components/Icon/index.vue'

const props = withDefaults(defineProps<{
  config: ToolbarWidgetConfig
  mode: RenderMode
  formValues?: Record<string, unknown>
  isSelected?: boolean
}>(), { formValues: undefined, isSelected: false })

const emit = defineEmits<{ (e: 'update:form-values', key: string, value: unknown): void }>()

/** 当前激活项 key：优先表单值，其次默认值，最后 items 中 active=true 的项 */
const activeKey = computed<string>(() => {
  const raw = props.formValues?.[props.config.key]
  if (typeof raw === 'string') return raw
  if (typeof props.config.defaultValue === 'string') return props.config.defaultValue
  const flagged = props.config.items.find((item) => item.active)
  return flagged?.key ?? ''
})

function isItemActive(item: ToolbarItem): boolean {
  return activeKey.value ? activeKey.value === item.key : item.active === true
}

function handleItemClick(item: ToolbarItem): void {
  if (props.mode === 'builder') return
  emit('update:form-values', props.config.key, item.key)
}
</script>

<style scoped>
.toolbar-widget {
  width: 100%;
}

.toolbar-inline {
  border-top: 1px solid var(--color-border-secondary);
  padding-top: var(--spacing-sm);
}

.toolbar-fixed-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--color-bg-container);
  border-top: 1px solid var(--color-border-secondary);
  padding: var(--spacing-xs) var(--spacing-md);
  box-shadow: var(--shadow-card);
  /* 移动端安全区适配 */
  padding-bottom: calc(var(--spacing-xs) + env(safe-area-inset-bottom, 0px));
}

.toolbar-items {
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: var(--spacing-sm);
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 6px var(--spacing-md);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--duration-fast);
  color: var(--color-text-tertiary);
}

.toolbar-item:hover {
  color: var(--color-primary);
  background: var(--color-primary-1);
}

.toolbar-item.item-active {
  color: var(--color-primary);
}

.item-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-small { font-size: 18px; }
.icon-medium { font-size: 22px; }
.icon-large { font-size: 26px; }

.item-label {
  font-size: var(--font-size-xs);
  line-height: 1;
}
</style>
