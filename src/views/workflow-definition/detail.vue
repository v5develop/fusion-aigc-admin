<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">
        {{ detail?.name || $t('workflowDefinition.list') }}
        <code v-if="detail" style="margin-left: 8px; font-size: 13px">{{ detail.code }}</code>
        <a-tag v-if="detail?.status" :color="statusColor" style="margin-left: 8px">
          {{ statusLabel }}
        </a-tag>
      </h2>
      <a-space>
        <a-button
          v-if="canToggleStatus"
          v-permission="'ai_gateway:config'"
          :danger="detail?.status === 'ENABLED'"
          :loading="statusSaving"
          @click="toggleStatus"
        >
          {{
            detail?.status === 'ENABLED'
              ? $t('workflowDefinition.disable')
              : $t('workflowDefinition.enable')
          }}
        </a-button>
        <a-button @click="router.push('/workflow/definitions')">
          {{ $t('common.back') }}
        </a-button>
      </a-space>
    </div>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="5">
        <a-card
          :title="$t('workflowDefinition.currentVersionTitle')"
          variant="borderless"
          size="small"
        >
          <a-empty
            v-if="!detail?.currentVersion"
            :description="$t('workflowDefinition.noVersions')"
          />
          <div v-else>
            <div class="current-version">
              {{ $t('workflowDefinition.versionItem', { version: detail.currentVersion }) }}
            </div>
            <div v-if="currentVersionMeta" class="muted" style="font-size: 12px">
              {{
                currentVersionMeta.publishedAt
                  ? formatDateTime(currentVersionMeta.publishedAt)
                  : '-'
              }}
              <span v-if="currentVersionMeta.publishedBy">
                · {{ currentVersionMeta.publishedBy }}</span
              >
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 8px; line-height: 1.6">
              {{ $t('workflowDefinition.currentVersionHint') }}
            </div>
          </div>

          <a-collapse v-if="versions.length" ghost style="margin-top: 8px">
            <a-collapse-panel
              key="history"
              :header="$t('workflowDefinition.history', { count: versions.length })"
            >
              <div class="muted" style="font-size: 12px; margin-bottom: 4px">
                {{ $t('workflowDefinition.historyHint') }}
              </div>
              <a-list :data-source="versions" size="small">
                <template #renderItem="{ item }">
                  <a-list-item
                    style="cursor: pointer"
                    :style="
                      viewingVersion === item.version ? { background: 'rgba(22,119,255,0.08)' } : {}
                    "
                    @click="viewVersion(item.version)"
                  >
                    <div style="flex: 1; min-width: 0">
                      <span>{{
                        $t('workflowDefinition.versionItem', { version: item.version })
                      }}</span>
                      <a-tag
                        v-if="item.version === detail?.currentVersion"
                        color="green"
                        size="small"
                        style="margin-left: 6px"
                      >
                        {{ $t('workflowDefinition.latestVersion') }}
                      </a-tag>
                      <div class="muted" style="font-size: 12px">
                        {{ item.publishedAt ? formatDateTime(item.publishedAt) : '-' }}
                        <span v-if="item.publishedBy"> · {{ item.publishedBy }}</span>
                      </div>
                    </div>
                    <a-button
                      v-if="restoreAvailable && item.version !== detail?.currentVersion"
                      v-permission="'ai_gateway:config'"
                      size="small"
                      type="text"
                      class="muted"
                      @click.stop="doRestore(item.version)"
                    >
                      {{ $t('workflowDefinition.restore') }}
                    </a-button>
                  </a-list-item>
                </template>
              </a-list>
            </a-collapse-panel>
          </a-collapse>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="13">
        <a-card
          :title="$t('workflowDefinition.graph')"
          variant="borderless"
          size="small"
          style="margin-bottom: 16px"
        >
          <template #extra>
            <a-space v-if="!isReadonly">
              <span class="muted" style="font-size: 12px">{{
                $t('workflowDefinition.editMode')
              }}</span>
              <a-switch :checked="editMode" size="small" @update:checked="setEditMode" />
            </a-space>
          </template>

          <div v-if="canvasEditable" class="graph-toolbar">
            <a-select
              v-model:value="newStepKind"
              :options="kindOptions.map((k) => ({ label: k, value: k }))"
              :placeholder="$t('workflowDefinition.pickKind')"
              show-search
              size="small"
              style="width: 200px"
            />
            <a-button size="small" type="primary" :disabled="!newStepKind" @click="doAddStep">
              {{ $t('workflowDefinition.addStep') }}
            </a-button>
            <a-popconfirm
              v-if="selectedStepId"
              :title="$t('workflowDefinition.deleteStepConfirm')"
              @confirm="doRemoveStep(selectedStepId)"
            >
              <a-button size="small" danger>{{ $t('workflowDefinition.deleteStep') }}</a-button>
            </a-popconfirm>
            <a-button v-if="selectedEdge" size="small" @click="doDisconnectSelected">
              {{ $t('workflowDefinition.disconnect') }}
            </a-button>
            <a-button v-if="hasLayout" size="small" @click="doResetLayout">
              {{ $t('workflowDefinition.resetLayout') }}
            </a-button>
          </div>
          <div v-if="canvasEditable" class="muted graph-hint">
            {{ $t('workflowDefinition.editHint') }}
          </div>

          <a-alert
            v-if="draftJsonError"
            type="error"
            show-icon
            :message="$t('workflowDefinition.keepLastGraph', { msg: draftJsonError })"
            style="margin-bottom: 12px"
          />
          <a-alert
            v-else-if="!graphResult.ok"
            type="warning"
            show-icon
            :message="graphErrorText"
            style="margin-bottom: 12px"
          />
          <div class="graph-legend">
            <span
              ><i class="legend-line solid"></i
              >{{ $t('workflowDefinition.graphLegendAfter') }}</span
            >
            <span
              ><i class="legend-line dashed"></i
              >{{ $t('workflowDefinition.graphLegendData') }}</span
            >
            <span v-if="!isReadonly && localIssues.length" class="legend-error">
              <i class="legend-box"></i>{{ $t('workflowDefinition.graphLegendError') }}
            </span>
          </div>
          <div class="graph-canvas">
            <VueFlow
              v-if="displayGraph"
              :id="flowId"
              :nodes="flowNodes"
              :edges="flowEdges"
              :nodes-draggable="canvasEditable && draftParse.ok"
              :nodes-connectable="canvasEditable && draftParse.ok"
              :elements-selectable="false"
              :delete-key-code="null"
              :zoom-on-double-click="false"
              fit-view-on-init
              @node-click="onNodeClick"
              @edge-click="onEdgeClick"
              @pane-click="clearSelection"
              @connect="onConnect"
              @node-drag-stop="onNodeDragStop"
            >
              <Background />
              <Controls :show-interactive="false" />
            </VueFlow>
            <div v-if="displayGraph && !displayGraph.nodes.length" class="graph-empty muted">
              {{ $t('workflowDefinition.graphEmpty') }}
            </div>
          </div>
        </a-card>

        <a-card :title="$t('workflowDefinition.editor')" variant="borderless" size="small">
          <template #extra>
            <a-space>
              <a-button v-if="!isReadonly" size="small" @click="formatJson">
                {{ $t('workflowDefinition.formatJson') }}
              </a-button>
              <a-button v-if="isReadonly" size="small" @click="backToEdit">
                {{ $t('workflowDefinition.backToEdit') }}
              </a-button>
              <a-button v-if="isReadonly" size="small" @click="loadToEditor">
                {{ $t('workflowDefinition.loadToEditor') }}
              </a-button>
              <a-button v-if="!isReadonly" :loading="validating" @click="doValidate">
                {{ $t('workflowDefinition.validate') }}
              </a-button>
              <a-button
                v-if="!isReadonly"
                v-permission="'ai_gateway:config'"
                type="primary"
                :loading="publishing || validating"
                @click="doPublish"
              >
                {{ $t('workflowDefinition.save') }}
              </a-button>
            </a-space>
          </template>

          <a-alert
            v-if="isReadonly"
            type="info"
            show-icon
            style="margin-bottom: 8px"
            :message="$t('workflowDefinition.readonlyView', { version: viewingVersion })"
          />
          <a-alert
            v-else-if="validatedText !== null && validatedText !== text"
            type="warning"
            show-icon
            style="margin-bottom: 8px"
            :message="$t('workflowDefinition.stale')"
          />

          <ProCodeEditor
            :model-value="isReadonly ? readonlyText : text"
            language="json"
            :readonly="isReadonly"
            :height="520"
            @update:model-value="onEdit"
          />

          <div v-if="!isReadonly && localIssues.length" style="margin-top: 12px">
            <a-alert
              type="warning"
              show-icon
              :message="$t('workflowDefinition.localIssuesTitle', { count: localIssues.length })"
            >
              <template #description>
                <ul class="error-list">
                  <li
                    v-for="(issue, i) in localIssues"
                    :key="i"
                    :class="{ clickable: !!issue.stepId }"
                    @click="issue.stepId && selectStep(issue.stepId)"
                  >
                    {{ formatIssue(issue) }}
                  </li>
                </ul>
              </template>
            </a-alert>
          </div>

          <div v-if="resultMsg" style="margin-top: 12px">
            <a-alert :type="resultOk ? 'success' : 'error'" show-icon :message="resultMsg" />
            <div v-if="errors.length" style="margin-top: 8px">
              <div style="font-weight: 500; margin-bottom: 4px">
                {{ $t('workflowDefinition.errorList') }}
              </div>
              <ul class="error-list">
                <li
                  v-for="(e, i) in errors"
                  :key="i"
                  style="color: #cf1322"
                  :class="{ clickable: errorStepIds[i].length > 0 }"
                  @click="errorStepIds[i][0] && selectStep(errorStepIds[i][0])"
                >
                  {{ formatValidationError(e) }}
                </li>
              </ul>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="6">
        <a-card
          :title="$t('workflowDefinition.propsTitle')"
          variant="borderless"
          size="small"
          style="margin-bottom: 16px"
        >
          <a-alert
            v-if="selectedStep && !isReadonly && draftJsonError"
            type="warning"
            show-icon
            style="margin-bottom: 8px"
            :message="$t('workflowDefinition.editBlockedInvalidJson')"
          />
          <StepPropsPanel
            :step="selectedStep"
            :schema="selectedSchema"
            :kind-options="kindOptions"
            :disabled="!canvasEditable || !draftParse.ok"
            :issues="selectedIssues"
            :model-group="selectedModelGroup"
            :model-group-tool="selectedModelGroupTool"
            @rename="onRename"
            @set-param="onSetParam"
            @set-field="onSetField"
            @disconnect="onPanelDisconnect"
            @remove="selectedStepId && doRemoveStep(selectedStepId)"
          />
        </a-card>

        <a-card :title="$t('workflowDefinition.stepKinds')" variant="borderless" size="small">
          <div class="muted" style="margin-bottom: 8px; font-size: 12px">
            {{ $t('workflowDefinition.stepKindsHint') }}
          </div>
          <a-space wrap>
            <a-tooltip v-for="k in kindOptions" :key="k" :title="schemaByKind.get(k)?.description">
              <a-tag style="cursor: pointer" color="blue" @click="copy(k)">
                {{ k }}
              </a-tag>
            </a-tooltip>
          </a-space>
          <div v-if="!schemaAvailable" class="muted" style="margin-top: 8px; font-size: 12px">
            {{ $t('workflowDefinition.schemaUnavailable') }}
          </div>
          <a-divider style="margin: 12px 0" />
          <div class="muted" style="font-size: 12px; line-height: 1.7">
            {{ $t('workflowDefinition.structureHint') }}
          </div>
          <a-divider style="margin: 12px 0" />
          <div class="muted" style="font-size: 12px; line-height: 1.7">
            {{ $t('workflowDefinition.contractHint') }}
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import {
  Position,
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeMouseEvent,
  type Node,
  type NodeDragEvent,
  type NodeMouseEvent,
} from '@vue-flow/core';
import { message, Modal } from 'antdv-next';
import { computed, h, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
  formatValidationError,
  getWorkflowDefinition,
  getWorkflowDefinitionVersion,
  isEndpointMissing,
  listWorkflowDefinitionVersions,
  listWorkflowStepKinds,
  listWorkflowStepKindSchemas,
  publishErrorsOf,
  publishWorkflowDefinition,
  restoreWorkflowDefinitionVersion,
  saveWorkflowDefinitionLayout,
  setWorkflowDefinitionStatus,
  validateWorkflowDefinition,
  type WorkflowDefinitionDetail,
  type WorkflowDefinitionVersion,
  type WorkflowStepKindSchema,
  type WorkflowValidationError,
} from '@/api/workflow-definition';
import { listWorkflowTools, type WorkflowToolRow } from '@/api/workflow-tools';
import ProCodeEditor from '@/components/Pro/ProCodeEditor/index.vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';
import { formatDateTime } from '@/utils/helpers';
import {
  addStep,
  buildGraphFromDefinition,
  connectSteps,
  disconnectSteps,
  findStep,
  issuesByStep,
  LAYER_GAP_X,
  modelGroupRefOf,
  parseDefinition,
  pruneLayout,
  removeStep,
  renameInLayout,
  renameStep,
  ROW_GAP_Y,
  sanitizeLayout,
  serializeDefinition,
  setStepField,
  setStepParam,
  stepIdsInError,
  validateDefinitionLocal,
  type DefinitionObject,
  type EditResult,
  type GraphResult,
  type LocalIssue,
  type ModelGroupRef,
  type NodePosition,
  type WorkflowGraph,
} from '@/views/workflow-definition/graph';
import ModelGroupBadge from '@/views/workflow-definition/ModelGroupBadge.vue';
import StepPropsPanel from '@/views/workflow-definition/StepPropsPanel.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const flowId = `workflow-definition-${id}`;
const { fitView } = useVueFlow(flowId);

