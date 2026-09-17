<template>
  <div class="page-container">
    <a-card :title="$t('userAsset.title')" variant="borderless">
      <a-alert type="info" show-icon style="margin-bottom: 16px" :message="$t('userAsset.hint')" />

      <ProTable
        ref="tableRef"
        :columns="columns"
        :request="loadData"
        :search="{ collapsedRows: 4 }"
        row-key="id"
        :scroll="{ x: 1560 }"
        :row-class-name="rowClassName"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'thumbnail'">
            <div v-if="thumbOf(record)" class="thumb-wrap" @click="openDetail(record)">
              <!--
                渲染用哪个标签只能按 mediaType 判：存量视频素材的 coverUrl 还没回填，
                存的就是 mp4 地址本身，塞进 <img> 只会出裂图。
                video 不带 controls 时浏览器渲染首帧，正好当封面用。
              -->
              <video
                v-if="isVideoUrl(thumbOf(record), record.mediaType)"
                :src="thumbOf(record)"
                class="thumb-img"
                muted
                preload="metadata"
              />
              <img v-else :src="thumbOf(record)" class="thumb-img" />
              <!--
                角标看 mediaType 而不是看缩略图本身是不是视频：封面已回填的视频素材，
                缩略图是张静态 jpg，不打角标就跟图片素材长得一模一样。
              -->
              <span v-if="record.mediaType === 'video'" class="thumb-play" aria-hidden="true">
                ▶
              </span>
            </div>
            <span v-else class="muted">-</span>
          </template>

          <template v-if="column.dataIndex === 'name'">
            <span v-if="record.name">{{ record.name }}</span>
            <span v-else class="muted">{{ $t('userAsset.noName') }}</span>
          </template>

          <template v-if="column.dataIndex === 'username'">
            <span>{{ record.username }}</span>
            <span v-if="record.userId" class="muted"> #{{ record.userId }}</span>
          </template>

          <template v-if="column.dataIndex === 'entryCode'">
            <!-- entryName 后端取自计费 offer，offer 没配就没有名字，回退编码总比空白格强 -->
            <span v-if="record.entryCode">{{ record.entryName || record.entryCode }}</span>
            <span v-else class="muted">-</span>
          </template>

          <template v-if="column.dataIndex === 'mediaType'">
            <a-tag :color="record.mediaType === 'video' ? 'purple' : 'blue'">
              {{ mediaTypeLabel(record.mediaType) }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'aspectRatio'">
            <span v-if="record.aspectRatio">{{ record.aspectRatio }}</span>
            <span v-else class="muted">{{ $t('userAsset.ratioUnknown') }}</span>
          </template>

          <template v-if="column.dataIndex === 'size'">
            <span :class="{ muted: !hasSize(record) }">{{ sizeLabel(record) }}</span>
          </template>

          <template v-if="column.dataIndex === 'sourceType'">
            <a-tag :color="record.sourceType === 2 ? 'green' : 'default'">
              {{ sourceTypeLabel(record.sourceType) }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'userDeleted'">
            <a-tag :color="record.userDeleted ? 'red' : 'default'">
              {{ record.userDeleted ? $t('common.yes') : $t('common.no') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="openDetail(record)">
                {{ $t('common.view') }}
              </a-button>
              <!--
                已删除的再删一次，后端只会回「素材不存在或已删除」——与其弹一个点了必定
                报错的确认框，不如直接禁用并说明原因。
              -->
              <a-tooltip
                v-if="record.userDeleted"
                v-permission="'user_asset:delete'"
                :title="$t('userAsset.alreadyDeleted')"
              >
                <a-button type="link" size="small" danger disabled>
                  {{ $t('common.delete') }}
                </a-button>
              </a-tooltip>
              <a-popconfirm
                v-else
                v-permission="'user_asset:delete'"
                :title="$t('userAsset.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>

    <!-- 素材详情：一条素材只有一个产物，不需要幻灯片；子资产另开一块列 -->
    <a-drawer v-model:open="detailVisible" :title="$t('userAsset.detailTitle')" :size="720">
      <a-spin :spinning="detailLoading">
        <template v-if="current">
          <a-alert
            v-if="current.userDeleted"
            type="warning"
            show-icon
            style="margin-bottom: 16px"
            :message="$t('userAsset.deletedAlert')"
          />

          <div class="viewer-media">
            <a-empty v-if="!detailUrl" :description="$t('userAsset.noMedia')" />
            <video
              v-else-if="isVideoUrl(detailUrl, current.mediaType)"
              :src="detailUrl"
              controls
              class="detail-media"
            />
            <a-image v-else :src="detailUrl" style="width: 100%" />
          </div>

          <div class="detail-block">
            <div class="block-label">{{ $t('userAsset.prompt') }}</div>
            <a-typography-paragraph
              v-if="current.aiPrompt"
              :copyable="{ text: current.aiPrompt }"
              class="prompt-box"
            >
              {{ current.aiPrompt }}
            </a-typography-paragraph>
            <span v-else class="muted">{{ $t('userAsset.noPrompt') }}</span>
          </div>

          <a-descriptions bordered :column="2" size="small" style="margin-top: 20px">
            <a-descriptions-item :label="$t('userAsset.assetId')">
              {{ current.id }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.username')">
              {{ current.username }}
              <span v-if="current.userId" class="muted">#{{ current.userId }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.name')" :span="2">
              {{ current.name || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.sourceTaskId')" :span="2">
              <!-- 用户自己上传的素材没有来源任务，这里空是正常的，不是丢数据 -->
              {{ current.sourceTaskId || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.type')">
              {{ current.type || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.entryCode')">
              {{ current.entryCode ? current.entryName || current.entryCode : '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.mediaType')">
              <a-tag :color="current.mediaType === 'video' ? 'purple' : 'blue'">
                {{ mediaTypeLabel(current.mediaType) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.aspectRatio')">
              {{ current.aspectRatio || $t('userAsset.ratioUnknown') }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.size')">
              {{ sizeLabel(current) }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.sourceType')">
              {{ sourceTypeLabel(current.sourceType) }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.status')">
              {{ statusLabel(current.status) }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.userDeleted')">
              <a-tag :color="current.userDeleted ? 'red' : 'default'">
                {{ current.userDeleted ? $t('common.yes') : $t('common.no') }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.createTime')" :span="2">
              {{ current.createTime }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('userAsset.resultUrl')" :span="2">
              <a v-if="current.resultUrl" :href="current.resultUrl" target="_blank" rel="noreferrer">
                {{ current.resultUrl }}
              </a>
              <span v-else class="muted">-</span>
            </a-descriptions-item>
          </a-descriptions>

          <!-- 子资产只有 customizedModel / realPersonModel 这类素材才有，绝大多数是空的 -->
          <div v-if="current.items && current.items.length" class="detail-block">
            <div class="block-label">
              {{ $t('userAsset.items', { count: current.items.length }) }}
            </div>
            <div class="muted item-hint">{{ $t('userAsset.itemsHint') }}</div>
            <div class="item-grid">
              <div v-for="it in current.items" :key="it.id" class="item-card">
                <a-image v-if="itemThumb(it)" :src="itemThumb(it)" class="item-img" />
                <video
                  v-else-if="it.mediaType === 'video' && it.mediaUrl"
                  :src="it.mediaUrl"
                  class="item-img"
                  preload="metadata"
                  muted
                />
                <div v-else class="item-img item-img-empty">-</div>
                <div class="item-name">{{ it.name || '-' }}</div>
                <div class="muted">{{ it.itemType || '-' }} · {{ it.mediaType }}</div>
              </div>
            </div>
          </div>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import type { Dayjs } from 'dayjs'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getAssetCategories,
  getAssetCategoryEntryOptions,
  type AssetCategory,
} from '@/api/asset-category'
import {
  getUserAssetList,
  getUserAssetAspectRatios,
  getUserAssetDetail,
  deleteUserAsset,
  type UserAsset,
  type UserAssetItem,
} from '@/api/user-asset'
import type { ProTableColumn } from '@/types/pro'

const { t } = useI18n()
const tableRef = ref<InstanceType<typeof ProTable> | null>(null)

// ---- 下拉数据源 ----
/**
 * 聚合分类树与入口候选项都取自「素材分类管理」那套接口（asset_category:view）：
 * 分类是入口的集合，两份数据必须同源，否则筛选下拉里会出现分类和入口对不上的选项。
 */
const categoryTree = ref<AssetCategory[]>([])
const entryOptions = ref<{ label: string; value: string }[]>([])
const ratioOptions = ref<{ label: string; value: string }[]>([])

/** 一级分类下拉：值是 categoryCode，后端会把它展开成其下全部二级的入口之并 */
const l1Options = computed(() =>
  categoryTree.value.map((c) => ({
    label: `${c.categoryName} (${c.categoryCode})`,
    value: c.categoryCode,
  })),
)

/**
 * 二级分类下拉，平铺**全部**一级下的二级，标签带上父级名。
 * 刻意不跟一级联动：ProTable 的搜索表单是组件内部状态，外面读不到当前选中的一级，
 * 做成联动只能靠改 ProTable，而带父级名的平铺列表一样能一眼看出归属。
 */
const l2Options = computed(() =>
  categoryTree.value.flatMap((l1) =>
    (l1.children || []).map((l2) => ({
      label: `${l1.categoryName} > ${l2.categoryName}`,
      value: l2.categoryCode,
    })),
  ),
)

async function loadOptions() {
  try {
    categoryTree.value = (await getAssetCategories()) || []
  } catch {
    /* 拦截器已提示；下拉为空时其余筛选照常可用 */
  }
  try {
    // 用 entry-options 而不是从分类树里刨：树里只有已归类的入口，
    // 而未归类入口的素材恰恰是最需要按入口捞出来看的那批
    const res = await getAssetCategoryEntryOptions()
    entryOptions.value = (res?.options || []).map((o) => ({
      label: `${o.entryName} (${o.entryCode})`,
      value: o.entryCode,
    }))
  } catch {
    /* 同上 */
  }
  try {
    ratioOptions.value = ((await getUserAssetAspectRatios()) || []).map((r) => ({
      label: r,
      value: r,
    }))
  } catch {
    /* 同上 */
  }
}
loadOptions()

// ---- 展示映射 ----
function mediaTypeLabel(value: string | null) {
  if (value === 'video') return t('userAsset.mediaVideo')
  if (value === 'image') return t('userAsset.mediaImage')
  return value || '-'
}

function sourceTypeLabel(value: number | null) {
  if (value === 1) return t('userAsset.sourceUpload')
  if (value === 2) return t('userAsset.sourceAi')
  return '-'
}

function statusLabel(value: number | null) {
  if (value === 0) return t('userAsset.statusDraft')
  if (value === 1) return t('userAsset.statusNormal')
  return '-'
}

/** 宽高任意一边为 0 都算未知：后端把「探测失败」的哨兵值统一夹成了 0 */
function hasSize(record: UserAsset) {
  return Boolean(record.width && record.height)
}

function sizeLabel(record: UserAsset) {
  return hasSize(record) ? `${record.width}×${record.height}` : t('userAsset.sizeUnknown')
}

/** 已删除的行整行压灰，运营扫一眼就能把它们和在库的分开 */
function rowClassName(record: UserAsset) {
  return record.userDeleted ? 'row-deleted' : ''
}

// ---- 列与筛选 ----
const mediaTypeOptions = computed(() => [
  { label: t('userAsset.mediaImage'), value: 'image' },
  { label: t('userAsset.mediaVideo'), value: 'video' },
])

const selectProps = { allowClear: true, showSearch: true, optionFilterProp: 'label' }

const columns = computed<ProTableColumn[]>(() => [
  // 下面 8 列 hideInTable：它们是纯筛选项，表格里要么没有对应的一列（keyword 一个词
  // 同时匹配名称/素材ID/来源任务ID），要么已有一列在展示同一个值（deleted / userDeleted）
  {
    title: t('userAsset.keyword'),
    dataIndex: 'keyword',
    search: true,
    hideInTable: true,
  },
  {
    title: t('userAsset.categoryL1'),
    dataIndex: 'categoryL1',
    search: true,
    searchType: 'select' as const,
    searchOptions: l1Options.value,
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    // 键名就叫 assetCategory：ProTable 拿 dataIndex 当搜索表单的 key，
    // 二级比一级精确，两个都选时以它为准（见 loadData）
    title: t('userAsset.categoryL2'),
    dataIndex: 'assetCategory',
    search: true,
    searchType: 'select' as const,
    searchOptions: l2Options.value,
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    title: t('userAsset.entryFilter'),
    dataIndex: 'entryCodeFilter',
    search: true,
    searchType: 'select' as const,
    searchOptions: entryOptions.value,
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    title: t('userAsset.mediaTypeFilter'),
    dataIndex: 'mediaTypeFilter',
    search: true,
    searchType: 'select' as const,
    searchOptions: mediaTypeOptions.value,
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    title: t('userAsset.aspectRatioFilter'),
    dataIndex: 'aspectRatioFilter',
    search: true,
    searchType: 'select' as const,
    searchOptions: ratioOptions.value,
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    title: t('userAsset.sourceTypeFilter'),
    dataIndex: 'sourceTypeFilter',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('userAsset.sourceUpload'), value: 1 },
      { label: t('userAsset.sourceAi'), value: 2 },
    ],
    searchProps: selectProps,
    hideInTable: true,
  },
  {
    // 三态：不选=不限、仅已删=true、仅未删=false。
    // 必须 allowClear，否则选过一次就再也回不到「不限」，只能整体重置
    title: t('userAsset.deletedFilter'),
    dataIndex: 'deleted',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('userAsset.deletedOnly'), value: true },
      { label: t('userAsset.notDeletedOnly'), value: false },
    ],
    searchProps: selectProps,
    hideInTable: true,
  },

  {
    title: t('userAsset.thumbnail'),
    dataIndex: 'thumbnail',
    key: 'thumbnail',
    width: 80,
    align: 'center' as const,
  },
  { title: t('userAsset.assetId'), dataIndex: 'id', width: 90 },
  { title: t('userAsset.name'), dataIndex: 'name', width: 180, ellipsis: true },
  { title: t('userAsset.username'), dataIndex: 'username', width: 150, ellipsis: true },
  { title: t('userAsset.entryCode'), dataIndex: 'entryCode', width: 150, ellipsis: true },
  {
    title: t('userAsset.mediaType'),
    dataIndex: 'mediaType',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('userAsset.aspectRatio'),
    dataIndex: 'aspectRatio',
    width: 90,
    align: 'center' as const,
  },
  { title: t('userAsset.size'), dataIndex: 'size', key: 'size', width: 110, align: 'center' as const },
  {
    title: t('userAsset.sourceType'),
    dataIndex: 'sourceType',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('userAsset.userDeleted'),
    dataIndex: 'userDeleted',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('userAsset.createTime'),
    dataIndex: 'createTime',
    search: true,
    searchType: 'dateRange' as const,
    width: 170,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 130,
    align: 'center' as const,
    fixed: 'right' as const,
  },
])

/**
 * 后端 startTime/endTime 是 `@DateTimeFormat(ISO.DATE_TIME)` 的 LocalDateTime，
 * 要的是 `2026-08-28T00:00:00` 这种带 T 的形式。dayjs 里 T 是格式化保留字，
 * 必须写成 `[T]` 转义，写成 'YYYY-MM-DD HH:mm:ss' 后端直接 400。
 */
const ISO_LOCAL = 'YYYY-MM-DD[T]HH:mm:ss'

async function loadData(params: Record<string, unknown>) {
  const range = params.createTime as [Dayjs, Dayjs] | undefined

  const res = await getUserAssetList({
    keyword: (params.keyword as string) || undefined,
    // 二级优先于一级：分类是入口的集合，选了更精确的那个就该按它筛
    assetCategory:
      (params.assetCategory as string) || (params.categoryL1 as string) || undefined,
    entryCode: (params.entryCodeFilter as string) || undefined,
    mediaType: (params.mediaTypeFilter as string) || undefined,
    aspectRatio: (params.aspectRatioFilter as string) || undefined,
    sourceType: (params.sourceTypeFilter as number) || undefined,
    // 三态，别写 `|| undefined`：那会把「仅未删除」(false) 悄悄变成「不限」
    deleted: params.deleted as boolean | undefined,
    startTime: range?.[0] ? range[0].startOf('day').format(ISO_LOCAL) : undefined,
    // 后端 endTime 是开区间（create_time < endTime），所以送次日零点而不是当日
    // 23:59:59。create_time 是秒精度 datetime，用 endOf('day') 会把恰好落在
    // 23:59:59 那一秒创建的素材漏掉——量少但真实存在，且完全看不出来
    endTime: range?.[1]
      ? range[1].startOf('day').add(1, 'day').format(ISO_LOCAL)
      : undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

// ---- 详情 ----
const detailVisible = ref(false)
const detailLoading = ref(false)
const current = ref<UserAsset | null>(null)

const detailUrl = computed(() => current.value?.resultUrl || '')

/** 缩略图：优先封面，没有就退回产物本身（视频会退到 mp4，所以渲染必须按 mediaType 判） */
function thumbOf(record: UserAsset) {
  return record.coverUrl || record.resultUrl || ''
}

/**
 * 子项缩略图：优先展示帧，图片子项才回退产物本身。
 * 视频子项没有展示帧时宁可留空——拿 mp4 进 <img> 就是一张裂图，
 * 而空占位至少能看出「这条缺封面」。
 */
function itemThumb(item: UserAssetItem) {
  if (item.coverUrl) return item.coverUrl
  return item.mediaType === 'image' ? item.mediaUrl || '' : ''
}

/**
 * 先用列表行把抽屉点亮，再拉详情补 items——列表已经带齐了除子资产以外的全部字段，
 * 空着等一个来回会让抽屉先白屏一下。
 */
async function openDetail(record: UserAsset) {
  current.value = record
  detailVisible.value = true
  detailLoading.value = true
  try {
    current.value = await getUserAssetDetail(record.id)
  } catch {
    /* 拦截器已提示；抽屉里仍是列表带来的那份数据，只是没有子资产 */
  } finally {
    detailLoading.value = false
  }
}

async function handleDelete(record: UserAsset) {
  try {
    await deleteUserAsset(record.id)
    message.success(t('userAsset.deleteSuccess'))
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  }
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v']

/**
 * 这条 URL 该不该用 <video> 渲染。
 *
 * 先看 URL 后缀、再回退到后端下发的 mediaType：后缀是对「这个文件本身」最确定的判断，
 * 也正好覆盖「视频素材的封面已回填成 jpg」这种情况（该用 img）；
 * 而 CDN/OSS 链接不一定带后缀，此时才用素材级的 mediaType 兜底
 * （存量视频素材的 coverUrl 就是 mp4 本身，只有这条兜底能救）。
 *
 * 注意签名 URL 带 query（?Expires=...&Signature=...），必须先截掉再比后缀。
 */
function isVideoUrl(url: string | null | undefined, mediaType?: string | null): boolean {
  if (url) {
    const path = url.split('?')[0].toLowerCase()
    if (VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))) return true
    // 后缀明确是图片就别再信素材级类型：视频素材的封面就是图片
    if (/\.(jpe?g|png|webp|gif|bmp|avif|heic)$/.test(path)) return false
  }
  return mediaType === 'video'
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
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  display: block;
}
/* 视频角标：缩略图取的是首帧或封面，不加标记的话与静态图长得一样，运营看不出哪条是视频 */
.thumb-play {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 8px;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
}
/*
  已删除行整行压灰 + 左侧红条：列表默认把已删和在库的混在一起（排查「我的图没了」
  正需要如此），不做视觉区分的话运营会把已删的当成还在库里的去用。
  行是 ProTable 内部渲染的，scoped 打不到 <tr> 上，必须走 :deep()。
*/
.page-container :deep(.row-deleted) > td {
  background: var(--color-fill-quaternary, #fafafa);
  opacity: 0.6;
}
.page-container :deep(.row-deleted) > td:first-child {
  box-shadow: inset 3px 0 0 var(--color-error, #ff4d4f);
}
.detail-media {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: 6px;
  background: #000;
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
  background: var(--color-fill-quaternary, #fafafa);
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  white-space: pre-wrap;
  margin-bottom: 0 !important;
}
.item-hint {
  margin-bottom: 8px;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.item-card {
  width: 108px;
}
.item-img {
  width: 108px;
  height: 108px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
}
.item-img-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary, #999);
  background: var(--color-fill-quaternary, #fafafa);
}
.item-name {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}
</style>
