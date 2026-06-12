<template>
  <div class="page-container">
    <a-card :title="$t('templateAsset.listTitle')" :bordered="false">
      <ProTable
        ref="assetTableRef"
        :columns="assetColumns"
        :request="loadAssets"
        :search="{}"
        row-key="id"
        :scroll="{ x: 1200 }"
        :row-selection="rowSelection"
      >
        <template #emptyText>
          <a-empty :description="$t('templateAsset.noAssetData')" />
        </template>
        <template #toolbar>
          <a-button
            v-permission="'template_filter:create'"
            type="primary"
            @click="handleCreateAsset"
          >
            {{ $t('templateAsset.createAsset') }}
          </a-button>
          <a-button
            v-permission="'template_filter:edit'"
            :disabled="selectedRowKeys.length === 0"
            @click="handleOpenBatchTag"
          >
            {{ $t('templateAsset.batchTag') }}
            <template v-if="selectedRowKeys.length"> ({{ selectedRowKeys.length }})</template>
          </a-button>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'preview'">
            <a-image
              v-if="record.type === 'image' && record.url"
              :src="record.url"
              :width="56"
              :height="56"
              style="object-fit: cover; border-radius: 4px"
            />
            <a
              v-else-if="record.type === 'video' && record.url"
              :href="record.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <a-tag color="purple">
                <template #icon><PlayCircleOutlined /></template>
                {{ $t('templateAsset.videoLink') }}
              </a-tag>
            </a>
            <span v-else>-</span>
          </template>

          <template v-if="column.dataIndex === 'type'">
            <a-tag :color="record.type === 'image' ? 'blue' : 'purple'">
              {{
                record.type === 'image'
                  ? $t('templateAsset.typeImage')
                  : $t('templateAsset.typeVideo')
              }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'tagged'">
            <a-spin v-if="taggedLoading" size="small" />
            <template v-else>
              <span v-if="(taggedMap[record.id] || []).length === 0" class="tagged-empty">
                {{ $t('templateAsset.notTagged') }}
              </span>
              <a-space v-else :size="[4, 4]" wrap>
                <a-tag
                  v-for="tag in (taggedMap[record.id] || []).slice(0, MAX_TAGS_PER_ROW)"
                  :key="tag.optionId"
                  :color="tag.color"
                >
                  {{ tag.label }}
                </a-tag>
                <a-tag
                  v-if="(taggedMap[record.id] || []).length > MAX_TAGS_PER_ROW"
                  color="default"
                >
                  +{{ (taggedMap[record.id] || []).length - MAX_TAGS_PER_ROW }}
                </a-tag>
              </a-space>
            </template>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">
              {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'template_filter:edit'"
                type="link"
                size="small"
                @click="handleOpenTagDrawer(record)"
              >
                {{ $t('templateAsset.manageTags') }}
              </a-button>
              <a-button
                v-permission="'template_filter:edit'"
                type="link"
                size="small"
                @click="handleEditAsset(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <a-popconfirm
                v-permission="'template_filter:delete'"
                :title="$t('templateAsset.confirmDeleteAsset')"
                @confirm="handleDeleteAsset(record)"
              >
                <a-button type="link" size="small" danger>
                  {{ $t('common.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>

    <!-- 素材 新增/编辑 弹窗 -->
    <a-modal
      v-model:open="assetModalVisible"
      :title="isAssetEdit ? $t('templateAsset.editAsset') : $t('templateAsset.createAsset')"
      :confirm-loading="assetSubmitLoading"
      width="600px"
      @ok="handleAssetSubmit"
    >
      <a-form :model="assetForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('templateAsset.bizType')">
          <a-input
            v-model:value="assetForm.bizType"
            :placeholder="$t('templateAsset.bizTypePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.moduleCode')">
          <a-input
            v-model:value="assetForm.moduleCode"
            :placeholder="$t('templateAsset.moduleCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.slotCode')">
          <a-input
            v-model:value="assetForm.slotCode"
            :placeholder="$t('templateAsset.slotCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.type')">
          <a-select v-model:value="assetForm.type" :options="typeOptions" />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.title')">
          <a-input
            v-model:value="assetForm.title"
            :placeholder="$t('templateAsset.titlePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.url')">
          <a-input
            v-model:value="assetForm.url"
            :placeholder="$t('templateAsset.urlPlaceholder')"
          />
        </a-form-item>
        <a-form-item
          v-if="assetForm.type === 'image' && assetForm.url"
          :label="$t('templateAsset.preview')"
        >
          <a-image :src="assetForm.url" :width="120" />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.size')">
          <a-space>
            <a-input-number
              v-model:value="assetForm.width"
              :min="0"
              :placeholder="$t('templateAsset.width')"
            />
            <span>x</span>
            <a-input-number
              v-model:value="assetForm.height"
              :min="0"
              :placeholder="$t('templateAsset.height')"
            />
          </a-space>
        </a-form-item>
        <a-form-item :label="$t('templateAsset.sortOrder')">
          <a-input-number v-model:value="assetForm.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('templateAsset.extra')">
          <a-textarea
            v-model:value="assetForm.extra"
            :rows="2"
            :placeholder="$t('templateAsset.extraPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="assetForm.status"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 打标抽屉 -->
    <a-drawer
      v-model:open="tagDrawerVisible"
      :title="$t('templateAsset.tagDrawerTitle')"
      width="480"
      :body-style="{ paddingBottom: '80px' }"
    >
      <a-spin :spinning="tagLoading">
        <div v-if="tagAsset" class="tag-asset-head">
          <a-image
            v-if="tagAsset.type === 'image' && tagAsset.url"
            :src="tagAsset.url"
            :width="64"
            :height="64"
            style="object-fit: cover; border-radius: 4px"
          />
          <div class="tag-asset-meta">
            <div class="tag-asset-title">{{ tagAsset.title || '-' }}</div>
            <div class="tag-asset-sub">
              {{ tagAsset.moduleCode }} / {{ tagAsset.slotCode }}
            </div>
          </div>
        </div>

        <a-empty
          v-if="!tagLoading && filterMetaList.length === 0"
          :description="$t('templateAsset.noFilterMeta')"
        />

        <div
          v-for="meta in filterMetaList"
          :key="meta.filterId"
          class="tag-dimension"
        >
          <div class="tag-dimension-title">
            {{ meta.filterName }}
            <a-tag v-if="meta.multiSelect" color="green" size="small">
              {{ $t('templateAsset.multiSelect') }}
            </a-tag>
          </div>
          <a-checkbox-group
            v-if="meta.multiSelect"
            v-model:value="multiSelections[meta.filterId]"
          >
            <a-checkbox
              v-for="opt in meta.options"
              :key="opt.optionId"
              :value="opt.optionId"
            >
              {{ opt.optionName }}
            </a-checkbox>
          </a-checkbox-group>
          <div v-else>
            <a-radio-group v-model:value="singleSelections[meta.filterId]">
              <a-radio
                v-for="opt in meta.options"
                :key="opt.optionId"
                :value="opt.optionId"
              >
                {{ opt.optionName }}
              </a-radio>
            </a-radio-group>
            <a-button
              v-if="singleSelections[meta.filterId] != null"
              type="link"
              size="small"
              @click="singleSelections[meta.filterId] = null"
            >
              {{ $t('templateAsset.clear') }}
            </a-button>
          </div>
        </div>
      </a-spin>

      <div class="tag-drawer-footer">
        <a-space>
          <a-button @click="tagDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button
            v-permission="'template_filter:edit'"
            type="primary"
            :loading="tagSubmitLoading"
            @click="handleSaveTags"
          >
            {{ $t('common.save') }}
          </a-button>
        </a-space>
      </div>
    </a-drawer>

    <!-- 批量打标抽屉 -->
    <a-drawer
      v-model:open="batchTagDrawerVisible"
      :title="$t('templateAsset.batchTagTitle')"
      width="480"
      :body-style="{ paddingBottom: '80px' }"
    >
      <a-spin :spinning="batchMetaLoading">
        <a-alert
          type="info"
          show-icon
          :message="$t('templateAsset.batchTagSelected', { count: selectedRowKeys.length })"
          style="margin-bottom: 16px"
        />

        <a-empty
          v-if="!batchMetaLoading && batchFilterMetaList.length === 0"
          :description="$t('templateAsset.noFilterMeta')"
        />

        <div
          v-for="meta in batchFilterMetaList"
          :key="meta.filterId"
          class="tag-dimension"
        >
          <div class="tag-dimension-title">
            {{ meta.filterName }}
            <a-tag v-if="meta.multiSelect" color="green" size="small">
              {{ $t('templateAsset.multiSelect') }}
            </a-tag>
          </div>
          <a-checkbox-group
            v-if="meta.multiSelect"
            v-model:value="batchMultiSelections[meta.filterId]"
          >
            <a-checkbox
              v-for="opt in meta.options"
              :key="opt.optionId"
              :value="opt.optionId"
            >
              {{ opt.optionName }}
            </a-checkbox>
          </a-checkbox-group>
          <div v-else>
            <a-radio-group v-model:value="batchSingleSelections[meta.filterId]">
              <a-radio
                v-for="opt in meta.options"
                :key="opt.optionId"
                :value="opt.optionId"
              >
                {{ opt.optionName }}
              </a-radio>
            </a-radio-group>
            <a-button
              v-if="batchSingleSelections[meta.filterId] != null"
              type="link"
              size="small"
              @click="batchSingleSelections[meta.filterId] = null"
            >
              {{ $t('templateAsset.clear') }}
            </a-button>
          </div>
        </div>
      </a-spin>

      <div class="tag-drawer-footer">
        <a-space>
          <a-button @click="batchTagDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button
            v-permission="'template_filter:edit'"
            type="primary"
            :loading="batchSubmitLoading"
            @click="handleSubmitBatchTag"
          >
            {{ $t('common.save') }}
          </a-button>
        </a-space>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { PlayCircleOutlined } from '@antdv-next/icons'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getTemplateAssetList,
  createTemplateAsset,
  updateTemplateAsset,
  deleteTemplateAsset,
  getAssetTags,
  setAssetTags,
  batchTagAssets,
  getTemplateFilterMeta,
  type TemplateAsset,
  type TemplateAssetType,
  type TemplateFilterMeta,
} from '@/api/template-asset'

const { t } = useI18n()

const assetTableRef = ref<InstanceType<typeof ProTable> | null>(null)

// 已打标签列：每行最多展示的标签数
const MAX_TAGS_PER_ROW = 4
// 标签色板：按 filterId 循环取色
const TAG_COLORS = [
  'blue',
  'green',
  'orange',
  'purple',
  'cyan',
  'magenta',
  'geekblue',
  'volcano',
  'gold',
  'lime',
]

const typeOptions = [
  { label: t('templateAsset.typeImage'), value: 'image' },
  { label: t('templateAsset.typeVideo'), value: 'video' },
]

// ---- 素材列表 ----
const assetColumns = [
  {
    title: t('templateAsset.preview'),
    dataIndex: 'preview',
    key: 'preview',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('templateAsset.title'),
    dataIndex: 'title',
    ellipsis: true,
    width: 160,
  },
  {
    title: t('templateAsset.moduleCode'),
    dataIndex: 'moduleCode',
    searchType: 'input' as const,
    width: 140,
    ellipsis: true,
  },
  {
    title: t('templateAsset.slotCode'),
    dataIndex: 'slotCode',
    searchType: 'input' as const,
    width: 130,
    ellipsis: true,
  },
  {
    title: t('templateAsset.type'),
    dataIndex: 'type',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('templateAsset.typeImage'), value: 'image' },
      { label: t('templateAsset.typeVideo'), value: 'video' },
    ],
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('templateAsset.sortOrder'),
    dataIndex: 'sortOrder',
    width: 70,
    align: 'center' as const,
  },
  {
    title: t('templateAsset.taggedColumn'),
    dataIndex: 'tagged',
    key: 'tagged',
    width: 220,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 90,
    align: 'center' as const,
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

// 当前列表查询条件（供批量打标取元数据复用）
const currentQuery = reactive({
  bizType: 'ecommerce' as string,
  moduleCode: undefined as string | undefined,
  slotCode: undefined as string | undefined,
})

// 已打标签：assetId -> [{optionId, label, color}]
interface TaggedChip {
  optionId: number
  label: string
  color: string
}
const taggedMap = reactive<Record<number, TaggedChip[]>>({})
const taggedLoading = ref(false)
// optionId -> {filterId, filterName, optionName}
const optionDict = ref<Map<number, { filterId: number; filterName: string; optionName: string }>>(
  new Map(),
)

function colorForFilter(filterId: number): string {
  return TAG_COLORS[filterId % TAG_COLORS.length]
}

// 构建/刷新 optionId 字典（用当前筛选条件取全量维度）
async function ensureOptionDict() {
  try {
    const meta = await getTemplateFilterMeta({
      bizType: currentQuery.bizType,
      moduleCode: currentQuery.moduleCode,
      slotCode: currentQuery.slotCode,
    })
    const dict = new Map<number, { filterId: number; filterName: string; optionName: string }>()
    ;(meta || []).forEach((m) => {
      m.options.forEach((o) => {
        dict.set(o.optionId, {
          filterId: m.filterId,
          filterName: m.filterName,
          optionName: o.optionName,
        })
      })
    })
    optionDict.value = dict
  } catch (error) {
    console.error('Failed to load filter meta dict:', error)
  }
}

// 批量加载当前页素材的已打标签
async function loadTaggedForAssets(assets: TemplateAsset[]) {
  Object.keys(taggedMap).forEach((k) => delete taggedMap[Number(k)])
  if (assets.length === 0) return
  taggedLoading.value = true
  try {
    await ensureOptionDict()
    const results = await Promise.all(
      assets.map((a) =>
        getAssetTags(a.id)
          .then((tags) => ({ id: a.id, tags: tags || [] }))
          .catch(() => ({ id: a.id, tags: [] })),
      ),
    )
    results.forEach(({ id, tags }) => {
      taggedMap[id] = tags.map((tg) => {
        const dictEntry = optionDict.value.get(tg.optionId)
        return {
          optionId: tg.optionId,
          label: dictEntry
            ? `${dictEntry.filterName}:${dictEntry.optionName}`
            : `#${tg.optionId}`,
          color: colorForFilter(dictEntry?.filterId ?? tg.filterId),
        }
      })
    })
  } finally {
    taggedLoading.value = false
  }
}

async function loadAssets(params: Record<string, unknown>) {
  currentQuery.moduleCode = params.moduleCode as string | undefined
  currentQuery.slotCode = params.slotCode as string | undefined
  const res = await getTemplateAssetList({
    moduleCode: params.moduleCode as string | undefined,
    slotCode: params.slotCode as string | undefined,
    type: params.type as TemplateAssetType | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  const list = res.list || []
  // 异步加载本页素材已打标签（不阻塞表格渲染）
  loadTaggedForAssets(list)
  return {
    data: list,
    total: res.total || 0,
    success: true,
  }
}

// ---- 素材 CRUD ----
const assetModalVisible = ref(false)
const assetSubmitLoading = ref(false)
const isAssetEdit = ref(false)
const editAssetId = ref<number | null>(null)

const assetForm = reactive({
  bizType: 'ecommerce',
  moduleCode: '',
  slotCode: '',
  type: 'image' as TemplateAssetType,
  title: '',
  url: '',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  sortOrder: 0,
  status: 1,
  extra: '',
})

function resetAssetForm() {
  assetForm.bizType = 'ecommerce'
  assetForm.moduleCode = ''
  assetForm.slotCode = ''
  assetForm.type = 'image'
  assetForm.title = ''
  assetForm.url = ''
  assetForm.width = undefined
  assetForm.height = undefined
  assetForm.sortOrder = 0
  assetForm.status = 1
  assetForm.extra = ''
}

function handleCreateAsset() {
  isAssetEdit.value = false
  editAssetId.value = null
  resetAssetForm()
  assetModalVisible.value = true
}

function handleEditAsset(record: TemplateAsset) {
  isAssetEdit.value = true
  editAssetId.value = record.id
  assetForm.bizType = record.bizType
  assetForm.moduleCode = record.moduleCode
  assetForm.slotCode = record.slotCode
  assetForm.type = record.type
  assetForm.title = record.title
  assetForm.url = record.url
  assetForm.width = record.width
  assetForm.height = record.height
  assetForm.sortOrder = record.sortOrder ?? 0
  assetForm.status = record.status
  assetForm.extra = record.extra ?? ''
  assetModalVisible.value = true
}

async function handleAssetSubmit() {
  assetSubmitLoading.value = true
  try {
    if (isAssetEdit.value && editAssetId.value != null) {
      await updateTemplateAsset(editAssetId.value, { ...assetForm })
      message.success(t('common.updateSuccess'))
    } else {
      await createTemplateAsset({ ...assetForm })
      message.success(t('common.createSuccess'))
    }
    assetModalVisible.value = false
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to save asset:', error)
  } finally {
    assetSubmitLoading.value = false
  }
}

async function handleDeleteAsset(record: TemplateAsset) {
  try {
    await deleteTemplateAsset(record.id)
    message.success(t('common.deleteSuccess'))
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to delete asset:', error)
  }
}

// ---- 打标抽屉 ----
const tagDrawerVisible = ref(false)
const tagLoading = ref(false)
const tagSubmitLoading = ref(false)
const tagAsset = ref<TemplateAsset | null>(null)
const filterMetaList = ref<TemplateFilterMeta[]>([])
// multiSelect=true -> optionId[] by filterId
const multiSelections = reactive<Record<number, number[]>>({})
// multiSelect=false -> single optionId (or null) by filterId
const singleSelections = reactive<Record<number, number | null>>({})

function clearTagSelections() {
  Object.keys(multiSelections).forEach((k) => delete multiSelections[Number(k)])
  Object.keys(singleSelections).forEach((k) => delete singleSelections[Number(k)])
}

async function handleOpenTagDrawer(record: TemplateAsset) {
  tagAsset.value = record
  tagDrawerVisible.value = true
  tagLoading.value = true
  filterMetaList.value = []
  clearTagSelections()
  try {
    const [meta, tags] = await Promise.all([
      getTemplateFilterMeta({
        bizType: record.bizType,
        moduleCode: record.moduleCode,
        slotCode: record.slotCode,
      }),
      getAssetTags(record.id),
    ])
    filterMetaList.value = meta || []
    const selectedOptionIds = new Set((tags || []).map((tg) => tg.optionId))
    // 初始化各维度选中态
    filterMetaList.value.forEach((m) => {
      const chosen = m.options
        .filter((o) => selectedOptionIds.has(o.optionId))
        .map((o) => o.optionId)
      if (m.multiSelect) {
        multiSelections[m.filterId] = chosen
      } else {
        singleSelections[m.filterId] = chosen.length > 0 ? chosen[0] : null
      }
    })
  } catch (error) {
    console.error('Failed to load tag data:', error)
  } finally {
    tagLoading.value = false
  }
}

async function handleSaveTags() {
  if (!tagAsset.value) return
  tagSubmitLoading.value = true
  try {
    const optionIds: number[] = []
    filterMetaList.value.forEach((m) => {
      if (m.multiSelect) {
        const arr = multiSelections[m.filterId] || []
        optionIds.push(...arr)
      } else {
        const v = singleSelections[m.filterId]
        if (v != null) optionIds.push(v)
      }
    })
    await setAssetTags(tagAsset.value.id, optionIds)
    message.success(t('templateAsset.saveTagsSuccess'))
    tagDrawerVisible.value = false
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to save tags:', error)
  } finally {
    tagSubmitLoading.value = false
  }
}

// ---- 行选择 ----
const selectedRowKeys = ref<number[]>([])
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys.map((k) => Number(k))
  },
}))

// ---- 批量打标 ----
const batchTagDrawerVisible = ref(false)
const batchMetaLoading = ref(false)
const batchSubmitLoading = ref(false)
const batchFilterMetaList = ref<TemplateFilterMeta[]>([])
const batchMultiSelections = reactive<Record<number, number[]>>({})
const batchSingleSelections = reactive<Record<number, number | null>>({})

function clearBatchSelections() {
  Object.keys(batchMultiSelections).forEach((k) => delete batchMultiSelections[Number(k)])
  Object.keys(batchSingleSelections).forEach((k) => delete batchSingleSelections[Number(k)])
}

async function handleOpenBatchTag() {
  if (selectedRowKeys.value.length === 0) return
  batchTagDrawerVisible.value = true
  batchMetaLoading.value = true
  batchFilterMetaList.value = []
  clearBatchSelections()
  try {
    const meta = await getTemplateFilterMeta({
      bizType: currentQuery.bizType,
      moduleCode: currentQuery.moduleCode,
      slotCode: currentQuery.slotCode,
    })
    batchFilterMetaList.value = meta || []
    batchFilterMetaList.value.forEach((m) => {
      if (m.multiSelect) {
        batchMultiSelections[m.filterId] = []
      } else {
        batchSingleSelections[m.filterId] = null
      }
    })
  } catch (error) {
    console.error('Failed to load batch tag meta:', error)
  } finally {
    batchMetaLoading.value = false
  }
}

async function handleSubmitBatchTag() {
  const optionIds: number[] = []
  batchFilterMetaList.value.forEach((m) => {
    if (m.multiSelect) {
      optionIds.push(...(batchMultiSelections[m.filterId] || []))
    } else {
      const v = batchSingleSelections[m.filterId]
      if (v != null) optionIds.push(v)
    }
  })
  if (optionIds.length === 0) {
    message.warning(t('templateAsset.batchTagEmpty'))
    return
  }
  batchSubmitLoading.value = true
  try {
    const assetIds = [...selectedRowKeys.value]
    await batchTagAssets(assetIds, optionIds)
    message.success(t('templateAsset.batchTagSuccess', { count: assetIds.length }))
    batchTagDrawerVisible.value = false
    selectedRowKeys.value = []
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to batch tag:', error)
  } finally {
    batchSubmitLoading.value = false
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}

.tag-asset-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.tag-asset-meta {
  display: flex;
  flex-direction: column;
}

.tag-asset-title {
  font-weight: 500;
}

.tag-asset-sub {
  font-size: 12px;
  color: #999;
}

.tag-dimension {
  margin-bottom: 20px;
}

.tag-dimension-title {
  font-weight: 500;
  margin-bottom: 10px;
}

.tag-drawer-footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12px 24px;
  text-align: right;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.tagged-empty {
  color: #999;
  font-size: 12px;
}
</style>
