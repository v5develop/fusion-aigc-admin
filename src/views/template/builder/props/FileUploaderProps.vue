<!-- src/views/template/builder/props/FileUploaderProps.vue -->
<!--
  FileUploaderProps — file-uploader 类型 widget 的特有字段编辑器。
  仅编辑 FileUploaderWidgetConfig 特有字段：maxCount/maxSizeMB（数值，清空回 undefined）、
  accept/dragHint（文本，清空回 undefined）。公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="file-uploader-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.fileMaxCount')">
      <a-input-number
        class="file-uploader-props__number"
        :value="widget.maxCount"
        :min="1"
        @update:value="onUpdateNumber('maxCount', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.fileMaxSizeMB')">
      <a-input-number
        class="file-uploader-props__number"
        :value="widget.maxSizeMB"
        :min="0"
        :addon-after="'MB'"
        @update:value="onUpdateNumber('maxSizeMB', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.fileAccept')">
      <a-input
        :value="widget.accept"
        :placeholder="$t('template.fileAcceptPlaceholder')"
        allow-clear
        @update:value="onUpdateText('accept', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.fileDragHint')">
      <a-input
        :value="widget.dragHint"
        allow-clear
        @update:value="onUpdateText('dragHint', $event)"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { $t } from '@/locales'
import type { FileUploaderWidgetConfig } from '@/types/template-builder'

const props = defineProps<{
  widget: FileUploaderWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

function onUpdateNumber(
  field: 'maxCount' | 'maxSizeMB',
  value: number | null,
): void {
  emit('update', { [field]: value === null ? undefined : value })
}

function onUpdateText(field: 'accept' | 'dragHint', value: string): void {
  emit('update', { [field]: value.length === 0 ? undefined : value })
}
</script>

<style scoped>
.file-uploader-props {
  display: flex;
  flex-direction: column;
}

.file-uploader-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.file-uploader-props__number {
  width: 100%;
}
</style>
