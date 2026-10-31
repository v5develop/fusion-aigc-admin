<template>
  <div class="sve">
    <div class="sve-toolbar">
      <a-space wrap>
        <a-button size="small" :disabled="!!parseError" @click="addNode('text')">+ 文字</a-button>
        <a-button size="small" :disabled="!!parseError" @click="addNode('image')"
          >+ 图片输入</a-button
        >
        <a-button size="small" :disabled="!!parseError" @click="addNode('model-image')"
          >+ 图片生成</a-button
        >
        <a-button size="small" :disabled="!!parseError" @click="addNode('model-video')"
          >+ 视频生成</a-button
        >
        <a-button size="small" :disabled="!!parseError" @click="addNode('module')"
          >+ 分组框</a-button
        >
        <a-button
          size="small"
          danger
          :disabled="!selectedId || !!parseError"
          @click="removeSelected"
        >
          删除选中
        </a-button>
      </a-space>
      <span class="muted"
        >拖拽连线；选中节点后可改标题与文字；Backspace 删除。连线规则与服务端一致。</span
      >
    </div>

    <a-alert v-if="parseError" type="error" show-icon :message="parseError" />

    <div v-else class="sve-body">
      <div class="sve-canvas">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :auto-connect="autoConnect"
          :default-viewport="{ zoom: 0.8 }"
          :min-zoom="0.2"
          :max-zoom="2"
          fit-view-on-init
          @update:nodes="onFlowNodes"
          @update:edges="onFlowEdges"
          @node-click="onNodeClick"
          @node-drag-stop="commit"
          @pane-click="selectedId = null"
        >
          <Background :gap="16" />
          <Controls />
          <template #node-canvas="{ data, label }">
            <div
              :class="['cnode', `cnode-${data.nodeType}`]"
              :style="data.style"
              :title="data.hint"
            >
              <div class="cn-label">{{ label }}</div>
              <Handle
                v-for="(h, i) in data.inputs"
                :key="`in-${h}`"
                type="target"
                :id="h"
                :position="Position.Left"
                :style="{ top: slotTop(i, data.inputs.length) }"
                class="cn-handle"
              >
                <span class="cn-handle-name">{{ h }}</span>
              </Handle>
              <Handle
                v-for="(h, i) in data.outputs"
                :key="`out-${h}`"
                type="source"
                :id="h"
                :position="Position.Right"
                :style="{ top: slotTop(i, data.outputs.length) }"
                class="cn-handle"
              >
                <span class="cn-handle-name">{{ h }}</span>
              </Handle>
            </div>
          </template>
        </VueFlow>
      </div>

      <div v-if="selectedNode" class="sve-panel">
        <div class="sve-panel-title">节点属性（{{ selectedNode.type }}）</div>
        <a-form layout="vertical" size="small">
          <a-form-item label="标题">
            <a-input
              :value="selectedNode.data.title ?? ''"
              @update:value="(v: string) => setData('title', v)"
            />
          </a-form-item>
          <a-form-item v-if="selectedNode.type === 'text'" label="文字">
            <a-textarea
              :value="selectedNode.data.text ?? ''"
              :rows="5"
              @update:value="(v: string) => setData('text', v)"
            />
          </a-form-item>
          <a-form-item v-if="selectedNode.type === 'model'" label="最多参考图（以网关目录为准）">
            <a-input-number
              :value="selectedNode.data.maxImageRefs ?? 5"
              :min="0"
              @update:value="(v: number) => setData('maxImageRefs', v)"
            />
          </a-form-item>
          <div class="muted">位置、连线在画布上直接拖动即可。</div>
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Handle, Position, VueFlow, type Connection, type Edge, type Node } from '@vue-flow/core';
import { message } from 'antdv-next';
import { computed, ref, shallowRef, watch } from 'vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import {
  newId,
  nodeLabel,
  parseSnapshot,
  validateEdge,
  type CanvasEdge,
  type CanvasNode,
  type Snapshot,
} from '@/utils/canvas-snapshot';

