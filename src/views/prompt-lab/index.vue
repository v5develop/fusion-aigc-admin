<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText>
        <a-empty
          description="暂无提示词，可点击「全量同步」从 data/prompt 与 agent .md 导入，或「新建提示词」"
        />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="goCreate">新建提示词</a-button>
        <a-popconfirm
          title="将比对 data/prompt/*.txt 与 prompts/agents/*.md 的内容：未变跳过，已变生成草稿版本（不影响当前生效版本），新增的直接发布为 v1。确认全量同步？"
          @confirm="handleImport()"
        >
          <a-button :loading="importing">全量同步</a-button>
        </a-popconfirm>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'type'">
          <a-tag :color="record.type === 'agent' ? 'purple' : 'blue'">
            {{ record.type === 'agent' ? 'Agent 提示词' : '优化模板' }}
          </a-tag>
        </template>
        <template v-if="column.dataIndex === 'targetModelCode'">
          <a-tag v-if="record.targetModelCode" color="geekblue">{{ record.targetModelCode }}</a-tag>
          <span v-else class="muted">通用默认</span>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? '启用' : '停用' }}
          </a-tag>
        </template>
        <template v-if="column.dataIndex === 'activeVersionId'">
          <a-tag v-if="record.activeVersionId > 0" color="green">已发布</a-tag>
          <a-tag v-else color="default">无生效版本</a-tag>
        </template>
        <template v-if="column.dataIndex === 'usageCount'">
          {{ record.usageCount || 0 }}
        </template>
        <template v-if="column.key === 'operation'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="goDetail(record)">详情/版本</a-button>
            <!-- 单条同步：改一条却全量同步的话，其余变更过的文件会一并刷出草稿，
                 还得在列表里逐条辨认哪个是自己要的。
                 无 sourcePath 不禁用按钮——V1.0.48 之前导入的历史数据该列也为空，
                 但它们确实有源文件，禁用会误伤；真没有源文件时同步会明确回提示。 -->
            <a-tooltip :title="sourceTip(record)">
              <a-popconfirm
                :title="`只同步「${record.code}」：源文件有变更则生成草稿版本，不影响当前生效版本。确认？`"
                @confirm="handleImport(record.code)"
              >
                <a-button
                  type="link"
                  size="small"
                  :loading="syncingCode === record.code"
                  :disabled="importing"
                >
                  同步文件
                </a-button>
              </a-popconfirm>
            </a-tooltip>
            <a-popconfirm
              title="删除将连同其全部版本一并软删，确认？"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { pagePrompts, deletePrompt, importExisting, type Prompt } from '@/api/prompt-lab';
import ProTable from '@/components/Pro/ProTable/index.vue';

const router = useRouter();
const tableRef = ref<InstanceType<typeof ProTable>>();
const importing = ref(false);

const typeOptions = [
  { label: '优化模板 (optimize)', value: 'optimize' },
  { label: 'Agent 提示词 (agent)', value: 'agent' },
];
const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

const columns = [
  { title: '编码', dataIndex: 'code', width: 180, ellipsis: true },
  {
    title: '名称',
    dataIndex: 'name',
    width: 180,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 130,
    search: true,
    searchType: 'select' as const,
    searchOptions: typeOptions,
  },
  {
    title: '目标模型',
    dataIndex: 'targetModelCode',
    width: 160,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  {
    title: '生效状态',
    dataIndex: 'activeVersionId',
    width: 110,
    align: 'center' as const,
  },
  {
    title: '启用',
    dataIndex: 'status',
    width: 90,
    align: 'center' as const,
    search: true,
    searchType: 'select' as const,
    searchOptions: statusOptions,
  },
  { title: '使用次数', dataIndex: 'usageCount', width: 90, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updateTime', width: 180 },
  {
    title: '操作',
    dataIndex: 'operation',
    key: 'operation',
    width: 260,
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

async function loadData(params: Record<string, unknown>) {
  const res = await pagePrompts({
    keyword: params.name as string | undefined,
    type: params.type as string | undefined,
    status: params.status as number | undefined,
    targetModelCode: params.targetModelCode as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return { data: res.list || [], total: res.total || 0, success: true };
}

function goCreate() {
  router.push('/content/prompt-lab/create');
}

function goDetail(record: Prompt) {
  router.push(`/content/prompt-lab/detail/${record.id}`);
}

async function handleDelete(record: Prompt) {
  try {
    await deletePrompt(record.id);
    message.success('已删除');
    tableRef.value?.refresh();
  } catch {
    /* 错误已由拦截器提示 */
  }
}

/** 正在单条同步的 code，用于只让那一行的按钮转圈，而不是整表都在 loading */
const syncingCode = ref<string | null>(null);

/** 同步按钮的来源提示：同步过一次后 sourcePath 就会被写上，所以空只代表「还不知道」，不代表「没有」 */
function sourceTip(record: Prompt) {
  return record.sourcePath
    ? `来源：${record.sourcePath}`
    : '尚未记录来源（手工创建，或本功能上线前导入的）。同步一次后会补上来源；若确无源文件会提示';
}

/**
 * 同步文件侧提示词。传 code = 只同步这一条（列表行内操作），不传 = 全量（工具栏）。
 * 结果提示区分单条与全量：单条时运营关心的是「这一条到底怎么样了」，
 * 报「新增 0，草稿 1，跳过 0」不如直接说「已生成草稿」。
 */
async function handleImport(code?: string) {
  if (code) syncingCode.value = code;
  else importing.value = true;
  try {
    const res = await importExisting(code ? [code] : undefined);
    const missing = res.details.filter((d) => d.startsWith('missing:'));

    if (missing.length) {
      message.error(
        code
          ? `「${code}」没有对应的源文件，可能是在管理端手工创建的，无法从文件同步`
          : `以下 code 未找到源文件：${missing.map((d) => d.slice('missing:'.length)).join('、')}`,
        6,
      );
    } else if (code) {
      // updated 不是「已生效」而是「生成了草稿等你发布」，必须说清楚，
      // 否则运营以为文件改动已经上线了
      if (res.updated > 0) {
        message.warning(`「${code}」已生成草稿，需在详情页 review 后发布才会生效`, 6);
      } else if (res.optimizeImported + res.agentImported > 0) {
        message.success(`「${code}」已导入并发布为 v1`);
      } else {
        message.info(`「${code}」源文件未变更，无需同步`);
      }
    } else {
      const parts = [
        `新增 ${res.optimizeImported + res.agentImported}`,
        `已变更生成草稿 ${res.updated}`,
        `未变跳过 ${res.skipped}`,
      ];
      if (res.updated > 0) {
        message.warning(`${parts.join('，')}。草稿需在详情页 review 后发布才会生效`, 6);
      } else {
        message.success(parts.join('，'));
      }
    }
    tableRef.value?.refresh();
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    syncingCode.value = null;
    importing.value = false;
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.muted {
  color: var(--color-text-tertiary, #999);
}
</style>
