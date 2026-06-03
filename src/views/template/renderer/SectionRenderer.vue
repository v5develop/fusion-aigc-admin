<!-- src/views/template/renderer/SectionRenderer.vue -->
<!--
  SectionRenderer — 渲染单个 TemplateSection。

  - mode='builder': 可拖拽排序 (@vueuse/integrations useSortable，底层 sortablejs) +
    点击选中 widget + 空态 + 从组件库原生拖入 (drop-widget) + section 级操作 (新增/编辑/删除)。
  - mode='viewer': 直接渲染 widget 列表，并把每个 WidgetRenderer 的
    update:form-values 事件冒泡到上层。
-->
<template>
  <div
    class="section-renderer"
    :class="{
      'section-active': mode === 'builder' && isActive,
      'section-collapsible': section.collapsible,
      'section-collapsed': section.collapsible && isCollapsed,
      'section-drag-over': mode === 'builder' && isDragOver,
    }"
    :style="sectionStyle"
    @dragover.prevent.stop="onSectionDragOver"
    @dragleave="onSectionDragLeave"
  >
    <!-- Section 标题栏 -->
    <div v-if="section.title" class="section-header" @click="onHeaderClick">
      <div class="section-title-row">
        <Icon
          v-if="section.collapsible"
          :icon="isCollapsed ? 'antdv-next:RightOutlined' : 'antdv-next:DownOutlined'"
          class="collapse-icon"
          @click.stop="toggleCollapse"
        />
        <h3 class="section-title">{{ section.title }}</h3>
        <span v-if="section.subtitle" class="section-subtitle">{{ section.subtitle }}</span>
      </div>
      <!-- Builder 模式操作按钮 -->
      <a-space v-if="mode === 'builder'" class="section-actions" @click.stop>
        <a-button size="small" type="text" @click="emit('add-widget')">
          <Icon icon="antdv-next:PlusOutlined" /> {{ $t('template.addWidget') }}
        </a-button>
        <a-button size="small" type="text" @click="emit('edit-section')">
          <Icon icon="antdv-next:SettingOutlined" />
        </a-button>
        <a-button size="small" type="text" danger @click="emit('remove-section')">
          <Icon icon="antdv-next:DeleteOutlined" />
        </a-button>
      </a-space>
    </div>

    <!-- Section 内容 -->
    <div v-show="!isCollapsed" class="section-body">
      <!-- Builder 模式: 可拖拽排序的 Widget 列表 (useSortable) -->
      <template v-if="mode === 'builder'">
        <div ref="sortableRef" class="widgets-list">
          <div
            v-for="element in localWidgets"
            :key="element.key"
            class="widget-drop-zone"
            :class="{ 'widget-drop-zone--active': activeWidgetKey === element.key }"
            :data-widget-key="element.key"
            @pointerdown.stop="emit('select-widget', element.key)"
            @click.stop
            @dragover.prevent.stop="onWidgetDragOver"
            @dragleave="onWidgetDragLeave"
            @drop.prevent.stop="onWidgetDrop($event, indexOfWidget(element.key))"
          >
            <button
              class="widget-remove-btn"
              type="button"
              @click.stop="emit('remove-widget', element.key)"
            >
              <Icon icon="antdv-next:CloseOutlined" />
            </button>
            <WidgetRenderer
              :config="element"
              :mode="'builder'"
              :is-selected="activeWidgetKey === element.key"
            />
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="localWidgets.length === 0"
          class="empty-section"
          @dragover.prevent.stop="onSectionDragOver"
          @drop.prevent.stop="onSectionDrop"
        >
          <a-empty :description="$t('template.dragWidgetHere')">
            <template #image>
              <Icon icon="antdv-next:InboxOutlined" class="empty-icon" />
            </template>
          </a-empty>
        </div>
      </template>

      <!-- Viewer 模式: 直接渲染 Widget -->
      <template v-else>
        <div class="widgets-list">
          <WidgetRenderer
            v-for="widget in section.widgets"
            :key="widget.key"
            :config="widget"
            :mode="'viewer'"
            :form-values="formValues"
            @update:form-values="onWidgetFormValuesUpdate"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type {
  RenderMode,
  Spacing,
  TemplateSection,
  WidgetConfig,
} from '@/types/template-builder'

import WidgetRenderer from './WidgetRenderer.vue'

const props = withDefaults(
  defineProps<{
    section: TemplateSection
    mode: RenderMode
    activeWidgetKey?: string
    formValues?: Record<string, unknown>
  }>(),
  {
    activeWidgetKey: undefined,
    formValues: undefined,
  },
)

