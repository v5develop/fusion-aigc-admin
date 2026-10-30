<template>
  <div ref="rootRef" class="wd-editor">
    <!-- 顶部工具栏 -->
    <div class="wd-toolbar">
      <div class="wd-title-block">
        <a-button size="small" @click="router.push('/workflow/definitions')">
          {{ $t('common.back') }}
        </a-button>
        <span class="wd-name" :title="detail?.name">
          {{ detail?.name || $t('workflowDefinition.list') }}
        </span>
        <code v-if="detail" class="wd-code">{{ detail.code }}</code>
        <a-tag v-if="detail?.status" :color="statusColor">{{ statusLabel }}</a-tag>
        <a-tag v-if="detail?.currentVersion" color="geekblue">
          {{ $t('workflowDefinition.currentVersionTag', { version: detail.currentVersion }) }}
        </a-tag>
        <a-tag v-else>{{ $t('workflowDefinition.noVersion') }}</a-tag>
        <span v-if="dirty && !isReadonly" class="wd-dirty">
          <i class="dot"></i>{{ $t('workflowDefinition.dirty') }}
        </span>
      </div>
      <a-space wrap>
        <a-button :disabled="isReadonly" :loading="validating" @click="onValidateClick">
          {{ $t('workflowDefinition.validate') }}
        </a-button>
        <a-button
          v-permission="'ai_gateway:config'"
          type="primary"
          :disabled="isReadonly"
          :loading="publishing || validating"
          @click="doPublish"
        >
          {{ $t('workflowDefinition.saveAndPublish') }}
        </a-button>
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
      </a-space>
    </div>

    <a-alert
      v-if="isReadonly"
      type="info"
      show-icon
      class="wd-banner"
      :message="$t('workflowDefinition.readonlyView', { version: viewingVersion })"
    >
      <template #action>
        <a-space>
          <a-button size="small" @click="backToEdit">
            {{ $t('workflowDefinition.backToEdit') }}
          </a-button>
          <a-button size="small" type="primary" @click="loadToEditor">
            {{ $t('workflowDefinition.loadToEditor') }}
          </a-button>
        </a-space>
      </template>
    </a-alert>
    <a-alert
      v-else-if="draftJsonError"
      type="error"
      show-icon
      class="wd-banner"
      :message="$t('workflowDefinition.keepLastGraph', { msg: draftJsonError })"
    />

    <a-tabs v-model:active-key="tab" class="wd-tabs" size="small">
      <a-tab-pane key="canvas" :tab="$t('workflowDefinition.tabCanvas')" />
      <a-tab-pane key="io" :tab="$t('workflowDefinition.tabIo')" />
      <a-tab-pane key="json" :tab="$t('workflowDefinition.tabJson')" />
      <a-tab-pane key="versions" :tab="$t('workflowDefinition.tabVersions')" />
    </a-tabs>

    <div class="wd-body">
      <!-- 编排：节点面板 / 画布 / 属性 -->
      <div v-show="tab === 'canvas'" class="wd-canvas-tab">
        <div class="wd-panes">
          <aside class="wd-palette" :class="{ disabled: paletteDisabled }">
            <a-tabs
              v-model:active-key="paletteTab"
              size="small"
              class="palette-tabs"
              :items="paletteTabItems"
            />
            <div class="pane-hint">
              {{
                paletteDisabled
                  ? $t('workflowDefinition.paletteDisabled')
                  : paletteTab === 'models'
                    ? $t('workflowDefinition.catalog.modelsHint')
                    : paletteTab === 'prompts'
                      ? $t('workflowDefinition.catalog.promptsHint')
                      : $t('workflowDefinition.paletteHint')
              }}
            </div>

            <!-- 步骤类型 -->
            <template v-if="paletteTab === 'steps'">
              <a-input
                v-model:value="paletteSearch"
                size="small"
                allow-clear
                :placeholder="$t('workflowDefinition.paletteSearch')"
                style="margin-bottom: 8px"
              />
              <div v-for="g in paletteGroups" :key="g.group" class="palette-group">
                <div class="palette-group-title">{{ $t(`workflowDefinition.kindGroup.${g.group}`) }}</div>
                <div
                  v-for="item in g.items"
                  :key="item.kind"
                  class="palette-item"
                  :style="{ borderLeftColor: KIND_GROUP_COLOR[g.group] }"
                  :draggable="!paletteDisabled"
                  :title="item.kind"
                  @dragstart="onPaletteDragStart($event, item.kind)"
                  @click="!paletteDisabled && doAddStep(item.kind)"
                >
                  <div class="pi-name">{{ item.name }}</div>
                  <div v-if="item.description" class="pi-desc">{{ item.description }}</div>
                </div>
              </div>
              <a-empty
                v-if="!paletteGroups.length"
                :image-style="{ height: '36px' }"
                :description="$t('workflowDefinition.paletteEmpty')"
              />
              <div v-if="!schemaAvailable" class="pane-hint" style="margin-top: 8px">
                {{ $t('workflowDefinition.schemaUnavailable') }}
              </div>
            </template>

            <!-- 模型组：按操作分组，拖出即 gateway.call -->
            <template v-else-if="paletteTab === 'models'">
              <div class="catalog-bar">
                <a-input
                  v-model:value="modelSearch"
                  size="small"
                  allow-clear
                  :placeholder="$t('workflowDefinition.catalog.searchModels')"
                />
                <a :href="manageModelGroupsHref" target="_blank" rel="noopener" class="manage-link">
                  {{ $t('workflowDefinition.catalog.manage') }}
                </a>
              </div>
              <a-spin v-if="modelGroupsState === 'loading'" size="small" class="catalog-spin" />
              <div v-else-if="modelGroupsState === 'error'" class="catalog-error">
                {{ $t('workflowDefinition.catalog.loadFailed') }}
                <a-button size="small" type="link" @click="ensureModelGroups(true)">
                  {{ $t('workflowDefinition.catalog.retry') }}
                </a-button>
              </div>
              <template v-else>
                <div v-for="g in modelPaletteGroups" :key="g.op" class="palette-group">
                  <div class="palette-group-title">
                    {{ $t(operationLabelKey(g.op)) }}
                    <code v-if="g.op !== OTHER_OPERATION" class="op-code">{{ g.op }}</code>
                  </div>
                  <div
                    v-for="item in g.items"
                    :key="g.op + ':' + item.code"
                    class="palette-item"
                    :class="{ off: !item.enabled }"
                    :style="{ borderLeftColor: KIND_GROUP_COLOR.generate }"
                    :draggable="!paletteDisabled"
                    :title="item.code"
                    @dragstart="onPaletteDragStart($event, GATEWAY_CALL_KIND, modelDropParams(item, g.op))"
                    @click="
                      !paletteDisabled && doAddStep(GATEWAY_CALL_KIND, modelDropParams(item, g.op))
                    "
                  >
                    <div class="pi-row">
                      <span class="pi-name">{{ item.name || item.code }}</span>
                      <a-tag
                        :color="READINESS_COLOR[readinessOf(item.tool)]"
                        class="pi-tag"
                      >
                        {{ $t(READINESS_LABEL_KEY[readinessOf(item.tool)]) }}
                      </a-tag>
                    </div>
                    <code class="pi-code">{{ item.code }}</code>
                    <div v-if="shortPriceText(item.tool, t)" class="pi-desc">
                      {{ shortPriceText(item.tool, t) }}
                    </div>
                  </div>
                </div>
                <a-empty
                  v-if="!modelPaletteGroups.length"
                  :image-style="{ height: '36px' }"
                  :description="$t('workflowDefinition.catalog.emptyModels')"
                />
              </template>
            </template>

            <!-- 提示词模板：拖出即 prompt.optimize -->
            <template v-else>
              <div class="catalog-bar">
                <a-input
                  v-model:value="promptSearch"
                  size="small"
                  allow-clear
                  :placeholder="$t('workflowDefinition.catalog.searchPrompts')"
                />
                <a :href="managePromptsHref" target="_blank" rel="noopener" class="manage-link">
                  {{ $t('workflowDefinition.catalog.manage') }}
                </a>
              </div>
              <a-spin v-if="promptsState === 'loading'" size="small" class="catalog-spin" />
              <div v-else-if="promptsState === 'error'" class="catalog-error">
                {{ $t('workflowDefinition.catalog.loadFailed') }}
                <a-button size="small" type="link" @click="ensurePrompts(true)">
                  {{ $t('workflowDefinition.catalog.retry') }}
                </a-button>
              </div>
              <template v-else>
                <div
                  v-for="item in promptPaletteItems"
                  :key="item.code"
                  class="palette-item"
                  :style="{ borderLeftColor: KIND_GROUP_COLOR.prompt }"
                  :draggable="!paletteDisabled"
                  :title="item.description || item.code"
                  @dragstart="onPaletteDragStart($event, PROMPT_DROP_KIND, { templateCode: item.code })"
                  @click="
                    !paletteDisabled && doAddStep(PROMPT_DROP_KIND, { templateCode: item.code })
                  "
                >
                  <div class="pi-name">{{ item.name }}</div>
                  <code class="pi-code">{{ item.code }}</code>
                </div>
                <a-empty
                  v-if="!promptPaletteItems.length"
                  :image-style="{ height: '36px' }"
                  :description="$t('workflowDefinition.catalog.emptyPrompts')"
                />
                <div class="pane-hint" style="margin-top: 8px">
                  {{ $t('workflowDefinition.catalog.fileOnlyHint') }}
                </div>
              </template>
            </template>
          </aside>

          <section
            ref="canvasRef"
            class="wd-canvas"
            :class="{ readonly: !canvasEditable, connecting }"
            @dragover="onCanvasDragOver"
            @drop="onCanvasDrop"
          >
            <div class="canvas-overlay">
              <div class="graph-legend">
                <span><i class="legend-line solid"></i>{{ $t('workflowDefinition.graphLegendAfter') }}</span>
                <span><i class="legend-line dashed"></i>{{ $t('workflowDefinition.graphLegendData') }}</span>
                <span v-if="!isReadonly && localIssues.length" class="legend-error">
                  <i class="legend-box"></i>{{ $t('workflowDefinition.graphLegendError') }}
                </span>
              </div>
              <div class="canvas-tools">
                <a-tooltip :title="$t('workflowDefinition.undo') + ' (Ctrl/⌘+Z)'">
                  <a-button size="small" type="text" :disabled="!canUndo" @click="undo">
                    <UndoOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="$t('workflowDefinition.redo') + ' (Ctrl/⌘+Shift+Z)'">
                  <a-button size="small" type="text" :disabled="!canRedo" @click="redo">
                    <RedoOutlined />
                  </a-button>
                </a-tooltip>
                <span class="tools-sep"></span>
                <a-tooltip :title="$t('workflowDefinition.zoomOut')">
                  <a-button size="small" type="text" @click="zoomOut()"><ZoomOutOutlined /></a-button>
                </a-tooltip>
                <span class="zoom-text">{{ zoomPercent }}%</span>
                <a-tooltip :title="$t('workflowDefinition.zoomIn')">
                  <a-button size="small" type="text" @click="zoomIn()"><ZoomInOutlined /></a-button>
                </a-tooltip>
                <a-tooltip :title="$t('workflowDefinition.fitView')">
                  <a-button size="small" type="text" @click="fitView()"><ExpandOutlined /></a-button>
                </a-tooltip>
                <span class="tools-sep"></span>
                <a-tooltip :title="$t('workflowDefinition.autoLayout')">
                  <a-button
                    size="small"
                    type="text"
                    :disabled="!canvasEditable"
                    @click="doResetLayout"
                  >
                    <ApartmentOutlined />
                  </a-button>
                </a-tooltip>
              </div>
            </div>
            <a-alert
              v-if="!graphResult.ok && !draftJsonError"
              type="warning"
              show-icon
              class="canvas-alert"
              :message="graphErrorText"
            />
            <VueFlow
              v-if="displayGraph"
              :id="flowId"
              :nodes="flowNodes"
              :edges="flowEdges"
              :nodes-draggable="canvasEditable && draftParse.ok"
              :nodes-connectable="canvasEditable && draftParse.ok"
              :is-valid-connection="isValidConnection"
              :elements-selectable="true"
              :delete-key-code="null"
              selection-key-code="Shift"
              :zoom-on-double-click="false"
              :snap-to-grid="true"
              :snap-grid="[16, 16]"
              :min-zoom="0.2"
              :max-zoom="2"
              fit-view-on-init
              @nodes-change="onNodesChange"
              @edges-change="onEdgesChange"
              @pane-click="onPaneClick"
              @connect="onConnect"
              @connect-start="onConnectStart"
              @connect-end="onConnectEnd"
              @node-drag-stop="onNodeDragStop"
              @selection-drag-stop="onNodeDragStop"
              @node-context-menu="onNodeContextMenu"
              @pane-context-menu="onPaneContextMenu"
              @edge-mouse-enter="(e: EdgeMouseEvent) => setEdgeHover(e.edge.id, true)"
              @edge-mouse-leave="(e: EdgeMouseEvent) => setEdgeHover(e.edge.id, false)"
            >
              <Background variant="dots" :gap="16" :size="1.2" />
              <template #node-step="{ data }">
                <StepNode :data="data" />
              </template>
              <template #edge-wf="edgeProps">
                <StepEdge v-bind="edgeProps" />
              </template>
            </VueFlow>

            <!-- 右键菜单 -->
            <div
              v-if="menu"
              class="wd-floating ctx-menu"
              :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
              @contextmenu.prevent
            >
              <template v-if="menu.type === 'node'">
                <div class="ctx-item" :class="{ disabled: !canvasEditable }" @click="menuDuplicate">
                  {{ $t('workflowDefinition.ctxDuplicate') }} <span class="ctx-key">Ctrl/⌘+D</span>
                </div>
                <div class="ctx-item" :class="{ disabled: !canvasEditable }" @click="menuRename">
                  {{ $t('workflowDefinition.ctxRename') }}
                </div>
                <div class="ctx-item danger" :class="{ disabled: !canvasEditable }" @click="menuDelete">
                  {{ $t('workflowDefinition.deleteStep') }} <span class="ctx-key">Del</span>
                </div>
              </template>
              <template v-else>
                <div class="ctx-item" :class="{ disabled: !canvasEditable }" @click="menuAddStep">
                  {{ $t('workflowDefinition.addStep') }}
                </div>
                <div class="ctx-item" :class="{ disabled: !canvasEditable }" @click="menuAutoLayout">
                  {{ $t('workflowDefinition.autoLayout') }}
                </div>
                <div class="ctx-item" @click="menuFitView">
                  {{ $t('workflowDefinition.fitView') }}
                </div>
              </template>
            </div>

            <!-- 步骤选择器：右键添加、从输出点拖到空白处时弹出 -->
            <div
              v-if="picker"
              class="wd-floating step-picker"
              :style="{ left: picker.x + 'px', top: picker.y + 'px' }"
            >
              <div class="picker-title">
                {{
                  picker.source
                    ? $t('workflowDefinition.pickerTitleFrom', { step: picker.source })
                    : $t('workflowDefinition.pickerTitle')
                }}
              </div>
              <a-input
                ref="pickerInputRef"
                v-model:value="pickerQuery"
                size="small"
                allow-clear
                :placeholder="$t('workflowDefinition.paletteSearch')"
                @keydown.enter="pickerItems[0] && chooseFromPicker(pickerItems[0].kind)"
                @keydown.esc="closeFloating"
              />
              <div class="picker-list">
                <div
                  v-for="item in pickerItems"
                  :key="item.kind"
                  class="picker-item"
                  @click="chooseFromPicker(item.kind)"
                >
                  <i class="picker-dot" :style="{ background: KIND_GROUP_COLOR[item.group] }"></i>
                  <span class="pi-name">{{ item.name }}</span>
                  <code class="picker-kind">{{ item.kind }}</code>
                </div>
                <div v-if="!pickerItems.length" class="muted" style="padding: 8px">
                  {{ $t('workflowDefinition.paletteEmpty') }}
                </div>
              </div>
            </div>
            <div v-if="displayGraph && !displayGraph.nodes.length" class="graph-empty">
              {{
                canvasEditable
                  ? $t('workflowDefinition.graphEmptyDrag')
                  : $t('workflowDefinition.graphEmptyReadonly')
              }}
            </div>
            <div v-if="canvasEditable && displayGraph?.nodes.length" class="canvas-hint">
              {{ $t('workflowDefinition.canvasHint') }}
            </div>
          </section>

          <aside class="wd-props">
            <a-alert
              v-if="selectedStep && !isReadonly && draftJsonError"
              type="warning"
              show-icon
              style="margin-bottom: 8px"
              :message="$t('workflowDefinition.editBlockedInvalidJson')"
            />
            <div v-if="selectedIds.length > 1" class="multi-select">
              <div class="pane-title">
                {{ $t('workflowDefinition.multiSelected', { count: selectedIds.length }) }}
              </div>
              <div class="pane-hint">{{ $t('workflowDefinition.multiSelectedHint') }}</div>
              <a-space v-if="canvasEditable">
                <a-button size="small" @click="duplicateSelected">
                  {{ $t('workflowDefinition.ctxDuplicate') }}
                </a-button>
                <a-button size="small" danger @click="confirmDeleteSteps(selectedIds)">
                  {{ $t('workflowDefinition.deleteStep') }}
                </a-button>
              </a-space>
            </div>
            <StepPropsPanel
              v-else
              :step="selectedStep"
              :schema="selectedSchema"
              :kind-options="kindSelectOptions"
              :disabled="!canvasEditable || !draftParse.ok"
              :issues="selectedIssues"
              :model-group="selectedModelGroup"
              :model-group-tool="selectedModelGroupTool"
              :bind-options="bindOptions"
              :model-group-items="modelGroupItems"
              :model-groups-loading="modelGroupsState === 'loading'"
              :prompt-items="promptItems"
              :prompts-loading="promptsState === 'loading'"
              :manage-model-groups-href="manageModelGroupsHref"
              :manage-prompts-href="managePromptsHref"
              @rename="(v: string) => selectedStepId && renameStepId(selectedStepId, v)"
              @set-param="onSetParam"
              @set-field="onSetField"
              @disconnect="onPanelDisconnect"
              @remove="selectedStepId && removeSteps([selectedStepId])"
            />
          </aside>

          <a-modal
            :open="!!renameTarget"
            :title="$t('workflowDefinition.ctxRename')"
            @ok="commitRenameModal"
            @cancel="renameTarget = null"
          >
            <a-input
              v-model:value="renameDraft"
              :placeholder="$t('workflowDefinition.propsId')"
              @press-enter="commitRenameModal"
            />
            <div class="muted" style="font-size: 12px; margin-top: 6px">
              {{ $t('workflowDefinition.propsIdHint') }}
            </div>
          </a-modal>
        </div>

        <!-- 问题栏 -->
        <div v-if="!isReadonly" class="wd-problems" :class="{ open: problemsOpen }">
          <div class="problems-head" @click="problemsOpen = !problemsOpen">
            <span class="problems-title">
              {{ $t('workflowDefinition.problemsTitle') }}
              <a-badge
                :count="problemCount"
                :number-style="problemCount ? {} : { backgroundColor: '#52c41a' }"
                :show-zero="true"
              />
            </span>
            <span v-if="resultMsg" :class="resultOk ? 'ok-text' : 'err-text'" class="problems-result">
              {{ resultMsg }}
            </span>
            <span class="problems-toggle">
              {{ problemsOpen ? $t('workflowDefinition.collapse') : $t('workflowDefinition.expand') }}
            </span>
          </div>
          <div v-if="problemsOpen" class="problems-body">
            <div v-if="!problemCount" class="muted">{{ $t('workflowDefinition.noProblems') }}</div>
            <ul class="error-list">
              <li
                v-for="(issue, i) in localIssues"
                :key="'l' + i"
                :class="{ clickable: !!issue.stepId }"
                @click="issue.stepId && focusStep(issue.stepId)"
              >
                <a-tag color="orange" size="small">{{ $t('workflowDefinition.problemLocal') }}</a-tag>
                {{ formatIssue(issue) }}
              </li>
              <li
                v-for="(e, i) in errors"
                :key="'s' + i"
                :class="{ clickable: errorStepIds[i].length > 0 }"
                @click="errorStepIds[i][0] && focusStep(errorStepIds[i][0])"
              >
                <a-tag color="red" size="small">{{ $t('workflowDefinition.problemServer') }}</a-tag>
                {{ formatValidationError(e) }}
              </li>
            </ul>
            <div v-if="localIssues.length" class="muted problems-note">
              {{ $t('workflowDefinition.localIssuesNote') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 输入与输出 -->
      <div v-if="tab === 'io'" class="wd-scroll-tab">
        <IoEditor
          :inputs="defInputs"
          :outputs="defOutputs"
          :disabled="isReadonly || !draftParse.ok"
          :source-options="outputSourceOptions"
          @set-inputs="(v) => onSetDefField('inputs', v)"
          @set-outputs="(v) => onSetDefField('outputs', v)"
          @rename-input="onRenameInput"
        />
        <div v-if="!isReadonly && ioIssues.length" style="margin-top: 16px; max-width: 1100px">
          <a-alert
            type="warning"
            show-icon
            :message="$t('workflowDefinition.localIssuesTitle', { count: ioIssues.length })"
          >
            <template #description>
              <ul class="error-list">
                <li v-for="(issue, i) in ioIssues" :key="i">{{ formatIssue(issue) }}</li>
              </ul>
            </template>
          </a-alert>
        </div>
      </div>

      <!-- JSON（高级） -->
      <div v-if="tab === 'json'" class="wd-json-tab">
        <div class="json-toolbar">
          <span class="muted">{{ $t('workflowDefinition.jsonHint') }}</span>
          <a-space>
            <a-button v-if="!isReadonly" size="small" @click="formatJson">
              {{ $t('workflowDefinition.formatJson') }}
            </a-button>
          </a-space>
        </div>
        <a-alert
          v-if="!isReadonly && validatedText !== null && validatedText !== text"
          type="warning"
          show-icon
          style="margin-bottom: 8px"
          :message="$t('workflowDefinition.stale')"
        />
        <div ref="jsonWrapRef" class="json-editor-wrap">
          <ProCodeEditor
            :model-value="isReadonly ? readonlyText : text"
            language="json"
            :readonly="isReadonly"
            :height="jsonHeight"
            @update:model-value="onEdit"
          />
        </div>
        <div class="muted json-foot">
          {{ $t('workflowDefinition.structureHint') }}
          <br />
          {{ $t('workflowDefinition.contractHint') }}
        </div>
      </div>

      <!-- 版本历史 -->
      <div v-if="tab === 'versions'" class="wd-scroll-tab">
        <div class="versions-wrap">
          <div class="current-version-box">
            <div class="muted">{{ $t('workflowDefinition.currentVersionTitle') }}</div>
            <div class="current-version">
              {{
                detail?.currentVersion
                  ? $t('workflowDefinition.versionItem', { version: detail.currentVersion })
                  : $t('workflowDefinition.noVersions')
              }}
            </div>
            <div v-if="currentVersionMeta" class="muted" style="font-size: 12px">
              {{ currentVersionMeta.publishedAt ? formatDateTime(currentVersionMeta.publishedAt) : '-' }}
              <span v-if="currentVersionMeta.publishedBy"> · {{ currentVersionMeta.publishedBy }}</span>
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 8px; line-height: 1.6">
              {{ $t('workflowDefinition.currentVersionHint') }}
            </div>
          </div>
          <div class="muted" style="font-size: 12px; margin: 12px 0 4px">
            {{ $t('workflowDefinition.historyHint') }}
          </div>
          <a-empty v-if="!versions.length" :description="$t('workflowDefinition.noVersions')" />
          <a-list v-else :data-source="versions" size="small" bordered>
            <template #renderItem="{ item }">
              <a-list-item
                class="version-item"
                :class="{ viewing: viewingVersion === item.version }"
                @click="viewVersion(item.version)"
              >
                <div style="flex: 1; min-width: 0">
                  <span class="version-no">{{
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
                <a-space>
                  <a-button size="small" type="link" @click.stop="viewVersion(item.version)">
                    {{ $t('workflowDefinition.viewVersion') }}
                  </a-button>
                  <a-button
                    v-if="restoreAvailable && item.version !== detail?.currentVersion"
                    v-permission="'ai_gateway:config'"
                    size="small"
                    type="link"
                    @click.stop="doRestore(item.version)"
                  >
                    {{ $t('workflowDefinition.restore') }}
                  </a-button>
                </a-space>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ApartmentOutlined,
  ExpandOutlined,
  RedoOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@antdv-next/icons';
import { Background } from '@vue-flow/background';
import {
  MarkerType,
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeMouseEvent,
  type Node,
  type NodeChange,
  type NodeDragEvent,
  type NodeMouseEvent,
  type OnConnectStartParams,
} from '@vue-flow/core';
import { message, Modal } from 'antdv-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

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
import { listModelGroupOptions, type ModelGroupOption } from '@/api/ai-gateway';
import { listWorkflowTools, type WorkflowToolRow } from '@/api/workflow-tools';
import ProCodeEditor from '@/components/Pro/ProCodeEditor/index.vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { formatDateTime } from '@/utils/helpers';
import {
  addStep,
  ancestorsByAfter,
  buildGraphFromDefinition,
  configRefsOf,
  connectSteps,
  descendantsOf,
  disconnectSteps,
  duplicateStep,
  findStep,
  GATEWAY_CALL_KIND,
  isBindValue,
  issuesByStep,
  LAYER_GAP_X,
  modelGroupRefOf,
  parseDefinition,
  pruneLayout,
  removeStep,
  renameInLayout,
  renameInput,
  renameStep,
  ROW_GAP_Y,
  sanitizeLayout,
  serializeDefinition,
  setDefinitionField,
  setStepField,
  setStepParam,
  stepHeadsOfBind,
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
import {
  loadPromptItems,
  matchesQuery,
  mergeModelGroups,
  modelGroupDisplayName,
  OPERATION_ORDER,
  operationLabelKey,
  OTHER_OPERATION,
  READINESS_COLOR,
  READINESS_LABEL_KEY,
  readinessOf,
  shortPriceText,
  type ModelGroupItem,
  type PromptItem,
} from '@/views/workflow-definition/catalog';
import IoEditor from '@/views/workflow-definition/IoEditor.vue';
import {
  KIND_GROUP_COLOR,
  KIND_GROUP_ORDER,
  kindDisplayName,
  kindGroupOf,
  type KindGroup,
} from '@/views/workflow-definition/kinds';
import StepEdge, { type StepEdgeData } from '@/views/workflow-definition/StepEdge.vue';
import StepNode, { type StepNodeData } from '@/views/workflow-definition/StepNode.vue';
import StepPropsPanel, { type BindOption } from '@/views/workflow-definition/StepPropsPanel.vue';

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const flowId = `workflow-definition-${id}`;
const { fitView, screenToFlowCoordinate, setCenter, getViewport, zoomIn, zoomOut, viewport } =
  useVueFlow(flowId);

const TEMPLATE = '{"schema":"workflow-definition/v1","inputs":{},"steps":[],"outputs":{}}';
/** 自定义节点的大致尺寸（StepNode 宽 220），放置与居中用 */
const NODE_W = 220;
const NODE_H = 64;
const DRAG_MIME = 'application/x-workflow-kind';
/** 拖拽时附带的初始参数（JSON），模型/提示词条目用 */
const DRAG_PARAMS_MIME = 'application/x-workflow-params';
/** 提示词条目拖出的默认步骤类型；分镜/脚本类在属性面板改类型 */
const PROMPT_DROP_KIND = 'prompt.optimize';
const HISTORY_LIMIT = 50;

const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
const pickerInputRef = ref<{ focus?: () => void } | null>(null);
const tab = ref<'canvas' | 'io' | 'json' | 'versions'>('canvas');
/** JSON 编辑器高度跟随容器（编辑器只接受像素高度） */
const jsonWrapRef = ref<HTMLElement | null>(null);
const jsonHeight = ref(480);
let jsonResize: ResizeObserver | undefined;
watch(jsonWrapRef, (el) => {
  jsonResize?.disconnect();
  if (!el) return;
  jsonResize = new ResizeObserver(() => {
    jsonHeight.value = Math.max(240, Math.floor(el.clientHeight));
  });
  jsonResize.observe(el);
});

const detail = ref<WorkflowDefinitionDetail | null>(null);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const stepKinds = ref<string[]>([]);
/** 步骤类型说明；null = 尚未加载或接口缺失（只用名称） */
const kindSchemas = ref<WorkflowStepKindSchema[] | null>(null);

// 新接口（schema / status / restore）是否可用；后端未上线返回 404 时隐藏对应控件
const schemaAvailable = ref(false);
const statusAvailable = ref(false);
const restoreAvailable = ref(false);

/** 草稿 JSON 是唯一数据源：画布、属性面板、输入输出表的修改都写回这里，画布由它推导 */
const text = ref('');
/** 当前版本内容（规范化后），与草稿不同即有未发布的修改 */
const baselineText = ref('');
/** 最近一次校验通过时的内容；内容改动后与 text 不一致 => 需重新校验 */
const validatedText = ref<string | null>(null);

const viewingVersion = ref<number | null>(null);
const readonlyText = ref('');
const isReadonly = computed(() => viewingVersion.value !== null);

/** 草稿始终可编辑；查看历史版本时恒为只读 */
const canvasEditable = computed(() => !isReadonly.value);

const validating = ref(false);
const publishing = ref(false);
const statusSaving = ref(false);
const resultMsg = ref('');
const resultOk = ref(false);
const errors = ref<WorkflowValidationError[]>([]);
const problemsOpen = ref(false);

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

/** 选中的步骤与连线（画布多选；属性面板只在恰好选中一个步骤时显示） */
const selectedIds = ref<string[]>([]);
const selectedEdgeIds = ref<string[]>([]);
const selectedStepId = computed(() =>
  selectedIds.value.length === 1 ? selectedIds.value[0] : null,
);
const paletteSearch = ref('');

// ---------------------------------------------------------------------------
// 节点面板的「模型」「提示词」目录：首次打开页签（或选中需要它的步骤）时加载一次，属性面板共用
// ---------------------------------------------------------------------------

type LoadState = 'idle' | 'loading' | 'ok' | 'error';
const paletteTab = ref<'steps' | 'models' | 'prompts'>('steps');
const paletteTabItems = computed(() => [
  { key: 'steps', label: t('workflowDefinition.catalog.tabSteps') },
  { key: 'models', label: t('workflowDefinition.catalog.tabModels') },
  { key: 'prompts', label: t('workflowDefinition.catalog.tabPrompts') },
]);
const modelSearch = ref('');
const promptSearch = ref('');
const modelGroupOptions = ref<ModelGroupOption[] | null>(null);
const modelGroupsState = ref<LoadState>('idle');
const promptItems = ref<PromptItem[]>([]);
const promptsState = ref<LoadState>('idle');

async function ensureModelGroups(force = false) {
  if (!force && modelGroupsState.value !== 'idle') return;
  modelGroupsState.value = 'loading';
  try {
    modelGroupOptions.value = await listModelGroupOptions(force);
    modelGroupsState.value = 'ok';
  } catch {
    // 网关目录不可用时退回总览行（scope=all 的新后端也带操作），一行都没有才算失败
    modelGroupOptions.value = null;
    modelGroupsState.value = toolByModelGroup.value.size ? 'ok' : 'error';
  }
}

async function ensurePrompts(force = false) {
  if (!force && promptsState.value !== 'idle') return;
  promptsState.value = 'loading';
  try {
    promptItems.value = await loadPromptItems();
    promptsState.value = 'ok';
  } catch {
    promptItems.value = [];
    promptsState.value = 'error';
  }
}

watch(paletteTab, (v) => {
  if (v === 'models') void ensureModelGroups();
  else if (v === 'prompts') void ensurePrompts();
});

const modelGroupItems = computed<ModelGroupItem[]>(() =>
  mergeModelGroups(modelGroupOptions.value, toolByModelGroup.value),
);

/** 按操作分组；同一组支持多个操作时在每个操作下各出现一次 */
const modelPaletteGroups = computed(() => {
  const items = modelGroupItems.value.filter((i) =>
    matchesQuery(modelSearch.value, i.code, i.name),
  );
  const known = OPERATION_ORDER as readonly string[];
  const groups: { op: string; items: ModelGroupItem[] }[] = OPERATION_ORDER.map((op) => ({
    op,
    items: items.filter((i) => i.operations.includes(op)),
  }));
  groups.push({
    op: OTHER_OPERATION,
    items: items.filter((i) => !i.operations.some((op) => known.includes(op))),
  });
  return groups.filter((g) => g.items.length);
});

/** 拖出模型组时写入的参数；「其他」下的组只有一个操作时也带上它 */
function modelDropParams(item: ModelGroupItem, op: string): Record<string, unknown> {
  const operation =
    op !== OTHER_OPERATION ? op : item.operations.length === 1 ? item.operations[0] : undefined;
  return operation ? { modelGroup: item.code, operation } : { modelGroup: item.code };
}

const promptPaletteItems = computed(() =>
  promptItems.value.filter((p) => matchesQuery(promptSearch.value, p.code, p.name)),
);

/** 「去管理」：新窗口打开，不离开正在编辑的定义 */
const manageModelGroupsHref = computed(() => router.resolve({ name: 'AiGatewayModelGroups' }).href);
const managePromptsHref = computed(() => router.resolve({ name: 'PromptLabList' }).href);

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

function normalize(source: string): string {
  const p = parseDefinition(source);
  return p.ok ? serializeDefinition(p.def) : source;
}
const dirty = computed(() => !!text.value && normalize(text.value) !== baselineText.value);

// ---------------------------------------------------------------------------
// 撤销 / 重做：草稿 JSON + 画布坐标的快照栈。坐标只存 /layout，不产生版本
// ---------------------------------------------------------------------------

interface Snapshot {
  text: string;
  layout: Record<string, NodePosition>;
}
const undoStack = ref<Snapshot[]>([]);
const redoStack = ref<Snapshot[]>([]);
const canUndo = computed(() => canvasEditable.value && undoStack.value.length > 0);
const canRedo = computed(() => canvasEditable.value && redoStack.value.length > 0);
let lastCoalesce = '';
let lastCoalesceAt = 0;

function snapshot(): Snapshot {
  return { text: text.value, layout: { ...layout.value } };
}

/** 变更前记一条快照；同一 coalesce 键在短时间内的连续修改（逐字输入）只记一次 */
function recordHistory(coalesce?: string) {
  const now = Date.now();
  if (coalesce && coalesce === lastCoalesce && now - lastCoalesceAt < 1200) {
    lastCoalesceAt = now;
    return;
  }
  lastCoalesce = coalesce ?? '';
  lastCoalesceAt = now;
  undoStack.value = [...undoStack.value, snapshot()].slice(-HISTORY_LIMIT);
  redoStack.value = [];
}

/** 一次已提交的编辑：先记快照，再写草稿和/或坐标 */
function commit(
  change: { def?: DefinitionObject; text?: string; layout?: Record<string, NodePosition> },
  coalesce?: string,
) {
  recordHistory(coalesce);
  if (change.def) text.value = serializeDefinition(change.def);
  else if (change.text !== undefined) text.value = change.text;
  if (change.layout) {
    layout.value = change.layout;
    scheduleLayoutSave();
  }
}

function restoreSnapshot(s: Snapshot) {
  const layoutChanged = JSON.stringify(s.layout) !== JSON.stringify(layout.value);
  text.value = s.text;
  layout.value = { ...s.layout };
  if (layoutChanged) scheduleLayoutSave();
  lastCoalesce = '';
  // 撤销后选中的步骤可能已不存在
  const def = draftDef.value;
  if (def) selectedIds.value = selectedIds.value.filter((x) => findStep(def, x));
  selectedEdgeIds.value = [];
}

function undo() {
  if (!canUndo.value) return;
  const prev = undoStack.value[undoStack.value.length - 1];
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, snapshot()];
  restoreSnapshot(prev);
}

function redo() {
  if (!canRedo.value) return;
  const next = redoStack.value[redoStack.value.length - 1];
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, snapshot()].slice(-HISTORY_LIMIT);
  restoreSnapshot(next);
}

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
const zoomPercent = computed(() => Math.round((viewport.value?.zoom ?? 1) * 100));

// ---------------------------------------------------------------------------
// 步骤类型：显示名、节点面板、步骤选择器
// ---------------------------------------------------------------------------

const kindOptions = computed(() => {
  const names = new Set<string>(stepKinds.value);
  (kindSchemas.value ?? []).forEach((k) => names.add(k.kind));
  return [...names].sort();
});
const schemaByKind = computed(
  () => new Map((kindSchemas.value ?? []).map((k) => [k.kind, k] as const)),
);

function kindName(kind: string): string {
  return kindDisplayName(kind, te, t, schemaByKind.value.get(kind)?.description);
}

const kindSelectOptions = computed(() =>
  kindOptions.value.map((k) => ({ value: k, label: `${kindName(k)}（${k}）` })),
);

const paletteDisabled = computed(() => !canvasEditable.value || !draftParse.value.ok);

interface KindItem {
  kind: string;
  name: string;
  description?: string;
  group: KindGroup;
}

function filterKinds(query: string): KindItem[] {
  const q = query.trim().toLowerCase();
  return kindOptions.value
    .map((kind) => ({
      kind,
      name: kindName(kind),
      description: schemaByKind.value.get(kind)?.description,
      group: kindGroupOf(kind),
    }))
    .filter(
      (item) =>
        !q || [item.kind, item.name, item.description ?? ''].some((s) => s.toLowerCase().includes(q)),
    );
}

const paletteGroups = computed(() => {
  const items = filterKinds(paletteSearch.value);
  return KIND_GROUP_ORDER.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter(
    (g) => g.items.length,
  );
});

// ---------------------------------------------------------------------------
// 即时校验（前端预检）与服务端校验结果
// ---------------------------------------------------------------------------

const localIssues = computed<LocalIssue[]>(() => {
  if (!draftDef.value) return [];
  const kinds = kindSchemas.value ?? (stepKinds.value.length ? stepKinds.value : null);
  return validateDefinitionLocal(draftDef.value, kinds);
});
const localIssueMap = computed(() => issuesByStep(localIssues.value));
/** 输入与输出页签关心的问题：引用了未声明的输入、outputs 里的问题 */
const ioIssues = computed(() =>
  localIssues.value.filter((i) => i.code === 'unknown_input' || !i.stepId),
);
const problemCount = computed(() => localIssues.value.length + errors.value.length);

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
// 画布：节点与连线
// ---------------------------------------------------------------------------

function toolOf(mg?: ModelGroupRef): WorkflowToolRow | undefined {
  return mg?.kind === 'literal' ? toolByModelGroup.value.get(mg.value) : undefined;
}

/** 正在从某个连接点拖线 */
const connecting = ref(false);
const hoveredEdgeId = ref<string | null>(null);
let edgeHoverTimer: ReturnType<typeof setTimeout> | undefined;

/** 连线悬停：离开时稍等再清，鼠标能移到中点的删除按钮上 */
function setEdgeHover(edgeId: string, hovering: boolean) {
  if (edgeHoverTimer) clearTimeout(edgeHoverTimer);
  if (hovering) {
    hoveredEdgeId.value = edgeId;
    return;
  }
  edgeHoverTimer = setTimeout(() => {
    if (hoveredEdgeId.value === edgeId) hoveredEdgeId.value = null;
  }, 250);
}

const flowNodes = computed<Node<StepNodeData>[]>(() => {
  const g = displayGraph.value;
  if (!g) return [];
  const connectable = canvasEditable.value && draftParse.value.ok;
  const selected = new Set(selectedIds.value);
  return g.nodes.map((n) => {
    const issues = isReadonly.value ? [] : (localIssueMap.value.get(n.id) ?? []);
    const hasError = issues.length > 0 || (!isReadonly.value && serverErrorSteps.value.has(n.id));
    return {
      id: n.id,
      type: 'step',
      position: { x: n.x, y: n.y },
      selected: selected.has(n.id),
      data: {
        kind: n.kind,
        title: kindName(n.kind),
        stepId: n.id,
        hasCondition: n.hasCondition,
        modelGroup: n.modelGroup,
        modelGroupName:
          n.modelGroup?.kind === 'literal'
            ? modelGroupDisplayName(n.modelGroup.value, modelGroupItems.value, toolByModelGroup.value)
            : undefined,
        tool: toolOf(n.modelGroup),
        issueCount: issues.length,
        issueTitle: issues.map(formatIssue).join('\n'),
        hasError,
        selected: selected.has(n.id),
        connectable,
      },
    };
  });
});

const flowEdges = computed<Edge<StepEdgeData>[]>(() => {
  const g = displayGraph.value;
  if (!g) return [];
  const selected = new Set(selectedEdgeIds.value);
  return g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'wf',
    selected: selected.has(e.id),
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8c8c8c', width: 18, height: 18 },
    data: {
      type: e.type,
      hovered: hoveredEdgeId.value === e.id,
      deletable: canvasEditable.value && draftParse.value.ok && e.type === 'after',
      deleteTitle: t('workflowDefinition.disconnect'),
      onDelete: (edgeId: string) => removeEdges([edgeId]),
      onHover: setEdgeHover,
    },
  }));
});

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** 画布上的选中变化（点选、框选、Ctrl/⌘ 多选）同步到本页状态 */
function onNodesChange(changes: NodeChange[]) {
  const next = new Set(selectedIds.value);
  let touched = false;
  changes.forEach((c) => {
    if (c.type !== 'select') return;
    touched = true;
    if (c.selected) next.add(c.id);
    else next.delete(c.id);
  });
  if (touched && !sameList([...next], selectedIds.value)) selectedIds.value = [...next];
}

