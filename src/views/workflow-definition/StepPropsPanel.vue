<template>
  <div>
    <div v-if="!step" class="props-empty">{{ $t('workflowDefinition.propsEmpty') }}</div>
    <a-form v-else layout="vertical" size="small">
      <a-alert
        v-if="issues?.length"
        type="error"
        show-icon
        style="margin-bottom: 12px"
        :message="$t('workflowDefinition.localIssuesTitle', { count: issues.length })"
      >
        <template #description>
          <ul class="issue-list">
            <li v-for="(m, i) in issues" :key="i">{{ m }}</li>
          </ul>
        </template>
      </a-alert>
      <a-form-item :label="$t('workflowDefinition.propsId')">
        <a-input
          :value="idDraft"
          :disabled="disabled"
          @update:value="(v: string) => (idDraft = v)"
          @blur="commitId"
          @press-enter="commitId"
        />
      </a-form-item>

      <a-form-item :label="$t('workflowDefinition.propsKind')">
        <a-select
          :value="stepKind"
          :options="kindOptions.map((k) => ({ label: k, value: k }))"
          :disabled="disabled"
          show-search
          @update:value="(v: unknown) => emit('setField', 'kind', String(v))"
        />
        <div v-if="schema?.description" class="muted field-note">{{ schema.description }}</div>
        <div v-if="schema?.outputs.length" class="muted field-note">
          {{ $t('workflowDefinition.propsOutputs') }}:
          <code v-for="o in schema.outputs" :key="o" class="out-code">{{ stepId }}.{{ o }}</code>
        </div>
      </a-form-item>

      <a-form-item :label="$t('workflowDefinition.propsAfter')">
        <span v-if="!afterList.length" class="muted">-</span>
        <a-tag
          v-for="a in afterList"
          :key="a"
          :closable="!disabled"
          @close.prevent="emit('disconnect', a)"
        >
          {{ a }}
        </a-tag>
        <div class="muted field-note">{{ $t('workflowDefinition.propsAfterHint') }}</div>
      </a-form-item>

      <a-divider style="margin: 8px 0">{{ $t('workflowDefinition.propsParams') }}</a-divider>
      <div v-if="!schema" class="muted field-note" style="margin-bottom: 8px">
        {{ $t('workflowDefinition.propsNoSchema') }}
      </div>
      <div class="muted field-note" style="margin-bottom: 8px">
        {{ $t('workflowDefinition.propsBindNote') }}
      </div>

      <a-form-item v-for="p in paramRows" :key="p.name" :required="p.required">
        <template #label>
          <span>{{ p.name }}</span>
          <a-tag v-if="p.type" style="margin-left: 6px" size="small">{{ p.type }}</a-tag>
          <a-tag v-if="p.extra" color="orange" size="small">
            {{ $t('workflowDefinition.propsExtraParam') }}
          </a-tag>
        </template>

        <!-- 绑定：按文本编辑 bind 表达式 -->
        <template v-if="isBindValue(p.value)">
          <a-input
            :value="p.value.bind"
            :disabled="disabled"
            :placeholder="$t('workflowDefinition.propsBindPlaceholder')"
            @update:value="(v: string) => setParam(p.name, { ...asRecord(p.value), bind: v })"
          >
            <template #addonBefore>bind</template>
          </a-input>
        </template>
        <a-input-number
          v-else-if="p.input === 'number'"
          :value="typeof p.value === 'number' ? p.value : undefined"
          :disabled="disabled"
          style="width: 100%"
          @update:value="(v: unknown) => setParam(p.name, typeof v === 'number' ? v : undefined)"
        />
        <a-switch
          v-else-if="p.input === 'boolean'"
          :checked="p.value === true"
          :disabled="disabled"
          @update:checked="(v: unknown) => setParam(p.name, !!v)"
        />
        <a-input
          v-else-if="p.input === 'string' && (p.value === undefined || typeof p.value === 'string')"
          :value="typeof p.value === 'string' ? p.value : ''"
          :disabled="disabled"
          @update:value="(v: string) => setParam(p.name, v)"
        />
        <a-textarea
          v-else
          :value="jsonDraftOf(p.name, p.value)"
          :disabled="disabled"
          :auto-size="{ minRows: 2, maxRows: 8 }"
          class="json-area"
          @update:value="(v: string) => onJsonInput(p.name, v)"
          @blur="onJsonBlur(p.name)"
        />

        <div v-if="p.description" class="muted field-note">{{ p.description }}</div>
        <a-space v-if="!disabled" size="small" style="margin-top: 4px">
          <a-button
            v-if="!isBindValue(p.value)"
            size="small"
            type="link"
            @click="setParam(p.name, { bind: '' })"
          >
            {{ $t('workflowDefinition.propsUseBind') }}
          </a-button>
          <a-button v-else size="small" type="link" @click="setParam(p.name, undefined)">
            {{ $t('workflowDefinition.propsUseLiteral') }}
          </a-button>
          <a-button
            v-if="p.value !== undefined"
            size="small"
            type="link"
            danger
            @click="setParam(p.name, undefined)"
          >
            {{ $t('workflowDefinition.propsClear') }}
          </a-button>
        </a-space>
      </a-form-item>

      <a-divider style="margin: 8px 0">{{ $t('workflowDefinition.propsWhen') }}</a-divider>
      <a-textarea
        :value="whenDraftValue"
        :disabled="disabled"
        :auto-size="{ minRows: 2, maxRows: 8 }"
        class="json-area"
        :placeholder="$t('workflowDefinition.propsWhenPlaceholder')"
        @update:value="onWhenInput"
        @blur="onWhenBlur"
      />

      <template v-if="!disabled">
        <a-divider style="margin: 12px 0" />
        <a-popconfirm :title="$t('workflowDefinition.deleteStepConfirm')" @confirm="emit('remove')">
          <a-button danger size="small">{{ $t('workflowDefinition.deleteStep') }}</a-button>
        </a-popconfirm>
      </template>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowStepKindSchema } from '@/api/workflow-definition';

