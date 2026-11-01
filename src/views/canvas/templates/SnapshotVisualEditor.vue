<template>
  <div class="sve">
    <div class="sve-toolbar">
      <div class="sve-toolbar-groups">
        <div class="sve-tgroup">
          <span class="sve-tgroup-label">输入</span>
          <a-button size="small" :disabled="!!parseError" @click="addNode('text')">+ 文字</a-button>
          <a-button size="small" :disabled="!!parseError" @click="addNode('image')"
            >+ 图片输入</a-button
          >
        </div>
        <div class="sve-tgroup">
          <span class="sve-tgroup-label">生成</span>
          <a-button size="small" :disabled="!!parseError" @click="addNode('model-image')"
            >+ 图片生成</a-button
          >
          <a-button size="small" :disabled="!!parseError" @click="addNode('model-video')"
            >+ 视频生成</a-button
          >
        </div>
        <div class="sve-tgroup">
          <span class="sve-tgroup-label">布局</span>
          <a-button size="small" :disabled="!!parseError" @click="addNode('module')"
            >+ 分组框</a-button
          >
        </div>
        <div class="sve-tgroup">
          <a-button
            size="small"
            danger
            :disabled="!selectedId || !!parseError"
            @click="removeSelected"
          >
            删除选中
          </a-button>
        </div>
      </div>
      <span class="muted"
        >拖拽连线；选中节点后可改标题与文字；Backspace 删除。连线规则与服务端一致。</span
      >
    </div>

    <a-alert v-if="parseError" type="error" show-icon :message="parseError" />

    <div v-else class="sve-body">
      <div class="sve-canvas" :style="{ height: props.height }">
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
          <Background variant="dots" :gap="22" :size="1" color="#262d39" />
          <Controls />
          <template #node-canvas="{ data, selected }">
            <!-- 分组框：大面板 + 左上角标题，内容在标题下方 -->
            <div
              v-if="data.nodeType === 'module'"
              class="cmod"
              :style="data.style"
              :title="data.hint"
            >
              <div class="cmod-head">
                <span class="cmod-type">{{ data.typeText }}</span>
                <span class="cmod-title">{{ data.title || '未命名分组' }}</span>
                <span v-if="data.moduleSub" class="cmod-sub">{{ data.moduleSub }}</span>
              </div>
            </div>
            <!-- 普通节点卡片：头部（类型色块 + 类型）/ 标题 / 副标题 / 口区 -->
            <div
              v-else
              :class="['cnode', `cnode-${data.category}`, { 'is-selected': selected }]"
              :style="data.style"
              :title="data.hint"
            >
              <div class="cn-head">
                <span class="cn-chip" />
                <span class="cn-type">{{ data.typeText }}</span>
              </div>
              <div class="cn-title">{{ data.title || data.typeText }}</div>
              <div :class="['cn-sub', { 'is-empty': !data.subtitle }]">
                {{ data.subtitle || '—' }}
              </div>
              <div class="cn-ports">
                <div v-for="r in data.rows" :key="r" class="cn-port-row">
                  <span class="cn-port-name cn-in">{{ handleName(data.inputs[r - 1]) }}</span>
                  <span class="cn-port-name cn-out">{{ handleName(data.outputs[r - 1]) }}</span>
                </div>
              </div>
              <Handle
                v-for="(h, i) in data.inputs"
                :key="`in-${h}`"
                type="target"
                :id="h"
                :position="Position.Left"
                :style="{ top: slotTop(i) }"
                class="cn-handle"
              />
              <Handle
                v-for="(h, i) in data.outputs"
                :key="`out-${h}`"
                type="source"
                :id="h"
                :position="Position.Right"
                :style="{ top: slotTop(i) }"
                class="cn-handle"
              />
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
const props = withDefaults(defineProps<{ modelValue: string; height?: string }>(), {
  height: '460px',
});
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

/** 口 id 的中文名（仅用于展示，连线与校验仍用原 id） */
const HANDLE_NAMES: Record<string, string> = {
  prompt: '提示词',
  image: '图片',
  image1: '图片1',
  image2: '图片2',
  video: '视频',
  garment: '服装',
  models: '模特',
  'image-in': '结果图',
  'image-out': '图片',
  text: '文字',
};
function handleName(id: string | null | undefined): string {
  return id ? (HANDLE_NAMES[id] ?? id) : '';
}

