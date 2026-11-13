<template>
  <div class="ls">
    <div class="ls-top">
      <div class="ls-kpi ls-kpi--main">
        <div class="ls-kpi__label">{{ t('latency.total') }}</div>
        <div class="ls-kpi__value">
          {{ summary.totalMs != null ? formatDuration(summary.totalMs) : '-' }}
        </div>
        <div class="ls-kpi__sub">{{ t('latency.submitToDelivery') }}</div>
      </div>
      <div class="ls-kpi">
        <div class="ls-kpi__label">{{ t('latency.submittedAt') }}</div>
        <div class="ls-kpi__text">{{ formatDateTime(summary.submittedAt) }}</div>
      </div>
      <div class="ls-kpi">
        <div class="ls-kpi__label">{{ t('latency.deliveredAt') }}</div>
        <div class="ls-kpi__text">
          <template v-if="summary.deliveredAt">{{ formatDateTime(summary.deliveredAt) }}</template>
          <TraceTag v-else tone="gray">{{ t('latency.notDelivered') }}</TraceTag>
        </div>
      </div>
      <div class="ls-kpi">
        <div class="ls-kpi__label">{{ t('latency.firstResult') }}</div>
        <div class="ls-kpi__text">
          {{ summary.firstResultMs != null ? formatDuration(summary.firstResultMs) : '-' }}
        </div>
      </div>
    </div>

    <template v-if="summary.breakdown?.length">
      <div class="ls-title">{{ t('latency.breakdown') }}</div>
      <div v-if="!hasBreakdownData" class="ls-nodata">
        <InfoCircleOutlined /> {{ t('latency.noBreakdown') }}
      </div>
      <template v-else>
        <StackedBar :items="summary.breakdown" :height="10" />
        <div class="ls-legend">
          <a-tooltip v-for="b in visibleBreakdown" :key="b.category" :title="b.tip">
            <span class="ls-legend__item">
              <i :style="{ background: categoryColor(b.category, isDark) }" />
              {{ b.name }}
              <b>{{ formatDuration(b.ms) }}</b>
              <em>{{ b.pct.toFixed(1) }}%</em>
            </span>
          </a-tooltip>
          <span v-if="zeroCount > 0" class="ls-legend__rest">{{
            t('latency.restZero', { n: zeroCount })
          }}</span>
        </div>
      </template>
    </template>

    <template v-if="summary.slowest?.length">
      <div class="ls-title">
        {{ t('latency.slowest') }}
        <small>{{ t('latency.slowestHint') }}</small>
      </div>
      <ol class="ls-slow">
        <li
          v-for="(s, i) in summary.slowest"
          :key="s.spanId"
          class="ls-slow__row"
          @click="emit('focus-span', s.spanId)"
        >
          <span class="ls-slow__rank">{{ i + 1 }}</span>
          <TraceTag :tone="categoryColor(s.category, isDark)" class="ls-slow__cat">{{
            catName(s.category)
          }}</TraceTag>
          <span class="ls-slow__label" :title="s.key">{{ s.label || s.key || s.spanId }}</span>
          <span class="ls-slow__bar"
            ><i
              :style="{
                width: `${Math.max(2, (s.selfMs / maxSelf) * 100)}%`,
                background: categoryColor(s.category, isDark),
              }"
          /></span>
          <span class="ls-slow__ms">{{ formatDuration(s.selfMs) }}</span>
          <span class="ls-slow__dur"
            >{{ t('latency.spanDuration') }} {{ formatDuration(s.durationMs) }}</span
          >
        </li>
      </ol>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TaskLatencySummary } from '@/api/creation-latency';

import { InfoCircleOutlined } from '@antdv-next/icons';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDateTime } from '@/utils/helpers';

import TraceTag from '../TraceTag/index.vue';
import { useIsDark } from '../trace-theme';
import { categoryColor, categoryI18nKey, formatDuration } from './categories';
import StackedBar from './StackedBar.vue';

const props = defineProps<{ summary: TaskLatencySummary }>();
const emit = defineEmits<{ (e: 'focus-span', id: string): void }>();
const { t, te } = useI18n();
const isDark = useIsDark();

function catName(code: string, label?: string) {
  const key = categoryI18nKey(code);
  return te(key) ? t(key) : label || code;
}

const breakdownRows = computed(() =>
  (props.summary.breakdown || []).map((b) => ({
    ...b,
    name: catName(b.category, b.label),
    tip: `${catName(b.category, b.label)}: ${formatDuration(b.ms)} (${b.pct.toFixed(1)}%)`,
  })),
);
/** 没有任何非 other 类别有耗时，或 other 占 95% 以上：视为没有分段数据，不画条 */
const hasBreakdownData = computed(() => {
  const rows = breakdownRows.value;
  const other = rows.find((r) => r.category === 'other');
  const hasReal = rows.some((r) => r.category !== 'other' && r.ms > 0);
  return hasReal && (other?.pct ?? 0) < 95;
});
/** 图例只列有耗时的类别，按耗时降序 */
const visibleBreakdown = computed(() =>
  breakdownRows.value.filter((r) => r.ms > 0).sort((a, b) => b.ms - a.ms),
);
const zeroCount = computed(() => breakdownRows.value.filter((r) => !(r.ms > 0)).length);
const maxSelf = computed(() => Math.max(1, ...(props.summary.slowest || []).map((s) => s.selfMs)));
</script>

<style scoped>
.ls {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-fill-quaternary);
}
.ls-top {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  align-items: flex-end;
  margin-bottom: 16px;
}
.ls-kpi__label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.ls-kpi__value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-primary, #1677ff);
}
.ls-kpi__sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.ls-kpi__text {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 500;
}
.ls-title {
  margin: 14px 0 8px;
  font-weight: 600;
}
.ls-title small {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.ls-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.ls-legend__item i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
}
.ls-legend__item b {
  margin-left: 6px;
  color: var(--color-text-primary);
  font-weight: 600;
}
.ls-legend__item em {
  margin-left: 4px;
  font-style: normal;
  color: var(--color-text-secondary);
}
.ls-nodata {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.ls-legend__rest {
  color: var(--color-text-tertiary);
}
.ls-slow {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ls-slow__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.ls-slow__row:hover {
  background: var(--color-fill-quaternary, rgba(127, 127, 127, 0.1));
}
.ls-slow__rank {
  width: 18px;
  text-align: center;
  color: var(--color-text-secondary);
}
.ls-slow__cat {
  margin: 0;
  min-width: 72px;
  text-align: center;
}
.ls-slow__label {
  flex: 0 1 280px;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ls-slow__bar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.16);
  overflow: hidden;
}
.ls-slow__bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
}
.ls-slow__ms {
  width: 64px;
  text-align: right;
  font-weight: 600;
}
.ls-slow__dur {
  width: 110px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
