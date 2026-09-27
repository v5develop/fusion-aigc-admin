<template>
  <a-form layout="vertical" class="schema-form">
    <SchemaField
      v-for="[key, sub] in topProps"
      :key="key"
      :name="key"
      :schema="sub"
      :root="rootSchema"
      :required="topRequired.includes(key)"
      :model-value="modelValue[key]"
      :adapter-params-schema="adapterParamsSchema"
      :ref-options="refOptions"
      :errors="errors"
      :path="`/${key}`"
      :disabled="disabledKeys.includes(key)"
      @update:model-value="(v: unknown) => setKey(key, v)"
    />
    <a-empty v-if="!topProps.length" :description="formText('noSchema')" />
  </a-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { formText } from './gatewayI18n';
import { normalize, propertiesOf, requiredOf, type FieldError, type Schema } from './schema';
import SchemaField from './SchemaField.vue';

/**
 * 按网关下发的 JSON Schema 渲染整张表单。字段、顺序、必填、取值范围全部来自 schema；
 * 带 `x-aig-adapter-params: true` 的属性换成所选适配器的 params_schema。
 */
const props = withDefaults(
  defineProps<{
    schema: Schema;
    modelValue: Record<string, unknown>;
    adapterParamsSchema?: Schema | null;
    refOptions?: Record<string, { label: string; value: string }[]>;
    disabledKeys?: string[];
    errors?: FieldError[];
  }>(),
  {
    adapterParamsSchema: null,
    refOptions: () => ({}),
    disabledKeys: () => [],
    errors: () => [],
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, unknown>): void }>();

const rootSchema = computed(() => props.schema);
const topSchema = computed(() => normalize(props.schema, props.schema).schema);
const topProps = computed(() => propertiesOf(topSchema.value));
const topRequired = computed(() => requiredOf(topSchema.value));

function setKey(key: string, v: unknown) {
  const next = { ...props.modelValue };
  if (v === undefined) delete next[key];
  else next[key] = v;
  emit('update:modelValue', next);
}
</script>

<style scoped>
.schema-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}
</style>
