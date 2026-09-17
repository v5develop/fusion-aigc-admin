<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('assetCategory.title') }}</h2>
      <a-button v-permission="'asset_category:create'" type="primary" @click="openCreate(1, null)">
        {{ $t('assetCategory.addL1') }}
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
      <!--
        树形表格：数据本身就带 children，a-table 原生按它渲染二级行。
        展开箭头挪到第 1 列（分类名）——第 0 列是 40px 的拖拽把手，
        塞不下「缩进 + 箭头」，挤在那儿箭头会压到把手上。
      -->
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :expandable="{ expandIconColumnIndex: 1 }"
        :expanded-row-keys="expandedKeys"
        :on-row="rowAttrs"
        @update:expandedRowKeys="onExpandedChange"
      >
        <template #emptyText>
          <a-empty :description="$t('assetCategory.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'drag'">
            <span class="drag-handle">⋮⋮</span>
          </template>

          <template v-if="column.dataIndex === 'categoryName'">
            <span :class="record.level === 1 ? 'cat-l1' : 'cat-l2'">{{ record.categoryName }}</span>
            <code class="cat-code">{{ record.categoryCode }}</code>
          </template>

          <template v-if="column.dataIndex === 'mediaType'">
            <!-- mediaType 只有一级有意义，二级画个占位横线，免得看起来像「忘了配」 -->
            <a-tag v-if="record.level === 1 && record.mediaType" color="purple">
              {{ mediaTypeLabel(record.mediaType) }}
            </a-tag>
            <span v-else class="muted">{{ record.level === 1 ? $t('assetCategory.mediaTypeAll') : '—' }}</span>
          </template>

          <template v-if="column.dataIndex === 'entries'">
            <!-- 一级恒不挂入口（后端会拒），这里说明它的成员是二级之并，别让人以为漏配了 -->
            <template v-if="record.level === 1">
              <a-tag v-if="!record.children || !record.children.length" color="orange">
                {{ $t('assetCategory.l1NoChild') }}
              </a-tag>
              <span v-else class="muted">
                {{ $t('assetCategory.l1Entries', { count: record.children.length }) }}
              </span>
            </template>
            <template v-else-if="record.entries.length">
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
                v-if="record.level === 1"
                v-permission="'asset_category:create'"
                type="link"
                size="small"
                @click="openCreate(2, record.id)"
              >
                {{ $t('assetCategory.addChild') }}
              </a-button>
              <a-button
                v-permission="'asset_category:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                {{ $t('common.edit') }}
              </a-button>
              <!-- 有二级的一级后端会拒删（删了那些二级会挂在不存在的父级下、整棵消失）。
                   与其弹一个点了必定报错的确认框，不如直接禁用并说明该先做什么 -->
              <a-tooltip v-if="hasChildren(record)" :title="$t('assetCategory.deleteL1Blocked')">
                <a-button type="link" size="small" danger disabled>
                  {{ $t('common.delete') }}
                </a-button>
              </a-tooltip>
              <a-popconfirm
                v-else
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
      :title="modalTitle"
      :confirm-loading="saving"
      width="900px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('assetCategory.level')">
          <!--
            层级只读：新增时由入口决定（顶部按钮=一级、行内「新增二级」=二级），
            编辑时更不能改——后端只按 parentId 推层级，这里改了也不生效，
            摆成可选项就是在骗人。
          -->
          <a-radio-group :value="form.level" disabled button-style="solid">
            <a-radio-button :value="1">{{ $t('assetCategory.l1') }}</a-radio-button>
            <a-radio-button :value="2">{{ $t('assetCategory.l2') }}</a-radio-button>
          </a-radio-group>
          <div class="muted">{{ $t('assetCategory.levelHint') }}</div>
        </a-form-item>

        <a-form-item v-if="form.level === 2" :label="$t('assetCategory.parent')" required>
          <!-- 编辑态锁死父级：换父级等于把这个二级连同其成员搬到另一个 tab 下，该走删了重建 -->
          <a-select
            v-model:value="form.parentId"
            :options="l1Options"
            :disabled="isEdit"
            show-search
            option-filter-prop="label"
            :placeholder="$t('assetCategory.parentPlaceholder')"
          />
          <div class="muted">{{ $t('assetCategory.parentHint') }}</div>
        </a-form-item>

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

        <!-- mediaType 只在一级出现：二级填了后端也不认，摆出来纯粹是困惑源 -->
        <a-form-item v-if="form.level === 1" :label="$t('assetCategory.mediaType')">
          <a-select v-model:value="form.mediaType" :options="mediaTypeOptions" />
          <div class="muted">{{ $t('assetCategory.mediaTypeHint') }}</div>
        </a-form-item>

        <!-- 入口只能挂二级：一级带 entryCodes 提交会被后端拒 -->
        <a-form-item v-if="form.level === 2" :label="$t('assetCategory.entryCodes')">
          <!--
            用穿梭框而不是多选下拉：一个二级动辄挂十来个入口，堆在下拉里就是一大片 tag
            把表单挤变形，而且只看得见「已选了什么」，看不出「还剩哪些没归」——
            后者才是运营在这页要判断的事。左右分栏两边都摊开，也方便批量搬。
            styles.section 而不是 listStyle：后者在 antdv-next 1.1.8 已标记废弃
            （内部就是转写到 styles.section），继续用只会在控制台刷一条 deprecated 警告。
          -->
          <a-transfer
            v-model:target-keys="form.entryCodes"
            class="entry-transfer"
            :data-source="entryTransferData"
            :titles="[
              $t('assetCategory.transferAvailable'),
              $t('assetCategory.transferSelected'),
            ]"
            :locale="transferLocale"
            :filter-option="filterEntry"
            :styles="{ section: { width: '250px', height: '300px' } }"
            show-search
          >
            <!-- 其它归属只作为浅色小字提示，不参与筛选也不拦截，见 entryTransferData 注释 -->
            <template #render="item">
              <div class="entry-item">
                <span>{{ item.title }}</span>
                <span v-if="item.alsoIn" class="entry-also">{{ item.alsoIn }}</span>
              </div>
            </template>
          </a-transfer>
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

