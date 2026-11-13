<template>
  <span class="trace-tag" :style="style"><slot /></span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { pickColor, resolveTone, TONES, tagStyle, useIsDark } from '../trace-theme';

/**
 * 主题自适应标签：tone 接受 green/red/... 或 antd 预设色名 / success / error 等；
 * 以 # 开头视为实色。不依赖 a-tag 预设色，保证亮 / 暗两套都可读。
 */
const props = defineProps<{ tone?: string | null }>();
const isDark = useIsDark();

const style = computed(() => {
  const t = props.tone || '';
  const solid = t.startsWith('#') ? t : pickColor(TONES[resolveTone(t)], isDark.value);
  return tagStyle(solid, isDark.value);
});
</script>

<style scoped>
.trace-tag {
  display: inline-block;
  box-sizing: border-box;
  max-width: 100%;
  margin-inline-end: 8px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
</style>
