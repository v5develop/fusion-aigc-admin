<template>
  <div class="test-console">
    <a-row :gutter="16">
      <!-- 左：Tab1=提示词&全貌  Tab2=测试输入 -->
      <a-col :span="11" class="pane">
        <a-card :bordered="false" size="small" class="left-card">
          <a-tabs v-model:active-key="leftTab" type="card">
            <a-tab-pane key="info" tab="① 提示词 & 全貌">
              <a-alert
                type="info"
                show-icon
                style="margin-bottom: 12px"
                message="把「被测版本内容」当系统提示词，按你的输入(+图)真实调改写模型，产出即将喂给目标生成模型的专业提示词。"
              />
              <a-form-item label="提示词" style="margin-bottom: 8px">
                <a-select
                  v-model:value="selectedPromptId"
                  :options="promptOptions"
                  show-search
                  option-filter-prop="label"
                  placeholder="按编码/名称搜索"
                  :loading="loadingPrompts"
                  @change="onPromptChange"
                />
              </a-form-item>
              <a-form-item label="版本" style="margin-bottom: 12px">
                <a-select
                  v-model:value="selectedVersionId"
                  :options="versionOptions"
                  placeholder="选择版本"
                  :disabled="!selectedPromptId"
                  @change="onVersionChange"
                />
              </a-form-item>

              <template v-if="selectedVersion && selectedPrompt">
                <a-descriptions bordered size="small" :column="1">
                  <a-descriptions-item label="编码">{{ selectedPrompt.code }}</a-descriptions-item>
                  <a-descriptions-item label="类型">{{
                    selectedPrompt.type === 'agent' ? 'Agent 提示词' : '优化模板'
                  }}</a-descriptions-item>
                  <a-descriptions-item label="目标生成模型">
                    <a-tag v-if="selectedPrompt.targetModelCode" color="geekblue">{{
                      selectedPrompt.targetModelCode
                    }}</a-tag>
                    <span v-else class="muted">通用默认</span>
                  </a-descriptions-item>
                  <a-descriptions-item label="版本">
                    v{{ selectedVersion.versionNo }}
                    <a-tag :color="statusColor(selectedVersion.status)" style="margin-left: 6px">{{
                      statusLabel(selectedVersion.status)
                    }}</a-tag>
                    <a-tag
                      v-if="selectedVersion.id === selectedPrompt.activeVersionId"
                      color="green"
                      >生效中</a-tag
                    >
                  </a-descriptions-item>
                  <a-descriptions-item label="改写模型·纯文字档">{{
                    modelName(selectedVersion.textModelId)
                  }}</a-descriptions-item>
                  <a-descriptions-item label="改写模型·带图档">{{
                    modelName(selectedVersion.visionModelId)
                  }}</a-descriptions-item>
                  <a-descriptions-item label="输出结构"
                    ><code class="inline-code">{{ outputSchemaText }}</code></a-descriptions-item
                  >
                </a-descriptions>
                <a-collapse v-model:active-key="panels" style="margin-top: 12px">
                  <a-collapse-panel key="content" header="被测版本内容（作为系统提示词）">
                    <pre class="out-pre">{{ selectedVersion.content }}</pre>
                  </a-collapse-panel>
                  <a-collapse-panel v-if="slotsText" key="slots" header="插槽 slots">
                    <pre class="out-pre small">{{ slotsText }}</pre>
                  </a-collapse-panel>
                  <a-collapse-panel
                    v-if="structureText"
                    key="structure"
                    header="结构化分块 structure"
                  >
                    <pre class="out-pre small">{{ structureText }}</pre>
                  </a-collapse-panel>
                </a-collapse>
                <div class="next-bar">
                  <a-button type="primary" ghost size="small" @click="leftTab = 'input'"
                    >下一步：填测试输入 →</a-button
                  >
                </div>
              </template>
            </a-tab-pane>

            <a-tab-pane key="input" tab="② 测试输入">
              <template v-if="selectedVersionId">
                <a-form layout="vertical">
                  <a-form-item>
                    <template #label>
                      <span>系统提示词（临时编辑，仅本次测试，<b>不保存到版本</b>）</span>
                      <a-tag v-if="contentDirty" color="orange" style="margin-left: 8px"
                        >已临时修改</a-tag
                      >
                      <a-button
                        type="link"
                        size="small"
                        style="padding: 0 8px"
                        @click="resetContent"
                        >重置为版本内容</a-button
                      >
                    </template>
                    <a-textarea
                      v-model:value="editContent"
                      :rows="8"
                      placeholder="临时改系统提示词做灵活测试，不会写回版本"
                    />
                  </a-form-item>
                  <a-form-item label="用户输入 userInput（模拟 C 端）">
                    <a-textarea
                      v-model:value="userInput"
                      :rows="4"
                      placeholder="如：帮我做个夏天连衣裙的电商主图"
                    />
                  </a-form-item>
                  <a-form-item label="图片 URL（可选，每行一个；带图走「带图档」模型）">
                    <a-textarea v-model:value="imagesText" :rows="2" placeholder="https://..." />
                  </a-form-item>
                  <a-form-item
                    label="本次改写模型（覆盖，可空=用版本绑定/默认）"
                    style="margin-bottom: 8px"
                  >
                    <a-select
                      v-model:value="overrideModelId"
                      :options="modelOptions"
                      allow-clear
                      show-search
                      option-filter-prop="label"
                      placeholder="默认用版本绑定；选此可对比不同模型"
                    />
                  </a-form-item>
                  <div class="run-bar">
                    <a-button type="primary" :loading="testing" @click="run">运行测试</a-button>
                    <a-button :loading="previewing" @click="preview">干跑预览</a-button>
                    <span class="muted"
                      >本次改写模型：{{ effectiveModelLabel }}（本次{{
                        hasImage ? '带图 → 带图档 vision' : '无图 → 纯文字档 text'
                      }}；加图片URL即切带图档）</span
                    >
                  </div>
                  <a-modal
                    v-model:open="previewOpen"
                    title="干跑预览 · 组装后的系统提示词（不调模型/不计费）"
                    :footer="null"
                    width="720px"
                  >
                    <a-alert
                      type="info"
                      show-icon
                      style="margin-bottom: 8px"
                      message="下方即真正发送给模型的系统提示词全文：已渲染变量占位并包裹安全前后缀。仅本地组装，未调用模型、未计费、未落库。"
                    />
                    <pre class="out-pre">{{ previewText }}</pre>
                  </a-modal>
                </a-form>
              </template>
              <a-empty v-else description="请先在「① 提示词 & 全貌」选择提示词与版本" />
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </a-col>

      <!-- 右：结果 + 记录 -->
      <a-col :span="13" class="pane">
        <a-card :bordered="false" size="small" title="④ 最近一次结果">
          <div v-if="!lastRun" class="empty-hint">
            选择版本、填入输入后点「运行测试」，结果显示在这里。
          </div>
          <template v-else>
            <a-space style="margin-bottom: 8px" wrap>
              <a-tag :color="lastRun.status === 'success' ? 'green' : 'red'">{{
                lastRun.status
              }}</a-tag>
              <a-tag
                v-if="lastRun.status === 'success'"
                :color="lastRun.parseOk === 1 ? 'blue' : 'orange'"
              >
                {{ lastRun.parseOk === 1 ? '解析OK' : '未解析' }}
              </a-tag>
              <span class="muted"
                >耗时 {{ lastRun.latencyMs != null ? lastRun.latencyMs + 'ms' : '-' }}</span
              >
              <span v-if="lastRun.modelId" class="muted"
                >模型 {{ modelName(lastRun.modelId) }}</span
              >
            </a-space>
            <pre class="out-pre">{{ lastRun.output || lastRun.note }}</pre>
          </template>
        </a-card>

        <a-card
          v-if="selectedVersionId"
          :bordered="false"
          size="small"
          title="⑤ 测试记录"
          style="margin-top: 16px"
        >
          <a-list :data-source="runs" :loading="loadingRuns" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="run-item">
                  <div class="run-line">
                    <a-tag :color="item.status === 'success' ? 'green' : 'red'">{{
                      item.status
                    }}</a-tag>
                    <a-tag
                      v-if="item.status === 'success'"
                      :color="item.parseOk === 1 ? 'blue' : 'orange'"
                    >
                      {{ item.parseOk === 1 ? '解析OK' : '未解析' }}
                    </a-tag>
                    <span>{{ item.latencyMs != null ? item.latencyMs + 'ms' : '-' }}</span>
                    <span v-if="item.modelId" class="muted"
                      >模型 {{ modelName(item.modelId) }}</span
                    >
                    <span class="run-time">{{ item.createTime }}</span>
                  </div>
                  <pre v-if="item.output" class="out-pre small">{{ item.output }}</pre>
                  <div class="run-rate">
                    <a-rate :value="item.rating || 0" @change="(v: number) => rate(item, v)" />
                    <a-input
                      :value="item.note"
                      size="small"
                      placeholder="评分备注，回车保存"
                      style="width: 240px"
                      @pressEnter="(e: any) => rate(item, item.rating || 0, e.target.value)"
                    />
                  </div>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, computed, onMounted } from 'vue';

