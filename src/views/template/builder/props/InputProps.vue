<!-- src/views/template/builder/props/InputProps.vue -->
<!--
  InputProps — input 类型 widget 的特有字段编辑器。

  仅编辑 InputWidgetConfig 的特有字段：
    inputType（text/password/email/url 下拉）
    maxLength / minLength（数值）
    prefixIcon（前缀图标名，文本）
    suffix（后缀文本）
    autoSize（多行模式自动调整高度，布尔）
  公共字段（key/label/placeholder/required/disabled/hidden/helpText）由 CommonProps 负责。

  数据流：任意字段变化即 emit('update', { 字段: 值 })，由 PropertyPanel 转发为 update-widget。
  文本字段清空时回传 undefined，数值字段清空时回传 undefined。
-->
<template>
  <a-form class="input-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.inputType')">
      <a-select
        :value="widget.inputType"
        :options="inputTypeOptions"
        :placeholder="$t('template.inputTypePlaceholder')"
        allow-clear
        @update:value="onUpdateInputType"
      />
    </a-form-item>

    <a-form-item :label="$t('template.inputMaxLength')">
      <a-input-number
        class="input-props__number"
        :value="widget.maxLength"
        :min="0"
        :placeholder="$t('template.inputMaxLengthPlaceholder')"
        @update:value="onUpdateNumber('maxLength', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.inputMinLength')">
      <a-input-number
        class="input-props__number"
        :value="widget.minLength"
        :min="0"
        :placeholder="$t('template.inputMinLengthPlaceholder')"
        @update:value="onUpdateNumber('minLength', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.inputPrefixIcon')">
      <a-input
        :value="widget.prefixIcon"
        :placeholder="$t('template.inputPrefixIconPlaceholder')"
        allow-clear
        @update:value="onUpdateText('prefixIcon', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.inputSuffix')">
      <a-input
        :value="widget.suffix"
        :placeholder="$t('template.inputSuffixPlaceholder')"
        allow-clear
        @update:value="onUpdateText('suffix', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.inputAutoSize')">
      <a-switch
        :checked="widget.autoSize ?? false"
        size="small"
        @update:checked="onUpdateAutoSize"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import type { InputWidgetConfig } from '@/types/template-builder';

import { $t } from '@/locales';

const props = defineProps<{
  widget: InputWidgetConfig;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void;
}>();

type InputType = NonNullable<InputWidgetConfig['inputType']>;

/** 输入框类型下拉项。 */
const inputTypeOptions: { label: string; value: InputType }[] = [
  { label: $t('template.inputTypeText'), value: 'text' },
  { label: $t('template.inputTypePassword'), value: 'password' },
  { label: $t('template.inputTypeEmail'), value: 'email' },
  { label: $t('template.inputTypeUrl'), value: 'url' },
];

/** inputType：清空回传 undefined。 */
function onUpdateInputType(value: InputType | undefined): void {
  emit('update', { inputType: value ?? undefined });
}

/** 数值字段（maxLength/minLength）：清空回传 undefined。 */
function onUpdateNumber(field: 'maxLength' | 'minLength', value: number | null): void {
  emit('update', { [field]: value === null ? undefined : value });
}

/** 文本字段（prefixIcon/suffix）：空串回传 undefined。 */
function onUpdateText(field: 'prefixIcon' | 'suffix', value: string): void {
  emit('update', { [field]: value.length === 0 ? undefined : value });
}

/** autoSize：布尔字段。 */
function onUpdateAutoSize(checked: boolean): void {
  emit('update', { autoSize: checked });
}
</script>

<style scoped>
.input-props {
  display: flex;
  flex-direction: column;
}

.input-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.input-props__number {
  width: 100%;
}
</style>
