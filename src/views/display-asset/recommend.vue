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
        v-if="!canDrag"
        type="warning"
        show-icon
        banner
        style="margin-bottom: 12px"
        :message="$t('contentRecommend.dragNeedsCategory')"
      />

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :custom-row="customRow"
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
 * 拖拽排序只在「筛定了一级分类」时开放。
 * 后端只接受同一分类位置内的重排（跨分类拖拽语义上是换分类），混着多个分类的列表拖了必然被拒。
 */
const canDrag = computed(() => !!filters.categoryL1Id)

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
    width: 80,
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
