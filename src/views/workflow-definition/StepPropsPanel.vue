<template>
  <div class="props-panel">
    <div v-if="!step" class="props-empty">{{ $t('workflowDefinition.propsEmpty') }}</div>
    <template v-else>
      <div class="pp-head">
        <div class="pp-title">{{ kindTitle }}</div>
        <code class="pp-kind">{{ stepKind }}</code>
        <div v-if="schema?.description" class="muted field-note">{{ schema.description }}</div>
      </div>

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

      <a-form layout="vertical" size="small">
        <a-form-item :label="$t('workflowDefinition.propsId')">
          <a-input
            :value="idDraft"
            :disabled="disabled"
            @update:value="(v: string) => (idDraft = v)"
            @blur="commitId"
            @press-enter="commitId"
          />
          <div class="muted field-note">{{ $t('workflowDefinition.propsIdHint') }}</div>
        </a-form-item>

        <a-form-item v-if="modelGroup" :label="$t('workflowDefinition.modelGroupStatus')">
          <div class="mg-line">
            <code v-if="modelGroup.kind === 'literal'">{{ modelGroup.value }}</code>
            <ModelGroupBadge :model-group="modelGroup" :tool="modelGroupTool" />
            <span v-if="modelGroup.kind === 'literal' && !modelGroupTool" class="muted">-</span>
          </div>
          <div v-if="modelGroupTool?.ready === false" class="field-note mg-reason">
            {{ modelGroupTool.reason || $t('workflowDefinition.tools.noReason') }}
          </div>
        </a-form-item>

        <div class="section-title">{{ $t('workflowDefinition.propsParams') }}</div>
        <div v-if="!schema" class="muted field-note" style="margin-bottom: 8px">
          {{ $t('workflowDefinition.propsNoSchema') }}
        </div>

        <div v-for="p in paramRows" :key="p.name" class="param-row">
          <div class="param-label">
            <span v-if="p.required" class="req">*</span>
            <a-tooltip :title="p.description || p.name">
              <span class="param-text">{{ p.description || p.name }}</span>
            </a-tooltip>
            <code class="param-name">{{ p.name }}</code>
          </div>
          <a-radio-group
            :value="isBindValue(p.value) ? 'bind' : 'literal'"
            :disabled="disabled"
            size="small"
            option-type="button"
            button-style="solid"
            class="mode-switch"
            :options="modeOptions"
            @update:value="(v: unknown) => switchMode(p, v === 'bind')"
          />

          <!-- 引用：在可引用的输入、配置和上游步骤输出里选 -->
          <template v-if="isBindValue(p.value)">
            <a-select
              :value="p.value.bind || undefined"
              :options="groupedBindOptions(p.value.bind)"
              :disabled="disabled"
              :placeholder="$t('workflowDefinition.propsBindSelect')"
              show-search
              option-filter-prop="label"
              style="width: 100%"
              @update:value="(v: unknown) => setBind(p, String(v ?? ''))"
            />
            <a-checkbox
              :checked="asRecord(p.value).optional === true"
              :disabled="disabled"
              class="field-note"
              @update:checked="(v: unknown) => setOptional(p, !!v)"
            >
              {{ $t('workflowDefinition.propsBindOptional') }}
            </a-checkbox>
          </template>

          <!-- 固定值：按类型给控件；{"value": x} 包装原样保留 -->
          <template v-else>
            <!-- 模型组 / 提示词模板：从目录里选，列表外的编码直接输入后选「使用 …」 -->
            <template v-if="pickerOf(p)">
              <div class="picker-line">
                <a-select
                  :value="currentString(p) || undefined"
                  :options="pickerOptions(p)"
                  :disabled="disabled"
                  :loading="pickerOf(p) === 'modelGroup' ? modelGroupsLoading : promptsLoading"
                  :placeholder="$t('workflowDefinition.catalog.pickPlaceholder')"
                  :show-search="searchConfigOf(p.name)"
                  allow-clear
                  class="picker-select"
                  @update:value="(v: unknown) => onPick(p, v)"
                >
                  <template #optionRender="{ option: { data: opt } }">
                    <div v-if="opt.typed" class="opt-typed">
                      {{ $t('workflowDefinition.catalog.useTyped', { value: opt.value }) }}
                    </div>
                    <div v-else-if="opt.notListed" class="opt-typed">
                      {{ $t('workflowDefinition.catalog.notListed', { value: opt.value }) }}
                    </div>
                    <div v-else class="opt">
                      <div class="opt-row">
                        <span class="opt-name">{{ opt.name || opt.value }}</span>
                        <a-tag
                          v-if="opt.readiness"
                          :color="READINESS_COLOR[opt.readiness as Readiness]"
                          class="opt-tag"
                        >
                          {{ $t(READINESS_LABEL_KEY[opt.readiness as Readiness]) }}
                        </a-tag>
                      </div>
                      <code class="opt-code">{{ opt.value }}</code>
                      <span v-if="opt.off" class="opt-price">
                        {{ $t('workflowDefinition.catalog.disabled') }}
                      </span>
                      <span v-if="opt.price" class="opt-price">{{ opt.price }}</span>
                    </div>
                  </template>
                </a-select>
                <a
                  :href="pickerOf(p) === 'modelGroup' ? manageModelGroupsHref : managePromptsHref"
                  target="_blank"
                  rel="noopener"
                  class="manage-link"
                >
                  {{ $t('workflowDefinition.catalog.manage') }}
                </a>
              </div>
              <div class="muted field-note">
                {{
                  pickerOf(p) === 'modelGroup'
                    ? operationLiteral
                      ? $t('workflowDefinition.catalog.modelGroupNoteOp', { op: operationLiteral })
                      : $t('workflowDefinition.catalog.modelGroupNote')
                    : $t('workflowDefinition.catalog.templateNote')
                }}
              </div>
            </template>
            <a-input-number
              v-else-if="p.control === 'number'"
              :value="typeof literalOf(p.value) === 'number' ? literalOf(p.value) : undefined"
              :precision="p.integer ? 0 : undefined"
              :disabled="disabled"
              style="width: 100%"
              @update:value="(v: unknown) => setLiteral(p, typeof v === 'number' ? v : undefined)"
            />
            <a-switch
              v-else-if="p.control === 'boolean'"
              :checked="literalOf(p.value) === true"
              :disabled="disabled"
              @update:checked="(v: unknown) => setLiteral(p, !!v)"
            />
            <a-textarea
              v-else-if="p.control === 'textarea'"
              :value="(literalOf(p.value) as string | undefined) ?? ''"
              :disabled="disabled"
              :auto-size="{ minRows: 3, maxRows: 12 }"
              @update:value="(v: string) => setLiteral(p, v === '' ? undefined : v)"
            />
            <a-input
              v-else-if="p.control === 'string'"
              :value="(literalOf(p.value) as string | undefined) ?? ''"
              :disabled="disabled"
              @update:value="(v: string) => setLiteral(p, v === '' ? undefined : v)"
            />
            <template v-else>
              <a-textarea
                :value="jsonDraftOf(p.name, p.value)"
                :disabled="disabled"
                :auto-size="{ minRows: 2, maxRows: 10 }"
                class="json-area"
                :status="jsonErrors[p.name] ? 'error' : undefined"
                :placeholder="$t('workflowDefinition.propsJsonPlaceholder')"
                @update:value="(v: string) => onJsonInput(p.name, v)"
                @blur="onJsonBlur(p.name)"
              />
              <div v-if="jsonErrors[p.name]" class="field-note json-error">
                {{ $t('workflowDefinition.invalidJson', { msg: jsonErrors[p.name] }) }}
              </div>
            </template>
          </template>

          <div v-if="!disabled && p.value !== undefined" class="row-actions">
            <a-button size="small" type="link" danger @click="setParam(p.name, undefined)">
              {{ $t('workflowDefinition.propsClear') }}
            </a-button>
          </div>
        </div>

        <template v-if="extraRows.length">
          <div class="section-title">{{ $t('workflowDefinition.propsExtraParams') }}</div>
          <div class="muted field-note" style="margin-bottom: 8px">
            {{ $t('workflowDefinition.propsExtraParamsHint') }}
          </div>
          <div v-for="p in extraRows" :key="p.name" class="param-row">
            <div class="param-label">
              <code class="param-name">{{ p.name }}</code>
            </div>
            <a-textarea
              :value="jsonDraftOf(p.name, p.value)"
              :disabled="disabled"
              :auto-size="{ minRows: 2, maxRows: 10 }"
              class="json-area"
              :status="jsonErrors[p.name] ? 'error' : undefined"
              @update:value="(v: string) => onJsonInput(p.name, v)"
              @blur="onJsonBlur(p.name)"
            />
            <div v-if="jsonErrors[p.name]" class="field-note json-error">
              {{ $t('workflowDefinition.invalidJson', { msg: jsonErrors[p.name] }) }}
            </div>
          </div>
        </template>

        <div v-if="schema?.outputs.length" class="muted field-note" style="margin: 8px 0">
          {{ $t('workflowDefinition.propsOutputs') }}:
          <code v-for="o in schema.outputs" :key="o" class="out-code"
            >{{ stepId }}.output.{{ o }}</code
          >
        </div>

        <a-collapse ghost class="advanced">
          <a-collapse-panel key="adv" :header="$t('workflowDefinition.propsAdvanced')">
            <a-form-item :label="$t('workflowDefinition.propsKind')">
              <a-select
                :value="stepKind"
                :options="kindOptions"
                :disabled="disabled"
                show-search
                option-filter-prop="label"
                @update:value="(v: unknown) => emit('setField', 'kind', String(v))"
              />
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
            <a-form-item :label="$t('workflowDefinition.propsWhen')">
              <a-textarea
                :value="whenDraftValue"
                :disabled="disabled"
                :auto-size="{ minRows: 2, maxRows: 8 }"
                class="json-area"
                :status="whenError ? 'error' : undefined"
                :placeholder="$t('workflowDefinition.propsWhenPlaceholder')"
                @update:value="onWhenInput"
                @blur="onWhenBlur"
              />
              <div v-if="whenError" class="field-note json-error">
                {{ $t('workflowDefinition.invalidJson', { msg: whenError }) }}
              </div>
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>

        <template v-if="!disabled">
          <a-divider style="margin: 12px 0" />
          <a-popconfirm
            :title="$t('workflowDefinition.deleteStepConfirm')"
            @confirm="emit('remove')"
          >
            <a-button danger size="small">{{ $t('workflowDefinition.deleteStep') }}</a-button>
          </a-popconfirm>
        </template>
      </a-form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowStepKindSchema } from '@/api/workflow-definition';