/**
 * 画布快照的可视化编辑。modelValue 是快照 JSON 文本（与模板页的文本框是同一份数据）。
 * 文本是唯一数据源：每次改动都 emit 整段 JSON，外部改了文本也会同步回画布。
 */
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const snap = ref<Snapshot>({ nodes: [], edges: [] });
const parseError = ref('');
const flowNodes = shallowRef<Node[]>([]);
const flowEdges = shallowRef<Edge[]>([]);
const selectedId = ref<string | null>(null);
/** 等待替换的旧提示词连线 id（autoConnect 记下，新线添加成功后在 onFlowEdges 中移除） */
let pendingReplace = new Set<string>();
/** 自己 emit 出去的文本：父组件回传同一段文本时不重新解析，避免光标与视图跳动 */
let lastEmitted: string | null = null;

const selectedNode = computed(
  () => snap.value.nodes.find((n) => n.id === selectedId.value) ?? null,
);

/** 按节点类型给出输入 / 输出口名称，与 validateEdge 的规则一一对应 */
function handlesOf(n: CanvasNode): { inputs: string[]; outputs: string[] } {
  switch (n.type) {
    case 'text':
      return { inputs: [], outputs: ['text'] };
    case 'image':
      return n.data?.kind === 'result'
        ? { inputs: ['image-in'], outputs: [] }
        : { inputs: [], outputs: ['image'] };
    case 'video':
      return { inputs: [], outputs: ['video'] };
    case 'model':
      return n.data?.kind === 'video'
        ? { inputs: ['prompt', 'image1', 'image2', 'video'], outputs: ['image-out'] }
        : { inputs: ['prompt', 'image'], outputs: ['image-out'] };
    case 'tool': {
      const tool = n.data?.tool;
      if (tool === 'tryon') return { inputs: ['garment', 'models'], outputs: ['image-out'] };
      // 反推输出文字；裁剪、放大、扩图、重绘输出图片。所有工具都有一个图片输入口 image
      if (tool === 'i2p') return { inputs: ['image'], outputs: ['text'] };
      return { inputs: ['image'], outputs: ['image-out'] };
    }
    default:
      return { inputs: [], outputs: [] };
  }
}

function toFlowNode(n: CanvasNode): Node {
  const isModule = n.type === 'module';
  const { inputs, outputs } = handlesOf(n);
  return {
    id: n.id,
    type: 'canvas',
    position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
    label: nodeLabel(n),
    draggable: !isModule,
    selectable: !isModule,
    zIndex: isModule ? -1 : 0,
    data: {
      nodeType: n.type,
      inputs,
      outputs,
      hint: n.id,
      style: isModule
        ? {
            width: `${n.data?.width ?? 600}px`,
            height: `${n.data?.height ?? 400}px`,
            background: n.data?.color || 'rgba(142, 102, 249, 0.10)',
          }
        : undefined,
    },
  };
}

function toFlowEdge(e: CanvasEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.targetHandle ?? '',
  };
}

function setFromText(text: string) {
  // 新建模板时快照为空：当作空画布，而不是报错
  if (!text.trim()) {
    parseError.value = '';
    snap.value = { nodes: [], edges: [] };
    flowNodes.value = [];
    flowEdges.value = [];
    return;
  }
  const r = parseSnapshot(text);
  if (!r.ok) {
    parseError.value = r.error;
    return;
  }
  parseError.value = '';
  snap.value = r.snapshot;
  flowNodes.value = snap.value.nodes.map(toFlowNode);
  flowEdges.value = snap.value.edges.map(toFlowEdge);
}

watch(
  () => props.modelValue,
  (t) => {
    if (t === lastEmitted) {
      parseError.value = '';
      return;
    }
    setFromText(t);
  },
  { immediate: true },
);

function commit() {
  const text = JSON.stringify(snap.value, null, 2);
  lastEmitted = text;
  emit('update:modelValue', text);
}

