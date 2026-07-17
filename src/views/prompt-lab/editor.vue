<template>
  <div class="ver-editor">
    <div class="editor-header">
      <a-space>
        <a-button @click="goBack">返回</a-button>
        <span class="editor-title">{{ title }}</span>
      </a-space>
      <a-button type="primary" :loading="saving" @click="handleSave">保存草稿</a-button>
    </div>

    <div class="editor-body">
      <div class="editor-main">
        <a-form layout="vertical">
          <a-card size="small" title="AI 辅助优化（用一个 LLM 把内容改得更专业 / 按需求生成）" style="margin-bottom: 16px">
            <a-row :gutter="8">
              <a-col :span="10">
                <a-select
                  v-model:value="aiModelId"
                  :options="modelOptions"
                  show-search
                  option-filter-prop="label"
                  placeholder="选择优化模型（做改写的 LLM）"
                  style="width: 100%"
                />
              </a-col>
              <a-col :span="14">
                <a-input v-model:value="aiInstruction" placeholder="优化需求 / brief（可空；内容为空则据此从零生成）" />
              </a-col>
            </a-row>
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px">
              <a-button type="primary" ghost :loading="aiOptimizing" @click="doAiOptimize">
                用 AI 优化 / 生成当前内容
              </a-button>
              <span class="ai-hint">结果会填回下方「提示词内容」，可再手动调整后保存。</span>
            </div>
          </a-card>

          <a-form-item label="提示词内容 content" required>
            <a-textarea v-model:value="form.content" :rows="16" placeholder="系统提示词正文（装配后的完整文本）" />
          </a-form-item>

          <a-divider orientation="left" style="font-size: 13px">
            运行时改写模型（生成时改写 C 端用户输入的 LLM，按本次有无图自动选档）——一般留空，系统自动选
          </a-divider>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="改写模型 · 纯文字档（生成不带图时用；留空=系统自动选）">
                <a-select
                  v-model:value="form.textModelId"
                  :options="modelOptions"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="留空即可，除非要钉死某个文本模型"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="改写模型 · 带图档（生成带参考图时用，需视觉模型；留空=系统自动选）">
                <a-select
                  v-model:value="form.visionModelId"
                  :options="modelOptions"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="留空即可，除非要钉死某个视觉模型"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="变更说明 changelog">
            <a-input v-model:value="form.changelog" placeholder="本次变更简述" />
          </a-form-item>
        </a-form>
      </div>

      <div class="editor-side">
        <a-collapse v-model:active-key="activePanels">
          <a-collapse-panel key="modelParams" header="模型参数覆盖 modelParams (JSON)">
            <a-textarea v-model:value="jsonText.modelParams" :rows="5" placeholder='{"temperature":0.7,"topP":0.9,"maxTokens":2048}' />
          </a-collapse-panel>
          <a-collapse-panel key="outputSchema" header="输出结构 outputSchema (JSON)">
            <a-textarea v-model:value="jsonText.outputSchema" :rows="5" placeholder='{"prompt":"..."}' />
          </a-collapse-panel>
          <a-collapse-panel key="slots" header="插槽 slots (JSON 数组)">
            <a-textarea v-model:value="jsonText.slots" :rows="6" placeholder='[{"key":"...","slotType":"text","label":"..."}]' />
          </a-collapse-panel>
          <a-collapse-panel key="structure" header="结构化分块 structure (JSON 数组)">
            <a-textarea v-model:value="jsonText.structure" :rows="6" placeholder='[{"type":"role","text":"..."}]' />
          </a-collapse-panel>
        </a-collapse>
        <a-alert
          type="info"
          show-icon
          style="margin-top: 12px"
          message="发布态版本不可变。此处编辑的是草稿；保存后回到详情页发布即生效。JSON 字段留空表示不设置。"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import { getModelOptions } from '@/api/model'
import {
  getVersion,
  createDraft,
  updateDraft,
  aiOptimizeContent,
  type VersionSaveReq,
} from '@/api/prompt-lab'

const route = useRoute()
const router = useRouter()
const promptId = Number(route.params.promptId)
const versionId = route.query.versionId ? Number(route.query.versionId) : undefined
const cloneFrom = route.query.cloneFrom ? Number(route.query.cloneFrom) : undefined
const isEdit = !!versionId