import type { WorkflowToolRow } from '@/api/workflow-tools';

import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  matchesQuery,
  READINESS_COLOR,
  READINESS_LABEL_KEY,
  readinessOf,
  shortPriceText,
  type ModelGroupItem,
  type PromptItem,
  type Readiness,
} from '@/views/workflow-definition/catalog';
import {
  GATEWAY_CALL_KIND,
  isBindValue,
  type ModelGroupRef,
  type StepObject,
} from '@/views/workflow-definition/graph';
import { kindDisplayName } from '@/views/workflow-definition/kinds';
import ModelGroupBadge from '@/views/workflow-definition/ModelGroupBadge.vue';

export interface BindOption {
  value: string;
  label: string;
  group: 'input' | 'config' | 'step';
}

const props = withDefaults(
  defineProps<{
    step?: StepObject;
    schema?: WorkflowStepKindSchema;
    /** 步骤类型下拉：value 为 kind，label 为显示名 */
    kindOptions: { value: string; label: string }[];
    disabled: boolean;
    /** 即时校验在该步骤上的问题（已格式化） */
    issues?: string[];
    /** gateway.call 步骤的模型组引用及其网关就绪状态（总览里查不到时 tool 为空） */
    modelGroup?: ModelGroupRef;
    modelGroupTool?: WorkflowToolRow;
    /** 「引用」可选的来源：输入、配置、非下游步骤的输出 */
    bindOptions?: BindOption[];
    /** 模型组与提示词目录（detail.vue 加载一次后传入） */
    modelGroupItems?: ModelGroupItem[];
    modelGroupsLoading?: boolean;
    promptItems?: PromptItem[];
    promptsLoading?: boolean;
    /** 「去管理」链接（新窗口打开） */
    manageModelGroupsHref?: string;
    managePromptsHref?: string;
  }>(),
  {
    bindOptions: () => [],
    modelGroupItems: () => [],
    promptItems: () => [],
    manageModelGroupsHref: undefined,
    managePromptsHref: undefined,
  },
);