const TOOL_NAMES: Record<string, string> = {
  crop: '裁剪',
  upscale: '高清放大',
  outpaint: '扩图',
  mask: '局部重绘',
  i2p: '反推提示词',
  tryon: '模特试穿',
};

function typeTextOf(n: CanvasNode): string {
  switch (n.type) {
    case 'text':
      return '文字';
    case 'image':
      return n.data?.kind === 'result' ? '结果图' : '图片输入';
    case 'video':
      return '视频输入';
    case 'model':
      return n.data?.kind === 'video' ? '视频生成' : '图片生成';
    case 'tool':
      return TOOL_NAMES[n.data?.tool as string] ?? String(n.data?.tool ?? '工具');
    case 'module':
      return '分组';
    default:
      return String(n.type);
  }
}

function subtitleOf(n: CanvasNode): string {
  if (n.type === 'text') return String(n.data?.text ?? '').slice(0, 30);
  if (n.type === 'model') return String(n.data?.model ?? '');
  return '';
}

/* ---------- 仅用于展示的配色与尺寸（不写入快照） ---------- */

/** 节点类别：决定卡片类型色块、强调条与口的颜色 */
type Category = 'text' | 'image' | 'video' | 'model' | 'tool' | 'result' | 'module';
const CATEGORY_COLORS: Record<Category, string> = {
  text: '#f5b544',
  image: '#4f9dff',
  video: '#a98bff',
  model: '#36d399',
  tool: '#ff8f4d',
  result: '#f472b6',
  module: '#8b93a7',
};
function categoryOf(n: CanvasNode): Category {
  switch (n.type) {
    case 'text':
      return 'text';
    case 'image':
      return n.data?.kind === 'result' ? 'result' : 'image';
    case 'video':
      return 'video';
    case 'model':
      return 'model';
    case 'tool':
      return 'tool';
    case 'module':
      return 'module';
    default:
      return 'tool';
  }
}

/** 连线颜色按目标口类型 */
const PORT_COLORS: Record<string, string> = {
  prompt: '#f5b544',
  text: '#f5b544',
  image: '#4f9dff',
  image1: '#4f9dff',
  image2: '#4f9dff',
  first: '#4f9dff',
  last: '#4f9dff',
  'image-in': '#f472b6',
  'image-out': '#4f9dff',
  video: '#a98bff',
  garment: '#ff7a8a',
  models: '#2ed3c6',
};
function portColor(id: string | null | undefined): string {
  return (id && PORT_COLORS[id]) || '#8b93a7';
}

/**
 * 卡片纵向尺寸（px，与样式表一一对应）：
 * 上内边距 14 + 头部 18 + 间距 10 + 标题 18 + 间距 2 + 副标题 16 + 间距 12 + 分隔线 1 + 口区上内边距 6
 */
const PORTS_TOP = 14 + 18 + 10 + 18 + 2 + 16 + 12 + 1 + 6;
const PORT_ROW = 26;

/** 分组框副标题：只在用户改过默认文案时显示 */
function moduleSubOf(n: CanvasNode): string {
  const s = String(n.data?.subtitle ?? '');
  return s && s !== '模板模块' ? s : '';
}

function toFlowNode(n: CanvasNode): Node {
  const isModule = n.type === 'module';
  const { inputs, outputs } = handlesOf(n);
  const slots = Math.max(inputs.length, outputs.length, 1);
  const category = categoryOf(n);
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
      category,
      inputs,
      outputs,
      rows: slots,
      hint: n.id,
      typeText: typeTextOf(n),
      title: String(n.data?.title ?? ''),
      subtitle: subtitleOf(n),
      moduleSub: isModule ? moduleSubOf(n) : '',
      style: isModule
        ? {
            width: `${n.data?.width ?? 600}px`,
            height: `${n.data?.height ?? 400}px`,
            background: n.data?.color || 'rgba(142, 102, 249, 0.10)',
          }
        : {
            '--accent': CATEGORY_COLORS[category],
            // 与样式表一致：口区下内边距 4 + 卡片下内边距 4 + 上下边框 2
            minHeight: `${PORTS_TOP + slots * PORT_ROW + 4 + 4 + 2}px`,
          },
    },
  };
}

