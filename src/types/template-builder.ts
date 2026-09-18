// src/types/template-builder.ts
//
// V2 模板页面构建器 — 类型契约地基
//
// 该文件是 SectionRenderer / WidgetRenderer 以及全部 15 个 widget 渲染器
// 的共同依赖。所有类型均以 `type` 字段作为判别式 (discriminated union)，
// 保证 `WidgetConfig` 在 `switch (config.type)` 或 `config.type === 'xxx'`
// 时能被 TypeScript 精确收窄到对应的 XxxWidgetConfig。
//
// 严格 TS：无 any、无 @ts-ignore。

// ============================================================
// 顶层配置
// ============================================================

/**
 * 模板顶层配置 — 替代现有的扁平 formSchema 结构
 */
export interface TemplateConfig {
  /** 模板唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板分类 */
  category: 'ecommerce' | 'image' | 'video' | 'agent';
  /** 生成模式 */
  mode: 'agent' | 'image' | 'video';
  /** 描述 */
  description?: string;
  /** 封面图 URL */
  coverUrl?: string;
  /** 图标 URL */
  iconUrl?: string;

  /**
   * 布局配置 — 替代旧 uiConfig.layout/theme
   */
  layout: LayoutConfig;

  /**
   * 区域列表 — 按顺序渲染
   * 替代旧 formSchema (扁平表单字段数组)
   */
  sections: TemplateSection[];

  /**
   * Prompt 模板 — 保持兼容
   * 变量来自所有 section 中的 widget 输出
   */
  promptTemplate: string;

  /**
   * 变量映射 — 自动从 sections 中提取
   * 保持兼容旧 variableMapping
   */
  variableMapping?: Record<string, VariableMappingEntry>;

  /**
   * 执行配置 — 保持兼容
   */
  executionConfig?: ExecutionConfig;

  /**
   * 元信息
   */
  meta?: TemplateMeta;
}

/** 变量映射条目 */
export interface VariableMappingEntry {
  /** widget key */
  source: string;
  /** 映射类型 */
  type: 'direct' | 'dict' | 'enum' | 'image-ref' | 'multi-image';
  /** 来源 widget 类型 */
  widgetType: string;
  /** 来源 section ID */
  sectionId: string;
}

/** 执行配置 (保持兼容) */
export interface ExecutionConfig {
  handler: string;
  model: string;
  defaultParams?: Record<string, unknown>;
  pricePoints?: number;
}

/** 模板元信息 */
export interface TemplateMeta {
  version: number;
  usageCount: number;
  enabled: number;
  sort: number;
  createTime?: string;
  updateTime?: string;
}

// ============================================================
// 布局配置
// ============================================================

/**
 * 布局配置 — 定义整体页面布局
 */
export interface LayoutConfig {
  /**
   * 布局模式
   * - 'stacked': 垂直堆叠（默认），section 从上到下排列
   * - 'sidebar-right': 右侧参数面板，左侧为主要区域
   * - 'sidebar-left': 左侧参数面板，右侧为主要区域
   * - 'two-column-main': 双列，左侧预览区+右侧操作区
   */
  mode: LayoutMode;

  /** 主题色 (覆盖全局主题) */
  theme?: 'default' | 'dark' | 'brand';

  /** 最大内容宽度 */
  maxWidth?: number;

  /** 是否显示模板标题 */
  showTitle?: boolean;

  /** 是否显示模板描述 */
  showDescription?: boolean;
}

export type LayoutMode = 'stacked' | 'sidebar-right' | 'sidebar-left' | 'two-column-main';

// ============================================================
// 区域
// ============================================================

/**
 * 模板区域 — 页面中的一个独立区块
 */
export interface TemplateSection {
  /** 区域唯一 ID (如 'upload-zone', 'input-zone') */
  id: string;

  /** 区域标题 (可选，如 "上传产品图", "描述你想要的效果") */
  title?: string;

  /** 区域副标题 (可选) */
  subtitle?: string;

  /**
   * 区域类型 — 决定该区域在哪种布局模式下的位置
   * - 'primary': 主要内容区域 (在 sidebar 布局中占据主区域)
   * - 'sidebar': 侧边栏区域 (在 sidebar 布局中占据侧边栏)
   * - 'full': 全宽区域 (始终占满宽度，如 toolbar)
   * - 'inline': 内联区域 (可与其他区域共享一行)
   */
  role: 'primary' | 'sidebar' | 'full' | 'inline';

