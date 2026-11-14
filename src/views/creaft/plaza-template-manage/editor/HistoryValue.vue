<template>
  <span v-if="collapsed">
    <span class="hv-big">（内容较长，共 {{ big?.len }} 字）</span>
    <a-button size="small" type="link" @click="expanded = !expanded">
      {{ expanded ? '收起全文' : '查看全文' }}
    </a-button>
    <pre v-if="expanded" class="hv-pre">{{ full }}</pre>
  </span>
  <pre v-else-if="isComplex" class="hv-pre">{{ pretty }}</pre>
  <span v-else-if="isEmpty" class="hv-empty">（空）</span>
  <span v-else>{{ String(value) }}</span>
</template>

<script lang="ts">
export interface HistoryChange {
  field: string;
  from: unknown;
  to: unknown;
}
</script>

<script setup lang="ts">
import type { AuditEntry } from '@/api/plaza-admin';

import { computed, ref } from 'vue';

const props = defineProps<{ entry: AuditEntry; change: HistoryChange; side: 'before' | 'after' }>();

const value = computed(() => (props.side === 'before' ? props.change.from : props.change.to));
/** 大字段在 diff 里只有 {len, sha256}，全文在 before / after 快照里 */
const big = computed(() => {
  const v = value.value as { len?: number; sha256?: string } | null;
  return v && typeof v === 'object' && typeof v.len === 'number' && typeof v.sha256 === 'string'
    ? v
    : null;
});
const collapsed = computed(() => big.value !== null);
const expanded = ref(false);
const full = computed(() => {
  const snap = props.side === 'before' ? props.entry.before : props.entry.after;
  const v = snap?.[props.change.field];
  if (v === undefined || v === null) return '（快照里没有这个字段）';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
});
const isEmpty = computed(
  () => value.value === null || value.value === undefined || value.value === '',
);
const isComplex = computed(() => !isEmpty.value && typeof value.value === 'object');
const pretty = computed(() => JSON.stringify(value.value, null, 2));
</script>

<style scoped>
.hv-pre {
  max-height: 240px;
  margin: 4px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
}
.hv-empty,
.hv-big {
  color: var(--ant-color-text-tertiary, #888);
}
</style>
