<template>
  <div class="page-container">
    <a-card :title="$t('creationContent.title')" variant="borderless">
      <ProTable
        ref="tableRef"
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
            <a-space :size="4">
              <a-button type="link" size="small" @click="openViewer(record)">
                {{ $t('creationContent.view') }}
              </a-button>
              <a-tooltip v-if="!canRecommend(record)" :title="recommendBlockedReason(record)">
                <a-button type="link" size="small" disabled>
                  {{ $t('creationContent.recommend') }}
                </a-button>
              </a-tooltip>
              <a-button
                v-else
                v-permission="'content_recommend:create'"
                type="link"
                size="small"
                @click="openRecommend(record)"
              >
                {{ $t('creationContent.recommend') }}
              </a-button>
            </a-space>
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

        <div class="detail-block">
          <div class="block-label">{{ $t('creationContent.prompt') }}</div>
          <a-typography-paragraph
            v-if="current.prompt"
            :copyable="{ text: current.prompt }"
            class="prompt-box"
          >
            {{ current.prompt }}
          </a-typography-paragraph>
          <span v-else class="muted">{{ $t('creationContent.noPrompt') }}</span>
        </div>

        <div class="detail-block">
          <div class="block-label">{{ $t('creationContent.submitParams') }}</div>
          <template v-if="paramEntries.length">
            <a-descriptions bordered :column="1" size="small">
              <a-descriptions-item v-for="p in paramEntries" :key="p.key" :label="p.key">
                <!-- 用户上传的素材直接给可点开的链接，运营判断能不能推得看得见原图 -->
                <template v-if="p.urls">
                  <a-space wrap :size="4">
                    <a
                      v-for="(u, i) in p.urls"
                      :key="i"
                      :href="u"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <a-tag color="blue">{{ $t('creationContent.mediaLink') }} {{ i + 1 }}</a-tag>
                    </a>
                  </a-space>
                </template>
                <span v-else class="param-value">{{ p.value }}</span>
              </a-descriptions-item>
            </a-descriptions>
          </template>
          <span v-else class="muted">{{ $t('creationContent.noParams') }}</span>
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

    <!-- 推荐到分类位 -->
    <a-modal
      v-model:open="recommendVisible"
      :title="$t('creationContent.recommendTitle')"
      :confirm-loading="recommending"
      width="520px"
      @ok="submitRecommend"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 16px"
        :message="$t('creationContent.recommendHint')"
      />
      <a-form :model="recForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('creationContent.dataId')">
          <span>{{ recForm.sourceId }}</span>
        </a-form-item>
        <a-form-item :label="$t('contentRecommend.categoryL1')" required>
          <a-select
            v-model:value="recForm.categoryL1Id"
            :options="l1Options"
            show-search
            option-filter-prop="label"
            :placeholder="$t('contentRecommend.filterL1')"
            @change="onRecL1Change"
          />
        </a-form-item>
        <a-form-item :label="$t('contentRecommend.categoryL2')">
          <a-select
            v-model:value="recForm.categoryL2Id"
            :options="recL2Options"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="$t('contentRecommend.l2Optional')"
          />
        </a-form-item>
        <a-form-item :label="$t('contentRecommend.platform')" required>
          <a-radio-group v-model:value="recForm.platform" button-style="solid">
            <a-radio-button v-for="p in recAllowedPlatforms" :key="p" :value="p">
              {{ p === 'APP' ? 'App' : p === 'PC' ? 'PC' : 'App+PC' }}
            </a-radio-button>
          </a-radio-group>
          <div class="muted">{{ recPlatformHint }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ProTable from '@/components/Pro/ProTable/index.vue'
import { addRecommend } from '@/api/content-recommend'
import {
  getCreationContentList,
  getContentEntryCodes,
  type CreationContentItem,
} from '@/api/creation-content'
import { getCategoryTree, type DisplayCategoryNode, type Platform } from '@/api/display-category'

const { t } = useI18n()
// 推荐成功后要刷新列表拿回 recommended 标记
const tableRef = ref<InstanceType<typeof ProTable> | null>(null)

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

/** URL 形态的参数值单独渲染成可点开的链接，其余按文本展示 */
const MEDIA_KEYS = /^(images?|imageUrls?|video|videoUrl|audio|audioUrl|imagepath\d*|videopath|audiopath)$/i

const paramEntries = computed(() => {
  const params = current.value?.params
  if (!params) return []
  return Object.entries(params).map(([key, value]) => {
    const urls = toUrlList(key, value)
    return { key, urls, value: urls ? undefined : formatParamValue(value) }
  })
})

function toUrlList(key: string, value: unknown): string[] | undefined {
  const looksMedia = MEDIA_KEYS.test(key)
  if (Array.isArray(value)) {
    const strs = value.filter((v): v is string => typeof v === 'string')
    // 数组里全是 http 链接时按媒体处理，即便键名不在白名单里
    if (strs.length === value.length && strs.length > 0 && strs.every(isHttpUrl)) return strs
    return undefined
  }
  if (typeof value === 'string' && (looksMedia || isHttpUrl(value)) && value.trim()) {
    return isHttpUrl(value) ? [value] : undefined
  }
  return undefined
}

function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(v)
}