const emit = defineEmits<{
  rename: [newId: string];
  setParam: [name: string, value: unknown];
  setField: [field: string, value: unknown];
  disconnect: [source: string];
  remove: [];
}>();

const { t, te } = useI18n();

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asRecord = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

const stepId = computed(() => (typeof props.step?.id === 'string' ? props.step.id : ''));
const stepKind = computed(() => (typeof props.step?.kind === 'string' ? props.step.kind : ''));
const kindTitle = computed(() => kindDisplayName(stepKind.value, te, t, props.schema?.description));
const afterList = computed(() =>
  Array.isArray(props.step?.after)
    ? props.step.after.filter((x): x is string => typeof x === 'string')
    : [],
);
const params = computed(() => asRecord(props.step?.params));

const modeOptions = computed(() => [
  { label: t('workflowDefinition.propsModeLiteral'), value: 'literal' },
  { label: t('workflowDefinition.propsModeBind'), value: 'bind' },
]);

type Control = 'string' | 'textarea' | 'number' | 'boolean' | 'json';

/** 像提示词这类长文本的参数名，用多行输入 */
const LONG_TEXT_NAME = /prompt|template|text|content|instruction|system|script|message/i;

/** 字面量的 {"value": x} 包装（运行时与裸值同样接受） */
function isValueWrapper(v: unknown): v is { value: unknown } {
  return isRecord(v) && Object.keys(v).length === 1 && 'value' in v;
}