function onEdgesChange(changes: EdgeChange[]) {
  const next = new Set(selectedEdgeIds.value);
  let touched = false;
  changes.forEach((c) => {
    if (c.type !== 'select') return;
    touched = true;
    if (c.selected) next.add(c.id);
    else next.delete(c.id);
  });
  if (touched && !sameList([...next], selectedEdgeIds.value)) selectedEdgeIds.value = [...next];
}

function clearSelection() {
  selectedIds.value = [];
  selectedEdgeIds.value = [];
}

function selectStep(stepId: string) {
  selectedIds.value = [stepId];
  selectedEdgeIds.value = [];
}

function onPaneClick() {
  closeFloating();
  clearSelection();
}

/** 选中并把节点移到画布中央（问题栏点击用） */
function focusStep(stepId: string) {
  tab.value = 'canvas';
  selectStep(stepId);
  const n = displayGraph.value?.nodes.find((x) => x.id === stepId);
  if (!n) return;
  nextTick(() => {
    void setCenter(n.x + NODE_W / 2, n.y + NODE_H / 2, {
      zoom: Math.max(getViewport().zoom, 0.8),
      duration: 300,
    });
  });
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

function applyEdit(r: EditResult, coalesce?: string): boolean {
  if (!r.ok) {
    message.warning(t(`workflowDefinition.editError.${r.error}`));
    return false;
  }
  commit({ def: r.def }, coalesce);
  return true;
}

// 连线：从输出点拖到另一个节点的输入点；松在空白处时弹出步骤选择器，选中后自动连上
let pendingSource: string | undefined;
let connectionMade = false;

function onConnectStart(p: { event?: MouseEvent | TouchEvent } & OnConnectStartParams) {
  connecting.value = true;
  connectionMade = false;
  pendingSource = p.handleType === 'source' ? p.nodeId : undefined;
}

/** 拖线时即时判断（与 connectSteps 同一套规则：自环、已连、成环），不合法的落点不吸附 */
function isValidConnection(c: Connection): boolean {
  if (!canvasEditable.value || !draftParse.value.ok || !c.source || !c.target) return false;
  return connectSteps(draftParse.value.def, c.source, c.target).ok;
}

function onConnect(c: Connection) {
  connectionMade = true;
  const def = editableDef();
  if (!def || !c.source || !c.target) return;
  applyEdit(connectSteps(def, c.source, c.target));
}

function onConnectEnd(e?: MouseEvent | TouchEvent) {
  connecting.value = false;
  const source = pendingSource;
  pendingSource = undefined;
  if (connectionMade || !source || !e || !canvasEditable.value) return;
  const point = 'changedTouches' in e ? e.changedTouches[0] : e;
  if (!point) return;
  const target = (e.target as HTMLElement | null) ?? null;
  if (target?.closest('.vue-flow__handle, .vue-flow__node')) return;
  openPicker(point.clientX, point.clientY, source);
}

/** 当前所有节点的坐标（固定下来，之后增删步骤不会把已摆好的节点重新排版） */
function currentPositions(): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  displayGraph.value?.nodes.forEach((n) => (positions[n.id] = { x: n.x, y: n.y }));
  return positions;
}

