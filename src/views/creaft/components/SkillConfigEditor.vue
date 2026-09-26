<template>
  <div class="skill-config-editor">
    <a-tabs v-model:active-key="tab" size="small" @change="onTabChange">
      <a-tab-pane key="visual" tab="可视化编辑">
        <a-alert
          v-if="!schema"
          type="warning"
          show-icon
          message="表单结构没加载出来，请用「原文 JSON」编辑。"
          style="margin-bottom: 8px"
        />
        <template v-else>
          <div class="shape-line">
            <span class="muted">形态</span>
            <a-radio-group :value="shape" size="small" @change="(e: { target: { value: Shape } }) => changeShape(e.target.value)">
              <a-radio-button value="react">智能体技能</a-radio-button>
              <a-radio-button value="localLife">本地生活行业技能</a-radio-button>
              <a-radio-button value="overrides">仅提示词覆盖</a-radio-button>
            </a-radio-group>
            <span class="muted">{{ SHAPE_HINTS[shape] }}</span>
          </div>

          <!-- 智能体技能：三段提示词、标签、工具 -->
          <template v-if="shape === 'react'">
            <div v-for="field in schema.promptFields" :id="`cfg-${field.key}`" :key="field.key" class="section">
              <div class="section-title">
                {{ field.label }} <code>{{ field.key }}</code>
                <span class="muted">{{ field.description }}</span>
              </div>
              <a-textarea
                v-model:value="model.prompts[field.key]"
                :auto-size="{ minRows: 3, maxRows: 16 }"
                spellcheck="false"
                @change="emitText"
              />
            </div>

            <div id="cfg-tags" class="section">
              <div class="section-title">标签 <code>tags</code></div>
              <a-select v-model:value="model.tags" mode="tags" style="width: 100%" placeholder="回车添加" @change="emitText" />
            </div>

            <div id="cfg-tools" class="section">
              <div class="section-title">
                工具 <code>tools</code>
                <span class="muted">勾选即允许智能体调用；工具说明留空表示用默认说明</span>
              </div>
              <div v-for="tool in schema.tools" :key="tool.key" class="tool-row">
                <a-checkbox :checked="toolIndex(tool.key) >= 0" @change="toggleTool(tool.key)">
                  {{ tool.label }} <code>{{ tool.key }}</code>
                </a-checkbox>
                <a-input
                  v-if="toolIndex(tool.key) >= 0"
                  v-model:value="model.tools[toolIndex(tool.key)]!.descriptionOverride"
                  size="small"
                  :placeholder="`工具说明覆盖（选填，默认：${tool.description}）`"
                  @change="emitText"
                />
              </div>
              <div v-for="unknown in unknownTools" :key="unknown" class="muted warn">
                未知工具 {{ unknown }}：服务端只认上面这几个，发布快照时会被拒。在「原文 JSON」里删掉它。
              </div>
            </div>
          </template>

          <!-- 本地生活行业技能：按分段逐条编辑，标出受理时必需的缺段 -->
          <template v-if="shape === 'localLife'">
            <div v-for="group in STAGE_GROUPS" :id="`cfg-stage-${group.key}`" :key="group.key" class="section">
              <div class="section-title">
                {{ group.label }}
                <span class="muted">{{ group.hint }}</span>
              </div>
              <div v-for="stage in stagesOf(group.key)" :key="stage.key" class="stage-card">
                <div class="stage-head">
                  <span class="stage-label">{{ stage.label }}</span>
                  <code>{{ stage.key }}</code>
                  <a-tag :color="overrideValue(stage.key) ? 'green' : 'red'">
                    {{ overrideValue(stage.key) ? '已配置' : '缺' }}
                  </a-tag>
                  <span class="muted">必需条件：{{ stage.requiredWhen }}</span>
                </div>
                <a-textarea
                  :value="overrideValue(stage.key)"
                  :auto-size="{ minRows: 2, maxRows: 14 }"
                  spellcheck="false"
                  placeholder="留空 = 缺这一段：满足必需条件的提交会在受理时被拒（不扣点数）"
                  @change="(e: Event) => setOverride(stage.key, (e.target as HTMLTextAreaElement).value)"
                />
              </div>
            </div>
          </template>

          <!-- 提示词覆盖：智能体技能按工具覆盖、仅覆盖形态、以及本地生活里执行面不读的旧分段 -->
          <div id="cfg-overrides" class="section">
            <div class="section-title">
              {{ shape === 'localLife' ? '其他分段' : '提示词覆盖' }} <code>tool_prompt_overrides</code>
              <span class="muted">{{ OVERRIDE_HINTS[shape] }}</span>
            </div>
            <div v-for="(row, index) in freeOverrides" :key="`o${index}`" class="stage-card">
              <div class="stage-head">
                <a-auto-complete
                  v-model:value="row.key"
                  :options="overrideKeyOptions"
                  size="small"
                  style="width: 260px"
                  placeholder="键名，如 visual_analyzer"
                  @change="emitText"
                />
                <span v-if="labelOf(row.key)" class="muted">{{ labelOf(row.key) }}</span>
                <a-button type="text" size="small" danger @click="removeFree(index)">移除</a-button>
                <span v-if="rowProblems[index]" class="problem">{{ rowProblems[index] }}（这一行不会保存）</span>
              </div>
              <a-textarea
                v-model:value="row.value"
                :auto-size="{ minRows: 2, maxRows: 14 }"
                spellcheck="false"
                @change="emitText"
              />
            </div>
            <a-button type="dashed" size="small" @click="addFree">+ 添加覆盖</a-button>
          </div>
        </template>
      </a-tab-pane>

      <a-tab-pane key="json" tab="原文 JSON">
        <a-textarea
          :value="text"
          :auto-size="{ minRows: 12, maxRows: 30 }"
          spellcheck="false"
          class="json-area"
          @change="(e: Event) => emit('update:text', (e.target as HTMLTextAreaElement).value)"
        />
        <div class="muted">必须是 JSON 对象。表单不认识的字段原样保留；切回可视化时会重新解析。</div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref, watch } from 'vue';