/**
 * 表格行。children 是**可选**的，而接口里它恒存在（二级是空数组）——
 * a-table 判断「这行能不能展开」用的是 `record.children` 是否 truthy，
 * 空数组也是 truthy，二级行会长出一个点开什么都没有的展开箭头。
 * 所以 normalize 时没有子级就把这个键整个删掉，见 toRow()。
 */
type CategoryRow = Omit<AssetCategory, 'children'> & { children?: CategoryRow[] }

/** 后端原样返回的树，写操作与拖拽都以它为准；rows 只是渲染用的投影 */
const tree = ref<AssetCategory[]>([])
const loading = ref(false)

const entryOptions = ref<AssetCategoryEntryOption[]>([])
const unclassifiedCodes = ref<string[]>([])

function toRow(node: AssetCategory): CategoryRow {
  const { children, ...rest } = node
  const kids = (children || []).map(toRow)
  return kids.length ? { ...rest, children: kids } : rest
}
const rows = computed<CategoryRow[]>(() => tree.value.map(toRow))

const columns = computed(() => [
  { title: '', dataIndex: 'drag', key: 'drag', width: 40, align: 'center' as const },
  { title: t('assetCategory.name'), dataIndex: 'categoryName', width: 280 },
  {
    title: t('assetCategory.mediaType'),
    dataIndex: 'mediaType',
    width: 110,
    align: 'center' as const,
  },
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
    width: 210,
    align: 'center' as const,
  },
])

/** 一级分类下拉（新增二级时选父级） */
const l1Options = computed(() =>
  tree.value.map((c) => ({ label: `${c.categoryName} (${c.categoryCode})`, value: c.id })),
)

function mediaTypeLabel(value: string) {
  if (value === 'image') return t('assetCategory.mediaImage')
  if (value === 'video') return t('assetCategory.mediaVideo')
  return value
}

const mediaTypeOptions = computed(() => [
  { value: '', label: t('assetCategory.mediaTypeAll') },
  { value: 'image', label: t('assetCategory.mediaImage') },
  { value: 'video', label: t('assetCategory.mediaVideo') },
])

/** 未归类入口，补上展示名——运营认「AI试鞋」不认「shoeSwapping」 */
const unclassifiedEntries = computed(() => {
  const nameOf = new Map(entryOptions.value.map((o) => [o.entryCode, o.entryName]))
  return unclassifiedCodes.value.map((code) => ({
    entryCode: code,
    entryName: nameOf.get(code) || code,
  }))
})

function hiddenEntryNames(record: CategoryRow) {
  return record.entries
    .slice(ENTRY_TAG_LIMIT)
    .map((e) => e.entryName)
    .join('、')
}

/** 一级是否还挂着二级：有的话后端拒删，按钮直接禁用 */
function hasChildren(record: CategoryRow) {
  return record.level === 1 && (record.children?.length || 0) > 0
}