import { message } from 'antdv-next';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { isBindValue, type StepObject } from '@/views/workflow-definition/graph';

const props = defineProps<{
  step?: StepObject;
  schema?: WorkflowStepKindSchema;
  kindOptions: string[];
  disabled: boolean;
  /** 即时校验在该步骤上的问题（已格式化） */
  issues?: string[];
}>();

const emit = defineEmits<{
  rename: [newId: string];
  setParam: [name: string, value: unknown];
  setField: [field: string, value: unknown];
  disconnect: [source: string];
  remove: [];
}>();

const { t } = useI18n();

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asRecord = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

const stepId = computed(() => (typeof props.step?.id === 'string' ? props.step.id : ''));
const stepKind = computed(() => (typeof props.step?.kind === 'string' ? props.step.kind : ''));
const afterList = computed(() =>
  Array.isArray(props.step?.after)
    ? props.step.after.filter((x): x is string => typeof x === 'string')
    : [],
);
const params = computed(() => asRecord(props.step?.params));

type InputKind = 'string' | 'number' | 'boolean' | 'json';

/** 参数类型 → 输入控件；未知类型按 JSON 编辑 */
function inputKindOf(type?: string): InputKind {
  const tp = (type ?? '').toLowerCase().replace(/\?$/, '').trim();
  if (['number', 'integer', 'int', 'long', 'double', 'float', 'decimal'].includes(tp))
    return 'number';
  if (['boolean', 'bool'].includes(tp)) return 'boolean';
  if (['string', 'text', 'url', 'image', 'video', 'audio', 'media', 'prompt', 'enum'].includes(tp))
    return 'string';
  return 'json';
}

interface ParamRow {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
  value: unknown;
  input: InputKind;
  /** 定义里有、schema 里没有的参数 */
  extra: boolean;
}

const paramRows = computed<ParamRow[]>(() => {
  const rows: ParamRow[] = [];
  const known = new Set<string>();
  (props.schema?.params ?? []).forEach((p) => {
    known.add(p.name);
    rows.push({
      name: p.name,
      type: p.type,
      required: !!p.required,
      description: p.description,
      value: params.value[p.name],
      input: inputKindOf(p.type),
      extra: false,
    });
  });
  Object.keys(params.value)
    .filter((k) => !known.has(k))
    .forEach((k) => {
      const v = params.value[k];
      rows.push({
        name: k,
        required: false,
        value: v,
        input: typeof v === 'string' ? 'string' : typeof v === 'number' ? 'number' : 'json',
        extra: !!props.schema,
      });
    });
  return rows;
});

// 名称框：失焦/回车才提交，避免逐字改名
const idDraft = ref('');
// JSON 类参数与 when：失焦解析后才写回，解析失败保留草稿
const jsonDrafts = reactive<Record<string, string>>({});
const whenDraft = ref<string | null>(null);

watch(
  stepId,
  (v) => {
    idDraft.value = v;
    Object.keys(jsonDrafts).forEach((k) => delete jsonDrafts[k]);
    whenDraft.value = null;
  },
  { immediate: true },
);

function setParam(name: string, value: unknown) {
  emit('setParam', name, value);
}

function commitId() {
  if (idDraft.value.trim() === stepId.value) return;
  emit('rename', idDraft.value.trim());
  // 改名被拒时父组件不会改 step，这里回显原值
  idDraft.value = stepId.value;
}

function stringifyJson(v: unknown): string {
  return v === undefined ? '' : JSON.stringify(v, null, 2);
}

function jsonDraftOf(name: string, value: unknown): string {
  return jsonDrafts[name] ?? stringifyJson(value);
}

/** 草稿能解析就立即写回；解析不了先留草稿，失焦时再提示 */
function tryParse(raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  if (!raw.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

function onJsonInput(name: string, raw: string) {
  jsonDrafts[name] = raw;
  const r = tryParse(raw);
  if (r.ok) setParam(name, r.value);
}

function onJsonBlur(name: string) {
  const raw = jsonDrafts[name];
  if (raw === undefined) return;
  const r = tryParse(raw);
  if (!r.ok) {
    message.warning(t('workflowDefinition.invalidJson', { msg: r.message }));
    return;
  }
  delete jsonDrafts[name];
}

const whenDraftValue = computed(() => whenDraft.value ?? stringifyJson(props.step?.when));

function onWhenInput(raw: string) {
  whenDraft.value = raw;
  const r = tryParse(raw);
  if (r.ok) emit('setField', 'when', r.value);
}

function onWhenBlur() {
  if (whenDraft.value === null) return;
  const r = tryParse(whenDraft.value);
  if (!r.ok) {
    message.warning(t('workflowDefinition.invalidJson', { msg: r.message }));
    return;
  }
  whenDraft.value = null;
}
</script>

<style scoped>
.props-empty {
  color: var(--color-text-tertiary, #999);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.muted {
  color: var(--color-text-tertiary, #999);
}
.field-note {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}
.out-code {
  margin-left: 4px;
  font-size: 11px;
}
.issue-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
}
.json-area {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}
</style>
