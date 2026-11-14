<template>
  <div class="tp">
    <div class="tp-head">
      <b>用户视角预览</b>
      <span class="muted">按当前表单实时渲染（未保存的修改也会显示）</span>
    </div>

    <div class="tp-sec">模板卡片（广场列表里的样子）</div>
    <div class="tp-card" @click="popupTab = 'detail'">
      <div class="tp-cover">
        <img v-if="coverUrl" :src="coverUrl" alt="" />
        <div v-else class="tp-noimg">还没有效果图</div>
        <span v-if="mediaType === 'video'" class="tp-badge">▶ 视频</span>
      </div>
      <div class="tp-meta">
        <div class="tp-title">{{ title || '（未填写标题）' }}</div>
        <div v-if="description" class="tp-desc">{{ description }}</div>
        <div v-if="tags.length" class="tp-tags">
          <span v-for="t in tags.slice(0, 3)" :key="t" class="tp-tag">{{ t }}</span>
        </div>
        <div class="tp-cta">做同款</div>
      </div>
    </div>

    <div class="tp-sec">
      预览弹窗（点卡片后）
      <a-segmented
        v-model:value="popupTab"
        size="small"
        :options="[
          { value: 'detail', label: '详情' },
          { value: 'form', label: '入参表单' },
        ]"
      />
    </div>
    <div class="tp-popup">
      <template v-if="popupTab === 'detail'">
        <div class="tp-stage">
          <video
            v-if="mediaType === 'video' && video"
            :src="video"
            :poster="poster || undefined"
            controls
            muted
            playsinline
          />
          <img v-else-if="gallery[activeIdx]" :src="gallery[activeIdx]" alt="" />
          <div v-else class="tp-noimg">还没有效果图</div>
        </div>
        <div v-if="mediaType !== 'video' && gallery.length > 1" class="tp-thumbs">
          <img
            v-for="(u, i) in gallery"
            :key="u + i"
            :src="u"
            :class="{ on: i === activeIdx }"
            alt=""
            @click="activeIdx = i"
          />
        </div>
        <div class="tp-ptitle">{{ title || '（未填写标题）' }}</div>
        <div v-if="description" class="tp-pdesc">{{ description }}</div>
        <div v-if="industryNames.length || channelNames.length" class="tp-tags">
          <span v-for="n in industryNames" :key="'i' + n" class="tp-tag">{{ n }}</span>
          <span v-for="n in channelNames" :key="'c' + n" class="tp-tag ch">{{ n }}</span>
        </div>
        <div v-if="guidance" class="tp-guide">{{ guidance }}</div>
        <div v-if="needsProductImage && !slots.length" class="tp-hint">
          需要用户上传产品图（未配置入参时的默认行为）
        </div>
      </template>
      <SlotsPreview v-else :items="slots" />
      <div class="tp-go">立即生成</div>
    </div>
    <div v-if="popupTab === 'form' && !slots.length" class="muted">
      入参在「配置入参」里单独保存；这里显示的是已保存的配置。
    </div>
    <div v-else-if="popupTab === 'form'" class="muted">
      示例交互不保存；显示的是已保存的入参配置。
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SlotItem } from '@/api/plaza-admin';

import { computed, ref, watch } from 'vue';

import SlotsPreview from '../slots/SlotsPreview.vue';

const props = defineProps<{
  title: string;
  description: string;
  mediaType: 'image' | 'video';
  /** 效果图（第 1 张是封面） */
  results: string[];
  video?: string;
  poster?: string;
  tags: string[];
  guidance: string;
  slots: SlotItem[];
  industryNames: string[];
  channelNames: string[];
  needsProductImage: boolean;
}>();

const popupTab = ref<'detail' | 'form'>('detail');
const activeIdx = ref(0);

const gallery = computed(() => props.results.filter(Boolean));
const coverUrl = computed(() =>
  props.mediaType === 'video' ? props.poster || gallery.value[0] || '' : gallery.value[0] || '',
);

watch(
  () => gallery.value.length,
  (n) => {
    if (activeIdx.value >= n) activeIdx.value = 0;
  },
);
</script>

<style scoped>
.tp {
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 8px;
  padding: 12px;
  background: var(--ant-color-bg-container, #fff);
}
.tp-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.tp-sec {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0 6px;
  font-size: 12px;
  color: var(--ant-color-text-secondary, #666);
}
.tp-card {
  width: 190px;
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}
.tp-cover {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
}
.tp-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tp-noimg {
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 80px;
  color: var(--ant-color-text-quaternary, #bbb);
  font-size: 12px;
}
.tp-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
}
.tp-meta {
  padding: 8px 10px 10px;
}
.tp-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.tp-tag {
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--ant-color-fill-tertiary, #f0f0f0);
  color: var(--ant-color-text-secondary, #666);
}
.tp-tag.ch {
  background: var(--ant-color-primary-bg, #e6f4ff);
  color: var(--ant-color-primary, #1677ff);
}
.tp-cta {
  margin-top: 8px;
  text-align: center;
  padding: 4px 0;
  border-radius: 6px;
  background: var(--ant-color-primary, #1677ff);
  color: #fff;
  font-size: 12px;
}
.tp-popup {
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  max-height: 560px;
  overflow: auto;
}
.tp-stage {
  background: var(--ant-color-fill-quaternary, #f5f5f5);
  border-radius: 8px;
  overflow: hidden;
  min-height: 120px;
}
.tp-stage img,
.tp-stage video {
  display: block;
  width: 100%;
  max-height: 300px;
  object-fit: contain;
}
.tp-thumbs {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  overflow-x: auto;
}
.tp-thumbs img {
  width: 44px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
}
.tp-thumbs img.on {
  border-color: var(--ant-color-primary, #1677ff);
}
.tp-ptitle {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 600;
}
.tp-pdesc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ant-color-text-secondary, #666);
  white-space: pre-wrap;
}
.tp-guide {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--ant-color-warning-bg, #fffbe6);
  color: var(--ant-color-text-secondary, #666);
  white-space: pre-wrap;
}
.tp-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
}
.tp-go {
  margin-top: 12px;
  text-align: center;
  padding: 7px 0;
  border-radius: 8px;
  background: var(--ant-color-primary, #1677ff);
  color: #fff;
  font-size: 13px;
}
</style>
