<template>
  <div v-if="loading" class="children-loading">
    <a-spin />
  </div>
  <div v-else-if="error" class="children-error">
    <a-alert type="error" show-icon :message="error" description="点击重试或收起后重新展开" />
    <a-button size="small" @click="load">重试</a-button>
  </div>
  <slot v-else :data="data" />
</template>

<script setup lang="ts">
import type { CreationTask } from '@/api/creation-task';

import { ref, onMounted, onBeforeUnmount } from 'vue';

import { getCreationTaskChildren } from '@/api/creation-task';

const props = defineProps<{ taskId: string }>();

const loading = ref(false);
const error = ref('');
const data = ref<CreationTask[]>([]);

let abortController: AbortController | null = null;

async function load() {
  abortController?.abort();
  abortController = new AbortController();

  loading.value = true;
  error.value = '';
  try {
    const res = await getCreationTaskChildren(props.taskId, {
      signal: abortController.signal,
      timeout: 10000,
    });
    data.value = res || [];
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
    error.value = err?.message || '加载子任务失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
});

onBeforeUnmount(() => {
  abortController?.abort();
});
</script>

<style scoped>
.children-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.children-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
}
</style>
