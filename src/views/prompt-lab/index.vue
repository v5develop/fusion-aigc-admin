<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty description="暂无提示词，可点击「导入存量」从 data/prompt 与 agent .md 导入，或「新建提示词」" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="goCreate">新建提示词</a-button>
        <a-popconfirm
          title="将从 data/prompt/*.txt 与 prompts/agents/*.md 导入尚不存在的提示词为 v1 并发布，确认导入？"
          @confirm="handleImport"
        >
          <a-button :loading="importing">导入存量</a-button>
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
            <a-popconfirm title="删除将连同其全部版本一并软删，确认？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { pagePrompts, deletePrompt, importExisting, type Prompt } from '@/api/prompt-lab'

const router = useRouter()
const tableRef = ref<InstanceType<typeof ProTable>>()
const importing = ref(false)

const typeOptions = [
  { label: '优化模板 (optimize)', value: 'optimize' },
  { label: 'Agent 提示词 (agent)', value: 'agent' },
]
const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

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
    width: 180,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await pagePrompts({
    keyword: params.name as string | undefined,
    type: params.type as string | undefined,
    status: params.status as number | undefined,
    targetModelCode: params.targetModelCode as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

function goCreate() {
  router.push('/prompt-lab/create')
}

function goDetail(record: Prompt) {
  router.push(`/prompt-lab/detail/${record.id}`)
}

async function handleDelete(record: Prompt) {
  try {
    await deletePrompt(record.id)
    message.success('已删除')
    tableRef.value?.refresh()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleImport() {
  importing.value = true
  try {
    const res = await importExisting()
    message.success(`导入完成：优化模板 ${res.optimizeImported}，Agent ${res.agentImported}，跳过 ${res.skipped}`)
    tableRef.value?.refresh()
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    importing.value = false
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