/** 拖动停下（单个节点或框选的一组）：记一条撤销快照，只存坐标，不产生版本 */
function onNodeDragStop(e: NodeDragEvent) {
  if (!canvasEditable.value) return;
  const positions = currentPositions();
  let moved = false;
  (e.nodes.length ? e.nodes : [e.node]).forEach((n) => {
    if (!n) return;
    const old = positions[n.id];
    if (!old || old.x !== n.position.x || old.y !== n.position.y) moved = true;
    positions[n.id] = { ...n.position };
  });
  // 没有实际位移（点一下、吸附回原位）不记撤销快照
  if (!moved) return;
  commit({ layout: positions });
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

/** 新步骤带上初始参数（模型/提示词条目拖出时） */
function addStepWithParams(
  def: DefinitionObject,
  kind: string,
  source?: string,
  params?: Record<string, unknown>,
): { def: DefinitionObject; id: string } {
  const r = addStep(def, kind, source);
  let next = r.def;
  Object.entries(params ?? {}).forEach(([name, value]) => {
    const e = setStepParam(next, r.id, name, value);
    if (e.ok) next = e.def;
  });
  return { def: next, id: r.id };
}

/** 点节点面板里的条目：加在选中节点右侧（或最下方） */
function doAddStep(kind: string, params?: Record<string, unknown>) {
  const def = editableDef();
  if (!def) return;
  const r = addStepWithParams(def, kind, undefined, params);
  let nextLayout: Record<string, NodePosition> | undefined;
  if (hasLayout.value) {
    // 已有手摆坐标时，新节点放在选中节点右侧（或最下方），避免和已摆好的节点重叠
    const nodes = displayGraph.value?.nodes ?? [];
    const sel = nodes.find((n) => n.id === selectedStepId.value);
    nextLayout = {
      ...layout.value,
      [r.id]: sel
        ? { x: sel.x + LAYER_GAP_X, y: sel.y }
        : { x: 0, y: nodes.reduce((m, n) => Math.max(m, n.y + ROW_GAP_Y), 0) },
    };
  }
  commit({ def: r.def, layout: nextLayout });
  selectStep(r.id);
}

/** 在画布坐标 flow 处新建步骤；给了 source 时同时连到它后面 */
function createStepAt(
  kind: string,
  flow: NodePosition,
  source?: string,
  params?: Record<string, unknown>,
) {
  const def = editableDef();
  if (!def) return;
  const r = addStepWithParams(def, kind, source, params);
  commit({
    def: r.def,
    layout: {
      ...currentPositions(),
      [r.id]: {
        x: Math.round((flow.x - NODE_W / 2) / 16) * 16,
        y: Math.round((flow.y - NODE_H / 2) / 16) * 16,
      },
    },
  });
  selectStep(r.id);
}

function onPaletteDragStart(e: DragEvent, kind: string, params?: Record<string, unknown>) {
  if (paletteDisabled.value || !e.dataTransfer) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.setData(DRAG_MIME, kind);
  if (params) e.dataTransfer.setData(DRAG_PARAMS_MIME, JSON.stringify(params));
  e.dataTransfer.setData('text/plain', kind);
  e.dataTransfer.effectAllowed = 'copy';
}

function onCanvasDragOver(e: DragEvent) {
  if (paletteDisabled.value || !e.dataTransfer?.types.includes(DRAG_MIME)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

/** 从节点面板拖到画布：在落点放新步骤 */
function onCanvasDrop(e: DragEvent) {
  const kind = e.dataTransfer?.getData(DRAG_MIME);
  if (!kind) return;
  e.preventDefault();
  let params: Record<string, unknown> | undefined;
  try {
    const raw = e.dataTransfer?.getData(DRAG_PARAMS_MIME);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (isRecord(parsed)) params = parsed;
  } catch {
    params = undefined;
  }
  createStepAt(kind, screenToFlowCoordinate({ x: e.clientX, y: e.clientY }), undefined, params);
}

/** 删除若干步骤（一次撤销快照） */
function removeSteps(stepIds: string[]) {
  let def = editableDef();
  if (!def || !stepIds.length) return;
  const nextLayout = { ...layout.value };
  stepIds.forEach((s) => {
    def = removeStep(def as DefinitionObject, s);
    delete nextLayout[s];
  });
  commit({ def, layout: hasLayout.value ? nextLayout : undefined });
  clearSelection();
}

function confirmDeleteSteps(stepIds: string[]) {
  if (!stepIds.length) return;
  Modal.confirm({
    title:
      stepIds.length > 1
        ? t('workflowDefinition.deleteStepsConfirm', { count: stepIds.length })
        : t('workflowDefinition.deleteStepConfirm'),
    okType: 'danger',
    onOk: () => removeSteps([...stepIds]),
  });
}

/** 删除若干连线：只有执行顺序线能在画布上断，数据依赖要改绑定 */
function removeEdges(edgeIds: string[]) {
  let def = editableDef();
  if (!def) return;
  const edges = (displayGraph.value?.edges ?? []).filter((e) => edgeIds.includes(e.id));
  let changed = false;
  for (const edge of edges) {
    const r = disconnectSteps(def, edge.source, edge.target);
    if (!r.ok) {
      message.warning(t(`workflowDefinition.editError.${r.error}`));
      continue;
    }
    def = r.def;
    changed = true;
  }
  if (changed) commit({ def });
  selectedEdgeIds.value = [];
  hoveredEdgeId.value = null;
}

/** 复制若干步骤：新 id、位置错开 */
function duplicateSteps(stepIds: string[]) {
  let def = editableDef();
  if (!def || !stepIds.length) return;
  const positions = currentPositions();
  const created: string[] = [];
  stepIds.forEach((s) => {
    const r = duplicateStep(def as DefinitionObject, s);
    if (!r) return;
    def = r.def;
    const p = positions[s] ?? { x: 0, y: 0 };
    positions[r.id] = { x: p.x + 48, y: p.y + 48 };
    created.push(r.id);
  });
  if (!created.length) return;
  commit({ def, layout: positions });
  selectedIds.value = created;
  selectedEdgeIds.value = [];
}

function duplicateSelected() {
  duplicateSteps([...selectedIds.value]);
}

/** 自动排版：清掉本草稿的手摆坐标，按分层布局重排并保存 */
function doResetLayout() {
  if (!canvasEditable.value) return;
  commit({ layout: {} });
  nextTick(() => fitView());
}

// ---------------------------------------------------------------------------
// 右键菜单与步骤选择器
// ---------------------------------------------------------------------------

const menu = ref<{
  type: 'node' | 'pane';
  x: number;
  y: number;
  nodeId?: string;
  flow: NodePosition;
} | null>(null);
const picker = ref<{ x: number; y: number; flow: NodePosition; source?: string } | null>(null);
const pickerQuery = ref('');
const pickerItems = computed(() => filterKinds(pickerQuery.value));

/** 屏幕坐标 → 画布容器内坐标（浮层定位，限制在容器内） */
function localPoint(clientX: number, clientY: number, w: number, h: number) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: Math.max(4, Math.min(clientX - rect.left, rect.width - w - 4)),
    y: Math.max(4, Math.min(clientY - rect.top, rect.height - h - 4)),
  };
}

function closeFloating() {
  menu.value = null;
  picker.value = null;
}

function onNodeContextMenu(e: NodeMouseEvent) {
  const ev = e.event as MouseEvent;
  ev.preventDefault();
  closeFloating();
  if (!selectedIds.value.includes(e.node.id)) selectStep(e.node.id);
  menu.value = {
    type: 'node',
    nodeId: e.node.id,
    ...localPoint(ev.clientX, ev.clientY, 180, 120),
    flow: screenToFlowCoordinate({ x: ev.clientX, y: ev.clientY }),
  };
}

function onPaneContextMenu(ev: MouseEvent) {
  ev.preventDefault();
  closeFloating();
  menu.value = {
    type: 'pane',
    ...localPoint(ev.clientX, ev.clientY, 180, 120),
    flow: screenToFlowCoordinate({ x: ev.clientX, y: ev.clientY }),
  };
}

function openPicker(clientX: number, clientY: number, source?: string) {
  if (paletteDisabled.value) return;
  menu.value = null;
  pickerQuery.value = '';
  picker.value = {
    ...localPoint(clientX, clientY, 280, 320),
    flow: screenToFlowCoordinate({ x: clientX, y: clientY }),
    source,
  };
  nextTick(() => pickerInputRef.value?.focus?.());
}

function chooseFromPicker(kind: string) {
  const p = picker.value;
  if (!p) return;
  picker.value = null;
  createStepAt(kind, p.flow, p.source);
}

function menuTargets(): string[] {
  const nodeId = menu.value?.nodeId;
  if (!nodeId) return [];
  return selectedIds.value.includes(nodeId) ? [...selectedIds.value] : [nodeId];
}

function menuDuplicate() {
  if (!canvasEditable.value) return;
  const targets = menuTargets();
  menu.value = null;
  duplicateSteps(targets);
}

function menuDelete() {
  if (!canvasEditable.value) return;
  const targets = menuTargets();
  menu.value = null;
  confirmDeleteSteps(targets);
}

const renameTarget = ref<string | null>(null);
const renameDraft = ref('');

function menuRename() {
  if (!canvasEditable.value || !menu.value?.nodeId) return;
  renameTarget.value = menu.value.nodeId;
  renameDraft.value = menu.value.nodeId;
  menu.value = null;
}

function commitRenameModal() {
  const target = renameTarget.value;
  if (!target) return;
  if (renameStepId(target, renameDraft.value)) renameTarget.value = null;
}

function menuAddStep() {
  const m = menu.value;
  if (!m || !canvasEditable.value) return;
  const rect = canvasRef.value?.getBoundingClientRect();
  openPicker((rect?.left ?? 0) + m.x, (rect?.top ?? 0) + m.y);
  if (picker.value) picker.value.flow = m.flow;
}

function menuAutoLayout() {
  menu.value = null;
  doResetLayout();
}

function menuFitView() {
  menu.value = null;
  void fitView();
}

/** 浮层外按下鼠标即关闭 */
function onWindowMouseDown(e: MouseEvent) {
  if (!menu.value && !picker.value) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('.wd-floating, .ant-select-dropdown')) return;
  closeFloating();
}