import type { CreaftSkillConfigSchema } from '@/api/creaft-compat';

import {
  buildConfig,
  collectOverrides,
  detectShape,
  emptyModel,
  freeRowProblems,
  freeRows,
  parseConfig,
  toModel,
  type FreeOverride,
  type SkillConfigModel,
  type SkillShape,
} from './skillConfigModel';

/**
 * 技能执行配置的可视化编辑。数据以 JSON 文本为准（v-model:text），可视化只是它的一种视图：
 * 每次表单改动都立刻序列化回文本，所以父组件拿到的永远是当前内容，两个页签随时可切。
 * 解析与回写在 skillConfigModel.ts（纯函数，已用 41 条真实技能验证过原样往返）。
 */
const props = defineProps<{ text: string; schema: CreaftSkillConfigSchema | null; skillCode: string }>();
const emit = defineEmits<{ 'update:text': [value: string] }>();

type Shape = SkillShape;
const SHAPE_HINTS: Record<Shape, string> = {
  react: '有三段提示词与工具清单，走智能体对话',
  localLife: '档案行业对应的出图技能，只读分段提示词',
  overrides: '只有提示词覆盖（如 1688 简约版），被其他流程按键名取用',
};
const OVERRIDE_HINTS: Record<Shape, string> = {
  react: '按工具名覆盖该工具内部用的提示词（如视觉分析、商品分析）',
  localLife: '上面没列出的键：当前执行面不读，多为 v1 旧版分段，保留不影响出图',
  overrides: '按键名覆盖提示词，键名由使用它的流程决定',
};
const STAGE_GROUPS = [
  { key: 'PIPELINE', label: '出图流水线', hint: '一键生成全案时按选中的图种取用' },
  { key: 'TEMPLATE', label: 'AI 生成模板', hint: '生成本地生活模板时全部必需' },
];

const tab = ref<'visual' | 'json'>('visual');
/** 可视化最近一次发出去的文本：回流到 props.text 时据此跳过重新解析，免得打断输入 */
let lastEmitted = '';
const shape = ref<Shape>('react');
const model = reactive<SkillConfigModel>(emptyModel());
const freeOverrides = ref<FreeOverride[]>([]);

function load(config: Record<string, unknown>) {
  Object.assign(model, toModel(config, props.schema));
  shape.value = detectShape(config, props.schema, props.skillCode, model);
  freeOverrides.value = freeRows(model, shape.value, props.schema);
}

