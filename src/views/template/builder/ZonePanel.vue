<!-- src/views/template/builder/ZonePanel.vue -->
<!--
  ZonePanel — 构建器左侧面板。

  两部分：
  1. 区域列表 (Zone List)：vuedraggable 排序已添加的 section，点击选中高亮，
     显示类型图标 + 标题 + widget 数；底部"添加区域"按钮。
  2. Widget 组件库 (Widget Palette)：按分组（基础/富媒体/交互/高级）展示 15 个
     widget 类型，每项原生 draggable，dragstart 时把 widget type 写入
     dataTransfer('text/plain')，供画布 (LayoutPreview→SectionRenderer→drop) 接收。

  受控组件：自身不持有 sections 状态，排序结果通过 update:sections 回写父级。
-->
<template>
  <div class="zone-panel">
    <!-- ── 区域列表 ──────────────────────────────────────── -->
    <div class="zone-panel__section">
      <h4 class="zone-panel__title">{{ $t('template.sections') }}</h4>

      <draggable
        v-if="sections.length > 0"
        class="zone-list"
        :model-value="sections"
        item-key="id"
        handle=".zone-item__handle"
        ghost-class="zone-item--ghost"
        @update:model-value="onReorderSections"
      >
        <template #item="{ element }">
          <div
            class="zone-item"
            :class="{ 'zone-item--active': element.id === activeSectionId }"
            @click="emit('select-section', element.id)"
          >
            <span class="zone-item__handle">
              <Icon icon="antdv-next:HolderOutlined" />
            </span>
            <Icon :icon="sectionIcon(element)" class="zone-item__icon" />
            <span class="zone-item__label">
              {{ element.title || $t('template.untitledSection') }}
            </span>
            <span class="zone-item__count">{{ element.widgets.length }}</span>
          </div>
        </template>
      </draggable>

      <a-empty
        v-else
        class="zone-panel__empty"
        :description="$t('template.noSections')"
        :image="undefined"
      />

      <a-button block size="small" class="zone-panel__add" @click="emit('add-section')">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addSection') }}
      </a-button>
    </div>

    <a-divider class="zone-panel__divider" />

    <!-- ── Widget 组件库 ────────────────────────────────── -->
    <div class="zone-panel__section">
      <h4 class="zone-panel__title">{{ $t('template.widgetLibrary') }}</h4>

      <div v-for="group in widgetGroups" :key="group.name" class="widget-group">
        <div class="widget-group__label">{{ group.label }}</div>
        <div class="widget-palette">
          <div
            v-for="w in group.widgets"
            :key="w.type"
            class="widget-draggable"
            draggable="true"
            @dragstart="onDragWidget($event, w.type)"
          >
            <Icon :icon="w.icon" class="widget-draggable__icon" />
            <span class="widget-draggable__label">{{ w.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TemplateSection, WidgetType } from '@/types/template-builder';

import draggable from 'vuedraggable';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

defineProps<{
  sections: TemplateSection[];
  activeSectionId?: string;
}>();

const emit = defineEmits<{
  (e: 'reorder-sections', sections: TemplateSection[]): void;
  (e: 'select-section', id: string): void;
  (e: 'add-section'): void;
}>();

interface WidgetPaletteItem {
  type: WidgetType;
  label: string;
  icon: string;
}

interface WidgetGroup {
  name: string;
  label: string;
  widgets: WidgetPaletteItem[];
}

const widgetGroups: WidgetGroup[] = [
  {
    name: 'basic',
    label: $t('template.widgetGroupBasic'),
    widgets: [
      { type: 'input', label: $t('template.widgetInput'), icon: 'antdv-next:EditOutlined' },
      {
        type: 'textarea',
        label: $t('template.widgetTextarea'),
        icon: 'antdv-next:AlignLeftOutlined',
      },
      { type: 'select', label: $t('template.widgetSelect'), icon: 'antdv-next:CaretDownOutlined' },
      { type: 'number', label: $t('template.widgetNumber'), icon: 'antdv-next:NumberOutlined' },
      { type: 'switch', label: $t('template.widgetSwitch'), icon: 'antdv-next:SwapOutlined' },
      { type: 'slider', label: $t('template.widgetSlider'), icon: 'antdv-next:SlidersOutlined' },
    ],
  },
  {
    name: 'media',
    label: $t('template.widgetGroupMedia'),
    widgets: [
      {
        type: 'image-uploader',
        label: $t('template.widgetImageUploader'),
        icon: 'antdv-next:PictureOutlined',
      },
      {
        type: 'image-select',
        label: $t('template.widgetImageSelect'),
        icon: 'antdv-next:AppstoreOutlined',
      },
      {
        type: 'file-uploader',
        label: $t('template.widgetFileUploader'),
        icon: 'antdv-next:CloudUploadOutlined',
      },
    ],
  },
  {
    name: 'interactive',
    label: $t('template.widgetGroupInteractive'),
    widgets: [
      {
        type: 'chip-input',
        label: $t('template.widgetChipInput'),
        icon: 'antdv-next:TagsOutlined',
      },
      {
        type: 'prompt-input',
        label: $t('template.widgetPromptInput'),
        icon: 'antdv-next:EditOutlined',
      },
      {
        type: 'action-buttons',
        label: $t('template.widgetActionButtons'),
        icon: 'antdv-next:ThunderboltOutlined',
      },
      { type: 'toolbar', label: $t('template.widgetToolbar'), icon: 'antdv-next:ToolOutlined' },
    ],
  },
  {
    name: 'advanced',
    label: $t('template.widgetGroupAdvanced'),
    widgets: [
      {
        type: 'color-picker',
        label: $t('template.widgetColorPicker'),
        icon: 'antdv-next:BgColorsOutlined',
      },
      {
        type: 'radio-image',
        label: $t('template.widgetRadioImage'),
        icon: 'antdv-next:CheckSquareOutlined',
      },
      {
        type: 'preset-select',
        label: $t('template.widgetPresetSelect'),
        icon: 'antdv-next:ProfileOutlined',
      },
    ],
  },
];

const SECTION_ICON_BY_ROLE: Record<TemplateSection['role'], string> = {
  primary: 'antdv-next:LayoutOutlined',
  sidebar: 'antdv-next:BorderRightOutlined',
  full: 'antdv-next:BorderHorizontalOutlined',
  inline: 'antdv-next:BlockOutlined',
};

function sectionIcon(section: TemplateSection): string {
  return SECTION_ICON_BY_ROLE[section.role] ?? 'antdv-next:LayoutOutlined';
}

function onReorderSections(next: TemplateSection[]): void {
  emit('reorder-sections', next);
}

function onDragWidget(event: DragEvent, type: WidgetType): void {
  // 与 LayoutPreview 的 drop 解析约定一致：widget type 写入 'text/plain'
  event.dataTransfer?.setData('text/plain', type);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
  }
}
</script>

