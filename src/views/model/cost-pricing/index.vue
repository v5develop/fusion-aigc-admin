<template>
  <div class="page-container">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :request="loadData"
      :search="{}"
      :toolbar="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('costPricing.noPricingData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('costPricing.createCostPricing') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'modelName'">
          {{ record.modelName || '-' }}
        </template>

        <template v-if="column.dataIndex === 'modelCode'">
          {{ record.modelCode || '-' }}
        </template>

        <template v-if="column.dataIndex === 'meterType'">
          <a-tag>{{ meterTypeMap[record.meterType] || record.meterType || '-' }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'costAmount'">
          <span v-if="record.costAmount != null">¥ {{ record.costAmount }}</span>
          <span v-else>-</span>
        </template>

        <template v-if="column.dataIndex === 'costUnit'">
          <a-tag>{{ costUnitMap[record.costUnit] || record.costUnit || '-' }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'provider'">
          {{ record.provider || '-' }}
        </template>

        <template v-if="column.dataIndex === 'effectiveTimeRange'">
          <span v-if="record.effectiveTime">{{ record.effectiveTime }}</span>
          <span v-else>-</span>
          <span v-if="record.expireTime"> ~ {{ record.expireTime }}</span>
          <span v-else-if="record.effectiveTime"> ~ {{ $t('costPricing.permanent') }}</span>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.key === 'operation'">
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
      :title="isEdit ? $t('costPricing.editCostPricing') : $t('costPricing.createCostPricing')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('model.modelName')" required>
          <a-select
            v-model:value="formData.modelId"
            :placeholder="$t('costPricing.selectModel')"
            show-search
            :filter-option="filterModelOption"
            :disabled="isEdit"
            :options="modelSelectOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('costPricing.meterType')" required>
          <a-select v-model:value="formData.meterType" :options="meterTypeOptions" />
        </a-form-item>
        <a-form-item :label="$t('costPricing.costAmount')" required>
          <a-input-number
            v-model:value="formData.costAmount"
            :min="0"
            :precision="6"
            prefix="¥"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('costPricing.costUnit')">
          <a-select v-model:value="formData.costUnit" :options="costUnitOptions" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('costPricing.actionType')">
          <a-input v-model:value="formData.actionType" allow-clear />
          <div class="form-hint">{{ $t('costPricing.actionTypeHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('costPricing.provider')">
          <a-input v-model:value="formData.provider" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('costPricing.providerModel')">
          <a-input v-model:value="formData.providerModel" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('costPricing.effectiveTime')">
          <a-date-picker
            v-model:value="formData.effectiveTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('costPricing.expireTime')">
          <a-date-picker
            v-model:value="formData.expireTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            :placeholder="$t('costPricing.expireTimePlaceholder')"
          />
          <div class="form-hint">{{ $t('costPricing.expireTimeHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :un-checked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getCostPricingList,
  createCostPricing,
  updateCostPricing,
  deleteCostPricing,
} from '@/api/cost-pricing'
import { getModelOptions } from '@/api/model'
import type { ModelCostPricing, AIModel } from '@/types/api'

const { t } = useI18n()

const meterTypeMap: Record<string, string> = {
  image: t('costPricing.meterImage'),
  video: t('costPricing.meterVideo'),
  second: t('costPricing.meterSecond'),
  token: t('costPricing.meterToken'),
}

const meterTypeOptions = [
  { label: t('costPricing.meterImage'), value: 'image' },
  { label: t('costPricing.meterVideo'), value: 'video' },
  { label: t('costPricing.meterSecond'), value: 'second' },
  { label: t('costPricing.meterToken'), value: 'token' },
]

const costUnitMap: Record<string, string> = {
  PER_IMAGE: t('costPricing.unitPerImage'),
  PER_REQUEST: t('costPricing.unitPerRequest'),
  PER_SECOND: t('costPricing.unitPerSecond'),
  PER_VIDEO: t('costPricing.unitPerVideo'),
}

const costUnitOptions = [
  { label: t('costPricing.unitPerImage'), value: 'PER_IMAGE' },
  { label: t('costPricing.unitPerRequest'), value: 'PER_REQUEST' },
  { label: t('costPricing.unitPerSecond'), value: 'PER_SECOND' },
  { label: t('costPricing.unitPerVideo'), value: 'PER_VIDEO' },
]

const columns = computed(() => [
  {
    title: t('model.modelName'),
    dataIndex: 'modelName',
    width: 150,
  },
  {
    title: t('model.modelCode'),
    dataIndex: 'modelCode',
    width: 150,
  },
  {
    title: t('costPricing.meterType'),
    dataIndex: 'meterType',
    search: true,
    searchType: 'select' as const,
    searchOptions: meterTypeOptions,
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('costPricing.costAmount'),
    dataIndex: 'costAmount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('costPricing.costUnit'),
    dataIndex: 'costUnit',
    width: 150,
  },
  {
    title: t('costPricing.provider'),
    dataIndex: 'provider',
    width: 140,
  },
  {
    title: t('costPricing.effectiveTime'),
    dataIndex: 'effectiveTime',
    width: 180,
  },
  {
    title: t('costPricing.effectiveTimeRange'),
    dataIndex: 'effectiveTimeRange',
    width: 240,
  },
  {
    title: t('model.status'),
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
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
])

const tableRef = ref()
const modelList = ref<AIModel[]>([])
const modelSelectOptions = computed(() => modelList.value.map(m => ({ label: m.name, value: m.id })))
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  modelId: undefined as number | undefined,
  meterType: 'image' as string,
  costAmount: undefined as number | undefined,
  costUnit: 'PER_IMAGE' as string,
  actionType: '' as string,
  provider: '' as string,
  providerModel: '' as string,
  effectiveTime: undefined as string | undefined,
  expireTime: undefined as string | undefined,
  statusChecked: 1,
})

async function loadModels() {
  try {
    modelList.value = await getModelOptions()
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await getCostPricingList({
    modelId: params.modelId as number | undefined,
    meterType: params.meterType as string | undefined,
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

function handleCreate() {
  isEdit.value = false
  editId.value = null
  formData.modelId = undefined
  formData.meterType = 'image'
  formData.costAmount = undefined
  formData.costUnit = 'PER_IMAGE'
  formData.actionType = ''
  formData.provider = ''
  formData.providerModel = ''
  formData.effectiveTime = undefined
  formData.expireTime = undefined
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: ModelCostPricing) {
  isEdit.value = true
  editId.value = record.id
  formData.modelId = record.modelId
  formData.meterType = record.meterType || 'image'
  formData.costAmount = record.costAmount ?? undefined
  formData.costUnit = record.costUnit || 'PER_IMAGE'
  formData.actionType = record.actionType || ''
  formData.provider = record.provider || ''
  formData.providerModel = record.providerModel || ''
  formData.effectiveTime = record.effectiveTime || undefined
  formData.expireTime = record.expireTime || undefined
  formData.statusChecked = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.modelId) {
    message.error(t('costPricing.modelRequired'))
    return
  }
  if (!formData.meterType) {
    message.error(t('costPricing.meterTypeRequired'))
    return
  }
  if (formData.costAmount == null || formData.costAmount <= 0) {
    message.error(t('costPricing.costAmountRequired'))
    return
  }

  submitLoading.value = true
  try {
    const actionType = (formData.actionType || '').trim()
    const provider = (formData.provider || '').trim()
    const providerModel = (formData.providerModel || '').trim()

    if (isEdit.value && editId.value) {
      // 编辑：可清空的字段送 '' 表示清回 NULL（后端契约：null=不改，''=清空）。
      const data = {
        modelId: formData.modelId,
        meterType: formData.meterType,
        costAmount: formData.costAmount,
        costUnit: formData.costUnit,
        actionType, // '' 表示清空
        provider, // '' 表示清空
        providerModel, // '' 表示清空
        effectiveTime: formData.effectiveTime || undefined,
        expireTime: formData.expireTime ?? '', // '' 表示清回永久有效
        status: formData.statusChecked,
      }
      await updateCostPricing(editId.value, data)
      message.success(t('costPricing.updateSuccess'))
    } else {
      // 新增：空的可选字段直接省略。
      const data = {
        modelId: formData.modelId,
        meterType: formData.meterType,
        costAmount: formData.costAmount,
        costUnit: formData.costUnit,
        actionType: actionType || undefined,
        provider: provider || undefined,
        providerModel: providerModel || undefined,
        effectiveTime: formData.effectiveTime || undefined,
        expireTime: formData.expireTime || undefined,
        status: formData.statusChecked,
      }
      await createCostPricing(data)
      message.success(t('costPricing.createSuccess'))
    }
    modalVisible.value = false
    tableRef.value?.reload()
  } catch (error) {
    console.error('Failed to save cost pricing:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleDelete(record: ModelCostPricing) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('costPricing.confirmDeletePricing'),
    onOk: async () => {
      await deleteCostPricing(record.id)
      message.success(t('costPricing.deleteSuccess'))
      tableRef.value?.reload()
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

<style scoped>
.form-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-tertiary);
}
</style>
