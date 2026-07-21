<template>
  <div class="page-container">
    <a-row :gutter="16" class="filter-layout">
      <!-- 维度字典区 -->
      <a-col :span="24">
        <a-card :title="$t('templateFilter.filterListTitle')" variant="borderless">
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

      <!-- 选项字典区 -->
      <a-col :span="24" style="margin-top: 16px">
        <a-card variant="borderless">
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

      <!-- slot 绑定区 -->
      <a-col :span="24" style="margin-top: 16px">
        <a-card :title="$t('templateFilter.slotBindTitle')" variant="borderless">
          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item :label="$t('templateFilter.bizType')">
              <a-select
                v-model:value="slotQuery.bizType"
                style="width: 140px"
                :options="bizTypeOptions"
                @change="onSlotModuleChange"
              />
            </a-form-item>
            <a-form-item :label="$t('templateFilter.moduleCode')">
              <a-select
                v-model:value="slotQuery.moduleCode"
                style="width: 200px"
                :options="moduleOptions"
                :placeholder="$t('templateFilter.moduleCodePlaceholder')"
                :loading="moduleLoading"
                show-search
                option-filter-prop="label"
                allow-clear
                @change="onSlotModuleChange"
              />
            </a-form-item>
            <a-form-item :label="$t('templateFilter.slotCode')">
              <a-auto-complete
                v-model:value="slotQuery.slotCode"
                style="width: 200px"
                :options="slotCodeOptions"
                :placeholder="$t('templateFilter.slotCodePlaceholder')"
                allow-clear
                :filter-option="filterSlotOption"
              />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadSlotFilters">
                  {{ $t('common.search') }}
                </a-button>
                <a-button
                  v-permission="'template_filter:create'"
                  :disabled="!slotQuery.moduleCode"
                  @click="handleBindSlotFilter"
                >
                  {{ $t('templateFilter.addFilterToSlot') }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <a-table
            :columns="slotColumns"
            :data-source="slotFilterList"
            :loading="slotLoading"
            :pagination="false"
            row-key="id"
            size="small"
          >
            <template #emptyText>
              <a-empty :description="$t('templateFilter.noSlotData')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'filterId'">
                {{ filterNameById(record.filterId) }}
              </template>
              <template v-if="column.dataIndex === 'optionFilterType'">
                <a-tag :color="record.optionFilterType === 'partial' ? 'orange' : 'default'">
                  {{
                    record.optionFilterType === 'partial'
                      ? $t('templateFilter.optionPartial')
                      : $t('templateFilter.optionAll')
                  }}
                </a-tag>
                <span
                  v-if="record.optionFilterType === 'partial' && record.optionWhiteList?.length"
                  style="margin-left: 4px; color: #999"
                >
                  ({{ record.optionWhiteList.length }})
                </span>
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
                    @click="handleEditSlotFilter(record)"
                  >
                    {{ $t('common.edit') }}
                  </a-button>
                  <a-popconfirm
                    v-permission="'template_filter:delete'"
                    :title="$t('templateFilter.confirmUnbindSlot')"
                    @confirm="handleUnbindSlotFilter(record)"
                  >
                    <a-button type="link" size="small" danger>
                      {{ $t('templateFilter.unbind') }}
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
            :un-checked-value="0"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.sortOrder')">
          <a-input-number v-model:value="filterForm.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="filterForm.status"
            :checked-value="1"
            :un-checked-value="0"
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
            :un-checked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- slot 绑定 新增/编辑 弹窗 -->
    <a-modal
      v-model:open="slotModalVisible"
      :title="isSlotEdit ? $t('templateFilter.editSlotBind') : $t('templateFilter.addFilterToSlot')"
      :confirm-loading="slotSubmitLoading"
      width="560px"
      @ok="handleSlotSubmit"
    >
      <a-form :model="slotForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('templateFilter.filterName')">
          <a-select
            v-model:value="slotForm.filterId"
            :disabled="isSlotEdit"
            :options="filterSelectOptions"
            :placeholder="$t('templateFilter.selectFilter')"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.optionFilterType')">
          <a-radio-group v-model:value="slotForm.optionFilterType" @change="handleOptionTypeChange">
            <a-radio value="all">{{ $t('templateFilter.optionAll') }}</a-radio>
            <a-radio value="partial">{{ $t('templateFilter.optionPartial') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          v-if="slotForm.optionFilterType === 'partial'"
          :label="$t('templateFilter.optionWhiteList')"
        >
          <a-select
            v-model:value="slotForm.optionWhiteList"
            mode="multiple"
            :options="whiteListOptions"
            :placeholder="$t('templateFilter.selectWhiteOptions')"
            :loading="whiteListLoading"
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item :label="$t('templateFilter.sortOrder')">
          <a-input-number v-model:value="slotForm.sortOrder" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="slotForm.status"
            :checked-value="1"
            :un-checked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
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
  getSlotFilters,
  bindSlotFilter,
  updateSlotFilter,
  unbindSlotFilter,
  getModuleCodes,
  getSlotCodes,
  type TemplateFilter,
  type TemplateFilterOption,
  type TemplateSlotFilter,
  type FilterUiType,
  type OptionFilterType,
} from '@/api/template-filter'

const { t } = useI18n()

const filterTableRef = ref<InstanceType<typeof ProTable> | null>(null)

const uiTypeOptions = [
  { label: 'tab', value: 'tab' },
  { label: 'select', value: 'select' },
  { label: 'multi_select', value: 'multi_select' },
]

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

// 页面区块联想下拉（已有素材的 distinct slotCode，可手输）
const slotCodeOptions = ref<{ label: string; value: string }[]>([])
const slotCodeLoading = ref(false)
async function loadSlotCodeOptions() {
  slotCodeLoading.value = true
  try {
    const res = await getSlotCodes({
      bizType: slotQuery.bizType || 'ecommerce',
      moduleCode: slotQuery.moduleCode || undefined,
    })
    slotCodeOptions.value = (res || []).map((c) => ({ label: c, value: c }))
  } catch (error) {
    console.error('Failed to load slot code options:', error)
    slotCodeOptions.value = []
  } finally {
    slotCodeLoading.value = false
  }
}

// 业务类型/创作模块变更时刷新 slot 联想候选
function onSlotModuleChange() {
  slotQuery.slotCode = ''
  loadSlotCodeOptions()
}

// auto-complete 联想过滤（按输入文本匹配候选 value）
function filterSlotOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase())
}

