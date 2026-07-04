<template>
  <div class="prompt-editor">
    <div class="editor-header">
      <a-space>
        <a-button @click="handleBack">
          <Icon icon="antdv-next:ArrowLeftOutlined" />
          {{ $t('common.back') }}
        </a-button>
        <span class="editor-title">
          {{ isEdit ? $t('prompt.editTitle') : $t('prompt.createTitle') }}
        </span>
      </a-space>
      <a-space>
        <a-button type="primary" :loading="saving" @click="handleSave">
          {{ $t('common.save') }}
        </a-button>
      </a-space>
    </div>

    <div class="editor-body">
      <div class="editor-main">
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="$t('prompt.promptName')" required>
                <a-input v-model:value="form.name" :placeholder="$t('prompt.namePlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="$t('prompt.code')">
                <a-input v-model:value="form.code" :placeholder="$t('prompt.codePlaceholder')" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="$t('prompt.category')">
                <a-select v-model:value="form.category" :options="categoryOptions" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item :label="$t('common.status')">
                <a-switch
                  v-model:checked="enabledChecked"
                  :checked-children="$t('common.enabled')"
                  :un-checked-children="$t('common.disabled')"
                />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item :label="$t('prompt.sortOrder')">
                <a-input-number
                  v-model:value="form.sortOrder"
                  :min="0"
                  style="width: 100%"
                  :placeholder="$t('prompt.sortOrderPlaceholder')"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item :label="$t('prompt.tags')">
            <a-select
              v-model:value="form.tags"
              mode="tags"
              :placeholder="$t('prompt.tagsPlaceholder')"
              :token-separators="[',']"
            />
          </a-form-item>

          <a-form-item :label="$t('prompt.description')">
            <a-textarea
              v-model:value="form.description"
              :rows="2"
              :placeholder="$t('prompt.descriptionPlaceholder')"
            />
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="$t('prompt.icon')">
                <a-input v-model:value="form.icon" :placeholder="$t('prompt.iconPlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="$t('prompt.coverImage')">
                <a-input
                  v-model:value="form.coverImage"
                  :placeholder="$t('prompt.coverImagePlaceholder')"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item :label="$t('prompt.content')" required>
            <div class="content-toolbar">
              <span class="toolbar-hint">{{ $t('prompt.insertSlotHint') }}</span>
              <a-space :size="4" wrap>
                <a-button
                  v-for="opt in slotTypeOptions"
                  :key="opt.value"
                  size="small"
                  @click="insertSlot(opt.value)"
                >
                  + {{ opt.label }}
                </a-button>
              </a-space>
            </div>
            <div class="content-toolbar" v-if="form.slots.length">
              <span class="toolbar-hint">{{ $t('prompt.insertExistingSlotHint') }}</span>
              <a-space :size="4" wrap>
                <a-tag
                  v-for="s in form.slots"
                  :key="s.key"
                  :color="slotColor(s.slotType)"
                  class="var-chip"
                  @click="insertSlotRef(s.key)"
                >
                  {{ slotChipLabel(s) }}
                </a-tag>
              </a-space>
            </div>
            <div
              ref="editorRef"
              class="prompt-content-editor"
              :class="{ 'is-empty': !form.content.trim() }"
              :data-placeholder="$t('prompt.contentPlaceholder')"
              contenteditable="true"
              @input="handleContentInput"
              @blur="handleContentBlur"
              @paste="handlePaste"
              @compositionstart="handleCompositionStart"
              @compositionend="handleCompositionEnd"
            />
            <div v-if="detectedKeys.length" class="detected-vars">
              <span>{{ $t('prompt.detectedSlots') }}:</span>
              <a-space :size="4" wrap>
                <a-tag v-for="key in detectedKeys" :key="key">{{ key }}</a-tag>
              </a-space>
              <a-button v-if="hasUndefinedSlots" type="link" size="small" @click="syncSlots">
                {{ $t('prompt.syncSlots') }}
              </a-button>
            </div>
          </a-form-item>

          <a-form-item :label="$t('prompt.slots')">
            <a-table
              :columns="slotColumns"
              :data-source="form.slots"
              :pagination="false"
              row-key="key"
              size="small"
            >
              <template #bodyCell="{ column, record, index }">
                <template v-if="column.dataIndex === 'key'">
                  <a-input
                    :value="record.key"
                    size="small"
                    @focus="onSlotKeyFocus(record)"
                    @update:value="(v: string) => (record.key = v)"
                    @blur="onSlotKeyRename(record)"
                  />
                </template>
                <template v-if="column.dataIndex === 'slotType'">
                  <a-select
                    v-model:value="record.slotType"
                    :options="slotTypeOptions"
                    size="small"
                    style="width: 100%"
                    @change="onSlotTypeChange(record)"
                  />
                </template>
                <template v-if="column.dataIndex === 'label'">
                  <a-input v-model:value="record.label" size="small" @blur="renderPromptEditor" />
                </template>
                <template v-if="column.dataIndex === 'required'">
                  <a-switch v-model:checked="record.required" size="small" />
                </template>
                <template v-if="column.key === 'config'">
                  <a-input
                    v-if="record.slotType === 'text'"
                    v-model:value="record.placeholder"
                    size="small"
                    :placeholder="$t('prompt.slotPlaceholder')"
                    @blur="renderPromptEditor"
                  />
                  <a-space
                    v-else-if="record.slotType === 'select' || record.slotType === 'chip'"
                    :size="4"
                    style="width: 100%"
                  >
                    <a-select
                      :value="optionLabels(record)"
                      mode="tags"
                      size="small"
                      style="width: 100%; min-width: 160px"
                      :placeholder="$t('prompt.slotOptionsPlaceholder')"
                      :token-separators="[',']"
                      @update:value="(val: string[]) => setOptions(record, val)"
                    />
                    <a-popover
                      v-if="record.options && record.options.length"
                      trigger="click"
                      placement="bottomRight"
                    >
                      <template #content>
                        <div class="option-value-editor">
                          <div class="option-value-editor__title">
                            {{ $t('prompt.slotOptionValueTitle') }}
                          </div>
                          <div
                            v-for="(opt, oi) in record.options"
                            :key="oi"
                            class="option-value-editor__row"
                          >
                            <span class="option-value-editor__label">{{ opt.label }}</span>
                            <a-input
                              :value="opt.value"
                              size="small"
                              :placeholder="opt.label"
                              @update:value="(v: string) => setOptionValue(record, oi, v)"
                            />
                          </div>
                        </div>
                      </template>
                      <a-button
                        type="link"
                        size="small"
                        :class="{ 'value-custom-active': !optionValueEqualsLabel(record) }"
                      >
                        {{ $t('prompt.slotOptionValueBtn') }}
                      </a-button>
                    </a-popover>
                    <a-tag v-if="record.slotType === 'chip'" color="orange">
                      {{ $t('prompt.slotChipMultipleHint') }}
                    </a-tag>
                  </a-space>
                  <span
                    v-else-if="record.slotType === 'separator'"
                    class="separator-config-hint"
                  >{{ $t('prompt.slotSeparatorHint') }}</span>
                  <a-space v-else-if="record.slotType === 'image'" :size="4">
                    <a-input-number
                      v-model:value="record.maxCount"
                      :min="1"
                      :max="9"
                      size="small"
                      :placeholder="$t('prompt.slotMaxCount')"
                      style="width: 80px"
                    />
                    <a-input
                      v-model:value="record.recommendedSize"
                      size="small"
                      :placeholder="$t('prompt.slotRecommendedSize')"
                      style="width: 120px"
                    />
                  </a-space>
                  <a-space v-else-if="record.slotType === 'number'" :size="4" wrap>
                    <a-input-number
                      v-model:value="record.defaultValue"
                      size="small"
                      :placeholder="$t('prompt.slotDefaultValue')"
                      style="width: 82px"
                    />
                    <a-input-number
                      v-model:value="record.min"
                      size="small"
                      :placeholder="$t('prompt.slotMin')"
                      style="width: 72px"
                    />
                    <a-input-number
                      v-model:value="record.max"
                      size="small"
                      :placeholder="$t('prompt.slotMax')"
                      style="width: 72px"
                    />
                    <a-input-number
                      v-model:value="record.step"
                      :min="0.1"
                      size="small"
                      :placeholder="$t('prompt.slotStep')"
                      style="width: 72px"
                    />
                  </a-space>
                </template>
                <template v-if="column.key === 'operation'">
                  <a-button type="link" size="small" danger @click="removeSlot(index)">
                    {{ $t('common.delete') }}
                  </a-button>
                </template>
              </template>
            </a-table>
            <a-button block style="margin-top: 8px" @click="() => insertSlot('text')">
              <Icon icon="antdv-next:PlusOutlined" />
              {{ $t('prompt.addSlot') }}
            </a-button>
          </a-form-item>
        </a-form>
      </div>

      <div class="editor-preview">
        <div class="preview-title">{{ $t('prompt.preview') }}</div>
        <div class="mixed-preview-card">
          <div v-if="!contentSegments.length" class="preview-empty">
            {{ $t('prompt.contentPlaceholder') }}
          </div>
          <template v-else>
            <template v-for="(segment, index) in contentSegments" :key="`${segment.type}-${index}`">
              <span v-if="segment.type === 'text'" class="preview-text">{{ segment.value }}</span>
              <template v-else>
                <button
                  v-if="slotKind(segment.key) === 'image'"
                  type="button"
                  class="inline-slot-control inline-image-control"
                >
                  <Icon icon="antdv-next:PlusOutlined" class="inline-image-plus" />
                  <span>{{ slotText(segment.key) }}</span>
                </button>
                <span
                  v-else-if="slotKind(segment.key) === 'separator'"
                  class="preview-text preview-separator"
                >{{ slotSeparatorText(segment.key) }}</span>
                <a-select
                  v-else-if="slotKind(segment.key) === 'select'"
                  v-model:value="previewValues[segment.key]"
                  class="inline-slot-control inline-select-control"
                  size="small"
                  :options="slotOptions(segment.key)"
                  :placeholder="slotText(segment.key)"
                  allow-clear
                />
                <a-select
                  v-else-if="slotKind(segment.key) === 'chip'"
                  v-model:value="previewValues[segment.key]"
                  class="inline-slot-control inline-chip-control"
                  size="small"
                  mode="multiple"
                  :options="slotOptions(segment.key)"
                  :placeholder="slotText(segment.key)"
                  :max-tag-count="2"
                  allow-clear
                />
                <a-input
                  v-else-if="slotKind(segment.key) === 'text'"
                  v-model:value="previewValues[segment.key]"
                  class="inline-slot-control inline-text-control"
                  size="small"
                  :placeholder="slotPlaceholder(segment.key)"
                />
                <a-input-number
                  v-else-if="slotKind(segment.key) === 'number'"
                  v-model:value="previewValues[segment.key]"
                  class="inline-slot-control inline-number-control"
                  size="small"
                  :min="slotNumberMin(segment.key)"
                  :max="slotNumberMax(segment.key)"
                  :step="slotNumberStep(segment.key)"
                  :placeholder="slotPlaceholder(segment.key)"
                />
                <span v-else class="inline-slot-control inline-missing-control">
                  {{ wrapVar(segment.key) }}
                </span>
              </template>
            </template>
          </template>
        </div>
        <div class="preview-output-title">{{ $t('prompt.previewOutput') }}</div>
        <pre class="preview-output">{{ renderedContent }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import Icon from '@/components/Icon/index.vue'

import { $t } from '@/locales'
import {
  getPromptDetail,
  createPrompt,
  updatePrompt,
  type PromptFormData,
  type PromptSlot,
} from '@/api/prompt'

type SlotType = PromptSlot['slotType']
type PromptContentSegment =
  | { type: 'text'; value: string }
  | { type: 'slot'; key: string }

const route = useRoute()
const router = useRouter()
const promptId = route.params.id as string | undefined
const copyFromId = route.query.copyFrom as string | undefined
const isEdit = !!promptId
const saving = ref(false)
const editorRef = ref<HTMLDivElement | null>(null)

const SLOT_PATTERN = /\{\{\s*([\w]+)\s*\}\}/g
// 合法占位标识字符集，须与 SLOT_PATTERN 的 [\w] 一致（字母/数字/下划线）
const SLOT_KEY_PATTERN = /^[A-Za-z0-9_]+$/

const categoryOptions = [
  { label: $t('prompt.categoryEcommerce'), value: 'ecommerce' },
  { label: $t('prompt.categoryImage'), value: 'image' },
  { label: $t('prompt.categoryVideo'), value: 'video' },
  { label: $t('prompt.categoryAgent'), value: 'agent' },
  { label: $t('prompt.categoryGeneral'), value: 'general' },
]

const slotTypeOptions: { label: string; value: SlotType }[] = [
  { label: $t('prompt.slotTypeText'), value: 'text' },
  { label: $t('prompt.slotTypeSelect'), value: 'select' },
  { label: $t('prompt.slotTypeImage'), value: 'image' },
  { label: $t('prompt.slotTypeChip'), value: 'chip' },
  { label: $t('prompt.slotTypeNumber'), value: 'number' },
  { label: $t('prompt.slotTypeSeparator'), value: 'separator' },
]

const slotColumns = [
  { title: $t('prompt.slotKey'), dataIndex: 'key', width: 130 },
  { title: $t('prompt.slotType'), dataIndex: 'slotType', width: 110 },
  { title: $t('prompt.slotLabel'), dataIndex: 'label', width: 130 },
  { title: $t('prompt.slotConfig'), key: 'config' },
  { title: $t('prompt.varRequired'), dataIndex: 'required', width: 70, align: 'center' as const },
  { title: $t('common.action'), key: 'operation', width: 70, align: 'center' as const },
]

const form = reactive<{
  name: string
  code: string
  category: string | undefined
  description: string
  icon: string
  coverImage: string
  content: string
  slots: PromptSlot[]
  tags: string[]
  enabled: number
  sortOrder: number
}>({
  name: '',
  code: '',
  category: 'general',
  description: '',
  icon: '',
  coverImage: '',
  content: '',
  slots: [],
  tags: [],
  enabled: 1,
  sortOrder: 0,
})

const enabledChecked = computed({
  get: () => form.enabled === 1,
  set: (v: boolean) => {
    form.enabled = v ? 1 : 0
  },
})

const previewValues = reactive<Record<string, string | number | string[]>>({})

const contentSegments = computed(() => parsePromptContent(form.content))

const detectedKeys = computed(() => {
  const matches = form.content.match(SLOT_PATTERN) || []
  const keys = matches.map(m => m.replace(/[{}]/g, '').trim())
  return Array.from(new Set(keys))
})

const hasUndefinedSlots = computed(() =>
  detectedKeys.value.some(key => !form.slots.find(s => s.key === key)),
)

const renderedContent = computed(() => {
  return form.content.replace(SLOT_PATTERN, (_match, key: string) => {
    const slot = findSlot(key)
    // 分隔标识：渲染为 “label：”，不参与取值
    if (slot?.slotType === 'separator') return `${slot.label || key}：`
    const value = previewValues[key]
    if (value != null && value !== '') {
      // 标签多选：数组以「、」连接
      if (Array.isArray(value)) return value.length ? value.join('、') : `{{${key}}}`
      return String(value)
    }
    if (slot?.defaultValue != null && slot.defaultValue !== '') return String(slot.defaultValue)
    if (slot?.slotType === 'image') return `[${slot.label || key}]`
    return `{{${key}}}`
  })
})

function parsePromptContent(content: string): PromptContentSegment[] {
  const segments: PromptContentSegment[] = []
  const pattern = new RegExp(SLOT_PATTERN)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'slot', key: match[1] })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments.filter(segment => segment.type === 'slot' || segment.value.length > 0)
}