const TEMPLATE = '{"schema":"workflow-definition/v1","inputs":{},"steps":[],"outputs":{}}';

const detail = ref<WorkflowDefinitionDetail | null>(null);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const stepKinds = ref<string[]>([]);
/** 步骤类型说明；null = 尚未加载或接口缺失（只用名称） */
const kindSchemas = ref<WorkflowStepKindSchema[] | null>(null);

// 新接口（schema / status / restore）是否可用；后端未上线返回 404 时隐藏对应控件
const schemaAvailable = ref(false);
const statusAvailable = ref(false);
const restoreAvailable = ref(false);

/** 草稿 JSON 是唯一数据源：画布与属性面板的修改都写回这里，画布由它推导 */
const text = ref('');
/** 最近一次校验通过时的内容；内容改动后与 text 不一致 => 需重新校验 */
const validatedText = ref<string | null>(null);

const viewingVersion = ref<number | null>(null);
const readonlyText = ref('');
const isReadonly = computed(() => viewingVersion.value !== null);

/** 编辑模式只对草稿开放；查看历史版本时恒为只读 */
const editMode = ref(false);
const canvasEditable = computed(() => editMode.value && !isReadonly.value);

const validating = ref(false);
const publishing = ref(false);
const statusSaving = ref(false);
const resultMsg = ref('');
const resultOk = ref(false);
const errors = ref<WorkflowValidationError[]>([]);