function deleteConfirmText(record: CategoryRow) {
  // 走到这里的一级必然没有二级（有的话按钮已被禁用）
  if (record.level === 1) {
    return t('assetCategory.confirmDeleteL1Empty')
  }
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

// ---- 展开状态 ----
const expandedKeys = ref<number[]>([])
/** 首次加载才全展开；之后刷新保留运营手动折叠的状态 */
let expandedInitialized = false

function onExpandedChange(keys: readonly (string | number)[]) {
  expandedKeys.value = keys.map(Number)
}

function syncExpanded(list: AssetCategory[]) {
  const withChildren = list.filter((n) => (n.children?.length || 0) > 0).map((n) => n.id)
  if (!expandedInitialized) {
    // 二级才是挂入口的地方，默认折叠等于把这页最要紧的信息藏起来
    expandedKeys.value = withChildren
    expandedInitialized = true
    return
  }
  // 只剔掉已经不存在的行，别把用户刚折叠的又展开回去
  const alive = new Set(withChildren)
  expandedKeys.value = expandedKeys.value.filter((id) => alive.has(id))
}

async function loadList() {
  loading.value = true
  try {
    tree.value = (await getAssetCategories()) || []
    syncExpanded(tree.value)
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

// ---- 拖拽排序（仅同级） ----
const dragRow = ref<CategoryRow | null>(null)

/**
 * 行属性。注意 antdv-next 的行属性钩子叫 `onRow`，不是 ant-design-vue 那套的
 * `customRow`——写成 customRow 不会报错，只是整个钩子被当成未知属性丢掉，
 * 行上连 draggable 都不会有，拖拽静默失效。
 */
function rowAttrs(record: CategoryRow) {
  return {
    draggable: true,
    onDragstart: () => (dragRow.value = record),
    onDragover: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      handleDrop(record)
    },
    onDragend: () => (dragRow.value = null),
  }
}

/** 取某行所在的兄弟数组（原始树上的引用，直接改它就能乐观更新） */
function siblingsOf(parentId: number): AssetCategory[] | null {
  if (!parentId) return tree.value
  return tree.value.find((n) => n.id === parentId)?.children ?? null
}

async function handleDrop(target: CategoryRow) {
  const from = dragRow.value
  dragRow.value = null
  if (!from || from.id === target.id) return

  // 只支持同级排序。reorder 接口收到的是一串 id、按下标重写 sortOrder，
  // 它改不了 parentId——跨级拖动在语义上是「换归属」，得连成员一起重算，
  // 在这里顺手做只会写出一串与实际归属对不上的 sortOrder，且不报错
  if ((from.parentId || 0) !== (target.parentId || 0)) {
    message.warning(t('assetCategory.reorderSameLevelOnly'))
    return
  }

  const siblings = siblingsOf(from.parentId || 0)
  if (!siblings) return
  const fromIndex = siblings.findIndex((s) => s.id === from.id)
  const toIndex = siblings.findIndex((s) => s.id === target.id)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const before = [...siblings]
  const [moved] = siblings.splice(fromIndex, 1)
  siblings.splice(toIndex, 0, moved) // 先本地生效，失败再回滚，免得拖完要等一个来回才动

  try {
    await reorderAssetCategories(siblings.map((s) => s.id))
    message.success(t('assetCategory.reorderSuccess'))
    loadList() // 拉回后端重写后的真实 sortOrder
  } catch {
    siblings.splice(0, siblings.length, ...before)
  }
}

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const isEdit = computed(() => editId.value !== null)
const modalTitle = computed(() => {
  if (isEdit.value) return t('assetCategory.editTitle')
  return form.level === 1 ? t('assetCategory.titleAddL1') : t('assetCategory.titleAddL2')
})

const form = reactive({
  categoryCode: '',
  categoryName: '',
  level: 1,
  parentId: undefined as number | undefined,
  mediaType: '',
  sortOrder: 0,
  status: 1,
  entryCodes: [] as string[],
})
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

/** 二级分类 id → 「一级>二级」全路径。接口只给二级自己的名字，路径得自己拼 */
const categoryPathById = computed(() => {
  const map = new Map<number, string>()
  for (const root of tree.value) {
    for (const child of root.children || []) {
      map.set(child.id, `${root.categoryName}>${child.categoryName}`)
    }
  }
  return map
})

/** 穿梭框条目：key 是入口编码，title 是「名称（编码）」，alsoIn 是其它归属提示 */
interface EntryTransferItem {
  key: string
  title: string
  alsoIn: string
}

/**
 * 入口候选项（穿梭框数据源）。
 *
 * **这里刻意不再把「已被其它分类占用」的入口置灰。** 置灰是「一个入口只能归一个分类」
 * 时代的规则，而两级分类的前提就是归属可以重叠：「电商」这种横切一级要把商品套图收进来，
 * 可商品套图本来就挂在「图片>商品图」下——按旧规则它是灰的，运营根本建不出电商分类，
 * 页面也不会说明为什么，只能靠猜。后端也已经移掉了跨分类占用检查（重叠是特性不是冲突），
 * 前端再置灰就是凭空造出一条服务端并不存在的限制。
 *
 * 所以改成纯提示：把其它归属用浅色小字标在条目下面，看得见、可判断，但不拦也不禁用。
 */
const entryTransferData = computed<EntryTransferItem[]>(() =>
  entryOptions.value.map((o) => {
    // 当前正在编辑的这个分类不算「也在」：它本身就该在右栏，标出来只会绕
    const others = o.categories.filter((c) => c.id !== editId.value)
    return {
      key: o.entryCode,
      title: t('assetCategory.entryOption', { name: o.entryName, code: o.entryCode }),
      alsoIn: others.length
        ? t('assetCategory.entryAlsoIn', {
            categories: others
              .map((c) => categoryPathById.value.get(c.id) || c.name)
              .join('、'),
          })
        : '',
    }
  }),
)

/** title 里就带着「名称（编码）」，按它匹配即等于名称和编码都能搜到 */
function filterEntry(inputValue: string, item: EntryTransferItem) {
  return item.title.toLowerCase().includes(inputValue.trim().toLowerCase())
}

/**
 * 只覆盖这四条与「入口」这个业务名词相关的文案。
 * 全选/反选那几条是通用动词，App.vue 的 ConfigProvider 已按当前语言给了 antd 自带译文，
 * 再用本项目的 key 盖一遍反而会把日/韩两版盖成英文（这两个语言包里本域文案本就是英文）。
 */
const transferLocale = computed(() => ({
  searchPlaceholder: t('assetCategory.transferSearch'),
  itemUnit: t('assetCategory.transferItemUnit'),
  itemsUnit: t('assetCategory.transferItemsUnit'),
  notFoundContent: t('assetCategory.transferEmpty'),
}))

function openCreate(level: number, parentId: number | null) {
  editId.value = null
  Object.assign(form, {
    categoryCode: '',
    categoryName: '',
    level,
    parentId: parentId ?? undefined,
    mediaType: '',
    sortOrder: 0,
    status: 1,
    entryCodes: [] as string[],
  })
  modalVisible.value = true
}

/**
 * 从告警条一键收口：把未归类的入口全预选上，运营只补父级、编码和名字。
 * 建的是**二级**——入口只能挂二级，这里开一级表单的话运营填完会直接吃一个后端拒绝。
 * 父级不替它猜，让它自己选：选错了这批素材就出现在错的 tab 下。
 */
function openCreateForUnclassified() {
  openCreate(2, null)
  form.entryCodes = unclassifiedEntries.value.map((e) => e.entryCode)
}

function openEdit(record: CategoryRow) {
  editId.value = record.id
  Object.assign(form, {
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    level: record.level,
    parentId: record.parentId || undefined,
    mediaType: record.mediaType || '',
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
  if (form.level === 2 && !form.parentId) {
    message.warning(t('assetCategory.parentRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      categoryCode: form.categoryCode.trim(),
      categoryName: form.categoryName.trim(),
      // parentId 原样回传，一级固定 0。后端在编辑时确实会「没传就沿用原值」，
      // 但那是兜底不是契约：显式传出去，请求本身就说得清这行挂在哪
      parentId: form.level === 2 ? Number(form.parentId) : 0,
      level: form.level,
      // 二级传空串把库里可能存在的脏值一并抹平——二级的 mediaType 后端本来就不认
      mediaType: form.level === 1 ? form.mediaType : '',
      sortOrder: form.sortOrder,
      status: form.status,
      // 一级不能挂入口，带上会被后端拒
      entryCodes: form.level === 2 ? form.entryCodes : [],
    }
    if (editId.value) await updateAssetCategory(editId.value, payload)
    else await createAssetCategory(payload)
    message.success(t('common.saveSuccess'))
    // 刚在某个一级下建了二级，把它展开——不展开的话保存完什么都没变，像是没生效
    if (payload.parentId && !expandedKeys.value.includes(payload.parentId)) {
      expandedKeys.value = [...expandedKeys.value, payload.parentId]
    }
    modalVisible.value = false
    loadAll()
  } catch {
    /* 编码重复 / 一级挂入口之类的报错由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: CategoryRow) {
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
.cat-l1 {
  font-weight: 500;
}
.cat-l2 {
  color: var(--color-text-secondary, #666);
}
.cat-code {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
/* 弹窗是 teleport 到 body 的，但条目内容由本组件模板渲染，scoped 作用域属性照样打得上 */
.entry-item {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}
.entry-also {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
/*
  穿梭框条目默认是单行省略号，「也在：…」会被直接截掉——而那正是重叠聚合下
  运营判断的唯一依据，宁可让条目撑成两行也不能省略掉它
*/
.entry-transfer :deep(.ant-transfer-list-content-item-text) {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
}
</style>
