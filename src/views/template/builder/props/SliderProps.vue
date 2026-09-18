<!-- src/views/template/builder/props/SliderProps.vue -->
<!--
  SliderProps — slider 类型 widget 的特有字段编辑器。

  仅编辑 SliderWidgetConfig 的特有字段：
    min / max / step（数值，清空回传 undefined）
    range（范围模式，布尔）
    showInput（是否显示输入框，布尔）
    marks（Record<number, string> 刻度标记，可加减行：数值 → 标签）
  公共字段（key/label/placeholder/required/disabled/hidden/helpText）由 CommonProps 负责。

  数据流：任意字段变化即 emit('update', { 字段: 新值 })，由 PropertyPanel 转发为 update-widget。
  marks 以本地行模型（value/label）编辑，每次变化重建为 Record 整体回传；空 Record 回传 undefined。
  本地行模型仅在切换 widget（key 变化）时从 props 重新初始化，避免编辑数值中途出现的空值/重复键被外部更新冲掉。
-->
<template>
  <a-form class="slider-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.sliderMin')">
      <a-input-number
        class="slider-props__number"
        :value="widget.min"
        :placeholder="$t('template.sliderMinPlaceholder')"
        @update:value="onUpdateNumber('min', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sliderMax')">
      <a-input-number
        class="slider-props__number"
        :value="widget.max"
        :placeholder="$t('template.sliderMaxPlaceholder')"
        @update:value="onUpdateNumber('max', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sliderStep')">
      <a-input-number
        class="slider-props__number"
        :value="widget.step"
        :min="0"
        :placeholder="$t('template.sliderStepPlaceholder')"
        @update:value="onUpdateNumber('step', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sliderRange')">
      <a-switch
        :checked="widget.range ?? false"
        size="small"
        @update:checked="onUpdateBool('range', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sliderShowInput')">
      <a-switch
        :checked="widget.showInput ?? false"
        size="small"
        @update:checked="onUpdateBool('showInput', $event)"
      />
    </a-form-item>

    <a-divider />

    <a-form-item :label="$t('template.sliderMarks')">
      <div v-if="rows.length > 0" class="slider-props__list">
        <div v-for="(row, index) in rows" :key="index" class="slider-props__row">
          <a-input-number
            class="slider-props__row-value"
            :value="row.value"
            :placeholder="$t('template.sliderMarkValue')"
            @update:value="onRowValue(index, $event)"
          />
          <a-input
            class="slider-props__row-label"
            :value="row.label"
            :placeholder="$t('template.sliderMarkLabel')"
            allow-clear
            @update:value="onRowLabel(index, $event)"
          />
          <a-button type="text" class="slider-props__remove" @click="onRemoveMark(index)">
            <Icon icon="antdv-next:DeleteOutlined" />
          </a-button>
        </div>
      </div>

      <a-empty v-else :description="$t('template.sliderMarksEmpty')" :image="undefined" />

      <a-button block class="slider-props__add" @click="onAddMark">
        <Icon icon="antdv-next:PlusOutlined" />
        {{ $t('template.sliderAddMark') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { SliderWidgetConfig } from '@/types/template-builder';

import { ref, watch } from 'vue';

import Icon from '@/components/Icon/index.vue';
import { $t } from '@/locales';

const props = defineProps<{
  widget: SliderWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

/** marks 的本地行模型：数值键允许暂为 null（编辑中），标签为字符串。 */
interface MarkRow {
  value: number | null;
  label: string;
}

/** 将 marks Record 展开为按数值升序排列的行模型。 */
function marksToRows(marks: SliderWidgetConfig['marks']): MarkRow[] {
  if (!marks) return [];
  return Object.entries(marks)
    .map(([key, label]) => ({ value: Number(key), label }))
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
}

/** 将行模型重建为 Record，跳过无效数值；重复键以靠后行为准。 */
function rowsToMarks(list: MarkRow[]): Record<number, string> {
  const result: Record<number, string> = {};
  for (const row of list) {
    if (row.value === null || !Number.isFinite(row.value)) continue;
    result[row.value] = row.label;
  }
  return result;
}

const rows = ref<MarkRow[]>(marksToRows(props.widget.marks));

// 仅在切换到另一个 widget 时重新初始化行模型，避免编辑中途被外部更新冲掉。
watch(
  () => props.widget.key,
  () => {
    rows.value = marksToRows(props.widget.marks);
  },
);

/** 重建 marks 并回传，空 Record 回传 undefined。 */
function emitMarks(): void {
  const marks = rowsToMarks(rows.value);
  emit('update', {
    marks: Object.keys(marks).length === 0 ? undefined : marks,
  });
}

/** 数值字段（min/max/step）：清空回传 undefined。 */
function onUpdateNumber(field: 'min' | 'max' | 'step', value: number | null): void {
  emit('update', { [field]: value === null ? undefined : value });
}

/** 布尔字段（range/showInput）。 */
function onUpdateBool(field: 'range' | 'showInput', checked: boolean): void {
  emit('update', { [field]: checked });
}

/** 刻度行数值变更。 */
function onRowValue(index: number, value: number | null): void {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, value } : { ...row }));
  emitMarks();
}

/** 刻度行标签变更。 */
function onRowLabel(index: number, label: string): void {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, label } : { ...row }));
  emitMarks();
}

/** 新增空白刻度行（数值未填，暂不写入 Record，故不回传）。 */
function onAddMark(): void {
  rows.value = [...rows.value, { value: null, label: '' }];
}

/** 删除刻度行。 */
function onRemoveMark(index: number): void {
  rows.value = rows.value.filter((_, i) => i !== index);
  emitMarks();
}
</script>

<style scoped>
.slider-props {
  display: flex;
  flex-direction: column;
}

.slider-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.slider-props__number {
  width: 100%;
}

.slider-props__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.slider-props__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
}

.slider-props__row-value {
  flex: 0 0 35%;
}

.slider-props__row-label {
  flex: 1;
  min-width: 0;
}

.slider-props__remove {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.slider-props__add {
  margin-top: var(--spacing-sm);
}
</style>
