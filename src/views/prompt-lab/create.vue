<template>
  <div class="ver-editor">
    <div class="editor-header">
      <a-space>
        <a-button @click="goBack">返回</a-button>
        <span class="editor-title">新建提示词</span>
      </a-space>
      <a-space>
        <a-button :loading="saving" @click="() => handleSave(false)">保存草稿</a-button>
        <a-button type="primary" :loading="saving" @click="() => handleSave(true)"
          >保存并发布</a-button
        >
      </a-space>
    </div>

    <div class="editor-body">
      <div class="editor-main">
        <a-form layout="vertical">
          <!-- 基础信息 -->
          <a-card size="small" title="基础信息" style="margin-bottom: 16px">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item
                  label="编码 Code（唯一，=调用点模板名或 .md 名，如 t2v / ai-media.system）"
                  required
                >
                  <a-input v-model:value="meta.code" placeholder="如 t2v" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="名称" required>
                  <a-input v-model:value="meta.name" placeholder="展示名称" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="类型">
                  <a-select v-model:value="meta.type" :options="typeOptions" />
                </a-form-item>
              </a-col>
              <a-col v-if="meta.type === 'optimize'" :span="16">
                <a-form-item label="目标生成模型（专用提示词专用模型，留空=通用默认）">
                  <a-select
                    v-model:value="meta.targetModelCode"
                    :options="modelCodeOptions"
                    allow-clear
                    show-search
                    option-filter-prop="label"
                    placeholder="选择目标模型 code（如 seedance / local-image），留空=通用"
                  />
                </a-form-item>
              </a-col>
              <template v-else>
                <a-col :span="8">
                  <a-form-item label="Agent 角色">
                    <a-select
                      v-model:value="meta.agentRole"
                      :options="agentRoleOptions"
                      allow-clear
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="所属 Agent 标识 agentCode">
                    <a-input v-model:value="meta.agentCode" placeholder="如 ai-media" />
                  </a-form-item>
                </a-col>
              </template>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="分类">
                  <a-select
                    v-model:value="meta.categoryId"
                    :options="categoryOptions"
                    allow-clear
                    placeholder="选择分类"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="负责人">
                  <a-input v-model:value="meta.owner" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="启用">
                  <a-switch
                    v-model:checked="metaEnabled"
                    checked-children="启用"
                    un-checked-children="停用"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="标签">
              <a-select
                v-model:value="meta.tags"
                mode="tags"
                :token-separators="[',']"
                placeholder="输入后回车"
              />
            </a-form-item>
            <a-form-item label="描述">
              <a-textarea v-model:value="meta.description" :rows="2" />
            </a-form-item>
          </a-card>

          <!-- AI 辅助优化 -->
          <a-card
            size="small"
            title="AI 辅助优化（用一个 LLM 把内容改得更专业 / 按需求生成）"
            style="margin-bottom: 16px"
          >
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
                <a-input
                  v-model:value="aiInstruction"
                  placeholder="优化需求 / brief（可空；内容为空则据此从零生成）"
                />
              </a-col>
            </a-row>
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px">
              <a-button type="primary" ghost :loading="aiOptimizing" @click="doAiOptimize"
                >用 AI 优化 / 生成内容</a-button
              >
              <span class="ai-hint">结果填回下方「提示词内容」，可再手动调整。</span>
            </div>
          </a-card>

          <a-form-item label="提示词内容 content（首个版本 v1）" required>
            <a-textarea v-model:value="ver.content" :rows="14" placeholder="系统提示词正文" />
          </a-form-item>

          <a-divider orientation="left" style="font-size: 13px">
            运行时改写模型（生成时改写 C 端用户输入的
            LLM，按本次有无图自动选档）——一般留空，系统自动选
          </a-divider>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="改写模型 · 纯文字档（生成不带图时用；留空=系统自动选）">
                <a-select
                  v-model:value="ver.textModelId"
                  :options="modelOptions"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="留空即可，除非要钉死某个文本模型"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item
                label="改写模型 · 带图档（生成带参考图时用，需视觉模型；留空=系统自动选）"
              >
                <a-select
                  v-model:value="ver.visionModelId"
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
            <a-input v-model:value="ver.changelog" placeholder="本次变更简述" />
          </a-form-item>
        </a-form>
      </div>

      <div class="editor-side">
        <a-collapse v-model:active-key="activePanels">
          <a-collapse-panel key="modelParams" header="模型参数覆盖 modelParams (JSON)">
            <a-textarea
              v-model:value="jsonText.modelParams"
              :rows="5"
              placeholder='{"temperature":0.7,"topP":0.9,"maxTokens":2048}'
            />
          </a-collapse-panel>
          <a-collapse-panel key="outputSchema" header="输出结构 outputSchema (JSON)">
            <a-textarea
              v-model:value="jsonText.outputSchema"
              :rows="5"
              placeholder='{"prompt":"..."}'
            />
          </a-collapse-panel>
          <a-collapse-panel key="slots" header="插槽 slots (JSON 数组)">
            <a-textarea v-model:value="jsonText.slots" :rows="6" />
          </a-collapse-panel>
          <a-collapse-panel key="structure" header="结构化分块 structure (JSON 数组)">
            <a-textarea v-model:value="jsonText.structure" :rows="6" />
          </a-collapse-panel>
        </a-collapse>
        <a-alert
          type="info"
          show-icon
          style="margin-top: 12px"
          message="一次填完：主体信息 + 首版本 v1 内容。保存草稿后可在详情页继续改/发布；保存并发布则立即生效。JSON 字段留空表示不设置。"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { getModelOptions } from '@/api/model';
