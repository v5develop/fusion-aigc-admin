<template>
  <div class="flow-editor">
    <div class="fe-header">
      <a-space>
        <a-button @click="goBack">返回</a-button>
        <span class="fe-title">{{ flowName }} · v{{ version?.versionNo }}</span>
        <a-tag :color="version?.status === 'published' ? 'green' : version?.status === 'archived' ? 'default' : 'blue'">
          {{ vStatusLabel(version?.status) }}
        </a-tag>
        <a-tag v-if="!isDraft" color="orange">只读（非草稿）</a-tag>
      </a-space>
      <a-space>
        <span class="muted">结算</span>
        <a-select v-model:value="settlementType" :options="settlementOptions" size="small" style="width: 170px" :disabled="!isDraft" />
        <a-input v-model:value="changelog" size="small" placeholder="变更说明" style="width: 180px" :disabled="!isDraft" />
        <a-button :loading="saving" :disabled="!isDraft" @click="save(false)">保存草稿</a-button>
        <a-button type="primary" :loading="saving" :disabled="!isDraft" @click="save(true)">保存并发布</a-button>
      </a-space>
    </div>

    <div class="fe-body">
      <!-- 节点面板 -->
      <div class="fe-palette">
        <div class="palette-title">节点面板（拖到画布）</div>
        <div class="palette-hint">按 kind 分组；拖拽添加。节点只描述「跑什么」，不含计费。</div>
        <div
          v-for="m in palette"
          :key="m.id"
          class="palette-node"
          :style="{ borderColor: kindColorHex(m.kind) }"
          draggable="true"
          @dragstart="onDragStart($event, m)"
        >
          <a-tag :color="kindColor(m.kind)" size="small" :title="m.kind">{{ stepKindLabel(m.kind) }}</a-tag>
          <span class="pn-code" :title="m.code">{{ m.name || m.code }}</span>
          <span v-if="m.mode != null" class="pn-mode">#{{ m.mode }}</span>
        </div>
        <a-empty v-if="!palette.length" description="先在「节点 Node」建节点" :image-style="{ height: '40px' }" />
      </div>

      <!-- 画布 -->
      <div class="fe-canvas" @drop="onDrop" @dragover.prevent @dragenter.prevent>
        <VueFlow
          :id="flowKey"
          :default-viewport="{ zoom: 0.9 }"
          :min-zoom="0.2"
          :max-zoom="2"
          fit-view-on-init
        >
          <Background :gap="16" />
          <Controls />
          <template #node-mode="{ data }">
            <div class="mode-node" :style="{ borderColor: kindColorHex(data.kind) }">
              <div class="mn-head">
                <a-tag :color="kindColor(data.kind)" size="small" :title="data.kind">{{ stepKindLabel(data.kind) }}</a-tag>
                <span class="mn-code" :title="data.code">{{ data.label || data.name || data.code }}</span>
              </div>
              <div class="mn-meta">
                <span v-if="data.mode != null">mode #{{ data.mode }}</span>
                <span v-if="data.handler" :title="data.handler">处理器 {{ data.name || data.handler }}</span>
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
          <a-form-item label="编码 Code"><a-input :value="selectedNode.data.code" disabled /></a-form-item>
          <a-form-item label="类型 Kind"><a-input :value="selectedNode.data.kind" disabled /></a-form-item>
          <a-form-item v-if="selectedNode.data.mode != null" label="Mode"><a-input :value="String(selectedNode.data.mode)" disabled /></a-form-item>
          <a-form-item v-if="selectedNode.data.handler" label="Handler"><a-input :value="selectedNode.data.handler" disabled /></a-form-item>
          <a-form-item label="显示名（可选）">
            <a-input v-model:value="selectedNode.data.label" :disabled="!isDraft" placeholder="节点显示名" />
          </a-form-item>
          <a-form-item label="绑定生成模型 modelId（AIGC 步，可空=默认）">
            <a-select
              v-model:value="selectedNode.data.modelId"
              :options="modelOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              :disabled="!isDraft"
              placeholder="选择生成模型"
            />
          </a-form-item>
          <a-form-item v-if="selectedNode.data.kind === 'AIGC'" label="可变模型步 variantGroup（可空）">
            <a-input
              v-model:value="selectedNode.data.variantGroup"
              :disabled="!isDraft"
              placeholder="填 stepCode 分组名（如 imageGen）"
            />
            <div class="muted" style="margin-top: 4px">
              非空=该步按<b>提交模型</b>选档：运行时从 offer 同 stepCode 的多档组件命中一档，覆写本步 mode+modelId（上面 Mode 作占位默认档）。
            </div>
          </a-form-item>
          <a-divider style="margin: 8px 0" />
          <a-button danger size="small" :disabled="!isDraft" @click="removeSelected">删除该节点</a-button>
          <a-alert type="info" show-icon style="margin-top: 12px" message="计费类型不在此配置——计费随计费场景，在计费/offer 层管理。" />
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import { VueFlow, useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { getModelOptions } from '@/api/model'
import {
  getFlowDetail, listEnabledModes, updateFlowDraft, publishFlowVersion,
  type Mode, type ModeFlowVersion,
} from '@/api/mode'
import { stepKindLabel } from '@/utils/terms'

const route = useRoute()
const router = useRouter()
const flowId = Number(route.params.flowId)
const versionId = Number(route.query.versionId)
const flowKey = `flow-${flowId}-${versionId}`

const {
  onConnect, addEdges, addNodes, screenToFlowCoordinate, toObject, setNodes, setEdges,
  findNode, removeNodes, onNodeClick, getNodes,
} = useVueFlow(flowKey)

const flowName = ref('')
const flowCode = ref('')
const version = ref<ModeFlowVersion | null>(null)
const isDraft = computed(() => version.value?.status === 'draft')
const settlementType = ref('ALL_OR_NOTHING')
const changelog = ref('')
const saving = ref(false)
const settlementOptions = [
  { label: 'ALL_OR_NOTHING（整单）', value: 'ALL_OR_NOTHING' },
  { label: 'PER_CHILD（逐子）', value: 'PER_CHILD' },
]

const palette = ref<Mode[]>([])
const modelOptions = ref<{ label: string; value: number }[]>([])
const modelMap = ref<Record<number, string>>({})
function modelName(id?: number) { return id ? modelMap.value[id] || `#${id}` : '' }

const selectedNodeId = ref<string>()
const selectedNode = computed<Node | undefined>(() => (selectedNodeId.value ? findNode(selectedNodeId.value) : undefined))

function kindColor(k?: string) {
  return ({ LOCAL: 'blue', AIGC: 'green', VOLC: 'gold', GENERATION: 'purple' } as Record<string, string>)[k || ''] || 'default'
}
function kindColorHex(k?: string) {
  return ({ LOCAL: '#1677ff', AIGC: '#52c41a', VOLC: '#faad14', GENERATION: '#722ed1' } as Record<string, string>)[k || ''] || '#d9d9d9'
}
function vStatusLabel(s?: string) { return s === 'published' ? '已发布' : s === 'archived' ? '已归档' : '草稿' }

let idc = 0
function nid() { return `n${Date.now()}_${idc++}` }

onConnect((params) => addEdges([{ ...params, id: `e${Date.now()}_${idc++}` }]))
onNodeClick(({ node }) => (selectedNodeId.value = node.id))

function onDragStart(ev: DragEvent, m: Mode) {
  ev.dataTransfer?.setData('application/mode', String(m.id))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}
function onDrop(ev: DragEvent) {
  if (!isDraft.value) return
  const mid = ev.dataTransfer?.getData('application/mode')
  if (!mid) return
  const m = palette.value.find((x) => x.id === Number(mid))
  if (!m) return
  const position = screenToFlowCoordinate({ x: ev.clientX, y: ev.clientY })
  addNodes([
    {
      id: nid(),
      type: 'mode',
      position,
      data: { modeId: m.id, code: m.code, name: m.name, kind: m.kind, mode: m.mode ?? null, handler: m.handler || null, modelId: undefined, label: '' },
    } as Node,
  ])
}
function removeSelected() {
  if (selectedNodeId.value) {
    removeNodes([selectedNodeId.value])
    selectedNodeId.value = undefined
  }
}

// 装配 graph → OrchestrationPlan 兼容 plan
function assemble() {
  const obj = toObject()
  const ns = obj.nodes as Node[]
  const es = obj.edges as Edge[]
  const inDeg: Record<string, number> = {}
  const out: Record<string, string[]> = {}
  ns.forEach((n) => { inDeg[n.id] = 0; out[n.id] = [] })
  es.forEach((e) => { if (out[e.source]) out[e.source].push(e.target); if (inDeg[e.target] != null) inDeg[e.target]++ })
  const branching = ns.some((n) => (out[n.id] || []).length > 1) || Object.values(inDeg).some((d) => d > 1)
  // Kahn 拓扑排序（线性主链）
  const indeg = { ...inDeg }
  const q = ns.filter((n) => indeg[n.id] === 0).map((n) => n.id)
  const order: string[] = []
  while (q.length) {
    const id = q.shift() as string
    order.push(id)
    ;(out[id] || []).forEach((t) => { indeg[t]--; if (indeg[t] === 0) q.push(t) })
  }
  // 环检测：Kahn 排不完即有环（循环依赖）→ 拒绝。原「兜底补齐」会产出错误线性 plan 且仍可发布。
  if (order.length < ns.length) {
    throw new Error('流程存在环（循环依赖），请修正节点连线后再保存')
  }
  const byId = Object.fromEntries(ns.map((n) => [n.id, n]))
  const steps = order.map((id) => {
    const d = (byId[id] as Node).data as Record<string, unknown>
    return {
      code: d.code,
      kind: d.kind,
      handler: d.handler || undefined,
      mode: d.mode ?? undefined,
      modelId: d.modelId ?? undefined,
      variantGroup: (d.variantGroup as string) || undefined, // 可变模型步：非空=按提交模型选档
      // costType 不在此——计费随计费场景，真实用户提交时由计费场景回填
    }
  })
  const topology = branching ? 'FAN_OUT' : 'PIPELINE'
  const planJson = { type: flowCode.value, topology, settlementType: settlementType.value, steps }
  return { graphJson: obj, planJson, topology }
}

async function save(publish: boolean) {
  if (!isDraft.value) return
  if (getNodes.value.length === 0) {
    message.warning('画布为空，先拖入节点')
    return
  }
  let assembled: ReturnType<typeof assemble>
  try {
    assembled = assemble()
  } catch (e) {
    // 结构性错误（如有环）：本地校验，单独提示，不进入保存
    message.error((e as Error)?.message || '流程结构非法，无法保存')
    return
  }
  const { graphJson, planJson, topology } = assembled
  saving.value = true
  try {
    await updateFlowDraft(versionId, {
      graphJson,
      planJson,
      topology,
      settlementType: settlementType.value,
      changelog: changelog.value || undefined,
    })
    if (publish) await publishFlowVersion(versionId)
    message.success(publish ? '已保存并发布' : '已保存草稿')
    if (publish) goBack()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/mode/flows')
}

async function load() {
  try {
    const [detail, modes, models] = await Promise.all([getFlowDetail(flowId), listEnabledModes(), getModelOptions()])
    flowName.value = detail.flow.name
    flowCode.value = detail.flow.code
    version.value = detail.versions.find((v) => v.id === versionId) || null
    settlementType.value = version.value?.settlementType || 'ALL_OR_NOTHING'
    palette.value = modes || []
    modelOptions.value = (models || []).map((m: { id: number; name: string; code?: string }) => ({ label: m.code ? `${m.name} (${m.code})` : m.name, value: m.id }))
    const map: Record<number, string> = {}
    ;(models || []).forEach((m: { id: number; name: string }) => (map[m.id] = m.name))
    modelMap.value = map
    // 载入已存 graph
    const g = version.value?.graphJson as { nodes?: Node[]; edges?: Edge[] } | undefined
    if (g && (g.nodes || g.edges)) {
      setNodes((g.nodes || []).map((n) => ({ ...n, type: n.type || 'mode' })))
      setEdges(g.edges || [])
    }
  } catch {
    message.error('加载失败')
  }
}

// markRaw 无需——组件不放入响应式；直接挂载后加载
onMounted(load)
</script>

<style scoped>
.flow-editor { display: flex; flex-direction: column; height: 100%; }
.fe-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid var(--color-border, #f0f0f0);
}
.fe-title { font-size: 15px; font-weight: 600; }
.muted { color: var(--color-text-tertiary, #999); font-size: 12px; }
.fe-body { display: grid; grid-template-columns: 220px 1fr 300px; flex: 1; min-height: 0; }
.fe-palette { border-right: 1px solid var(--color-border, #f0f0f0); padding: 12px; overflow-y: auto; }
.fe-canvas { position: relative; min-height: 0; }
.fe-props { border-left: 1px solid var(--color-border, #f0f0f0); padding: 12px; overflow-y: auto; }
.palette-title { font-weight: 600; margin-bottom: 6px; }
.palette-hint { font-size: 12px; color: var(--color-text-tertiary, #999); margin-bottom: 10px; }
.props-empty { color: var(--color-text-tertiary, #999); font-size: 13px; padding: 24px 0; text-align: center; }
.palette-node {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; margin-bottom: 8px;
  border: 1px solid #d9d9d9; border-left-width: 3px; border-radius: 6px;
  cursor: grab; background: var(--color-bg-container, #fff);
}
.pn-code { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pn-mode { font-size: 11px; color: #999; margin-left: auto; }
.mode-node {
  min-width: 150px; padding: 8px 10px;
  background: var(--color-bg-container, #fff);
  border: 1px solid #d9d9d9; border-left-width: 3px; border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.mn-head { display: flex; align-items: center; gap: 6px; }
.mn-code { font-size: 13px; font-weight: 600; }
.mn-meta { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; font-size: 11px; color: #888; }
</style>
