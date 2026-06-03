<!-- src/views/template/builder/props/CommonProps.vue -->
<!--
  CommonProps — 全部 widget 共有的公共字段编辑器 (WidgetBase)。

  编辑字段：key / label / placeholder / helpText / required / disabled / hidden。
  (defaultValue / className / sort 等由专用编辑器或上层逻辑处理，公共面板不暴露。)

  数据流：任意字段变化即 emit('update', { 字段: 值 })，由 PropertyPanel 转发为
          update-widget。key 字段做变量名校验（非空、建议 \w+），仅作提示，
          不阻止 emit（落地由上层去重/校验）。
-->
<template>
  <a-form class="common-props" layout="vertical" :colon="false">
    <a-form-item
      :label="$t('template.widgetKey')"
      :validate-status="keyStatus"
      :help="keyHelp"
    >
      <a-input
        :value="widget.key"
        :placeholder="$t('template.widgetKeyPlaceholder')"
        allow-clear
        @update:value="onUpdate('key', $event)"
      >
        <template #prefix>
          <Icon icon="antdv-next:KeyOutlined" />
        </template>
      </a-input>
    </a-form-item>

    <a-form-item :label="$t('template.widgetLabel')">
      <a-input
        :value="widget.label"
        :placeholder="$t('template.widgetLabelPlaceholder')"
        allow-clear
        @update:value="onUpdate('label', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.widgetPlaceholder')">
      <a-input
        :value="widget.placeholder"
        :placeholder="$t('template.widgetPlaceholderHint')"
        allow-clear
        @update:value="onUpdate('placeholder', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.widgetHelpText')">
      <a-input
        :value="widget.helpText"
        :placeholder="$t('template.widgetHelpTextHint')"
        allow-clear
        @update:value="onUpdate('helpText', $event)"
      />
    </a-form-item>

    <div class="common-props__switches">
      <a-form-item :label="$t('template.widgetRequired')">
        <a-switch
          :checked="widget.required === true"
          size="small"
          @update:checked="onUpdate('required', $event)"
        />
      </a-form-item>

      <a-form-item :label="$t('template.widgetDisabled')">
        <a-switch
          :checked="widget.disabled === true"
          size="small"
          @update:checked="onUpdate('disabled', $event)"
        />
      </a-form-item>

      <a-form-item :label="$t('template.widgetHidden')">
        <a-switch
          :checked="widget.hidden === true"
          size="small"
          @update:checked="onUpdate('hidden', $event)"
        />
      </a-form-item>
    </div>
  </a-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import type { WidgetConfig } from '@/types/template-builder'

const props = defineProps<{
  widget: WidgetConfig
}>()

const emit = defineEmits<{
  (e: 'update', patch: Record<string, unknown>): void
}>()

/** 合法变量名：字母/下划线开头，后续可为字母/数字/下划线 */
const KEY_PATTERN = /^[A-Za-z_]\w*$/

const keyStatus = computed<'' | 'error' | 'warning'>(() => {
  const key = props.widget.key
  if (!key || key.trim().length === 0) return 'error'
  if (!KEY_PATTERN.test(key)) return 'warning'
  return ''
})

const keyHelp = computed<string>(() => {
  if (keyStatus.value === 'error') return $t('template.widgetKeyRequired')
  if (keyStatus.value === 'warning') return $t('template.widgetKeyInvalid')
  return ''
})

function onUpdate(field: keyof WidgetConfig, value: unknown): void {
  emit('update', { [field]: value })
}
</script>

<style scoped>
.common-props {
  display: flex;
  flex-direction: column;
}

.common-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.common-props__switches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
}

.common-props__switches :deep(.ant-form-item) {
  margin-bottom: var(--spacing-sm);
}
</style>