// 维度字典缓存（供 slot 绑定区下拉与名称展示）
const allFilters = ref<TemplateFilter[]>([])
const filterSelectOptions = computed(() =>
  allFilters.value.map((f) => ({ label: `${f.filterName} (${f.filterCode})`, value: f.id })),
)
function filterNameById(id: number): string {
  const f = allFilters.value.find((x) => x.id === id)
  return f ? `${f.filterName} (${f.filterCode})` : String(id)
}

// ---- 维度列表 ----
const filterColumns = [
  {
    title: t('templateFilter.filterCode'),
    dataIndex: 'filterCode',
    search: true,
    searchType: 'input' as const,
    width: 140,
    ellipsis: true,
  },
  {
    title: t('templateFilter.filterName'),
    dataIndex: 'filterName',
    search: true,
    searchType: 'input' as const,
    width: 140,
    ellipsis: true,
  },
  {
    title: t('templateFilter.uiType'),
    dataIndex: 'uiType',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: 'Select', value: 'select' },
      { label: 'Radio', value: 'radio' },
      { label: 'Checkbox', value: 'checkbox' },
      { label: 'Slider', value: 'slider' },
    ],
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('templateFilter.multiSelect'),
    dataIndex: 'multiSelect',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 100,
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
    filterCode: params.filterCode as string | undefined,
    filterName: params.filterName as string | undefined,
    uiType: params.uiType as string | undefined,
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

// 拉全量维度字典（用于 slot 绑定区下拉、名称映射）
async function loadAllFilters() {
  try {
    const res = await getTemplateFilterList({ page: 1, pageSize: 200 })
    allFilters.value = res.list || []
  } catch (error) {
    console.error('Failed to load all filters:', error)
  }
}
loadAllFilters()

// ---- 维度 CRUD ----
const filterModalVisible = ref(false)
const filterSubmitLoading = ref(false)
const isFilterEdit = ref(false)
const editFilterId = ref<number | null>(null)

const filterForm = reactive({
  bizType: 'ecommerce',
  filterCode: '',
  filterName: '',
  uiType: 'select' as FilterUiType,
  multiSelect: 0,
  sortOrder: 0,
  status: 1,
})

