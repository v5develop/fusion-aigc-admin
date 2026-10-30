<template>
  <div class="creaft-readiness">
    <div class="toolbar">
      <a-select v-model:value="route" :options="routeOptions" style="width: 280px" />
      <a-button :loading="loading" @click="load">刷新</a-button>
    </div>
    <div class="hint">
      只读：说明用户在该工具里能选到的每一档，网关是否就绪，以及读不到时的原因。未就绪的档位不会出现在用户端价格列表里。
    </div>
    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      row-key="key"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'offered'">
          <a-tag :color="record.offered ? 'blue' : 'default'">{{
            record.offered ? '用户可选' : '仅查看'
          }}</a-tag>
        </template>
        <template v-else-if="column.key === 'ready'">
          <a-tag :color="record.ready ? 'green' : 'red'">{{
            record.ready ? '已就绪' : '未就绪'
          }}</a-tag>
        </template>
        <template v-else-if="column.key === 'reason'">
          <span v-if="record.ready" class="muted">—</span>
          <span v-else>{{ reasonText(record.reason) }}</span>
        </template>
      </template>
    </a-table>

    <a-card v-if="toolsVisible" class="workflow-tools" :title="t('workflowDefinition.tools.title')">
      <template #extra>
        <a-button size="small" :loading="toolsLoading" @click="loadTools">{{
          t('workflowDefinition.tools.refresh')
        }}</a-button>
      </template>
      <div class="hint">{{ t('workflowDefinition.tools.hint') }}</div>
      <a-table
        :columns="toolColumns"
        :data-source="toolRows"
        :loading="toolsLoading"
        :pagination="false"
        :row-key="(r: WorkflowToolRow) => `${r.modelGroup}|${r.operation}`"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'ready'">
            <a-tag v-if="record.ready === true" color="green">{{
              t('workflowDefinition.tools.statusReady')
            }}</a-tag>
            <a-tag v-else-if="record.ready === false" color="red">{{
              t('workflowDefinition.tools.statusNotReady')
            }}</a-tag>
            <a-tooltip v-else :title="t('workflowDefinition.tools.unknownTip')">
              <a-tag color="default">{{ t('workflowDefinition.tools.statusUnknown') }}</a-tag>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'reason'">
            <span v-if="record.ready !== false" class="muted">—</span>
            <span v-else>{{
              record.reason ? reasonText(record.reason) : t('workflowDefinition.tools.noReason')
            }}</span>
          </template>
          <template v-else-if="column.key === 'usedBy'">
            <span v-if="!record.usedBy.length" class="muted">{{
              t('workflowDefinition.tools.noUsage')
            }}</span>
            <div v-else class="used-by">
              <router-link
                v-for="u in record.usedBy"
                :key="`${u.definitionId}-${u.version}`"
                :to="`/workflow/definitions/${u.definitionId}`"
                >{{ u.definitionCode }} v{{ u.version }}</router-link
              >
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { type CreaftToolVariantStatus, getCreaftToolReadiness } from '@/api/creaft-compat';
import { isEndpointMissing } from '@/api/workflow-definition';
import { listWorkflowTools, type WorkflowToolRow } from '@/api/workflow-tools';

const { t } = useI18n();

// 目前只有超分登记了变体；新增工具时在后端 ToolVariantReadiness 登记后，这里加一项即可
const routeOptions = [
  { label: '视频超分 /tools/ai-video-enhance', value: '/tools/ai-video-enhance' },
];
const route = ref('/tools/ai-video-enhance');
const rows = ref<CreaftToolVariantStatus[]>([]);
const loading = ref(false);

const columns = [
  { title: '档位', dataIndex: 'key', key: 'key' },
  { title: '模型组', dataIndex: 'modelGroup', key: 'modelGroup' },
  { title: '用户可选', key: 'offered', width: 120 },
  { title: '网关就绪', key: 'ready', width: 120 },
  { title: '启用部署数', dataIndex: 'enabledDeployments', key: 'enabledDeployments', width: 120 },
  { title: '原因', key: 'reason' },
];

// reason 是机器码，这里翻译成运营看得懂的说明；取值来自网关 readiness 与 Java 侧的兜底
const REASON_TEXT: Record<string, string> = {
  'model_group.unknown': '网关里没有这个模型组，请在 AI 网关里建组并发布',
  'model_group.disabled': '模型组已停用，请在 AI 网关里启用并发布',
  'operation.mismatch': '模型组的操作类型与该档不符，请检查模型组的操作类型',
  'deployments.none_enabled': '模型组下没有启用的部署，请在 AI 网关里启用部署并发布',
  'deployments.all_circuit_open': '部署全部被熔断，暂时不可用，稍后自动恢复',
  'deployments.all_balance_excluded': '部署的余额或额度已耗尽，暂时不可用',
  model_group_missing: '网关里没有这个模型组，请在 AI 网关里建组并发布',
  gateway_unreachable: 'AI 网关不可达，无法判断就绪状态',
  no_answer: '网关没有应答该模型组，请检查网关服务',
};

function reasonText(reason?: string | null) {
  if (!reason) return '未知原因';
  return REASON_TEXT[reason] ?? reason;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await getCreaftToolReadiness(route.value);
  } catch {
    message.error('读取工具就绪状态失败');
  } finally {
    loading.value = false;
  }
}

// 工作流工具：后端接口未上线（404）时整块隐藏，不报错
const toolRows = ref<WorkflowToolRow[]>([]);
const toolsLoading = ref(false);
const toolsVisible = ref(true);

const toolColumns = computed(() => [
  { title: t('workflowDefinition.tools.modelGroup'), dataIndex: 'modelGroup', key: 'modelGroup' },
  {
    title: t('workflowDefinition.tools.operation'),
    dataIndex: 'operation',
    key: 'operation',
    width: 180,
  },
  { title: t('workflowDefinition.tools.ready'), key: 'ready', width: 140 },
  { title: t('workflowDefinition.tools.reason'), key: 'reason' },
  { title: t('workflowDefinition.tools.usedBy'), key: 'usedBy' },
]);

async function loadTools() {
  toolsLoading.value = true;
  try {
    toolRows.value = await listWorkflowTools();
  } catch (e) {
    if (isEndpointMissing(e)) {
      toolsVisible.value = false;
    } else {
      message.error(t('workflowDefinition.tools.loadFailed'));
    }
  } finally {
    toolsLoading.value = false;
  }
}

onMounted(() => {
  load();
  loadTools();
});
</script>

<style scoped>
.creaft-readiness {
  padding: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.hint {
  margin-bottom: 12px;
  color: rgba(0, 0, 0, 0.55);
}
.muted {
  color: rgba(0, 0, 0, 0.35);
}
.workflow-tools {
  margin-top: 16px;
}
.used-by {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
</style>
