// src/composables/useTemplateBuilder.ts
//
// 模板构建器状态管理 — BuilderPage 的单一状态源。
//
// 管理内容：TemplateConfig / sections / widgets 的 CRUD + 选中态 +
//          拖入创建 widget + 数据加载/保存。
//
// 所有变更通过本 composable 暴露的方法进行，确保表单值一致性。

import type {
  TemplateConfig,
  TemplateSection,
  WidgetConfig,
  WidgetType,
  LayoutConfig,
} from '@/types/template-builder';

import { ref, computed, toRaw, type Ref } from 'vue';

// ============================================================
// 默认值
// ============================================================

const DEFAULT_LAYOUT: LayoutConfig = {
  mode: 'stacked',
  theme: 'default',
  maxWidth: 1200,
  showTitle: true,
  showDescription: true,
};

function createDefaultConfig(): TemplateConfig {
  return {
    id: '',
    name: '',
    category: 'image',
    mode: 'image',
    description: '',
    coverUrl: '',
    iconUrl: '',
    layout: { ...DEFAULT_LAYOUT },
    sections: [],
    promptTemplate: '',
    executionConfig: {
      handler: '',
      model: '',
      defaultParams: {},
      pricePoints: 0,
    },
    meta: {
      version: 1,
      usageCount: 0,
      enabled: 1,
      sort: 0,
    },
  };
}

// ============================================================
// Widget 创建工厂
// ============================================================