function findSlot(key: string): PromptSlot | undefined {
  return form.slots.find(s => s.key === key)
}

function wrapVar(key: string): string {
  return `{{${key}}}`
}

function slotColor(type: SlotType): string {
  return { text: 'blue', select: 'green', image: 'purple', chip: 'orange', number: 'cyan', separator: 'gold' }[type] || 'default'
}

function slotChipLabel(slot: PromptSlot): string {
  return slot.label ? `${slot.label} ${wrapVar(slot.key)}` : wrapVar(slot.key)
}

function slotKind(key: string): SlotType | 'missing' {
  return findSlot(key)?.slotType || 'missing'
}

function slotText(key: string): string {
  const slot = findSlot(key)
  if (!slot) return key
  if (slot.defaultValue != null && slot.defaultValue !== '') return String(slot.defaultValue)
  return slot.label || slot.placeholder || key
}

function slotPlaceholder(key: string): string {
  const slot = findSlot(key)
  return slot?.placeholder || slot?.label || key
}

function slotSeparatorText(key: string): string {
  const slot = findSlot(key)
  return `${slot?.label || key}：`
}

function slotOptions(key: string) {
  const slot = findSlot(key)
  const options = slot?.options || []
  if (options.length) return options.map(o => ({ label: o.label, value: o.value }))
  if (slot?.defaultValue != null && slot.defaultValue !== '') {
    const value = String(slot.defaultValue)
    return [{ label: value, value }]
  }
  return []
}

