<!-- src/views/template/renderer/WidgetRenderer.vue -->
<!--
  WidgetRenderer — 按 config.type 动态派发到对应 widget 渲染器组件。

  - 使用一张静态 import 的 type→component 映射表 (15 个组件)。
  - 通过 <component :is> 派发，把 props 原样透传给子组件，
    并把子组件的 update:form-values 事件冒泡上去。

  注意：本批次提交时，部分 widget 子组件可能尚未创建，
  import 会暂时悬空；全部 15 个组件并行创建完成后统一 type-check。
-->
<template>
  <component
    :is="resolvedComponent"
    :config="config"
    :mode="mode"
    :form-values="formValues"
    :is-selected="isSelected"
    @update:form-values="onUpdateFormValues"
  />
</template>

<script setup lang="ts">
import type { RenderMode, WidgetConfig, WidgetType } from '@/types/template-builder';

import { computed, type Component } from 'vue';

import ActionButtonsWidget from './widgets/ActionButtonsWidget.vue';
import ChipInputWidget from './widgets/ChipInputWidget.vue';
import ColorPickerWidget from './widgets/ColorPickerWidget.vue';
import FileUploaderWidget from './widgets/FileUploaderWidget.vue';
import ImageSelectWidget from './widgets/ImageSelectWidget.vue';
import ImageUploaderWidget from './widgets/ImageUploaderWidget.vue';
import InputWidget from './widgets/InputWidget.vue';
import NumberWidget from './widgets/NumberWidget.vue';
import PresetSelectWidget from './widgets/PresetSelectWidget.vue';
import PromptInputWidget from './widgets/PromptInputWidget.vue';
import RadioImageWidget from './widgets/RadioImageWidget.vue';
import SelectWidget from './widgets/SelectWidget.vue';
import SliderWidget from './widgets/SliderWidget.vue';
import SwitchWidget from './widgets/SwitchWidget.vue';
import TextareaWidget from './widgets/TextareaWidget.vue';
import ToolbarWidget from './widgets/ToolbarWidget.vue';

const props = withDefaults(
  defineProps<{
    config: WidgetConfig;
    mode: RenderMode;
    formValues?: Record<string, unknown>;
    isSelected?: boolean;
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
);

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void;
}>();

/** type → 渲染器组件 的静态映射表 */
const WIDGET_COMPONENT_MAP: Record<WidgetType, Component> = {
  input: InputWidget,
  textarea: TextareaWidget,
  select: SelectWidget,
  number: NumberWidget,
  switch: SwitchWidget,
  slider: SliderWidget,
  'image-uploader': ImageUploaderWidget,
  'image-select': ImageSelectWidget,
  'file-uploader': FileUploaderWidget,
  'chip-input': ChipInputWidget,
  'action-buttons': ActionButtonsWidget,
  toolbar: ToolbarWidget,
  'color-picker': ColorPickerWidget,
  'radio-image': RadioImageWidget,
  'preset-select': PresetSelectWidget,
  'prompt-input': PromptInputWidget,
};

const resolvedComponent = computed<Component>(() => WIDGET_COMPONENT_MAP[props.config.type]);

function onUpdateFormValues(key: string, value: unknown) {
  emit('update:form-values', key, value);
}
</script>
