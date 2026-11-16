<template>
  <div class="thumb-cell">
    <a-popover v-if="url" placement="right" :mouse-enter-delay="0.2">
      <template #content>
        <div class="big">
          <img v-if="!asVideo" :src="url" :alt="label" @error="asVideo = true" />
          <video v-else :src="url" controls muted playsinline preload="metadata" />
        </div>
      </template>
      <div class="thumb">
        <img v-if="!asVideo" :src="url" :alt="label" @error="asVideo = true" />
        <video v-else :src="url" muted playsinline preload="metadata" />
      </div>
    </a-popover>
    <div v-else class="thumb empty" :class="{ broken: configured }">
      {{ configured ? '预览不可用' : '未配置' }}
    </div>
    <span class="caption">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * 列表里的素材缩略图：给运营看素材本身，不看编号。地址先按图片显示，加载失败自动改用视频首帧；
 * 悬停放大（视频可播放）。没配置显示「未配置」，配置了但签不出预览显示「预览不可用」。
 */
import { ref, watch } from 'vue';

const props = defineProps<{
  /** 短时效预览地址；没有 = 未配置或签不出 */
  url?: string;
  label: string;
  /** 这一位是否配置了素材（区分「未配置」与「预览不可用」） */
  configured: boolean;
}>();

const asVideo = ref(false);
watch(
  () => props.url,
  () => {
    asVideo.value = false;
  },
);
</script>

<style scoped>
.thumb-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 64px;
}
.thumb {
  width: 64px;
  height: 86px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--ant-color-fill-tertiary, #f5f5f5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
}
.thumb img,
.thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb.empty {
  cursor: default;
  border: 1px dashed var(--ant-color-border, #d9d9d9);
  background: transparent;
  color: var(--ant-color-text-quaternary, #bbb);
  font-size: 11px;
  text-align: center;
  padding: 4px;
}
.thumb.empty.broken {
  color: var(--ant-color-warning, #faad14);
}
.caption {
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
}
.big {
  width: 240px;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ant-color-fill-tertiary, #f5f5f5);
  border-radius: 6px;
  overflow: hidden;
}
.big img,
.big video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
