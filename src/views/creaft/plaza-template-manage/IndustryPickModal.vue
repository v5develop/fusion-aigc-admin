<template>
  <a-modal
    :open="open"
    :title="title"
    :ok-button-props="{
      disabled: mode !== 'replaceIndustries' && !picked.length,
    }"
    :confirm-loading="loading"
    @ok="$emit('ok', picked)"
    @cancel="$emit('update:open', false)"
  >
    <a-tree-select
      v-model:value="picked"
      :tree-data="tree"
      multiple
      tree-default-expand-all
      placeholder="选择行业"
      style="width: 100%"
    />
    <a-alert
      v-if="mode === 'replaceIndustries'"
      type="warning"
      show-icon
      style="margin-top: 10px"
      message="覆盖会替换所选模板现有的全部行业；不选任何行业 = 清空，模板将对用户不可见"
    />
    <a-alert
      v-else-if="mode === 'unassign'"
      type="info"
      show-icon
      style="margin-top: 10px"
      message="只移出所选行业的关系，模板本身不受影响；移出最后一个行业后会回到「待分配」"
    />
  </a-modal>
</template>

<script setup lang="ts">
import type { IndustryNode } from '@/api/plaza-admin';

import { computed, ref, watch } from 'vue';

export type IndustryOpMode = 'assign' | 'unassign' | 'replaceIndustries';

const props = defineProps<{
  open: boolean;
  mode: IndustryOpMode;
  /** 本次操作的模板数 */
  count: number;
  industries: IndustryNode[];
  loading?: boolean;
}>();
defineEmits<{ 'update:open': [v: boolean]; ok: [ids: number[]] }>();

const picked = ref<number[]>([]);
watch(
  () => props.open,
  (v) => {
    if (v) picked.value = [];
  },
);

const title = computed(
  () =>
    ({
      assign: '挂到行业',
      unassign: '移出行业',
      replaceIndustries: '覆盖行业',
    })[props.mode] + `（${props.count} 个模板）`,
);
const tree = computed(() =>
  props.industries.map((r) => ({
    title: r.enabled ? r.name : `${r.name}（停用）`,
    value: r.id,
    children: (r.children ?? []).map((c) => ({ title: c.name, value: c.id })),
  })),
);
</script>