function slotNumberMin(key: string): number | undefined {
  return findSlot(key)?.min
}

function slotNumberMax(key: string): number | undefined {
  return findSlot(key)?.max
}

function slotNumberStep(key: string): number {
  return findSlot(key)?.step || 1
}

function optionLabels(slot: PromptSlot): string[] {
  return (slot.options || []).map(o => o.label)
}

/**
 * 由 tags 输入回写选项。默认 value 与 label 同值；若某 label 已存在对应选项，
 * 则保留其原有自定义 value，避免重命名/增删时丢失已定制的取值。
 */
function setOptions(slot: PromptSlot, labels: string[]): void {
  const prev = slot.options || []
  slot.options = labels.map(l => {
    const existing = prev.find(o => o.label === l)
    return existing ? { ...existing, label: l } : { label: l, value: l }
  })
}

function optionValueEqualsLabel(slot: PromptSlot): boolean {
  return (slot.options || []).every(o => o.value === o.label)
}

function setOptionValue(slot: PromptSlot, index: number, value: string): void {
  const option = (slot.options || [])[index]
  if (!option) return
  // 留空时回退为 label，保持“默认同值”语义
  option.value = value === '' ? option.label : value
}

function genKey(type: SlotType): string {
  // 一次性收集所有已占用的 key：现有 slots + 正文里已出现的 {{key}}，
  // 避免与「正文已引用但尚未建表」的占位标识撞车，同时避免 O(n²) 反复查找。
  const used = new Set<string>(form.slots.map(s => s.key))
  detectedKeys.value.forEach(k => used.add(k))

  let i = used.size + 1
  let key = `${type}${i}`
  while (used.has(key)) {
    i += 1
    key = `${type}${i}`
  }
  return key
}

