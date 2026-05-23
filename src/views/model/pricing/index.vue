<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('pricing.noPricingData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('pricing.createPricing') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'modelName'">
          {{ record.modelName || '-' }}
        </template>

        <template v-if="column.dataIndex === 'actionType'">
          <a-tag>{{ actionTypeMap[record.actionType] || record.actionType }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'priceUnit'">
          <a-tag>{{ priceUnitMap[record.priceUnit] || record.priceUnit || '-' }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'effectiveTimeRange'">
          <span v-if="record.effectiveTime">{{ record.effectiveTime }}</span>
          <span v-else>-</span>
          <span v-if="record.expireTime"> ~ {{ record.expireTime }}</span>
          <span v-else-if="record.effectiveTime"> ~ {{ $t('pricing.permanent') }}</span>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-button type="link" size="small" danger @click="handleDelete(record)">
              {{ $t('common.delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('pricing.editPricing') : $t('pricing.createPricing')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('model.modelName')" required>
          <a-select
            v-model:value="formData.modelId"
            :placeholder="$t('pricing.selectModel')"
            show-search
            :filter-option="filterModelOption"
            :disabled="isEdit"
          >
            <a-select-option v-for="model in modelList" :key="model.id" :value="model.id">
              {{ model.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('pricing.actionType')" required>
          <a-select v-model:value="formData.actionType" :options="actionTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('pricing.pricePoints')" required>
          <a-input-number
            v-model:value="formData.pricePoints"
            :min="0"
            :precision="0"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('pricing.priceUnit')">
          <a-select v-model:value="formData.priceUnit" :options="priceUnitOptions" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('pricing.effectiveTime')">
          <a-date-picker v-model:value="formData.effectiveTime" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getPricingList, createPricing, updatePricing, deletePricing } from '@/api/pricing'
import { getModelList } from '@/api/model'
import type { ModelPricing } from '@/types/api'
import type { AIModel } from '@/types/api'

const { t } = useI18n()

const actionTypeMap: Record<string, string> = {
  IMAGE_GEN: t('pricing.actionTypeImage'),
  VIDEO_GEN: t('pricing.actionTypeVideo'),
  TEXT_CHAT: t('pricing.actionTypeText'),
  AI_TOOL: t('pricing.actionTypeTool'),
}

const priceUnitMap: Record<string, string> = {
  PER_REQUEST: t('pricing.unitPerRequest'),
  PER_IMAGE: t('pricing.unitPerImage'),
  PER_SECOND: t('pricing.unitPerSecond'),
  PER_1K_TOKENS: t('pricing.unitPer1kTokens'),
}

const actionTypeOptions = [
  { label: t('pricing.actionTypeImage'), value: 'IMAGE_GEN' },
  { label: t('pricing.actionTypeVideo'), value: 'VIDEO_GEN' },
  { label: t('pricing.actionTypeText'), value: 'TEXT_CHAT' },
  { label: t('pricing.actionTypeTool'), value: 'AI_TOOL' },
]

const priceUnitOptions = [
  { label: t('pricing.unitPerRequest'), value: 'PER_REQUEST' },
  { label: t('pricing.unitPerImage'), value: 'PER_IMAGE' },
  { label: t('pricing.unitPerSecond'), value: 'PER_SECOND' },
  { label: t('pricing.unitPer1kTokens'), value: 'PER_1K_TOKENS' },
]

const columns = [
  {
    title: t('model.modelName'),
    dataIndex: 'modelName',
    width: 180,
  },
  {
    title: t('pricing.actionType'),
    dataIndex: 'actionType',
    searchType: 'select' as const,
    searchOptions: actionTypeOptions,
    width: 120,
  },
  {
    title: t('pricing.pricePoints'),
    dataIndex: 'pricePoints',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('pricing.priceUnit'),
    dataIndex: 'priceUnit',
    width: 150,
  },
  {
    title: t('pricing.effectiveTime'),
    dataIndex: 'effectiveTime',
    width: 180,
  },
  {
    title: t('pricing.effectiveTimeRange'),
    dataIndex: 'effectiveTimeRange',
    width: 240,
  },
  {
    title: t('model.status'),
    dataIndex: 'status',
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
    dataIndex: 'action',
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

const modelList = ref<AIModel[]>([])
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  modelId: undefined as number | undefined,
  modelName: '',
  actionType: 'IMAGE_GEN',
  pricePoints: 0,
  priceUnit: 'PER_REQUEST',
  effectiveTime: null as dayjs.Dayjs | null,
  statusChecked: 1,
})

async function loadModels() {
  try {
    const res = await getModelList({ pageNo: 1, pageSize: 100 })
    modelList.value = res.list
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await getPricingList({
    modelId: params.modelId as number | undefined,
    actionType: params.actionType as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function handleCreate() {
  isEdit.value = false
  editId.value = null
  formData.modelId = undefined
  formData.modelName = ''
  formData.actionType = 'IMAGE_GEN'
  formData.pricePoints = 0
  formData.priceUnit = 'PER_REQUEST'
  formData.effectiveTime = null
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: ModelPricing) {
  isEdit.value = true
  editId.value = record.id
  formData.modelId = record.modelId
  formData.modelName = record.modelName || ''
  formData.actionType = record.actionType || 'IMAGE_GEN'
  formData.pricePoints = record.pricePoints || 0
  formData.priceUnit = record.priceUnit || 'PER_REQUEST'
  formData.effectiveTime = record.effectiveTime ? dayjs(record.effectiveTime) : null
  formData.statusChecked = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.modelId) {
    message.error(t('pricing.modelRequired'))
    return
  }
  if (!formData.actionType) {
    message.error(t('pricing.actionTypeRequired'))
    return
  }
  if (!formData.pricePoints || formData.pricePoints <= 0) {
    message.error(t('pricing.pricePointsRequired'))
    return
  }

  submitLoading.value = true
  try {
    const data = {
      modelId: formData.modelId,
      actionType: formData.actionType,
      pricePoints: formData.pricePoints,
      priceUnit: formData.priceUnit,
      effectiveTime: formData.effectiveTime ? formData.effectiveTime.toISOString() : undefined,
      status: formData.statusChecked,
    }

    if (isEdit.value && editId.value) {
      await updatePricing(editId.value, data)
      message.success(t('pricing.updateSuccess'))
    } else {
      await createPricing(data)
      message.success(t('pricing.createSuccess'))
    }
    modalVisible.value = false
  } catch (error) {
    console.error('Failed to save pricing:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleDelete(record: any) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('pricing.confirmDeletePricing'),
    onOk: async () => {
      await deletePricing(record.id)
      message.success(t('pricing.deleteSuccess'))
    },
  })
}

function filterModelOption(input: string, option: any) {
  const model = modelList.value.find(m => m.id === option.value)
  if (!model) return false
  return model.name.toLowerCase().includes(input.toLowerCase())
}

onMounted(() => {
  loadModels()
})
</script>