const emit = defineEmits<{
  (e: 'select-widget', key: string): void
  (e: 'remove-widget', key: string): void
  (e: 'reorder-widgets', widgets: WidgetConfig[]): void
  (e: 'drop-widget', event: DragEvent, index?: number): void
  (e: 'add-widget'): void
  (e: 'edit-section'): void
  (e: 'remove-section'): void
  (e: 'update:form-values', key: string, value: unknown): void
}>()

// Builder 模式下用于拖拽排序的本地副本，跟随外部 section.widgets 同步。
const localWidgets = ref<WidgetConfig[]>([...props.section.widgets])

watch(
  () => props.section.widgets,
  (val) => {
    localWidgets.value = [...val]
  },
)

// 拖拽排序容器（仅 builder 模式渲染）。useSortable 直接操作 localWidgets，
// 内部完成数组搬移后，通过 onUpdate 向上 emit reorder-widgets。
const sortableRef = ref<HTMLElement | null>(null)

useSortable(sortableRef, localWidgets, {
  animation: 150,
  ghostClass: 'widget-ghost',
  chosenClass: 'widget-drag-active',
  // 只接受内部拖拽排序，外部拖入由 onSectionDrop 处理
  group: {
    name: 'widgets',
    pull: false,
    put: false,
  },
  onUpdate: () => {
    emit('reorder-widgets', [...localWidgets.value])
  },
})

function indexOfWidget(key: string): number {
  return localWidgets.value.findIndex((w) => w.key === key)
}

const isCollapsed = ref<boolean>(props.section.collapsedByDefault === true)

const isDragOver = ref(false)

const isActive = computed(() =>
  props.section.widgets.some((w) => w.key === props.activeWidgetKey),
)

function resolvePadding(padding: number | Spacing | undefined): string {
  if (padding === undefined) {
    return 'var(--spacing-md)'
  }
  if (typeof padding === 'number') {
    return `${padding}px`
  }
  const top = padding.top ?? 0
  const right = padding.right ?? 0
  const bottom = padding.bottom ?? 0
  const left = padding.left ?? 0
  return `${top}px ${right}px ${bottom}px ${left}px`
}

const sectionStyle = computed<CSSProperties>(() => ({
  backgroundColor: props.section.backgroundColor || 'var(--color-bg-container)',
  padding: resolvePadding(props.section.padding),
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border-secondary)',
}))

function toggleCollapse() {
  if (props.section.collapsible) {
    isCollapsed.value = !isCollapsed.value
  }
}

function onHeaderClick() {
  // builder 模式：点击标题栏选中当前区域（切到区域属性）；
  // viewer 模式：保留折叠行为。
  if (props.mode === 'builder') {
    emit('edit-section')
  } else {
    toggleCollapse()
  }
}

function onSectionDragOver(event: DragEvent) {
  if (props.mode !== 'builder') {
    return
  }
  event.preventDefault()
  isDragOver.value = true
}

function onSectionDragLeave() {
  isDragOver.value = false
}

function onSectionDrop(event: DragEvent) {
  if (props.mode !== 'builder') {
    return
  }
  event.preventDefault()
  isDragOver.value = false
  emit('drop-widget', event)
}

function onWidgetDragOver() {
  isDragOver.value = true
}

function onWidgetDragLeave() {
  isDragOver.value = false
}

function onWidgetDrop(event: DragEvent, index: number) {
  isDragOver.value = false
  emit('drop-widget', event, index)
}

function onWidgetFormValuesUpdate(key: string, value: unknown) {
  emit('update:form-values', key, value)
}
</script>

<style scoped>
.section-renderer {
  position: relative;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}

.section-renderer.section-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.section-renderer.section-drag-over {
  border-style: dashed;
  border-color: var(--color-success);
  background: var(--color-primary-1);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
  cursor: pointer;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  min-height: 24px;
}

.section-actions {
  flex-shrink: 0;
  margin-top: -2px;
}

.collapse-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium, 500);
  color: var(--color-text-primary);
}

.section-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.section-body {
  display: flex;
  flex-direction: column;
}

.widgets-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.widget-drop-zone {
  position: relative;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast);
  padding: var(--spacing-sm);
}

.widget-drop-zone:hover {
  background: var(--color-bg-layout);
}

.widget-drop-zone--active {
  background: var(--color-primary-1);
}

.widget-remove-btn {
  position: absolute;
  top: var(--spacing-xs);
  right: var(--spacing-xs);
  z-index: 20;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-bg-container);
  color: var(--color-text-tertiary);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast), color var(--duration-fast);
}

.widget-drop-zone:hover .widget-remove-btn {
  opacity: 1;
}


.widget-remove-btn:hover {
  color: var(--color-error);
}

.empty-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-layout);
}

.empty-icon {
  font-size: 32px;
  color: var(--color-text-quaternary);
}

.widget-ghost {
  opacity: 0.5;
}

.widget-drag-active {
  box-shadow: var(--shadow-card-hover);
}
</style>
