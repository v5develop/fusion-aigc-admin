<template>
  <div class="payload-visual">
    <a-alert v-if="model.error" type="error" show-icon :message="model.error" />

    <template v-else>
      <section v-if="model.media.length" class="pv-section">
        <div class="pv-title">图片与视频</div>
        <div v-for="group in model.media" :key="group.path" class="pv-group">
          <div class="pv-group-title">
            {{ group.label }}
            <span class="muted">{{ group.items.length }} 个</span>
          </div>
          <div class="pv-grid">
            <div
              v-for="(item, index) in group.items"
              :key="`${group.path}-${index}`"
              class="pv-cell"
            >
              <div class="pv-thumb">
                <div v-if="broken.has(item.url)" class="pv-broken">无法加载</div>
                <video
                  v-else-if="group.kind === 'video'"
                  :src="item.url"
                  controls
                  preload="metadata"
                  @error="markBroken(item.url)"
                />
                <img
                  v-else
                  :src="item.url"
                  :alt="group.label"
                  loading="lazy"
                  @error="markBroken(item.url)"
                />
              </div>
              <div class="pv-caption">
                <span class="muted">{{ item.size ?? '' }}</span>
                <a :href="item.url" target="_blank" rel="noopener noreferrer">原地址</a>
              </div>
            </div>
          </div>
        </div>
        <div class="muted pv-hint">
          图片地址在 v1 的桶（oss.creaft.cn）。打不开时多半是那边的域名或对象失效，不是后台的问题。
        </div>
      </section>

      <section v-if="model.texts.length" class="pv-section">
        <div class="pv-title">文字</div>
        <div v-for="field in model.texts" :key="field.path" class="pv-text">
          <div class="pv-text-label">
            {{ field.label }}
            <a-tag v-if="field.sensitive" color="orange">不下发端侧</a-tag>
          </div>
          <pre v-if="field.multiline" class="pv-pre">{{ field.value }}</pre>
          <div v-else class="pv-line">{{ field.value }}</div>
        </div>
      </section>

      <section v-if="model.tags.length" class="pv-section">
        <div class="pv-title">标签</div>
        <a-tag v-for="tag in model.tags" :key="tag">{{ tag }}</a-tag>
      </section>

      <section v-if="model.meta.length" class="pv-section">
        <div class="pv-title">元数据</div>
        <div v-for="item in model.meta" :key="item.label" class="pv-meta">
          <span class="muted">{{ item.label }}：</span><code>{{ item.value }}</code>
        </div>
      </section>

      <div v-if="!model.media.length && !model.texts.length && !model.tags.length" class="muted">
        载荷为空对象
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { buildPayloadViewModel } from './payloadViewModel';

const props = defineProps<{ payloadJson: string | null }>();

const model = computed(() => buildPayloadViewModel(props.payloadJson));

/** 加载失败的地址记在本组件实例里，同一地址不反复请求；按 URL 记，换载荷也一样生效 */
const broken = ref<Set<string>>(new Set());
function markBroken(url: string) {
  broken.value = new Set(broken.value).add(url);
}
</script>

<style scoped>
.payload-visual {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pv-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pv-title {
  font-weight: 600;
}
.pv-group-title {
  margin: 4px 0;
  font-size: 13px;
}
.pv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.pv-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.pv-thumb {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  overflow: hidden;
}
.pv-thumb img,
.pv-thumb video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.pv-broken {
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 12px;
}
.pv-caption {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.pv-hint {
  font-size: 12px;
}
.pv-text-label {
  font-size: 12px;
  margin-bottom: 2px;
}
.pv-line {
  word-break: break-all;
}
.pv-pre {
  max-height: 200px;
  overflow: auto;
  margin: 0;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.pv-meta {
  font-size: 12px;
}
</style>
