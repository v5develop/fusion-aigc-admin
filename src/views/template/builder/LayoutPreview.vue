<!-- src/views/template/builder/LayoutPreview.vue -->
<!--
  LayoutPreview — 构建器中间画布。

  职责：
  - 实时预览整张模板：复用批1的 SectionRenderer (mode='builder') 渲染每个 section。
  - 按 layout.mode (stacked / sidebar-right / sidebar-left / two-column-main) 用
    CSS grid/flex 排版；按 section.role (primary/sidebar/full) 把 section 分流到
    主区 / 侧栏 / 全宽容器。
  - 接收从 ZonePanel 原生拖入的 widget：SectionRenderer 把原始 DragEvent 通过
    drop-widget 冒泡上来，这里读取 dataTransfer 里的 widget type 后，向上 emit
    结构化的 drop-widget({ sectionId, type })。
  - 点击 widget / section → 选中事件；透传 reorder / remove；section 删除则
    计算出新的 sections 数组并通过 update:sections 回写。

  本组件是受控组件：自身不持有 config 状态，所有变更都以事件回传给父级
  (BuilderPage)，由父级 mutate config 后再次下发。
-->
<template>
  <div class="layout-preview" :class="`layout-mode--${config.layout.mode}`">
    <div class="preview-container" :style="previewStyle">
      <!-- 模板标题 -->
      <div v-if="config.layout.showTitle && config.name" class="template-title-section">
        <h2 class="template-title">{{ config.name }}</h2>
        <p v-if="config.layout.showDescription && config.description" class="template-description">
          {{ config.description }}
        </p>
      </div>

      <!-- 主区域 section 列表 (primary / inline) -->
      <div class="sections-container">
        <div
          v-for="section in primarySections"
          :key="section.id"
          class="section-wrapper"
          :class="{ 'section-wrapper--active': section.id === activeSectionId }"
          @click.self="onSelectSection(section.id)"
        >
          <SectionRenderer
            :section="section"
            :mode="'builder'"
            :active-widget-key="activeWidgetKey"
            @select-widget="onSelectWidget"
            @remove-widget="onRemoveWidget"
            @reorder-widgets="onReorderWidgets(section.id, $event)"
            @drop-widget="onDropWidget(section.id, $event)"
            @add-widget="emit('add-widget', section.id)"
            @edit-section="onSelectSection(section.id)"
            @remove-section="onRemoveSection(section.id)"
          />
        </div>

        <!-- 主区域空态 -->
        <a-empty
          v-if="primarySections.length === 0"
          class="layout-empty"
          :description="$t('template.emptyCanvas')"
        />
      </div>

      <!-- 侧边栏 section (sidebar-right / sidebar-left 布局) -->
      <div v-if="sidebarSections.length > 0" class="sidebar-container">
        <div
          v-for="section in sidebarSections"
          :key="section.id"
          class="section-wrapper"
          :class="{ 'section-wrapper--active': section.id === activeSectionId }"
          @click.self="onSelectSection(section.id)"
        >
          <SectionRenderer
            :section="section"
            :mode="'builder'"
            :active-widget-key="activeWidgetKey"
            @select-widget="onSelectWidget"
            @remove-widget="onRemoveWidget"
            @reorder-widgets="onReorderWidgets(section.id, $event)"
            @drop-widget="onDropWidget(section.id, $event)"
            @add-widget="emit('add-widget', section.id)"
            @edit-section="onSelectSection(section.id)"
            @remove-section="onRemoveSection(section.id)"
          />
        </div>
      </div>

      <!-- 全宽 section (如 toolbar) -->
      <div v-if="fullSections.length > 0" class="full-width-container">
        <div
          v-for="section in fullSections"
          :key="section.id"
          class="section-wrapper"
          :class="{ 'section-wrapper--active': section.id === activeSectionId }"
          @click.self="onSelectSection(section.id)"
        >
          <SectionRenderer
            :section="section"
            :mode="'builder'"
            :active-widget-key="activeWidgetKey"
            @select-widget="onSelectWidget"
            @remove-widget="onRemoveWidget"
            @reorder-widgets="onReorderWidgets(section.id, $event)"
            @drop-widget="onDropWidget(section.id, $event)"
            @add-widget="emit('add-widget', section.id)"
            @edit-section="onSelectSection(section.id)"
            @remove-section="onRemoveSection(section.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TemplateConfig,
  TemplateSection,
  WidgetConfig,
  WidgetType,
} from '@/types/template-builder';

import { computed, type CSSProperties } from 'vue';

import { $t } from '@/locales';
import SectionRenderer from '@/views/template/renderer/SectionRenderer.vue';

const props = withDefaults(
  defineProps<{
    config: TemplateConfig;
    activeWidgetKey?: string;
    activeSectionId?: string;
  }>(),
  {
    activeWidgetKey: undefined,
    activeSectionId: undefined,
  },
);

const emit = defineEmits<{
  (e: 'drop-widget', payload: { sectionId: string; type: WidgetType }): void;
  (e: 'select-widget', key: string): void;
  (e: 'select-section', sectionId: string): void;
  (e: 'reorder-widgets', sectionId: string, widgets: WidgetConfig[]): void;
  (e: 'remove-widget', key: string): void;
  (e: 'update:sections', sections: TemplateSection[]): void;
  (e: 'add-widget', sectionId: string): void;
}>();

// 默认内容最大宽度，未配置时给出一个合理的画布宽度。
const DEFAULT_MAX_WIDTH = 1200;

