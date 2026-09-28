<template>
  <a-form-item
    :required="required"
    :extra="description"
    :validate-status="errorText ? 'error' : undefined"
    :help="errorText || undefined"
  >
    <!-- 原字段名放在悬停提示里（对照网关文档用），不再挤在说明行里像是多出来的内容 -->
    <template #label>
      <span :title="label !== name ? name : undefined">{{ label }}</span>
    </template>
    <!-- 适配器参数：换成所选适配器的 params_schema；还没选适配器时用 JSON 编辑 -->
    <template v-if="kind === 'adapter-params'">
      <div v-if="adapterParamsSchema" class="nested">
        <SchemaField
          v-for="[key, sub] in adapterProps"
          :key="key"
          :name="key"
          :schema="sub"
          :root="adapterParamsSchema"
          :required="adapterRequired.includes(key)"
          :model-value="objectValue[key]"
          :ref-options="refOptions"
          :errors="errors"
          :path="`${path}/${key}`"
          :disabled="fieldDisabled"
          @update:model-value="(v: unknown) => setKey(key, v)"
        />
        <div v-if="!adapterProps.length" class="muted">{{ formText('noAdapterParams') }}</div>
      </div>
      <template v-else>
        <a-textarea
          v-model:value="jsonText"
          :rows="4"
          :disabled="fieldDisabled"
          :placeholder="formText('adapterJsonPlaceholder')"
          @blur="commitJson"
        />
        <div v-if="jsonError" class="danger-text">{{ jsonError }}</div>
      </template>
    </template>

    <span v-else-if="kind === 'const'"
      ><code>{{ String(norm.schema.const) }}</code></span
    >

    <a-select
      v-else-if="kind === 'enum'"
      :value="modelValue ?? undefined"
      :options="enumOptions"
      :allow-clear="!required || norm.nullable"
      :disabled="fieldDisabled"
      style="width: 100%"
      @change="(v: unknown) => emitValue(v === undefined ? (norm.nullable ? null : undefined) : v)"
    />

    <a-switch
      v-else-if="kind === 'boolean'"
      :checked="!!modelValue"
      :disabled="fieldDisabled"
      @change="(v: unknown) => emitValue(!!v)"
    />

    <a-input-number
      v-else-if="kind === 'integer' || kind === 'number'"
      :value="(modelValue as number | null | undefined) ?? undefined"
      :min="numMin"
      :max="numMax"
      :precision="kind === 'integer' ? 0 : undefined"
      :disabled="fieldDisabled"
      style="width: 240px"
      @change="
        (v: unknown) =>
          emitValue(v === null || v === undefined ? (norm.nullable ? null : undefined) : v)
      "
    />

    <template v-else-if="kind === 'string'">
      <a-auto-complete
        v-if="refList"
        :value="(modelValue as string) ?? ''"
        :options="refList"
        :disabled="fieldDisabled"
        :filter-option="filterOption"
        allow-clear
        style="width: 100%"
        :placeholder="placeholder"
        @change="(v: unknown) => emitString(v as string)"
      />
      <!-- 时间字段：后台透传统一 yyyy-MM-dd HH:mm:ss（北京时间），Java 转回网关的 ISO UTC -->
      <a-date-picker
        v-else-if="norm.schema.format === 'date-time'"
        :value="(modelValue as string) || undefined"
        :disabled="fieldDisabled"
        show-time
        value-format="YYYY-MM-DD HH:mm:ss"
        format="YYYY-MM-DD HH:mm:ss"
        allow-clear
        style="width: 100%"
        @update:value="(v: unknown) => emitString((v as string) || '')"
      />
      <a-input
        v-else
        :value="(modelValue as string) ?? ''"
        :disabled="fieldDisabled"
        :placeholder="placeholder"
        allow-clear
        @update:value="(v: string) => emitString(v)"
      />
    </template>

    <a-textarea
      v-else-if="kind === 'text'"
      :value="(modelValue as string) ?? ''"
      :rows="3"
      :disabled="fieldDisabled"
      @update:value="(v: string) => emitString(v)"
    />

    <a-select
      v-else-if="kind === 'string-list' || kind === 'enum-list'"
      :value="Array.isArray(modelValue) ? modelValue : []"
      :mode="kind === 'enum-list' ? 'multiple' : 'tags'"
      :options="kind === 'enum-list' ? itemEnumOptions : refList || []"
      :disabled="fieldDisabled"
      style="width: 100%"
      :placeholder="kind === 'string-list' ? formText('tagsPlaceholder') : undefined"
      @change="(v: unknown) => emitValue(v)"
    />

    <!-- 对象数组：逐项子表单 -->
    <div v-else-if="kind === 'object-list'" class="nested">
      <div v-for="(item, index) in listValue" :key="index" class="list-item">
        <div class="list-item-head">
          <span class="muted">#{{ index + 1 }}</span>
          <a-button
            type="link"
            size="small"
            danger
            :disabled="fieldDisabled"
            @click="removeItem(index)"
          >
            {{ formText('remove') }}
          </a-button>
        </div>
        <SchemaField
          v-for="[key, sub] in itemProps"
          :key="key"
          :name="key"
          :schema="sub"
          :root="root"
          :required="itemRequired.includes(key)"
          :model-value="(item as Record<string, unknown>)?.[key]"
          :ref-options="refOptions"
          :errors="errors"
          :path="`${path}/${index}/${key}`"
          :disabled="fieldDisabled"
          @update:model-value="(v: unknown) => setItemKey(index, key, v)"
        />
      </div>
      <a-button size="small" :disabled="fieldDisabled" @click="addItem">{{
        formText('addItem')
      }}</a-button>
    </div>

    <!-- 嵌套对象 -->
    <div v-else-if="kind === 'object'" class="nested">
      <SchemaField
        v-for="[key, sub] in objectProps"
        :key="key"
        :name="key"
        :schema="sub"
        :root="root"
        :required="objectRequired.includes(key)"
        :model-value="objectValue[key]"
        :adapter-params-schema="adapterParamsSchema"
        :ref-options="refOptions"
        :errors="errors"
        :path="`${path}/${key}`"
        :disabled="fieldDisabled"
        @update:model-value="(v: unknown) => setKey(key, v)"
      />
    </div>

    <!-- 键值表（labels 之类） -->
    <div v-else-if="kind === 'map'" class="nested">
      <a-space
        v-for="(entry, index) in mapEntries"
        :key="index"
        style="display: flex; margin-bottom: 6px"
      >
        <a-input
          v-model:value="entry.key"
          :placeholder="formText('mapKey')"
          style="width: 200px"
          :disabled="fieldDisabled"
          @blur="commitMap"
        />
        <a-input
          v-model:value="entry.value"
          :placeholder="formText('mapValue')"
          style="width: 260px"
          :disabled="fieldDisabled"
          @blur="commitMap"
        />
        <a-button type="link" danger :disabled="fieldDisabled" @click="removeMapEntry(index)">{{
          formText('remove')
        }}</a-button>
      </a-space>
      <a-button
        size="small"
        :disabled="fieldDisabled"
        @click="mapEntries.push({ key: '', value: '' })"
      >
        {{ formText('add') }}
      </a-button>
    </div>

    <!-- 认不出的形状：JSON 兜底，保证网关新加的任何字段都能填 -->
    <template v-else>
      <a-textarea
        v-model:value="jsonText"
        :rows="4"
        :disabled="fieldDisabled"
        class="json-text"
        placeholder="JSON"
        @blur="commitJson"
      />
      <div v-if="jsonError" class="danger-text">{{ jsonError }}</div>
    </template>
  </a-form-item>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { enumLabel, fieldHelp, formText } from './gatewayI18n';
