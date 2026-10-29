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
    </div>

    <a-alert type="info" show-icon class="frozen-alert" :message="t('modeRouting.legacyFrozen')">
      <template #action>
        <a-button size="small" type="link" @click="router.push('/workflow/definitions')">
          {{ t('modeRouting.goDefinitions') }}
        </a-button>
      </template>
    </a-alert>

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
          <span class="ver-cell">
            <b>v{{ record.versionNo }}</b>
            <a-tag v-if="record.id === currentFlow?.activeVersionId" color="green" size="small"
              >生效中</a-tag
            >
          </span>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="vStatusColor(record.status)">{{ vStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="2" wrap>
            <a-button type="link" size="small" @click="openEditor(record)">查看</a-button>
            <a-button type="link" size="small" :loading="previewing" @click="previewPlan(record)"
              >预览计划</a-button
            >
          </a-space>
        </template>
      </template>
    </a-table>

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
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
  getFlowDetail,
  previewFlowVersion,
  type ModeFlow,
  type ModeFlowVersion,
  type ModePlanPreview,
} from '@/api/mode';

// 旧 Mode 流已冻结为只读：只留「查看」「预览计划」，编辑统一到工作流定义页
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const flowId = Number(route.params.flowId);

function goBack() {
  router.push('/workflow/modes/flows');
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
  { title: '版本', dataIndex: 'versionNo', width: 150 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '拓扑', dataIndex: 'topology', width: 120 },
  { title: '结算', dataIndex: 'settlementType', width: 180 },
  { title: '变更', dataIndex: 'changelog', width: 200, ellipsis: true },
  { title: '创建人', dataIndex: 'createdBy', width: 120, ellipsis: true },
  { title: '发布时间', dataIndex: 'publishedAt', width: 180 },
  { title: '操作', key: 'op', minWidth: 160, fixed: 'right' as const },
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
  router.push(`/workflow/modes/flow-editor/${flowId}?versionId=${v.id}`);
}
onMounted(() => {
  reloadVersions();
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
.frozen-alert {
  margin-bottom: 16px;
}
.fv-desc {
  margin-bottom: 16px;
}
.version-table {
  margin-top: 0;
}
.ver-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