const title = computed(() => (isEdit ? '编辑草稿版本' : cloneFrom ? '基于克隆新建草稿' : '新建草稿版本'))

const saving = ref(false)
const activePanels = ref<string[]>(['modelParams', 'outputSchema'])
const modelOptions = ref<{ label: string; value: number }[]>([])

// AI 辅助优化（元提示词）
const aiModelId = ref<number>()
const aiInstruction = ref('')
const aiOptimizing = ref(false)
async function doAiOptimize() {
  if (!aiModelId.value) {
    message.warning('请选择优化模型')
    return
  }
  aiOptimizing.value = true
  try {
    const res = await aiOptimizeContent({
      content: form.content,
      instruction: aiInstruction.value,
      modelId: aiModelId.value,
    })
    form.content = res.content
    message.success('AI 优化完成，已填入内容')
  } catch {
    /* 拦截器已提示 */
  } finally {
    aiOptimizing.value = false
  }
}

const form = reactive<{
  content: string
  textModelId: number | undefined
  visionModelId: number | undefined
  changelog: string
}>({
  content: '',
  textModelId: undefined,
  visionModelId: undefined,
  changelog: '',
})

const jsonText = reactive<{ modelParams: string; outputSchema: string; slots: string; structure: string }>({
  modelParams: '',
  outputSchema: '',
  slots: '',
  structure: '',
})

function toText(v: unknown): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
}

async function loadModels() {
  try {
    const list = await getModelOptions()
    modelOptions.value = (list || [])
      .filter((m: { modelType?: number }) => m.modelType === 1 || m.modelType == null)
      .map((m: { id: number; name: string; code?: string }) => ({
        label: m.code ? `${m.name} (${m.code})` : m.name,
        value: m.id,
      }))
  } catch {
    /* 忽略 */
  }
}

async function loadVersion(id: number) {
  try {
    const v = await getVersion(id)
    form.content = v.content || ''
    form.textModelId = v.textModelId ?? undefined
    form.visionModelId = v.visionModelId ?? undefined
    form.changelog = isEdit ? v.changelog || '' : ''
    jsonText.modelParams = toText(v.modelParams)
    jsonText.outputSchema = toText(v.outputSchema)
    jsonText.slots = toText(v.slots)
    jsonText.structure = toText(v.structure)
  } catch {
    message.error('加载版本失败')
  }
}

function parseJsonField(label: string, text: string): { ok: boolean; value?: unknown } {
  const t = text.trim()
  if (!t) return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(t) }
  } catch {
    message.error(`${label} 不是合法 JSON`)
    return { ok: false }
  }
}

async function handleSave() {
  if (!form.content.trim()) {
    message.warning('请填写提示词内容')
    return
  }
  const mp = parseJsonField('模型参数 modelParams', jsonText.modelParams)
  const os = parseJsonField('输出结构 outputSchema', jsonText.outputSchema)
  const sl = parseJsonField('插槽 slots', jsonText.slots)
  const st = parseJsonField('结构化分块 structure', jsonText.structure)
  if (!mp.ok || !os.ok || !sl.ok || !st.ok) return

  const payload: VersionSaveReq = {
    content: form.content,
    textModelId: form.textModelId ?? null,
    visionModelId: form.visionModelId ?? null,
    changelog: form.changelog || undefined,
    modelParams: mp.value,
    outputSchema: os.value,
    slots: sl.value,
    structure: st.value,
  }

  saving.value = true
  try {
    if (isEdit && versionId) {
      await updateDraft(versionId, payload)
    } else {
      payload.cloneFromVersionId = cloneFrom
      await createDraft(promptId, payload)
    }
    message.success('已保存')
    goBack()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push(`/prompt-lab/detail/${promptId}`)
}

onMounted(() => {
  loadModels()
  if (versionId) {
    loadVersion(versionId)
  } else if (cloneFrom) {
    loadVersion(cloneFrom)
  }
})
</script>

<style scoped>
.ver-editor {
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
  overflow: auto;
}
.editor-main {
  overflow-y: auto;
}
.editor-side {
  overflow-y: auto;
}
.ai-hint {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
}
</style>