// 全部合法的 widget type，用作 dataTransfer 解析时的运行时校验。
const WIDGET_TYPES: readonly WidgetType[] = [
  'input',
  'textarea',
  'select',
  'number',
  'switch',
  'slider',
  'image-uploader',
  'image-select',
  'file-uploader',
  'chip-input',
  'action-buttons',
  'toolbar',
  'color-picker',
  'radio-image',
  'preset-select',
  'prompt-input',
];

function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

const previewStyle = computed<CSSProperties>(() => ({
  maxWidth: `${props.config.layout.maxWidth ?? DEFAULT_MAX_WIDTH}px`,
}));

function bySort(a: TemplateSection, b: TemplateSection): number {
  return a.sort - b.sort;
}

// 主区域：primary 与 inline 都落在主内容流里。
const primarySections = computed<TemplateSection[]>(() =>
  props.config.sections.filter((s) => s.role === 'primary' || s.role === 'inline').sort(bySort),
);

const sidebarSections = computed<TemplateSection[]>(() =>
  props.config.sections.filter((s) => s.role === 'sidebar').sort(bySort),
);

const fullSections = computed<TemplateSection[]>(() =>
  props.config.sections.filter((s) => s.role === 'full').sort(bySort),
);

function onSelectWidget(key: string) {
  emit('select-widget', key);
}

function onRemoveWidget(key: string) {
  emit('remove-widget', key);
}

function onSelectSection(sectionId: string) {
  emit('select-section', sectionId);
}

function onReorderWidgets(sectionId: string, widgets: WidgetConfig[]) {
  emit('reorder-widgets', sectionId, widgets);
}

// SectionRenderer 把原始 DragEvent 冒泡上来；这里解析 dataTransfer 里的 widget
// type（约定写在 'text/plain'，与 ZonePanel / FormDesigner 一致），校验合法后
// 再向上 emit 结构化的 drop-widget。非法 / 内部排序拖拽（无 type）直接忽略。
function onDropWidget(sectionId: string, event: DragEvent) {
  const raw = event.dataTransfer?.getData('text/plain')?.trim();
  if (!raw || !isWidgetType(raw)) {
    return;
  }
  emit('drop-widget', { sectionId, type: raw });
}

// 删除 section：计算出去掉该 section 后的新数组，整体回写。
function onRemoveSection(sectionId: string) {
  emit(
    'update:sections',
    props.config.sections.filter((s) => s.id !== sectionId),
  );
}
</script>

<style scoped>
.layout-preview {
  min-height: 100%;
  padding: var(--spacing-lg);
  background: var(--color-bg-layout);
  overflow: auto;
}

.preview-container {
  margin: 0 auto;
}

/* ── 模板标题 ─────────────────────────────────────────── */
.template-title-section {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.template-title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.template-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

/* ── section 包裹层（提供点击选中 + 选中高亮）─────────── */
.section-wrapper {
  position: relative;
  border-radius: var(--radius-lg);
  transition: box-shadow var(--duration-fast);
}

.section-wrapper--active {
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.layout-empty {
  padding: var(--spacing-xl) 0;
}

/* ============================================================
   布局模式 1: 垂直堆叠 (stacked)
   ============================================================ */
.layout-mode--stacked .preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.layout-mode--stacked .sections-container,
.layout-mode--stacked .sidebar-container,
.layout-mode--stacked .full-width-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ============================================================
   布局模式 2: 右侧参数面板 (sidebar-right)
   主区在左，侧栏在右；全宽区域跨满两列。
   ============================================================ */
.layout-mode--sidebar-right .preview-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-rows: auto 1fr auto;
  gap: var(--spacing-md);
}

.layout-mode--sidebar-right .template-title-section {
  grid-column: 1 / -1;
}

.layout-mode--sidebar-right .sections-container {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.layout-mode--sidebar-right .sidebar-container {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  position: sticky;
  top: var(--spacing-lg);
  align-self: start;
}

.layout-mode--sidebar-right .full-width-container {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ============================================================
   布局模式 3: 左侧参数面板 (sidebar-left)
   侧栏在左，主区在右；全宽区域跨满两列。
   ============================================================ */
.layout-mode--sidebar-left .preview-container {
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: auto 1fr auto;
  gap: var(--spacing-md);
}

.layout-mode--sidebar-left .template-title-section {
  grid-column: 1 / -1;
}

.layout-mode--sidebar-left .sidebar-container {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  position: sticky;
  top: var(--spacing-lg);
  align-self: start;
}

.layout-mode--sidebar-left .sections-container {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.layout-mode--sidebar-left .full-width-container {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ============================================================
   布局模式 4: 双列主区 (two-column-main)
   主区 section 排成两列网格；侧栏（若有）与全宽区域占满整行。
   ============================================================ */
.layout-mode--two-column-main .preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.layout-mode--two-column-main .sections-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
  align-items: start;
}

.layout-mode--two-column-main .sidebar-container,
.layout-mode--two-column-main .full-width-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── 空态在双列网格中跨满 ─────────────────────────────── */
.layout-mode--two-column-main .sections-container .layout-empty {
  grid-column: 1 / -1;
}

/* ============================================================
   响应式：窄屏下侧栏/双列回退为单列堆叠
   ============================================================ */
@media (max-width: 1024px) {
  .layout-mode--sidebar-right .preview-container,
  .layout-mode--sidebar-left .preview-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .layout-mode--sidebar-right .sidebar-container,
  .layout-mode--sidebar-left .sidebar-container {
    position: static;
    order: 999;
  }

  .layout-mode--two-column-main .sections-container {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