/**
 * 画布坐标：不进版本 JSON，单独用 PUT /layout 保存（拖动不触发发布）。
 * 接口缺失（404）时只留在本页状态里。
 */
const layout = ref<Record<string, NodePosition>>({});
const layoutSaveAvailable = ref(true);
let layoutTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * 模型组 → 工作流工具总览行（网关就绪状态）。每次进入页面加载一次；
 * 接口缺失或失败时为空表，节点与属性面板都不显示徽标。
 */
const toolByModelGroup = ref<Map<string, WorkflowToolRow>>(new Map());

const selectedStepId = ref<string | null>(null);
const selectedEdgeId = ref<string | null>(null);
const newStepKind = ref<string | undefined>(undefined);

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const statusLabel = computed(() => {
  const s = detail.value?.status?.toUpperCase();
  if (s === 'ENABLED') return t('workflowDefinition.statusEnabled');
  if (s === 'DISABLED') return t('workflowDefinition.statusDisabled');
  if (s === 'DRAFT') return t('workflowDefinition.statusDraft');
  return t('workflowDefinition.statusOther', { status: detail.value?.status ?? '' });
});
const statusColor = computed(() => {
  const s = detail.value?.status?.toUpperCase();
  return s === 'ENABLED' ? 'green' : s === 'DISABLED' ? 'default' : 'blue';
});
const canToggleStatus = computed(() => {
  const s = detail.value?.status?.toUpperCase();
  return statusAvailable.value && (s === 'ENABLED' || s === 'DISABLED');
});

