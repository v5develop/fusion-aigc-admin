<!-- src/views/template/renderer/widgets/PromptInputWidget.vue -->
<!--
  PromptInputWidget — 内联提示词输入渲染器。

  将提示词模板拆分为「纯文本片段 + 可交互槽位」序列，在同一行内联渲染。
  槽位类型：text（文本输入）、select（下拉选择）、image（图片上传）、chip（标签选择）、number（数字输入）。

  value 形态：Record<string, unknown>，key 为 slot key，value 为对应槽位的值。

  双模式：
    - builder: 只读预览，展示示例占位，不 emit。
    - viewer : 完全可交互，槽位变化时 emit('update:form-values', widgetKey, { slotKey: value, ... })。
-->
<template>
  <div class="widget-wrapper" :class="{ 'widget-selected': mode === 'builder' && isSelected }">
    <div v-if="config.label" class="widget-header">
      <label class="widget-label">{{ config.label }}</label>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="help-icon" />
      </a-tooltip>
    </div>

    <div class="prompt-input-container" :style="{ minHeight: `${config.minHeight || 80}px` }">
      <template v-for="(segment, idx) in parsedSegments" :key="idx">
        <!-- 纯文本片段 -->
        <span v-if="segment.type === 'text'" class="prompt-text">
          {{ segment.content }}
        </span>

        <!-- 槽位 -->
        <span v-else class="prompt-slot" :class="`slot-type-${segment.slot.slotType}`">
          <!-- text: 内联文本输入 -->
          <template v-if="segment.slot.slotType === 'text'">
            <a-input
              :value="slotValue(segment.slot.key)"
              :placeholder="segment.slot.placeholder || segment.slot.label"
              :disabled="mode === 'builder'"
              size="small"
              class="slot-input"
              @update:value="onSlotChange(segment.slot.key, $event)"
            />
          </template>

          <!-- select: 内联下拉选择 -->
          <template v-else-if="segment.slot.slotType === 'select'">
            <a-select
              :value="slotValue(segment.slot.key)"
              :placeholder="segment.slot.placeholder || segment.slot.label"
              :disabled="mode === 'builder'"
              :options="segment.slot.options || []"
              :mode="segment.slot.multiple ? 'multiple' : undefined"
              size="small"
              class="slot-select"
              :max-tag-count="1"
              @update:value="onSlotChange(segment.slot.key, $event)"
            />
          </template>

          <!-- image: 内联图片上传 -->
          <template v-else-if="segment.slot.slotType === 'image'">
            <button
              v-if="!slotHasImage(segment.slot.key)"
              type="button"
              class="slot-image-upload-btn"
              :disabled="mode === 'builder'"
              @click="triggerImageUpload(segment.slot.key)"
            >
              <Icon icon="antdv-next:PlusOutlined" class="upload-icon" />
              <span class="upload-text">{{ segment.slot.label }}</span>
              <span v-if="segment.slot.recommendedSize" class="upload-size">
                {{ segment.slot.recommendedSize }}
              </span>
            </button>
            <div v-else class="slot-image-preview">
              <img :src="slotImagePreview(segment.slot.key)" :alt="segment.slot.label" />
              <button
                v-if="mode === 'viewer'"
                type="button"
                class="image-remove-btn"
                @click="removeImage(segment.slot.key)"
              >
                <Icon icon="antdv-next:CloseOutlined" />
              </button>
            </div>
          </template>

          <!-- chip: 内联标签多选 -->
          <template v-else-if="segment.slot.slotType === 'chip'">
            <a-select
              :value="slotValue(segment.slot.key)"
              :placeholder="segment.slot.placeholder || segment.slot.label"
              :disabled="mode === 'builder'"
              :options="slotChipOptions(segment.slot)"
              :mode="segment.slot.multiple === false ? undefined : 'multiple'"
              size="small"
              class="slot-chip-select"
              :max-tag-count="2"
              @update:value="onSlotChange(segment.slot.key, $event)"
            />
          </template>

          <!-- separator: 分隔标识（不可交互），渲染为 “label：” -->
          <template v-else-if="segment.slot.slotType === 'separator'">
            <span class="prompt-separator">{{ segment.slot.label }}：</span>
          </template>

          <!-- number: 内联数字输入 -->
          <template v-else-if="segment.slot.slotType === 'number'">
            <a-input-number
              :value="slotNumberValue(segment.slot)"
              :placeholder="segment.slot.placeholder || segment.slot.label"
              :disabled="mode === 'builder'"
              :min="segment.slot.min"
              :max="segment.slot.max"
              :step="segment.slot.step ?? 1"
              size="small"
              class="slot-number"
              @update:value="onSlotChange(segment.slot.key, $event)"
            />
          </template>
        </span>
      </template>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      v-for="slot in imageSlots"
      :key="slot.key"
      :ref="(el) => setImageInputRef(slot.key, el as HTMLInputElement)"
      type="file"
      accept="image/*"
      hidden
      @change="onImageFileChange(slot.key, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  ChipOption,
  PromptInputWidgetConfig,
  PromptSlot,
  RenderMode,
  SelectOption,
} from '@/types/template-builder';

