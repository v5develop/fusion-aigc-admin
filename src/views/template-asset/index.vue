<template>
  <div class="page-container">
    <a-card :title="$t('templateAsset.listTitle')" variant="borderless">
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

          <template v-if="column.dataIndex === 'placementCount'">
            <a-button type="link" size="small" @click="handleOpenPlacements(record)">
              <a-badge
                :count="record.placementCount || 0"
                :number-style="{ backgroundColor: (record.placementCount || 0) > 0 ? '#52c41a' : '#bfbfbf' }"
                show-zero
              />
              <span style="margin-left: 6px">{{ $t('templateAsset.managePlacements') }}</span>
            </a-button>
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

    <!-- 物料 新增/编辑 弹窗 -->
    <a-modal
      v-model:open="assetModalVisible"
      :title="isAssetEdit ? $t('templateAsset.editAsset') : $t('templateAsset.createAsset')"
      :confirm-loading="assetSubmitLoading"
      width="600px"
      @ok="handleAssetSubmit"
    >
      <a-form :model="assetForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-alert
          v-if="isAssetEdit"
          type="warning"
          show-icon
          :message="$t('templateAsset.sharedMaterialHint')"
          style="margin-bottom: 16px"
        />
        <a-form-item :label="$t('templateAsset.bizType')">
          <a-select v-model:value="assetForm.bizType" :options="bizTypeOptions" />
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
        <a-form-item :label="$t('templateAsset.extra')">
          <a-textarea
            v-model:value="assetForm.extra"
            :rows="2"
            :placeholder="$t('templateAsset.extraPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 投放位管理抽屉 -->
    <a-drawer
      v-model:open="placementDrawerVisible"
      :title="$t('templateAsset.placementDrawerTitle')"
      :size="640"
      :styles="{ body: { paddingBottom: '24px' } }"
    >
      <div v-if="placementMaterial" class="tag-asset-head">
        <a-image
          v-if="placementMaterial.type === 'image' && placementMaterial.url"
          :src="placementMaterial.url"
          :width="64"
          :height="64"
          style="object-fit: cover; border-radius: 4px"
        />
        <div class="tag-asset-meta">
          <div class="tag-asset-title">{{ placementMaterial.title || '-' }}</div>
          <div class="tag-asset-sub">
            {{ $t('templateAsset.placementCountCol') }}: {{ placements.length }}
          </div>
        </div>
      </div>

      <!-- 新增投放位 -->
      <div class="placement-add">
        <a-space wrap>
          <a-select
            v-model:value="placementAddForm.moduleCode"
            :options="moduleOptions"
            :placeholder="$t('templateAsset.moduleCodePlaceholder')"
            :loading="moduleLoading"
            show-search
            option-filter-prop="label"
            style="width: 200px"
            @change="onPlacementModuleChange"
          />
          <a-auto-complete
            v-model:value="placementAddForm.slotCode"
            :options="placementSlotOptions"
            :placeholder="$t('templateAsset.slotCodePlaceholder')"
            :filter-option="filterSlotOption"
            style="width: 150px"
          />
          <a-input-number
            v-model:value="placementAddForm.sortOrder"
            :min="0"
            :placeholder="$t('templateAsset.sortOrder')"
            style="width: 90px"
          />
          <a-switch
            v-model:checked="placementAddForm.status"
            :checked-value="1"
            :un-checked-value="0"
          />
          <a-button
            v-permission="'template_filter:edit'"
            type="primary"
            :loading="placementAddLoading"
            @click="handleAddPlacement"
          >
            {{ $t('templateAsset.addPlacement') }}
          </a-button>
        </a-space>
      </div>

      <a-divider style="margin: 16px 0" />

      <a-spin :spinning="placementLoading">
        <a-empty
          v-if="!placementLoading && placements.length === 0"
          :description="$t('templateAsset.noPlacement')"
        />
        <div v-for="p in placements" :key="p.id" class="placement-row">
          <a-select
            v-model:value="p.moduleCode"
            :options="moduleOptions"
            show-search
            option-filter-prop="label"
            style="width: 190px"
          />
          <a-auto-complete
            v-model:value="p.slotCode"
            :options="placementSlotOptions"
            :filter-option="filterSlotOption"
            style="width: 140px"
          />
          <a-input-number v-model:value="p.sortOrder" :min="0" style="width: 80px" />
          <a-switch v-model:checked="p.status" :checked-value="1" :un-checked-value="0" />
          <a-button
            v-permission="'template_filter:edit'"
            type="link"
            size="small"
            @click="handleSavePlacement(p)"
          >
            {{ $t('common.save') }}
          </a-button>
          <a-popconfirm
            v-permission="'template_filter:delete'"
            :title="$t('templateAsset.confirmDeletePlacement')"
            @confirm="handleDeletePlacement(p)"
          >
            <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
          </a-popconfirm>
        </div>
      </a-spin>
    </a-drawer>

    <!-- 打标抽屉 -->
    <a-drawer
      v-model:open="tagDrawerVisible"
      :title="$t('templateAsset.tagDrawerTitle')"
      :size="480"
      :styles="{ body: { paddingBottom: '80px' } }"
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
            <div class="tag-asset-sub">{{ tagAsset.url }}</div>
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
      :size="480"
      :styles="{ body: { paddingBottom: '80px' } }"
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
  getTemplateMaterialList,
  createTemplateMaterial,
  updateTemplateMaterial,
  deleteTemplateMaterial,
  getPlacements,
  addPlacement,
  updatePlacement,
  deletePlacement,
  getAssetTags,
  setAssetTags,
  batchTagAssets,
  getTemplateFilterMeta,
  type TemplateMaterial,
  type TemplatePlacement,
  type TemplateAssetType,
  type TemplateFilterMeta,
} from '@/api/template-asset'
import { getModuleCodes, getSlotCodes } from '@/api/template-filter'

