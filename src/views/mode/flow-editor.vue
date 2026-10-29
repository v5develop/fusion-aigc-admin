<template>
  <div class="flow-editor">
    <div class="fe-header">
      <a-space>
        <a-button @click="goBack">返回</a-button>
        <span class="fe-title">{{ flowName }} · v{{ version?.versionNo }}</span>
        <a-tag
          :color="
            version?.status === 'published'
              ? 'green'
              : version?.status === 'archived'
                ? 'default'
                : 'blue'
          "
        >
          {{ vStatusLabel(version?.status) }}
        </a-tag>
        <a-tag color="orange">只读</a-tag>
      </a-space>
      <a-space>
        <span class="muted">结算</span>
        <a-select
          v-model:value="settlementType"
          :options="settlementOptions"
          size="small"
          style="width: 170px"
          disabled
        />
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      class="frozen-alert"
      :message="t('modeRouting.editorReadonlyHint')"
    >
      <template #action>
        <a-button size="small" type="link" @click="goDefinition">
          {{ definitionId ? t('modeRouting.openDefinition') : t('modeRouting.goDefinitions') }}
        </a-button>
      </template>
    </a-alert>

    <div class="fe-body">
      <!-- 节点面板 -->
      <div class="fe-palette">
        <div class="palette-title">节点面板</div>
        <div class="palette-hint">按 kind 分组，仅供查看。节点只描述「跑什么」，不含计费。</div>
        <div
          v-for="m in palette"
          :key="m.id"
          class="palette-node"
          :style="{ borderColor: kindColorHex(m.kind) }"
        >
          <a-tag :color="kindColor(m.kind)" size="small" :title="m.kind">{{
            stepKindLabel(m.kind)
          }}</a-tag>
          <span class="pn-code" :title="m.code">{{ m.name || m.code }}</span>
          <span v-if="m.mode != null" class="pn-mode">#{{ m.mode }}</span>
        </div>
        <a-empty
          v-if="!palette.length"
          description="先在「Mode 节点」建节点"
          :image-style="{ height: '40px' }"
        />
      </div>

      <!-- 画布 -->
      <div class="fe-canvas">
        <VueFlow
          :id="flowKey"
          :default-viewport="{ zoom: 0.9 }"
          :min-zoom="0.2"
          :max-zoom="2"
          :nodes-draggable="false"
          :nodes-connectable="false"
          :edges-updatable="false"
          :delete-key-code="null"
          fit-view-on-init
        >
          <Background :gap="16" />
          <Controls />
          <template #node-mode="{ data }">
            <div class="mode-node" :style="{ borderColor: kindColorHex(data.kind) }">
              <div class="mn-head">
                <a-tag :color="kindColor(data.kind)" size="small" :title="data.kind">{{
                  stepKindLabel(data.kind)
                }}</a-tag>
                <span class="mn-code" :title="data.code">{{
                  data.label || data.name || data.code
                }}</span>
              </div>
              <div class="mn-meta">
                <span v-if="data.mode != null">mode #{{ data.mode }}</span>
                <span v-if="data.handler" :title="data.handler"
                  >处理器 {{ data.name || data.handler }}</span
                >
                <span v-if="data.modelId">模型 {{ modelName(data.modelId) }}</span>
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- 属性面板 -->
      <div class="fe-props">
        <div class="palette-title">节点属性</div>
        <div v-if="!selectedNode" class="props-empty">点画布上的节点以编辑</div>
        <a-form v-else layout="vertical">
          <a-form-item label="编码 Code"
            ><a-input :value="selectedNode.data.code" disabled
          /></a-form-item>
          <a-form-item label="类型 Kind"
            ><a-input :value="selectedNode.data.kind" disabled
          /></a-form-item>
          <a-form-item v-if="selectedNode.data.mode != null" label="Mode"
            ><a-input :value="String(selectedNode.data.mode)" disabled
          /></a-form-item>
          <a-form-item v-if="selectedNode.data.handler" label="Handler"
            ><a-input :value="selectedNode.data.handler" disabled
          /></a-form-item>
          <a-form-item label="显示名（可选）">
            <a-input v-model:value="selectedNode.data.label" disabled placeholder="节点显示名" />
          </a-form-item>
          <a-form-item label="绑定生成模型 modelId（AIGC 步，可空=默认）">
            <a-select
              v-model:value="selectedNode.data.modelId"
              :options="modelOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              disabled
              placeholder="选择生成模型"
            />
          </a-form-item>
          <a-form-item
            v-if="selectedNode.data.kind === 'AIGC'"
            label="可变模型步 variantGroup（可空）"
          >
            <a-input
              v-model:value="selectedNode.data.variantGroup"
              disabled
              placeholder="填 stepCode 分组名（如 imageGen）"
            />
            <div class="muted" style="margin-top: 4px">
              非空=该步按<b>提交模型</b>选档：运行时从 offer 同 stepCode
              的多档组件命中一档，覆写本步 mode+modelId（上面 Mode 作占位默认档）。
            </div>
          </a-form-item>
          <a-form-item
            v-if="selectedNode.data.kind === 'LOCAL'"
            label="提示词 code 覆盖 promptCode（可空）"
          >
            <a-input
              v-model:value="selectedNode.data.promptCode"
              disabled
              placeholder="填 Prompt Lab code（如 scriptReplication@doubao）"
            />
            <div class="muted" style="margin-top: 4px">
              非空=该 LOCAL 优化步用此 code 取代 handler
              内定默认；再叠加<b>目标模型维度</b>（自动带提交模型）。空=用默认。
            </div>
          </a-form-item>
          <a-alert
            type="info"
            show-icon
            style="margin-top: 12px"
            message="计费类型不在此配置——计费随计费场景，在计费/offer 层管理。"
          />
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow, useVueFlow, type Node, type Edge } from '@vue-flow/core';
import { message } from 'antdv-next';
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import { getFlowDetail, listEnabledModes, type Mode, type ModeFlowVersion } from '@/api/mode';
import { getModeRoutingDrift } from '@/api/mode-routing';
import { getModelOptions } from '@/api/model';
import { stepKindLabel } from '@/utils/terms';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const flowId = Number(route.params.flowId);
const versionId = Number(route.query.versionId);
const flowKey = `flow-${flowId}-${versionId}`;