import { getModelOptions } from '@/api/model';
import {
  pagePrompts,
  getPromptDetail,
  runTest,
  rateTest,
  listTestRuns,
  dryRunPreview,
  type Prompt,
  type PromptVersion,
  type PromptTestRun,
} from '@/api/prompt-lab';

const loadingPrompts = ref(false);
const promptOptions = ref<{ label: string; value: number }[]>([]);
const selectedPromptId = ref<number>();
const selectedPrompt = ref<Prompt | null>(null);
const versionOptions = ref<{ label: string; value: number }[]>([]);
const selectedVersionId = ref<number>();
let versionsCache: PromptVersion[] = [];
const selectedVersion = ref<PromptVersion | null>(null);

const modelMap = ref<Record<number, string>>({});
const modelOptions = ref<{ label: string; value: number }[]>([]);

const userInput = ref('');
const imagesText = ref('');
const overrideModelId = ref<number>();
// 临时系统提示词：默认取版本内容，可临时改做灵活测试，不写回版本
const editContent = ref('');
const testing = ref(false);
const lastRun = ref<PromptTestRun | null>(null);
const previewing = ref(false);
const previewOpen = ref(false);
const previewText = ref('');
const panels = ref<string[]>(['content']);
const leftTab = ref('info');

const runs = ref<PromptTestRun[]>([]);
const loadingRuns = ref(false);

