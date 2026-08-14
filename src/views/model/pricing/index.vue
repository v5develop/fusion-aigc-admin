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
        <a-empty :description="$t('pricing.noPricingData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('pricing.createPricing') }}
        </a-button>
        <a-button style="margin-left: 8px" :loading="refreshing" @click="handleRefreshCache">
          <ReloadOutlined /> {{ $t('pricing.refreshCache') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'modelName'">
          {{ record.modelName || '-' }}
        </template>

        <template v-if="column.dataIndex === 'modelCode'">
          {{ record.modelCode || '-' }}
        </template>

        <template v-if="column.dataIndex === 'actionType'">
          <a-tag>{{ actionTypeMap[record.actionType] || record.actionType }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'priceUnit'">
          <a-tag>{{ priceUnitMap[record.priceUnit] || record.priceUnit || '-' }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'resolution'">
          <span v-if="record.resolution">{{ record.resolution }}</span>
          <a-tag v-else color="default">{{ $t('pricing.generic') }}</a-tag>
        </template>

        <template v-if="column.dataIndex === 'durationSeconds'">
          <span v-if="record.durationSeconds != null">{{ record.durationSeconds }}s</span>
          <a-tag v-else color="default">{{ $t('pricing.generic') }}</a-tag>
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
            :options="modelSelectOptions"
          />
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
            :placeholder="$t('pricing.pricePointsPlaceholder')"
          />
          <div class="form-hint">{{ $t('pricing.pricePointsZeroHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('pricing.priceUnit')">
          <a-select v-model:value="formData.priceUnit" :options="priceUnitOptions" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('pricing.resolution')">
          <a-input
            v-model:value="formData.resolution"
            allow-clear
            :placeholder="$t('pricing.resolutionPlaceholder')"
          />
          <div class="form-hint">{{ $t('pricing.resolutionHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('pricing.durationSeconds')">
          <a-input-number
            v-model:value="formData.durationSeconds"
            :min="0"
            :precision="0"
            style="width: 100%"
            :placeholder="$t('pricing.durationPlaceholder')"
          />
          <div class="form-hint">
            {{ formData.priceUnit === 'PER_SECOND' ? $t('pricing.durationHintPerSecond') : $t('pricing.durationHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('pricing.effectiveTime')">
          <a-date-picker
            v-model:value="formData.effectiveTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('pricing.expireTime')">
          <a-date-picker
            v-model:value="formData.expireTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            :placeholder="$t('pricing.expireTimePlaceholder')"
          />
          <div class="form-hint">{{ $t('pricing.expireTimeHint') }}</div>
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
import { PlusOutlined, ReloadOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getPricingList, createPricing, updatePricing, deletePricing } from '@/api/pricing'
import { refreshOfferCache } from '@/api/billing-offer'
import { getModelOptions } from '@/api/model'
import { getActionTypesAll } from '@/api/action-type'
import type { ModelPricing, ActionType, AIModel } from '@/types/api'

const { t } = useI18n()

const actionTypeList = ref<ActionType[]>([])
const actionTypeOptions = computed(() =>
  actionTypeList.value.map(item => ({ label: item.actionName, value: item.actionCode }))
)
const actionTypeMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const item of actionTypeList.value) {
    map[item.actionCode] = item.actionName
  }
  return map
})

const priceUnitMap: Record<string, string> = {
  PER_REQUEST: t('pricing.unitPerRequest'),
  PER_IMAGE: t('pricing.unitPerImage'),
  PER_SECOND: t('pricing.unitPerSecond'),
  PER_1K_TOKENS: t('pricing.unitPer1kTokens'),
}

const priceUnitOptions = [
  { label: t('pricing.unitPerRequest'), value: 'PER_REQUEST' },
  { label: t('pricing.unitPerImage'), value: 'PER_IMAGE' },
  { label: t('pricing.unitPerSecond'), value: 'PER_SECOND' },
  { label: t('pricing.unitPer1kTokens'), value: 'PER_1K_TOKENS' },
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
    title: t('pricing.actionType'),
    dataIndex: 'actionType',
    search: true,
    searchType: 'select' as const,
    searchOptions: actionTypeOptions.value,
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
    title: t('pricing.resolution'),
    dataIndex: 'resolution',
    width: 110,
    align: 'center' as const,
  },
  {
    title: t('pricing.durationSeconds'),
    dataIndex: 'durationSeconds',
    width: 110,
    align: 'center' as const,
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
const refreshing = ref(false)

// 刷新计费缓存（OfferService）：改完定价/组件后同步内核缓存，避免报价用旧配置
async function handleRefreshCache() {
  refreshing.value = true
  try {
    await refreshOfferCache()
    message.success(t('pricing.cacheRefreshed'))
  } catch { /* 拦截器已处理 */ } finally {
    refreshing.value = false
  }
}

const formData = reactive({
  modelId: undefined as number | undefined,
  modelName: '',
  actionType: '' as string,
  // 默认留空而非 0：0 现在是合法定价（免费档），默认填 0 会让「忘了填」直接存成免费
  pricePoints: undefined as number | undefined,
  priceUnit: 'PER_REQUEST',
  resolution: '' as string,
  durationSeconds: undefined as number | undefined,
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

async function loadActionTypes() {
  try {
    actionTypeList.value = await getActionTypesAll()
  } catch (error) {
    console.error('Failed to load action types:', error)
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await getPricingList({
    modelId: params.modelId as number | undefined,
    actionType: params.actionType as string | undefined,
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
  formData.modelName = ''
  formData.actionType = actionTypeList.value[0]?.actionCode || ''
  formData.pricePoints = undefined
  formData.priceUnit = 'PER_REQUEST'
  formData.resolution = ''
  formData.durationSeconds = undefined
  formData.effectiveTime = undefined
  formData.expireTime = undefined
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: ModelPricing) {
  isEdit.value = true
  editId.value = record.id
  formData.modelId = record.modelId
  formData.modelName = record.modelName || ''
  formData.actionType = record.actionType || ''
  // ?? 而非 ||：0 元行必须回显成 0，用 || 会被当成空值再填成 0——看着一样，但下面校验的语义不同
  formData.pricePoints = record.pricePoints ?? undefined
  formData.priceUnit = record.priceUnit || 'PER_REQUEST'
  formData.resolution = record.resolution || ''
  formData.durationSeconds = record.durationSeconds ?? undefined
  formData.effectiveTime = record.effectiveTime || undefined
  formData.expireTime = record.expireTime || undefined
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
  // 0 是合法定价（如豆包加工厂走用户自己绑定的账号，平台侧不收费），故不能用 falsy 判空——
  // 那会把「填了 0」和「没填」混为一谈。留空(null)与负数才拒。
  if (formData.pricePoints == null || formData.pricePoints < 0) {
    message.error(t('pricing.pricePointsRequired'))
    return
  }
  const pricePoints = formData.pricePoints

  submitLoading.value = true
  try {
    const resolution = (formData.resolution || '').trim()
    const hasDuration = formData.durationSeconds != null && formData.durationSeconds >= 0

    if (isEdit.value && editId.value) {
      // 编辑：显式发送分档键/过期时间，支持清回通用档/永久有效。
      // 后端契约：resolution 空串=清 NULL；durationSeconds 负数(-1)=清 NULL；expireTime 空串=清 NULL。
      const data = {
        modelId: formData.modelId,
        actionType: formData.actionType,
        pricePoints,
        priceUnit: formData.priceUnit,
        resolution, // '' 表示清回通用档
        durationSeconds: hasDuration ? formData.durationSeconds : -1, // -1 表示清回通用档
        effectiveTime: formData.effectiveTime || undefined,
        expireTime: formData.expireTime ?? '', // '' 表示清回永久有效
        status: formData.statusChecked,
      }
      await updatePricing(editId.value, data)
      message.success(t('pricing.updateSuccess'))
    } else {
      // 新增：空分档键直接省略，由后端归一为通用档（NULL）。
      const data = {
        modelId: formData.modelId,
        actionType: formData.actionType,
        pricePoints,
        priceUnit: formData.priceUnit,
        resolution: resolution || undefined,
        durationSeconds: hasDuration ? formData.durationSeconds : undefined,
        effectiveTime: formData.effectiveTime || undefined,
        expireTime: formData.expireTime || undefined,
        status: formData.statusChecked,
      }
      await createPricing(data)
      message.success(t('pricing.createSuccess'))
    }
    modalVisible.value = false
    tableRef.value?.reload()
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
  loadActionTypes()
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
