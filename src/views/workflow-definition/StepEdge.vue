<template>
  <BaseEdge
    :id="id"
    :path="pathInfo[0]"
    :marker-end="markerEnd"
    :interaction-width="24"
    :style="edgeStyle"
  />
  <EdgeLabelRenderer v-if="data?.deletable && (data?.hovered || selected)">
    <div
      class="edge-del nodrag nopan"
      :style="{
        transform: `translate(-50%, -50%) translate(${pathInfo[1]}px, ${pathInfo[2]}px)`,
      }"
      :title="data.deleteTitle"
      @mouseenter="data.onHover?.(id, true)"
      @mouseleave="data.onHover?.(id, false)"
      @click.stop="data.onDelete?.(id)"
    >
      ×
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import type { Position } from '@vue-flow/core';
import type { CSSProperties } from 'vue';

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core';
import { computed } from 'vue';

export interface StepEdgeData {
  /** after：控制流（实线，可删）；data：数据流（虚线，改绑定才能断） */
  type: 'after' | 'data';
  hovered: boolean;
  deletable: boolean;
  deleteTitle?: string;
  onDelete?: (id: string) => void;
  onHover?: (id: string, hovering: boolean) => void;
}

const props = defineProps<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  markerEnd?: string;
  selected?: boolean;
  data?: StepEdgeData;
}>();

const pathInfo = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  }),
);

const edgeStyle = computed<CSSProperties>(() => {
  const active = props.selected || props.data?.hovered;
  return {
    stroke: props.selected ? '#1677ff' : active ? '#4096ff' : '#8c8c8c',
    strokeWidth: props.selected ? 2.5 : active ? 2.2 : 1.5,
    strokeDasharray: props.data?.type === 'data' ? '6 4' : undefined,
  };
});
</script>

<style scoped>
.edge-del {
  position: absolute;
  pointer-events: all;
  width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  font-size: 14px;
  border-radius: 50%;
  background: #fff;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  user-select: none;
}
.edge-del:hover {
  background: #ff4d4f;
  color: #fff;
}
</style>
