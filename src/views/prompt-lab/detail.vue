<template>
  <div class="detail-page">
    <div class="detail-header">
      <a-space>
        <a-button @click="goBack">返回</a-button>
        <span class="detail-title">{{ prompt?.name }}</span>
        <a-tag v-if="prompt" :color="prompt.type === 'agent' ? 'purple' : 'blue'">
          {{ prompt.type === 'agent' ? 'Agent 提示词' : '优化模板' }}
        </a-tag>
        <code v-if="prompt" class="detail-code">{{ prompt.code }}</code>
      </a-space>
      <a-space>
        <a-button @click="openEditMeta">编辑元数据</a-button>
        <a-button type="primary" @click="goNewDraft">新建草稿版本</a-button>
      </a-space>
    </div>

    <a-descriptions v-if="prompt" bordered size="small" :column="3" class="detail-meta">
      <a-descriptions-item label="编码">{{ prompt.code }}</a-descriptions-item>
      <a-descriptions-item label="目标模型">{{
        prompt.targetModelCode || '通用默认'
      }}</a-descriptions-item>
      <a-descriptions-item label="类型">{{ prompt.type }}</a-descriptions-item>
      <a-descriptions-item label="启用">
        <a-tag :color="prompt.status === 1 ? 'green' : 'red'">{{
          prompt.status === 1 ? '启用' : '停用'
        }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="生效版本">
        {{ activeVersionNo != null ? `v${activeVersionNo}` : '无' }}
      </a-descriptions-item>
      <a-descriptions-item label="使用次数">{{ prompt.usageCount || 0 }}</a-descriptions-item>
      <a-descriptions-item label="负责人">{{ prompt.owner || '-' }}</a-descriptions-item>
      <a-descriptions-item v-if="prompt.type === 'agent'" label="Agent 角色">{{
        prompt.agentRole || '-'
      }}</a-descriptions-item>
      <a-descriptions-item v-if="prompt.type === 'agent'" label="Agent 标识">{{
        prompt.agentCode || '-'
      }}</a-descriptions-item>
      <a-descriptions-item label="描述" :span="3">{{
        prompt.description || '-'
      }}</a-descriptions-item>
    </a-descriptions>

    <div v-if="prompt && prompt.type === 'optimize'" class="related-flows">
      <span class="rf-title"
        >关联 Mode 流（同目标模型 {{ prompt.targetModelCode || '通用默认' }}）：</span
      >
      <template v-if="relatedFlows.length">
        <a-space wrap>
          <a-tag
            v-for="f in relatedFlows"
            :key="f.id"
            :color="f.activeVersionId > 0 ? 'green' : 'default'"
            class="rf-tag"
            @click="goFlows"
            >{{ f.name }}{{ f.activeVersionId > 0 ? ' · 已发布' : '' }}</a-tag
          >
        </a-space>
      </template>
      <span v-else class="muted">暂无（可去「Mode 流管理」为该目标模型编排工作流）</span>
    </div>

    <div class="section-bar">
      <span class="section-title">版本历史</span>
      <a-space>
        <a-select
          v-model:value="diffA"
          style="width: 120px"
          placeholder="版本A"
          :options="versionSelectOptions"
          size="small"
        />
        <a-select
          v-model:value="diffB"
          style="width: 120px"
          placeholder="版本B"
          :options="versionSelectOptions"
          size="small"
        />
        <a-button size="small" :disabled="!diffA || !diffB" @click="handleDiff">对比</a-button>
      </a-space>
    </div>

    <a-table
      :columns="versionColumns"
      :data-source="versions"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'versionNo'">
          v{{ record.versionNo }}
          <a-tag v-if="record.id === prompt?.activeVersionId" color="green" size="small"
            >生效中</a-tag
          >
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-if="column.dataIndex === 'model'">
          <span
            >{{ modelName(record.textModelId)
            }}<span v-if="record.visionModelId">
              / {{ modelName(record.visionModelId) }}</span
            ></span
          >
        </template>
        <template v-if="column.key === 'operation'">
          <a-space :size="2" wrap>
            <a-button type="link" size="small" @click="viewVersion(record)">查看</a-button>
            <a-button
              v-if="record.status === 'draft'"
              type="link"
              size="small"
              @click="editDraft(record)"
              >编辑</a-button
            >
            <a-button type="link" size="small" @click="openTest(record)">测试</a-button>
            <a-button type="link" size="small" @click="cloneDraft(record)">克隆</a-button>
            <a-popconfirm
              v-if="record.id !== prompt?.activeVersionId"
              :title="
                record.status === 'draft'
                  ? '发布该版本为生效版本？'
                  : '回滚：发布该历史版本为生效版本？'
              "
              @confirm="setActive(record)"
            >
              <a-button type="link" size="small">{{
                record.status === 'draft' ? '发布' : '回滚到此'
              }}</a-button>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'draft' && record.id !== prompt?.activeVersionId"
              title="删除该草稿版本？"
              @confirm="removeDraft(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 查看版本内容 -->
    <a-modal v-model:open="viewOpen" title="版本内容" width="720px" :footer="null">
      <a-descriptions size="small" :column="2" bordered style="margin-bottom: 12px">
        <a-descriptions-item label="版本">v{{ viewVersionData?.versionNo }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{
          statusLabel(viewVersionData?.status)
        }}</a-descriptions-item>
        <a-descriptions-item label="变更说明" :span="2">{{
          viewVersionData?.changelog || '-'
        }}</a-descriptions-item>
      </a-descriptions>
      <pre class="content-pre">{{ viewVersionData?.content }}</pre>
    </a-modal>

    <!-- 版本对比 -->
    <a-modal v-model:open="diffOpen" title="版本对比" width="920px" :footer="null">
      <div v-if="diffData">
        <a-alert
          v-if="diffData.identical"
          type="info"
          message="两版本内容一致"
          show-icon
          style="margin-bottom: 12px"
        />
        <div class="diff-grid">
          <div>
            <div class="diff-col-title">v{{ diffData.versionNoA }}</div>
            <pre class="content-pre">{{ diffData.contentA }}</pre>
          </div>
          <div>
            <div class="diff-col-title">v{{ diffData.versionNoB }}</div>
            <pre class="content-pre">{{ diffData.contentB }}</pre>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 编辑元数据 -->
    <a-modal
      v-model:open="editMetaOpen"
      title="编辑元数据"
      :confirm-loading="savingMeta"
      @ok="submitMeta"
    >
      <a-form layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="metaForm.name" /></a-form-item>
        <a-form-item
          v-if="prompt?.type === 'optimize'"
          label="目标生成模型（专用提示词专用模型，留空=通用默认）"
        >
          <a-select
            v-model:value="metaForm.targetModelCode"
            :options="modelCodeOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择目标模型 code，留空=通用默认"
          />
        </a-form-item>
        <a-form-item label="负责人"><a-input v-model:value="metaForm.owner" /></a-form-item>
        <a-form-item label="描述"
          ><a-textarea v-model:value="metaForm.description" :rows="2"
        /></a-form-item>
        <a-form-item label="标签">
          <a-select v-model:value="metaForm.tags" mode="tags" :token-separators="[',']" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch
            v-model:checked="metaEnabled"
            checked-children="启用"
            un-checked-children="停用"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 效果测试抽屉 -->
    <a-drawer
      v-model:open="testOpen"
      title="效果测试"
      width="560"
      :body-style="{ paddingBottom: '24px' }"
    >
      <a-form layout="vertical">
        <a-form-item label="被测版本">
          <a-input
            :value="
              testVersion ? `v${testVersion.versionNo} (${statusLabel(testVersion.status)})` : ''
            "
            disabled
          />
        </a-form-item>
        <a-form-item label="用户输入 userInput">
          <a-textarea v-model:value="testInput" :rows="3" placeholder="模拟用户输入" />
        </a-form-item>
        <a-form-item label="图片 URL（可选，每行一个）">
          <a-textarea v-model:value="testImages" :rows="2" placeholder="https://..." />
        </a-form-item>
        <a-button type="primary" :loading="testing" @click="doRun">运行测试</a-button>
      </a-form>

      <a-divider>测试记录</a-divider>
      <a-list :data-source="testRuns" :loading="loadingRuns" size="small">
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
                <span class="run-latency">{{
                  item.latencyMs != null ? item.latencyMs + 'ms' : '-'
                }}</span>
                <span class="run-time">{{ item.createTime }}</span>
              </div>
              <pre v-if="item.output" class="run-output">{{ item.output }}</pre>
              <div v-if="item.note" class="run-note">备注：{{ item.note }}</div>
              <div class="run-rate">
                <a-rate :value="item.rating || 0" @change="(v: number) => rate(item, v)" />
                <a-input
                  :value="item.note"
                  size="small"
                  placeholder="评分备注，回车保存"
                  style="width: 220px"
                  @pressEnter="(e: any) => rate(item, item.rating || 0, e.target.value)"
                />
              </div>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { pageFlows, type ModeFlow } from '@/api/mode';
import { getModelOptions } from '@/api/model';
import {
  getPromptDetail,
  updatePrompt,
  publishVersion,
  rollbackVersion,
  deleteDraft,
  diffVersions,
  runTest,
  rateTest,
  listTestRuns,
  type Prompt,
  type PromptVersion,
  type VersionDiff,
  type PromptTestRun,
} from '@/api/prompt-lab';

const route = useRoute();
const router = useRouter();
const promptId = Number(route.params.id);

const loading = ref(false);
const prompt = ref<Prompt | null>(null);
const versions = ref<PromptVersion[]>([]);
const modelMap = ref<Record<number, string>>({});
const modelCodeOptions = ref<{ label: string; value: string }[]>([]);

const activeVersionNo = computed(() => {
  const v = versions.value.find((x) => x.id === prompt.value?.activeVersionId);
  return v ? v.versionNo : null;
});
const versionSelectOptions = computed(() =>
  versions.value.map((v) => ({ label: `v${v.versionNo} (${statusLabel(v.status)})`, value: v.id })),
);

const versionColumns = [
  { title: '版本', dataIndex: 'versionNo', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '绑定模型', dataIndex: 'model', width: 200, ellipsis: true },
  { title: '变更说明', dataIndex: 'changelog', ellipsis: true },
  { title: '创建人', dataIndex: 'createdBy', width: 110 },
  { title: '发布时间', dataIndex: 'publishedAt', width: 170 },
  { title: '操作', key: 'operation', width: 320, fixed: 'right' as const },
];

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
  if (!id) return '路由';
  return modelMap.value[id] || `#${id}`;
}

