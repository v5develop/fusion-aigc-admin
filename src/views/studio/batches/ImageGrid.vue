<template>
  <a-empty v-if="!images.length" :image="false" :description="emptyText" />
  <a-image-preview-group v-else>
    <div class="ig">
      <div v-for="(img, i) in images" :key="i" class="ig-item">
        <span v-if="numbered" class="ig-no">{{ i + 1 }}</span>
        <a-image v-if="img.url" :src="img.url" :width="96" :height="96" class="ig-img" />
        <div v-else class="ig-ph">
          <span class="ig-ph-tip">无法预览</span>
          <code class="ig-ph-ref" :title="img.ref">{{ img.ref || '（空）' }}</code>
          <a-button v-if="img.ref" type="link" size="small" @click="copy(img.ref)">复制引用</a-button>
        </div>
        <div class="ig-meta">
          <a-tag v-if="img.id" class="ig-tag">{{ img.id }}</a-tag>
          <a-tag v-if="img.role" color="blue" class="ig-tag">{{ img.role }}</a-tag>
          <a-tooltip v-if="img.url && img.ref" title="复制原始引用">
            <a class="ig-copy" @click="copy(img.ref)">复制 ref</a>
          </a-tooltip>
        </div>
      </div>
    </div>
  </a-image-preview-group>
</template>

<script setup lang="ts">
import type { StudioImage } from '@/api/studio-admin';

import { message } from 'antdv-next';

withDefaults(
  defineProps<{ images: StudioImage[]; numbered?: boolean; emptyText?: string }>(),
  { numbered: true, emptyText: '无' },
);

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制');
  } catch {
    message.error('复制失败，请手动选择文本');
  }
}
</script>

<style scoped>
.ig {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.ig-item {
  position: relative;
  width: 100px;
}
.ig-no {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 2;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  line-height: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--ant-color-primary, #1677ff);
  border-radius: 10px;
}
.ig-img {
  object-fit: cover;
  border-radius: 4px;
}
.ig-ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  padding: 4px;
  overflow: hidden;
  border: 1px dashed var(--ant-color-border, #d9d9d9);
  border-radius: 4px;
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.04));
}
.ig-ph-tip {
  font-size: 12px;
  color: var(--ant-color-text-secondary, #888);
}
.ig-ph-ref {
  max-width: 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
}
.ig-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
  font-size: 12px;
}
.ig-tag {
  max-width: 96px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ig-copy {
  font-size: 12px;
}
</style>
