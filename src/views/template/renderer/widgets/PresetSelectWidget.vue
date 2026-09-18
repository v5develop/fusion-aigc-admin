<!-- src/views/template/renderer/widgets/PresetSelectWidget.vue -->
<!--
  PresetSelectWidget — 预设方案选择器。

  - value 形态：选中的 PresetOption.id (string)。
  - displayMode: 'cards' | 'list' | 'grid' 三种视觉布局。
  - builder 模式：只读预览、禁用交互、isSelected 时高亮。
  - viewer 模式：可交互，点击预设卡片后 emit('update:form-values', config.key, preset.id)。
-->
<template>
  <div
    class="widget-wrapper preset-select-widget"
    :class="[{ 'widget-selected': isSelected }, props.config.className]"
  >
    <div class="widget-header">
      <span class="widget-label">
        {{ props.config.label }}
        <span v-if="props.config.required" class="required-mark">*</span>
      </span>
      <a-tooltip v-if="props.config.helpText" :title="props.config.helpText">
        <Icon icon="antdv-next:QuestionCircleOutlined" class="help-icon" />
      </a-tooltip>
    </div>

    <a-empty
      v-if="presets.length === 0"
      :description="$t('template.presetSelect.empty')"
      class="preset-empty"
    />

    <div v-else class="preset-list" :class="`preset-list--${displayMode}`">
      <div
        v-for="preset in presets"
        :key="preset.id"
        class="preset-card"
        :class="{
          'preset-card--active': preset.id === selectedId,
          'preset-card--disabled': props.mode === 'builder',
        }"
        role="button"
        :tabindex="props.mode === 'viewer' ? 0 : -1"
        :aria-pressed="preset.id === selectedId"
        @click="onSelect(preset.id)"
        @keydown.enter.prevent="onSelect(preset.id)"
        @keydown.space.prevent="onSelect(preset.id)"
      >
        <div v-if="displayMode !== 'list'" class="preset-cover">
          <img
            v-if="preset.coverUrl"
            :src="preset.coverUrl"
            :alt="preset.label"
            class="preset-cover-img"
          />
          <div v-else class="preset-cover-placeholder">
            <Icon icon="antdv-next:AppstoreOutlined" :size="22" />
          </div>
          <div v-if="preset.id === selectedId" class="preset-checkmark">
            <Icon icon="antdv-next:CheckCircleOutlined" :size="18" />
          </div>
        </div>

        <div class="preset-body">
          <div class="preset-title-row">
            <Icon
              v-if="displayMode === 'list'"
              :icon="
                preset.id === selectedId ? 'antdv-next:check-circle' : 'antdv-next:AppstoreOutlined'
              "
              :size="16"
              class="preset-list-icon"
            />
            <span class="preset-label">{{ preset.label }}</span>
          </div>
          <p v-if="preset.description" class="preset-desc">{{ preset.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PresetOption, PresetSelectWidgetConfig, RenderMode } from '@/types/template-builder';

import { computed } from 'vue';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = withDefaults(
  defineProps<{
    config: PresetSelectWidgetConfig;
    mode: RenderMode;
    formValues?: Record<string, unknown>;
    isSelected?: boolean;
  }>(),
  {
    formValues: undefined,
    isSelected: false,
  },
);

const emit = defineEmits<{
  (e: 'update:form-values', key: string, value: unknown): void;
}>();

const presets = computed<PresetOption[]>(() => props.config.presets ?? []);

const displayMode = computed(() => props.config.displayMode ?? 'cards');

/** 当前选中的 preset id：viewer 读 formValues，回退 defaultValue */
const selectedId = computed<string>(() => {
  const raw = props.formValues?.[props.config.key];
  if (typeof raw === 'string') {
    return raw;
  }
  return typeof props.config.defaultValue === 'string' ? props.config.defaultValue : '';
});

function onSelect(id: string) {
  // builder 模式只读，不回写
  if (props.mode !== 'viewer') {
    return;
  }
  // 切换同一项视为取消选中
  const next = id === selectedId.value ? '' : id;
  // 本批次：仅 emit 自身选中的 preset id。
  // TODO(联动): 后续根据 config.linkedWidgets 与命中 preset.values，
  //   逐一 emit('update:form-values', linkedWidget.widgetKey, value) 联动其他 widget。
  emit('update:form-values', props.config.key, next);
}
</script>

<style scoped>
.preset-select-widget {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  font-family: var(--font-family);
  line-height: var(--line-height-base);
}

.widget-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.widget-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.required-mark {
  margin-left: 2px;
  color: var(--color-error);
}

.help-icon {
  color: var(--color-text-tertiary);
  cursor: help;
}

.preset-empty {
  margin: var(--spacing-md) 0;
}

/* ── 列表容器：三种布局 ────────────────────────────── */
.preset-list {
  display: grid;
  gap: var(--spacing-sm);
}

.preset-list--cards {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.preset-list--grid {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.preset-list--list {
  grid-template-columns: 1fr;
  gap: var(--spacing-xs);
}

/* ── 单个预设卡片 ──────────────────────────────────── */
.preset-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    border-color var(--duration-base),
    box-shadow var(--duration-base),
    transform var(--duration-fast);
}

.preset-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card-hover);
}

.preset-card:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.preset-card--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-1);
}

.preset-card--disabled {
  cursor: default;
}

.preset-card--disabled:hover {
  border-color: var(--color-border);
  box-shadow: var(--shadow-card);
}

.preset-list--list .preset-card {
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

/* ── 封面 ──────────────────────────────────────────── */
.preset-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--color-bg-layout);
}

.preset-list--grid .preset-cover {
  aspect-ratio: 1 / 1;
}

.preset-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preset-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-quaternary);
}

.preset-checkmark {
  position: absolute;
  top: var(--spacing-xs);
  right: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: var(--color-bg-container);
  border-radius: var(--radius-full);
  line-height: 1;
}

/* ── 文本主体 ──────────────────────────────────────── */
.preset-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
}

.preset-list--list .preset-body {
  padding: 0;
}

.preset-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.preset-list-icon {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.preset-card--active .preset-list-icon {
  color: var(--color-primary);
}

.preset-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-list--grid .preset-label {
  font-size: var(--font-size-sm);
}

.preset-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preset-list--grid .preset-desc {
  display: none;
}
</style>