/** 第 i 个口在 n 个口中的垂直位置 */
function slotTop(i: number | string, n: number): string {
  return `${((Number(i) + 1) / (n + 1)) * 100}%`;
}

/**
 * references[].index 的序号：同一输入口（图片口按整个图片族：image / image1 / image2 / first / last）内
 * 已用过的最大序号 + 1，删除后也不会重复（api-canvas.md 5.2 data.order）。提示词口不编号。
 */
const IMAGE_FAMILY = new Set(['image', 'image1', 'image2', 'first', 'last']);
function nextOrder(target: string, handle: string | null | undefined): number | undefined {
  if (handle === 'prompt') return undefined;
  const family = IMAGE_FAMILY.has(handle ?? '') ? IMAGE_FAMILY : new Set([handle ?? '']);
  let max = 0;
  for (const e of snap.value.edges) {
    if (e.target !== target || !family.has(e.targetHandle ?? '')) continue;
    const o = Number((e.data as Record<string, unknown> | undefined)?.order ?? 0);
    if (o > max) max = o;
  }
  return max + 1;
}

/** Vue Flow 在添加连线前回调：校验不通过返回 false，连线不会被添加 */
function autoConnect(conn: Connection): Connection | false {
  // 提示词口：新线替换旧线（api-canvas.md 6.1）。先按去掉旧线后的状态校验，通过才真正替换
  const replaced =
    conn.targetHandle === 'prompt'
      ? snap.value.edges.filter((e) => e.target === conn.target && e.targetHandle === 'prompt')
      : [];
  const remaining = snap.value.edges.filter((e) => !replaced.includes(e));
  const err = validateEdge(snap.value, remaining, conn);
  // 只记下待替换的旧线，真正的删除放到 onFlowEdges（新线添加成功之后），避免添加失败时快照与文本不一致
  pendingReplace = new Set(replaced.map((e) => e.id));
  if (err) {
    pendingReplace.clear();
    message.warning(err);
    return false;
  }
  const data: Record<string, unknown> = { color: '#38bdf8' };
  const order = nextOrder(conn.target, conn.targetHandle);
  if (order !== undefined) data.order = order;
  return { ...conn, id: newId('e'), data } as Connection;
}

/**
 * 节点列表变化。拖动只同步位置（不提交，拖动结束再 commit）；
 * 增删节点是结构变化，才同步连线并提交。
 */
function onFlowNodes(nodes: Node[]) {
  flowNodes.value = nodes;
  const structural = nodes.length !== snap.value.nodes.length;
  const posById = new Map(nodes.map((n) => [n.id, n.position]));
  snap.value.nodes = snap.value.nodes
    .filter((n) => posById.has(n.id))
    .map((n) => {
      const p = posById.get(n.id);
      return p ? { ...n, position: { x: p.x, y: p.y } } : n;
    });
  if (!structural) return;
  const alive = new Set(nodes.map((n) => n.id));
  snap.value.edges = snap.value.edges.filter((e) => alive.has(e.source) && alive.has(e.target));
  flowEdges.value = flowEdges.value.filter(
    (e) => alive.has(e.source as string) && alive.has(e.target as string),
  );
  if (selectedId.value && !alive.has(selectedId.value)) selectedId.value = null;
  commit();
}

/** 连线列表变化：新增的连线已经过 autoConnect 校验，这里只把它写进快照 */
function onFlowEdges(incoming: Edge[]) {
  let edges = incoming;
  if (pendingReplace.size) {
    edges = incoming.filter((e) => !pendingReplace.has(e.id));
    pendingReplace.clear();
  }
  flowEdges.value = edges;
  const alive = new Set(snap.value.nodes.map((n) => n.id));
  const before = JSON.stringify(snap.value.edges);
  snap.value.edges = edges
    .filter((e) => alive.has(e.source as string) && alive.has(e.target as string))
    .map((e) => {
      const orig = snap.value.edges.find((x) => x.id === e.id);
      if (orig) return orig;
      return {
        id: e.id,
        source: e.source as string,
        target: e.target as string,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        type: 'canvas-bezier',
        data: (e.data as Record<string, unknown>) ?? { color: '#38bdf8' },
      } satisfies CanvasEdge;
    });
  if (JSON.stringify(snap.value.edges) !== before) commit();
}

