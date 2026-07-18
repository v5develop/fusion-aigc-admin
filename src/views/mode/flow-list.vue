<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText><a-empty description="暂无 Mode 流，点「新建流程」创建" /></template>
      <template #toolbar>
        <a-button type="primary" @click="openCreate">新建流程</a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'targetModelCode'">
          <a-tag v-if="record.targetModelCode" color="geekblue">{{ record.targetModelCode }}</a-tag>
          <span v-else class="muted">通用</span>
        </template>
        <template v-if="column.dataIndex === 'activeVersionId'">
          <a-tag v-if="record.activeVersionId > 0" color="green">已发布</a-tag>
          <a-tag v-else color="default">无生效版本</a-tag>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">{{
            record.status === 1 ? '启用' : '停用'
          }}</a-tag>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="openVersions(record)">版本/编排</a-button>
            <a-popconfirm title="删除该流程（含全部版本）？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- 新建流程元数据 -->
    <a-modal v-model:open="metaOpen" title="新建流程" :confirm-loading="saving" @ok="submitMeta">
      <a-form layout="vertical">
        <a-form-item label="编码 Code" required>
          <a-input v-model:value="meta.code" placeholder="如 local_video_hitVideo" />
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
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import {
  pageFlows,
  createFlow,
  deleteFlow,
  getModeMeta,
  type ModeFlow,
  type FlowSaveReq,
} from '@/api/mode';
import { getModelOptions } from '@/api/model';
import ProTable from '@/components/Pro/ProTable/index.vue';

const router = useRouter();
const tableRef = ref<InstanceType<typeof ProTable>>();
const modelCodeOptions = ref<{ label: string; value: string }[]>([]);

const columns = [
  {
    title: '编码',
    dataIndex: 'code',
    width: 200,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
  {
    title: '目标模型',
    dataIndex: 'targetModelCode',
    width: 160,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  { title: '入口', dataIndex: 'entryCode', width: 140, ellipsis: true },
  { title: '生效状态', dataIndex: 'activeVersionId', width: 110, align: 'center' as const },
  { title: '启用', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updateTime', width: 170 },
  {
    title: '操作',
    dataIndex: 'op',
    key: 'op',
    width: 160,
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

async function loadData(params: Record<string, unknown>) {
  const res = await pageFlows({
    keyword: params.code as string | undefined,
    targetModelCode: params.targetModelCode as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return { data: res.list || [], total: res.total || 0, success: true };
}

// 版本/编排 → 独立页面
function openVersions(record: ModeFlow) {
  router.push(`/mode/flows/${record.id}/versions`);
}

async function handleDelete(record: ModeFlow) {
  try {
    await deleteFlow(record.id);
    message.success('已删除');
    tableRef.value?.refresh();
  } catch {
    /* */
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

// entryCode = 计费场景（来自已配置 offer），下拉选择免手填
const entryCodeOptions = ref<{ label: string; value: string }[]>([]);
async function loadEntryCodes() {
  try {
    const m = await getModeMeta();
    entryCodeOptions.value = (m.entryCodes || []).map((c) => ({ label: c, value: c }));
  } catch {
    /* 忽略；空则手填 */
  }
}

// 新建流程
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
function openCreate() {
  Object.assign(meta, {
    code: '',
    name: '',
    targetModelCode: '',
    entryCode: '',
    description: '',
    status: 1,
  });
  metaOpen.value = true;
}
async function submitMeta() {
  if (!meta.code?.trim() || !meta.name?.trim()) {
    message.warning('请填写编码与名称');
    return;
  }
  saving.value = true;
  try {
    await createFlow(meta);
    message.success('已保存');
    metaOpen.value = false;
    tableRef.value?.refresh();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadModelCodes();
  loadEntryCodes();
});
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
