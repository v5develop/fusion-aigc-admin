<!-- src/views/template/builder/EditorHeader.vue -->
<!--
  EditorHeader — 构建器顶部操作栏（spec 5.1）。
  左侧：返回按钮 + 模板名称输入；右侧：预览 / 保存草稿 / 发布。
-->
<template>
  <header class="editor-header">
    <div class="editor-header__left">
      <a-button type="text" class="editor-header__back" @click="emit('back')">
        <Icon icon="antdv-next:ArrowLeftOutlined" />
      </a-button>
      <a-input
        class="editor-header__name"
        :value="name"
        :placeholder="$t('template.namePlaceholder')"
        :bordered="false"
        @update:value="emit('update:name', $event)"
      />
    </div>

    <a-space class="editor-header__actions">
      <a-button @click="emit('preview')">
        <Icon icon="antdv-next:EyeOutlined" />
        {{ $t('template.preview') }}
      </a-button>
      <a-button :loading="saving" @click="emit('save')">
        {{ $t('template.saveDraft') }}
      </a-button>
      <a-button type="primary" :loading="saving" @click="emit('publish')">
        {{ $t('template.publish') }}
      </a-button>
    </a-space>
  </header>
</template>

<script setup lang="ts">
import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'

defineProps<{
  name: string
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'update:name', value: string): void
  (e: 'preview'): void
  (e: 'save'): void
  (e: 'publish'): void
}>()
</script>

<style scoped>
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--spacing-md);
  background: var(--color-bg-container);
  border-bottom: 1px solid var(--color-border-secondary);
}

.editor-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  flex: 1;
}

.editor-header__back {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.editor-header__name {
  max-width: 320px;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.editor-header__actions {
  flex-shrink: 0;
}
</style>