function literalOf(v: unknown): unknown {
  return isValueWrapper(v) ? v.value : v;
}

/** 参数类型 + 当前字面量 → 控件；值与类型对不上时退回 JSON，避免丢数据 */
function controlOf(name: string, type: string | undefined, value: unknown): Control {
  const tp = (type ?? '').toLowerCase().replace(/\?$/, '').trim();
  const lit = literalOf(value);
  if (['number', 'integer', 'int', 'long', 'double', 'float', 'decimal'].includes(tp)) {
    return lit === undefined || typeof lit === 'number' ? 'number' : 'json';
  }
  if (['boolean', 'bool'].includes(tp)) {
    return lit === undefined || typeof lit === 'boolean' ? 'boolean' : 'json';
  }
  if (['string', 'text', 'url', 'prompt', 'enum'].includes(tp)) {
    if (lit !== undefined && typeof lit !== 'string') return 'json';
    const long =
      LONG_TEXT_NAME.test(name) ||
      (typeof lit === 'string' && (lit.length > 60 || lit.includes('\n')));
    return long ? 'textarea' : 'string';
  }
  return 'json';
}

interface ParamRow {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
  value: unknown;
  control: Control;
  integer: boolean;
}

const paramRows = computed<ParamRow[]>(() =>
  (props.schema?.params ?? []).map((p) => {
    const value = params.value[p.name];
    return {
      name: p.name,
      type: p.type,
      required: !!p.required,
      description: p.description,
      value,
      control: controlOf(p.name, p.type, value),
      integer: ['integer', 'int', 'long'].includes((p.type ?? '').toLowerCase()),
    };
  }),
);

/** 定义里有、schema 里没有的参数（没有 schema 时全部归这里） */
const extraRows = computed(() => {
  const known = new Set((props.schema?.params ?? []).map((p) => p.name));
  return Object.keys(params.value)
    .filter((k) => !known.has(k))
    .map((k) => ({ name: k, value: params.value[k] }));
});

const groupLabels = computed<Record<BindOption['group'], string>>(() => ({
  input: t('workflowDefinition.bindGroupInput'),
  config: t('workflowDefinition.bindGroupConfig'),
  step: t('workflowDefinition.bindGroupStep'),
}));