function resetFilterForm() {
  filterForm.bizType = 'ecommerce'
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
    loadAllFilters()
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
    loadAllFilters()
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

// ---- slot 绑定 ----
const slotQuery = reactive({
  bizType: 'ecommerce',
  moduleCode: '',
  slotCode: '',
})
const slotFilterList = ref<TemplateSlotFilter[]>([])
const slotLoading = ref(false)

const slotColumns = [
  {
    title: t('templateFilter.filterName'),
    dataIndex: 'filterId',
    ellipsis: true,
  },
  {
    title: t('templateFilter.optionFilterType'),
    dataIndex: 'optionFilterType',
    width: 160,
    align: 'center' as const,
  },
  {
    title: t('templateFilter.sortOrder'),
    dataIndex: 'sortOrder',
    width: 80,
    align: 'center' as const,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    width: 90,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    key: 'operation',
    width: 140,
    align: 'center' as const,
  },
]

async function loadSlotFilters() {
  if (!slotQuery.moduleCode) {
    slotFilterList.value = []
    return
  }
  slotLoading.value = true
  try {
    const res = await getSlotFilters({
      bizType: slotQuery.bizType || 'ecommerce',
      moduleCode: slotQuery.moduleCode,
      slotCode: slotQuery.slotCode || undefined,
    })
    slotFilterList.value = res || []
  } catch (error) {
    console.error('Failed to load slot filters:', error)
    slotFilterList.value = []
  } finally {
    slotLoading.value = false
  }
}

// ---- slot 绑定 新增/编辑 ----
const slotModalVisible = ref(false)
const slotSubmitLoading = ref(false)
const isSlotEdit = ref(false)
const editSlotId = ref<number | null>(null)
const whiteListOptions = ref<{ label: string; value: number }[]>([])
const whiteListLoading = ref(false)

const slotForm = reactive({
  filterId: undefined as number | undefined,
  optionFilterType: 'all' as OptionFilterType,
  optionWhiteList: [] as number[],
  sortOrder: 0,
  status: 1,
})

function resetSlotForm() {
  slotForm.filterId = undefined
  slotForm.optionFilterType = 'all'
  slotForm.optionWhiteList = []
  slotForm.sortOrder = 0
  slotForm.status = 1
  whiteListOptions.value = []
}

async function loadWhiteListOptions(filterId: number) {
  whiteListLoading.value = true
  try {
    const res = await getTemplateFilterOptions(filterId)
    whiteListOptions.value = (res || []).map((o) => ({
      label: `${o.optionName} (${o.optionCode})`,
      value: o.id,
    }))
  } catch (error) {
    console.error('Failed to load white list options:', error)
    whiteListOptions.value = []
  } finally {
    whiteListLoading.value = false
  }
}

async function handleOptionTypeChange() {
  if (slotForm.optionFilterType === 'partial' && slotForm.filterId != null) {
    await loadWhiteListOptions(slotForm.filterId)
  }
}

function handleBindSlotFilter() {
  if (!slotQuery.moduleCode) {
    message.warning(t('templateFilter.moduleCodeRequired'))
    return
  }
  isSlotEdit.value = false
  editSlotId.value = null
  resetSlotForm()
  slotModalVisible.value = true
}

async function handleEditSlotFilter(record: TemplateSlotFilter) {
  isSlotEdit.value = true
  editSlotId.value = record.id
  slotForm.filterId = record.filterId
  slotForm.optionFilterType = record.optionFilterType
  slotForm.optionWhiteList = record.optionWhiteList ?? []
  slotForm.sortOrder = record.sortOrder ?? 0
  slotForm.status = record.status
  slotModalVisible.value = true
  if (record.optionFilterType === 'partial') {
    await loadWhiteListOptions(record.filterId)
  }
}

async function handleSlotSubmit() {
  if (slotForm.filterId == null) {
    message.warning(t('templateFilter.selectFilter'))
    return
  }
  slotSubmitLoading.value = true
  try {
    const whiteList =
      slotForm.optionFilterType === 'partial' ? slotForm.optionWhiteList : null
    if (isSlotEdit.value && editSlotId.value != null) {
      await updateSlotFilter(editSlotId.value, {
        optionFilterType: slotForm.optionFilterType,
        optionWhiteList: whiteList,
        sortOrder: slotForm.sortOrder,
        status: slotForm.status,
      })
      message.success(t('common.updateSuccess'))
    } else {
      await bindSlotFilter({
        bizType: slotQuery.bizType || 'ecommerce',
        moduleCode: slotQuery.moduleCode,
        slotCode: slotQuery.slotCode || '',
        filterId: slotForm.filterId,
        optionFilterType: slotForm.optionFilterType,
        optionWhiteList: whiteList,
        sortOrder: slotForm.sortOrder,
        status: slotForm.status,
      })
      message.success(t('common.createSuccess'))
    }
    slotModalVisible.value = false
    loadSlotFilters()
  } catch (error) {
    console.error('Failed to save slot filter:', error)
  } finally {
    slotSubmitLoading.value = false
  }
}

async function handleUnbindSlotFilter(record: TemplateSlotFilter) {
  try {
    await unbindSlotFilter(record.id)
    message.success(t('common.deleteSuccess'))
    loadSlotFilters()
  } catch (error) {
    console.error('Failed to unbind slot filter:', error)
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