function makeDefaultWidget(type: WidgetType): WidgetConfig {
  const key = `${type}_${Date.now()}`;
  const labelMap: Record<string, string> = {
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
  const base = {
    key,
    label: labelMap[type] || type,
    type,
    placeholder: '',
    required: false,
  };

  switch (type) {
    case 'select':
      return { ...base, type, options: [{ label: '选项1', value: '1' }] };
    case 'number':
      return { ...base, type, min: 0, max: 100, step: 1 };
    case 'slider':
      return { ...base, type, min: 0, max: 100, step: 1 };
    case 'image-uploader':
      return { ...base, type, maxCount: 5, previewSize: 'medium', showDragHint: true };
    case 'action-buttons':
      return {
        ...base,
        type,
        buttons: [{ key: 'action_1', label: '示例操作' }],
        direction: 'horizontal',
        buttonStyle: 'outlined',
      };
    case 'toolbar':
      return {
        ...base,
        type,
        items: [{ key: 'tab_1', label: '选项1', icon: 'antdv-next:appstore-outlined' }],
        position: 'inline',
        showLabel: true,
        iconSize: 'medium',
      };
    case 'chip-input':
      return { ...base, type, minHeight: 120, allowCustomInput: true, removable: true };
    case 'radio-image':
      return {
        ...base,
        type,
        columns: 3,
        imageSize: 'medium',
        showCheckmark: true,
        options: [{ label: '选项1', value: '1', imageUrl: '' }],
      };
    case 'preset-select':
      return {
        ...base,
        type,
        presets: [{ id: 'preset_1', label: '预设1', values: {} }],
        displayMode: 'cards',
      };
    case 'image-select':
      return {
        ...base,
        type,
        columns: 3,
        imageSize: 'medium',
        showLabel: true,
        options: [{ label: '选项1', value: '1', imageUrl: '' }],
      };
    case 'prompt-input':
      return {
        ...base,
        type,
        template: '上传{{productImage}}，生成电商主图，商品名称是{{productName}}',
        slots: [
          { key: 'productImage', slotType: 'image', label: '产品图' },
          {
            key: 'productName',
            slotType: 'text',
            label: '商品名称',
            placeholder: '请输入商品名称',
          },
        ],
      };
    default:
      return { ...base, type } as WidgetConfig;
  }
}

// ============================================================
// Composable
// ============================================================

export function useTemplateBuilder() {
  const config = ref<TemplateConfig>(createDefaultConfig());
  const activeSectionId = ref<string | null>(null);
  const activeWidgetKey = ref<string | null>(null);

  // 计算属性：当前选中的 section / widget
  const activeSection = computed<TemplateSection | null>(
    () => config.value.sections.find((s) => s.id === activeSectionId.value) ?? null,
  );

  const activeWidget = computed<WidgetConfig | null>(() => {
    for (const section of config.value.sections) {
      const w = section.widgets.find((item) => item.key === activeWidgetKey.value);
      if (w) return w;
    }
    return null;
  });

  // ====== Basic Info ======

  function updateBasic(patch: Partial<TemplateConfig>) {
    Object.assign(config.value, patch);
  }

  function updateLayout(patch: Partial<LayoutConfig>) {
    Object.assign(config.value.layout, patch);
  }

  // ====== Section CRUD ======

  function addSection(): string {
    const sort = config.value.sections.length;
    const section: TemplateSection = {
      id: `section_${Date.now()}`,
      title: `区域 ${sort + 1}`,
      role: 'primary',
      widgets: [],
      sort,
    };
    config.value.sections = [...config.value.sections, section];
    activeSectionId.value = section.id;
    activeWidgetKey.value = null;
    return section.id;
  }

  function removeSection(sectionId: string): void {
    // 清除选中的 widget（如果在被删 section 里）
    const section = config.value.sections.find((s) => s.id === sectionId);
    if (section?.widgets.some((w) => w.key === activeWidgetKey.value)) {
      activeWidgetKey.value = null;
    }
    if (activeSectionId.value === sectionId) {
      activeSectionId.value = null;
    }
    config.value.sections = config.value.sections
      .filter((s) => s.id !== sectionId)
      .map((s, i) => ({ ...s, sort: i }));
  }

  function updateSection(sectionId: string, patch: Partial<TemplateSection>): void {
    config.value.sections = config.value.sections.map((s) =>
      s.id === sectionId ? { ...s, ...patch } : s,
    );
  }

  function reorderSections(sorted: TemplateSection[]): void {
    config.value.sections = sorted.map((s, i) => ({ ...s, sort: i }));
  }

  // ====== Widget CRUD ======

  function addWidget(sectionId: string, type: WidgetType): string {
    const widget = makeDefaultWidget(type);
    config.value.sections = config.value.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, widgets: [...s.widgets, widget] };
    });
    activeWidgetKey.value = widget.key;
    return widget.key;
  }

  function removeWidget(widgetKey: string): void {
    if (activeWidgetKey.value === widgetKey) {
      activeWidgetKey.value = null;
    }
    config.value.sections = config.value.sections.map((s) => ({
      ...s,
      widgets: s.widgets.filter((w) => w.key !== widgetKey),
    }));
  }

  function updateWidget(widgetKey: string, patch: Record<string, unknown>): void {
    config.value.sections = config.value.sections.map((s) => {
      const idx = s.widgets.findIndex((w) => w.key === widgetKey);
      if (idx === -1) return s;
      const updated = s.widgets.map((w, i) =>
        i === idx ? ({ ...w, ...patch } as WidgetConfig) : w,
      );
      return { ...s, widgets: updated };
    });
  }

  function reorderWidgets(sectionId: string, widgets: WidgetConfig[]): void {
    config.value.sections = config.value.sections.map((s) =>
      s.id === sectionId ? { ...s, widgets } : s,
    );
  }

  // ====== Selection ======

  function selectSection(sectionId: string): void {
    activeSectionId.value = sectionId;
    activeWidgetKey.value = null;
  }

  function selectWidget(widgetKey: string): void {
    activeWidgetKey.value = widgetKey;
    // 同时选中该 widget 所在的 section
    for (const s of config.value.sections) {
      if (s.widgets.some((w) => w.key === widgetKey)) {
        activeSectionId.value = s.id;
        break;
      }
    }
  }

  // ====== Data Loading / Saving ======

  function loadFromConfig(data: TemplateConfig): void {
    config.value = {
      ...createDefaultConfig(),
      ...data,
      layout: { ...DEFAULT_LAYOUT, ...data.layout },
      sections: data.sections ?? [],
      meta: {
        version: data.meta?.version ?? 1,
        usageCount: data.meta?.usageCount ?? 0,
        enabled: data.meta?.enabled ?? 1,
        sort: data.meta?.sort ?? 0,
        createTime: data.meta?.createTime,
        updateTime: data.meta?.updateTime,
      },
      executionConfig: {
        handler: '',
        model: '',
        defaultParams: {},
        pricePoints: 0,
        ...data.executionConfig,
      },
    };
    activeSectionId.value = null;
    activeWidgetKey.value = null;
  }

  function toConfig(): TemplateConfig {
    return toRaw(config.value);
  }

  // ====== Variable Mapping ======

  function buildVariableMapping(): Record<
    string,
    {
      source: string;
      type: string;
      widgetType: string;
      sectionId: string;
    }
  > {
    const mapping: Record<
      string,
      {
        source: string;
        type: string;
        widgetType: string;
        sectionId: string;
      }
    > = {};

    const prompt = config.value.promptTemplate;
    const matches = prompt.match(/\{\{(\w+)\}\}/g);
    if (!matches) return mapping;

    for (const match of matches) {
      const varName = match.slice(2, -2);
      for (const section of config.value.sections) {
        const widget = section.widgets.find((w) => w.key === varName);
        if (widget) {
          let mapType = 'direct';
          if (
            widget.type === 'select' ||
            widget.type === 'image-select' ||
            widget.type === 'radio-image'
          )
            mapType = 'enum';
          if (widget.type === 'image-uploader') mapType = 'image-ref';
          mapping[varName] = {
            source: varName,
            type: mapType,
            widgetType: widget.type,
            sectionId: section.id,
          };
          break;
        }
      }
    }
    return mapping;
  }

  return {
    // 状态
    config: config as Ref<TemplateConfig>,
    activeSectionId,
    activeWidgetKey,
    activeSection,
    activeWidget,

    // 基本信息
    updateBasic,
    updateLayout,

    // Section
    addSection,
    removeSection,
    updateSection,
    reorderSections,

    // Widget
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,

    // 选择
    selectSection,
    selectWidget,

    // 数据
    loadFromConfig,
    toConfig,
    buildVariableMapping,
  };
}
