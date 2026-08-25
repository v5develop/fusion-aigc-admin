<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('assetCategory.title') }}</h2>
      <a-button v-permission="'asset_category:create'" type="primary" @click="openCreate">
        {{ $t('assetCategory.add') }}
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('assetCategory.hint')"
    />

    <!--
      未归类告警。这是本页最要紧的控件：漏归类不会报错、不会有空白页，
      只会让那批素材在所有 tab 里静默消失，不主动喊出来没人会发现。
    -->
    <a-alert
      v-if="unclassifiedEntries.length"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('assetCategory.unclassifiedTitle', { count: unclassifiedEntries.length })"
    >
      <template #description>
        <div class="uc-desc">{{ $t('assetCategory.unclassifiedDesc') }}</div>
        <div class="uc-tags">
          <a-tag v-for="e in unclassifiedEntries" :key="e.entryCode" color="orange">
            {{ e.entryName }}
          </a-tag>
        </div>
        <a-button
          v-permission="'asset_category:create'"
          type="primary"
          size="small"
          class="uc-action"
          @click="openCreateForUnclassified"
        >
          {{ $t('assetCategory.unclassifiedAction') }}
        </a-button>
      </template>
    </a-alert>

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :custom-row="customRow"
      >
        <template #emptyText>
          <a-empty :description="$t('assetCategory.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'drag'">
            <span class="drag-handle">⋮⋮</span>
          </template>

          <template v-if="column.dataIndex === 'categoryCode'">
            <code class="cat-code">{{ record.categoryCode }}</code>
          </template>

          <template v-if="column.dataIndex === 'entries'">
            <template v-if="record.entries.length">
              <a-tag
                v-for="e in record.entries.slice(0, ENTRY_TAG_LIMIT)"
                :key="e.entryCode"
                color="blue"
              >
                {{ e.entryName }}
              </a-tag>
              <a-tooltip
                v-if="record.entries.length > ENTRY_TAG_LIMIT"
                :title="hiddenEntryNames(record)"
              >
                <a-tag>{{
                  $t('assetCategory.moreEntries', {
                    count: record.entries.length - ENTRY_TAG_LIMIT,
                  })
                }}</a-tag>
              </a-tooltip>
            </template>
            <a-tag v-else color="orange">{{ $t('assetCategory.noEntry') }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? $t('assetCategory.enabled') : $t('assetCategory.disabled') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'asset_category:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <a-popconfirm
                v-permission="'asset_category:delete'"
                :title="deleteConfirmText(record)"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('assetCategory.editTitle') : $t('assetCategory.add')"
      :confirm-loading="saving"
      width="640px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('assetCategory.code')" required>
          <!-- 编辑态锁死：用户端按 categoryCode 筛素材，改了等于换了个分类 -->
          <a-input
            v-model:value="form.categoryCode"
            :disabled="isEdit"
            :placeholder="$t('assetCategory.codePlaceholder')"
          />
          <div class="muted">{{ $t('assetCategory.codeHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('assetCategory.name')" required>
          <a-input
            v-model:value="form.categoryName"
            :placeholder="$t('assetCategory.namePlaceholder')"
          />
          <div class="muted">{{ $t('assetCategory.nameHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('assetCategory.entryCodes')">
          <a-select
            v-model:value="form.entryCodes"
            mode="multiple"
            :options="entrySelectOptions"
            option-filter-prop="label"
            :placeholder="$t('assetCategory.entryPlaceholder')"
          />
          <div class="muted">{{ $t('assetCategory.entryHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('assetCategory.sortOrder')">
          <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
          <div class="muted">{{ $t('assetCategory.sortOrderHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('assetCategory.status')">
          <a-switch
            v-model:checked="enabled"
            :checked-children="$t('assetCategory.enabled')"
            :un-checked-children="$t('assetCategory.disabled')"
          />
          <div class="muted">{{ $t('assetCategory.statusHint') }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getAssetCategories,
  getAssetCategoryEntryOptions,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory,
  reorderAssetCategories,
  type AssetCategory,
  type AssetCategoryEntryOption,
} from '@/api/asset-category'

const { t } = useI18n()

/** 列表里最多平铺几个入口标签，超出折叠成「还有 N 个」 */
const ENTRY_TAG_LIMIT = 6
/** 删除确认里最多点名几个入口，避免十几个名字把气泡撑爆 */
const DELETE_NAME_LIMIT = 5

const rows = ref<AssetCategory[]>([])
const loading = ref(false)

const entryOptions = ref<AssetCategoryEntryOption[]>([])
const unclassifiedCodes = ref<string[]>([])

const columns = computed(() => [
  { title: '', dataIndex: 'drag', key: 'drag', width: 40, align: 'center' as const },
  { title: t('assetCategory.code'), dataIndex: 'categoryCode', width: 180 },
  { title: t('assetCategory.name'), dataIndex: 'categoryName', width: 160 },
  { title: t('assetCategory.entries'), dataIndex: 'entries' },
  {
    title: t('assetCategory.sortOrder'),
    dataIndex: 'sortOrder',
    width: 80,
    align: 'center' as const,
  },
  { title: t('assetCategory.status'), dataIndex: 'status', width: 100, align: 'center' as const },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 140,
    align: 'center' as const,
  },
])

/** 未归类入口，补上展示名——运营认「AI试鞋」不认「shoeSwapping」 */
const unclassifiedEntries = computed(() => {
  const nameOf = new Map(entryOptions.value.map((o) => [o.entryCode, o.entryName]))
  return unclassifiedCodes.value.map((code) => ({
    entryCode: code,
    entryName: nameOf.get(code) || code,
  }))
})

function hiddenEntryNames(record: AssetCategory) {
  return record.entries
    .slice(ENTRY_TAG_LIMIT)
    .map((e) => e.entryName)
    .join('、')
}

function deleteConfirmText(record: AssetCategory) {
  if (!record.entries.length) return t('assetCategory.confirmDeleteEmpty')
  const shown = record.entries
    .slice(0, DELETE_NAME_LIMIT)
    .map((e) => e.entryName)
    .join('、')
  const names =
    record.entries.length > DELETE_NAME_LIMIT
      ? t('assetCategory.namesTruncated', { names: shown, count: record.entries.length })
      : shown
  return t('assetCategory.confirmDelete', { names })
}

async function loadList() {
  loading.value = true
  try {
    rows.value = (await getAssetCategories()) || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

async function loadEntryOptions() {
  try {
    const res = await getAssetCategoryEntryOptions()
    entryOptions.value = res?.options || []
    unclassifiedCodes.value = res?.unclassified || []
  } catch {
    /* 拦截器已提示 */
  }
}

/** 任何写操作都会改动归属，列表与候选项必须一起刷，否则下拉里的归属标注会过期 */
function loadAll() {
  loadList()
  loadEntryOptions()
}
loadAll()

// ---- 拖拽排序 ----
const dragIndex = ref<number | null>(null)

function customRow(_record: AssetCategory, index: number) {
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
  rows.value = next // 先本地生效，失败再回滚，免得拖完要等一个来回才动

  try {
    await reorderAssetCategories(next.map((r) => r.id))
    message.success(t('assetCategory.reorderSuccess'))
    loadList() // 拉回后端重写后的真实 sortOrder
  } catch {
    rows.value = before
  }
}

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const isEdit = computed(() => editId.value !== null)

const form = reactive({
  categoryCode: '',
  categoryName: '',
  sortOrder: 0,
  status: 1,
  entryCodes: [] as string[],
})
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

/**
 * 入口只能归属一个分类。被别的分类占着的项直接禁用并标出归属，
 * 后端本来就会拒重复归属，但让运营点了提交才知道太糟。
 * 归属当前编辑分类的那些不能禁——它们本来就该是选中态。
 */
const entrySelectOptions = computed(() =>
  entryOptions.value.map((o) => {
    const takenByOther = o.categoryId !== null && o.categoryId !== editId.value
    return {
      value: o.entryCode,
      label: takenByOther
        ? t('assetCategory.entryOptionTaken', {
            name: o.entryName,
            code: o.entryCode,
            category: o.categoryName || '',
          })
        : t('assetCategory.entryOption', { name: o.entryName, code: o.entryCode }),
      disabled: takenByOther,
    }
  }),
)

function openCreate() {
  editId.value = null
  Object.assign(form, {
    categoryCode: '',
    categoryName: '',
    sortOrder: 0,
    status: 1,
    entryCodes: [] as string[],
  })
  modalVisible.value = true
}

/** 从告警条一键收口：把未归类的入口全预选上，运营只补编码和名字 */
function openCreateForUnclassified() {
  openCreate()
  form.entryCodes = unclassifiedEntries.value.map((e) => e.entryCode)
}

function openEdit(record: AssetCategory) {
  editId.value = record.id
  Object.assign(form, {
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
    entryCodes: record.entries.map((e) => e.entryCode),
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.categoryCode?.trim()) {
    message.warning(t('assetCategory.codeRequired'))
    return
  }
  if (!form.categoryName?.trim()) {
    message.warning(t('assetCategory.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      categoryCode: form.categoryCode.trim(),
      categoryName: form.categoryName.trim(),
      sortOrder: form.sortOrder,
      status: form.status,
      entryCodes: form.entryCodes,
    }
    if (editId.value) await updateAssetCategory(editId.value, payload)
    else await createAssetCategory(payload)
    message.success(t('common.saveSuccess'))
    modalVisible.value = false
    loadAll()
  } catch {
    /* 编码重复 / 入口已被占用的报错由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: AssetCategory) {
  try {
    await deleteAssetCategory(record.id)
    message.success(t('common.deleteSuccess'))
    loadAll() // 被释放的入口要立刻出现在未归类告警里
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
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.uc-desc {
  margin-bottom: 8px;
  line-height: 1.7;
}
.uc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 0;
}
.uc-action {
  margin-top: 12px;
}
.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary, #999);
  letter-spacing: -2px;
  user-select: none;
}
.cat-code {
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary, #f5f5f5);
  color: var(--text-color, #262626);
  font-size: 12px;
}
</style>
