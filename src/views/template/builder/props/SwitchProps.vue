<!-- src/views/template/builder/props/SwitchProps.vue -->
<!--
  SwitchProps — switch 类型 widget 的特有字段编辑器。

  仅编辑 SwitchWidgetConfig 的特有字段：
    checkedValue / uncheckedValue（选中/未选中时回填的值，文本输入）
    checkedText / uncheckedText（开关内显示的文案）
  公共字段（key/label/placeholder/required/disabled/hidden/helpText）由 CommonProps 负责。

  数据流：任意字段变化即 emit('update', { 字段: 值 })，由 PropertyPanel 转发为 update-widget。
  值字段以文本编辑，清空时回传 undefined。
-->
<template>
  <a-form class="switch-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.switchCheckedValue')">
      <a-input
        :value="toText(widget.checkedValue)"
        :placeholder="$t('template.switchCheckedValuePlaceholder')"
        allow-clear
        @update:value="onUpdateValue('checkedValue', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.switchUncheckedValue')">
      <a-input
        :value="toText(widget.uncheckedValue)"
        :placeholder="$t('template.switchUncheckedValuePlaceholder')"
        allow-clear
        @update:value="onUpdateValue('uncheckedValue', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.switchCheckedText')">
      <a-input
        :value="widget.checkedText"
        :placeholder="$t('template.switchCheckedTextPlaceholder')"
        allow-clear
        @update:value="onUpdateText('checkedText', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.switchUncheckedText')">
      <a-input
        :value="widget.uncheckedText"
        :placeholder="$t('template.switchUncheckedTextPlaceholder')"
        allow-clear
        @update:value="onUpdateText('uncheckedText', $event)"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { $t } from '@/locales'
import type { SwitchWidgetConfig } from '@/types/template-builder'

const props = defineProps<{
  widget: SwitchWidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

/** 将值字段（string|number|boolean）转为可编辑文本，undefined 显示空串。 */
function toText(value: string | number | boolean | undefined): string {
  if (value === undefined) return ''
  return String(value)
}

/** 值字段（checkedValue/uncheckedValue）：文本编辑，空串回传 undefined。 */
function onUpdateValue(
  field: 'checkedValue' | 'uncheckedValue',
  value: string,
): void {
  const trimmed = value.trim()
  emit('update', { [field]: trimmed.length === 0 ? undefined : value })
}

/** 文案字段（checkedText/uncheckedText）：空串回传 undefined。 */
function onUpdateText(
  field: 'checkedText' | 'uncheckedText',
  value: string,
): void {
  emit('update', { [field]: value.length === 0 ? undefined : value })
}
</script>

<style scoped>
.switch-props {
  display: flex;
  flex-direction: column;
}

.switch-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}
</style>