function ensurePreviewValues(): void {
  detectedKeys.value.forEach(key => {
    if (!(key in previewValues)) {
      const slot = findSlot(key)
      // 分隔标识不可交互，无需预览值
      if (slot?.slotType === 'separator') return
      // 标签多选：初始为数组
      if (slot?.slotType === 'chip' && slot.multiple !== false) {
        previewValues[key] = Array.isArray(slot.defaultValue) ? slot.defaultValue.map(String) : []
        return
      }
      previewValues[key] = slot?.defaultValue != null ? String(slot.defaultValue) : ''
    }
  })
}

/**
 * 切换 slot 类型时，清掉旧类型残留的预览值再按新类型重建——否则 chip(数组)↔其它(字符串)
 * 值形态不匹配会让预览控件报错/失效（如 select 拿到数组、chip 拿到字符串）。
 */
function onSlotTypeChange(slot: PromptSlot): void {
  delete previewValues[slot.key]
  ensurePreviewValues()
  renderPromptEditor()
}

/** token span 应展示的文本（与 isEditorDamaged 的比对基准保持一致） */
function expectedTokenText(key: string): string {
  const slot = findSlot(key)
  return slot?.slotType === 'separator'
    ? `${slot.label || key}：`
    : slot?.label || slot?.placeholder || key
}