/** 自由列表每行的问题（与分段 / 前面的行重名、键名为空）：有问题的行不写回配置 */
const rowProblems = computed(() => freeRowProblems(freeOverrides.value, shape.value, props.schema));
const hasProblems = computed(() => rowProblems.value.some(Boolean));

function changeShape(next: Shape) {
  if (hasProblems.value) {
    // 有冲突的行在收拢时会被丢掉：先让用户处理，不替他决定留哪一条
    message.warning('「提示词覆盖」里有标红的行，先改好或移除再切换形态');
    return;
  }
  // 先按旧形态收拢，再按新形态重新划分：切形态不能丢任何一条覆盖
  model.overrides = collectOverrides(model, freeOverrides.value, shape.value, props.schema);
  shape.value = next;
  freeOverrides.value = freeRows(model, next, props.schema);
  emitText();
}

function emitText() {
  model.overrides = collectOverrides(model, freeOverrides.value, shape.value, props.schema);
  lastEmitted = JSON.stringify(buildConfig(model, shape.value, props.schema), null, 2);
  emit('update:text', lastEmitted);
}

watch(
  () => props.text,
  (text) => {
    // 有标红的行时不按外部文本重建：那会丢掉这些行（它们没写进文本）
    if (text === lastEmitted || hasProblems.value) return;
    const parsed = parseConfig(text);
    if (parsed) load(parsed);
  },
  { immediate: true },
);
watch(
  () => props.schema,
  () => {
    const parsed = parseConfig(props.text);
    if (parsed) load(parsed);
  },
);

function onTabChange(key: string | number) {
  if (key === 'json' && hasProblems.value) {
    // 标红的行不在文本里：切到原文再切回来会按文本重建、把它们丢掉，保存拦截也随之解除
    message.warning('「提示词覆盖」里有标红的行，先改好或移除再切换页签');
    tab.value = 'visual';
    return;
  }
  if (key !== 'visual') return;
  const parsed = parseConfig(props.text);
  if (!parsed) {
    message.warning('原文不是合法的 JSON 对象，先改好再切回可视化');
    tab.value = 'json';
    return;
  }
  load(parsed);
}

// ---- 工具 ----
function toolIndex(name: string) {
  return model.tools.findIndex((t) => t.name === name);
}
function toggleTool(name: string) {
  const index = toolIndex(name);
  if (index >= 0) model.tools.splice(index, 1);
  else model.tools.push({ name, descriptionOverride: '', extra: {} });
  emitText();
}
const unknownTools = computed(() => {
  const known = new Set((props.schema?.tools || []).map((t) => t.key));
  return model.tools.map((t) => t.name).filter((name) => !known.has(name));
});

// ---- 分段与覆盖 ----
function stagesOf(group: string) {
  return (props.schema?.localLifeStages || []).filter((s) => s.group === group);
}
function overrideValue(key: string) {
  return model.overrides[key] || '';
}
function setOverride(key: string, value: string) {
  model.overrides[key] = value;
  emitText();
}
function addFree() {
  freeOverrides.value.push({ key: '', value: '' });
}
function removeFree(index: number) {
  freeOverrides.value.splice(index, 1);
  emitText();
}
const overrideKeyOptions = computed(() => {
  const keys = [
    ...(props.schema?.tools || []).map((t) => t.key),
    ...(shape.value === 'localLife' ? [] : (props.schema?.localLifeStages || []).map((s) => s.key)),
  ];
  return [...new Set(keys)].map((k) => ({ label: k, value: k }));
});
function labelOf(key: string) {
  const tool = props.schema?.tools.find((t) => t.key === key);
  if (tool) return tool.label;
  return props.schema?.localLifeStages.find((s) => s.key === key)?.label || '';
}

/** 编辑页用：shape 给分节导航，hasProblems 用来拦保存（有标红的行时保存会丢掉它们） */
defineExpose({ shape, hasProblems });
</script>

<style scoped>
.shape-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.section {
  margin-bottom: 16px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.section-title .muted {
  font-weight: 400;
  margin-left: 6px;
}
.tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.tool-row :deep(.ant-input) {
  flex: 1;
}
.stage-card {
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.stage-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.stage-label {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.problem {
  color: var(--color-error, #ff4d4f);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
code {
  font-size: 12px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--color-fill-quaternary, #fafafa);
}
.json-area {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