// ---------------------------------------------------------------------------
// 键盘
// ---------------------------------------------------------------------------

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    !!el.closest('.cm-editor, .ant-modal, .ant-select-dropdown')
  );
}

/**
 * 快捷键：Delete/Backspace 删除选中、Ctrl/⌘+D 复制、Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做、Esc 取消。
 * 焦点在输入框里时不拦截。
 */
function onKeydown(e: KeyboardEvent) {
  if (!rootRef.value || rootRef.value.offsetParent === null) return;
  if (e.key === 'Escape') {
    if (menu.value || picker.value) {
      closeFloating();
      return;
    }
    if (!isTyping(e.target) && tab.value === 'canvas') clearSelection();
    return;
  }
  if (isTyping(e.target)) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (tab.value !== 'canvas' || !canvasEditable.value) return;
  if (mod && key === 'd') {
    e.preventDefault();
    duplicateSelected();
    return;
  }
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (selectedIds.value.length) {
    e.preventDefault();
    confirmDeleteSteps([...selectedIds.value]);
  } else if (selectedEdgeIds.value.length) {
    e.preventDefault();
    removeEdges([...selectedEdgeIds.value]);
  }
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
// 属性面板的下拉与节点面板共用同一份目录：选中需要它的步骤时按需加载（已加载则不重复）
watch(
  () => selectedStep.value?.kind,
  (kind) => {
    if (kind === GATEWAY_CALL_KIND) void ensureModelGroups();
    else if (typeof kind === 'string' && kind.startsWith('prompt.')) void ensurePrompts();
  },
);
const selectedModelGroup = computed(() => modelGroupRefOf(selectedStep.value));
const selectedModelGroupTool = computed(() => toolOf(selectedModelGroup.value));
const selectedIssues = computed(() =>
  !isReadonly.value && selectedStepId.value
    ? (localIssueMap.value.get(selectedStepId.value) ?? []).map(formatIssue)
    : [],
);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const defInputs = computed(() =>
  activeDef.value && isRecord(activeDef.value.inputs) ? activeDef.value.inputs : {},
);
const defOutputs = computed(() =>
  activeDef.value && isRecord(activeDef.value.outputs) ? activeDef.value.outputs : {},
);

/** 某步骤可被引用的输出路径：整体输出 + schema 声明的每个字段 */
function stepOutputOptions(stepId: string, kind: string): BindOption[] {
  const out: BindOption[] = [
    {
      value: `${stepId}.output`,
      label: t('workflowDefinition.bindStepWhole', { step: stepId }),
      group: 'step',
    },
  ];
  (schemaByKind.value.get(kind)?.outputs ?? []).forEach((field) =>
    out.push({
      value: `${stepId}.output.${field}`,
      label: t('workflowDefinition.bindStepOutput', { step: stepId, field }),
      group: 'step',
    }),
  );
  return out;
}

/** 「引用」候选：全部输入、定义里已用到的配置、选中步骤以外且不是它下游的步骤输出（避免成环） */
const bindOptions = computed<BindOption[]>(() => {
  const def = activeDef.value;
  if (!def || !selectedStepId.value) return [];
  const options: BindOption[] = Object.keys(defInputs.value).map((name) => ({
    value: `input.${name}`,
    label: t('workflowDefinition.bindInput', { name }),
    group: 'input',
  }));
  configRefsOf(def).forEach((key) =>
    options.push({
      value: `config.${key}`,
      label: t('workflowDefinition.bindConfig', { key }),
      group: 'config',
    }),
  );
  const g = displayGraph.value;
  if (g) {
    const self = selectedStepId.value;
    const below = descendantsOf(g.edges, self);
    g.nodes
      .filter((n) => n.id !== self && !below.has(n.id))
      .forEach((n) => options.push(...stepOutputOptions(n.id, n.kind)));
  }
  return options;
});

/** 输出来源候选（输入与输出页签）：所有步骤的输出 */
const outputSourceOptions = computed(() =>
  (displayGraph.value?.nodes ?? []).flatMap((n) =>
    stepOutputOptions(n.id, n.kind).map((o) => ({ value: o.value, label: o.value })),
  ),
);

/** 改步骤 id（属性面板、右键重命名共用）；返回是否成功 */
function renameStepId(oldId: string, newId: string): boolean {
  const def = editableDef();
  if (!def) return false;
  const r = renameStep(def, oldId, newId);
  if (!r.ok) {
    message.warning(t(`workflowDefinition.editError.${r.error}`));
    return false;
  }
  const nid = newId.trim();
  commit({
    def: r.def,
    layout: layout.value[oldId] ? renameInLayout(layout.value, oldId, nid) : undefined,
  });
  selectedIds.value = selectedIds.value.map((x) => (x === oldId ? nid : x));
  return true;
}

/**
 * 改参数。引用了某步骤的输出、而该步骤还不在 after 链上时，顺带连上执行顺序
 * （后端只允许引用祖先步骤）；连不上（会成环）时只写参数，交给即时校验提示。
 */
function onSetParam(name: string, value: unknown) {
  const def = editableDef();
  const self = selectedStepId.value;
  if (!def || !self) return;
  const r = setStepParam(def, self, name, value);
  if (!r.ok) {
    applyEdit(r);
    return;
  }
  let next = r.def;
  const linked: string[] = [];
  if (isBindValue(value)) {
    const ancestors = ancestorsByAfter(next, self);
    stepHeadsOfBind(value.bind)
      .filter((head) => head !== self && !ancestors.has(head) && findStep(next, head))
      .forEach((head) => {
        const c = connectSteps(next, head, self);
        if (c.ok) {
          next = c.def;
          linked.push(head);
        }
      });
  }
  commit({ def: next }, linked.length ? undefined : `param:${self}:${name}`);
  if (linked.length) {
    message.info(t('workflowDefinition.autoLinked', { steps: linked.join(', ') }));
  }
}

function onSetField(field: string, value: unknown) {
  const def = editableDef();
  const self = selectedStepId.value;
  if (!def || !self) return;
  applyEdit(setStepField(def, self, field, value), `field:${self}:${field}`);
}

function onPanelDisconnect(source: string) {
  const def = editableDef();
  if (!def || !selectedStepId.value) return;
  applyEdit(disconnectSteps(def, source, selectedStepId.value));
}

// ---------------------------------------------------------------------------
// 输入与输出
// ---------------------------------------------------------------------------

function onSetDefField(field: 'inputs' | 'outputs', value: Record<string, unknown>) {
  const def = editableDef();
  if (!def) return;
  commit({ def: setDefinitionField(def, field, value) }, `def:${field}`);
}

function onRenameInput(oldName: string, newName: string) {
  const def = editableDef();
  if (!def) return;
  applyEdit(renameInput(def, oldName, newName));
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
    problemsOpen.value = true;
    return undefined;
  }
}

