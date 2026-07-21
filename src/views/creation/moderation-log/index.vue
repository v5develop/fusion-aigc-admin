<template>
  <div class="page-container">
    <ProTable :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText>
        <a-empty :description="$t('moderationLog.empty')" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'bizType'">
          <a-tag color="blue">{{ $t('moderationLog.bizTypeMap.' + record.bizType) || record.bizType }}</a-tag>
        </template>
        <template v-if="column.dataIndex === 'provider'">
          <a-tag :color="record.provider === 'template' ? 'gold' : 'geekblue'">
            {{ $t('moderationLog.providerMap.' + record.provider) || record.provider }}
          </a-tag>
        </template>
        <template v-if="column.dataIndex === 'passed'">
          <a-tag :color="record.passed ? 'green' : 'red'">
            {{ record.passed ? $t('moderationLog.passedYes') : $t('moderationLog.passedNo') }}
          </a-tag>
        </template>
        <template v-if="column.dataIndex === 'action'">
          <a-button type="link" size="small" @click="showDetail(record)">
            {{ $t('moderationLog.detail') }}
          </a-button>
        </template>
      </template>
    </ProTable>

    <a-modal
      v-model:open="detailOpen"
      :title="$t('moderationLog.detail')"
      width="820px"
      :footer="null"
    >
      <a-descriptions v-if="current" :column="1" size="small" bordered>
        <a-descriptions-item :label="$t('moderationLog.taskId')">
          <code>{{ current.taskId || '-' }}</code>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('moderationLog.passed')">
          <a-tag :color="current.passed ? 'green' : 'red'">
            {{ current.passed ? $t('moderationLog.passedYes') : $t('moderationLog.passedNo') }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.scene" :label="$t('moderationLog.scene')">
          {{ current.scene }}
        </a-descriptions-item>
        <a-descriptions-item v-if="current.label" :label="$t('moderationLog.label')">
          {{ current.label }}
        </a-descriptions-item>
        <a-descriptions-item v-if="current.reason" :label="$t('moderationLog.reason')">
          <span class="mod-log-error">{{ decodeUnicode(current.reason) }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.rejectedTarget" :label="$t('moderationLog.rejectedTarget')">
          <span class="mod-log-break">{{ decodeUnicode(current.rejectedTarget) }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.rawResponse" :label="$t('moderationLog.rawResponse')">
          <pre class="mod-log-pre">{{ decodeUnicode(current.rawResponse) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.requestId" :label="$t('moderationLog.requestId')">
          <code>{{ current.requestId }}</code>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getModerationLogList } from '@/api/moderation-log'
import type { ModerationLog } from '@/api/moderation-log'
import { decodeUnicode } from '@/utils/helpers'

const { t } = useI18n()

const detailOpen = ref(false)
const current = ref<ModerationLog | null>(null)
function showDetail(record: ModerationLog) {
  current.value = record
  detailOpen.value = true
}

const columns = [
  { title: t('moderationLog.taskId'), dataIndex: 'taskId', search: true, searchType: 'input' as const, width: 180, ellipsis: true },
  { title: t('moderationLog.userId'), dataIndex: 'userId', search: true, searchType: 'input' as const, width: 90 },
  { title: t('moderationLog.username'), dataIndex: 'username', width: 110 },
  {
    title: t('moderationLog.bizType'),
    dataIndex: 'bizType',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('moderationLog.bizTypeMap.IMAGE'), value: 'IMAGE' },
      { label: t('moderationLog.bizTypeMap.TEXT'), value: 'TEXT' },
      { label: t('moderationLog.bizTypeMap.VIDEO'), value: 'VIDEO' },
    ],
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('moderationLog.provider'),
    dataIndex: 'provider',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('moderationLog.providerMap.yidun'), value: 'yidun' },
      { label: t('moderationLog.providerMap.green'), value: 'green' },
      { label: t('moderationLog.providerMap.template'), value: 'template' },
    ],
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('moderationLog.passed'),
    dataIndex: 'passed',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('moderationLog.passedYes'), value: 'true' },
      { label: t('moderationLog.passedNo'), value: 'false' },
    ],
    width: 90,
    align: 'center' as const,
  },
  { title: t('moderationLog.scene'), dataIndex: 'scene', width: 110 },
  { title: t('moderationLog.label'), dataIndex: 'label', width: 120 },
  { title: t('common.createTime'), dataIndex: 'createTime', width: 170 },
  { title: t('common.action'), dataIndex: 'action', width: 80, align: 'center' as const, fixed: 'right' as const },
]

async function loadData(params: Record<string, unknown>) {
  const passedRaw = params.passed as string | undefined
  const res = await getModerationLogList({
    taskId: (params.taskId as string) || undefined,
    userId: params.userId ? Number(params.userId) : undefined,
    passed: passedRaw === 'true' ? true : passedRaw === 'false' ? false : undefined,
    provider: (params.provider as string) || undefined,
    bizType: (params.bizType as string) || undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}
</script>

<style scoped>
.mod-log-break {
  word-break: break-all;
}
.mod-log-error {
  color: var(--color-error, #ff4d4f);
  word-break: break-all;
}
.mod-log-pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
