<!-- src/views/template/renderer/TemplateRenderer.vue -->
<!--
  TemplateRenderer — C-end 模板渲染器。

  读取一个 TemplateConfig，将其渲染成可交互的 AI 工具页面。
  - 支持 4 种布局模式：stacked / sidebar-right / sidebar-left / two-column-main
  - 渲染模板标题 + 描述
  - primary/inline 区域 → 主内容区，sidebar 区域 → 粘性侧边栏，full 区域 → 全宽
  - 收集所有 widget 的 formValues，拼接 promptTemplate 后通过 generate 事件抛出
-->
<template>
  <div class="template-renderer" :class="[`layout--${config.layout.mode}`]">
    <div class="renderer-container" :style="{ maxWidth: (config.layout.maxWidth || 1200) + 'px' }">
      <!-- 标题区域 -->
      <div v-if="config.layout.showTitle !== false" class="template-header">
        <h1>{{ config.name }}</h1>
        <p v-if="config.layout.showDescription !== false && config.description">
          {{ config.description }}
        </p>
      </div>

      <!-- 主体布局 -->
      <div class="renderer-body" :class="layoutBodyClass">
        <div class="main-column">
          <SectionRenderer
            v-for="section in primarySections"
            :key="section.id"
            :section="section"
            :mode="'viewer'"
            :form-values="formValues"
            @update:form-values="onFormValuesUpdate"
          />
        </div>

        <div v-if="sidebarSections.length > 0" class="sidebar-column">
          <SectionRenderer
            v-for="section in sidebarSections"
            :key="section.id"
            :section="section"
            :mode="'viewer'"
            :form-values="formValues"
            @update:form-values="onFormValuesUpdate"
          />
        </div>
      </div>

      <!-- 全宽区域 -->
      <div v-if="fullSections.length > 0" class="full-column">
        <SectionRenderer
          v-for="section in fullSections"
          :key="section.id"
          :section="section"
          :mode="'viewer'"
          :form-values="formValues"
          @update:form-values="onFormValuesUpdate"
        />
      </div>

      <!-- 生成按钮 -->
      <div class="submit-bar">
        <a-button type="primary" size="large" :loading="generating" @click="handleGenerate">
          <Icon icon="antdv-next:ThunderboltOutlined" />
          {{ $t('template.generate') }}
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import Icon from '@/components/Icon/index.vue'
import { $t } from '@/locales'
import SectionRenderer from '@/views/template/renderer/SectionRenderer.vue'

import type { TemplateConfig } from '@/types/template-builder'

const props = defineProps<{
  config: TemplateConfig
}>()

const emit = defineEmits<{
  (e: 'generate', prompt: string, params: Record<string, unknown>): void
}>()

const generating = ref(false)
const formValues = reactive<Record<string, unknown>>({})

function bySort(a: { sort: number }, b: { sort: number }): number {
  return a.sort - b.sort
}

const primarySections = computed(() =>
  props.config.sections
    .filter((s) => s.role === 'primary' || s.role === 'inline')
    .sort(bySort),
)

const sidebarSections = computed(() =>
  props.config.sections.filter((s) => s.role === 'sidebar').sort(bySort),
)

const fullSections = computed(() =>
  props.config.sections.filter((s) => s.role === 'full').sort(bySort),
)

const layoutBodyClass = computed<string>(() => {
  if (sidebarSections.value.length === 0) return 'single-column'
  if (props.config.layout.mode === 'sidebar-right') return 'with-sidebar-right'
  return 'with-sidebar-left'
})

function onFormValuesUpdate(key: string, value: unknown): void {
  formValues[key] = value
}

function buildPrompt(): string {
  let prompt = props.config.promptTemplate
  for (const [key, value] of Object.entries(formValues)) {
    if (value === null || value === undefined) continue
    // prompt-input 的值是 { slotKey: value, ... } 结构，需要按 slot key 替换
    if (isPromptInputValue(value)) {
      prompt = replacePromptInputSlots(prompt, value as Record<string, unknown>)
      continue
    }
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    const strValue = typeof value === 'object'
      ? getTextFromChipValue(value)
      : extractTextValue(String(value))
    prompt = prompt.replace(regex, strValue)
  }
  return prompt
}

/** 判断是否为 prompt-input widget 的值形态 */
function isPromptInputValue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  // prompt-input 的值包含 slot key → value 映射，不含 chips/text 等 chip-input 特征字段
  return !('chips' in obj) && !('text' in obj) && Object.keys(obj).length > 0
}

/** 替换 prompt-input 模板中的 {{slotKey}} */
function replacePromptInputSlots(prompt: string, slotValues: Record<string, unknown>): string {
  for (const [slotKey, slotValue] of Object.entries(slotValues)) {
    if (slotValue === null || slotValue === undefined) continue
    const regex = new RegExp(`\\{\\{${slotKey}\\}\\}`, 'g')
    // chip 多选值为数组 → 以「、」连接（与 PromptEditor 渲染一致）
    const strValue = Array.isArray(slotValue)
      ? slotValue.map(v => String(v)).join('、')
      : typeof slotValue === 'object'
        ? extractObjectValue(slotValue)
        : String(slotValue)
    prompt = prompt.replace(regex, strValue)
  }
  return prompt
}

/** 从对象值中提取文本（图片上传返回 {url, name, size}，取 name 或 url） */
function extractObjectValue(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const obj = value as Record<string, unknown>
  if (typeof obj.name === 'string' && obj.name) return obj.name
  if (typeof obj.url === 'string' && obj.url) return obj.url
  return ''
}

/** chip-input 值形态: { text: string, chips: string[] } */
function getTextFromChipValue(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    const chips = Array.isArray(v.chips) ? v.chips.filter((c): c is string => typeof c === 'string') : []
    const text = typeof v.text === 'string' ? v.text : ''
    return chips.length > 0 ? `${text} ${chips.join(' ')}`.trim() : text
  }
  return ''
}

/** 多选 select/chip 值 → 「、」拼接（与 PromptEditor 渲染一致） */
function extractTextValue(raw: string): string {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.join('、')
    } catch { /* ignore */ }
  }
  return raw
}

async function handleGenerate(): Promise<void> {
  generating.value = true
  try {
    const prompt = buildPrompt()
    emit('generate', prompt, { ...formValues })
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.template-renderer {
  min-height: 100vh;
  background: var(--color-bg-layout);
  padding: var(--spacing-xl) var(--spacing-lg);
}

.renderer-container {
  margin: 0 auto;
}

.template-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.template-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs);
}

.template-header p {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── 单列 ────────────────────────────── */
.single-column {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── 右侧面板 ────────────────────────── */
.with-sidebar-right {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--spacing-lg);
  align-items: start;
}

.with-sidebar-right .sidebar-column {
  position: sticky;
  top: var(--spacing-lg);
}

/* ── 左侧面板 ────────────────────────── */
.with-sidebar-left {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: var(--spacing-lg);
  align-items: start;
}

.with-sidebar-left .sidebar-column {
  position: sticky;
  top: var(--spacing-lg);
}

/* ── 全宽 / 提交栏 ──────────────────── */
.full-column,
.submit-bar {
  margin-top: var(--spacing-lg);
}

.submit-bar {
  display: flex;
  justify-content: center;
}

/* ── 响应式 ──────────────────────────── */
@media (max-width: 1024px) {
  .with-sidebar-right,
  .with-sidebar-left {
    grid-template-columns: 1fr;
  }

  .sidebar-column {
    position: static !important;
    order: 999;
  }
}
</style>