  /** 区域内的 Widget 列表 */
  widgets: WidgetConfig[];

  /** 区域背景色 (CSS 颜色值或 CSS 变量) */
  backgroundColor?: string;

  /** 区域内边距 (px) */
  padding?: number | Spacing;

  /** 是否可折叠 */
  collapsible?: boolean;

  /** 默认是否折叠 */
  collapsedByDefault?: boolean;

  /** 显示序号 */
  sort: number;
}

/** 间距 */
export interface Spacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

// ============================================================
// Widget 基础定义
// ============================================================

/**
 * Widget 基础配置 — 所有 Widget 的公共字段
 */
export interface WidgetBase {
  /** Widget 唯一 key (用作变量名，如 'productImage', 'style') */
  key: string;

  /** Widget 显示标签 */
  label: string;

  /** Widget 类型 */
  type: WidgetType;

  /** 占位提示文本 */
  placeholder?: string;

  /** 是否必填 */
  required?: boolean;

  /** 默认值 */
  defaultValue?: unknown;

  /** 帮助文本 (tooltip) */
  helpText?: string;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否隐藏 */
  hidden?: boolean;

  /** 自定义 CSS 类名 */
  className?: string;

  /** 排序 (区域内) */
  sort?: number;
}

/**
 * 所有支持的 Widget 类型
 */
export type WidgetType =
  // === 基础表单控件 (兼容旧 formSchema) ===
  | 'input' // 单行文本
  | 'textarea' // 多行文本
  | 'select' // 下拉选择
  | 'number' // 数字输入
  | 'switch' // 开关
  | 'slider' // 滑块

  // === 富媒体控件 (新增) ===
  | 'image-uploader' // 图片上传 (多图 + 预览 + 拖拽排序)
  | 'image-select' // 图片选择器 (从预设选项中选择)
  | 'file-uploader' // 文件上传 (通用)

  // === 交互控件 (新增) ===
  | 'chip-input' // Chip 标签输入 (文本 + 交互式标签)
  | 'action-buttons' // 快捷操作按钮组
  | 'toolbar' // 底部工具栏

  // === 高级控件 (新增) ===
  | 'color-picker' // 颜色选择器
  | 'radio-image' // 图片单选 (如风格选择)
  | 'preset-select' // 预设方案选择 (一组关联选项)

  // === 提示词输入 (新增) ===
  | 'prompt-input'; // 内联提示词输入 (文本 + 嵌入式控件)

// ============================================================
// Widget 配置联合类型 — 以 `type` 字段判别 (discriminated union)
// ============================================================

/** Widget 配置联合类型 */
export type WidgetConfig =
  | InputWidgetConfig
  | TextareaWidgetConfig
  | SelectWidgetConfig
  | NumberWidgetConfig
  | SwitchWidgetConfig
  | SliderWidgetConfig
  | ImageUploaderWidgetConfig
  | ImageSelectWidgetConfig
  | FileUploaderWidgetConfig
  | ChipInputWidgetConfig
  | ActionButtonsWidgetConfig
  | ToolbarWidgetConfig
  | ColorPickerWidgetConfig
  | RadioImageWidgetConfig
  | PresetSelectWidgetConfig
  | PromptInputWidgetConfig;

// ============================================================
// 每种 Widget 的完整配置
// ============================================================

// ─── 基础表单控件 ─────────────────────────────────────────

export interface InputWidgetConfig extends WidgetBase {
  type: 'input';
  /** 输入框类型 */
  inputType?: 'text' | 'password' | 'email' | 'url';
  /** 最大长度 */
  maxLength?: number;
  /** 最小长度 */
  minLength?: number;
  /** 前缀图标 */
  prefixIcon?: string;
  /** 后缀文本 */
  suffix?: string;
  /** 自动调整高度 (多行模式) */
  autoSize?: boolean;
}

export interface TextareaWidgetConfig extends WidgetBase {
  type: 'textarea';
  /** 最小行数 */
  minRows?: number;
  /** 最大行数 */
  maxRows?: number;
  /** 自动调整高度 */
  autoSize?: boolean;
  /** 最大字符数 */
  maxLength?: number;
  /** 显示字数统计 */
  showCount?: boolean;
}

export interface SelectWidgetConfig extends WidgetBase {
  type: 'select';
  /** 选项 */
  options: SelectOption[];
  /** 是否多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  showSearch?: boolean;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 标签渲染模式 (多选时) */
  tagRenderMode?: 'default' | 'chip';
}

