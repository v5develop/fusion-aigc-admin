<template>
  <div
    class="step-node"
    :class="{
      'has-error': data.hasError,
      selected: data.selected,
      conditional: data.hasCondition,
      readonly: !data.connectable,
    }"
    :style="{ '--group-color': color }"
  >
    <Handle
      type="target"
      :position="Position.Left"
      :connectable="data.connectable"
      class="sn-handle"
    />
    <div class="sn-head">
      <span class="sn-icon"><component :is="icon" /></span>
      <div class="sn-text">
        <div class="sn-title" :title="data.kind">{{ data.title }}</div>
        <div class="sn-id">
          <code>{{ data.stepId }}</code>
          <span v-if="data.hasCondition" class="sn-cond">{{
            $t('workflowDefinition.graphCondition')
          }}</span>
        </div>
      </div>
      <span v-if="data.issueCount" class="sn-issues" :title="data.issueTitle">
        {{ data.issueCount }}
      </span>
    </div>
    <div v-if="data.modelGroup" class="sn-badge">
      <template v-if="data.modelGroup.kind === 'literal'">
        <span v-if="data.modelGroupName" class="sn-mg sn-mg-name" :title="data.modelGroup.value">{{
          data.modelGroupName
        }}</span>
        <code v-else class="sn-mg">{{ data.modelGroup.value }}</code>
      </template>
      <ModelGroupBadge :model-group="data.modelGroup" :tool="data.tool" compact />
    </div>
    <Handle
      type="source"
      :position="Position.Right"
      :connectable="data.connectable"
      class="sn-handle"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkflowToolRow } from '@/api/workflow-tools';
import type { ModelGroupRef } from '@/views/workflow-definition/graph';

import {
  AppstoreOutlined,
  EditOutlined,
  PictureOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons';
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';

import { KIND_GROUP_COLOR, kindGroupOf, type KindGroup } from '@/views/workflow-definition/kinds';
import ModelGroupBadge from '@/views/workflow-definition/ModelGroupBadge.vue';

export interface StepNodeData {
  kind: string;
  title: string;
  stepId: string;
  hasCondition: boolean;
  modelGroup?: ModelGroupRef;
  /** 字面量模型组的显示名（目录或总览里查得到时） */
  modelGroupName?: string;
  tool?: WorkflowToolRow;
  issueCount: number;
  issueTitle?: string;
  hasError: boolean;
  selected: boolean;
  connectable: boolean;
}

const props = defineProps<{ data: StepNodeData }>();

const ICONS: Record<KindGroup, unknown> = {
  generate: ThunderboltOutlined,
  prompt: EditOutlined,
  media: PictureOutlined,
  deliver: SendOutlined,
  other: AppstoreOutlined,
};

const group = computed(() => kindGroupOf(props.data.kind));
const color = computed(() => KIND_GROUP_COLOR[group.value]);
const icon = computed(() => ICONS[group.value]);
</script>

<style scoped>
.step-node {
  width: 220px;
  box-sizing: border-box;
  padding: 8px 10px 8px 12px;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #d9d9d9);
  border-left: 4px solid var(--group-color);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  font-size: 12px;
  text-align: left;
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}
.step-node:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}
.step-node.conditional {
  border-style: dashed;
  border-left-style: solid;
}
.step-node.selected {
  border-color: #1677ff;
  border-left-color: var(--group-color);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.25);
}
.step-node.has-error {
  border-color: #ff4d4f;
  background: rgba(255, 77, 79, 0.05);
}
.step-node.readonly {
  background: var(--color-bg-layout, #fafafa);
}
.sn-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.sn-icon {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 12%, transparent);
}
.sn-text {
  flex: 1;
  min-width: 0;
}
.sn-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #1f1f1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sn-id {
  color: var(--color-text-tertiary, #999);
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.sn-id code {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sn-cond {
  font-size: 11px;
  color: #d46b08;
  flex-shrink: 0;
}
.sn-issues {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  font-weight: 600;
}
.sn-badge {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.sn-mg {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}
.sn-mg-name {
  font-weight: 500;
  color: var(--color-text-secondary, #595959);
}
/* 连接点：悬停节点或正在连线时显示；只读时置灰 */
.step-node :deep(.sn-handle) {
  width: 10px;
  height: 10px;
  background: #fff;
  border: 2px solid var(--group-color);
  opacity: 0;
  transition: opacity 0.15s;
}
.step-node:hover :deep(.sn-handle),
.step-node.selected :deep(.sn-handle) {
  opacity: 1;
}
.step-node.readonly :deep(.sn-handle) {
  border-color: #bfbfbf;
  background: #f0f0f0;
  cursor: not-allowed;
}
</style>
