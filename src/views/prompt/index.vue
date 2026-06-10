<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('prompt.noPromptData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          {{ $t('prompt.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enabled'">
          <a-tag :color="record.enabled === 1 ? 'green' : 'red'">
            {{ record.enabled === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'category'">
          <a-tag>{{ categoryLabel(record.category) }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'tags'">
          <a-space :size="4" wrap>
            <a-tag v-for="tag in record.tags || []" :key="tag" color="blue">
              {{ tag }}
            </a-tag>
            <span v-if="!record.tags || !record.tags.length">-</span>
          </a-space>
        </template>

        <template v-if="column.dataIndex === 'variables'">
          {{ (record.variables || []).length }}
        </template>

        <template v-if="column.dataIndex === 'usageCount'">
          {{ record.usageCount || 0 }}
        </template>

        <template v-if="column.dataIndex === 'version'">
          v{{ record.version || 1 }}
        </template>

        <template v-if="column.key === 'operation'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="handleEdit(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-button type="link" size="small" @click="handleCopy(record)">
              {{ $t('prompt.copy') }}
            </a-button>
            <a-popconfirm
              :title="$t('prompt.confirmDelete')"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>
                {{ $t('common.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getPromptList, deletePrompt, type PromptRecord } from '@/api/prompt'

const router = useRouter()
const { t } = useI18n()

const categoryOptions = [
  { label: t('prompt.categoryEcommerce'), value: 'ecommerce' },
  { label: t('prompt.categoryImage'), value: 'image' },
  { label: t('prompt.categoryVideo'), value: 'video' },
  { label: t('prompt.categoryAgent'), value: 'agent' },
  { label: t('prompt.categoryGeneral'), value: 'general' },
]

function categoryLabel(value?: string) {
  return categoryOptions.find(item => item.value === value)?.label || value || '-'
}

const columns = [
  {
    title: t('prompt.promptId'),
    dataIndex: 'id',
    width: 160,
    ellipsis: true,
  },
  {
    title: t('prompt.promptName'),
    dataIndex: 'name',
    width: 200,
    ellipsis: true,
    searchType: 'input' as const,
  },
  {
    title: t('prompt.category'),
    dataIndex: 'category',
    searchType: 'select' as const,
    searchOptions: categoryOptions,
    width: 110,
  },
  {
    title: t('prompt.tags'),
    dataIndex: 'tags',
    width: 160,
  },
  {
    title: t('prompt.variableCount'),
    dataIndex: 'variables',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
    dataIndex: 'enabled',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('prompt.usageCount'),
    dataIndex: 'usageCount',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('prompt.version'),
    dataIndex: 'version',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('common.updateTime'),
    dataIndex: 'updateTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getPromptList({
    keyword: params.name as string | undefined,
    category: params.category as string | undefined,
    enabled: params.enabled as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function handleCreate() {
  router.push('/prompt/create')
}

function handleEdit(record: PromptRecord) {
  router.push(`/prompt/edit/${record.id}`)
}

function handleCopy(record: PromptRecord) {
  router.push(`/prompt/create?copyFrom=${record.id}`)
}

async function handleDelete(record: PromptRecord) {
  try {
    await deletePrompt(record.id)
    message.success(t('common.deleteSuccess'))
  } catch {
    message.error(t('common.deleteFailed'))
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
</style>