import { message } from 'antdv-next';
import { computed, onBeforeUnmount, reactive } from 'vue';

import Icon from '@/components/Icon/index.vue';

const props = withDefaults(
  defineProps<{
    config: PromptInputWidgetConfig;
    mode: RenderMode;
    formValues?: Record<string, unknown>;
    isSelected?: boolean;
  }>(),
  { formValues: undefined, isSelected: false },
);

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void;
}>();

// ─── 模板解析：将 template 拆分为文本片段和槽位 ──────────────

interface TextSegment {
  type: 'text';
  content: string;
}

interface SlotSegment {
  type: 'slot';
  slot: PromptSlot;
}

type Segment = TextSegment | SlotSegment;

const SLOT_PATTERN = /\{\{(\w+)\}\}/g;

function parseTemplate(template: string, slots: PromptSlot[]): Segment[] {
  const segments: Segment[] = [];
  const slotMap = new Map(slots.map((s) => [s.key, s]));
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(SLOT_PATTERN.source, 'g');
  while ((match = regex.exec(template)) !== null) {
    // 添加槽位前的纯文本
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: template.slice(lastIndex, match.index) });
    }
    // 添加槽位
    const slotKey = match[1];
    const slot = slotMap.get(slotKey);
    if (slot) {
      segments.push({ type: 'slot', slot });
    } else {
      // 未定义的槽位，作为纯文本保留
      segments.push({ type: 'text', content: match[0] });
    }
    lastIndex = regex.lastIndex;
  }
  // 添加末尾纯文本
  if (lastIndex < template.length) {
    segments.push({ type: 'text', content: template.slice(lastIndex) });
  }
  return segments;
}

const parsedSegments = computed<Segment[]>(() =>
  parseTemplate(props.config.template || '', props.config.slots || []),
);

const imageSlots = computed<PromptSlot[]>(() =>
  (props.config.slots || []).filter((s) => s.slotType === 'image'),
);

// ─── 槽位值管理 ────────────────────────────────────────────

/** 读取单个槽位的值 */
function slotValue(key: string): unknown {
  const formVal = props.formValues?.[props.config.key];
  if (formVal && typeof formVal === 'object' && !Array.isArray(formVal)) {
    const obj = formVal as Record<string, unknown>;
    return obj[key];
  }
  // 回退到 slot 默认值
  const slot = props.config.slots?.find((s) => s.key === key);
  return slot?.defaultValue;
}

