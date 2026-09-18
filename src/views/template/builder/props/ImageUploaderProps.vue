<!-- src/views/template/builder/props/ImageUploaderProps.vue -->
<!--
  ImageUploaderProps — image-uploader 类型 widget 的特有字段编辑器。
  编辑 ImageUploaderWidgetConfig 特有字段：maxCount、minCount、accept、maxSizeMB、
  uploadButtonText、recommendedSize、aspectRatio、previewSize、showDragHint、sortable、
  exampleImages(string[] 行增删)。
  公共字段由 CommonProps 负责。
-->
<template>
  <a-form class="image-uploader-props" layout="vertical" :colon="false">
    <div class="image-uploader-props__line">
      <a-form-item :label="$t('template.maxCount')" class="image-uploader-props__col">
        <a-input-number
          :value="widget.maxCount ?? 5"
          :min="1"
          :max="20"
          style="width: 100%"
          @update:value="onUpdate('maxCount', toNumber($event, 5))"
        />
      </a-form-item>
      <a-form-item :label="$t('template.minCount')" class="image-uploader-props__col">
        <a-input-number
          :value="widget.minCount ?? 0"
          :min="0"
          :max="20"
          style="width: 100%"
          @update:value="onUpdate('minCount', toNumber($event, 0))"
        />
      </a-form-item>
    </div>

    <a-form-item :label="$t('template.accept')">
      <a-input
        :value="widget.accept"
        placeholder="image/png,image/jpeg,image/webp"
        allow-clear
        @update:value="onUpdate('accept', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.maxSize')">
      <a-input-number
        :value="widget.maxSizeMB ?? 10"
        :min="1"
        :max="100"
        addon-after="MB"
        style="width: 100%"
        @update:value="onUpdate('maxSizeMB', toNumber($event, 10))"
      />
    </a-form-item>

    <a-form-item :label="$t('template.uploadButtonText')">
      <a-input
        :value="widget.uploadButtonText"
        allow-clear
        @update:value="onUpdate('uploadButtonText', $event)"
      />
    </a-form-item>

    <div class="image-uploader-props__line">
      <a-form-item :label="$t('template.recommendedSize')" class="image-uploader-props__col">
        <a-input
          :value="widget.recommendedSize"
          placeholder="800x800"
          allow-clear
          @update:value="onUpdate('recommendedSize', $event)"
        />
      </a-form-item>
      <a-form-item :label="$t('template.aspectRatio')" class="image-uploader-props__col">
        <a-input
          :value="widget.aspectRatio"
          placeholder="1:1"
          allow-clear
          @update:value="onUpdate('aspectRatio', $event)"
        />
      </a-form-item>
    </div>

    <a-form-item :label="$t('template.previewSize')">
      <a-select
        :value="widget.previewSize ?? 'medium'"
        :options="previewSizeOptions"
        @update:value="onUpdate('previewSize', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.showDragHint')">
      <a-switch
        :checked="widget.showDragHint ?? true"
        size="small"
        @update:checked="onUpdate('showDragHint', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sortable')">
      <a-switch
        :checked="widget.sortable ?? false"
        size="small"
        @update:checked="onUpdate('sortable', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.exampleImages')">
      <div v-if="exampleImages.length > 0" class="image-uploader-props__list">
        <div v-for="(url, index) in exampleImages" :key="index" class="image-uploader-props__row">
          <a-input
            :value="url"
            placeholder="image URL"
            allow-clear
            @update:value="onExampleUpdate(index, $event)"
          />
          <a-button
            type="text"
            class="image-uploader-props__remove"
            @click="onRemoveExample(index)"
          >
            <Icon icon="antdv-next:DeleteOutlined" />
          </a-button>
        </div>
      </div>

      <a-button block class="image-uploader-props__add" @click="onAddExample">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.addImageOption') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { ImageUploaderWidgetConfig } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = defineProps<{
  widget: ImageUploaderWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

type PreviewSize = NonNullable<ImageUploaderWidgetConfig['previewSize']>;

const previewSizeOptions: { label: string; value: PreviewSize }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
];

const exampleImages = computed<string[]>(() => props.widget.exampleImages ?? []);

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

function onUpdate<K extends keyof ImageUploaderWidgetConfig>(
  field: K,
  value: ImageUploaderWidgetConfig[K],
): void {
  emit('update', { [field]: value });
}

function commitExamples(next: string[]): void {
  emit('update', { exampleImages: next });
}

function onExampleUpdate(index: number, value: string): void {
  const next = exampleImages.value.map((url, i) => (i === index ? value : url));
  commitExamples(next);
}

function onRemoveExample(index: number): void {
  commitExamples(exampleImages.value.filter((_, i) => i !== index));
}

function onAddExample(): void {
  commitExamples([...exampleImages.value, '']);
}
</script>

<style scoped>
.image-uploader-props {
  display: flex;
  flex-direction: column;
}

.image-uploader-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.image-uploader-props__line {
  display: flex;
  gap: var(--spacing-sm);
}

.image-uploader-props__col {
  flex: 1;
  min-width: 0;
}

.image-uploader-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.image-uploader-props__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.image-uploader-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.image-uploader-props__add {
  margin-top: var(--spacing-sm);
}
</style>
