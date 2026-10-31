<template>
  <div class="io-editor">
    <section class="io-section">
      <div class="io-head">
        <div>
          <div class="io-title">{{ $t('workflowDefinition.io.inputsTitle') }}</div>
          <div class="muted io-hint">{{ $t('workflowDefinition.io.inputsHint') }}</div>
        </div>
        <a-button v-if="!disabled" size="small" type="primary" @click="addInput">
          {{ $t('workflowDefinition.io.addInput') }}
        </a-button>
      </div>
      <a-table
        :data-source="inputRows"
        :columns="inputColumns"
        :pagination="false"
        row-key="key"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-input
              :value="nameDraftOf('in', record.key)"
              :disabled="disabled"
              @update:value="(v: string) => (nameDrafts['in:' + record.key] = v)"
              @blur="commitInputName(record.key)"
              @press-enter="commitInputName(record.key)"
            />
          </template>
          <template v-else-if="column.key === 'type'">
            <a-auto-complete
              :value="record.type"
              :options="typeOptions"
              :disabled="disabled"
              :filter-option="filterOption"
              style="width: 100%"
              @update:value="(v: unknown) => setInputType(record.key, String(v ?? ''))"
            />
          </template>
          <template v-else-if="column.key === 'refs'">
            <code class="muted">input.{{ record.key }}</code>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              v-if="!disabled"
              :title="$t('workflowDefinition.io.deleteInputConfirm')"
              @confirm="removeInput(record.key)"
            >
              <a-button size="small" type="link" danger>{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </section>

    <section class="io-section">
      <div class="io-head">
        <div>
          <div class="io-title">{{ $t('workflowDefinition.io.outputsTitle') }}</div>
          <div class="muted io-hint">{{ $t('workflowDefinition.io.outputsHint') }}</div>
        </div>
        <a-button v-if="!disabled" size="small" type="primary" @click="addOutput">
          {{ $t('workflowDefinition.io.addOutput') }}
        </a-button>
      </div>
      <a-table
        :data-source="outputRows"
        :columns="outputColumns"
        :pagination="false"
        row-key="key"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-input
              :value="nameDraftOf('out', record.key)"
              :disabled="disabled"
              @update:value="(v: string) => (nameDrafts['out:' + record.key] = v)"
              @blur="commitOutputName(record.key)"
              @press-enter="commitOutputName(record.key)"
            />
          </template>
          <template v-else-if="column.key === 'source'">
            <a-auto-complete
              :value="record.source"
              :options="sourceOptions"
              :disabled="disabled"
              :filter-option="filterOption"
              :placeholder="$t('workflowDefinition.io.sourcePlaceholder')"
              style="width: 100%"
              @update:value="(v: unknown) => setOutputSource(record.key, String(v ?? ''))"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              v-if="!disabled"
              :title="$t('workflowDefinition.io.deleteOutputConfirm')"
              @confirm="removeOutput(record.key)"
            >
              <a-button size="small" type="link" danger>{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * 定义的 inputs（名称 → 类型）与 outputs（名称 → 来源路径）表格编辑。
 * 只发出新的对象，由父组件写回草稿 JSON；输入改名交给父组件同步改绑定。
 */
const props = defineProps<{
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  disabled: boolean;
  /** 输出来源候选（步骤输出路径） */
  sourceOptions: { value: string; label: string }[];
}>();

const emit = defineEmits<{
  setInputs: [inputs: Record<string, unknown>];
  renameInput: [oldName: string, newName: string];
  setOutputs: [outputs: Record<string, unknown>];
}>();

const { t } = useI18n();

/** 与后端试点定义 / 转换器一致的类型写法；以 ? 结尾为可选。也允许手填。 */
const TYPE_VOCABULARY = [
  'string',
  'string?',
  'number',
  'number?',
  'integer',
  'integer?',
  'boolean',
  'boolean?',
  'image',
  'image?',
  'list<image>',
  'list<image>?',
  'video',
  'video?',
  'list<video>',
  'list<string>',
  'object',
  'object?',
];
const typeOptions = TYPE_VOCABULARY.map((v) => ({ value: v, label: v }));

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function filterOption(input: string, option?: { value?: unknown; label?: unknown }) {
  const q = input.toLowerCase();
  return (
    String(option?.value ?? '')
      .toLowerCase()
      .includes(q) ||
    String(option?.label ?? '')
      .toLowerCase()
      .includes(q)
  );
}

const inputRows = computed(() =>
  Object.entries(props.inputs).map(([key, v]) => ({
    key,
    type: typeof v === 'string' ? v : JSON.stringify(v),
  })),
);

/** outputs 的值可以是路径字符串（试点写法）或 {"bind": 路径}，读写都保持原形 */
const outputRows = computed(() =>
  Object.entries(props.outputs).map(([key, v]) => ({
    key,
    source: typeof v === 'string' ? v : isRecord(v) && typeof v.bind === 'string' ? v.bind : '',
  })),
);

const inputColumns = computed(() => [
  { title: t('workflowDefinition.io.name'), key: 'name', width: '32%' },
  { title: t('workflowDefinition.io.type'), key: 'type', width: '28%' },
  { title: t('workflowDefinition.io.refAs'), key: 'refs' },
  { title: '', key: 'action', width: 80 },
]);
const outputColumns = computed(() => [
  { title: t('workflowDefinition.io.name'), key: 'name', width: '32%' },
  { title: t('workflowDefinition.io.source'), key: 'source' },
  { title: '', key: 'action', width: 80 },
]);

// 名称框失焦/回车才提交
const nameDrafts = reactive<Record<string, string>>({});
function nameDraftOf(side: 'in' | 'out', key: string): string {
  return nameDrafts[`${side}:${key}`] ?? key;
}

function uniqueName(existing: Record<string, unknown>, stem: string): string {
  if (!(stem in existing)) return stem;
  let n = 2;
  while (`${stem}${n}` in existing) n++;
  return `${stem}${n}`;
}

function renameKey(obj: Record<string, unknown>, oldKey: string, newKey: string) {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => (out[k === oldKey ? newKey : k] = v));
  return out;
}

function addInput() {
  emit('setInputs', { ...props.inputs, [uniqueName(props.inputs, 'input')]: 'string' });
}

function removeInput(key: string) {
  const next = { ...props.inputs };
  delete next[key];
  emit('setInputs', next);
}

function setInputType(key: string, type: string) {
  emit('setInputs', { ...props.inputs, [key]: type });
}

function commitInputName(key: string) {
  const draft = nameDrafts[`in:${key}`];
  delete nameDrafts[`in:${key}`];
  if (draft === undefined || draft.trim() === key) return;
  const name = draft.trim();
  if (!name) {
    message.warning(t('workflowDefinition.io.nameRequired'));
    return;
  }
  if (name in props.inputs) {
    message.warning(t('workflowDefinition.io.nameDuplicate'));
    return;
  }
  emit('renameInput', key, name);
}

function addOutput() {
  emit('setOutputs', { ...props.outputs, [uniqueName(props.outputs, 'output')]: '' });
}

function removeOutput(key: string) {
  const next = { ...props.outputs };
  delete next[key];
  emit('setOutputs', next);
}

function setOutputSource(key: string, source: string) {
  const old = props.outputs[key];
  const value = isRecord(old) && typeof old.bind === 'string' ? { ...old, bind: source } : source;
  emit('setOutputs', { ...props.outputs, [key]: value });
}

function commitOutputName(key: string) {
  const draft = nameDrafts[`out:${key}`];
  delete nameDrafts[`out:${key}`];
  if (draft === undefined || draft.trim() === key) return;
  const name = draft.trim();
  if (!name) {
    message.warning(t('workflowDefinition.io.nameRequired'));
    return;
  }
  if (name in props.outputs) {
    message.warning(t('workflowDefinition.io.nameDuplicate'));
    return;
  }
  emit('setOutputs', renameKey(props.outputs, key, name));
}
</script>

<style scoped>
.io-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1100px;
}
.io-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.io-title {
  font-weight: 600;
  font-size: 14px;
}
.io-hint {
  font-size: 12px;
  margin-top: 2px;
}
.muted {
  color: var(--color-text-tertiary, #999);
}
</style>
