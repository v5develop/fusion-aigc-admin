<template>
  <span
    v-if="modelGroup?.kind === 'runtime'"
    class="mg-runtime"
    :class="{ compact }"
    :title="$t('workflowDefinition.modelGroupRuntimeTip')"
  >
    {{ $t('workflowDefinition.modelGroupRuntime') }}
  </span>
  <a-tooltip v-else-if="status" :title="status.tip">
    <a-tag :color="status.color" class="mg-tag" :class="{ compact }">{{ status.label }}</a-tag>
  </a-tooltip>
</template>

<script setup lang="ts">
import type { WorkflowToolRow } from '@/api/workflow-tools';
import type { ModelGroupRef } from '@/views/workflow-definition/graph';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * gateway.call 步骤的模型组就绪徽标：字面量模型组查工作流工具总览给出就绪/未就绪/未知；
 * 绑定在运行时才解析，只显示灰字说明；总览里查不到（接口缺失或该组未被已发布定义引用）时不显示。
 */
const props = defineProps<{
  modelGroup?: ModelGroupRef;
  tool?: WorkflowToolRow;
  /** 画布节点内用的紧凑尺寸 */
  compact?: boolean;
}>();

const { t } = useI18n();

const status = computed(() => {
  if (props.modelGroup?.kind !== 'literal' || !props.tool) return null;
  const { ready, reason } = props.tool;
  const group = props.modelGroup.value;
  if (ready === true) {
    return { color: 'green', label: t('workflowDefinition.tools.statusReady'), tip: group };
  }
  if (ready === false) {
    return {
      color: 'red',
      label: t('workflowDefinition.tools.statusNotReady'),
      tip: `${group}: ${reason || t('workflowDefinition.tools.noReason')}`,
    };
  }
  return {
    color: 'default',
    label: t('workflowDefinition.tools.statusUnknown'),
    tip: t('workflowDefinition.tools.unknownTip'),
  };
});
</script>

<style scoped>
.mg-runtime {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.mg-tag {
  margin-inline-end: 0;
}
.mg-tag.compact {
  margin-inline-start: 6px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  vertical-align: middle;
}
.mg-runtime.compact {
  margin-inline-start: 6px;
  font-size: 11px;
}
</style>