// ---------------------------------------------------------------------------
// 定义 → 图
// ---------------------------------------------------------------------------

const draftParse = computed(() => parseDefinition(text.value));
const draftJsonError = computed(() => (draftParse.value.ok ? '' : draftParse.value.message));
/** 草稿最后一次能解析的内容：JSON 写坏时图和属性面板继续显示它 */
const lastGoodDef = ref<DefinitionObject | null>(null);
watch(
  draftParse,
  (p) => {
    if (p.ok) lastGoodDef.value = p.def;
  },
  { immediate: true },
);

const readonlyDef = computed<DefinitionObject | null>(() => {
  const p = parseDefinition(readonlyText.value);
  return p.ok ? p.def : null;
});
const draftDef = computed<DefinitionObject | null>(() =>
  draftParse.value.ok ? draftParse.value.def : lastGoodDef.value,
);
const activeDef = computed(() => (isReadonly.value ? readonlyDef.value : draftDef.value));

const graphResult = computed<GraphResult>(() =>
  activeDef.value
    ? buildGraphFromDefinition(activeDef.value, {
        allowEmpty: !isReadonly.value,
        layout: layout.value,
      })
    : { ok: false, error: 'invalid_json' },
);
/** 草稿最后一次能画出的图（定义有环/步骤缺字段时保留） */
const lastGoodGraph = ref<WorkflowGraph | null>(null);
watch(
  [graphResult, isReadonly],
  ([g, ro]) => {
    if (!ro && g.ok) lastGoodGraph.value = g.graph;
  },
  { immediate: true },
);
const displayGraph = computed<WorkflowGraph | null>(() => {
  if (graphResult.value.ok) return graphResult.value.graph;
  return isReadonly.value ? null : lastGoodGraph.value;
});
const graphErrorText = computed(() => {
  if (graphResult.value.ok) return '';
  return t(`workflowDefinition.graphError.${graphResult.value.error}`);
});
const hasLayout = computed(() => Object.keys(layout.value).length > 0);
const currentVersionMeta = computed(() =>
  versions.value.find((v) => v.version === detail.value?.currentVersion),
);

