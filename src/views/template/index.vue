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
        <a-empty :description="$t('template.noTemplateData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          {{ $t('template.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enabled'">
          <a-tag :color="record.enabled === 1 ? 'green' : 'red'">
            {{ record.enabled === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'category'">
          <a-tag>{{ record.category || '-' }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'mode'">
          <a-tag color="blue">{{ record.mode || '-' }}</a-tag>
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
              {{ $t('template.copyTemplate') }}
            </a-button>
            <a-popconfirm
              :title="$t('template.confirmDelete')"
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getTemplateList,
  deleteTemplate,
  type TemplateRecord,
} from '@/api/template'

/**
 * 表格句柄。增删改之后必须重查——本页此前一个 ref 都没有，改完数据列表还是旧的，
 * 看着像没生效，运营会重复点第二次。
 * 用 refresh() 而不是 reload()：refresh 保持当前页码，在第 N 页处理完不会被甩回第一页。
 */
const tableRef = ref()

const router = useRouter()
const { t } = useI18n()

const columns = [
  {
    title: t('template.templateId'),
    dataIndex: 'id',
    width: 180,
    ellipsis: true,
  },
  {
    title: t('template.templateName'),
    dataIndex: 'name',
    width: 200,
    ellipsis: true,
  },
  {
    title: t('template.category'),
    dataIndex: 'category',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: '电商', value: 'ecommerce' },
      { label: '图片', value: 'image' },
      { label: '视频', value: 'video' },
      { label: 'Agent', value: 'agent' },
    ],
    width: 100,
  },
  {
    title: t('template.mode'),
    dataIndex: 'mode',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: 'Agent', value: 'agent' },
      { label: '图片', value: 'image' },
      { label: '视频', value: 'video' },
    ],
    width: 100,
  },
  {
    title: t('common.status'),
    dataIndex: 'enabled',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('template.usageCount'),
    dataIndex: 'usageCount',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('template.version'),
    dataIndex: 'version',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('template.sort'),
    dataIndex: 'sort',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
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
  const res = await getTemplateList({
    category: params.category as string | undefined,
    mode: params.mode as string | undefined,
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
  router.push('/template/create')
}

function handleEdit(record: TemplateRecord) {
  router.push(`/template/edit/${record.id}`)
}

function handleCopy(record: TemplateRecord) {
  router.push(`/template/create?copyFrom=${record.id}`)
}

async function handleDelete(record: TemplateRecord) {
  try {
    await deleteTemplate(record.id)
    message.success(t('common.deleteSuccess'))
    tableRef.value?.refresh()
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