/** JSON 编辑器输入：连续输入合成一条撤销快照（编辑器内的 Ctrl+Z 由编辑器自己处理） */
function onEdit(v: string) {
  if (isReadonly.value || v === text.value) return;
  commit({ text: v }, 'json');
}

function formatJson() {
  try {
    commit({ text: JSON.stringify(JSON.parse(text.value), null, 2) });
  } catch (e) {
    resultOk.value = false;
    resultMsg.value = t('workflowDefinition.invalidJson', { msg: (e as Error).message });
    errors.value = [];
    message.warning(resultMsg.value);
  }
}

async function onValidateClick() {
  const ok = await doValidate();
  if (ok) message.success(t('workflowDefinition.validateOk'));
  else if (resultMsg.value) message.warning(resultMsg.value);
}

/** 服务端校验；返回是否通过 */
async function doValidate(): Promise<boolean> {
  const def = parseText();
  if (def === undefined) return false;
  validating.value = true;
  try {
    const snapshotText = text.value;
    const res = await validateWorkflowDefinition(id, def);
    errors.value = Array.isArray(res?.errors) ? res.errors : [];
    resultOk.value = !!res?.valid;
    if (res?.valid) {
      validatedText.value = snapshotText;
      resultMsg.value = t('workflowDefinition.validateOk');
    } else {
      validatedText.value = null;
      resultMsg.value = t('workflowDefinition.validateFailed', { count: errors.value.length });
      problemsOpen.value = true;
    }
    return !!res?.valid;
  } catch {
    return false;
  } finally {
    validating.value = false;
  }
}

