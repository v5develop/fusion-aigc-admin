<!-- src/views/template/TemplateEditor.vue -->
<template>
  <div class="template-editor">
    <EditorHeader
      :name="config.name"
      :saving="saving"
      @back="handleBack"
      @update:name="onNameUpdate"
      @preview="handlePreview"
      @save="handleSaveDraft"
      @publish="handlePublish"
    />
    <div class="editor-body">
      <div class="editor-left">
        <ZonePanel
          :sections="config.sections"
          :active-section-id="activeSectionId ?? undefined"
          @select-section="selectSection"
          @add-section="addSection"
          @reorder-sections="reorderSections"
        />
      </div>
      <div class="editor-center">
        <LayoutPreview
          :config="config"
          :active-widget-key="activeWidgetKey ?? undefined"
          :active-section-id="activeSectionId ?? undefined"
          @drop-widget="onDropWidget"
          @select-widget="selectWidget"
          @select-section="selectSection"
          @reorder-widgets="reorderWidgets"
          @remove-widget="removeWidget"
          @update:sections="onUpdateSections"
          @add-widget="onAddWidget"
        />
      </div>
      <div class="editor-right">
        <PropertyPanel
          :active-section="activeSection"
          :active-widget="activeWidget"
          @update-section="onUpdateSection"
          @update-widget="onUpdateWidget"
        />
      </div>
    </div>
    <a-modal
      v-model:open="previewVisible"
      :title="$t('template.previewTemplate')"
      width="90vw"
      :footer="null"
    >
      <TemplateRenderer :config="config" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type {
  TemplateConfig,
  TemplateSection,
  LayoutMode,
  WidgetConfig,
  WidgetType,
} from '@/types/template-builder';

import { message } from 'antdv-next';
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  getTemplateDetail,
  createTemplate,
  updateTemplate,
  type TemplateFormData,
} from '@/api/template';
import { useTemplateBuilder } from '@/composables/useTemplateBuilder';
import { $t } from '@/locales';

import EditorHeader from './builder/EditorHeader.vue';
import LayoutPreview from './builder/LayoutPreview.vue';
import PropertyPanel from './builder/PropertyPanel.vue';
import ZonePanel from './builder/ZonePanel.vue';
import TemplateRenderer from './renderer/TemplateRenderer.vue';

const route = useRoute();
const router = useRouter();
const templateId = route.params.id as string | undefined;
const isEdit = !!templateId;
const saving = ref(false);
const previewVisible = ref(false);

const {
  config,
  activeSectionId,
  activeWidgetKey,
  activeSection,
  activeWidget,
  addSection,
  updateSection: updSec,
  selectSection,
  selectWidget,
  removeWidget,
  reorderWidgets,
  reorderSections,
  loadFromConfig,
  buildVariableMapping,
} = useTemplateBuilder();

function makeWidget(type: WidgetType): WidgetConfig {
  const key = type + '_' + Date.now();
  const m: Record<string, string> = {
    input: '文本输入',
    textarea: '多行文本',
    select: '下拉选择',
    number: '数字输入',
    switch: '开关',
    slider: '滑块',
    'image-uploader': '图片上传',
    'image-select': '图片选择',
    'file-uploader': '文件上传',
    'chip-input': '标签输入',
    'action-buttons': '快捷操作',
    toolbar: '工具栏',
    'color-picker': '颜色选择',
    'radio-image': '图片单选',
    'preset-select': '预设方案',
    'prompt-input': '提示词输入',
  };
  const b = { key, label: m[type] || type, type, placeholder: '', required: false };
  if (type === 'select')
    return { ...b, type, options: [{ label: '选项1', value: '1' }] } as WidgetConfig;
  if (type === 'number' || type === 'slider')
    return { ...b, type, min: 0, max: 100 } as WidgetConfig;
  if (type === 'image-uploader')
    return { ...b, type, maxCount: 5, previewSize: 'medium' } as WidgetConfig;
  if (type === 'action-buttons')
    return { ...b, type, buttons: [{ key: 'btn_1', label: '示例' }] } as WidgetConfig;
  if (type === 'toolbar')
    return {
      ...b,
      type,
      items: [{ key: 't1', label: '选项', icon: 'antdv-next:AppstoreOutlined' }],
    } as WidgetConfig;
  if (type === 'chip-input')
    return { ...b, type, minHeight: 120, allowCustomInput: true } as WidgetConfig;
  if (type === 'prompt-input')
    return {
      ...b,
      type,
      template: '上传{{productImage}}，生成电商主图，商品名称是{{productName}}',
      slots: [
        { key: 'productImage', slotType: 'image', label: '产品图' },
        { key: 'productName', slotType: 'text', label: '商品名称', placeholder: '请输入商品名称' },
      ],
    } as WidgetConfig;
  return { ...b, type } as WidgetConfig;
}