import {
  buildDefault,
  fieldKind,
  normalize,
  propertiesOf,
  requiredOf,
  titleOf,
  type FieldError,
  type Schema,
} from './schema';

defineOptions({ name: 'SchemaField' });

type Option = { label: string; value: string | number | boolean };

const props = withDefaults(
  defineProps<{
    name: string;
    schema: Schema;
    root: Schema;
    modelValue?: unknown;
    required?: boolean;
    adapterParamsSchema?: Schema | null;
    refOptions?: Record<string, Option[]>;
    errors?: FieldError[];
    path?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: undefined,
    required: false,
    adapterParamsSchema: null,
    refOptions: () => ({}),
    errors: () => [],
    path: '',
    disabled: false,
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>();

const norm = computed(() => normalize(props.schema, props.root));
const kind = computed(() => fieldKind(norm.value.schema, props.root));
const label = computed(() => titleOf(norm.value.schema, props.name));
/**
 * 由网关推导、写了也不生效的字段：账户的 secret_names 来自密钥表（录入密钥后自动出现），
 * 表单里只读展示，免得运维以为要在这里填。
 */
const derived = computed(() => props.name === 'secret_names');
const fieldDisabled = computed(() => props.disabled || derived.value);
/** 说明：词典 → schema description；标签已翻译时再附上原字段名，便于对照网关文档 */
const description = computed(() => {
  if (derived.value) return formText('derivedSecretNames');
  return fieldHelp(props.name, norm.value.schema.description) || undefined;
});
const placeholder = computed(() => {
  const s = norm.value.schema;
  if (typeof s.format === 'string') return s.format;
  if (typeof s.pattern === 'string') return s.pattern;
  return undefined;
});
const errorText = computed(() => {
  // 只显示本字段自己的错；子字段各自显示
  const own = props.errors.filter((e) => e.path === (props.path || '/'));
  return own.map((e) => e.message).join('；');
});

function emitValue(v: unknown) {
  emit('update:modelValue', v);
}
function emitString(v: string | undefined) {
  if (v === '' || v === undefined) emitValue(norm.value.nullable ? null : undefined);
  else emitValue(v);
}

// ---- enum / 数字 ----
const enumOptions = computed<Option[]>(() =>
  ((norm.value.schema.enum as unknown[]) || []).map((v) => ({
    label: enumLabel(v),
    value: v as string | number | boolean,
  })),
);
const itemsSchema = computed(
  () => normalize((norm.value.schema.items as Schema) || {}, props.root).schema,
);
const itemEnumOptions = computed<Option[]>(() =>
  ((itemsSchema.value.enum as unknown[]) || []).map((v) => ({
    label: enumLabel(v),
    value: v as string | number | boolean,
  })),
);
const numMin = computed(() =>
  typeof norm.value.schema.minimum === 'number' ? (norm.value.schema.minimum as number) : undefined,
);
const numMax = computed(() =>
  typeof norm.value.schema.maximum === 'number' ? (norm.value.schema.maximum as number) : undefined,
);

/** 引用型字段（provider_code 之类）给候选，但仍可自由填写 */
const refList = computed(() => {
  const list = props.refOptions[props.name];
  return list && list.length ? list : undefined;
});
function filterOption(input: string, option?: { value?: unknown }) {
  return String(option?.value ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

// ---- 对象 ----
const objectValue = computed<Record<string, unknown>>(() =>
  props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)
    ? (props.modelValue as Record<string, unknown>)
    : {},
);
const objectProps = computed(() => propertiesOf(norm.value.schema));
const objectRequired = computed(() => requiredOf(norm.value.schema));
const adapterProps = computed(() =>
  props.adapterParamsSchema ? propertiesOf(props.adapterParamsSchema) : [],
);
const adapterRequired = computed(() =>
  props.adapterParamsSchema ? requiredOf(props.adapterParamsSchema) : [],
);

function setKey(key: string, v: unknown) {
  const next = { ...objectValue.value };
  if (v === undefined) delete next[key];
  else next[key] = v;
  emitValue(next);
}

// ---- 对象数组 ----
const listValue = computed<unknown[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
);
const itemProps = computed(() => propertiesOf(itemsSchema.value));
const itemRequired = computed(() => requiredOf(itemsSchema.value));

function addItem() {
  const init = buildDefault(itemsSchema.value, props.root);
  emitValue([...listValue.value, init && typeof init === 'object' ? init : {}]);
}
function removeItem(index: number) {
  const next = [...listValue.value];
  next.splice(index, 1);
  emitValue(next);
}
function setItemKey(index: number, key: string, v: unknown) {
  const next = [...listValue.value];
  const item = { ...((next[index] as Record<string, unknown>) || {}) };
  if (v === undefined) delete item[key];
  else item[key] = v;
  next[index] = item;
  emitValue(next);
}

// ---- 键值表 ----
const mapEntries = ref<{ key: string; value: string }[]>([]);
const mapValueType = computed(
  () => normalize((norm.value.schema.additionalProperties as Schema) || {}, props.root).schema.type,
);

function syncMapFromValue() {
  mapEntries.value = Object.entries(objectValue.value).map(([key, value]) => ({
    key,
    value: value === null || value === undefined ? '' : String(value),
  }));
}

function coerce(raw: string): unknown {
  const t = mapValueType.value;
  if (t === 'integer' || t === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (t === 'boolean') return raw === 'true';
  return raw;
}

function commitMap() {
  const next: Record<string, unknown> = {};
  for (const { key, value } of mapEntries.value) {
    const k = key.trim();
    if (k) next[k] = coerce(value);
  }
  emitValue(next);
}
function removeMapEntry(index: number) {
  mapEntries.value.splice(index, 1);
  commitMap();
}

// ---- JSON 兜底 ----
const jsonText = ref('');
const jsonError = ref('');

function syncJsonFromValue() {
  jsonText.value = props.modelValue === undefined ? '' : JSON.stringify(props.modelValue, null, 2);
  jsonError.value = '';
}

function commitJson() {
  const text = jsonText.value.trim();
  if (!text) {
    jsonError.value = '';
    emitValue(norm.value.nullable ? null : undefined);
    return;
  }
  try {
    emitValue(JSON.parse(text));
    jsonError.value = '';
  } catch {
    jsonError.value = formText('jsonInvalid');
  }
}

watch(
  () => [props.modelValue, kind.value] as const,
  () => {
    if (kind.value === 'map') {
      // 正在编辑的空键行不要被外部值冲掉
      const current = JSON.stringify(
        Object.fromEntries(
          mapEntries.value.filter((e) => e.key.trim()).map((e) => [e.key.trim(), coerce(e.value)]),
        ),
      );
      if (current !== JSON.stringify(objectValue.value)) syncMapFromValue();
    }
    if (kind.value === 'json' || (kind.value === 'adapter-params' && !props.adapterParamsSchema)) {
      if (!jsonError.value) syncJsonFromValue();
    }
  },
  { immediate: true, deep: true },
);
</script>

<style scoped>
.nested {
  padding: 8px 12px;
  border: 1px dashed var(--color-border-secondary, #e8e8e8);
  border-radius: 4px;
}
.list-item {
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 4px;
}
.list-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.danger-text {
  color: #cf1322;
  font-size: 12px;
}
.json-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