const { t } = useI18n()

const assetTableRef = ref<InstanceType<typeof ProTable> | null>(null)

// 业务类型下拉（当前仅电商域）
const bizTypeOptions = [{ label: 'ecommerce', value: 'ecommerce' }]

// 创作模块下拉（来自计费 Offer）
const moduleOptions = ref<{ label: string; value: string }[]>([])
const moduleLoading = ref(false)
async function loadModuleOptions() {
  moduleLoading.value = true
  try {
    const res = await getModuleCodes()
    moduleOptions.value = (res || []).map((m) => ({
      label: `${m.moduleName} (${m.moduleCode})`,
      value: m.moduleCode,
    }))
  } catch (error) {
    console.error('Failed to load module options:', error)
    moduleOptions.value = []
  } finally {
    moduleLoading.value = false
  }
}
loadModuleOptions()

// auto-complete 联想过滤（按输入文本匹配候选 value）
function filterSlotOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase())
}

// 已打标签列：每行最多展示的标签数
const MAX_TAGS_PER_ROW = 4
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

// ---- 物料列表 ----
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
    search: true,
    searchType: 'input' as const,
    ellipsis: true,
    width: 180,
  },
  {
    title: t('templateAsset.type'),
    dataIndex: 'type',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('templateAsset.typeImage'), value: 'image' },
      { label: t('templateAsset.typeVideo'), value: 'video' },
    ],
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('templateAsset.url'),
    dataIndex: 'url',
    ellipsis: true,
    width: 220,
  },
  {
    title: t('templateAsset.placementCountCol'),
    dataIndex: 'placementCount',
    key: 'placementCount',
    width: 150,
    align: 'center' as const,
  },
  {
    title: t('templateAsset.taggedColumn'),
    dataIndex: 'tagged',
    key: 'tagged',
    width: 220,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 180,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

// 当前列表查询条件（供打标取元数据复用）
const currentQuery = reactive({
  bizType: 'ecommerce' as string,
})

// 已打标签：materialId -> [{optionId, label, color}]
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

// 构建/刷新 optionId 字典（按业务域取全量维度）
async function ensureOptionDict() {
  try {
    const meta = await getTemplateFilterMeta({ bizType: currentQuery.bizType })
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

// 批量加载当前页物料的已打标签（键=materialId）
async function loadTaggedForAssets(materials: TemplateMaterial[]) {
  Object.keys(taggedMap).forEach((k) => delete taggedMap[Number(k)])
  if (materials.length === 0) return
  taggedLoading.value = true
  try {
    await ensureOptionDict()
    const results = await Promise.all(
      materials.map((m) =>
        getAssetTags(m.id)
          .then((tags) => ({ id: m.id, tags: tags || [] }))
          .catch(() => ({ id: m.id, tags: [] })),
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
  const res = await getTemplateMaterialList({
    bizType: currentQuery.bizType,
    keyword: (params.title as string) || undefined,
    type: params.type as TemplateAssetType | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  const list = res.list || []
  // 异步加载本页物料已打标签（不阻塞表格渲染）
  loadTaggedForAssets(list)
  return {
    data: list,
    total: res.total || 0,
    success: true,
  }
}

// ---- 物料 CRUD ----
const assetModalVisible = ref(false)
const assetSubmitLoading = ref(false)
const isAssetEdit = ref(false)
const editMaterialId = ref<number | null>(null)

const assetForm = reactive({
  bizType: 'ecommerce',
  type: 'image' as TemplateAssetType,
  title: '',
  url: '',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  extra: '',
})

function resetAssetForm() {
  assetForm.bizType = 'ecommerce'
  assetForm.type = 'image'
  assetForm.title = ''
  assetForm.url = ''
  assetForm.width = undefined
  assetForm.height = undefined
  assetForm.extra = ''
}

function handleCreateAsset() {
  isAssetEdit.value = false
  editMaterialId.value = null
  resetAssetForm()
  assetModalVisible.value = true
}

function handleEditAsset(record: TemplateMaterial) {
  isAssetEdit.value = true
  editMaterialId.value = record.id
  assetForm.bizType = record.bizType
  assetForm.type = record.type
  assetForm.title = record.title
  assetForm.url = record.url
  assetForm.width = record.width
  assetForm.height = record.height
  assetForm.extra = record.extra ?? ''
  assetModalVisible.value = true
}

async function handleAssetSubmit() {
  if (!assetForm.url) {
    message.warning(t('templateAsset.urlPlaceholder'))
    return
  }
  assetSubmitLoading.value = true
  try {
    if (isAssetEdit.value && editMaterialId.value != null) {
      await updateTemplateMaterial(editMaterialId.value, { ...assetForm })
      message.success(t('common.updateSuccess'))
      assetModalVisible.value = false
      assetTableRef.value?.refresh()
    } else {
      const newId = await createTemplateMaterial({ ...assetForm })
      message.success(t('common.createSuccess'))
      assetModalVisible.value = false
      assetTableRef.value?.refresh()
      // 新建物料后直接引导去添加投放位
      if (typeof newId === 'number') {
        handleOpenPlacements({ ...assetForm, id: newId, placementCount: 0 } as TemplateMaterial)
      }
    }
  } catch (error) {
    console.error('Failed to save material:', error)
  } finally {
    assetSubmitLoading.value = false
  }
}

async function handleDeleteAsset(record: TemplateMaterial) {
  try {
    await deleteTemplateMaterial(record.id)
    message.success(t('common.deleteSuccess'))
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to delete material:', error)
  }
}

// ---- 投放位管理抽屉 ----
const placementDrawerVisible = ref(false)
const placementLoading = ref(false)
const placementAddLoading = ref(false)
const placementMaterial = ref<TemplateMaterial | null>(null)
const placements = ref<TemplatePlacement[]>([])
const placementSlotOptions = ref<{ label: string; value: string }[]>([])
const placementAddForm = reactive({
  moduleCode: undefined as string | undefined,
  slotCode: '' as string,
  sortOrder: 0,
  status: 1,
})

async function loadPlacementSlotOptions(moduleCode?: string) {
  try {
    const res = await getSlotCodes({
      bizType: placementMaterial.value?.bizType || 'ecommerce',
      moduleCode: moduleCode || undefined,
    })
    placementSlotOptions.value = (res || []).map((c) => ({ label: c, value: c }))
  } catch (error) {
    console.error('Failed to load slot options:', error)
    placementSlotOptions.value = []
  }
}

function onPlacementModuleChange() {
  loadPlacementSlotOptions(placementAddForm.moduleCode)
}

async function loadPlacements(materialId: number) {
  placementLoading.value = true
  try {
    const res = await getPlacements(materialId)
    placements.value = (res || []).map((p) => ({ ...p }))
  } catch (error) {
    console.error('Failed to load placements:', error)
    placements.value = []
  } finally {
    placementLoading.value = false
  }
}

async function handleOpenPlacements(record: TemplateMaterial) {
  placementMaterial.value = record
  placementDrawerVisible.value = true
  placementAddForm.moduleCode = undefined
  placementAddForm.slotCode = ''
  placementAddForm.sortOrder = 0
  placementAddForm.status = 1
  placements.value = []
  placementSlotOptions.value = []
  loadPlacementSlotOptions()
  await loadPlacements(record.id)
}

async function handleAddPlacement() {
  if (!placementMaterial.value) return
  if (!placementAddForm.moduleCode) {
    message.warning(t('templateAsset.moduleCodePlaceholder'))
    return
  }
  placementAddLoading.value = true
  try {
    await addPlacement(placementMaterial.value.id, {
      moduleCode: placementAddForm.moduleCode,
      slotCode: placementAddForm.slotCode || '',
      sortOrder: placementAddForm.sortOrder,
      status: placementAddForm.status,
    })
    message.success(t('templateAsset.addPlacementSuccess'))
    placementAddForm.slotCode = ''
    await loadPlacements(placementMaterial.value.id)
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to add placement:', error)
  } finally {
    placementAddLoading.value = false
  }
}

async function handleSavePlacement(p: TemplatePlacement) {
  try {
    await updatePlacement(p.id, {
      moduleCode: p.moduleCode,
      slotCode: p.slotCode || '',
      sortOrder: p.sortOrder,
      status: p.status,
    })
    message.success(t('common.updateSuccess'))
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to save placement:', error)
  }
}

async function handleDeletePlacement(p: TemplatePlacement) {
  if (!placementMaterial.value) return
  try {
    await deletePlacement(p.id)
    message.success(t('common.deleteSuccess'))
    await loadPlacements(placementMaterial.value.id)
    assetTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to delete placement:', error)
  }
}

// ---- 打标抽屉 ----
const tagDrawerVisible = ref(false)
const tagLoading = ref(false)
const tagSubmitLoading = ref(false)
const tagAsset = ref<TemplateMaterial | null>(null)
const filterMetaList = ref<TemplateFilterMeta[]>([])
const multiSelections = reactive<Record<number, number[]>>({})
const singleSelections = reactive<Record<number, number | null>>({})

function clearTagSelections() {
  Object.keys(multiSelections).forEach((k) => delete multiSelections[Number(k)])
  Object.keys(singleSelections).forEach((k) => delete singleSelections[Number(k)])
}

async function handleOpenTagDrawer(record: TemplateMaterial) {
  tagAsset.value = record
  tagDrawerVisible.value = true
  tagLoading.value = true
  filterMetaList.value = []
  clearTagSelections()
  try {
    const [meta, tags] = await Promise.all([
      getTemplateFilterMeta({ bizType: record.bizType }),
      getAssetTags(record.id),
    ])
    filterMetaList.value = meta || []
    const selectedOptionIds = new Set((tags || []).map((tg) => tg.optionId))
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
    const meta = await getTemplateFilterMeta({ bizType: currentQuery.bizType })
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
    // 选中行即物料，直接按物料ID批量打标
    const materialIds = [...selectedRowKeys.value]
    await batchTagAssets(materialIds, optionIds)
    message.success(t('templateAsset.batchTagSuccess', { count: materialIds.length }))
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
  overflow: hidden;
}

.tag-asset-title {
  font-weight: 500;
}

.tag-asset-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  word-break: break-all;
}

.placement-add {
  padding: 8px 0;
}

.placement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f0f0;
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
  background: var(--color-bg-container);
  border-top: 1px solid var(--color-border-secondary);
}

.tagged-empty {
  color: var(--color-text-tertiary);
  font-size: 12px;
}
</style>
