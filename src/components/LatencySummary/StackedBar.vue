<template>
  <div class="lsb" :style="{ height: `${height}px` }">
    <a-tooltip v-for="seg in segments" :key="seg.category" placement="top">
      <template #title>
        <div>{{ seg.name }}</div>
        <div>{{ seg.detail }}</div>
      </template>
      <span
        class="lsb__seg"
        :style="{ width: `${seg.width}%`, background: categoryColor(seg.category) }"
        >{{ seg.width >= 9 ? `${seg.pct.toFixed(0)}%` : '' }}</span
      >
    </a-tooltip>
    <span v-if="!segments.length" class="lsb__empty" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { categoryColor, categoryI18nKey, formatDuration, sortByCategory } from './categories';

const props = withDefaults(
  defineProps<{
    items: { category: string; label?: string; pct: number; ms?: number | null }[];
    height?: number;
  }>(),
  { height: 22 },
);
const { t, te } = useI18n();

const segments = computed(() => {
  const list = sortByCategory(props.items.filter((i) => i.pct > 0));
  const sum = list.reduce((a, i) => a + i.pct, 0) || 1;
  return list.map((i) => {
    const key = categoryI18nKey(i.category);
    const name = te(key) ? t(key) : i.label || i.category;
    return {
      category: i.category,
      name,
      pct: i.pct,
      // 百分比之和可能 ≠ 100（四舍五入），按总和归一，保证铺满
      width: (i.pct / sum) * 100,
      detail: `${i.ms != null ? `${formatDuration(i.ms)} · ` : ''}${i.pct.toFixed(1)}%`,
    };
  });
});
</script>

<style scoped>
.lsb {
  display: flex;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-fill-quaternary, #f5f5f5);
}
.lsb__seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2px;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.5);
}
.lsb__seg:last-child {
  border-right: none;
}
.lsb__empty {
  flex: 1;
}
</style>