function createSlotNode(key: string): HTMLSpanElement {
  const slot = findSlot(key)
  const span = document.createElement('span')
  span.className = `prompt-token prompt-token-${slot?.slotType || 'missing'}`
  span.dataset.slotKey = key
  span.contentEditable = 'false'
  span.title = wrapVar(key)
  span.textContent = expectedTokenText(key)
  return span
}

function renderPromptEditor(): void {
  const editor = editorRef.value
  if (!editor) return

  const fragment = document.createDocumentFragment()
  contentSegments.value.forEach(segment => {
    if (segment.type === 'text') {
      fragment.appendChild(document.createTextNode(segment.value))
    } else {
      fragment.appendChild(createSlotNode(segment.key))
    }
  })

  editor.replaceChildren(fragment)
  ensurePreviewValues()
}

function serializeEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const slotKey = el.dataset.slotKey
  if (slotKey) {
    return wrapVar(slotKey)
  }
  if (el.tagName === 'BR') {
    return '\n'
  }

  let content = Array.from(el.childNodes).map(serializeEditorNode).join('')
  if (el.tagName === 'DIV' || el.tagName === 'P') {
    content += '\n'
  }
  return content
}

function serializeEditorContent(): string {
  const editor = editorRef.value
  if (!editor) return form.content
  // contenteditable 会把连续/末尾空格自动替换为 &nbsp;(U+00A0)，此处归一为普通空格，
  // 避免把不可见的 NBSP 混入发给 AI 的提示词正文。
  return Array.from(editor.childNodes).map(serializeEditorNode).join('').replace(/ /g, ' ')
}

function closestSlotToken(node: Node | null): HTMLElement | null {
  const editor = editorRef.value
  if (!editor || !node) return null

  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement
  const token = element?.closest<HTMLElement>('.prompt-token')
  return token && editor.contains(token) ? token : null
}

function normalizeEditorRange(range: Range): Range {
  const token = closestSlotToken(range.commonAncestorContainer)
    || closestSlotToken(range.startContainer)
    || closestSlotToken(range.endContainer)

  if (!token) return range

  const safeRange = document.createRange()
  safeRange.setStartAfter(token)
  safeRange.collapse(true)
  return safeRange
}

function getEditorRange(): Range | null {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null
  return normalizeEditorRange(range)
}

function setCaretAfter(node: Node): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

// 度量光标偏移量时插入的临时标记字符（U+E000 私有区，正常文本不会出现）
const CARET_MARKER = '\uE000'

/**
 * 以「序列化文本偏移量」为锚点保存/恢复光标。
 *
 * 关键：在光标处插入一个临时标记文本节点，再用**与 serializeEditorContent 完全相同**
 * 的 serializeEditorNode 序列化整个编辑器一次，标记字符在结果中的下标即偏移量。
 * 因为度量与最终内容出自同一次序列化，无论浏览器如何把多行嵌套成 <div>/<br>，
 * 二者逐字节一致，不会因换行计数口径不同而错位；序列化后立即移除标记，不污染 DOM。
 */
function getCaretSerializedOffset(): number | null {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.endContainer)) return null

  const marker = document.createTextNode(CARET_MARKER)
  const probe = range.cloneRange()
  probe.collapse(false) // 收拢到光标末端
  let serialized: string
  try {
    probe.insertNode(marker)
    serialized = Array.from(editor.childNodes)
      .map(serializeEditorNode)
      .join('')
    .replace(/ /g, ' ')
    const index = serialized.indexOf(CARET_MARKER)
    return index >= 0 ? index : null
  } catch {
    return null
  } finally {
    marker.parentNode?.removeChild(marker)
  }
}

