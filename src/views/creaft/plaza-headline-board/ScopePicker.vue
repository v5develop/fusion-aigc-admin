<template>
  <div>
    <a-checkbox
      v-if="allowAll"
      :checked="all"
      @change="(e: { target: { checked: boolean } }) => emit('update:all', e.target.checked)"
    >
      所有适用行业（该模板所属的全部行业榜）
    </a-checkbox>
    <a-checkbox-group
      :value="scopes"
      :options="options"
      :disabled="all"
      style="display: flex; flex-wrap: wrap; margin-top: 4px"
      @update:value="(v: (string | number | boolean)[]) => emit('update:scopes', v.map(String))"
    />
    <div v-if="!options.length" class="muted">该模板没有所属行业，无法设置范围</div>
    <div v-else class="muted">只列该模板所属的行业；全站总榜不可写规则</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  scopes: string[];
  all?: boolean;
  allowAll?: boolean;
  options: { label: string; value: string }[];
}>();
const emit = defineEmits<{
  (e: 'update:scopes', v: string[]): void;
  (e: 'update:all', v: boolean): void;
}>();
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
  margin-top: 4px;
}
</style>