function formatParamValue(value: unknown) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ---- 推荐到分类位 ----
const recommendVisible = ref(false)
const recommending = ref(false)
const tree = ref<DisplayCategoryNode[]>([])

const recForm = reactive({
  sourceId: undefined as number | undefined,
  categoryL1Id: undefined as number | undefined,
  categoryL2Id: undefined as number | undefined,
  platform: 'APP' as Platform,
})

const l1Options = computed(() =>
  tree.value.map((c) => ({ label: `${c.categoryName} (${c.categoryCode})`, value: c.id })),
)
const recL2Options = computed(() => {
  const l1 = recForm.categoryL1Id
    ? tree.value.find((c) => c.id === recForm.categoryL1Id)
    : undefined
  return (l1?.children ?? []).map((c) => ({ label: c.categoryName, value: c.id }))
})

/** 推荐平台必须被所挂分类覆盖（一级二级取更窄的），越界选项直接摘掉 */
const recAllowedPlatforms = computed<Platform[]>(() => {
  const l1 = recForm.categoryL1Id
    ? tree.value.find((c) => c.id === recForm.categoryL1Id)
    : undefined
  const l2 = recForm.categoryL2Id
    ? l1?.children.find((c) => c.id === recForm.categoryL2Id)
    : undefined
  const narrowest = [l1?.platform, l2?.platform].find((p) => p && p !== 'BOTH') as
    | Platform
    | undefined
  return narrowest ? [narrowest] : ['APP', 'PC', 'BOTH']
})
const recPlatformHint = computed(() =>
  recAllowedPlatforms.value.length === 1
    ? t('contentRecommend.platformLocked', {
        platform: recAllowedPlatforms.value[0] === 'APP' ? 'App' : 'PC',
      })
    : t('contentRecommend.platformHint'),
)

function onRecL1Change() {
  recForm.categoryL2Id = undefined
  if (!recAllowedPlatforms.value.includes(recForm.platform)) {
    recForm.platform = recAllowedPlatforms.value[0]
  }
}

/** 只有已成功、未屏蔽、未被用户删、且有产物的内容能推——后端也会再拦一次 */
function canRecommend(record: CreationContentItem) {
  return (
    record.status === 2 &&
    !record.userDeleted &&
    !(record.blockStatus && record.blockStatus > 0) &&
    record.urls.length > 0
  )
}

function recommendBlockedReason(record: CreationContentItem) {
  if (record.userDeleted) return t('creationContent.blockedUserDeleted')
  if (record.blockStatus && record.blockStatus > 0) return t('creationContent.blockedByAdmin')
  if (record.status !== 2) return t('creationContent.blockedNotSuccess')
  return t('creationContent.blockedNoOutput')
}

async function openRecommend(record: CreationContentItem) {
  Object.assign(recForm, {
    sourceId: record.id,
    categoryL1Id: undefined,
    categoryL2Id: undefined,
    platform: 'APP' as Platform,
  })
  recommendVisible.value = true
  if (!tree.value.length) {
    try {
      tree.value = (await getCategoryTree(true)) || []
    } catch {
      /* 拦截器已提示；下拉为空时无法提交，用户会看到必填校验 */
    }
  }
}

async function submitRecommend() {
  if (!recForm.categoryL1Id) {
    message.warning(t('contentRecommend.l1Required'))
    return
  }
  recommending.value = true
  try {
    await addRecommend({
      sourceType: 'CREATION_TASK',
      sourceId: recForm.sourceId,
      categoryL1Id: recForm.categoryL1Id,
      categoryL2Id: recForm.categoryL2Id ?? 0,
      platform: recForm.platform,
    })
    message.success(t('creationContent.recommendSuccess'))
    recommendVisible.value = false
    tableRef.value?.refresh()
  } catch {
    /* 重复推荐、源不可用、平台越界的报错由拦截器提示 */
  } finally {
    recommending.value = false
  }
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
.detail-block {
  margin-top: 20px;
}
.block-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #666);
  margin-bottom: 8px;
}
.prompt-box {
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--bg-color-secondary, #fafafa);
  border: 1px solid var(--border-color, #f0f0f0);
  white-space: pre-wrap;
  margin-bottom: 0 !important;
}
.param-value {
  word-break: break-all;
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