// ---------------------------------------------------------------------------
// 即时校验（前端预检）与服务端校验结果
// ---------------------------------------------------------------------------

const kindOptions = computed(() => {
  const names = new Set<string>(stepKinds.value);
  (kindSchemas.value ?? []).forEach((k) => names.add(k.kind));
  return [...names].sort();
});
const schemaByKind = computed(
  () => new Map((kindSchemas.value ?? []).map((k) => [k.kind, k] as const)),
);

const localIssues = computed<LocalIssue[]>(() => {
  if (!draftDef.value) return [];
  const kinds = kindSchemas.value ?? (stepKinds.value.length ? stepKinds.value : null);
  return validateDefinitionLocal(draftDef.value, kinds);
});
const localIssueMap = computed(() => issuesByStep(localIssues.value));

function formatIssue(issue: LocalIssue): string {
  const where = issue.stepId ?? (issue.index !== undefined ? `steps[${issue.index}]` : 'outputs');
  return t('workflowDefinition.localIssueLine', {
    where,
    msg: t(`workflowDefinition.localIssue.${issue.code}`, { detail: issue.detail ?? '' }),
  });
}

/** 每条服务端错误点名的步骤 id（与 errors 同序） */
const errorStepIds = computed<string[][]>(() =>
  errors.value.map((e) =>
    draftDef.value ? stepIdsInError(formatValidationError(e), draftDef.value) : [],
  ),
);
const serverErrorSteps = computed(() => new Set(errorStepIds.value.flat()));

// ---------------------------------------------------------------------------
// 画布
// ---------------------------------------------------------------------------

function toolOf(mg?: ModelGroupRef): WorkflowToolRow | undefined {
  return mg?.kind === 'literal' ? toolByModelGroup.value.get(mg.value) : undefined;
}

/**
 * 节点文字；gateway.call 节点在 kind 那一行末尾挂模型组徽标（不新增行，节点尺寸不变）。
 * Vue Flow 默认节点的 label 可以是组件，这里用函数式组件渲染。
 */
function nodeLabel(lines: string[], kindLine: number, mg?: ModelGroupRef) {
  const plain = lines.filter(Boolean).join('\n');
  if (!mg) return plain;
  const tool = toolOf(mg);
  if (mg.kind === 'literal' && !tool) return plain;
  return () =>
    lines
      .map((line, i) =>
        i === kindLine
          ? h('div', [line, h(ModelGroupBadge, { modelGroup: mg, tool, compact: true })])
          : line
            ? h('div', line)
            : null,
      )
      .filter(Boolean);
}

const flowNodes = computed<Node[]>(() => {
  const g = displayGraph.value;
  if (!g) return [];
  return g.nodes.map((n) => {
    const issueCount = isReadonly.value ? 0 : (localIssueMap.value.get(n.id)?.length ?? 0);
    const hasError = issueCount > 0 || (!isReadonly.value && serverErrorSteps.value.has(n.id));
    const selected = selectedStepId.value === n.id;
    return {
      id: n.id,
      position: { x: n.x, y: n.y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: nodeLabel(
          [
            `${n.id}${n.hasCondition ? ' ·' + t('workflowDefinition.graphCondition') : ''}`,
            n.kind,
            n.sources.length ? `← ${n.sources.join(', ')}` : '',
            issueCount ? `⚠ ${t('workflowDefinition.nodeIssueCount', { count: issueCount })}` : '',
          ],
          1,
          n.modelGroup,
        ),
      },
      style: {
        whiteSpace: 'pre-line',
        width: `${LAYER_GAP_X - 40}px`,
        fontSize: '12px',
        textAlign: 'left',
        borderStyle: n.hasCondition ? 'dashed' : 'solid',
        borderWidth: hasError || selected ? '2px' : '1px',
        borderColor: hasError ? '#ff4d4f' : selected ? '#1677ff' : undefined,
        background: hasError ? 'rgba(255,77,79,0.06)' : undefined,
        boxShadow: selected ? '0 0 0 3px rgba(22,119,255,0.18)' : undefined,
      },
    } as Node;
  });
});

const flowEdges = computed<Edge[]>(() => {
  const g = displayGraph.value;
  if (!g) return [];
  return g.edges.map((e) => {
    const selected = selectedEdgeId.value === e.id;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      style: {
        strokeDasharray: e.type === 'data' ? '6 4' : undefined,
        stroke: selected ? '#1677ff' : undefined,
        strokeWidth: selected ? 2.5 : undefined,
      },
    };
  });
});