/**
 * 按序列化偏移量把光标放回。仅在 renderPromptEditor 重建后调用，此时编辑器是扁平结构：
 * 顶层子节点只有文本节点（换行为文本内的 \n）与 token span，无嵌套 <div>/<br>，
 * 故只需遍历直接子节点、逐段扣减偏移量即可。
 */
function restoreCaretFromOffset(target: number): void {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection) return

  let remaining = target

  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0
      if (remaining <= len) {
        const range = document.createRange()
        range.setStart(node, Math.max(0, remaining))
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= len
      continue
    }

    const el = node as HTMLElement
    if (el.dataset?.slotKey) {
      const len = wrapVar(el.dataset.slotKey).length
      if (remaining <= len) {
        // 光标落在 token 内部或边界 → 统一定位到 token 之后
        setCaretAfter(el)
        return
      }
      remaining -= len
    }
  }

  // 偏移量超出内容长度 → 落到末尾
  getEditorEndRange()
}

function getEditorEndRange(): Range | null {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection) return null

  editor.focus()
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return range
}

function insertTextAtEditor(text: string): void {
  const range = getEditorRange() || getEditorEndRange()
  if (!range) return

  range.deleteContents()
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)
  setCaretAfter(textNode)
  form.content = serializeEditorContent()
  ensurePreviewValues()
}

function insertSlotToken(key: string): void {
  const range = getEditorRange() || getEditorEndRange()
  if (!range) return

  range.deleteContents()
  const slotNode = createSlotNode(key)
  const spaceNode = document.createTextNode(' ')
  range.insertNode(spaceNode)
  range.insertNode(slotNode)
  setCaretAfter(spaceNode)
  form.content = serializeEditorContent()
  ensurePreviewValues()
}

function insertSlot(type: SlotType): void {
  const key = genKey(type)
  const slot: PromptSlot = { key, slotType: type, label: '', required: false }
  if (type === 'select') slot.options = []
  if (type === 'chip') {
    slot.options = []
    slot.multiple = true // 标签默认多选，区别于下拉单选
  }
  if (type === 'image') slot.maxCount = 1
  if (type === 'number') {
    slot.defaultValue = 1
    slot.min = 1
    slot.step = 1
  }
  if (type === 'separator') slot.label = $t('prompt.separatorDefaultLabel')
  form.slots.push(slot)
  nextTick(() => insertSlotToken(key))
}

function insertSlotRef(key: string): void {
  insertSlotToken(key)
}

// IME（中文等）输入法组合期间不重建 DOM，否则会打断拼音候选
const isComposing = ref(false)

function handleCompositionStart(): void {
  isComposing.value = true
}

function handleCompositionEnd(): void {
  isComposing.value = false
  handleContentInput()
}

/**
 * 检测编辑器内 token 是否被破坏：token span 应 contenteditable=false 且文本恒等于其展示文案。
 * 若光标落到 token 边界导致字符被写进 span、或 token 被拆分/删残，则文本不再匹配 → 需要重建。
 * 正常在文本节点里打字不会触发，避免每次输入都重建 DOM 抢焦点。
 */
function isEditorDamaged(): boolean {
  const editor = editorRef.value
  if (!editor) return false
  const tokens = editor.querySelectorAll<HTMLElement>('.prompt-token')
  for (const el of Array.from(tokens)) {
    const key = el.dataset.slotKey
    if (!key) return true
    if (el.textContent !== expectedTokenText(key)) return true
  }
  return false
}

function handleContentInput(): void {
  const editor = editorRef.value
  // 先以当前 DOM 为准序列化出权威文本
  form.content = serializeEditorContent()
  ensurePreviewValues()

  // 组合输入进行中：仅同步文本，等 compositionend 再处理
  if (!editor || isComposing.value) return

  // 仅当 token 被破坏时才重建 DOM 并恢复光标；正常打字不重建，避免抢焦点/跳光标。
  if (!isEditorDamaged()) return

  const caret = getCaretSerializedOffset()
  renderPromptEditor()
  if (caret != null) {
    restoreCaretFromOffset(caret)
  }
}

function handleContentBlur(): void {
  form.content = serializeEditorContent()
  ensurePreviewValues()
}

function handlePaste(event: ClipboardEvent): void {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  if (text) insertTextAtEditor(text)
}