const { setNodes, setEdges, findNode, onNodeClick } = useVueFlow(flowKey);

const flowName = ref('');
const flowCode = ref('');
const version = ref<ModeFlowVersion | null>(null);
// 旧 Mode 流只读：不可增删节点、拖动或保存；定义表是改走定义后的唯一来源，编辑统一到工作流定义页
/** 已导入的定义 id（同步接口可用且已导入时），用于直达定义详情 */
const definitionId = ref<number | string | null>(null);
const settlementType = ref('ALL_OR_NOTHING');
const settlementOptions = [
  { label: 'ALL_OR_NOTHING（整单）', value: 'ALL_OR_NOTHING' },
  { label: 'PER_CHILD（逐子）', value: 'PER_CHILD' },
];

const palette = ref<Mode[]>([]);
const modelOptions = ref<{ label: string; value: number }[]>([]);
const modelMap = ref<Record<number, string>>({});
function modelName(id?: number) {
  return id ? modelMap.value[id] || `#${id}` : '';
}

const selectedNodeId = ref<string>();
const selectedNode = computed<Node | undefined>(() =>
  selectedNodeId.value ? findNode(selectedNodeId.value) : undefined,
);

function kindColor(k?: string) {
  return (
    (
      { LOCAL: 'blue', AIGC: 'green', VOLC: 'gold', GENERATION: 'purple' } as Record<string, string>
    )[k || ''] || 'default'
  );
}
function kindColorHex(k?: string) {
  return (
    (
      { LOCAL: '#1677ff', AIGC: '#52c41a', VOLC: '#faad14', GENERATION: '#722ed1' } as Record<
        string,
        string
      >
    )[k || ''] || '#d9d9d9'
  );
}
function vStatusLabel(s?: string) {
  return s === 'published' ? '已发布' : s === 'archived' ? '已归档' : '草稿';
}

onNodeClick(({ node }) => (selectedNodeId.value = node.id));

function goDefinition() {
  router.push(
    definitionId.value ? `/workflow/definitions/${definitionId.value}` : '/workflow/definitions',
  );
}

function goBack() {
  router.push(`/workflow/modes/flows/${flowId}/versions`);
}

async function load() {
  try {
    const [detail, modes, models] = await Promise.all([
      getFlowDetail(flowId),
      listEnabledModes(),
      getModelOptions(),
    ]);
    flowName.value = detail.flow.name;
    flowCode.value = detail.flow.code;
    if (detail.flow.code) {
      getModeRoutingDrift(String(detail.flow.code))
        .then((d) => (definitionId.value = d?.definitionId ?? null))
        .catch(() => (definitionId.value = null));
    }
    version.value = detail.versions.find((v) => v.id === versionId) || null;
    settlementType.value = version.value?.settlementType || 'ALL_OR_NOTHING';
    palette.value = modes || [];
    modelOptions.value = (models || []).map((m: { id: number; name: string; code?: string }) => ({
      label: m.code ? `${m.name} (${m.code})` : m.name,
      value: m.id,
    }));
    const map: Record<number, string> = {};
    (models || []).forEach((m: { id: number; name: string }) => (map[m.id] = m.name));
    modelMap.value = map;
    // 载入已存 graph
    const g = version.value?.graphJson as { nodes?: Node[]; edges?: Edge[] } | undefined;
    if (g && (g.nodes || g.edges)) {
      setNodes((g.nodes || []).map((n) => ({ ...n, type: n.type || 'mode' })));
      setEdges(g.edges || []);
    }
  } catch {
    message.error('加载失败');
  }
}

// markRaw 无需——组件不放入响应式；直接挂载后加载
onMounted(load);
</script>

<style scoped>
.frozen-alert {
  margin: 0 16px 8px;
}
.flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.fe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border, #f0f0f0);
}
.fe-title {
  font-size: 15px;
  font-weight: 600;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.fe-body {
  display: grid;
  grid-template-columns: 220px 1fr 300px;
  flex: 1;
  min-height: 0;
}
.fe-palette {
  border-right: 1px solid var(--color-border, #f0f0f0);
  padding: 12px;
  overflow-y: auto;
}
.fe-canvas {
  position: relative;
  min-height: 0;
}
.fe-props {
  border-left: 1px solid var(--color-border, #f0f0f0);
  padding: 12px;
  overflow-y: auto;
}
.palette-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.palette-hint {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
  margin-bottom: 10px;
}
.props-empty {
  color: var(--color-text-tertiary, #999);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.palette-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: 6px;
  cursor: grab;
  background: var(--color-bg-container, #fff);
}
.pn-code {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pn-mode {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}
.mode-node {
  min-width: 150px;
  padding: 8px 10px;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.mn-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mn-code {
  font-size: 13px;
  font-weight: 600;
}
.mn-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
