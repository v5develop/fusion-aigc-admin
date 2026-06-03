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
            <a-col :span="12">
              <a-form-item :label="$t('common.status')">
                <a-switch
                  v-model:checked="enabledChecked"
                  :checked-children="$t('common.enabled')"
                  :un-checked-children="$t('common.disabled')"
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
                  <a-input v-model:value="record.key" size="small" @blur="renderPromptEditor" />
                </template>
                <template v-if="column.dataIndex === 'slotType'">
                  <a-select
                    v-model:value="record.slotType"
                    :options="slotTypeOptions"
                    size="small"
                    style="width: 100%"
                    @change="renderPromptEditor"
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
                  <a-select
                    v-else-if="record.slotType === 'select' || record.slotType === 'chip'"
                    :value="optionLabels(record)"
                    mode="tags"
                    size="small"
                    style="width: 100%"
                    :placeholder="$t('prompt.slotOptionsPlaceholder')"
                    :token-separators="[',']"
                    @update:value="(val: string[]) => setOptions(record, val)"
                  />
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
                <a-select
                  v-else-if="slotKind(segment.key) === 'select' || slotKind(segment.key) === 'chip'"
                  v-model:value="previewValues[segment.key]"
                  class="inline-slot-control inline-select-control"
                  size="small"
                  :options="slotOptions(segment.key)"
                  :placeholder="slotText(segment.key)"
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
  sort: number
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
  sort: 0,
})

const enabledChecked = computed({
  get: () => form.enabled === 1,
  set: (v: boolean) => {
    form.enabled = v ? 1 : 0
  },
})

const previewValues = reactive<Record<string, string | number>>({})

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
    const value = previewValues[key]
    if (value != null && value !== '') return String(value)
    const slot = findSlot(key)
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
  return { text: 'blue', select: 'green', image: 'purple', chip: 'orange', number: 'cyan' }[type] || 'default'
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

function setOptions(slot: PromptSlot, labels: string[]): void {
  slot.options = labels.map(l => ({ label: l, value: l }))
}

function genKey(type: SlotType): string {
  let i = form.slots.length + 1
  let key = `${type}${i}`
  while (form.slots.find(s => s.key === key)) {
    i += 1
    key = `${type}${i}`
  }
  return key
}

function ensurePreviewValues(): void {
  detectedKeys.value.forEach(key => {
    if (!(key in previewValues)) {
      const slot = findSlot(key)
      previewValues[key] = slot?.defaultValue != null ? String(slot.defaultValue) : ''
    }
  })
}

function createSlotNode(key: string): HTMLSpanElement {
  const slot = findSlot(key)
  const span = document.createElement('span')
  span.className = `prompt-token prompt-token-${slot?.slotType || 'missing'}`
  span.dataset.slotKey = key
  span.contentEditable = 'false'
  span.title = wrapVar(key)
  span.textContent = slot?.label || slot?.placeholder || key
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
  if (type === 'select' || type === 'chip') slot.options = []
  if (type === 'image') slot.maxCount = 1
  if (type === 'number') {
    slot.defaultValue = 1
    slot.min = 1
    slot.step = 1
  }
  form.slots.push(slot)
  nextTick(() => insertSlotToken(key))
}

function insertSlotRef(key: string): void {
  insertSlotToken(key)
}

function handleContentInput(): void {
  form.content = serializeEditorContent()
  ensurePreviewValues()
}

function handleContentBlur(): void {
  handleContentInput()
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
    form.sort = res.sort || 0
    if (res.slots && res.slots.length) {
      form.slots = res.slots.map(s => ({ ...s }))
    } else if (res.variables && res.variables.length) {
      form.slots = res.variables.map(v => ({
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
    sort: form.sort,
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

:deep(.prompt-token-missing) {
  color: var(--color-error, #ff4d4f);
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.24);
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