function onNodeClick(evt: { node: Node }) {
  selectedId.value = evt.node.id;
}

function refreshFlowNode(id: string) {
  const n = snap.value.nodes.find((x) => x.id === id);
  if (!n) return;
  flowNodes.value = flowNodes.value.map((f) =>
    f.id === id ? { ...toFlowNode(n), position: f.position } : f,
  );
}

function setData(key: string, value: unknown) {
  const n = selectedNode.value;
  if (!n) return;
  n.data = { ...n.data, [key]: value };
  refreshFlowNode(n.id);
  commit();
}

type DefaultNode = { type: string; data: Record<string, any> };
const DEFAULTS: Record<string, () => DefaultNode> = {
  text: () => ({
    type: 'text',
    data: { text: '', title: '文字', subtitle: '文字', kind: 'text', mentions: [] },
  }),
  image: () => ({
    type: 'image',
    data: { image: '', title: '图片', subtitle: '参考图', kind: 'input' },
  }),
  'model-image': () => ({
    type: 'model',
    data: {
      title: '图片生成',
      subtitle: 'Banana · 1K',
      kind: 'model',
      model: 'Banana',
      maxImageRefs: 5,
      ratio: '1:1',
      size: '1K',
      quality: '中',
      cfg: 0.95,
      count: 1,
      prompt: '',
    },
  }),
  'model-video': () => ({
    type: 'model',
    data: {
      title: '视频生成',
      subtitle: 'Seedance 2.5 · 720p',
      kind: 'video',
      model: 'Seedance 2.5',
      maxImageRefs: 3,
      ratio: '16:9',
      size: '720p',
      duration: '4s',
      sound: false,
      count: 1,
      prompt: '',
    },
  }),
  module: () => ({
    type: 'module',
    data: {
      title: '分组',
      subtitle: '模板模块',
      kind: 'module',
      color: 'rgba(142, 102, 249, 0.10)',
      width: 600,
      height: 400,
    },
  }),
};

function addNode(kind: keyof typeof DEFAULTS) {
  const k = snap.value.nodes.length;
  const base = DEFAULTS[kind]();
  const node: CanvasNode = {
    id: newId(`n-${base.type}`),
    position: { x: 80 + (k % 6) * 40, y: 80 + (k % 6) * 40 },
    ...base,
  };
  snap.value.nodes = [...snap.value.nodes, node];
  flowNodes.value = [...flowNodes.value, toFlowNode(node)];
  selectedId.value = node.id;
  commit();
}

function removeSelected() {
  const id = selectedId.value;
  if (!id) return;
  snap.value.nodes = snap.value.nodes.filter((n) => n.id !== id);
  snap.value.edges = snap.value.edges.filter((e) => e.source !== id && e.target !== id);
  flowNodes.value = flowNodes.value.filter((n) => n.id !== id);
  flowEdges.value = flowEdges.value.filter((e) => e.source !== id && e.target !== id);
  selectedId.value = null;
  commit();
}
</script>

<style scoped>
.sve-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.sve-body {
  display: flex;
  gap: 12px;
}
.sve-canvas {
  flex: 1;
  height: 460px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.sve-panel {
  width: 240px;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px;
}
.sve-panel-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.cnode {
  min-width: 170px;
  padding: 8px 10px;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
}
.cnode-module {
  min-width: 0;
  border-style: dashed;
}
.cn-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cn-handle-name {
  position: absolute;
  top: -14px;
  font-size: 10px;
  color: #64748b;
  white-space: nowrap;
}
.muted {
  color: #94a3b8;
  font-size: 12px;
}
</style>
