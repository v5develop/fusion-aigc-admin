<!-- src/views/template/renderer/widgets/FileUploaderWidget.vue -->
<!--
  FileUploaderWidget — 通用文件上传渲染器（拖拽区 + 已选文件列表）。

  value 形态：UploadedImage[]（复用该结构：{ url; name?; size?; remoteUrl? }，url 为本地 objectURL）。
    - viewer: 本地 <input type=file> + URL.createObjectURL，emit 文件描述数组。
    - builder: 只读预览，展示拖拽区占位，禁用上传。

  本批次不接真实直传 API；remoteUrl 留空，后续阶段接入 OSS 直传后回填。

  双模式：
    - builder: 只读预览，isSelected 时高亮，不 emit。
    - viewer : 完全可交互。
-->
<template>
  <div :class="rootClass">
    <div class="fu-widget__header">
      <span class="fu-widget__label">
        {{ config.label }}
        <span v-if="config.required" class="fu-widget__required">*</span>
      </span>
      <a-tooltip v-if="config.helpText" :title="config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="fu-widget__help" />
      </a-tooltip>
    </div>

    <div class="file-uploader">
      <!-- 拖拽 / 点击上传区 -->
      <div
        v-if="canAddMore"
        class="upload-trigger"
        :class="{ 'drag-over': isDragOver }"
        @click="triggerUpload"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="onDrop"
      >
        <Icon icon="antdv-next:CloudUploadOutlined" class="upload-icon" />
        <span class="upload-text">
          {{ config.placeholder || $t('template.clickToUpload') }}
        </span>
        <span class="drag-hint">
          {{ config.dragHint || $t('template.orDragToUpload') }}
        </span>
      </div>

      <!-- 已选文件列表 -->
      <ul v-if="displayFiles.length > 0" class="file-list">
        <li v-for="(file, idx) in displayFiles" :key="`${file.url}-${idx}`" class="file-item">
          <Icon icon="antdv-next:FileOutlined" class="file-icon" />
          <div class="file-meta">
            <span class="file-name" :title="file.name">{{ file.name || `file-${idx + 1}` }}</span>
            <span v-if="file.size" class="file-size">{{ formatSize(file.size) }}</span>
          </div>
          <button
            v-if="mode === 'viewer' && !config.disabled"
            type="button"
            class="remove-btn"
            @click="removeFile(idx)"
          >
            <Icon icon="antdv-next:CloseOutlined" />
          </button>
        </li>
      </ul>

      <input
        ref="fileInputRef"
        type="file"
        :accept="config.accept || undefined"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import { message } from 'antdv-next'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type {
  FileUploaderWidgetConfig,
  RenderMode,
  UploadedImage,
} from '@/types/template-builder'

const props = withDefaults(
  defineProps<{
    config: FileUploaderWidgetConfig
    mode: RenderMode
    formValues?: Record<string, unknown>
    isSelected?: boolean
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
)

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
/** 本组件创建的 objectURL，卸载时统一释放 */
const ownedObjectUrls = ref<string[]>([])

const rootClass = computed(() => [
  'fu-widget',
  {
    'widget-wrapper': props.mode === 'builder',
    'widget-selected': props.mode === 'builder' && props.isSelected,
  },
])

const maxCount = computed(() => props.config.maxCount ?? 5)

/** viewer 取表单值；builder 无占位文件 */
const currentFiles = computed<UploadedImage[]>(() => {
  if (props.mode === 'viewer') {
    const fromForm = props.formValues?.[props.config.key]
    if (Array.isArray(fromForm)) return fromForm as UploadedImage[]
  }
  return []
})

const displayFiles = computed<UploadedImage[]>(() => currentFiles.value)

const canAddMore = computed(() => {
  if (props.mode === 'builder') return true
  if (props.config.disabled) return false
  return displayFiles.value.length < maxCount.value
})

function triggerUpload(): void {
  if (props.mode !== 'viewer' || props.config.disabled) return
  fileInputRef.value?.click()
}

function makeEntry(file: File): UploadedImage {
  const url = URL.createObjectURL(file)
  ownedObjectUrls.value.push(url)
  return { url, name: file.name, size: file.size }
}

function acceptFiles(files: FileList | File[]): void {
  if (props.mode !== 'viewer' || props.config.disabled) return
  const list = Array.from(files)
  if (list.length === 0) return

  const maxBytes = props.config.maxSizeMB ? props.config.maxSizeMB * 1024 * 1024 : 0
  const valid: File[] = []
  for (const f of list) {
    if (maxBytes > 0 && f.size > maxBytes) {
      message.warning(`${f.name} 超过 ${props.config.maxSizeMB}MB`)
      continue
    }
    valid.push(f)
  }
  if (valid.length === 0) return

  const remaining = maxCount.value - currentFiles.value.length
  const accepted = valid.slice(0, Math.max(0, remaining))
  if (accepted.length < valid.length) {
    message.warning(`最多上传 ${maxCount.value} 个文件`)
  }

  const next = [...currentFiles.value, ...accepted.map(makeEntry)]
  emit('update:form-values', props.config.key, next)
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  if (target.files) acceptFiles(target.files)
  target.value = ''
}

function onDrop(event: DragEvent): void {
  isDragOver.value = false
  if (event.dataTransfer?.files) acceptFiles(event.dataTransfer.files)
}

function removeFile(idx: number): void {
  if (props.mode !== 'viewer') return
  const next = currentFiles.value.slice()
  const [removed] = next.splice(idx, 1)
  if (removed && ownedObjectUrls.value.includes(removed.url)) {
    URL.revokeObjectURL(removed.url)
    ownedObjectUrls.value = ownedObjectUrls.value.filter((u) => u !== removed.url)
  }
  emit('update:form-values', props.config.key, next)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

onBeforeUnmount(() => {
  ownedObjectUrls.value.forEach((u) => URL.revokeObjectURL(u))
  ownedObjectUrls.value = []
})
</script>

<style scoped>
.fu-widget {
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

.fu-widget__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.fu-widget__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.fu-widget__required {
  margin-left: 2px;
  color: var(--color-error);
}

.fu-widget__help {
  color: var(--color-text-tertiary);
  cursor: help;
  font-size: var(--font-size-sm);
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-base);
  min-height: 96px;
  padding: var(--spacing-md);
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

.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  background: var(--color-bg-container);
}

.file-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.file-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.remove-btn {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-tertiary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--duration-fast) ease;
}

.remove-btn:hover {
  background: var(--color-error);
  color: #fff;
}
</style>