/** 发布前总是先跑一次服务端校验（最终把关），通过后再确认发布 */
async function doPublish() {
  if (isReadonly.value) return;
  const ok =
    validatedText.value !== null && validatedText.value === text.value ? true : await doValidate();
  if (!ok) {
    message.warning(t('workflowDefinition.mustValidate'));
    tab.value = 'canvas';
    problemsOpen.value = true;
    return;
  }
  const def = parseText();
  if (def === undefined) return;
  const publishedText = text.value;
  Modal.confirm({
    title: t('workflowDefinition.saveConfirm', {
      version: (detail.value?.currentVersion ?? 0) + 1,
    }),
    async onOk() {
      publishing.value = true;
      try {
        const res = await publishWorkflowDefinition(id, def);
        const version = res?.version ?? '';
        message.success(t('workflowDefinition.publishOk', { version }));
        resultOk.value = true;
        resultMsg.value = t('workflowDefinition.publishOk', { version });
        errors.value = [];
        baselineText.value = normalize(publishedText);
        await refreshMeta();
      } catch (e) {
        const errs = publishErrorsOf(e);
        if (errs) {
          errors.value = errs;
          resultOk.value = false;
          resultMsg.value = t('workflowDefinition.publishFailed', { count: errs.length });
          validatedText.value = null;
          tab.value = 'canvas';
          problemsOpen.value = true;
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
  closeFloating();
  tab.value = 'canvas';
  nextTick(() => fitView());
}

function backToEdit() {
  viewingVersion.value = null;
  clearSelection();
  nextTick(() => fitView());
}

function loadToEditor() {
  const content = readonlyText.value;
  viewingVersion.value = null;
  commit({ text: content });
  validatedText.value = null;
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
        baselineText.value = normalize(pretty(detail.value?.content ?? null));
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

/**
 * 工作流工具总览（scope=all：网关全部模型组的就绪与价格）：用于就绪徽标与模型目录。
 * 旧后端忽略 scope 只返回已引用的组，其余组就绪/价格显示未知；失败（含 404）静默为空表。
 */
async function loadWorkflowTools() {
  try {
    const rows = await listWorkflowTools('all');
    toolByModelGroup.value = new Map(rows.map((r) => [r.modelGroup, r] as const));
  } catch {
    toolByModelGroup.value = new Map();
  }
}

// ---------------------------------------------------------------------------
// 未发布修改的离开确认（路由切换与关闭/刷新浏览器）
// ---------------------------------------------------------------------------

onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('workflowDefinition.leaveConfirm'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
});

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return;
  e.preventDefault();
  e.returnValue = '';
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('mousedown', onWindowMouseDown, true);
  window.addEventListener('beforeunload', onBeforeUnload);
  void loadWorkflowTools();
  try {
    await refreshMeta();
    text.value = pretty(detail.value?.content ?? null);
    baselineText.value = normalize(text.value);
    layout.value = sanitizeLayout(detail.value?.layout);
    // 类型名称清单失败不影响已载入的草稿（只是少了 kind 校验与面板条目）
    const [names] = await Promise.all([
      listWorkflowStepKinds().catch(() => [] as string[]),
      loadKindSchemas(),
    ]);
    stepKinds.value = names;
  } catch {
    message.error(t('workflowDefinition.loadFailed'));
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousedown', onWindowMouseDown, true);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (edgeHoverTimer) clearTimeout(edgeHoverTimer);
  // 防抖中的坐标保存：卸载时立即发出（不丢最后一次拖动），不再留定时器在卸载后触发
  if (layoutTimer) {
    clearTimeout(layoutTimer);
    void saveLayout();
  }
  jsonResize?.disconnect();
});
</script>

<style scoped>
.wd-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 560px;
  min-width: 0;
  background: var(--color-bg-container, #fff);
  border-radius: 8px;
  overflow: hidden;
}
.wd-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border, #f0f0f0);
}
.wd-title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.wd-name {
  font-size: 16px;
  font-weight: 600;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wd-code {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
}
.wd-dirty {
  font-size: 12px;
  color: #d46b08;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.wd-dirty .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fa8c16;
  display: inline-block;
}
.wd-banner {
  margin: 8px 16px 0;
}
.wd-tabs {
  padding: 0 16px;
  flex-shrink: 0;
}
.wd-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
.wd-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border, #f0f0f0);
}
.wd-canvas-tab {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.wd-panes {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px minmax(320px, 1fr) 360px;
  overflow-x: auto;
}
.wd-palette,
.wd-props {
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}
.wd-palette {
  border-right: 1px solid var(--color-border, #f0f0f0);
}
.wd-props {
  border-left: 1px solid var(--color-border, #f0f0f0);
}
.pane-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.pane-hint {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
  margin-bottom: 8px;
  line-height: 1.5;
}
.palette-group {
  margin-bottom: 12px;
}
.palette-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #666);
  margin-bottom: 6px;
}
.palette-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-left: 3px solid #1677ff;
  border-radius: 6px;
  background: var(--color-bg-container, #fff);
  cursor: grab;
  user-select: none;
}
.palette-item:hover {
  border-color: #1677ff;
}
.wd-palette.disabled .palette-item {
  cursor: not-allowed;
  opacity: 0.55;
}
.wd-palette.disabled .palette-item:hover {
  border-color: var(--color-border, #e5e5e5);
  border-left-color: #1677ff;
}
.pi-name {
  font-size: 13px;
  font-weight: 500;
}
.pi-desc {
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.palette-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 6px;
}
.catalog-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.manage-link {
  flex-shrink: 0;
  font-size: 12px;
}
.catalog-spin {
  display: block;
  margin: 16px auto;
}
.catalog-error {
  font-size: 12px;
  color: #cf1322;
}
.op-code {
  font-weight: 400;
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
  margin-left: 4px;
}
.pi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
}
.pi-row .pi-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.pi-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
}
.pi-code {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.palette-item.off {
  opacity: 0.6;
}
.wd-canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
}
.canvas-overlay {
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.canvas-overlay > * {
  pointer-events: auto;
}
/* 正在连线时显示所有节点的连接点 */
.wd-canvas.connecting :deep(.sn-handle) {
  opacity: 1;
}
.wd-canvas.readonly {
  background: var(--color-bg-layout, #f5f5f5);
}
.wd-canvas.readonly :deep(.vue-flow__pane) {
  cursor: default;
}
.canvas-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.tools-sep {
  width: 1px;
  height: 16px;
  background: var(--color-border, #e5e5e5);
  margin: 0 4px;
}
.zoom-text {
  min-width: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}
.wd-floating {
  position: absolute;
  z-index: 20;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}
.ctx-menu {
  min-width: 170px;
  padding: 4px;
}
.ctx-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.ctx-item:hover {
  background: rgba(22, 119, 255, 0.08);
}
.ctx-item.danger {
  color: #cf1322;
}
.ctx-item.disabled {
  color: var(--color-text-tertiary, #bbb);
  pointer-events: none;
}
.ctx-key {
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
}
.step-picker {
  width: 280px;
  padding: 8px;
}
.picker-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.picker-list {
  max-height: 260px;
  overflow-y: auto;
  margin-top: 6px;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.picker-item:hover {
  background: rgba(22, 119, 255, 0.08);
}
.picker-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.picker-kind {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-tertiary, #999);
}
.multi-select {
  padding: 8px 0;
}
.canvas-alert {
  position: absolute;
  top: 44px;
  left: 12px;
  right: 12px;
  z-index: 5;
}
.canvas-hint {
  position: absolute;
  bottom: 8px;
  left: 56px;
  right: 12px;
  z-index: 4;
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
  pointer-events: none;
}
.graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--color-text-tertiary, #999);
  pointer-events: none;
  padding: 24px;
  text-align: center;
}
.graph-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
  background: var(--color-bg-container, rgba(255, 255, 255, 0.85));
  padding: 2px 8px;
  border-radius: 4px;
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
.wd-problems {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border, #f0f0f0);
  background: var(--color-bg-layout, #fafafa);
}
.problems-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
}
.problems-title {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.problems-result {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.problems-toggle {
  margin-left: auto;
  font-size: 12px;
  color: #1677ff;
}
.problems-body {
  max-height: 180px;
  overflow-y: auto;
  padding: 0 16px 10px;
  font-size: 12px;
}
.problems-note {
  margin-top: 6px;
}
.ok-text {
  color: #389e0d;
}
.err-text {
  color: #cf1322;
}
.wd-scroll-tab {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}
.wd-json-tab {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
}
.json-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.json-editor-wrap {
  flex: 1;
  min-height: 240px;
  overflow: hidden;
}
.json-foot {
  font-size: 12px;
  line-height: 1.7;
  margin-top: 8px;
  max-height: 96px;
  overflow-y: auto;
}
.versions-wrap {
  max-width: 760px;
}
.current-version-box {
  padding: 12px 16px;
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 8px;
}
.current-version {
  font-size: 20px;
  font-weight: 600;
}
.version-item {
  cursor: pointer;
}
.version-item.viewing {
  background: rgba(22, 119, 255, 0.08);
}
.version-no {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
}
.error-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}
.error-list li {
  padding: 3px 0;
}
.error-list .clickable {
  cursor: pointer;
}
.error-list .clickable:hover {
  color: #1677ff;
}
</style>
