<template>
  <div class="page-container">
    <a-card :title="$t('displayAsset.listTitle')" variant="borderless">
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 16px"
        :message="$t('displayAsset.pageHint')"
      />
      <ProTable
        ref="tableRef"
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
        :scroll="{ x: 1300 }"
      >
        <template #emptyText>
          <a-empty :description="$t('displayAsset.noData')" />
        </template>
        <template #toolbar>
          <a-button v-permission="'display_asset:create'" type="primary" @click="openCreate">
            {{ $t('displayAsset.createAsset') }}
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
                {{ $t('displayAsset.videoLink') }}
              </a-tag>
            </a>
            <span v-else>-</span>
          </template>

          <template v-if="column.dataIndex === 'categoryL1Id'">
            <template v-if="record.categoryL1Id">
              <a-tag color="blue">{{ categoryName(record.categoryL1Id) }}</a-tag>
              <a-tag v-if="record.categoryL2Id" color="cyan">
                {{ categoryName(record.categoryL2Id) }}
              </a-tag>
            </template>
            <span v-else class="muted">{{ $t('displayAsset.noDefaultSlot') }}</span>
          </template>

          <template v-if="column.dataIndex === 'type'">
            <a-tag :color="record.type === 'image' ? 'blue' : 'purple'">
              {{
                record.type === 'image'
                  ? $t('displayAsset.typeImage')
                  : $t('displayAsset.typeVideo')
              }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'sameStyle'">
            <a-tooltip v-if="record.sourceTaskId" :title="$t('displayAsset.derivedTip')">
              <a-button type="link" size="small" @click="openSameStyle(record)">
                <a-tag color="blue">{{ $t('displayAsset.sameStyleDerived') }}</a-tag>
              </a-button>
            </a-tooltip>
            <a-button v-else type="link" size="small" @click="openSameStyle(record)">
              <a-tag :color="record.sameStyle ? 'green' : 'red'">
                {{
                  record.sameStyle
                    ? $t('displayAsset.sameStyleOn')
                    : $t('displayAsset.sameStyleOff')
                }}
              </a-tag>
            </a-button>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-tooltip
                v-if="record.status !== DISPLAY_ASSET_STATUS.PUBLISHED && !record.sameStyle"
                v-permission="'display_asset:edit'"
                :title="$t('displayAsset.publishBlockedNoRecipe')"
              >
                <a-button type="link" size="small" disabled>
                  {{ $t('displayAsset.publish') }}
                </a-button>
              </a-tooltip>
              <a-button
                v-else-if="record.status !== DISPLAY_ASSET_STATUS.PUBLISHED"
                v-permission="'display_asset:edit'"
                type="link"
                size="small"
                :loading="statusLoadingId === record.id"
                @click="handlePublish(record)"
              >
                {{ $t('displayAsset.publish') }}
              </a-button>
              <a-popconfirm
                v-else
                v-permission="'display_asset:edit'"
                :title="$t('displayAsset.confirmOffline')"
                @confirm="handleOffline(record)"
              >
                <a-button type="link" size="small" :loading="statusLoadingId === record.id">
                  {{ $t('displayAsset.offline') }}
                </a-button>
              </a-popconfirm>
              <a-button
                v-permission="'display_asset:edit'"
                type="link"
                size="small"
                @click="openSameStyle(record)"
              >
                {{ $t('displayAsset.configSameStyle') }}
              </a-button>
              <a-button
                v-permission="'display_asset:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <a-popconfirm
                v-permission="'display_asset:delete'"
                :title="$t('displayAsset.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>

    <!-- 素材 新增/编辑 -->
    <a-modal
      v-model:open="assetModalVisible"
      :title="editId ? $t('displayAsset.editAsset') : $t('displayAsset.createAsset')"
      :confirm-loading="assetSubmitLoading"
      width="640px"
      @ok="handleAssetSubmit"
    >
      <a-form :model="assetForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('displayAsset.categoryL1')">
          <a-select
            v-model:value="assetForm.categoryL1Id"
            :options="l1Options"
            :loading="categoryLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="$t('displayAsset.categoryPlaceholder')"
            @change="onAssetL1Change"
          />
          <div class="muted">{{ $t('displayAsset.defaultSlotHint') }}</div>
        </a-form-item>
        <a-form-item v-if="assetForm.categoryL1Id" :label="$t('displayAsset.categoryL2')">
          <a-select
            v-model:value="assetForm.categoryL2Id"
            :options="assetL2Options"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="$t('displayAsset.categoryL2Placeholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('displayAsset.sourceTask')">
          <a-input-number
            v-model:value="assetForm.sourceTaskId"
            :min="1"
            style="width: 100%"
            :placeholder="$t('displayAsset.sourceTaskPlaceholder')"
          />
          <div class="muted">{{ $t('displayAsset.sourceTaskHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('displayAsset.type')">
          <a-select v-model:value="assetForm.type" :options="typeOptions" />
        </a-form-item>
        <a-form-item :label="$t('displayAsset.title')">
          <a-input
            v-model:value="assetForm.title"
            :placeholder="$t('displayAsset.titlePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('displayAsset.url')" required>
          <a-input v-model:value="assetForm.url" :placeholder="$t('displayAsset.urlPlaceholder')" />
        </a-form-item>
        <a-form-item
          v-if="assetForm.type === 'image' && assetForm.url"
          :label="$t('displayAsset.preview')"
        >
          <a-image :src="assetForm.url" :width="120" />
        </a-form-item>
        <a-form-item :label="$t('displayAsset.size')">
          <a-space>
            <a-input-number
              v-model:value="assetForm.width"
              :min="0"
              :placeholder="$t('displayAsset.width')"
            />
            <span>x</span>
            <a-input-number
              v-model:value="assetForm.height"
              :min="0"
              :placeholder="$t('displayAsset.height')"
            />
          </a-space>
          <div class="muted">{{ $t('displayAsset.sizeHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('displayAsset.sortOrder')">
          <a-input-number v-model:value="assetForm.sortOrder" :min="0" style="width: 100%" />
          <div class="muted">{{ $t('displayAsset.sortOrderHint') }}</div>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="editId"
        type="info"
        show-icon
        :message="$t('displayAsset.extraKeptHint')"
        style="margin-top: 4px"
      />
    </a-modal>

    <!-- 做同款配方 -->
    <a-drawer
      v-model:open="sameStyleDrawerVisible"
      :title="$t('displayAsset.sameStyleDrawerTitle')"
      :size="720"
      :styles="{ body: { paddingBottom: '80px' } }"
    >
      <div v-if="sameStyleAsset" class="ss-head">
        <a-image
          v-if="sameStyleAsset.type === 'image' && sameStyleAsset.url"
          :src="sameStyleAsset.url"
          :width="72"
          :height="72"
          style="object-fit: cover; border-radius: 4px"
        />
        <div class="ss-meta">
          <div class="ss-title">{{ sameStyleAsset.title || '-' }}</div>
          <div class="muted">ID {{ sameStyleAsset.id }} · {{ sameStyleAsset.url }}</div>
        </div>
      </div>

      <a-alert
        type="info"
        show-icon
        style="margin: 12px 0"
        :message="$t('displayAsset.sameStyleHint')"
      />

      <a-form :model="ssForm" layout="vertical">
        <a-form-item :label="$t('displayAsset.ssEnabled')">
          <a-switch
            v-model:checked="ssForm.enabled"
            :checked-children="$t('displayAsset.ssEnabledOn')"
            :un-checked-children="$t('displayAsset.ssEnabledOff')"
          />
        </a-form-item>

        <a-form-item :label="$t('displayAsset.ssEntryCode')" required>
          <a-select
            v-model:value="ssForm.entryCode"
            :options="entryCodeOptions"
            :loading="entryCodeLoading"
            show-search
            option-filter-prop="label"
            :placeholder="$t('displayAsset.ssEntryCodePlaceholder')"
          />
          <div class="muted">{{ $t('displayAsset.ssEntryCodeHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('displayAsset.ssModel')" required>
          <a-select
            v-model:value="ssForm.modelCode"
            :options="modelOptions"
            :loading="modelLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="$t('displayAsset.ssModelPlaceholder')"
            @change="onModelChange"
          />
          <div class="muted">{{ $t('displayAsset.ssModelHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('displayAsset.ssPrompt')">
          <a-textarea
            v-model:value="ssForm.prompt"
            :rows="4"
            :placeholder="$t('displayAsset.ssPromptPlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('displayAsset.ssParams')">
          <a-textarea
            v-model:value="ssParamsText"
            :rows="4"
            placeholder='{"size":"3:4"}'
            :status="ssParamsInvalid ? 'error' : undefined"
          />
          <div :class="ssParamsInvalid ? 'error-text' : 'muted'">
            {{
              ssParamsInvalid ? $t('displayAsset.ssParamsInvalid') : $t('displayAsset.ssParamsHint')
            }}
          </div>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('displayAsset.ssRequiredImages')">
              <a-input-number
                v-model:value="ssForm.requiredImages"
                :min="0"
                :max="10"
                style="width: 100%"
              />
              <div class="muted">{{ $t('displayAsset.ssRequiredImagesHint') }}</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('displayAsset.ssEditableFields')">
              <a-select
                v-model:value="ssForm.editableFields"
                mode="tags"
                :token-separators="[',']"
                style="width: 100%"
                :placeholder="$t('displayAsset.ssEditableFieldsPlaceholder')"
              />
              <div class="muted">{{ $t('displayAsset.ssEditableFieldsHint') }}</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item :label="$t('displayAsset.ssTips')">
          <a-input
            v-model:value="ssForm.tips"
            :placeholder="$t('displayAsset.ssTipsPlaceholder')"
          />
        </a-form-item>
      </a-form>

      <div class="drawer-footer">
        <a-space>
          <a-popconfirm
            v-if="ssHasRecipe"
            :title="$t('displayAsset.confirmRemoveSameStyle')"
            @confirm="handleRemoveSameStyle"
          >
            <a-button danger :loading="ssRemoving">{{
              $t('displayAsset.removeSameStyle')
            }}</a-button>
          </a-popconfirm>
          <a-button @click="sameStyleDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button
            v-permission="'display_asset:edit'"
            type="primary"
            :loading="ssSaving"
            @click="handleSaveSameStyle"
          >
            {{ $t('common.save') }}
          </a-button>
        </a-space>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { PlayCircleOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getDisplayAssetList,
  getDisplayAsset,
  createDisplayAsset,
  updateDisplayAsset,
  publishDisplayAsset,
  offlineDisplayAsset,
  DISPLAY_ASSET_STATUS,
  deleteDisplayAsset,
  saveSameStyle,
  removeSameStyle,
  getDisplayEntryCodes,
  type DisplayAsset,
  type DisplayAssetType,
  type SameStyleRecipe,
} from '@/api/display-asset'
import { getCategoryTree, type DisplayCategoryNode } from '@/api/display-category'
import { getModelOptions } from '@/api/model'
import ProTable from '@/components/Pro/ProTable/index.vue'

const { t } = useI18n()
const tableRef = ref<InstanceType<typeof ProTable> | null>(null)

const typeOptions = [
  { label: t('displayAsset.typeImage'), value: 'image' },
  { label: t('displayAsset.typeVideo'), value: 'video' },
]

// ---- 下拉数据源 ----
const tree = ref<DisplayCategoryNode[]>([])
const categoryNameMap = reactive<Record<number, string>>({})
const categoryLoading = ref(false)

async function loadCategories() {
  categoryLoading.value = true
  try {
    tree.value = (await getCategoryTree(false)) || []
    for (const l1 of tree.value) {
      categoryNameMap[l1.id] = l1.categoryName
      for (const l2 of l1.children ?? []) categoryNameMap[l2.id] = l2.categoryName
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    categoryLoading.value = false
  }
}
loadCategories()

function categoryName(id: number) {
  return categoryNameMap[id] ?? String(id)
}

const l1Options = computed(() =>
  tree.value.map((c) => ({ label: `${c.categoryName} (${c.categoryCode})`, value: c.id })),
)
function l2OptionsOf(l1Id?: number) {
  const l1 = l1Id ? tree.value.find((c) => c.id === l1Id) : undefined
  return (l1?.children ?? []).map((c) => ({ label: c.categoryName, value: c.id }))
}

/** 三态：0 草稿 / 1 已发布 / 2 已下架。缺项会让列表显示裸数字 */
const STATUS = {
  0: { label: () => t('displayAsset.statusDraft'), color: 'default' },
  1: { label: () => t('displayAsset.statusPublished'), color: 'green' },
  2: { label: () => t('displayAsset.statusOffline'), color: 'orange' },
} as Record<number, { label: () => string; color: string }>
function statusLabel(v: number) {
  return STATUS[v]?.label() ?? String(v)
}
function statusColor(v: number) {
  return STATUS[v]?.color ?? 'default'
}

const entryCodeOptions = ref<{ label: string; value: string }[]>([])
const entryCodeLoading = ref(false)
async function loadEntryCodes() {
  entryCodeLoading.value = true
  try {
    const res = await getDisplayEntryCodes()
    entryCodeOptions.value = (res || []).map((e) => ({
      label: `${e.entryName} (${e.entryCode})`,
      value: e.entryCode,
    }))
  } catch {
    /* 拦截器已提示 */
  } finally {
    entryCodeLoading.value = false
  }
}

// modelCode → modelId：后端本地模型提交必须带 modelId，这里选完就带上，省得后端再反查
const modelIdByCode = reactive<Record<string, number>>({})
const modelOptions = ref<{ label: string; value: string }[]>([])
const modelLoading = ref(false)
async function loadModels() {
  modelLoading.value = true
  try {
    const res = await getModelOptions()
    modelOptions.value = (res || [])
      .filter((m) => m.status === 1)
      .map((m) => {
        modelIdByCode[m.code] = m.id
        return { label: `${m.name} (${m.code})`, value: m.code }
      })
  } catch {
    /* 拦截器已提示 */
  } finally {
    modelLoading.value = false
  }
}

// ---- 列表 ----
// computed：分类下拉是异步拉的，列定义写死数组会把 searchOptions 冻结在空数组上
const columns = computed(() => [
  {
    title: t('displayAsset.preview'),
    dataIndex: 'preview',
    key: 'preview',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('displayAsset.title'),
    dataIndex: 'title',
    search: true,
    searchType: 'input' as const,
    ellipsis: true,
    width: 180,
  },
  {
    title: t('displayAsset.category'),
    dataIndex: 'categoryL1Id',
    search: true,
    searchType: 'select' as const,
    searchOptions: l1Options.value,
    width: 180,
  },
  {
    title: t('displayAsset.type'),
    dataIndex: 'type',
    search: true,
    searchType: 'select' as const,
    searchOptions: typeOptions,
    width: 90,
    align: 'center' as const,
  },
  { title: t('displayAsset.url'), dataIndex: 'url', ellipsis: true, width: 220 },
  {
    title: t('displayAsset.sameStyleCol'),
    dataIndex: 'sameStyle',
    key: 'sameStyle',
    width: 130,
    align: 'center' as const,
  },
  {
    title: t('displayAsset.sortOrder'),
    dataIndex: 'sortOrder',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('displayAsset.status'),
    dataIndex: 'status',
    key: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: Object.entries(STATUS).map(([value, cfg]) => ({
      label: cfg.label(),
      value: Number(value),
    })),
    width: 100,
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
])

async function loadData(params: Record<string, unknown>) {
  const res = await getDisplayAssetList({
    keyword: (params.title as string) || undefined,
    categoryL1Id: (params.categoryL1Id as number) ?? undefined,
    type: params.type as DisplayAssetType | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

// ---- 素材 CRUD ----
const assetModalVisible = ref(false)
const assetSubmitLoading = ref(false)
const editId = ref<number | null>(null)

const assetForm = reactive({
  categoryL1Id: undefined as number | undefined,
  categoryL2Id: undefined as number | undefined,
  sourceTaskId: undefined as number | undefined,
  type: 'image' as DisplayAssetType,
  title: '',
  url: '',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  sortOrder: 0,
})
const assetL2Options = computed(() => l2OptionsOf(assetForm.categoryL1Id))
/** 换一级后旧二级不再属于它 */
function onAssetL1Change() {
  assetForm.categoryL2Id = undefined
}

function resetAssetForm() {
  Object.assign(assetForm, {
    categoryL1Id: undefined,
    categoryL2Id: undefined,
    sourceTaskId: undefined,
    type: 'image' as DisplayAssetType,
    title: '',
    url: '',
    width: undefined,
    height: undefined,
    sortOrder: 0,
  })
}

function openCreate() {
  editId.value = null
  resetAssetForm()
  assetModalVisible.value = true
}

function openEdit(record: DisplayAsset) {
  editId.value = record.id
  Object.assign(assetForm, {
    categoryL1Id: record.categoryL1Id || undefined,
    categoryL2Id: record.categoryL2Id || undefined,
    sourceTaskId: record.sourceTaskId ?? undefined,
    type: record.type,
    title: record.title || '',
    url: record.url,
    width: record.width,
    height: record.height,
    sortOrder: record.sortOrder ?? 0,
  })
  assetModalVisible.value = true
}

async function handleAssetSubmit() {
  if (!assetForm.url?.trim()) {
    message.warning(t('displayAsset.urlRequired'))
    return
  }
  assetSubmitLoading.value = true
  try {
    // 不传 extra：同款配方走专用接口维护，这里带上会把配方整段覆盖掉
    const payload = {
      ...assetForm,
      categoryL1Id: assetForm.categoryL1Id ?? 0,
      categoryL2Id: assetForm.categoryL2Id ?? 0,
      // 0 = 解除关联；传 undefined 会被后端当「不改」，运营就清不掉已填的来源
      sourceTaskId: assetForm.sourceTaskId ?? 0,
      url: assetForm.url.trim(),
    }
    if (editId.value) await updateDisplayAsset(editId.value, payload)
    else await createDisplayAsset(payload)
    message.success(t('common.saveSuccess'))
    assetModalVisible.value = false
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  } finally {
    assetSubmitLoading.value = false
  }
}

const statusLoadingId = ref<number | null>(null)

async function handlePublish(record: DisplayAsset) {
  statusLoadingId.value = record.id
  try {
    await publishDisplayAsset(record.id)
    // 配了默认推荐位的会顺带挂上推荐位，文案要说清楚，否则运营不知道已经对外可见了
    message.success(
      record.categoryL1Id
        ? t('displayAsset.publishedAndPinned')
        : t('displayAsset.publishedPending'),
    )
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  } finally {
    statusLoadingId.value = null
  }
}

async function handleOffline(record: DisplayAsset) {
  statusLoadingId.value = record.id
  try {
    await offlineDisplayAsset(record.id)
    message.success(t('displayAsset.offlineSuccess'))
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  } finally {
    statusLoadingId.value = null
  }
}

async function handleDelete(record: DisplayAsset) {
  try {
    await deleteDisplayAsset(record.id)
    message.success(t('common.deleteSuccess'))
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  }
}

// ---- 做同款配方 ----
const sameStyleDrawerVisible = ref(false)
const sameStyleAsset = ref<DisplayAsset | null>(null)
const ssSaving = ref(false)
const ssRemoving = ref(false)
// extra 里是否已存在配方。不能用列表那个 sameStyle 标志代替：停用的配方 sameStyle=false，
// 拿它控制「移除配方」按钮会让停用后的配方从 UI 上再也删不掉。
const ssHasRecipe = ref(false)
const ssParamsText = ref('')
const ssForm = reactive<SameStyleRecipe>({
  enabled: true,
  entryCode: '',
  modelCode: undefined,
  modelId: undefined,
  prompt: '',
  requiredImages: 0,
  editableFields: [],
  tips: '',
})

const ssParamsInvalid = computed(() => parseParams(ssParamsText.value) === undefined)

/** 解析参数 JSON：空串→{}；非法→undefined（供校验区分「没填」与「填错」） */
function parseParams(text: string): Record<string, unknown> | undefined {
  const s = text.trim()
  if (!s) return {}
  try {
    const obj = JSON.parse(s)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined
    return obj as Record<string, unknown>
  } catch {
    return undefined
  }
}

function onModelChange(code: string) {
  ssForm.modelId = code ? modelIdByCode[code] : undefined
}

async function openSameStyle(record: DisplayAsset) {
  sameStyleAsset.value = record
  // 下拉懒加载：列表页不必为了两个下拉先打两个接口
  if (!entryCodeOptions.value.length) loadEntryCodes()
  if (!modelOptions.value.length) loadModels()

  Object.assign(ssForm, {
    enabled: true,
    entryCode: '',
    modelCode: undefined,
    modelId: undefined,
    prompt: '',
    requiredImages: 0,
    editableFields: [],
    tips: '',
  })
  ssParamsText.value = ''
  ssHasRecipe.value = false
  sameStyleDrawerVisible.value = true

  // 按详情重取而不是用列表那行：列表可能已经放了一会儿，别拿旧 extra 覆盖别人刚改的配方
  try {
    const detail = await getDisplayAsset(record.id)
    sameStyleAsset.value = detail
    const recipe = readRecipe(detail.extra)
    if (recipe) {
      ssHasRecipe.value = true
      Object.assign(ssForm, {
        enabled: recipe.enabled !== false,
        entryCode: recipe.entryCode || '',
        modelCode: recipe.modelCode,
        modelId: recipe.modelId,
        prompt: recipe.prompt || '',
        requiredImages: recipe.requiredImages ?? 0,
        editableFields: recipe.editableFields || [],
        tips: recipe.tips || '',
      })
      ssParamsText.value = recipe.params ? JSON.stringify(recipe.params, null, 2) : ''
    }
  } catch {
    /* 拦截器已提示；抽屉保持空表单可新配 */
  }
}

/** 从 extra JSON 串里取 sameStyle 子键；脏数据一律当未配置，不弹错打断运营 */
function readRecipe(extra?: string): SameStyleRecipe | null {
  if (!extra?.trim()) return null
  try {
    const obj = JSON.parse(extra)
    return (obj?.sameStyle as SameStyleRecipe) || null
  } catch {
    return null
  }
}

async function handleSaveSameStyle() {
  if (!sameStyleAsset.value) return
  if (!ssForm.entryCode?.trim()) {
    message.warning(t('displayAsset.ssEntryCodeRequired'))
    return
  }
  if (!ssForm.modelCode && !ssForm.modelId) {
    message.warning(t('displayAsset.ssModelRequired'))
    return
  }
  const params = parseParams(ssParamsText.value)
  if (params === undefined) {
    message.error(t('displayAsset.ssParamsInvalid'))
    return
  }
  ssSaving.value = true
  try {
    await saveSameStyle(sameStyleAsset.value.id, { ...ssForm, params })
    message.success(t('displayAsset.ssSaveSuccess'))
    sameStyleDrawerVisible.value = false
    tableRef.value?.refresh()
  } catch {
    /* 后端会校验 entryCode/模型，失败原因由拦截器提示 */
  } finally {
    ssSaving.value = false
  }
}

async function handleRemoveSameStyle() {
  if (!sameStyleAsset.value) return
  ssRemoving.value = true
  try {
    await removeSameStyle(sameStyleAsset.value.id)
    message.success(t('displayAsset.ssRemoveSuccess'))
    sameStyleDrawerVisible.value = false
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  } finally {
    ssRemoving.value = false
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
.error-text {
  color: var(--color-error, #ff4d4f);
  font-size: 12px;
}
.ss-head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.ss-meta {
  min-width: 0;
}
.ss-title {
  font-weight: 500;
  margin-bottom: 4px;
}
.ss-meta .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12px 24px;
  text-align: right;
  background: var(--color-bg-container, #fff);
  border-top: 1px solid var(--color-border-secondary, #f0f0f0);
}
</style>