import {
  createPrompt,
  getPromptDetail,
  updateDraft,
  publishVersion,
  aiOptimizeContent,
  listCategories,
  type PromptSaveReq,
  type VersionSaveReq,
} from '@/api/prompt-lab';

const router = useRouter();
const saving = ref(false);
const activePanels = ref<string[]>(['modelParams', 'outputSchema']);

const typeOptions = [
  { label: '优化模板 (optimize)', value: 'optimize' },
  { label: 'Agent 提示词 (agent)', value: 'agent' },
];
const agentRoleOptions = ['system', 'instruction', 'override'].map((v) => ({ label: v, value: v }));

const meta = reactive<{
  code: string;
  type: 'optimize' | 'agent';
  targetModelCode: string;
  agentRole: string | undefined;
  agentCode: string;
  name: string;
  categoryId: number | undefined;
  owner: string;
  tags: string[];
  description: string;
  status: number;
}>({
  code: '',
  type: 'optimize',
  targetModelCode: '',
  agentRole: undefined,
  agentCode: '',
  name: '',
  categoryId: undefined,
  owner: '',
  tags: [],
  description: '',
  status: 1,
});
const metaEnabled = computed({
  get: () => meta.status === 1,
  set: (v: boolean) => (meta.status = v ? 1 : 0),
});

const ver = reactive<{
  content: string;
  textModelId: number | undefined;
  visionModelId: number | undefined;
  changelog: string;
}>({ content: '', textModelId: undefined, visionModelId: undefined, changelog: '初始版本' });

const jsonText = reactive({ modelParams: '', outputSchema: '', slots: '', structure: '' });

const modelOptions = ref<{ label: string; value: number }[]>([]);
const modelCodeOptions = ref<{ label: string; value: string }[]>([]);
const categoryOptions = ref<{ label: string; value: number }[]>([]);

// AI 优化
const aiModelId = ref<number>();
const aiInstruction = ref('');
const aiOptimizing = ref(false);
async function doAiOptimize() {
  if (!aiModelId.value) {
    message.warning('请选择优化模型');
    return;
  }
  aiOptimizing.value = true;
  try {
    const res = await aiOptimizeContent({
      content: ver.content,
      instruction: aiInstruction.value,
      modelId: aiModelId.value,
    });
    ver.content = res.content;
    message.success('AI 优化完成，已填入内容');
  } catch {
    /* 拦截器已提示 */
  } finally {
    aiOptimizing.value = false;
  }
}

async function loadOptions() {
  try {
    const list = await getModelOptions();
    modelOptions.value = (list || [])
      .filter((m: { modelType?: number }) => m.modelType === 1 || m.modelType == null)
      .map((m: { id: number; name: string; code?: string }) => ({
        label: m.code ? `${m.name} (${m.code})` : m.name,
        value: m.id,
      }));
    modelCodeOptions.value = (list || [])
      .filter((m: { code?: string }) => !!m.code)
      .map((m: { name: string; code?: string }) => ({
        label: `${m.name} (${m.code})`,
        value: m.code as string,
      }));
  } catch {
    /* 忽略 */
  }
  try {
    const cats = await listCategories();
    categoryOptions.value = (cats || []).map((c) => ({ label: c.name, value: c.id }));
  } catch {
    /* 忽略 */
  }
}

function parseJsonField(label: string, text: string): { ok: boolean; value?: unknown } {
  const t = text.trim();
  if (!t) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    message.error(`${label} 不是合法 JSON`);
    return { ok: false };
  }
}

async function handleSave(publish: boolean) {
  if (!meta.code.trim()) {
    message.warning('请填写编码 Code');
    return;
  }
  if (!meta.name.trim()) {
    message.warning('请填写名称');
    return;
  }
  if (!ver.content.trim()) {
    message.warning('请填写提示词内容');
    return;
  }
  const mp = parseJsonField('模型参数 modelParams', jsonText.modelParams);
  const os = parseJsonField('输出结构 outputSchema', jsonText.outputSchema);
  const sl = parseJsonField('插槽 slots', jsonText.slots);
  const st = parseJsonField('结构化分块 structure', jsonText.structure);
  if (!mp.ok || !os.ok || !sl.ok || !st.ok) return;

  saving.value = true;
  try {
    const payload: PromptSaveReq = {
      code: meta.code.trim(),
      type: meta.type,
      targetModelCode: meta.type === 'optimize' ? meta.targetModelCode || '' : '',
      agentRole: meta.type === 'agent' ? meta.agentRole : undefined,
      agentCode: meta.type === 'agent' ? meta.agentCode : undefined,
      name: meta.name.trim(),
      categoryId: meta.categoryId,
      owner: meta.owner || undefined,
      tags: meta.tags,
      status: meta.status,
      description: meta.description || undefined,
      initialContent: ver.content,
    };
    const id = await createPrompt(payload);

    // 取回自动创建的 v1 草稿，补充版本级字段
    const detail = await getPromptDetail(id);
    const v1 = detail.versions.find((v) => v.versionNo === 1) || detail.versions[0];
    if (v1) {
      const verPayload: VersionSaveReq = {
        content: ver.content,
        textModelId: ver.textModelId ?? null,
        visionModelId: ver.visionModelId ?? null,
        changelog: ver.changelog || undefined,
        modelParams: mp.value,
        outputSchema: os.value,
        slots: sl.value,
        structure: st.value,
      };
      await updateDraft(v1.id, verPayload);
      if (publish) {
        await publishVersion(v1.id);
      }
    }
    message.success(publish ? '已保存并发布' : '已保存草稿');
    router.push(`/content/prompt-lab/detail/${id}`);
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push('/content/prompt-lab/list');
}

onMounted(loadOptions);
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
