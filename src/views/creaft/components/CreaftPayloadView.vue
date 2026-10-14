<template>
  <div class="payload-visual">
    <a-alert v-if="model.error" type="error" show-icon :message="model.error" />

    <template v-else>
      <section v-if="tiles.length" class="pv-section">
        <div class="pv-title">
          图片与视频 <span class="muted">{{ tiles.length }} 个</span>
        </div>
        <div class="pv-grid">
          <div v-for="tile in tiles" :key="tile.key" class="pv-cell">
            <div class="pv-cell-head">
              <span class="pv-cell-label"
                >{{ tile.label }}{{ tile.index ? ` ${tile.index}` : '' }}</span
              >
              <span v-if="tile.size" class="muted">{{ tile.size }}</span>
            </div>
            <div class="pv-thumb">
              <div v-if="broken.has(tile.url)" class="pv-broken">无法加载</div>
              <video
                v-else-if="tile.kind === 'video'"
                :src="tile.url"
                controls
                preload="metadata"
                @error="markBroken(tile.url)"
              />
              <img
                v-else
                :src="tile.url"
                :alt="tile.label"
                loading="lazy"
                @error="markBroken(tile.url)"
              />
            </div>
            <a class="pv-link" :href="tile.url" target="_blank" rel="noopener noreferrer">原地址</a>
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

/** 所有素材铺成一张平铺的网格：图种之间不再各占一行，单图的组也不会孤零零地撑出一整行 */
const tiles = computed(() =>
  model.value.media.flatMap((group) =>
    group.items.map((item, index) => ({
      key: `${group.path}-${index}`,
      label: group.label,
      index: group.items.length > 1 ? index + 1 : 0,
      kind: group.kind,
      url: item.url,
      size: item.size,
    })),
  ),
);

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
.pv-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.pv-cell {
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.pv-cell-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.pv-cell-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-thumb {
  height: 140px;
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
.pv-link {
  font-size: 12px;
  align-self: flex-end;
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