export interface SelectOption {
  label: string;
  value: string;
  /** 选项图标 URL */
  icon?: string;
  /** 选项描述 */
  description?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface NumberWidgetConfig extends WidgetBase {
  type: 'number';
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 精度 (小数位数) */
  precision?: number;
  /** 单位 */
  unit?: string;
  /** 显示增减按钮 */
  showButtons?: boolean;
}

export interface SwitchWidgetConfig extends WidgetBase {
  type: 'switch';
  /** 选中时的值 */
  checkedValue?: string | number | boolean;
  /** 未选中时的值 */
  uncheckedValue?: string | number | boolean;
  /** 选中时显示的文本 */
  checkedText?: string;
  /** 未选中时显示的文本 */
  uncheckedText?: string;
}

export interface SliderWidgetConfig extends WidgetBase {
  type: 'slider';
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 刻度标记 */
  marks?: Record<number, string>;
  /** 是否显示输入框 */
  showInput?: boolean;
  /** 范围模式 */
  range?: boolean;
}

// ─── 图片上传器 ───────────────────────────────────────────

export interface ImageUploaderWidgetConfig extends WidgetBase {
  type: 'image-uploader';
  /** 最大上传数量 */
  maxCount?: number;
  /** 最小上传数量 (如 1) */
  minCount?: number;
  /** 支持的图片格式 (如 'image/png,image/jpeg,image/webp') */
  accept?: string;
  /** 单张图片最大大小 (MB) */
  maxSizeMB?: number;
  /** 上传按钮文本 */
  uploadButtonText?: string;
  /** 推荐尺寸提示 (如 '800x800') */
  recommendedSize?: string;
  /** 推荐宽高比 (如 '1:1', '3:4', '16:9') */
  aspectRatio?: string;
  /** 预览尺寸 */
  previewSize?: 'small' | 'medium' | 'large';
  /** 是否显示拖拽提示 */
  showDragHint?: boolean;
  /** 默认展示的示例图片 URL 列表 */
  exampleImages?: string[];
  /** 是否允许拖拽排序 */
  sortable?: boolean;
}

/**
 * 图片上传器 widget 的运行时值条目。
 * value 形态：UploadedImage[]（viewer 模式由用户上传产生）。
 */
export interface UploadedImage {
  /** 可访问的图片 URL (本地预览的 objectURL 或上传后的远端地址) */
  url: string;
  /** 原始文件名 (可选) */
  name?: string;
  /** 文件大小 (字节，可选) */
  size?: number;
  /** 上传后的远端持久化地址 (可选) */
  remoteUrl?: string;
}

// ─── 图片选择器 ───────────────────────────────────────────

export interface ImageSelectWidgetConfig extends WidgetBase {
  type: 'image-select';
  /** 图片选项 */
  options: ImageSelectOption[];
  /** 选中模式 */
  mode?: 'single' | 'multiple';
  /** 列数 */
  columns?: number;
  /** 图片显示尺寸 */
  imageSize?: 'small' | 'medium' | 'large';
  /** 是否显示标签 */
  showLabel?: boolean;
}

export interface ImageSelectOption {
  label: string;
  value: string;
  /** 图片 URL */
  imageUrl: string;
  /** 缩略图 URL (可选) */
  thumbnailUrl?: string;
  /** 描述 */
  description?: string;
  /** 徽章文本 (如 "热门", "推荐") */
  badge?: string;
}

// ─── 文件上传器 ───────────────────────────────────────────

export interface FileUploaderWidgetConfig extends WidgetBase {
  type: 'file-uploader';
  /** 最大上传数量 */
  maxCount?: number;
  /** 支持的文件类型 */
  accept?: string;
  /** 最大文件大小 (MB) */
  maxSizeMB?: number;
  /** 上传提示 */
  dragHint?: string;
}

// ─── Chip 标签输入 — 核心交互控件 ──────────────────────────

export interface ChipInputWidgetConfig extends WidgetBase {
  type: 'chip-input';
  /** 输入框高度 (px) */
  minHeight?: number;
  /** 最大输入字符数 */
  maxLength?: number;
  /** 预置标签列表 (用户可直接点击添加) */
  presetChips?: ChipOption[];
  /** 是否允许自定义输入 */
  allowCustomInput?: boolean;
  /** 自定义输入的 key 前缀 (如输入的值会存为 'custom_xxx') */
  customKeyPrefix?: string;
  /** Chip 颜色主题 */
  chipTheme?: 'default' | 'colorful' | 'outlined';
  /** 是否可以移除已添加的 Chip */
  removable?: boolean;
  /** C-end 渲染时，输入框上方显示的提示文案 */
  promptHint?: string;
  /** 最多可选标签数 (0 表示不限制) */
  maxChips?: number;
}

export interface ChipOption {
  key: string;
  label: string;
  /** Chip 颜色 (CSS 颜色值) */
  color?: string;
  /** 图标 */
  icon?: string;
  /** 分组 */
  group?: string;
  /** 点击后自动填充到输入框的文本片段 */
  insertText?: string;
}

// ─── 快捷操作按钮组 — 核心交互控件 ────────────────────────

export interface ActionButtonsWidgetConfig extends WidgetBase {
  type: 'action-buttons';
  /** 按钮列表 */
  buttons: ActionButton[];
  /** 排列方向 */
  direction?: 'horizontal' | 'vertical';
  /** 按钮样式 */
  buttonStyle?: 'solid' | 'outlined' | 'text';
  /** 按钮尺寸 */
  buttonSize?: 'small' | 'medium' | 'large';
  /** 是否撑满宽度 */
  block?: boolean;
  /** 列数 (用于网格排列, 0 表示自动) */
  columns?: number;
  /** 点击行为 */
  onClickAction?: 'fill-prompt' | 'switch-preset' | 'navigate' | 'custom';
}

export interface ActionButton {
  key: string;
  label: string;
  /** 按钮图标 */
  icon?: string;
  /** 按钮颜色 (主题色/成功色/警告色/错误色) */
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default';
  /** 按钮描述 (tooltip) */
  description?: string;
  /** 点击后要填充到 Prompt 的文本 */
  fillTemplate?: string;
  /** 点击后要切换的预设方案 ID (对应 PresetSelectWidget) */
  targetPresetId?: string;
  /** 点击后要导航到的路由 */
  navigateTo?: string;
  /** 是否为主要操作 (高亮显示) */
  primary?: boolean;
  /** 徽章文本 */
  badge?: string;
  /** 是否独立一行 (用于网格排列) */
  fullWidth?: boolean;
}

// ─── 底部工具栏 ───────────────────────────────────────────

export interface ToolbarWidgetConfig extends WidgetBase {
  type: 'toolbar';
  /** 工具栏项 */
  items: ToolbarItem[];
  /** 工具栏位置 */
  position?: 'fixed-bottom' | 'inline';
  /** 是否显示为图标+文字 */
  showLabel?: boolean;
  /** 图标尺寸 */
  iconSize?: 'small' | 'medium' | 'large';
}

export interface ToolbarItem {
  key: string;
  label: string;
  /** 图标 */
  icon: string;
  /** 点击行为 */
  action?: 'tab' | 'navigate' | 'custom';
  /** 目标 */
  target?: string;
  /** 是否激活 */
  active?: boolean;
}

// ─── 颜色选择器 ───────────────────────────────────────────

export interface ColorPickerWidgetConfig extends WidgetBase {
  type: 'color-picker';
  /** 预设颜色 */
  presetColors?: string[];
  /** 是否支持透明度 */
  showAlpha?: boolean;
  /** 颜色格式 */
  format?: 'hex' | 'rgb' | 'hsl';
}

// ─── 图片单选 ─────────────────────────────────────────────

export interface RadioImageWidgetConfig extends WidgetBase {
  type: 'radio-image';
  /** 选项 */
  options: RadioImageOption[];
  /** 列数 */
  columns?: number;
  /** 图片显示尺寸 */
  imageSize?: 'small' | 'medium' | 'large';
  /** 是否显示选中态勾选图标 */
  showCheckmark?: boolean;
}

export interface RadioImageOption {
  label: string;
  value: string;
  /** 图片 URL */
  imageUrl: string;
  /** 缩略图 */
  thumbnailUrl?: string;
  /** 描述 */
  description?: string;
  /** 示例效果图 (hover 时展示) */
  previewUrl?: string;
}

// ─── 预设方案选择器 ───────────────────────────────────────

export interface PresetSelectWidgetConfig extends WidgetBase {
  type: 'preset-select';
  /** 预设方案列表 */
  presets: PresetOption[];
  /** 展示模式 */
  displayMode?: 'cards' | 'list' | 'grid';
  /** 切换预设时，同时修改其他 widget 的值 */
  linkedWidgets?: PresetLinkedWidget[];
}

export interface PresetOption {
  id: string;
  label: string;
  /** 封面图 */
  coverUrl?: string;
  /** 描述 */
  description?: string;
  /** 该预设对应的参数值 (切换时自动填充到关联 widget) */
  values: Record<string, unknown>;
}

export interface PresetLinkedWidget {
  /** 目标 widget key */
  widgetKey: string;
  /** 目标 widget 中的字段路径 (如 'options.0.value') */
  fieldPath: string;
}

// ─── 提示词输入 — 内联富文本提示词 ────────────────────────

/**
 * 提示词输入 widget 配置。
 *
 * 将一段提示词模板拆分为「纯文本片段 + 可交互槽位」的序列。
 * 渲染时，纯文本直接展示，槽位渲染为对应控件（图片上传、下拉选择、文本输入等），
 * 所有元素在同一行内联排列，形成自然语言流。
 *
 * 示例模板：
 *   "上传{productImage}，生成电商主图，商品名称是{productName}，风格是{style}"
 *
 * 槽位类型：
 *   - 'text': 内联文本输入
 *   - 'select': 内联下拉选择
 *   - 'image': 内联图片上传
 *   - 'chip': 内联标签选择
 *   - 'number': 内联数字输入
 */
export interface PromptInputWidgetConfig extends WidgetBase {
  type: 'prompt-input';
  /**
   * 提示词模板 — 用 {{slotKey}} 标记槽位位置。
   * 例如: "上传{{productImage}}，生成电商主图，商品名称是{{productName}}"
   */
  template: string;
  /** 槽位定义列表 */
  slots: PromptSlot[];
  /** 输入框最小高度 (px) */
  minHeight?: number;
}

/** 提示词槽位 */
export interface PromptSlot {
  /** 槽位 key (对应 template 中的 {{slotKey}}) */
  key: string;
  /**
   * 槽位类型：
   * - text: 文本输入
   * - select: 下拉单选
   * - chip: 标签多选（value 为数组，渲染时以「、」连接）
   * - image: 图片上传
   * - number: 数字输入
   * - separator: 分隔标识（不可交互，渲染为 `label：`，用于标记文本分段，如 卖点：xxx 要求：xxx）
   */
  slotType: 'text' | 'select' | 'image' | 'chip' | 'number' | 'separator';
  /** 占位组件显示名 (用于 builder 中标识) */
  label: string;
  /** 占位提示 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 下拉选项 (slotType='select' 或 'chip' 时有效) */
  options?: SelectOption[];
  /** 是否多选 (slotType='select' 或 'chip' 时有效) */
  multiple?: boolean;
  /** 图片上传最大数量 (slotType='image' 时有效) */
  maxCount?: number;
  /** 图片上传推荐尺寸 (slotType='image' 时有效) */
  recommendedSize?: string;
  /** 数字最小值 (slotType='number' 时有效) */
  min?: number;
  /** 数字最大值 (slotType='number' 时有效) */
  max?: number;
  /** 数字步长 (slotType='number' 时有效) */
  step?: number;
  /** 预设标签 (slotType='chip' 时有效) */
  presetChips?: ChipOption[];
}

// ============================================================
// 渲染器共享契约 — 供 WidgetRenderer / 各 widget 组件复用
// ============================================================

/**
 * Widget / Section 的渲染模式。
 * - 'builder': 在构建器画布中预览，禁用交互，仅可点击选中
 * - 'viewer': 在 C-end 渲染，完全可交互
 */
export type RenderMode = 'builder' | 'viewer';

/**
 * 单个 widget 渲染器组件的统一 props 契约。
 * 全部 15 个 XxxWidget.vue 必须实现该 props 形态（config 收窄到各自类型）。
 */
export interface WidgetRendererProps {
  /** 当前 widget 配置 (联合类型，各组件内按 type 已收窄) */
  config: WidgetConfig;
  /** 渲染模式 */
  mode: RenderMode;
  /** 全部 widget 的表单值，按 widget.key 索引 (viewer 模式下读写) */
  formValues?: Record<string, unknown>;
  /** builder 模式下是否处于选中态 */
  isSelected?: boolean;
}

/**
 * 单个 widget 渲染器组件的统一 emits 契约。
 * viewer 模式下，widget 通过该事件回写自身的值。
 */
export interface WidgetRendererEmits {
  /** 回写表单值：(widget key, 新值) */
  (e: 'update:form-values', key: string, value: unknown): void;
}
