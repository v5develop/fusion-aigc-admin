<template>
  <div class="page-container">
    <a-row :gutter="16" class="filter-layout">
      <!-- 上：维度列表（整行宽度，容纳全部列） -->
      <a-col :span="24">
        <a-card :title="$t('templateFilter.filterListTitle')" :bordered="false">
          <ProTable
            ref="filterTableRef"
            :columns="filterColumns"
            :request="loadFilters"
            :search="{}"
            row-key="id"
          >
            <template #emptyText>
              <a-empty :description="$t('templateFilter.noFilterData')" />
            </template>
            <template #toolbar>
              <a-button
                v-permission="'template_filter:create'"
                type="primary"
                @click="handleCreateFilter"
              >
                {{ $t('templateFilter.createFilter') }}
              </a-button>
            </template>

            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'uiType'">
                <a-tag color="blue">{{ record.uiType }}</a-tag>
              </template>

              <template v-if="column.dataIndex === 'multiSelect'">
                <a-tag :color="record.multiSelect === 1 ? 'green' : 'default'">
                  {{ record.multiSelect === 1 ? $t('common.yes') : $t('common.no') }}
                </a-tag>
              </template>

              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'green' : 'red'">
                  {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
                </a-tag>
              </template>

              <template v-if="column.key === 'operation'">
                <a-space :size="4">
                  <a-button type="link" size="small" @click="handleSelectFilter(record)">
                    {{ $t('templateFilter.manageOptions') }}
                  </a-button>
                  <a-button
                    v-permission="'template_filter:edit'"
                    type="link"
                    size="small"
                    @click="handleEditFilter(record)"
                  >
                    {{ $t('common.edit') }}
                  </a-button>
                  <a-popconfirm
                    v-permission="'template_filter:delete'"
                    :title="$t('templateFilter.confirmDeleteFilter')"
                    @confirm="handleDeleteFilter(record)"
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
      </a-col>

      <!-- 下：选项列表 -->
      <a-col :span="24" style="margin-top: 16px">
        <a-card :bordered="false">
          <template #title>
            <span v-if="currentFilter">
              {{ $t('templateFilter.optionListTitle') }}
              <a-tag color="blue">{{ currentFilter.filterName }}</a-tag>
            </span>
            <span v-else>{{ $t('templateFilter.optionListTitle') }}</span>
          </template>
          <template v-if="currentFilter" #extra>
            <a-button
              v-permission="'template_filter:create'"
              type="primary"
              size="small"
              @click="handleCreateOption"
            >
              {{ $t('templateFilter.createOption') }}
            </a-button>
          </template>

          <a-empty
            v-if="!currentFilter"
            :description="$t('templateFilter.selectFilterFirst')"
          />
          <a-table
            v-else
            :columns="optionColumns"
            :data-source="optionList"
            :loading="optionLoading"
            :pagination="false"
            row-key="id"
            size="small"
          >
            <template #emptyText>
              <a-empty :description="$t('templateFilter.noOptionData')" />
            </template>
            <template #bodyCell="{ column, record }">
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
                    @click="handleEditOption(record)"
                  >
                    {{ $t('common.edit') }}
                  </a-button>
                  <a-popconfirm
                    v-permission="'template_filter:delete'"
                    :title="$t('templateFilter.confirmDeleteOption')"
                    @confirm="handleDeleteOption(record)"
                  >
                    <a-button type="link" size="small" danger>
                      {{ $t('common.delete') }}
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>

    <!-- 维度 新增/编辑 弹窗 -->
    <a-modal
      v-model:open="filterModalVisible"
      :title="isFilterEdit ? $t('templateFilter.editFilter') : $t('templateFilter.createFilter')"
      :confirm-loading="filterSubmitLoading"
      width="560px"
      @ok="handleFilterSubmit"
    >
      <a-form :model="filterForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('templateFilter.bizType')">
          <a-input
            v-model:value="filterForm.bizType"
            :placeholder="$t('templateFilter.bizTypePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.moduleCode')">
          <a-input
            v-model:value="filterForm.moduleCode"
            :placeholder="$t('templateFilter.moduleCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.slotCode')">
          <a-input
            v-model:value="filterForm.slotCode"
            :placeholder="$t('templateFilter.slotCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.filterCode')">
          <a-input
            v-model:value="filterForm.filterCode"
            :placeholder="$t('templateFilter.filterCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.filterName')">
          <a-input
            v-model:value="filterForm.filterName"
            :placeholder="$t('templateFilter.filterNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.uiType')">
          <a-select v-model:value="filterForm.uiType" :options="uiTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.multiSelect')">
          <a-switch
            v-model:checked="filterForm.multiSelect"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.sortOrder')">
          <a-input-number v-model:value="filterForm.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="filterForm.status"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 选项 新增/编辑 弹窗 -->
    <a-modal
      v-model:open="optionModalVisible"
      :title="isOptionEdit ? $t('templateFilter.editOption') : $t('templateFilter.createOption')"
      :confirm-loading="optionSubmitLoading"
      width="460px"
      @ok="handleOptionSubmit"
    >
      <a-form :model="optionForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('templateFilter.optionCode')">
          <a-input
            v-model:value="optionForm.optionCode"
            :placeholder="$t('templateFilter.optionCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.optionName')">
          <a-input
            v-model:value="optionForm.optionName"
            :placeholder="$t('templateFilter.optionNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.sortOrder')">
          <a-input-number v-model:value="optionForm.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="optionForm.status"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getTemplateFilterList,
  createTemplateFilter,
  updateTemplateFilter,
  deleteTemplateFilter,
  getTemplateFilterOptions,
  createTemplateFilterOption,
  updateTemplateFilterOption,
  deleteTemplateFilterOption,
  type TemplateFilter,
  type TemplateFilterOption,
  type FilterUiType,
} from '@/api/template-filter'

