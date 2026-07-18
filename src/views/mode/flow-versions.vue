<template>
  <div class="page-container">
    <div class="fv-header">
      <div class="fv-title">
        <a-button type="text" class="fv-back" @click="goBack">
          <template #icon><ArrowLeftOutlined /></template>
          返回
        </a-button>
        <a-divider type="vertical" />
        <span class="fv-name">版本 · {{ currentFlow?.name || '' }}</span>
      </div>
      <a-space>
        <a-button size="small" :disabled="!currentFlow" @click="editMeta">编辑元数据</a-button>
        <a-button type="primary" size="small" :disabled="!currentFlow" @click="newDraft">
          新建草稿
        </a-button>
      </a-space>
    </div>

    <a-descriptions
      v-if="currentFlow"
      size="small"
      bordered
      class="fv-desc"
      :column="{ xs: 1, sm: 2, lg: 4 }"
    >
      <a-descriptions-item label="编码">{{ currentFlow.code }}</a-descriptions-item>
      <a-descriptions-item label="目标模型">
        <a-tag v-if="currentFlow.targetModelCode" color="geekblue">{{
          currentFlow.targetModelCode
        }}</a-tag>
        <span v-else class="muted">通用</span>
      </a-descriptions-item>
      <a-descriptions-item label="入口">{{ currentFlow.entryCode || '通用' }}</a-descriptions-item>
      <a-descriptions-item label="生效状态">
        <a-tag v-if="currentFlow.activeVersionId > 0" color="green">已发布</a-tag>
        <a-tag v-else color="default">无生效版本</a-tag>
      </a-descriptions-item>
      <a-descriptions-item v-if="currentFlow.description" label="描述" :span="4">{{
        currentFlow.description
      }}</a-descriptions-item>
    </a-descriptions>

    <a-table
      :columns="versionColumns"
      :data-source="versions"
      :loading="loadingVersions"
      :pagination="false"
      row-key="id"
      size="small"
      class="version-table"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'versionNo'">
          v{{ record.versionNo }}
          <a-tag v-if="record.id === currentFlow?.activeVersionId" color="green" size="small"
            >生效中</a-tag
          >
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="vStatusColor(record.status)">{{ vStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="2" wrap>
            <a-button
              v-if="record.status === 'draft'"
              type="link"
              size="small"
              @click="openEditor(record)"
              >可视化编排</a-button
            >
            <a-button v-else type="link" size="small" @click="openEditor(record)">查看</a-button>
            <a-button type="link" size="small" :loading="previewing" @click="previewPlan(record)"
              >预览计划</a-button
            >
            <a-button type="link" size="small" @click="cloneDraft(record)">克隆</a-button>
            <a-popconfirm
              v-if="record.id !== currentFlow?.activeVersionId"
              :title="record.status === 'draft' ? '发布该版本？' : '回滚：发布该历史版本？'"
              @confirm="setActive(record)"
            >
              <a-button type="link" size="small">{{
                record.status === 'draft' ? '发布' : '回滚'
              }}</a-button>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'draft' && record.id !== currentFlow?.activeVersionId"
              title="删除草稿？"
              @confirm="removeDraft(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 编辑元数据 -->
    <a-modal v-model:open="metaOpen" title="编辑流程" :confirm-loading="saving" @ok="submitMeta">
      <a-form layout="vertical">
        <a-form-item label="编码 Code" required>
          <a-input v-model:value="meta.code" disabled placeholder="如 local_video_hitVideo" />
        </a-form-item>
        <a-form-item label="名称" required><a-input v-model:value="meta.name" /></a-form-item>
        <a-form-item label="关联目标生成模型（如 local-image/local-video，空=通用）">
          <a-select
            v-model:value="meta.targetModelCode"
            :options="modelCodeOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择目标模型 code"
          />
        </a-form-item>
        <a-form-item label="细分入口 EntryCode（可空 = 通用）">
          <a-select
            v-model:value="meta.entryCode"
            :options="entryCodeOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择计费场景 entryCode（来自已配置计费 offer）"
          />
        </a-form-item>
        <a-form-item label="描述"
          ><a-textarea v-model:value="meta.description" :rows="2"
        /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 干跑预览：该版本组装后的可执行 plan（不执行/不计费） -->
    <a-modal
      v-model:open="previewOpen"
      title="干跑预览 · 组装后的可执行计划（不执行/不计费/不落库）"
      :footer="null"
      width="760px"
    >
      <template v-if="previewData">
        <a-space style="margin-bottom: 10px" wrap>
          <a-tag color="blue">拓扑 {{ previewData.topology }}</a-tag>
          <a-tag color="purple">结算 {{ previewData.settlementType }}</a-tag>
          <span class="muted"
            >共 {{ previewData.steps?.length || 0 }} 步（版本列拓扑权威 + costType 缺省
            COST_ONLY）</span
          >
        </a-space>
        <a-table
          :data-source="previewData.steps"
          :columns="stepColumns"
          size="small"
          :pagination="false"
          row-key="code"
        />
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftOutlined } from '@antdv-next/icons';
import { message } from 'antdv-next';
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  updateFlow,
  getFlowDetail,
  createFlowDraft,
  deleteFlowDraft,
  publishFlowVersion,
  rollbackFlowVersion,
  previewFlowVersion,
  getModeMeta,
  type ModeFlow,
  type ModeFlowVersion,
  type FlowSaveReq,
  type ModePlanPreview,
} from '@/api/mode';
import { getModelOptions } from '@/api/model';