const hasImage = computed(() => imageUrlsArr().length > 0);
const outputSchemaText = computed(() =>
  selectedVersion.value?.outputSchema
    ? JSON.stringify(selectedVersion.value.outputSchema)
    : '默认 {"prompt":"..."}',
);
const slotsText = computed(() =>
  selectedVersion.value?.slots ? JSON.stringify(selectedVersion.value.slots, null, 2) : '',
);
const structureText = computed(() =>
  selectedVersion.value?.structure ? JSON.stringify(selectedVersion.value.structure, null, 2) : '',
);
const effectiveModelLabel = computed(() => {
  if (overrideModelId.value) return modelName(overrideModelId.value);
  const v = selectedVersion.value;
  const bound = hasImage.value ? v?.visionModelId : v?.textModelId;
  return bound ? modelName(bound) : '系统默认路由';
});

function imageUrlsArr(): string[] {
  return imagesText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function statusLabel(s?: string) {
  return s === 'published'
    ? '已发布'
    : s === 'archived'
      ? '已归档'
      : s === 'draft'
        ? '草稿'
        : s || '-';
}
function statusColor(s?: string) {
  return s === 'published' ? 'green' : s === 'archived' ? 'default' : 'blue';
}
function modelName(id?: number | null) {
  if (!id) return '系统默认路由';
  return modelMap.value[id] || `#${id}`;
}

async function loadPrompts() {
  loadingPrompts.value = true;
  try {
    const res = await pagePrompts({ page: 1, pageSize: 200 });
    promptOptions.value = (res.list || []).map((p) => ({
      label: `${p.code} · ${p.name}`,
      value: p.id,
    }));
  } catch {
    /* 拦截器已提示 */
  } finally {
    loadingPrompts.value = false;
  }
}

async function loadModels() {
  try {
    const list = await getModelOptions();
    const map: Record<number, string> = {};
    (list || []).forEach((m: { id: number; name: string }) => (map[m.id] = m.name));
    modelMap.value = map;
    modelOptions.value = (list || [])
      .filter((m: { modelType?: number }) => m.modelType === 1 || m.modelType == null)
      .map((m: { id: number; name: string; code?: string }) => ({
        label: m.code ? `${m.name} (${m.code})` : m.name,
        value: m.id,
      }));
  } catch {
    /* 忽略 */
  }
}

async function onPromptChange(id: number) {
  selectedVersionId.value = undefined;
  selectedVersion.value = null;
  versionOptions.value = [];
  lastRun.value = null;
  runs.value = [];
  overrideModelId.value = undefined;
  try {
    const detail = await getPromptDetail(id);
    selectedPrompt.value = detail.prompt;
    versionsCache = detail.versions || [];
    versionOptions.value = versionsCache.map((v) => ({
      label: `v${v.versionNo} (${statusLabel(v.status)})${v.id === detail.prompt.activeVersionId ? ' · 生效' : ''}`,
      value: v.id,
    }));
    const active = versionsCache.find((v) => v.id === detail.prompt.activeVersionId);
    selectedVersionId.value = active ? active.id : versionsCache[0]?.id;
    selectedVersion.value = versionsCache.find((v) => v.id === selectedVersionId.value) || null;
    editContent.value = selectedVersion.value?.content || '';
    if (selectedVersionId.value) loadRuns();
  } catch {
    /* 拦截器已提示 */
  }
}

function onVersionChange() {
  lastRun.value = null;
  selectedVersion.value = versionsCache.find((v) => v.id === selectedVersionId.value) || null;
  editContent.value = selectedVersion.value?.content || '';
  loadRuns();
}

function resetContent() {
  editContent.value = selectedVersion.value?.content || '';
  message.success('已重置为版本内容');
}

const contentDirty = computed(() => editContent.value !== (selectedVersion.value?.content || ''));

async function loadRuns() {
  if (!selectedVersionId.value) return;
  loadingRuns.value = true;
  try {
    runs.value = await listTestRuns(selectedVersionId.value);
  } catch {
    /* 拦截器已提示 */
  } finally {
    loadingRuns.value = false;
  }
}

async function preview() {
  if (!selectedVersionId.value) return;
  previewing.value = true;
  try {
    const res = await dryRunPreview({
      versionId: selectedVersionId.value,
      contentOverride: contentDirty.value ? editContent.value : undefined,
    });
    previewText.value = res.systemPrompt;
    previewOpen.value = true;
  } catch {
    /* 拦截器已提示 */
  } finally {
    previewing.value = false;
  }
}

async function run() {
  if (!selectedVersionId.value) return;
  testing.value = true;
  try {
    lastRun.value = await runTest({
      versionId: selectedVersionId.value,
      userInput: userInput.value,
      imageUrls: imageUrlsArr(),
      overrideModelId: overrideModelId.value,
      contentOverride: contentDirty.value ? editContent.value : undefined,
    });
    message.success('测试完成');
    await loadRuns();
  } catch {
    /* 拦截器已提示 */
  } finally {
    testing.value = false;
  }
}

async function rate(item: PromptTestRun, rating: number, note?: string) {
  try {
    await rateTest(item.id, { rating, note: note ?? item.note });
    item.rating = rating;
    if (note !== undefined) item.note = note;
    message.success('已评分');
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(() => {
  loadPrompts();
  loadModels();
});
</script>

<style scoped>
.test-console {
  padding: 24px;
}
.pane {
  display: flex;
  flex-direction: column;
}
.out-pre {
  max-height: 420px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-bg-layout, #fafafa);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 6px;
  font-size: 13px;
}
.out-pre.small {
  max-height: 220px;
  font-size: 12px;
  margin: 6px 0;
}
.inline-code {
  padding: 2px 6px;
  background: var(--color-bg-layout, #f5f5f5);
  border-radius: 4px;
  font-size: 12px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.empty-hint {
  padding: 24px;
  text-align: center;
  color: var(--color-text-tertiary, #999);
  font-size: 13px;
}
.run-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.next-bar {
  margin-top: 12px;
  text-align: right;
}
.run-item {
  width: 100%;
}
.run-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}
.run-time {
  margin-left: auto;
}
.run-rate {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
</style>