async function load() {
  loading.value = true;
  try {
    const res = await getPromptDetail(promptId);
    prompt.value = res.prompt;
    versions.value = res.versions || [];
    loadRelatedFlows();
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadModels() {
  try {
    const list = await getModelOptions();
    const map: Record<number, string> = {};
    (list || []).forEach((m: { id: number; name: string }) => (map[m.id] = m.name));
    modelMap.value = map;
    modelCodeOptions.value = (list || [])
      .filter((m: { code?: string }) => !!m.code)
      .map((m: { name: string; code?: string }) => ({
        label: `${m.name} (${m.code})`,
        value: m.code as string,
      }));
  } catch {
    /* 忽略 */
  }
}

const relatedFlows = ref<ModeFlow[]>([]);
async function loadRelatedFlows() {
  // 仅对「具体目标模型」的优化模板查关联 mode 流；通用默认(空 target)不查（避免拉全量）
  const target = prompt.value?.targetModelCode;
  if (prompt.value?.type !== 'optimize' || !target) {
    relatedFlows.value = [];
    return;
  }
  try {
    const res = await pageFlows({ targetModelCode: target, pageSize: 50 });
    relatedFlows.value = res.list || [];
  } catch {
    /* 忽略 */
  }
}
function goFlows() {
  router.push('/workflow/modes/flows');
}

function goBack() {
  router.push('/content/prompt-lab/list');
}
function goNewDraft() {
  router.push(`/content/prompt-lab/editor/${promptId}`);
}
function editDraft(record: PromptVersion) {
  router.push(`/content/prompt-lab/editor/${promptId}?versionId=${record.id}`);
}
function cloneDraft(record: PromptVersion) {
  router.push(`/content/prompt-lab/editor/${promptId}?cloneFrom=${record.id}`);
}

async function setActive(record: PromptVersion) {
  try {
    if (record.status === 'draft') {
      await publishVersion(record.id);
    } else {
      await rollbackVersion(promptId, record.id);
    }
    message.success('已设为生效版本');
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}
async function removeDraft(record: PromptVersion) {
  try {
    await deleteDraft(record.id);
    message.success('已删除草稿');
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}

// 查看
const viewOpen = ref(false);
const viewVersionData = ref<PromptVersion | null>(null);
function viewVersion(record: PromptVersion) {
  viewVersionData.value = record;
  viewOpen.value = true;
}

// Diff
const diffA = ref<number>();
const diffB = ref<number>();
const diffOpen = ref(false);
const diffData = ref<VersionDiff | null>(null);
async function handleDiff() {
  if (!diffA.value || !diffB.value) return;
  try {
    diffData.value = await diffVersions(diffA.value, diffB.value);
    diffOpen.value = true;
  } catch {
    /* 拦截器已提示 */
  }
}

// 编辑元数据
const editMetaOpen = ref(false);
const savingMeta = ref(false);
const metaForm = reactive<{
  name: string;
  targetModelCode: string;
  owner: string;
  description: string;
  tags: string[];
  status: number;
}>({
  name: '',
  targetModelCode: '',
  owner: '',
  description: '',
  tags: [],
  status: 1,
});
const metaEnabled = computed({
  get: () => metaForm.status === 1,
  set: (v: boolean) => (metaForm.status = v ? 1 : 0),
});
function openEditMeta() {
  if (!prompt.value) return;
  metaForm.name = prompt.value.name;
  metaForm.targetModelCode = prompt.value.targetModelCode || '';
  metaForm.owner = prompt.value.owner || '';
  metaForm.description = prompt.value.description || '';
  metaForm.tags = prompt.value.tags || [];
  metaForm.status = prompt.value.status;
  editMetaOpen.value = true;
}
async function submitMeta() {
  savingMeta.value = true;
  try {
    await updatePrompt(promptId, {
      name: metaForm.name,
      targetModelCode: metaForm.targetModelCode ?? '',
      owner: metaForm.owner,
      description: metaForm.description,
      tags: metaForm.tags,
      status: metaForm.status,
    });
    message.success('已保存');
    editMetaOpen.value = false;
    await load();
  } catch {
    /* 拦截器已提示 */
  } finally {
    savingMeta.value = false;
  }
}

// 测试
const testOpen = ref(false);
const testVersion = ref<PromptVersion | null>(null);
const testInput = ref('');
const testImages = ref('');
const testing = ref(false);
const testRuns = ref<PromptTestRun[]>([]);
const loadingRuns = ref(false);

function openTest(record: PromptVersion) {
  testVersion.value = record;
  testInput.value = '';
  testImages.value = '';
  testOpen.value = true;
  loadRuns();
}
async function loadRuns() {
  if (!testVersion.value) return;
  loadingRuns.value = true;
  try {
    testRuns.value = await listTestRuns(testVersion.value.id);
  } catch {
    /* 拦截器已提示 */
  } finally {
    loadingRuns.value = false;
  }
}
async function doRun() {
  if (!testVersion.value) return;
  testing.value = true;
  try {
    const imageUrls = testImages.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await runTest({ versionId: testVersion.value.id, userInput: testInput.value, imageUrls });
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
  load();
  loadModels();
});
</script>

<style scoped>
.detail-page {
  padding: 24px;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 16px;
  font-weight: 600;
}
.detail-code {
  padding: 2px 8px;
  background: var(--color-bg-layout, #f5f5f5);
  border-radius: 4px;
  font-size: 13px;
}
.detail-meta {
  margin-bottom: 12px;
}
.related-flows {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  padding: 8px 12px;
  background: var(--color-bg-layout, #fafafa);
  border-radius: 6px;
}
.rf-title {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
}
.rf-tag {
  cursor: pointer;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.section-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
}
.content-pre {
  max-height: 480px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-bg-layout, #fafafa);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 6px;
  font-size: 13px;
}
.diff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.diff-col-title {
  margin-bottom: 6px;
  font-weight: 600;
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
.run-latency {
  color: var(--color-text-primary, #262626);
}
.run-output {
  max-height: 160px;
  overflow: auto;
  margin: 6px 0;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-bg-layout, #fafafa);
  border-radius: 4px;
  font-size: 12px;
}
.run-note {
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}
.run-rate {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
</style>