const selectedEdge = computed(() =>
  canvasEditable.value
    ? displayGraph.value?.edges.find((e) => e.id === selectedEdgeId.value)
    : undefined,
);

function setEditMode(v: unknown) {
  editMode.value = !!v;
  if (!editMode.value) selectedEdgeId.value = null;
}

function clearSelection() {
  selectedStepId.value = null;
  selectedEdgeId.value = null;
}

function selectStep(stepId: string) {
  selectedStepId.value = stepId;
  selectedEdgeId.value = null;
}

function onNodeClick(e: NodeMouseEvent) {
  selectStep(e.node.id);
}

function onEdgeClick(e: EdgeMouseEvent) {
  if (!canvasEditable.value) return;
  selectedEdgeId.value = e.edge.id;
  selectedStepId.value = null;
}

/** 当前草稿；JSON 写坏时拒绝图上的编辑，避免覆盖正在改的文本 */
function editableDef(): DefinitionObject | undefined {
  if (!canvasEditable.value) return undefined;
  const p = parseDefinition(text.value);
  if (!p.ok) {
    message.warning(t('workflowDefinition.editBlockedInvalidJson'));
    return undefined;
  }
  return p.def;
}

function writeDef(def: DefinitionObject) {
  text.value = serializeDefinition(def);
}

function applyEdit(r: EditResult): boolean {
  if (!r.ok) {
    message.warning(t(`workflowDefinition.editError.${r.error}`));
    return false;
  }
  writeDef(r.def);
  return true;
}

function onConnect(c: Connection) {
  const def = editableDef();
  if (!def || !c.source || !c.target) return;
  applyEdit(connectSteps(def, c.source, c.target));
}

function onNodeDragStop(e: NodeDragEvent) {
  if (!canvasEditable.value) return;
  // 一次固定全部节点的坐标，之后增删步骤不会把已摆好的节点重新排版
  const positions: Record<string, NodePosition> = {};
  displayGraph.value?.nodes.forEach((n) => (positions[n.id] = { x: n.x, y: n.y }));
  (e.nodes.length ? e.nodes : [e.node]).forEach((n) => (positions[n.id] = { ...n.position }));
  layout.value = positions;
  scheduleLayoutSave();
}

/** 拖动停下后稍等再存，连续拖动只存一次 */
function scheduleLayoutSave() {
  if (layoutTimer) clearTimeout(layoutTimer);
  layoutTimer = setTimeout(saveLayout, 600);
}

async function saveLayout() {
  layoutTimer = undefined;
  if (!layoutSaveAvailable.value) return;
  const def = draftDef.value;
  const body = def ? pruneLayout(layout.value, def) : layout.value;
  try {
    await saveWorkflowDefinitionLayout(id, body);
  } catch (e) {
    if (isEndpointMissing(e)) {
      layoutSaveAvailable.value = false;
      message.info(t('workflowDefinition.layoutLocalOnly'));
    } else {
      message.error(t('workflowDefinition.layoutSaveFailed'));
    }
  }
}

function doAddStep() {
  const def = editableDef();
  if (!def || !newStepKind.value) return;
  const r = addStep(def, newStepKind.value);
  if (hasLayout.value) {
    // 已有手摆坐标时，新节点放在选中节点右侧（或最下方），避免和已摆好的节点重叠
    const nodes = displayGraph.value?.nodes ?? [];
    const sel = nodes.find((n) => n.id === selectedStepId.value);
    layout.value = {
      ...layout.value,
      [r.id]: sel
        ? { x: sel.x + LAYER_GAP_X, y: sel.y }
        : { x: 0, y: nodes.reduce((m, n) => Math.max(m, n.y + ROW_GAP_Y), 0) },
    };
    scheduleLayoutSave();
  }
  writeDef(r.def);
  selectStep(r.id);
}

function doRemoveStep(stepId: string) {
  const def = editableDef();
  if (!def) return;
  writeDef(removeStep(def, stepId));
  if (layout.value[stepId]) {
    const next = { ...layout.value };
    delete next[stepId];
    layout.value = next;
    scheduleLayoutSave();
  }
  clearSelection();
}

function doDisconnectSelected() {
  const edge = selectedEdge.value;
  const def = editableDef();
  if (!edge || !def) return;
  if (applyEdit(disconnectSteps(def, edge.source, edge.target))) selectedEdgeId.value = null;
}

function doResetLayout() {
  layout.value = {};
  scheduleLayoutSave();
  nextTick(() => fitView());
}

// ---------------------------------------------------------------------------
// 属性面板
// ---------------------------------------------------------------------------