function syncSlots(): void {
  detectedKeys.value.forEach(key => {
    if (!form.slots.find(s => s.key === key)) {
      form.slots.push({ key, slotType: 'text', label: '', required: false })
    }
  })
  nextTick(renderPromptEditor)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 记录 slot key 编辑前的原值，供 blur 时同步正文中的 {{oldKey}}
let slotKeyBeforeEdit = ''

function onSlotKeyFocus(slot: PromptSlot): void {
  slotKeyBeforeEdit = slot.key
}

/**
 * 重命名 slot key 后，把正文里的 {{oldKey}} 同步改为 {{newKey}}，并迁移预览值，
 * 否则正文仍指向旧 key → token 变“未定义占位”，编辑区与预览区分叉。
 */
function onSlotKeyRename(slot: PromptSlot): void {
  const oldKey = slotKeyBeforeEdit
  const newKey = slot.key.trim()
  slotKeyBeforeEdit = ''

  // 未变化：仅重渲染
  if (newKey === oldKey) {
    if (slot.key !== newKey) slot.key = newKey
    nextTick(renderPromptEditor)
    return
  }

  // 校验字符集：占位标识必须匹配 SLOT_PATTERN 的 [A-Za-z0-9_]，
  // 否则正文里的 {{newKey}} 无法被解析/渲染 → 编辑区与预览区分叉。空值同样非法。
  if (!SLOT_KEY_PATTERN.test(newKey)) {
    slot.key = oldKey
    message.warning($t('prompt.slotKeyInvalid'))
    nextTick(renderPromptEditor)
    return
  }

  // 与其它 slot 冲突：回滚，避免产生重复 key
  if (form.slots.some(s => s !== slot && s.key === newKey)) {
    slot.key = oldKey
    message.warning($t('prompt.slotKeyDuplicated'))
    nextTick(renderPromptEditor)
    return
  }

  slot.key = newKey
  if (oldKey) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(oldKey)}\\s*\\}\\}`, 'g')
    form.content = form.content.replace(pattern, `{{${newKey}}}`)
    // 迁移预览值
    if (oldKey in previewValues) {
      previewValues[newKey] = previewValues[oldKey]
      delete previewValues[oldKey]
    }
  }
  nextTick(renderPromptEditor)
}

function removeSlot(index: number): void {
  const slot = form.slots[index]
  if (!slot) return

  form.slots.splice(index, 1)
  delete previewValues[slot.key]
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(slot.key)}\\s*\\}\\}`, 'g')
  form.content = form.content.replace(pattern, '')
  nextTick(renderPromptEditor)
}

async function loadPrompt(id: string, isCopy = false): Promise<void> {
  try {
    const res = await getPromptDetail(id)
    form.name = isCopy ? `${res.name} (${$t('prompt.copySuffix')})` : res.name
    form.code = isCopy ? '' : res.code || ''
    form.category = res.category || 'general'
    form.description = res.description || ''
    form.icon = res.icon || ''
    form.coverImage = res.coverImage || ''
    form.content = res.content || ''
    form.tags = res.tags || []
    form.enabled = res.enabled ?? 1
    form.sortOrder = res.sortOrder ?? 0
    if (res.slots && res.slots.length) {
      // 存量数据可能含重复 key，按 key 去重保留首个，避免编辑器出现重复占位
      const seen = new Set<string>()
      form.slots = res.slots
        .filter(s => s.key && !seen.has(s.key) && seen.add(s.key))
        .map(s => ({ ...s }))
    } else if (res.variables && res.variables.length) {
      const seen = new Set<string>()
      form.slots = res.variables
        .filter(v => v.name && !seen.has(v.name) && seen.add(v.name))
        .map(v => ({
          key: v.name,
          slotType: 'text' as const,
          label: v.label || '',
          placeholder: v.description,
          defaultValue: v.defaultValue,
          required: v.required,
        }))
    } else {
      form.slots = []
    }
    await nextTick()
    renderPromptEditor()
  } catch {
    message.error($t('prompt.loadFailed'))
  }
}

function buildPayload(): PromptFormData {
  return {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    category: form.category,
    description: form.description.trim() || undefined,
    icon: form.icon.trim() || undefined,
    coverImage: form.coverImage.trim() || undefined,
    content: form.content,
    slots: form.slots,
    tags: form.tags,
    enabled: form.enabled,
    sortOrder: form.sortOrder,
  }
}