/** 连线的展示字段：贝塞尔曲线、按目标口着色、深色胶囊标签（不进入快照） */
function edgeDisplay(targetHandle: string | null | undefined): Partial<Edge> {
  const color = portColor(targetHandle);
  return {
    type: 'default',
    class: 'sve-edge',
    label: handleName(targetHandle),
    style: { stroke: color, strokeWidth: 1.5, color },
    labelStyle: { fill: color, fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em' },
    labelShowBg: true,
    labelBgStyle: { fill: '#12161d', stroke: color, strokeOpacity: 0.45, strokeWidth: 1 },
    labelBgPadding: [7, 3],
    labelBgBorderRadius: 8,
  };
}

function toFlowEdge(e: CanvasEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    ...edgeDisplay(e.targetHandle),
  } as Edge;
}

/**
 * 完全重叠（坐标相同）的节点只在画布显示时错开，快照里的位置不变。
 * 记下每个被错开节点的偏移；节点被拖动后偏移作废，以拖动后的位置为准。
 */
const DUP_STEP = 44;
let displayOffset = new Map<string, { dx: number; dy: number }>();
function spreadDuplicates(nodes: Node[]): Node[] {
  displayOffset = new Map();
  const seen = new Map<string, number>();
  return nodes.map((f) => {
    if (f.data?.nodeType === 'module') return f;
    const key = `${f.position.x},${f.position.y}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    if (k === 0) return f;
    const off = { dx: k * DUP_STEP, dy: k * DUP_STEP };
    displayOffset.set(f.id, off);
    return { ...f, position: { x: f.position.x + off.dx, y: f.position.y + off.dy } };
  });
}
/** 画布上的位置换算回快照位置：仍处于错开状态的节点还原为原坐标 */
function savedPosition(f: Node, orig: CanvasNode): { x: number; y: number } {
  const off = displayOffset.get(f.id);
  if (!off) return f.position;
  const x = f.position.x - off.dx;
  const y = f.position.y - off.dy;
  const ox = orig.position?.x ?? 0;
  const oy = orig.position?.y ?? 0;
  if (Math.abs(x - ox) < 0.5 && Math.abs(y - oy) < 0.5) return { x: ox, y: oy };
  displayOffset.delete(f.id);
  return f.position;
}

function setFromText(text: string) {
  // 新建模板时快照为空：当作空画布，而不是报错
  if (!text.trim()) {
    parseError.value = '';
    snap.value = { nodes: [], edges: [] };
    flowNodes.value = spreadDuplicates([]);
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
  flowNodes.value = spreadDuplicates(snap.value.nodes.map(toFlowNode));
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

/** 第 i 个口的垂直位置：对齐卡片口区第 i 行的中线（与 .cn-port-row 的行高一致） */
function slotTop(i: number | string): string {
  return `${PORTS_TOP + Number(i) * PORT_ROW + PORT_ROW / 2}px`;
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
  return { ...conn, id: newId('e'), data, ...edgeDisplay(conn.targetHandle) } as Connection;
}

/**
 * 节点列表变化。拖动只同步位置（不提交，拖动结束再 commit）；
 * 增删节点是结构变化，才同步连线并提交。
 */
function onFlowNodes(nodes: Node[]) {
  flowNodes.value = nodes;
  const structural = nodes.length !== snap.value.nodes.length;
  const flowById = new Map(nodes.map((n) => [n.id, n]));
  snap.value.nodes = snap.value.nodes
    .filter((n) => flowById.has(n.id))
    .map((n) => {
      const f = flowById.get(n.id);
      // 仅展示用的错开偏移不写回快照
      const p = f ? savedPosition(f, n) : undefined;
      return p ? { ...n, position: { x: p.x, y: p.y } } : n;
    });
  if (!structural) return;
  const alive = new Set(nodes.map((n) => n.id));
  for (const id of displayOffset.keys()) if (!alive.has(id)) displayOffset.delete(id);
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
/* ---------- 工具栏 ---------- */
.sve-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 10px;
}
.sve-toolbar-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sve-tgroup {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
}
.sve-tgroup:last-child {
  padding-left: 4px;
}
.sve-tgroup-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: #8b93a7;
}
.sve-body {
  display: flex;
  gap: 12px;
}

/* ---------- 画布 ---------- */
.sve-canvas {
  flex: 1;
  min-width: 0;
  border: 1px solid #232a36;
  border-radius: 12px;
  overflow: hidden;
  background: #0f1217;
  font-family: var(--font-family);
}
.sve-canvas :deep(.vue-flow) {
  background: #0f1217;
}
.sve-canvas :deep(.vue-flow__connection-path) {
  stroke: #7c8599;
  stroke-width: 1.5;
}
.sve-canvas :deep(.vue-flow__selection),
.sve-canvas :deep(.vue-flow__nodesselection-rect) {
  background: rgba(79, 157, 255, 0.08);
  border: 1px solid rgba(79, 157, 255, 0.5);
}

/* 连线：悬停 / 选中时加粗并发光（颜色取自路径的 color） */
.sve-canvas :deep(.sve-edge .vue-flow__edge-path) {
  transition:
    stroke-width 0.15s ease,
    filter 0.15s ease;
}
.sve-canvas :deep(.sve-edge:hover .vue-flow__edge-path),
.sve-canvas :deep(.sve-edge.selected .vue-flow__edge-path) {
  stroke-width: 2.25;
  filter: drop-shadow(0 0 4px currentColor);
}
.sve-canvas :deep(.sve-edge .vue-flow__edge-text) {
  font-family: var(--font-family);
}

/* 缩放控件：深色 */
.sve-canvas :deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid #2a3140;
  border-radius: 8px;
  background: #1b1f27;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.sve-canvas :deep(.vue-flow__controls-button) {
  width: 28px;
  height: 28px;
  border: none;
  border-bottom: 1px solid #2a3140;
  background: #1b1f27;
  color: #c3cad8;
}
.sve-canvas :deep(.vue-flow__controls-button:last-child) {
  border-bottom: none;
}
.sve-canvas :deep(.vue-flow__controls-button:hover) {
  background: #242a35;
}
.sve-canvas :deep(.vue-flow__controls-button svg) {
  fill: #c3cad8;
}

/* ---------- 节点卡片 ---------- */
.cnode {
  --accent: #8b93a7;
  position: relative;
  box-sizing: border-box;
  width: 220px;
  padding: 14px 16px 4px;
  border: 1px solid #2a3140;
  border-radius: 12px;
  background: #1b1f27;
  color: #e6e9ef;
  font-family: var(--font-family);
  font-size: 12px;
  line-height: 1;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.03) inset,
    0 8px 24px rgba(0, 0, 0, 0.35);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
/* 顶部类别色强调条 */
.cnode::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 14px;
  right: 14px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--accent);
  opacity: 0.9;
}
.cnode:hover {
  border-color: #3a4357;
}
.cnode.is-selected {
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent),
    0 10px 28px rgba(0, 0, 0, 0.45);
}
.cn-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 18px;
}
.cn-chip {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 60%, transparent);
}
.cn-type {
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  letter-spacing: 0.06em;
  color: #8b93a7;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cn-title {
  height: 18px;
  margin-top: 10px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: #f3f5f8;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cn-sub {
  height: 16px;
  margin-top: 2px;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: #8b93a7;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cn-sub.is-empty {
  color: #4b5366;
}
/* 口区：每行左侧输入名、右侧输出名，与左右边缘的圆点同一中线 */
.cn-ports {
  margin: 12px -16px 0;
  padding: 6px 0 4px;
  border-top: 1px solid #262c38;
}
.cn-port-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 26px;
  padding: 0 14px;
}
.cn-port-name {
  overflow: hidden;
  max-width: 50%;
  font-size: 12px;
  line-height: 26px;
  color: #a7afbf;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cn-out {
  margin-left: auto;
  text-align: right;
}
.cnode .cn-handle {
  width: 10px;
  height: 10px;
  min-width: 10px;
  min-height: 10px;
  border: 2px solid #1b1f27;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, #ffffff);
  transition: box-shadow 0.12s ease;
}
.cnode .cn-handle:hover {
  box-shadow:
    0 0 0 1px var(--accent),
    0 0 8px var(--accent);
}

/* ---------- 分组框 ---------- */
.cmod {
  position: relative;
  box-sizing: border-box;
  padding: 20px;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  color: #e6e9ef;
  font-family: var(--font-family);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}
.cmod-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
}
.cmod-type {
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  letter-spacing: 0.12em;
  color: #8b93a7;
  font-variant: small-caps;
}
.cmod-title,
.cmod-sub {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cmod-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: #f3f5f8;
}
.cmod-sub {
  font-size: 11px;
  line-height: 16px;
  color: #8b93a7;
}

/* ---------- 属性面板 ---------- */
.sve-panel {
  width: 240px;
  flex-shrink: 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 12px;
}
.sve-panel-title {
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text-primary, #1f2937);
}
.muted {
  color: #8b93a7;
  font-size: 12px;
}
</style>