function groupedBindOptions(current?: string) {
  const groups: BindOption['group'][] = ['input', 'config', 'step'];
  const out = groups
    .map((g) => ({
      label: groupLabels.value[g],
      options: props.bindOptions
        .filter((o) => o.group === g)
        .map((o) => ({ value: o.value, label: o.label })),
    }))
    .filter((g) => g.options.length);
  // 当前值不在候选里（多候选 a|b、手写的路径）时也要能显示出来
  if (current && !props.bindOptions.some((o) => o.value === current)) {
    out.unshift({
      label: t('workflowDefinition.bindGroupCurrent'),
      options: [{ value: current, label: current }],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 模型组 / 提示词模板下拉
// ---------------------------------------------------------------------------

type PickerKind = 'modelGroup' | 'template';

function pickerOf(p: ParamRow): PickerKind | null {
  // 值已不是字符串（被写成 JSON 对象等）时退回原控件，避免丢数据
  if (p.control !== 'string' && p.control !== 'textarea') return null;
  if (stepKind.value === GATEWAY_CALL_KIND && p.name === 'modelGroup') return 'modelGroup';
  if (stepKind.value.startsWith('prompt.') && p.name === 'templateCode') return 'template';
  return null;
}

function currentString(p: ParamRow): string {
  const v = literalOf(p.value);
  return typeof v === 'string' ? v : '';
}

/** gateway.call 的 operation 字面量；引用或为空时不过滤模型组 */
const operationLiteral = computed(() => {
  const v = literalOf(params.value.operation);
  return typeof v === 'string' && v.trim() ? v.trim() : '';
});

interface PickerOption {
  value: string;
  label: string;
  search: string;
  name?: string;
  readiness?: Readiness;
  price?: string;
  off?: boolean;
  disabled?: boolean;
  /** 搜索框里输入的、列表外的编码 */
  typed?: boolean;
  /** 当前值不在列表里 */
  notListed?: boolean;
}

const pickerSearch = reactive<Record<string, string>>({});

function pickerOptions(p: ParamRow): PickerOption[] {
  const current = currentString(p);
  let base: PickerOption[];
  if (pickerOf(p) === 'modelGroup') {
    const op = operationLiteral.value;
    base = props.modelGroupItems
      .filter((i) => !op || i.operations.includes(op))
      .map((i) => ({
        value: i.code,
        label: i.name ? `${i.name}（${i.code}）` : i.code,
        search: `${i.code} ${i.name ?? ''}`,
        name: i.name,
        readiness: readinessOf(i.tool),
        price: shortPriceText(i.tool, t),
        off: !i.enabled,
        disabled: !i.enabled && i.code !== current,
      }));
  } else {
    base = props.promptItems.map((i) => ({
      value: i.code,
      label: i.name && i.name !== i.code ? `${i.name}（${i.code}）` : i.code,
      search: `${i.code} ${i.name}`,
      name: i.name,
    }));
  }
  const out = [...base];
  if (current && !base.some((o) => o.value === current)) {
    out.unshift({ value: current, label: current, search: current, notListed: true });
  }
  const typed = (pickerSearch[p.name] ?? '').trim();
  if (typed && !out.some((o) => o.value === typed)) {
    out.unshift({ value: typed, label: typed, search: typed, typed: true });
  }
  return out;
}

const searchConfigs = new Map<string, object>();
/** 每个参数一份稳定的搜索配置：记录输入（给「使用 …」选项），按名称/编码过滤 */
function searchConfigOf(name: string) {
  let c = searchConfigs.get(name);
  if (!c) {
    c = {
      onSearch: (v: string) => (pickerSearch[name] = v),
      filterOption: (input: string, option?: PickerOption) =>
        !!option && (!!option.typed || matchesQuery(input, option.search)),
    };
    searchConfigs.set(name, c);
  }
  return c;
}

function onPick(p: ParamRow, v: unknown) {
  pickerSearch[p.name] = '';
  const code = typeof v === 'string' ? v.trim() : '';
  setLiteral(p, code || undefined);
}

// 名称框：失焦/回车才提交，避免逐字改名
const idDraft = ref('');
// JSON 类参数与 when：能解析就写回，解析不了留草稿并在下方提示
const jsonDrafts = reactive<Record<string, string>>({});
const jsonErrors = reactive<Record<string, string>>({});
const whenDraft = ref<string | null>(null);
const whenError = ref('');

watch(
  stepId,
  (v) => {
    idDraft.value = v;
    Object.keys(jsonDrafts).forEach((k) => delete jsonDrafts[k]);
    Object.keys(jsonErrors).forEach((k) => delete jsonErrors[k]);
    whenDraft.value = null;
    whenError.value = '';
  },
  { immediate: true },
);

function setParam(name: string, value: unknown) {
  delete jsonDrafts[name];
  delete jsonErrors[name];
  emit('setParam', name, value);
}

/** 写固定值：原来是 {"value": x} 包装的保持包装，否则写裸值（与原面板一致） */
function setLiteral(p: ParamRow, v: unknown) {
  if (v === undefined) {
    setParam(p.name, undefined);
    return;
  }
  setParam(p.name, isValueWrapper(p.value) ? { value: v } : v);
}

function switchMode(p: ParamRow, toBind: boolean) {
  if (toBind === isBindValue(p.value)) return;
  setParam(p.name, toBind ? { bind: '' } : undefined);
}

/** 写引用：保留原有的 optional 等附加字段 */
function setBind(p: ParamRow, bind: string) {
  setParam(p.name, { ...asRecord(p.value), bind });
}

function setOptional(p: ParamRow, optional: boolean) {
  const next = { ...asRecord(p.value) };
  if (optional) next.optional = true;
  else delete next.optional;
  setParam(p.name, next);
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
  // 删空不立即删参数：额外参数行会随参数消失，没法接着输入新值；失焦仍为空才删
  if (!raw.trim()) {
    delete jsonErrors[name];
    return;
  }
  const r = tryParse(raw);
  if (r.ok) {
    delete jsonErrors[name];
    emit('setParam', name, r.value);
  } else {
    jsonErrors[name] = r.message;
  }
}

function onJsonBlur(name: string) {
  const draft = jsonDrafts[name];
  if (draft !== undefined && !draft.trim()) {
    if (params.value[name] !== undefined) setParam(name, undefined);
    else delete jsonDrafts[name];
    return;
  }
  if (draft !== undefined && !jsonErrors[name]) delete jsonDrafts[name];
}

const whenDraftValue = computed(() => whenDraft.value ?? stringifyJson(props.step?.when));

function onWhenInput(raw: string) {
  whenDraft.value = raw;
  const r = tryParse(raw);
  if (r.ok) {
    whenError.value = '';
    emit('setField', 'when', r.value);
  } else {
    whenError.value = r.message;
  }
}

function onWhenBlur() {
  if (whenDraft.value !== null && !whenError.value) whenDraft.value = null;
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
.pp-head {
  margin-bottom: 12px;
}
.pp-title {
  font-size: 16px;
  font-weight: 600;
}
.pp-kind {
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
}
.field-note {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}
.section-title {
  font-weight: 600;
  margin: 12px 0 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #f0f0f0);
}
.param-row {
  margin-bottom: 14px;
}
.param-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  min-width: 0;
}
.param-text {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 0 1 auto;
}
.param-name {
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
  flex-shrink: 0;
}
.req {
  color: #ff4d4f;
}
.mode-switch {
  margin-bottom: 6px;
}
.row-actions {
  text-align: right;
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
.mg-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.mg-reason,
.json-error {
  color: #cf1322;
}
.json-area {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}
.picker-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.picker-select {
  flex: 1;
  min-width: 0;
}
.manage-link {
  flex-shrink: 0;
  font-size: 12px;
}
.opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.opt-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.opt-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
}
.opt-code {
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
}
.opt-price {
  margin-left: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
}
.opt-typed {
  font-size: 12px;
}
.advanced :deep(.ant-collapse-header) {
  padding-left: 0 !important;
}
</style>