const { t } = useI18n()

const filterTableRef = ref<InstanceType<typeof ProTable> | null>(null)

const uiTypeOptions = [
  { label: 'tab', value: 'tab' },
  { label: 'select', value: 'select' },
  { label: 'multi_select', value: 'multi_select' },
]

// ---- 维度列表 ----
const filterColumns = [
  {
    title: t('templateFilter.moduleCode'),
    dataIndex: 'moduleCode',
    searchType: 'input' as const,
    width: 140,
    ellipsis: true,
  },
  {
    title: t('templateFilter.slotCode'),
    dataIndex: 'slotCode',
    searchType: 'input' as const,
    width: 130,
    ellipsis: true,
  },
  {
    title: t('templateFilter.filterCode'),
    dataIndex: 'filterCode',
    width: 110,
    ellipsis: true,
  },
  {
    title: t('templateFilter.filterName'),
    dataIndex: 'filterName',
    width: 110,
    ellipsis: true,
  },
  {
    title: t('templateFilter.uiType'),
    dataIndex: 'uiType',
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('templateFilter.multiSelect'),
    dataIndex: 'multiSelect',
    width: 90,
    align: 'center' as const,
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
  },
]

async function loadFilters(params: Record<string, unknown>) {
  const res = await getTemplateFilterList({
    moduleCode: params.moduleCode as string | undefined,
    slotCode: params.slotCode as string | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

// ---- 维度 CRUD ----
const filterModalVisible = ref(false)
const filterSubmitLoading = ref(false)
const isFilterEdit = ref(false)
const editFilterId = ref<number | null>(null)

const filterForm = reactive({
  bizType: 'ecommerce',
  moduleCode: '',
  slotCode: '',
  filterCode: '',
  filterName: '',
  uiType: 'select' as FilterUiType,
  multiSelect: 0,
  sortOrder: 0,
  status: 1,
})

function resetFilterForm() {
  filterForm.bizType = 'ecommerce'
  filterForm.moduleCode = ''
  filterForm.slotCode = ''
  filterForm.filterCode = ''
  filterForm.filterName = ''
  filterForm.uiType = 'select'
  filterForm.multiSelect = 0
  filterForm.sortOrder = 0
  filterForm.status = 1
}

function handleCreateFilter() {
  isFilterEdit.value = false
  editFilterId.value = null
  resetFilterForm()
  filterModalVisible.value = true
}

function handleEditFilter(record: TemplateFilter) {
  isFilterEdit.value = true
  editFilterId.value = record.id
  filterForm.bizType = record.bizType
  filterForm.moduleCode = record.moduleCode
  filterForm.slotCode = record.slotCode
  filterForm.filterCode = record.filterCode
  filterForm.filterName = record.filterName
  filterForm.uiType = record.uiType
  filterForm.multiSelect = record.multiSelect
  filterForm.sortOrder = record.sortOrder ?? 0
  filterForm.status = record.status
  filterModalVisible.value = true
}

async function handleFilterSubmit() {
  filterSubmitLoading.value = true
  try {
    if (isFilterEdit.value && editFilterId.value != null) {
      await updateTemplateFilter(editFilterId.value, { ...filterForm })
      message.success(t('common.updateSuccess'))
    } else {
      await createTemplateFilter({ ...filterForm })
      message.success(t('common.createSuccess'))
    }
    filterModalVisible.value = false
    filterTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to save filter:', error)
  } finally {
    filterSubmitLoading.value = false
  }
}

async function handleDeleteFilter(record: TemplateFilter) {
  try {
    await deleteTemplateFilter(record.id)
    message.success(t('common.deleteSuccess'))
    if (currentFilter.value?.id === record.id) {
      currentFilter.value = null
      optionList.value = []
    }
    filterTableRef.value?.refresh()
  } catch (error) {
    console.error('Failed to delete filter:', error)
  }
}

// ---- 选项 ----
const currentFilter = ref<TemplateFilter | null>(null)
const optionList = ref<TemplateFilterOption[]>([])
const optionLoading = ref(false)

const optionColumns = [
  {
    title: t('templateFilter.optionCode'),
    dataIndex: 'optionCode',
    width: 120,
    ellipsis: true,
  },
  {
    title: t('templateFilter.optionName'),
    dataIndex: 'optionName',
    ellipsis: true,
  },
  {
    title: t('templateFilter.sortOrder'),
    dataIndex: 'sortOrder',
    width: 70,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    key: 'operation',
    width: 120,
    align: 'center' as const,
  },
]

async function loadOptions() {
  if (!currentFilter.value) return
  optionLoading.value = true
  try {
    const res = await getTemplateFilterOptions(currentFilter.value.id)
    optionList.value = res || []
  } catch (error) {
    console.error('Failed to load options:', error)
    optionList.value = []
  } finally {
    optionLoading.value = false
  }
}

function handleSelectFilter(record: TemplateFilter) {
  currentFilter.value = record
  loadOptions()
}

// ---- 选项 CRUD ----
const optionModalVisible = ref(false)
const optionSubmitLoading = ref(false)
const isOptionEdit = ref(false)
const editOptionId = ref<number | null>(null)

const optionForm = reactive({
  optionCode: '',
  optionName: '',
  sortOrder: 0,
  status: 1,
})

function resetOptionForm() {
  optionForm.optionCode = ''
  optionForm.optionName = ''
  optionForm.sortOrder = 0
  optionForm.status = 1
}

function handleCreateOption() {
  isOptionEdit.value = false
  editOptionId.value = null
  resetOptionForm()
  optionModalVisible.value = true
}

function handleEditOption(record: TemplateFilterOption) {
  isOptionEdit.value = true
  editOptionId.value = record.id
  optionForm.optionCode = record.optionCode
  optionForm.optionName = record.optionName
  optionForm.sortOrder = record.sortOrder ?? 0
  optionForm.status = record.status
  optionModalVisible.value = true
}

async function handleOptionSubmit() {
  if (!currentFilter.value) return
  optionSubmitLoading.value = true
  try {
    if (isOptionEdit.value && editOptionId.value != null) {
      await updateTemplateFilterOption(editOptionId.value, { ...optionForm })
      message.success(t('common.updateSuccess'))
    } else {
      await createTemplateFilterOption(currentFilter.value.id, { ...optionForm })
      message.success(t('common.createSuccess'))
    }
    optionModalVisible.value = false
    loadOptions()
  } catch (error) {
    console.error('Failed to save option:', error)
  } finally {
    optionSubmitLoading.value = false
  }
}

async function handleDeleteOption(record: TemplateFilterOption) {
  try {
    await deleteTemplateFilterOption(record.id)
    message.success(t('common.deleteSuccess'))
    loadOptions()
  } catch (error) {
    console.error('Failed to delete option:', error)
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}

.filter-layout {
  align-items: flex-start;
}
</style>