const selectedStep = computed(() =>
  selectedStepId.value && activeDef.value
    ? findStep(activeDef.value, selectedStepId.value)
    : undefined,
);
const selectedSchema = computed(() => {
  const kind = selectedStep.value?.kind;
  return typeof kind === 'string' ? schemaByKind.value.get(kind) : undefined;
});
const selectedModelGroup = computed(() => modelGroupRefOf(selectedStep.value));
const selectedModelGroupTool = computed(() => toolOf(selectedModelGroup.value));
const selectedIssues = computed(() =>
  !isReadonly.value && selectedStepId.value
    ? (localIssueMap.value.get(selectedStepId.value) ?? []).map(formatIssue)
    : [],
);

function onRename(newId: string) {
  const def = editableDef();
  if (!def || !selectedStepId.value) return;
  const oldId = selectedStepId.value;
  if (!applyEdit(renameStep(def, oldId, newId))) return;
  selectedStepId.value = newId.trim();
  if (layout.value[oldId]) {
    layout.value = renameInLayout(layout.value, oldId, newId.trim());
    scheduleLayoutSave();
  }
}

function onSetParam(name: string, value: unknown) {
  const def = editableDef();
  if (!def || !selectedStepId.value) return;
  applyEdit(setStepParam(def, selectedStepId.value, name, value));
}

function onSetField(field: string, value: unknown) {
  const def = editableDef();
  if (!def || !selectedStepId.value) return;
  applyEdit(setStepField(def, selectedStepId.value, field, value));
}

function onPanelDisconnect(source: string) {
  const def = editableDef();
  if (!def || !selectedStepId.value) return;
  applyEdit(disconnectSteps(def, source, selectedStepId.value));
}

// ---------------------------------------------------------------------------
// JSON 编辑、校验、发布
// ---------------------------------------------------------------------------

function pretty(v: unknown): string {
  if (v === null || v === undefined) return pretty(JSON.parse(TEMPLATE));
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  return JSON.stringify(v, null, 2);
}

function parseText(): unknown | undefined {
  try {
    return JSON.parse(text.value);
  } catch (e) {
    resultOk.value = false;
    resultMsg.value = t('workflowDefinition.invalidJson', { msg: (e as Error).message });
    errors.value = [];
    return undefined;
  }
}

function onEdit(v: string) {
  text.value = v;
}

function formatJson() {
  try {
    text.value = JSON.stringify(JSON.parse(text.value), null, 2);
  } catch (e) {
    resultOk.value = false;
    resultMsg.value = t('workflowDefinition.invalidJson', { msg: (e as Error).message });
    errors.value = [];
  }
}

/** 服务端校验；返回是否通过 */
async function doValidate(): Promise<boolean> {
  const def = parseText();
  if (def === undefined) return false;
  validating.value = true;
  try {
    const snapshot = text.value;
    const res = await validateWorkflowDefinition(id, def);
    errors.value = res.errors ?? [];
    resultOk.value = !!res.valid;
    if (res.valid) {
      validatedText.value = snapshot;
      resultMsg.value = t('workflowDefinition.validateOk');
    } else {
      validatedText.value = null;
      resultMsg.value = t('workflowDefinition.validateFailed', { count: errors.value.length });
    }
    return !!res.valid;
  } catch {
    return false;
  } finally {
    validating.value = false;
  }
}

