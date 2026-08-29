<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('contentRecommend.title') }}</h2>
      <a-button v-permission="'content_recommend:create'" type="primary" @click="openAdd">
        {{ $t('contentRecommend.add') }}
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('contentRecommend.hint')"
    />

    <a-card variant="borderless">
      <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
        <a-tab-pane key="pinned" :tab="$t('contentRecommend.tabPinned')" />
        <a-tab-pane key="pending">
          <template #tab>
            {{ $t('contentRecommend.tabPending') }}
            <a-badge v-if="pendingTotal" :count="pendingTotal" :offset="[6, -2]" />
          </template>
        </a-tab-pane>
      </a-tabs>

      <!-- 待上推：已发布但没挂任何推荐位的素材 -->
      <template v-if="activeTab === 'pending'">
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 12px"
          :message="$t('contentRecommend.pendingHint')"
        />
        <a-table
          :columns="pendingColumns"
          :data-source="pendingRows"
          :loading="pendingLoading"
          :pagination="pendingPagination"
          row-key="id"
          size="middle"
          @change="onPendingPageChange"
        >
          <template #emptyText>
            <a-empty :description="$t('contentRecommend.pendingEmpty')" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'thumbnail'">
              <a-image
                v-if="record.thumbnail"
                :src="record.thumbnail"
                :width="44"
                :height="44"
                style="object-fit: cover; border-radius: 4px"
              />
              <span v-else class="muted">-</span>
            </template>
            <template v-if="column.dataIndex === 'categoryL1Name'">
              <template v-if="record.categoryL1Id">
                <a-tag color="blue">{{ record.categoryL1Name }}</a-tag>
                <a-tag v-if="record.categoryL2Id" color="cyan">{{ record.categoryL2Name }}</a-tag>
              </template>
              <span v-else class="muted">{{ $t('contentRecommend.noDefaultSlot') }}</span>
            </template>
          <template v-if="column.dataIndex === 'sameStyle'">
              <a-tag :color="record.sameStyle ? 'green' : 'default'">
                {{ record.sameStyle ? $t('common.yes') : $t('common.no') }}
              </a-tag>
            </template>
            <template v-if="column.key === 'operation'">
              <a-button
                v-permission="'content_recommend:create'"
                type="link"
                size="small"
                @click="openPinPending(record)"
              >
                {{ $t('contentRecommend.pinNow') }}
              </a-button>
            </template>
          </template>
        </a-table>
      </template>

      <template v-else>
      <div class="filter-bar">
        <a-select
          v-model:value="filters.categoryL1Id"
          :options="l1Options"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 200px"
          :placeholder="$t('contentRecommend.filterL1')"
          @change="onFilterL1Change"
        />
        <a-select
          v-model:value="filters.categoryL2Id"
          :options="filterL2Options"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 200px"
          :placeholder="$t('contentRecommend.filterL2')"
          @change="loadList"
        />
        <a-select
          v-model:value="filters.platform"
          :options="platformOptions"
          allow-clear
          style="width: 150px"
          :placeholder="$t('contentRecommend.filterPlatform')"
          @change="loadList"
        />
        <a-select
          v-model:value="filters.sourceType"
          :options="sourceTypeOptions"
          allow-clear
          style="width: 180px"
          :placeholder="$t('contentRecommend.filterSource')"
          @change="loadList"
        />
        <a-button @click="resetFilters">{{ $t('common.reset') }}</a-button>
      </div>

      <a-alert
        v-if="dragHint"
        type="warning"
        show-icon
        banner
        style="margin-bottom: 12px"
        :message="dragHint"
      />

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :on-row="customRow"
        @change="onTableChange"
      >
        <template #emptyText>
          <a-empty :description="$t('contentRecommend.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'drag'">
            <span :class="['drag-handle', canDrag ? '' : 'disabled']">⋮⋮</span>
          </template>

          <template v-if="column.dataIndex === 'thumbnail'">
            <div v-if="record.thumbnail" class="thumb-wrap">
              <img :src="record.thumbnail" class="thumb-img" />
              <span v-if="record.urls.length > 1" class="thumb-count">{{ record.urls.length }}</span>
            </div>
            <span v-else class="muted">-</span>
          </template>

          <template v-if="column.dataIndex === 'sourceId'">
            <div>{{ record.sourceId }}</div>
            <a-tag :color="record.sourceType === 'CREATION_TASK' ? 'purple' : 'blue'" size="small">
              {{ sourceTypeLabel(record.sourceType) }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'categoryL1Name'">
            <span>{{ record.categoryL1Name || '-' }}</span>
            <span v-if="record.categoryL2Name" class="muted"> / {{ record.categoryL2Name }}</span>
          </template>

          <template v-if="column.dataIndex === 'platform'">
            <a-tag :color="platformColor(record.platform)">{{ platformLabel(record.platform) }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'sortOrder'">
            <!--
              没有编辑权时显示纯数字，而不是靠 v-permission 把输入框摘掉：
              那个指令作用在根元素上，摘掉之后这一列整个空白，比改之前还差——
              只读的人本来是能看到排序值的
            -->
            <span v-if="!canEditSort">{{ record.sortOrder }}</span>
            <a-input-number
              v-else
              :value="record.id in sortDraft ? sortDraft[record.id] : record.sortOrder"
              :min="0"
              :max="99999"
              :precision="0"
              size="small"
              style="width: 76px"
              :disabled="savingSortId === record.id"
              @change="(v: number | null) => (sortDraft[record.id] = v)"
              @blur="saveSortOrder(record)"
            />
          </template>

          <template v-if="column.dataIndex === 'sameStyle'">
            <a-tag :color="record.sameStyle ? 'green' : 'default'">
              {{ record.sameStyle ? $t('common.yes') : $t('common.no') }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'sourceInvalid'">
            <a-tooltip v-if="record.sourceInvalid" :title="record.invalidReason">
              <a-tag color="red">{{ $t('contentRecommend.invalid') }}</a-tag>
            </a-tooltip>
            <a-tag v-else color="green">{{ $t('contentRecommend.valid') }}</a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <!-- 查看只读，用 view 权限而不是 edit：没有编辑权的运营也该能看清一条推荐到底是什么 -->
              <a-button type="link" size="small" @click="openDetail(record)">
                {{ $t('common.view') }}
              </a-button>
              <a-button
                v-permission="'content_recommend:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <a-popconfirm
                v-permission="'content_recommend:delete'"
                :title="$t('contentRecommend.confirmRemove')"
                @confirm="handleRemove(record)"
              >
                <a-button type="link" size="small" danger>
                  {{ $t('contentRecommend.remove') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
      </template>
    </a-card>

    <!-- 查看详情 -->
    <a-drawer v-model:open="detailVisible" :title="$t('contentRecommend.detailTitle')" width="520">
      <template v-if="detail">
        <!-- 源失效最要紧，放最上面：失效的条目不会出现在用户端，但列表里看着一切正常 -->
        <a-alert
          v-if="detail.sourceInvalid"
          type="error"
          show-icon
          style="margin-bottom: 16px"
          :message="$t('contentRecommend.invalid')"
          :description="detail.invalidReason || undefined"
        />

        <div v-if="detail.urls.length" class="detail-media">
          <!-- urls 是水印图，与用户端所见一致；多产物按顺序平铺，别只给第一张 -->
          <a-image-preview-group>
            <a-image v-for="(u, i) in detail.urls" :key="i" :src="u" class="detail-media-item" />
          </a-image-preview-group>
        </div>
        <a-empty v-else :description="$t('contentRecommend.noMedia')" />

        <a-descriptions :column="1" bordered size="small" style="margin-top: 16px">
          <a-descriptions-item :label="$t('contentRecommend.sourceType')">
            <a-tag :color="detail.sourceType === 'CREATION_TASK' ? 'purple' : 'blue'">
              {{ sourceTypeLabel(detail.sourceType) }}
            </a-tag>
            <span class="muted">{{ detail.sourceId }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('contentRecommend.title')">
            {{ detail.title || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('contentRecommend.category')">
            {{ detail.categoryL1Name || '-' }}
            <span v-if="detail.categoryL2Name" class="muted"> / {{ detail.categoryL2Name }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('contentRecommend.platform')">
            <a-tag :color="platformColor(detail.platform)">{{ platformLabel(detail.platform) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('contentRecommend.sortOrder')">
            {{ detail.sortOrder }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('contentRecommend.sameStyleCol')">
            <a-tag :color="detail.sameStyle ? 'green' : 'default'">
              {{ detail.sameStyle ? $t('common.yes') : $t('common.no') }}
            </a-tag>
            <span v-if="!detail.sameStyle" class="muted"> {{ $t('contentRecommend.noSameStyleHint') }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="detail.status === 1 ? 'green' : 'default'">
              {{ detail.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('common.createTime')">
            {{ detail.createTime || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-drawer>

    <!-- 添加 / 编辑 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editId ? $t('contentRecommend.editTitle') : $t('contentRecommend.add')"
      :confirm-loading="saving"
      width="560px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <template v-if="!editId">
          <a-form-item :label="$t('contentRecommend.sourceType')" required>
            <a-radio-group v-model:value="form.sourceType" button-style="solid">
              <a-radio-button value="CREATION_TASK">
                {{ $t('contentRecommend.sourceTask') }}
              </a-radio-button>
              <a-radio-button value="DISPLAY_ASSET">
                {{ $t('contentRecommend.sourceAsset') }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item :label="$t('contentRecommend.sourceId')" required>
            <a-input-number v-model:value="form.sourceId" :min="1" style="width: 100%" />
            <div class="muted">{{ sourceIdHint }}</div>
          </a-form-item>
        </template>

        <a-form-item :label="$t('contentRecommend.categoryL1')" required>
          <a-select
            v-model:value="form.categoryL1Id"
            :options="l1Options"
            show-search
            option-filter-prop="label"
            :placeholder="$t('contentRecommend.filterL1')"
            @change="onFormL1Change"
          />
        </a-form-item>

        <a-form-item :label="$t('contentRecommend.categoryL2')">
          <a-select
            v-model:value="form.categoryL2Id"
            :options="formL2Options"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="$t('contentRecommend.l2Optional')"
          />
        </a-form-item>

        <a-form-item :label="$t('contentRecommend.platform')" required>
          <a-radio-group v-model:value="form.platform" button-style="solid">
            <a-radio-button v-for="p in allowedPlatforms" :key="p" :value="p">
              {{ platformLabel(p) }}
            </a-radio-button>
          </a-radio-group>
          <div class="muted">{{ platformHint }}</div>
        </a-form-item>

        <a-form-item :label="$t('contentRecommend.status')">
          <a-switch
            v-model:checked="enabled"
            :checked-children="$t('contentRecommend.online')"
            :un-checked-children="$t('contentRecommend.offline')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '@/stores/auth'

import { getCategoryTree, type DisplayCategoryNode, type Platform } from '@/api/display-category'
import {
  getRecommendList,
  addRecommend,
  updateRecommend,
  reorderRecommends,
  removeRecommend,
  getPendingAssets,
  type ContentRecommendItem,
  type PendingAsset,
  type RecommendSourceType,
} from '@/api/content-recommend'

const { t } = useI18n()
const authStore = useAuthStore()

function platformLabel(p: Platform) {
  return p === 'APP' ? 'APP' : p === 'PC' ? 'PC' : 'APP+PC'
}
function platformColor(p: Platform) {
  return p === 'APP' ? 'blue' : p === 'PC' ? 'green' : 'purple'
}
function sourceTypeLabel(s: RecommendSourceType) {
  return s === 'CREATION_TASK' ? t('contentRecommend.sourceTask') : t('contentRecommend.sourceAsset')
}

const platformOptions = computed(() =>
  (['APP', 'PC', 'BOTH'] as Platform[]).map((p) => ({ label: platformLabel(p), value: p })),
)
const sourceTypeOptions = computed(() => [
  { label: t('contentRecommend.sourceTask'), value: 'CREATION_TASK' },
  { label: t('contentRecommend.sourceAsset'), value: 'DISPLAY_ASSET' },
])

// ---- 分类树 ----
const tree = ref<DisplayCategoryNode[]>([])
const l1Options = computed(() =>
  tree.value.map((c) => ({ label: `${c.categoryName} (${c.categoryCode})`, value: c.id })),
)
function l2OptionsOf(l1Id?: number) {
  const l1 = l1Id ? tree.value.find((c) => c.id === l1Id) : undefined
  return (l1?.children ?? []).map((c) => ({ label: c.categoryName, value: c.id }))
}
async function loadTree() {
  try {
    tree.value = (await getCategoryTree(true)) || []
  } catch {
    /* 拦截器已提示 */
  }
}
loadTree()

// ---- 列表 ----
const rows = ref<ContentRecommendItem[]>([])
const loading = ref(false)
const filters = reactive({
  categoryL1Id: undefined as number | undefined,
  categoryL2Id: undefined as number | undefined,
  platform: undefined as Platform | undefined,
  sourceType: undefined as RecommendSourceType | undefined,
})
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true })

const filterL2Options = computed(() => l2OptionsOf(filters.categoryL1Id))

/**
 * 当前列表里出现了几个「分类位置」（L1:L2）。
 * 排序值是<b>按位置</b>存的，后端 reorder 也按这个分组守卫（跨位置直接 400）。
 */
const visiblePositions = computed(
  () => new Set(rows.value.map((r) => `${r.categoryL1Id}:${r.categoryL2Id}`)),
)

/**
 * 能不能拖。判据必须与后端 reorder 的守卫一致：<b>可见行同属一个分类位置</b>。
 *
 * 原来写的是「选了一级就能拖」，但只选一级时列表通常横跨多个二级位置，
 * 拖完后端一律回 400「只能在同一分类内排序」——按钮是亮的、拖得动、就是存不上。
 * 现在按真实数据判：只选一级但这些行恰好同属一个位置时照样能拖，
 * 真的混着多个位置才禁用，并在提示里说清是哪种情况。
 */
/**
 * 能不能拖。判据与后端 reorder 的守卫一致：<b>可见行同属一个分类位置</b>。
 *
 * 原来写的是「选了一级就能拖」，但只选一级时列表通常横跨多个二级位置，
 * 拖完后端一律回 400「只能在同一分类内排序」——按钮是亮的、拖得动、就是存不上。
 * 现在按真实数据判：只选一级但这些行恰好同属一个位置时照样能拖。
 *
 * 不再限制「整个位置必须在同一页」：后端已改成「把传入的这几条放回它们原先占据的
 * 那几个位次」，只动相对次序、不从 0 重新编号，所以第几页拖都对。
 */
const canDrag = computed(() => rows.value.length > 1 && visiblePositions.value.size === 1)

/** 不能拖时的原因，直接告诉运营下一步该做什么，而不是只说「需要选分类」 */
const dragHint = computed(() => {
  if (rows.value.length < 2) return ''
  if (visiblePositions.value.size > 1) return t('contentRecommend.dragMixedPositions')
  return ''
})

const columns = computed(() => [
  { title: '', dataIndex: 'drag', key: 'drag', width: 40, align: 'center' as const },
  {
    title: t('contentRecommend.thumbnail'),
    dataIndex: 'thumbnail',
    width: 80,
    align: 'center' as const,
  },
  { title: t('contentRecommend.sourceId'), dataIndex: 'sourceId', width: 120 },
  { title: t('contentRecommend.category'), dataIndex: 'categoryL1Name', width: 200 },
  {
    title: t('contentRecommend.platform'),
    dataIndex: 'platform',
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('contentRecommend.sortOrder'),
    dataIndex: 'sortOrder',
    // 100 而不是 80：这一列现在放的是可编辑的数字输入框（76px + 内边距），
    // 按 80 会把框挤到贴边
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('contentRecommend.sameStyleCol'),
    dataIndex: 'sameStyle',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('contentRecommend.sourceState'),
    dataIndex: 'sourceInvalid',
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 150,
    align: 'center' as const,
  },
])

async function loadList() {
  loading.value = true
  try {
    const res = await getRecommendList({
      categoryL1Id: filters.categoryL1Id,
      categoryL2Id: filters.categoryL2Id,
      platform: filters.platform,
      sourceType: filters.sourceType,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    rows.value = res.list || []
    pagination.total = res.total || 0
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
loadList()

function onFilterL1Change() {
  filters.categoryL2Id = undefined // 换一级后旧二级不再属于它
  pagination.current = 1
  loadList()
}
function resetFilters() {
  Object.assign(filters, {
    categoryL1Id: undefined,
    categoryL2Id: undefined,
    platform: undefined,
    sourceType: undefined,
  })
  pagination.current = 1
  loadList()
}
function onTableChange(pg: { current?: number; pageSize?: number }) {
  pagination.current = pg.current ?? 1
  pagination.pageSize = pg.pageSize ?? 20
  loadList()
}

// ---- 待上推 ----
const activeTab = ref<'pinned' | 'pending'>('pinned')
const pendingRows = ref<PendingAsset[]>([])
const pendingLoading = ref(false)
const pendingTotal = ref(0)
const pendingPagination = reactive({
  current: 1,
  pageSize: 20,
  get total() {
    return pendingTotal.value
  },
  showSizeChanger: true,
})

const pendingColumns = computed(() => [
  {
    title: t('contentRecommend.thumbnail'),
    dataIndex: 'thumbnail',
    width: 80,
    align: 'center' as const,
  },
  { title: t('contentRecommend.sourceId'), dataIndex: 'id', width: 100 },
  { title: t('contentRecommend.assetTitle'), dataIndex: 'title', ellipsis: true },
  { title: t('contentRecommend.defaultSlot'), dataIndex: 'categoryL1Name', width: 200 },
  {
    title: t('contentRecommend.sameStyleCol'),
    dataIndex: 'sameStyle',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 110,
    align: 'center' as const,
  },
])

async function loadPending() {
  pendingLoading.value = true
  try {
    const res = await getPendingAssets({
      page: pendingPagination.current,
      pageSize: pendingPagination.pageSize,
    })
    pendingRows.value = res.list || []
    pendingTotal.value = res.total || 0
  } catch {
    /* 拦截器已提示 */
  } finally {
    pendingLoading.value = false
  }
}
// 首屏就拉一次：待上推数量要显示在 Tab 徽标上，等切过去才知道有多少就晚了
loadPending()

function onTabChange() {
  if (activeTab.value === 'pending') loadPending()
  else loadList()
}
function onPendingPageChange(pg: { current?: number; pageSize?: number }) {
  pendingPagination.current = pg.current ?? 1
  pendingPagination.pageSize = pg.pageSize ?? 20
  loadPending()
}

/** 从待上推直接上推荐位：沿用素材身上配的默认分类，运营只需确认平台 */
function openPinPending(record: PendingAsset) {
  editId.value = null
  Object.assign(form, {
    sourceType: 'DISPLAY_ASSET' as RecommendSourceType,
    sourceId: record.id,
    categoryL1Id: record.categoryL1Id || undefined,
    categoryL2Id: record.categoryL2Id || undefined,
    platform: 'APP' as Platform,
    status: 1,
  })
  syncPlatformToScope()
  modalVisible.value = true
}

// ---- 拖拽排序 ----
const dragIndex = ref<number | null>(null)

function customRow(_record: ContentRecommendItem, index: number) {
  if (!canDrag.value) return {}
  return {
    draggable: true,
    ondragstart: () => (dragIndex.value = index),
    ondragover: (e: DragEvent) => e.preventDefault(),
    ondrop: (e: DragEvent) => {
      e.preventDefault()
      handleDrop(index)
    },
    ondragend: () => (dragIndex.value = null),
  }
}

async function handleDrop(targetIndex: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === targetIndex) return

  const next = [...rows.value]
  const [moved] = next.splice(from, 1)
  next.splice(targetIndex, 0, moved)
  const before = rows.value
  rows.value = next // 先本地生效，失败再回滚，避免拖完等一个来回才动

  try {
    await reorderRecommends(next.map((r) => r.id))
    message.success(t('contentRecommend.reorderSuccess'))
    loadList() // 拉回真实 sortOrder（后端按步长 10 重排）
  } catch {
    rows.value = before
  }
}

// ---- 查看详情 ----
const detailVisible = ref(false)
const detail = ref<ContentRecommendItem | null>(null)

/**
 * 直接用列表行渲染，不再打一次详情接口：列表项已经带齐了源内容快照
 * （title / urls / sameStyle / sourceInvalid…），而且那份快照是每次查询实时取的。
 * 另开一个接口只会多一次往返，还会出现「列表说失效、详情说正常」的两套口径。
 */
function openDetail(record: ContentRecommendItem) {
  detail.value = record
  detailVisible.value = true
}

// ---- 行内改排序 ----
const savingSortId = ref<number | null>(null)

/**
 * 每行的编辑草稿，失焦时才落库。
 *
 * 取值用 `id in sortDraft` 判断而不是 `?? record.sortOrder`：InputNumber 是受控的
 * （见 @v-c/input-number 的 `if (props.value === void 0) setInputValue(...)`——
 * 传了 value 就完全靠父组件回喂），清空输入框时 change 给的是 null，
 * 用 ?? 会立刻把旧数字填回去，表现就是「这个框根本清不掉、输不进数字」。
 * 所以必须把「没编辑过」(undefined) 和「编辑成空」(null) 分开。
 *
 * 不读 DOM（e.target.value 拿的是显示字符串，将来给 InputNumber 配了 formatter
 * 就会静默出错），也不在 change 里直接存（InputNumber 每敲一个数字就触发一次 change，
 * 输 120 会打三次请求）。按行存草稿还避免了「编辑 A 未失焦就去点 B」时两行互相串值。
 */
const sortDraft = reactive<Record<number, number | null>>({})

/** 排序列要不要给可编辑控件。与操作列的 v-permission 用同一个权限码 */
const canEditSort = computed(() => {
  const perms = authStore.user?.permissions ?? []
  return perms.includes('*') || perms.includes('content_recommend:edit')
})

/**
 * 直接改某一条的排序值。
 *
 * 与拖拽互补：拖拽只在「可见行同属一个分类位置」时可用，而运营常常只筛一级、
 * 列表横跨多个位置——那种情况下排序值是唯一能改顺序的手段。
 * 这里改的是绝对值，不涉及跨位置比较，所以任何筛选下都成立。
 *
 * 只传 sortOrder：后端 update 对没传的字段回退到原值（分类、平台都不动），
 * 所以不必把整行回传，也就不会因为回传了旧快照而覆盖掉别人刚改的分类。
 */
async function saveSortOrder(record: ContentRecommendItem) {
  const raw = sortDraft[record.id]
  // 没动过就不发请求：点进点出也会触发 blur
  if (raw === undefined) return

  const next = Number(raw)
  // 清空或填了非数字时按不变处理，而不是当成 0——0 会把这条顶到最前面。
  // 草稿一并丢掉，输入框回到库里的值
  if (!Number.isFinite(next) || next < 0) {
    delete sortDraft[record.id]
    return
  }
  if (next === record.sortOrder) {
    delete sortDraft[record.id]
    return
  }

  savingSortId.value = record.id
  try {
    await updateRecommend(record.id, { sortOrder: next })
    message.success(t('contentRecommend.sortSaved'))
    delete sortDraft[record.id]
    loadList()
  } catch {
    // 拦截器已提示；丢掉草稿并重拉，输入框恢复成库里的真实值
    delete sortDraft[record.id]
    loadList()
  } finally {
    savingSortId.value = null
  }
}

// ---- 添加 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)

const form = reactive({
  sourceType: 'CREATION_TASK' as RecommendSourceType,
  sourceId: undefined as number | undefined,
  categoryL1Id: undefined as number | undefined,
  categoryL2Id: undefined as number | undefined,
  platform: 'APP' as Platform,
  status: 1,
})
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

const formL2Options = computed(() => l2OptionsOf(form.categoryL1Id))

const sourceIdHint = computed(() =>
  form.sourceType === 'CREATION_TASK'
    ? t('contentRecommend.sourceIdHintTask')
    : t('contentRecommend.sourceIdHintAsset'),
)

/**
 * 推荐平台必须被所挂分类覆盖（一级和二级都要），越界的选项直接摘掉，
 * 免得运营点了再吃后端报错。
 */
const allowedPlatforms = computed<Platform[]>(() => {
  const l1 = form.categoryL1Id ? tree.value.find((c) => c.id === form.categoryL1Id) : undefined
  const l2 = form.categoryL2Id ? l1?.children.find((c) => c.id === form.categoryL2Id) : undefined
  const scopes = [l1?.platform, l2?.platform].filter(Boolean) as Platform[]
  const narrowest = scopes.find((p) => p !== 'BOTH')
  return narrowest ? [narrowest] : ['APP', 'PC', 'BOTH']
})
const platformHint = computed(() =>
  allowedPlatforms.value.length === 1
    ? t('contentRecommend.platformLocked', { platform: platformLabel(allowedPlatforms.value[0]) })
    : t('contentRecommend.platformHint'),
)

function syncPlatformToScope() {
  if (!allowedPlatforms.value.includes(form.platform)) {
    form.platform = allowedPlatforms.value[0]
  }
}
function onFormL1Change() {
  form.categoryL2Id = undefined
  syncPlatformToScope()
}

function openAdd() {
  editId.value = null
  Object.assign(form, {
    sourceType: 'CREATION_TASK' as RecommendSourceType,
    sourceId: undefined,
    categoryL1Id: filters.categoryL1Id,
    categoryL2Id: filters.categoryL2Id,
    platform: 'APP' as Platform,
    status: 1,
  })
  syncPlatformToScope()
  modalVisible.value = true
}

function openEdit(record: ContentRecommendItem) {
  editId.value = record.id
  Object.assign(form, {
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    categoryL1Id: record.categoryL1Id,
    categoryL2Id: record.categoryL2Id || undefined,
    platform: record.platform,
    status: record.status,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!editId.value && !form.sourceId) {
    message.warning(t('contentRecommend.sourceIdRequired'))
    return
  }
  if (!form.categoryL1Id) {
    message.warning(t('contentRecommend.l1Required'))
    return
  }
  saving.value = true
  try {
    const payload = {
      categoryL1Id: form.categoryL1Id,
      categoryL2Id: form.categoryL2Id ?? 0,
      platform: form.platform,
      status: form.status,
    }
    if (editId.value) {
      // 源不可改：换源等于换一条推荐，走新增+移除更清楚
      await updateRecommend(editId.value, payload)
    } else {
      await addRecommend({ ...payload, sourceType: form.sourceType, sourceId: form.sourceId })
    }
    message.success(t('common.saveSuccess'))
    modalVisible.value = false
    loadList()
    loadPending() // 刚上推的那条要从「待上推」里消失，徽标计数也得跟着降
  } catch {
    /* 源不可用 / 分类归属 / 平台越界的报错由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleRemove(record: ContentRecommendItem) {
  try {
    await removeRecommend(record.id)
    message.success(t('contentRecommend.removeSuccess'))
    loadList()
  } catch {
    /* 拦截器已提示 */
  }
}
</script>

<style scoped>
.detail-media {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-media-item {
  max-width: 150px;
  border-radius: 4px;
}
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary, #999);
  letter-spacing: -2px;
  user-select: none;
}
.drag-handle.disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.thumb-wrap {
  position: relative;
  display: inline-block;
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
</style>
