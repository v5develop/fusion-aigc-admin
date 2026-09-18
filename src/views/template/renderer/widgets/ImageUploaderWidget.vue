<!-- src/views/template/renderer/widgets/ImageUploaderWidget.vue -->
<!--
  ImageUploaderWidget — 图片上传渲染器（多图 + 预览网格 + 删除）。

  value 形态：UploadedImage[]（{ url; name?; size?; remoteUrl? }）。
    - viewer: 本地 <input type=file multiple> + URL.createObjectURL 生成预览 url，emit 数组。
    - builder: 展示 exampleImages 占位，禁用上传。

  本批次不接真实直传 API；remoteUrl 留空，后续阶段接入 OSS 直传后回填。

  双模式：
    - builder: 只读预览，isSelected 时高亮，不 emit。
    - viewer : 完全可交互。
-->
<template>
  <div :class="rootClass">
    <div class="iu-widget__header">
      <span class="iu-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="iu-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="iu-widget__help" />
      </a-tooltip>
    </div>

    <div class="image-uploader">
      <div class="uploaded-grid" :class="`preview-${config.previewSize || 'medium'}`">
        <div v-for="(img, idx) in displayImages" :key="`${img.url}-${idx}`" class="image-item">
          <img :src="img.url" :alt="img.name || `image-${idx + 1}`" class="preview-image" />
          <button
            v-if="mode === 'viewer' && !config.disabled"
            type="button"
            class="remove-btn"
            @click="removeImage(idx)"
          >
            <Icon icon="antdv-next:CloseOutlined" />
          </button>
          <span v-if="config.recommendedSize && idx === 0" class="size-badge">
            {{ config.recommendedSize }}
          </span>
        </div>

        <div
          v-if="canAddMore"
          class="upload-trigger"
          :class="{ 'drag-over': isDragOver }"
          @click="triggerUpload"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <Icon icon="antdv-next:PlusOutlined" class="upload-icon" />
          <span class="upload-text">
            {{ config.uploadButtonText || $t('template.clickToUpload') }}
          </span>
          <span
            v-if="displayImages.length === 0 && config.showDragHint !== false"
            class="drag-hint"
          >
            {{ $t('template.orDragToUpload') }}
          </span>
          <span v-if="config.recommendedSize" class="size-hint">
            {{ $t('template.recommendedSize') }}: {{ config.recommendedSize }}
          </span>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        :accept="config.accept || 'image/*'"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  ImageUploaderWidgetConfig,
  RenderMode,
  UploadedImage,
} from '@/types/template-builder';

import { message } from 'antdv-next';
import { computed, onBeforeUnmount, ref } from 'vue';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = withDefaults(
  defineProps<{
    config: ImageUploaderWidgetConfig;
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

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
/** 本组件创建的 objectURL，卸载时统一释放 */
const ownedObjectUrls = ref<string[]>([]);

const rootClass = computed(() => [
  'iu-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
]);

const maxCount = computed(() => props.config.maxCount ?? 5);

/** 当前已上传图片（viewer 取表单值；builder 展示示例图占位） */
const currentImages = computed<UploadedImage[]>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key];
    if (Array.isArray(fromForm)) return fromForm as UploadedImage[];
    return [];
  }
  return [];
});

/** builder 模式用 exampleImages 渲染占位预览 */
const displayImages = computed<UploadedImage[]>(() => {
  if (props.mode === 'builder') {
    return (props.config.exampleImages ?? []).map((url) => ({ url }));
  }
  return currentImages.value;
});

const canAddMore = computed(() => {
  if (props.mode === 'builder') return true;
  if (props.config.disabled) return false;
  return displayImages.value.length < maxCount.value;
});

function triggerUpload(): void {
  if (props.mode !== 'viewer' || props.config.disabled) return;
  fileInputRef.value?.click();
}

function makePreview(file: File): UploadedImage {
  const url = URL.createObjectURL(file);
  ownedObjectUrls.value.push(url);
  return { url, name: file.name, size: file.size };
}

function acceptFiles(files: FileList | File[]): void {
  if (props.mode !== 'viewer' || props.config.disabled) return;
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  const maxBytes = props.config.maxSizeMB ? props.config.maxSizeMB * 1024 * 1024 : 0;
  const valid: File[] = [];
  for (const f of imageFiles) {
    if (maxBytes > 0 && f.size > maxBytes) {
      message.warning(`${f.name} 超过 ${props.config.maxSizeMB}MB`);
      continue;
    }
    valid.push(f);
  }
  if (valid.length === 0) return;

  const remaining = maxCount.value - currentImages.value.length;
  const accepted = valid.slice(0, Math.max(0, remaining));
  if (accepted.length < valid.length) {
    message.warning(`最多上传 ${maxCount.value} 张`);
  }

  const next = [...currentImages.value, ...accepted.map(makePreview)];
  emit('update:form-values', props.config.key, next);
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.files) acceptFiles(target.files);
  target.value = '';
}

function onDrop(event: DragEvent): void {
  isDragOver.value = false;
  if (event.dataTransfer?.files) acceptFiles(event.dataTransfer.files);
}

function removeImage(idx: number): void {
  if (props.mode !== 'viewer') return;
  const next = currentImages.value.slice();
  const [removed] = next.splice(idx, 1);
  if (removed && ownedObjectUrls.value.includes(removed.url)) {
    URL.revokeObjectURL(removed.url);
    ownedObjectUrls.value = ownedObjectUrls.value.filter((u) => u !== removed.url);
  }
  emit('update:form-values', props.config.key, next);
}

onBeforeUnmount(() => {
  ownedObjectUrls.value.forEach((u) => URL.revokeObjectURL(u));
  ownedObjectUrls.value = [];
});
</script>

<style scoped>
.iu-widget {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  font-family: var(--font-family);
}

.widget-wrapper {
  border-radius: var(--radius-base);
  transition: box-shadow var(--duration-fast) ease;
}

.widget-selected {
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.iu-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.iu-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.iu-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.iu-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.uploaded-grid {
  display: grid;
  gap: var(--spacing-sm);
}

.preview-small {
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
}
.preview-small .image-item {
  height: 80px;
}

.preview-medium {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}
.preview-medium .image-item {
  height: 120px;
}

.preview-large {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}
.preview-large .image-item {
  height: 160px;
}

.image-item {
  position: relative;
  border-radius: var(--radius-base);
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  background: var(--color-bg-container);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--duration-fast) ease;
}

.image-item:hover .preview-image {
  transform: scale(1.05);
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.image-item:hover .remove-btn {
  opacity: 1;
}

.size-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: var(--radius-xs);
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-base);
  min-height: 120px;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  background: var(--color-bg-container);
}

.upload-trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-1);
}

.upload-trigger.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-1);
  border-style: solid;
}

.upload-icon {
  font-size: 24px;
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
}

.upload-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.drag-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-quaternary);
  margin-top: 2px;
}

.size-hint {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  margin-top: 4px;
}
</style>