/** 发布前总是先跑一次服务端校验（最终把关），通过后再确认发布 */
async function doPublish() {
  const ok =
    validatedText.value !== null && validatedText.value === text.value ? true : await doValidate();
  if (!ok) {
    message.warning(t('workflowDefinition.mustValidate'));
    return;
  }
  const def = parseText();
  if (def === undefined) return;
  Modal.confirm({
    title: t('workflowDefinition.saveConfirm', {
      version: (detail.value?.currentVersion ?? 0) + 1,
    }),
    async onOk() {
      publishing.value = true;
      try {
        const res = await publishWorkflowDefinition(id, def);
        message.success(t('workflowDefinition.publishOk', { version: res.version }));
        resultOk.value = true;
        resultMsg.value = t('workflowDefinition.publishOk', { version: res.version });
        errors.value = [];
        await refreshMeta();
      } catch (e) {
        const errs = publishErrorsOf(e);
        if (errs) {
          errors.value = errs;
          resultOk.value = false;
          resultMsg.value = t('workflowDefinition.publishFailed', { count: errs.length });
          validatedText.value = null;
        }
      } finally {
        publishing.value = false;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// 版本、恢复、启停
// ---------------------------------------------------------------------------

async function viewVersion(version: number) {
  const content = await getWorkflowDefinitionVersion(id, version);
  readonlyText.value = pretty(content);
  viewingVersion.value = version;
  clearSelection();
  nextTick(() => fitView());
}

function backToEdit() {
  viewingVersion.value = null;
  clearSelection();
  nextTick(() => fitView());
}

function loadToEditor() {
  text.value = readonlyText.value;
  validatedText.value = null;
  viewingVersion.value = null;
  clearSelection();
  nextTick(() => fitView());
}

function actionFailed(e: unknown) {
  const msg = e instanceof Error && e.message ? e.message : t('workflowDefinition.actionFailed');
  message.error(msg);
}

function doRestore(version: number) {
  Modal.confirm({
    title: t('workflowDefinition.restoreConfirm', { version }),
    async onOk() {
      try {
        const res = await restoreWorkflowDefinitionVersion(id, version);
        message.success(
          t('workflowDefinition.restoreOk', { from: version, version: res?.version }),
        );
        await refreshMeta();
      } catch (e) {
        if (isEndpointMissing(e)) {
          restoreAvailable.value = false;
          message.warning(t('workflowDefinition.endpointMissing'));
        } else {
          actionFailed(e);
        }
      }
    },
  });
}

function toggleStatus() {
  const next = detail.value?.status?.toUpperCase() === 'ENABLED' ? 'DISABLED' : 'ENABLED';
  Modal.confirm({
    title:
      next === 'DISABLED'
        ? t('workflowDefinition.disableConfirm')
        : t('workflowDefinition.enableConfirm'),
    async onOk() {
      statusSaving.value = true;
      try {
        await setWorkflowDefinitionStatus(id, next);
        message.success(t('workflowDefinition.statusSaved'));
        await refreshMeta();
      } catch (e) {
        if (isEndpointMissing(e)) {
          statusAvailable.value = false;
          message.warning(t('workflowDefinition.endpointMissing'));
        } else {
          actionFailed(e);
        }
      } finally {
        statusSaving.value = false;
      }
    },
  });
}

async function copy(k: string) {
  try {
    await navigator.clipboard.writeText(k);
    message.success(t('workflowDefinition.copied'));
  } catch {
    // 剪贴板不可用时静默
  }
}

async function refreshMeta() {
  const [d, vs] = await Promise.all([
    getWorkflowDefinition(id),
    listWorkflowDefinitionVersions(id),
  ]);
  detail.value = d;
  versions.value = [...vs].sort((a, b) => b.version - a.version);
}

/** 步骤类型说明接口兼作新接口探针：404 = 后端尚未上线，只用名称并隐藏恢复/启停 */
async function loadKindSchemas() {
  try {
    kindSchemas.value = await listWorkflowStepKindSchemas();
    schemaAvailable.value = true;
    statusAvailable.value = true;
    restoreAvailable.value = true;
  } catch (e) {
    kindSchemas.value = null;
    schemaAvailable.value = false;
    if (isEndpointMissing(e)) {
      statusAvailable.value = false;
      restoreAvailable.value = false;
    }
  }
}

/** 工作流工具总览：只用于就绪徽标，失败（含 404）静默为空表，不影响页面 */
async function loadWorkflowTools() {
  try {
    const rows = await listWorkflowTools();
    toolByModelGroup.value = new Map(rows.map((r) => [r.modelGroup, r] as const));
  } catch {
    toolByModelGroup.value = new Map();
  }
}

onMounted(async () => {
  void loadWorkflowTools();
  try {
    await refreshMeta();
    text.value = pretty(detail.value?.content ?? null);
    layout.value = sanitizeLayout(detail.value?.layout);
    const [names] = await Promise.all([listWorkflowStepKinds(), loadKindSchemas()]);
    stepKinds.value = names;
  } catch {
    message.error(t('workflowDefinition.loadFailed'));
  }
});
</script>

<style scoped>
.graph-canvas {
  position: relative;
  height: 420px;
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 8px;
  overflow: hidden;
}
.graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  pointer-events: none;
}
.graph-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}
.graph-hint {
  font-size: 12px;
  margin-bottom: 8px;
}
.graph-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}
.legend-line {
  display: inline-block;
  width: 24px;
  border-top: 2px solid currentColor;
  vertical-align: middle;
  margin-right: 6px;
}
.legend-line.dashed {
  border-top-style: dashed;
}
.legend-error {
  color: #ff4d4f;
}
.legend-box {
  display: inline-block;
  width: 12px;
  height: 10px;
  border: 2px solid #ff4d4f;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 6px;
}
.current-version {
  font-size: 20px;
  font-weight: 600;
}
.muted {
  color: var(--color-text-tertiary, #999);
}
.error-list {
  margin: 0;
  padding-left: 20px;
}
.error-list .clickable {
  cursor: pointer;
  text-decoration: underline dotted;
}
</style>
