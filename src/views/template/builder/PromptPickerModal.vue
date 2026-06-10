<!-- src/views/template/builder/PromptPickerModal.vue -->
<!--
  PromptPickerModal — 从提示词库中选择一条提示词，
  供模板的 prompt-input widget 引用其内容与变量。
-->
<template>
  <a-modal
    :open="open"
    :title="$t('template.referencePrompt')"
    :width="720"
    :ok-button-props="{ disabled: !selectedId }"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="prompt-picker">
      <a-input
        v-model:value="keyword"
        :placeholder="$t('prompt.namePlaceholder')"
        allow-clear
        @press-enter="loadData"
        @change="onKeywordChange"
      >
        <template #prefix>
          <Icon icon="antdv-next:SearchOutlined" />
        </template>
      </a-input>

      <a-spin :spinning="loading">
        <div v-if="list.length" class="prompt-picker__list">
          <div
            v-for="item in list"
            :key="item.id"
            class="prompt-picker__item"
            :class="{ 'prompt-picker__item--active': selectedId === item.id }"
            @click="selectedId = item.id"
          >
            <div class="prompt-picker__head">
              <span class="prompt-picker__name">{{ item.name }}</span>
              <a-tag v-if="item.category">{{ item.category }}</a-tag>
            </div>
            <div class="prompt-picker__desc">{{ item.description || '-' }}</div>
            <div class="prompt-picker__content">{{ item.content }}</div>
          </div>
        </div>
        <a-empty v-else :description="$t('prompt.noPromptData')" />
      </a-spin>

      <a-checkbox v-model:checked="mapVariables" class="prompt-picker__map">
        {{ $t('template.mapVariablesToSlots') }}
      </a-checkbox>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { message } from 'antdv-next'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import { getPromptList, type PromptRecord } from '@/api/prompt'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'select', payload: { prompt: PromptRecord; mapVariables: boolean }): void
}>()

const keyword = ref('')
const loading = ref(false)
const list = ref<PromptRecord[]>([])
const selectedId = ref<string>('')
const mapVariables = ref(true)

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const res = await getPromptList({
      keyword: keyword.value || undefined,
      enabled: 1,
      page: 1,
      pageSize: 50,
    })
    list.value = res.list || []
  } catch {
    message.error($t('prompt.loadFailed'))
  } finally {
    loading.value = false
  }
}

function onKeywordChange(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadData, 300)
}

function handleConfirm(): void {
  const prompt = list.value.find(item => item.id === selectedId.value)
  if (!prompt) return
  emit('select', { prompt, mapVariables: mapVariables.value })
  emit('update:open', false)
}

function handleCancel(): void {
  emit('update:open', false)
}

watch(
  () => props.open,
  (value) => {
    if (value) {
      selectedId.value = ''
      keyword.value = ''
      loadData()
    }
  },
)
</script>

<style scoped>
.prompt-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.prompt-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-height: 420px;
  overflow-y: auto;
}

.prompt-picker__item {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius, 6px);
  cursor: pointer;
  transition: all 0.2s;
}

.prompt-picker__item:hover {
  border-color: var(--color-primary);
}

.prompt-picker__item--active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg, rgba(22, 119, 255, 0.06));
}

.prompt-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.prompt-picker__name {
  font-weight: 600;
}

.prompt-picker__desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: var(--spacing-xs) 0;
}

.prompt-picker__content {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.prompt-picker__map {
  font-size: var(--font-size-sm);
}
</style>