async function loadTemplate() {
  if (!templateId) return;
  try {
    const res = await getTemplateDetail(templateId);
    const raw = res as unknown as Record<string, unknown>;
    let sections: TemplateSection[] = [];
    if (Array.isArray(raw.sections)) sections = raw.sections as TemplateSection[];
    else if (res.formSchema && Array.isArray(res.formSchema))
      sections = [
        {
          id: 'form-zone',
          title: '表单',
          role: 'primary',
          sort: 0,
          widgets: res.formSchema.map(
            (f: { key: string; label: string; type?: string; required?: boolean }) =>
              ({
                key: f.key,
                label: f.label,
                type: f.type === 'upload' ? 'image-uploader' : f.type || 'input',
                required: !!f.required,
              }) as WidgetConfig,
          ),
        },
      ];
    let mode: LayoutMode = 'stacked';
    if (raw.layout && typeof raw.layout === 'object')
      mode = (raw.layout as { mode?: LayoutMode }).mode || 'stacked';
    else if (res.uiConfig?.layout === 'tabs') mode = 'sidebar-right';
    loadFromConfig({
      id: res.id,
      name: res.name,
      category: (res.category as TemplateConfig['category']) || 'image',
      mode: (res.mode as TemplateConfig['mode']) || 'image',
      description: res.description,
      coverUrl: res.coverUrl,
      iconUrl: res.iconUrl,
      layout: {
        mode,
        theme: (res.uiConfig?.theme as TemplateConfig['layout']['theme']) || 'default',
        maxWidth: 1200,
        showTitle: true,
        showDescription: !!res.description,
      },
      sections,
      promptTemplate: res.promptTemplate || '',
      executionConfig: res.executionConfig || { handler: '', model: '', defaultParams: {} },
      meta: {
        version: res.version || 1,
        usageCount: res.usageCount || 0,
        enabled: res.enabled || 1,
        sort: res.sort || 0,
      },
    });
  } catch {
    message.error($t('template.loadFailed'));
  }
}
function initNew() {
  config.value.id = 'tpl_' + Date.now();
}

function onNameUpdate(v: string) {
  config.value.name = v;
}
function onDropWidget(p: { sectionId: string; type: WidgetType }) {
  const w = makeWidget(p.type);
  config.value.sections = config.value.sections.map((s) =>
    s.id === p.sectionId ? { ...s, widgets: [...s.widgets, w] } : s,
  );
  selectWidget(w.key);
}
function onAddWidget(sectionId: string) {
  // 复制当前选中的 widget，如果没有选中则默认复制 input
  const source = activeWidget.value || makeWidget('input');
  const w = JSON.parse(JSON.stringify(source)) as WidgetConfig;
  w.key = source.type + '_' + Date.now();
  config.value.sections = config.value.sections.map((s) =>
    s.id === sectionId ? { ...s, widgets: [...s.widgets, w] } : s,
  );
  selectWidget(w.key);
}
function onUpdateSection(patch: Partial<TemplateSection>) {
  if (activeSectionId.value) updSec(activeSectionId.value, patch);
}
function onUpdateWidget(patch: Record<string, unknown>) {
  if (!activeWidgetKey.value) return;
  config.value.sections = config.value.sections.map((s) => {
    const i = s.widgets.findIndex((w) => w.key === activeWidgetKey.value);
    return i === -1
      ? s
      : {
          ...s,
          widgets: s.widgets.map((w, j) => (j === i ? ({ ...w, ...patch } as WidgetConfig) : w)),
        };
  });
}
function onUpdateSections(sections: TemplateSection[]) {
  config.value.sections = sections;
}

async function doSave(publish = false) {
  if (!config.value.id || !config.value.name) {
    message.error($t('template.fillRequired'));
    return;
  }
  saving.value = true;
  try {
    const d: TemplateFormData = {
      id: config.value.id,
      name: config.value.name,
      category: config.value.category,
      mode: config.value.mode,
      description: config.value.description,
      coverUrl: config.value.coverUrl,
      iconUrl: config.value.iconUrl,
      formSchema: config.value.sections,
      promptTemplate: config.value.promptTemplate,
      variableMapping: buildVariableMapping(),
      executionConfig: config.value.executionConfig,
      uiConfig: { layout: config.value.layout.mode, theme: config.value.layout.theme || 'default' },
      enabled: publish ? 1 : 0,
      sort: config.value.meta?.sort || 0,
    };
    if (isEdit) {
      await updateTemplate(templateId!, d);
      message.success($t('common.success'));
    } else {
      await createTemplate(d);
      message.success($t('common.success'));
      router.push('/content/templates');
    }
  } catch {
    message.error($t('common.error'));
  } finally {
    saving.value = false;
  }
}

function handleSaveDraft() {
  doSave(false);
}
function handlePublish() {
  doSave(true);
}
function handlePreview() {
  previewVisible.value = true;
}
function handleBack() {
  router.push('/content/templates');
}
onMounted(() => {
  if (isEdit) {
    loadTemplate();
  } else {
    initNew();
  }
});
</script>

<style scoped>
.template-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-layout);
}
.editor-body {
  display: grid;
  grid-template-columns: 240px 1fr 360px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor-left {
  background: var(--color-bg-container);
  border-right: 1px solid var(--color-border-secondary);
  overflow: hidden;
}
.editor-center {
  overflow: hidden;
}
.editor-right {
  background: var(--color-bg-container);
  border-left: 1px solid var(--color-border-secondary);
  overflow: hidden;
}
</style>