async function handleSave(): Promise<void> {
  handleContentInput()
  if (!form.name.trim()) {
    message.warning($t('prompt.nameRequired'))
    return
  }
  if (!form.content.trim()) {
    message.warning($t('prompt.contentRequired'))
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (isEdit && promptId) {
      await updatePrompt(promptId, payload)
    } else {
      await createPrompt(payload)
    }
    message.success($t('common.saveSuccess'))
    router.push('/prompt/list')
  } catch {
    message.error($t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

function handleBack(): void {
  router.push('/prompt/list')
}

onMounted(async () => {
  if (promptId) {
    await loadPrompt(promptId)
  } else if (copyFromId) {
    await loadPrompt(copyFromId, true)
  } else {
    await nextTick()
    renderPromptEditor()
  }
})
</script>

<style scoped>
.prompt-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border, #f0f0f0);
  background: var(--color-bg-container, #fff);
}

.editor-title {
  font-size: 16px;
  font-weight: 600;
}

.editor-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 16px;
  flex: 1;
  padding: 24px;
  overflow: hidden;
}

.editor-main {
  overflow-y: auto;
  padding-right: 8px;
}

.editor-preview {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--color-bg-layout, #fafafa);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 8px;
  overflow-y: auto;
}

.preview-title,
.preview-output-title {
  font-weight: 600;
  margin-bottom: 12px;
}

.preview-output-title {
  margin-top: 16px;
}

.mixed-preview-card {
  min-height: 150px;
  padding: 18px 20px;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 8px;
  color: var(--color-text, #1f2329);
  font-size: 15px;
  line-height: 2.15;
  word-break: break-word;
}

.preview-text {
  white-space: pre-wrap;
}

.inline-slot-control {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin: 0 2px;
}

.inline-text-control {
  width: 96px;
}

.inline-select-control {
  width: 96px;
}

.inline-number-control {
  width: 78px;
}

.inline-image-control,
.inline-missing-control {
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.06);
  border: 1px dashed rgba(37, 99, 235, 0.55);
  border-radius: 9px;
  font-size: 13px;
  line-height: 22px;
  cursor: default;
}

.inline-image-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #2563eb;
  background: var(--color-bg-container, #fff);
  border: 1px solid rgba(37, 99, 235, 0.24);
  border-radius: 5px;
}

:deep(.inline-text-control.ant-input-sm),
:deep(.inline-number-control.ant-input-number-sm) {
  height: 24px;
  padding: 0 8px;
  font-size: 13px;
  border-radius: 9px;
}

:deep(.inline-number-control .ant-input-number-input) {
  height: 22px;
  padding: 0;
  font-size: 13px;
}

:deep(.inline-select-control .ant-select-selector) {
  min-height: 24px !important;
  height: 24px !important;
  padding: 0 8px !important;
  border-radius: 9px !important;
  background: rgba(8, 145, 178, 0.08) !important;
  border-color: rgba(8, 145, 178, 0.18) !important;
}

:deep(.inline-select-control .ant-select-selection-item),
:deep(.inline-select-control .ant-select-selection-placeholder) {
  line-height: 22px !important;
  color: #0891b2;
  font-size: 13px;
}

.inline-missing-control {
  color: var(--color-error, #ff4d4f);
  background: rgba(255, 77, 79, 0.08);
  border-color: var(--color-error, #ff4d4f);
}

.preview-empty {
  color: var(--color-text-secondary, #888);
  font-size: 13px;
  line-height: 1.8;
}

.preview-output {
  flex: 1;
  min-height: 220px;
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.content-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.toolbar-hint {
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}

.var-chip {
  cursor: pointer;
}

.prompt-content-editor {
  min-height: 150px;
  padding: 14px 16px;
  color: var(--color-text, #1f2329);
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 6px;
  outline: none;
  font-size: 15px;
  line-height: 2.2;
  white-space: pre-wrap;
  word-break: break-word;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.prompt-content-editor:focus {
  border-color: var(--color-primary, #1677ff);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}

.prompt-content-editor.is-empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-tertiary, #bfbfbf);
  pointer-events: none;
}

:deep(.prompt-token) {
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  min-height: 28px;
  margin: 0 3px;
  padding: 0 10px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.24);
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
  vertical-align: middle;
}

:deep(.prompt-token-text) {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.24);
}

:deep(.prompt-token-image) {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.08);
  border-color: rgba(124, 58, 237, 0.28);
  border-style: dashed;
}

:deep(.prompt-token-select) {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
  border-color: rgba(22, 163, 74, 0.24);
}

:deep(.prompt-token-chip) {
  color: #ea580c;
  background: rgba(234, 88, 12, 0.1);
  border-color: rgba(234, 88, 12, 0.24);
}

:deep(.prompt-token-number) {
  color: #0891b2;
  background: rgba(8, 145, 178, 0.1);
  border-color: rgba(8, 145, 178, 0.24);
}

:deep(.prompt-token-separator) {
  color: #b45309;
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.32);
  font-weight: 600;
}

:deep(.prompt-token-missing) {
  color: var(--color-error, #ff4d4f);
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.24);
}

.separator-config-hint {
  font-size: 12px;
  color: var(--color-text-tertiary, #bfbfbf);
}

.value-custom-active {
  font-weight: 600;
}

.option-value-editor {
  width: 260px;
  max-height: 320px;
  overflow-y: auto;
}

.option-value-editor__title {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}

.option-value-editor__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.option-value-editor__label {
  flex: 0 0 84px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.preview-separator {
  font-weight: 600;
  color: var(--color-text, #1f2329);
}

.inline-chip-control {
  min-width: 120px;
  max-width: 220px;
}

.detected-vars {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}
</style>