function slotNumberValue(slot: PromptSlot): number | undefined {
  const value = slotValue(slot.key);
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

/** 设置单个槽位的值 */
function setSlotValue(key: string, value: unknown): void {
  if (props.mode !== 'viewer') return;
  const current = (props.formValues?.[props.config.key] as Record<string, unknown>) || {};
  const next = { ...current, [key]: value };
  emit('update:form-values', props.config.key, next);
}

function onSlotChange(key: string, value: unknown): void {
  setSlotValue(key, value);
}

// ─── 图片上传 ──────────────────────────────────────────────

const imageInputRefs = reactive<Record<string, HTMLInputElement | null>>({});
const imageObjectUrls = reactive<Record<string, string>>({});

function setImageInputRef(key: string, el: HTMLInputElement | null): void {
  imageInputRefs[key] = el;
}

function slotHasImage(key: string): boolean {
  return !!imageObjectUrls[key] || !!slotValue(key);
}

function slotImagePreview(key: string): string {
  return imageObjectUrls[key] || '';
}

function triggerImageUpload(key: string): void {
  if (props.mode !== 'viewer') return;
  imageInputRefs[key]?.click();
}

function onImageFileChange(key: string, event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return;
  }
  // 释放旧 URL
  if (imageObjectUrls[key]) {
    URL.revokeObjectURL(imageObjectUrls[key]);
  }
  const url = URL.createObjectURL(file);
  imageObjectUrls[key] = url;
  setSlotValue(key, { url, name: file.name, size: file.size });
  target.value = '';
}

function removeImage(key: string): void {
  if (props.mode !== 'viewer') return;
  if (imageObjectUrls[key]) {
    URL.revokeObjectURL(imageObjectUrls[key]);
    delete imageObjectUrls[key];
  }
  setSlotValue(key, null);
}

onBeforeUnmount(() => {
  for (const url of Object.values(imageObjectUrls)) {
    URL.revokeObjectURL(url);
  }
});

// ─── Chip 选项转换 ─────────────────────────────────────────

function slotChipOptions(slot: PromptSlot): SelectOption[] {
  // 优先 presetChips（模板构建器路径），回退 options（提示词编辑器路径）
  const chips = slot.presetChips || [];
  if (chips.length) {
    return chips.map((c: ChipOption) => ({ label: c.label, value: c.key }));
  }
  return (slot.options || []).map((o) => ({ label: o.label, value: o.value }));
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
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.widget-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.help-icon {
  margin-left: var(--spacing-xs);
  color: var(--color-text-tertiary);
  cursor: help;
}

.prompt-input-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-container);
  padding: var(--spacing-sm) var(--spacing-md);
  line-height: 1.8;
  transition: border-color var(--duration-fast);
}

.prompt-input-container:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.prompt-text {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  white-space: pre-wrap;
}

.prompt-separator {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.prompt-slot {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

/* 文本输入槽位 */
.slot-input {
  width: auto;
  min-width: 80px;
  max-width: 160px;
}

.slot-input :deep(.ant-input) {
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: var(--font-size-sm);
  height: auto;
  line-height: 1.6;
  background: var(--color-primary-1);
  border-color: transparent;
  color: var(--color-primary);
}

.slot-input :deep(.ant-input:focus) {
  border-color: var(--color-primary);
  box-shadow: none;
}

.slot-input :deep(.ant-input::placeholder) {
  color: var(--color-primary);
  opacity: 0.6;
}

/* 下拉选择槽位 */
.slot-select,
.slot-chip-select {
  min-width: 80px;
}

.slot-number {
  width: 88px;
}

.slot-number :deep(.ant-input-number-input) {
  height: 24px;
  padding: 0 8px;
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.slot-number :deep(.ant-input-number) {
  border-radius: var(--radius-sm);
  background: var(--color-primary-1);
  border-color: transparent;
}

.slot-select :deep(.ant-select-selector),
.slot-chip-select :deep(.ant-select-selector) {
  border-radius: var(--radius-sm);
  background: var(--color-primary-1);
  border-color: transparent;
  padding: 0 8px;
  min-height: 26px;
}

.slot-select :deep(.ant-select-selection-item),
.slot-chip-select :deep(.ant-select-selection-item) {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.slot-select :deep(.ant-select-arrow),
.slot-chip-select :deep(.ant-select-arrow) {
  color: var(--color-primary);
}

/* 图片上传槽位 */
.slot-image-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-primary);
  background: var(--color-primary-1);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.slot-image-upload-btn:hover {
  background: var(--color-primary-2);
  border-style: solid;
}

.slot-image-upload-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.upload-icon {
  font-size: 14px;
}

.upload-text {
  font-weight: var(--font-weight-medium);
}

.upload-size {
  font-size: var(--font-size-xs);
  opacity: 0.7;
}

.slot-image-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.slot-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-xs);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  cursor: pointer;
  font-size: 10px;
}
</style>
