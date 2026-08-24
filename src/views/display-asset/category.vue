<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('displayCategory.title') }}</h2>
      <a-space>
        <a-button v-permission="'display_asset:create'" type="primary" @click="openCreate(1, null)">
          {{ $t('displayCategory.addL1') }}
        </a-button>
        <a-button v-permission="'display_asset:create'" @click="openCreate(2, null)">
          {{ $t('displayCategory.addL2') }}
        </a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 16px"
      :message="$t('displayCategory.hint')"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <span class="muted">{{ $t('displayCategory.platformFilter') }}</span>
        <a-radio-group v-model:value="platformFilter" button-style="solid" @change="loadTree">
          <a-radio-button value="">{{ $t('displayCategory.platformAll') }}</a-radio-button>
          <a-radio-button value="APP">App</a-radio-button>
          <a-radio-button value="PC">PC</a-radio-button>
        </a-radio-group>
      </div>

      <a-table
        :columns="columns"
        :data-source="tree"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('displayCategory.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'categoryName'">
            <span :class="record.level === 1 ? 'cat-l1' : 'cat-l2'">{{ record.categoryName }}</span>
            <span class="cat-code">{{ record.categoryCode }}</span>
          </template>

          <template v-if="column.dataIndex === 'level'">
            <a-tag :color="record.level === 1 ? 'blue' : 'default'">
              {{ record.level === 1 ? $t('displayCategory.l1') : $t('displayCategory.l2') }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'platform'">
            <a-tag :color="platformColor(record.platform)">{{ platformLabel(record.platform) }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? $t('displayCategory.enabled') : $t('displayCategory.disabled') }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-if="record.level === 1"
                v-permission="'display_asset:create'"
                type="link"
                size="small"
                @click="openCreate(2, record.id)"
              >
                {{ $t('displayCategory.addChild') }}
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
                :title="
                  record.level === 1
                    ? $t('displayCategory.confirmDeleteL1')
                    : $t('displayCategory.confirmDeleteL2')
                "
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
      width="520px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('displayCategory.level')">
          <!-- 层级与父级在编辑态锁死：改了会让已挂其下的素材与推荐记录语义漂移 -->
          <a-radio-group v-model:value="form.level" :disabled="isEdit" button-style="solid">
            <a-radio-button :value="1">{{ $t('displayCategory.l1') }}</a-radio-button>
            <a-radio-button :value="2">{{ $t('displayCategory.l2') }}</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="form.level === 2" :label="$t('displayCategory.parent')" required>
          <a-select
            v-model:value="form.parentId"
            :options="l1Options"
            :disabled="isEdit"
            show-search
            option-filter-prop="label"
            :placeholder="$t('displayCategory.parentPlaceholder')"
            @change="onParentChange"
          />
        </a-form-item>

        <a-form-item :label="$t('displayCategory.platform')">
          <a-radio-group v-model:value="form.platform" button-style="solid">
            <a-radio-button
              v-for="p in allowedPlatforms"
              :key="p"
              :value="p"
            >
              {{ platformLabel(p) }}
            </a-radio-button>
          </a-radio-group>
          <div class="muted">{{ platformHint }}</div>
        </a-form-item>

        <a-form-item :label="$t('displayCategory.name')" required>
          <a-input
            v-model:value="form.categoryName"
            :placeholder="$t('displayCategory.namePlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('displayCategory.code')" required>
          <a-input
            v-model:value="form.categoryCode"
            :placeholder="$t('displayCategory.codePlaceholder')"
          />
          <div class="muted">{{ $t('displayCategory.codeHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('displayCategory.sortOrder')">
          <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
          <div class="muted">{{ $t('displayCategory.sortOrderHint') }}</div>
        </a-form-item>

        <a-form-item :label="$t('displayCategory.status')">
          <a-switch
            v-model:checked="enabled"
            :checked-children="$t('displayCategory.enabled')"
            :un-checked-children="$t('displayCategory.disabled')"
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

import {
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  type DisplayCategoryNode,
  type Platform,
} from '@/api/display-category'

const { t } = useI18n()

const tree = ref<DisplayCategoryNode[]>([])
const loading = ref(false)
/** '' = 不按端筛；APP/PC 时后端会把 BOTH 一并带上 */
const platformFilter = ref<'' | Platform>('')

function platformLabel(p: Platform) {
  return p === 'APP' ? 'App' : p === 'PC' ? 'PC' : 'App+PC'
}
function platformColor(p: Platform) {
  return p === 'APP' ? 'blue' : p === 'PC' ? 'green' : 'purple'
}

const columns = computed(() => [
  { title: t('displayCategory.name'), dataIndex: 'categoryName', width: 300 },
  { title: t('displayCategory.level'), dataIndex: 'level', width: 100, align: 'center' as const },
  {
    title: t('displayCategory.platform'),
    dataIndex: 'platform',
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('displayCategory.sortOrder'),
    dataIndex: 'sortOrder',
    width: 90,
    align: 'center' as const,
  },
  { title: t('displayCategory.status'), dataIndex: 'status', width: 100, align: 'center' as const },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 220,
    align: 'center' as const,
  },
])

/** 一级分类下拉（新增二级时选父） */
const l1Options = computed(() =>
  tree.value.map((c) => ({ label: `${c.categoryName} (${c.categoryCode})`, value: c.id })),
)

async function loadTree() {
  loading.value = true
  try {
    tree.value = (await getCategoryTree(false, platformFilter.value || undefined)) || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
loadTree()

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const isEdit = computed(() => editId.value !== null)
const modalTitle = computed(() => {
  if (isEdit.value) return t('displayCategory.editTitle')
  return form.level === 1 ? t('displayCategory.addL1') : t('displayCategory.addL2')
})

const form = reactive({
  categoryCode: '',
  categoryName: '',
  level: 1,
  parentId: undefined as number | undefined,
  platform: 'BOTH' as Platform,
  sortOrder: 0,
  status: 1,
})
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

/** 当前选中的父级（新增/编辑二级时用来约束平台可选项） */
const selectedParent = computed(() =>
  form.parentId ? tree.value.find((c) => c.id === form.parentId) : undefined,
)

/**
 * 二级的平台必须被父级覆盖 —— 父级限 APP 时子级只能 APP。
 * 前端直接把越界选项从单选里去掉，比让运营点了再吃后端报错友好。
 */
const allowedPlatforms = computed<Platform[]>(() => {
  const parentPlatform = form.level === 2 ? selectedParent.value?.platform : undefined
  if (!parentPlatform || parentPlatform === 'BOTH') return ['BOTH', 'APP', 'PC']
  return [parentPlatform]
})
const platformHint = computed(() => {
  if (form.level === 2 && allowedPlatforms.value.length === 1) {
    return t('displayCategory.platformLockedByParent', {
      platform: platformLabel(allowedPlatforms.value[0]),
    })
  }
  return t('displayCategory.platformHint')
})

/** 换父级后原平台可能越界，收敛到父级允许的第一项 */
function onParentChange() {
  if (!allowedPlatforms.value.includes(form.platform)) {
    form.platform = allowedPlatforms.value[0]
  }
}

function openCreate(level: number, parentId: number | null) {
  editId.value = null
  Object.assign(form, {
    categoryCode: '',
    categoryName: '',
    level,
    parentId: parentId ?? undefined,
    platform: 'BOTH' as Platform,
    sortOrder: 0,
    status: 1,
  })
  onParentChange()
  modalVisible.value = true
}

function openEdit(record: DisplayCategoryNode) {
  editId.value = record.id
  Object.assign(form, {
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    level: record.level,
    parentId: record.parentId || undefined,
    platform: record.platform,
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.categoryName?.trim()) {
    message.warning(t('displayCategory.nameRequired'))
    return
  }
  if (!form.categoryCode?.trim()) {
    message.warning(t('displayCategory.codeRequired'))
    return
  }
  if (form.level === 2 && !form.parentId) {
    message.warning(t('displayCategory.parentRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      categoryCode: form.categoryCode.trim(),
      categoryName: form.categoryName.trim(),
      platform: form.platform,
      sortOrder: form.sortOrder,
      status: form.status,
    }
    if (editId.value) {
      // 层级/父级后端不接受变更，编辑时不回传，避免给出「改了却没生效」的错觉
      await updateCategory(editId.value, payload)
    } else {
      await createCategory({
        ...payload,
        level: form.level,
        parentId: form.level === 2 ? form.parentId : undefined,
      })
    }
    message.success(t('common.saveSuccess'))
    modalVisible.value = false
    loadTree()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: DisplayCategoryNode) {
  try {
    await deleteCategory(record.id)
    message.success(t('common.deleteSuccess'))
    loadTree()
  } catch {
    /* 分类下有素材或推荐内容时后端拒绝，原因由拦截器提示 */
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
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.cat-l1 {
  font-weight: 500;
}
.cat-l2 {
  color: var(--color-text-secondary, #666);
}
.cat-code {
  margin-left: 8px;
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