const route = useRoute();
const router = useRouter();
const flowId = Number(route.params.flowId);

const modelCodeOptions = ref<{ label: string; value: string }[]>([]);
const entryCodeOptions = ref<{ label: string; value: string }[]>([]);

function goBack() {
  router.push('/mode/flows');
}

// 干跑预览
const previewing = ref(false);
const previewOpen = ref(false);
const previewData = ref<ModePlanPreview | null>(null);
const stepColumns = [
  { title: '步骤编码', dataIndex: 'code', ellipsis: true },
  { title: '类型', dataIndex: 'kind', width: 90 },
  { title: 'Handler', dataIndex: 'handler', ellipsis: true },
  { title: 'Mode', dataIndex: 'mode', width: 80 },
  { title: '计费', dataIndex: 'costType', width: 100 },
];
async function previewPlan(record: ModeFlowVersion) {
  previewing.value = true;
  try {
    previewData.value = await previewFlowVersion(record.id);
    previewOpen.value = true;
  } catch {
    /* 拦截器已提示 */
  } finally {
    previewing.value = false;
  }
}

// 版本
const currentFlow = ref<ModeFlow | null>(null);
const versions = ref<ModeFlowVersion[]>([]);
const loadingVersions = ref(false);
const versionColumns = [
  { title: '版本', dataIndex: 'versionNo', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '拓扑', dataIndex: 'topology', width: 100 },
  { title: '结算', dataIndex: 'settlementType', width: 120 },
  { title: '变更', dataIndex: 'changelog', ellipsis: true },
  { title: '创建人', dataIndex: 'createdBy', width: 120, ellipsis: true },
  { title: '发布时间', dataIndex: 'publishedAt', width: 170 },
  { title: '操作', key: 'op', width: 260, fixed: 'right' as const },
];
function vStatusLabel(s?: string) {
  return s === 'published' ? '已发布' : s === 'archived' ? '已归档' : '草稿';
}
function vStatusColor(s?: string) {
  return s === 'published' ? 'green' : s === 'archived' ? 'default' : 'blue';
}

async function reloadVersions() {
  loadingVersions.value = true;
  try {
    const detail = await getFlowDetail(flowId);
    currentFlow.value = detail.flow;
    versions.value = detail.versions || [];
  } catch {
    /* */
  } finally {
    loadingVersions.value = false;
  }
}
function openEditor(v: ModeFlowVersion) {
  router.push(`/mode/flow-editor/${flowId}?versionId=${v.id}`);
}
async function newDraft() {
  try {
    const vid = await createFlowDraft(flowId, {});
    message.success('已建草稿');
    await reloadVersions();
    router.push(`/mode/flow-editor/${flowId}?versionId=${vid}`);
  } catch {
    /* */
  }
}
async function cloneDraft(v: ModeFlowVersion) {
  try {
    const vid = await createFlowDraft(flowId, { cloneFromVersionId: v.id });
    message.success('已克隆为新草稿');
    await reloadVersions();
    router.push(`/mode/flow-editor/${flowId}?versionId=${vid}`);
  } catch {
    /* */
  }
}
async function setActive(v: ModeFlowVersion) {
  try {
    if (v.status === 'draft') await publishFlowVersion(v.id);
    else await rollbackFlowVersion(flowId, v.id);
    message.success('已设为生效');
    await reloadVersions();
  } catch {
    /* */
  }
}
async function removeDraft(v: ModeFlowVersion) {
  try {
    await deleteFlowDraft(v.id);
    message.success('已删除');
    reloadVersions();
  } catch {
    /* */
  }
}

// 编辑元数据
const metaOpen = ref(false);
const saving = ref(false);
const meta = reactive<FlowSaveReq>({
  code: '',
  name: '',
  targetModelCode: '',
  entryCode: '',
  description: '',
  status: 1,
});
function editMeta() {
  if (!currentFlow.value) return;
  Object.assign(meta, {
    code: currentFlow.value.code,
    name: currentFlow.value.name,
    targetModelCode: currentFlow.value.targetModelCode || '',
    entryCode: currentFlow.value.entryCode || '',
    description: currentFlow.value.description || '',
    status: currentFlow.value.status,
  });
  metaOpen.value = true;
}
async function submitMeta() {
  if (!meta.name?.trim()) {
    message.warning('请填写名称');
    return;
  }
  saving.value = true;
  try {
    await updateFlow(flowId, meta);
    message.success('已保存');
    metaOpen.value = false;
    reloadVersions();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function loadModelCodes() {
  try {
    const list = await getModelOptions();
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
async function loadEntryCodes() {
  try {
    const m = await getModeMeta();
    entryCodeOptions.value = (m.entryCodes || []).map((c) => ({ label: c, value: c }));
  } catch {
    /* 忽略；空则手填 */
  }
}

onMounted(() => {
  reloadVersions();
  loadModelCodes();
  loadEntryCodes();
});
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.fv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.fv-title {
  display: flex;
  align-items: center;
}
.fv-back {
  padding-left: 0;
}
.fv-name {
  font-size: 16px;
  font-weight: 600;
}
.fv-desc {
  margin-bottom: 16px;
}
.version-table {
  margin-top: 0;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
