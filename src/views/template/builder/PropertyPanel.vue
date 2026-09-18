<!-- src/views/template/builder/PropertyPanel.vue -->
<!--
  PropertyPanel — 右侧属性面板的派发容器。

  两个 tab：
    - section: 编辑当前选中区域 (SectionProps)。
    - widget : 先渲染公共属性 (CommonProps)，<a-divider/> 后按
               activeWidget.type 派发到对应的 XxxProps 编辑器。

  数据流：
    - SectionProps          → @update → emit('update-section', patch)
    - CommonProps / XxxProps → @update → emit('update-widget',  patch)

  无选中目标时显示 a-empty 占位。

  注意：15 个 XxxProps 在本批次内并行创建，import 可能暂时悬空，
  全部创建完成后统一 type-check。
-->
<template>
  <div class="property-panel">
    <a-tabs v-model:activeKey="activeTab" size="small" class="property-panel__tabs">
      <a-tab-pane key="section" :tab="$t('template.sectionProps')">
        <SectionProps v-if="activeSection" :section="activeSection" @update="onSectionUpdate" />
        <a-empty v-else class="property-panel__empty" :description="$t('template.selectSection')" />
      </a-tab-pane>

      <a-tab-pane key="widget" :tab="$t('template.widgetProps')">
        <template v-if="activeWidget">
          <a-tabs
            v-model:activeKey="widgetActiveTab"
            size="small"
            class="property-panel__nested-tabs"
          >
            <a-tab-pane key="basic" :tab="$t('template.widgetBasicProps')">
              <CommonProps :widget="activeWidget" @update="onWidgetUpdate" />
            </a-tab-pane>
            <a-tab-pane key="type" :tab="$t('template.widgetTypeProps')">
              <component
                :is="widgetPropsComponent"
                v-if="widgetPropsComponent"
                :widget="activeWidget"
                @update="onWidgetUpdate"
              />
              <a-empty v-else class="property-panel__empty" :description="$t('common.noData')" />
            </a-tab-pane>
          </a-tabs>
        </template>
        <a-empty v-else class="property-panel__empty" :description="$t('template.selectWidget')" />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import type { TemplateSection, WidgetConfig, WidgetType } from '@/types/template-builder';

import { computed, ref, watch, type Component } from 'vue';

import { $t } from '@/locales';

import ActionButtonsProps from './props/ActionButtonsProps.vue';
import ChipInputProps from './props/ChipInputProps.vue';
import ColorPickerProps from './props/ColorPickerProps.vue';
import CommonProps from './props/CommonProps.vue';
import FileUploaderProps from './props/FileUploaderProps.vue';
import ImageSelectProps from './props/ImageSelectProps.vue';
import ImageUploaderProps from './props/ImageUploaderProps.vue';
import InputProps from './props/InputProps.vue';
import NumberProps from './props/NumberProps.vue';
import PresetSelectProps from './props/PresetSelectProps.vue';
import PromptInputProps from './props/PromptInputProps.vue';
import RadioImageProps from './props/RadioImageProps.vue';
import SectionProps from './props/SectionProps.vue';
import SelectProps from './props/SelectProps.vue';
import SliderProps from './props/SliderProps.vue';
import SwitchProps from './props/SwitchProps.vue';
import TextareaProps from './props/TextareaProps.vue';
import ToolbarProps from './props/ToolbarProps.vue';

const props = withDefaults(
  defineProps<{
    activeSection?: TemplateSection | null;
    activeWidget?: WidgetConfig | null;
  }>(),
  {
    activeSection: null,
    activeWidget: null,
  },
);

const emit = defineEmits<{
  (e: 'update-section', patch: Partial<TemplateSection>): void;
  (e: 'update-widget', patch: Record<string, unknown>): void;
}>();

const activeTab = ref<'section' | 'widget'>('section');
const widgetActiveTab = ref<'basic' | 'type'>('basic');

/** 选中 widget 时自动跳到组件属性页；取消 widget 选中后若有区域则回到区域属性页 */
watch(
  () => props.activeWidget,
  (widget) => {
    if (widget) {
      activeTab.value = 'widget';
      widgetActiveTab.value = 'basic';
    } else if (props.activeSection) {
      activeTab.value = 'section';
    }
  },
);
watch(
  () => props.activeSection,
  (section) => {
    if (section && !props.activeWidget) activeTab.value = 'section';
  },
);

/** type → 属性编辑器组件 的静态映射表 (15 个) */
const WIDGET_PROPS_MAP: Record<WidgetType, Component> = {
  input: InputProps,
  textarea: TextareaProps,
  select: SelectProps,
  number: NumberProps,
  switch: SwitchProps,
  slider: SliderProps,
  'image-uploader': ImageUploaderProps,
  'image-select': ImageSelectProps,
  'file-uploader': FileUploaderProps,
  'chip-input': ChipInputProps,
  'action-buttons': ActionButtonsProps,
  toolbar: ToolbarProps,
  'color-picker': ColorPickerProps,
  'radio-image': RadioImageProps,
  'preset-select': PresetSelectProps,
  'prompt-input': PromptInputProps,
};

const widgetPropsComponent = computed<Component | null>(() => {
  const widget = props.activeWidget;
  if (!widget) return null;
  return WIDGET_PROPS_MAP[widget.type] ?? null;
});

function onSectionUpdate(patch: Partial<TemplateSection>): void {
  emit('update-section', patch);
}

function onWidgetUpdate(patch: Record<string, unknown>): void {
  emit('update-widget', patch);
}
</script>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--color-bg-container);
  padding: var(--spacing-md);
  overflow-y: auto;
}

.property-panel__tabs,
.property-panel__nested-tabs {
  flex: 1;
  min-height: 0;
}

.property-panel__nested-tabs :deep(.ant-tabs-nav) {
  margin-bottom: var(--spacing-md);
}

.property-panel__empty {
  margin-top: var(--spacing-xl);
}
</style>
