<template>
  <div class="page-container">
    <a-card :title="$t('creationContent.title')" variant="borderless">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
        :scroll="{ x: 1300 }"
      >
        <template #emptyText>
          <a-empty :description="$t('creationContent.empty')" />
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'thumbnail'">
            <div v-if="record.thumbnail" class="thumb-wrap" @click="openViewer(record)">
              <img :src="record.thumbnail" class="thumb-img" />
              <span v-if="record.urls.length > 1" class="thumb-count">
                {{ record.urls.length }}
              </span>
            </div>
            <span v-else class="muted">-</span>
          </template>

          <template v-if="column.dataIndex === 'type'">
            <a-tag :color="record.type === 'video' ? 'purple' : 'blue'">{{ record.type }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'entryCode'">
            <span v-if="record.entryCode">{{ entryName(record.entryCode) }}</span>
            <span v-else class="muted">-</span>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            <a-tag v-if="record.blockStatus > 0" color="red">
              {{ $t('creationContent.blocked') }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'userDeleted'">
            <a-tag :color="record.userDeleted ? 'red' : 'default'">
              {{ record.userDeleted ? $t('common.yes') : $t('common.no') }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'recommended'">
            <a-tag :color="record.recommended ? 'green' : 'default'">
              {{ record.recommended ? $t('common.yes') : $t('common.no') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-button type="link" size="small" @click="openViewer(record)">
              {{ $t('creationContent.view') }}
            </a-button>
          </template>
        </template>
      </ProTable>
    </a-card>

    <!-- 内容详情：多产物走幻灯片 -->
    <a-drawer
      v-model:open="viewerVisible"
      :title="$t('creationContent.detailTitle')"
      :size="640"
    >
      <template v-if="current">
        <div class="viewer-media">
          <a-empty v-if="!current.urls.length" :description="$t('creationContent.noOutput')" />
          <a-carousel v-else-if="current.urls.length > 1" arrows dots>
            <div v-for="(url, i) in current.urls" :key="i" class="slide">
              <video v-if="current.type === 'video'" :src="url" controls class="slide-media" />
              <img v-else :src="url" class="slide-media" />
            </div>
          </a-carousel>
          <template v-else>
            <video
              v-if="current.type === 'video'"
              :src="current.urls[0]"
              controls
              class="slide-media"
            />
            <a-image v-else :src="current.urls[0]" style="width: 100%" />
          </template>
          <div v-if="current.urls.length > 1" class="muted slide-hint">
            {{ $t('creationContent.slideHint', { count: current.urls.length }) }}
          </div>
        </div>

        <a-descriptions bordered :column="2" size="small" style="margin-top: 20px">
          <a-descriptions-item :label="$t('creationContent.dataId')">
            {{ current.id }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.username')">
            {{ current.username }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.taskId')" :span="2">
            {{ current.taskId }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.type')">
            {{ current.type }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.entryCode')">
            {{ current.entryCode ? entryName(current.entryCode) : '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.status')">
            <a-tag :color="statusColor(current.status)">{{ statusLabel(current.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.createTime')">
            {{ current.createTime }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.userDeleted')">
            {{ current.userDeleted ? $t('common.yes') : $t('common.no') }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('creationContent.recommended')">
            {{ current.recommended ? $t('common.yes') : $t('common.no') }}
          </a-descriptions-item>
        </a-descriptions>

        <a-alert
          type="info"
          show-icon
          style="margin-top: 16px"
          :message="$t('creationContent.watermarkHint')"
        />
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getCreationContentList,
  getContentEntryCodes,
  type CreationContentItem,
} from '@/api/creation-content'

const { t } = useI18n()

const STATUS = {
  0: { label: () => t('creationContent.statusQueued'), color: 'default' },
  1: { label: () => t('creationContent.statusProcessing'), color: 'blue' },
  2: { label: () => t('creationContent.statusSuccess'), color: 'green' },
  3: { label: () => t('creationContent.statusFailed'), color: 'red' },
} as Record<number, { label: () => string; color: string }>

function statusLabel(s: number) {
  return STATUS[s]?.label() ?? String(s)
}
function statusColor(s: number) {
  return STATUS[s]?.color ?? 'default'
}

// ---- 创作入口下拉 ----
const entryOptions = ref<{ label: string; value: string }[]>([])
const entryNameMap = reactive<Record<string, string>>({})
async function loadEntryCodes() {
  try {
    const res = (await getContentEntryCodes()) || []
    entryOptions.value = res.map((e) => {
      entryNameMap[e.entryCode] = e.entryName
      return { label: `${e.entryName} (${e.entryCode})`, value: e.entryCode }
    })
  } catch {
    /* 拦截器已提示；下拉为空时其余筛选照常可用 */
  }
}
loadEntryCodes()

function entryName(code: string) {
  return entryNameMap[code] || code
}

const boolOptions = computed(() => [
  { label: t('common.yes'), value: true },
  { label: t('common.no'), value: false },
])

const columns = computed(() => [
  {
    title: t('creationContent.thumbnail'),
    dataIndex: 'thumbnail',
    key: 'thumbnail',
    width: 80,
    align: 'center' as const,
  },
  { title: t('creationContent.dataId'), dataIndex: 'id', width: 90 },
  { title: t('creationContent.username'), dataIndex: 'username', width: 140, ellipsis: true },
  {
    title: t('creationContent.type'),
    dataIndex: 'type',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: 'image', value: 'image' },
      { label: 'video', value: 'video' },
    ],
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('creationContent.entryCode'),
    dataIndex: 'entryCode',
    search: true,
    searchType: 'select' as const,
    searchOptions: entryOptions.value,
    width: 160,
    ellipsis: true,
  },
  {
    title: t('creationContent.status'),
    dataIndex: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('creationContent.statusQueued'), value: 0 },
      { label: t('creationContent.statusProcessing'), value: 1 },
      { label: t('creationContent.statusSuccess'), value: 2 },
      { label: t('creationContent.statusFailed'), value: 3 },
    ],
    width: 130,
    align: 'center' as const,
  },
  { title: t('creationContent.createTime'), dataIndex: 'createTime', width: 160 },
  {
    title: t('creationContent.userDeleted'),
    dataIndex: 'userDeleted',
    search: true,
    searchType: 'select' as const,
    searchOptions: boolOptions.value,
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('creationContent.recommended'),
    dataIndex: 'recommended',
    search: true,
    searchType: 'select' as const,
    searchOptions: boolOptions.value,
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 90,
    align: 'center' as const,
    fixed: 'right' as const,
  },
])

async function loadData(params: Record<string, unknown>) {
  const res = await getCreationContentList({
    keyword: (params.id as string) || undefined,
    entryCode: (params.entryCode as string) || undefined,
    type: (params.type as string) || undefined,
    status: params.status as number | undefined,
    userDeleted: params.userDeleted as boolean | undefined,
    recommended: params.recommended as boolean | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

// ---- 详情 / 幻灯片 ----
const viewerVisible = ref(false)
const current = ref<CreationContentItem | null>(null)

function openViewer(record: CreationContentItem) {
  current.value = record
  viewerVisible.value = true
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.thumb-wrap {
  position: relative;
  display: inline-block;
  cursor: pointer;
}
.thumb-img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border-color, #f0f0f0);
  display: block;
}
.thumb-count {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
.viewer-media :deep(.slick-slide) {
  text-align: center;
}
.slide-media {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: 6px;
  background: #000;
}
.slide-hint {
  margin-top: 8px;
  text-align: center;
}
</style>