<style scoped>
.zone-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--spacing-md);
  background: var(--color-bg-container);
  overflow-y: auto;
}

.zone-panel__section {
  display: flex;
  flex-direction: column;
}

.zone-panel__title {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.zone-panel__divider {
  margin: var(--spacing-md) 0;
}

.zone-panel__empty {
  margin: var(--spacing-sm) 0;
}

.zone-panel__add {
  margin-top: var(--spacing-sm);
}

/* ── 区域列表 ─────────────────────────────────────────── */
.zone-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.zone-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.zone-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-1);
}

.zone-item--active {
  border-color: var(--color-primary);
  background: var(--color-primary-1);
}

.zone-item--ghost {
  opacity: 0.5;
}

.zone-item__handle {
  color: var(--color-text-quaternary);
  cursor: grab;
  display: flex;
  align-items: center;
}

.zone-item__handle:active {
  cursor: grabbing;
}

.zone-item__icon {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.zone-item__label {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-item__count {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-layout);
  border-radius: var(--radius-full);
}

/* ── Widget 组件库 ────────────────────────────────────── */
.widget-group {
  margin-bottom: var(--spacing-md);
}

.widget-group__label {
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.widget-palette {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xs);
}

.widget-draggable {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  background: var(--color-bg-container);
  cursor: grab;
  transition: all var(--duration-fast);
  user-select: none;
}

.widget-draggable:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-1);
  transform: translateY(-1px);
  box-shadow: var(--shadow-card);
}

.widget-draggable:active {
  cursor: grabbing;
}

.widget-draggable__icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.widget-draggable__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
