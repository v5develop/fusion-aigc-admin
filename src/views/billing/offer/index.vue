<template>
  <div class="page-container">
    <a-page-header :title="$t('billingOffer.title')" style="padding: 0 0 16px">
      <template #extra>
        <a-button @click="handleRefreshCache" :loading="refreshing">
          <ReloadOutlined /> {{ $t('billingOffer.refreshCache') }}
        </a-button>
      </template>
    </a-page-header>

    <!-- Offer Table -->
    <ProTable
      ref="tableRef"
      :columns="offerColumns"
      :request="loadOffers"
      row-key="id"
      :expandable="{ columnWidth: 48 }"
    >
      <template #toolbar>
        <a-button type="primary" @click="openOfferModal(null)">
          <PlusOutlined /> {{ $t('billingOffer.createOffer') }}
        </a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 'ENABLED' ? 'green' : record.status === 'DISABLED' ? 'red' : 'default'">
            {{ $t('billingOffer.statusMap.' + record.status) || record.status }}
          </a-tag>
        </template>
        <template v-if="column.dataIndex === 'modes'">
          <span>{{ record.modes }}</span>
        </template>
        <template v-if="column.key === 'operation'">
          <a-space>
            <a-button type="link" size="small" @click="openOfferModal(record)">{{ $t('common.edit') }}</a-button>
            <a-popconfirm
              :title="$t('billingOffer.confirmDeleteOffer')"
              @confirm="handleDeleteOffer(record.id)"
            >
              <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>

      <!-- Expanded Row: Variants -->
      <template #expandedRowRender="{ record: offer }">
        <div style="padding: 8px 0 8px 24px">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
            <strong>{{ $t('billingOffer.variants') }}</strong>
            <a-button type="dashed" size="small" @click.stop="openVariantModal(offer, null)">
              <PlusOutlined /> {{ $t('billingOffer.createVariant') }}
            </a-button>
          </div>
          <a-table
            :columns="variantColumns"
            :data-source="offer._variants"
            :pagination="false"
            row-key="id"
            size="small"
            bordered
            :expandable="{ columnWidth: 48 }"
          >
            <template #bodyCell="{ column, record: v }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="v.status === 'ENABLED' ? 'green' : 'red'">{{ v.status }}</a-tag>
              </template>
              <template v-if="column.key === 'operation'">
                <a-space>
                  <a-button type="link" size="small" @click.stop="openVariantModal(offer, v)">{{ $t('common.edit') }}</a-button>
                  <a-popconfirm
                    :title="$t('billingOffer.confirmDeleteVariant')"
                    @confirm="handleDeleteVariant(offer, v.id)"
                  >
                    <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>

            <!-- Variant Expanded Row: Components -->
            <template #expandedRowRender="{ record: variant }">
              <div style="padding: 4px 0 4px 24px">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                  <span style="color: #666">{{ $t('billingOffer.components') }}</span>
                  <a-button type="dashed" size="small" @click.stop="openComponentModal(offer, variant, null)">
                    <PlusOutlined /> {{ $t('billingOffer.createComponent') }}
                  </a-button>
                </div>
                <a-table
                  :columns="componentColumns"
                  :data-source="variant.components"
                  :pagination="false"
                  row-key="id"
                  size="small"
                  bordered
                >
                  <template #bodyCell="{ column, record: c }">
                    <template v-if="column.dataIndex === 'costType'">
                      <a-tag :color="c.costType === 'BILLED' ? 'blue' : 'orange'">{{ c.costType }}</a-tag>
                    </template>
                    <template v-if="column.key === 'operation'">
                      <a-space>
                        <a-button type="link" size="small" @click.stop="openComponentModal(offer, variant, c)">{{ $t('common.edit') }}</a-button>
                        <a-popconfirm
                          :title="$t('billingOffer.confirmDeleteComponent')"
                          @confirm="handleDeleteComponent(variant, c.id)"
                        >
                          <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
                        </a-popconfirm>
                      </a-space>
                    </template>
                  </template>
                </a-table>
              </div>
            </template>
          </a-table>
        </div>
      </template>
    </ProTable>

    <!-- Offer Modal -->
    <a-modal
      v-model:open="offerModalVisible"
      :title="editingOffer ? $t('common.edit') : $t('billingOffer.createOffer')"
      :confirm-loading="submitLoading"
      @ok="handleOfferSubmit"
    >
      <a-form :model="offerForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.offerCode')" required>
              <a-input v-model:value="offerForm.offerCode" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.name')" required>
              <a-input v-model:value="offerForm.name" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.entryCode')" required>
              <a-input v-model:value="offerForm.entryCode" :disabled="!!editingOffer" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.featureCode')" required>
              <a-select v-model:value="offerForm.featureCode" :options="featureOptions" show-search :filter-option="filterFeatureOption" :placeholder="$t('billingOffer.featureCodePlaceholder')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.category')">
              <a-select v-model:value="offerForm.category" allow-clear :options="categoryOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.billingScene')">
              <a-select v-model:value="offerForm.billingScene" allow-clear :options="billingSceneOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.status')">
              <a-select v-model:value="offerForm.status" :options="statusOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('billingOffer.sort')">
          <a-input-number v-model:value="offerForm.sort" :min="0" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Variant Modal -->
    <a-modal
      v-model:open="variantModalVisible"
      :title="editingVariant ? $t('common.edit') : $t('billingOffer.createVariant')"
      :confirm-loading="submitLoading"
      @ok="handleVariantSubmit"
    >
      <a-form :model="variantForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.variantCode')" required>
              <a-input v-model:value="variantForm.variantCode" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.variantName')" required>
              <a-input v-model:value="variantForm.name" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.qualityTier')">
              <a-select v-model:value="variantForm.qualityTier" allow-clear :options="qualityTierOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.settlementType')">
              <a-select v-model:value="variantForm.settlementType" :options="settlementTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.defaultModelId')">
              <a-select v-model:value="variantForm.defaultModelId" :options="modelOptions" show-search allow-clear :filter-option="filterModelOption" placeholder="请选择模型" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.includedOutputs')">
              <a-input-number v-model:value="variantForm.includedOutputs" :min="1" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.status')">
              <a-select v-model:value="variantForm.status" :options="statusOptions" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- Component Modal -->
    <a-modal
      v-model:open="componentModalVisible"
      :title="editingComponent ? $t('common.edit') : $t('billingOffer.createComponent')"
      :confirm-loading="submitLoading"
      @ok="handleComponentSubmit"
    >
      <a-form :model="componentForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.componentCode')" required>
              <a-input v-model:value="componentForm.componentCode" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('billingOffer.stepCode')" required>
              <a-input v-model:value="componentForm.stepCode" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.mode')" required>
              <a-input-number v-model:value="componentForm.mode" :min="1" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.componentType')">
              <a-select v-model:value="componentForm.componentType" allow-clear :options="componentTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.costType')">
              <a-select v-model:value="componentForm.costType" :options="costTypeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.modelId')">
              <a-select v-model:value="componentForm.modelId" :options="modelOptions" show-search allow-clear :filter-option="filterModelOption" placeholder="请选择模型" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.repeatCount')">
              <a-input-number v-model:value="componentForm.repeatCount" :min="1" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="$t('billingOffer.sort')">
              <a-input-number v-model:value="componentForm.sort" :min="0" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'antdv-next'
import { getFeatureOptions } from '@/api/feature'
import { getModelOptions } from '@/api/model'
import type { Feature, AIModel } from '@/types/api'
import { PlusOutlined, ReloadOutlined } from '@antdv-next/icons'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getOfferTree, createOffer, updateOffer, deleteOffer,
  createVariant, updateVariant, deleteVariant,
  createComponent, updateComponent, deleteComponent,
  refreshOfferCache,
} from '@/api/billing-offer'
import type { BillingOffer, BillingOfferVariant, ChargeComponent, OfferTreeNode } from '@/api/billing-offer'

const { t, locale } = useI18n()
const tableRef = ref()

// Feature options (创作能力下拉)
const featureOptions = ref<{ label: string; value: string }[]>([])
const featureList = ref<Feature[]>([])
async function loadFeatureOptions() {
  try {
    const list = await getFeatureOptions()
    featureList.value = list || []
    updateFeatureOptions()
  } catch { /* ignore */ }
}
function updateFeatureOptions() {
  const lang = locale.value || 'zh-CN'
  featureOptions.value = featureList.value.map(f => ({
    label: `${f.featureCode} - ${(f.featureName as Record<string, string>)?.[lang] || f.featureCode}`,
    value: f.featureCode,
  }))
}
function filterFeatureOption(input: string, option: { label?: string }) {
  return option.label?.toLowerCase().includes(input.toLowerCase()) ?? false
}
loadFeatureOptions()

// Model options (模型下拉)
const modelOptions = ref<{ label: string; value: number }[]>([])
const modelList = ref<AIModel[]>([])
async function loadModelOptions() {
  try {
    const list = await getModelOptions()
    modelList.value = list || []
    updateModelOptions()
  } catch { /* ignore */ }
}
function updateModelOptions() {
  modelOptions.value = modelList.value.map(m => ({
    label: `${m.name} (${m.code})`,
    value: m.id,
  }))
}
function filterModelOption(input: string, option: { label?: string }) {
  return option.label?.toLowerCase().includes(input.toLowerCase()) ?? false
}
loadModelOptions()

const submitLoading = ref(false)
const refreshing = ref(false)

// ======================== Offer ========================

const offerColumns = [
  { title: t('billingOffer.offerCode'), dataIndex: 'offerCode', width: 160 },
  { title: t('billingOffer.name'), dataIndex: 'name', width: 120 },
  { title: t('billingOffer.entryCode'), dataIndex: 'entryCode', width: 150 },
  { title: t('billingOffer.featureCode'), dataIndex: 'featureCode', width: 120 },
  { title: t('billingOffer.category'), dataIndex: 'category', width: 80 },
  { title: t('billingOffer.modes'), dataIndex: 'modes', width: 130 },
  { title: t('billingOffer.status'), dataIndex: 'status', width: 90 },
  { title: t('billingOffer.sort'), dataIndex: 'sort', width: 60 },
  { title: t('common.action'), dataIndex: 'operation', key: 'operation', fixed: 'right' as const, width: 140 },
]

async function loadOffers(params: Record<string, unknown>) {
  // 调用分页 tree 接口，传递分页参数和搜索条件
  const { current, pageSize, ...searchParams } = params as { current?: number; pageSize?: number; [key: string]: unknown }
  const result = await getOfferTree({
    page: current,
    pageSize: pageSize,
    ...searchParams,
  })
  // 挂载 _variants 别名 + 计算 modes 展示列
  const data = (result.list || []).map((offer: OfferTreeNode) => {
    (offer as unknown as Record<string, unknown>)._variants = offer.variants || []
    // 从所有 components 提取去重 mode
    const modes = [...new Set(
      (offer.variants || []).flatMap(v => (v.components || []).map(c => c.mode))
    )].sort((a, b) => a - b)
    ;(offer as unknown as Record<string, unknown>).modes = modes.length ? modes.join(', ') : '-'
    return offer
  })
  return { data, total: result.total, success: true }
}

const offerModalVisible = ref(false)
const editingOffer = ref<BillingOffer | null>(null)
const offerForm = reactive<Partial<BillingOffer>>({
  offerCode: '', name: '', entryCode: '', featureCode: '', category: '', billingScene: '', status: 'ENABLED', sort: 0,
})

function openOfferModal(record: BillingOffer | null) {
  editingOffer.value = record
  if (record) Object.assign(offerForm, record)
  else {
    Object.assign(offerForm, { offerCode: '', name: '', entryCode: '', featureCode: '', category: '', billingScene: '', status: 'ENABLED', sort: 0 })
  }
  offerModalVisible.value = true
}

async function handleOfferSubmit() {
  submitLoading.value = true
  try {
    if (editingOffer.value) {
      await updateOffer(editingOffer.value.id!, offerForm)
      message.success(t('billingOffer.updateSuccess'))
    } else {
      await createOffer(offerForm)
      message.success(t('billingOffer.createSuccess'))
    }
    offerModalVisible.value = false
    tableRef.value?.reload()
  } catch { /* error handled by interceptor */ } finally { submitLoading.value = false }
}

async function handleDeleteOffer(id: number) {
  await deleteOffer(id)
  message.success(t('billingOffer.deleteSuccess'))
  tableRef.value?.reload()
}

// ======================== Variant ========================

const variantColumns = [
  { title: t('billingOffer.variantCode'), dataIndex: 'variantCode', width: 200 },
  { title: t('billingOffer.variantName'), dataIndex: 'name', width: 140 },
  { title: t('billingOffer.qualityTier'), dataIndex: 'qualityTier', width: 100 },
  { title: t('billingOffer.settlementType'), dataIndex: 'settlementType', width: 130 },
  { title: t('billingOffer.defaultModelId'), dataIndex: 'defaultModelId', width: 100 },
  { title: t('billingOffer.status'), dataIndex: 'status', width: 90 },
  { title: t('common.action'), dataIndex: 'operation', key: 'operation', width: 140 },
]

const variantModalVisible = ref(false)
const editingVariant = ref<BillingOfferVariant | null>(null)
const currentOffer = ref<BillingOffer | null>(null)
const variantForm = reactive<Partial<BillingOfferVariant>>({
  variantCode: '', name: '', qualityTier: 'standard', settlementType: 'ALL_OR_NOTHING', defaultModelId: undefined,
  includedOutputs: 1, status: 'ENABLED',
})

function openVariantModal(offer: BillingOffer, record: BillingOfferVariant | null) {
  currentOffer.value = offer
  editingVariant.value = record
  if (record) Object.assign(variantForm, record)
  else Object.assign(variantForm, { variantCode: '', name: '', qualityTier: 'standard', settlementType: 'ALL_OR_NOTHING', defaultModelId: undefined, includedOutputs: 1, status: 'ENABLED' })
  variantModalVisible.value = true
}

async function handleVariantSubmit() {
  submitLoading.value = true
  try {
    if (editingVariant.value) {
      await updateVariant(editingVariant.value.id!, variantForm)
      message.success(t('billingOffer.updateSuccess'))
    } else {
      await createVariant(currentOffer.value!.id!, variantForm)
      message.success(t('billingOffer.createSuccess'))
    }
    variantModalVisible.value = false
    tableRef.value?.reload()
  } catch { /* error handled by interceptor */ } finally { submitLoading.value = false }
}

async function handleDeleteVariant(_offer: BillingOffer, id: number) {
  await deleteVariant(id)
  message.success(t('billingOffer.deleteSuccess'))
  tableRef.value?.reload()
}

// ======================== Component ========================

const componentColumns = [
  { title: t('billingOffer.componentCode'), dataIndex: 'componentCode', width: 180 },
  { title: t('billingOffer.stepCode'), dataIndex: 'stepCode', width: 140 },
  { title: t('billingOffer.mode'), dataIndex: 'mode', width: 70 },
  { title: t('billingOffer.componentType'), dataIndex: 'componentType', width: 100 },
  { title: t('billingOffer.costType'), dataIndex: 'costType', width: 100 },
  { title: t('billingOffer.repeatCount'), dataIndex: 'repeatCount', width: 80 },
  { title: t('billingOffer.sort'), dataIndex: 'sort', width: 60 },
  { title: t('common.action'), dataIndex: 'operation', key: 'operation', width: 140 },
]

const componentModalVisible = ref(false)
const editingComponent = ref<ChargeComponent | null>(null)
const currentVariant = ref<BillingOfferVariant | null>(null)
const componentForm = reactive<Partial<ChargeComponent>>({
  componentCode: '', stepCode: '', componentType: 'BASE', mode: 103, costType: 'BILLED',
  modelId: undefined, repeatCount: 1, sort: 0,
})

function openComponentModal(_offer: BillingOffer, variant: BillingOfferVariant, record: ChargeComponent | null) {
  currentVariant.value = variant
  editingComponent.value = record
  if (record) Object.assign(componentForm, record)
  else Object.assign(componentForm, { componentCode: '', stepCode: '', componentType: 'BASE', mode: 103, costType: 'BILLED', modelId: undefined, repeatCount: 1, sort: 0 })
  componentModalVisible.value = true
}

async function handleComponentSubmit() {
  submitLoading.value = true
  try {
    if (editingComponent.value) {
      await updateComponent(editingComponent.value.id!, componentForm)
      message.success(t('billingOffer.updateSuccess'))
    } else {
      await createComponent(currentVariant.value!.id!, componentForm)
      message.success(t('billingOffer.createSuccess'))
    }
    componentModalVisible.value = false
    tableRef.value?.reload()
  } catch { /* error handled by interceptor */ } finally { submitLoading.value = false }
}

async function handleDeleteComponent(_variant: BillingOfferVariant, id: number) {
  await deleteComponent(id)
  message.success(t('billingOffer.deleteSuccess'))
  tableRef.value?.reload()
}

// ======================== Cache ========================

async function handleRefreshCache() {
  refreshing.value = true
  try {
    await refreshOfferCache()
    message.success(t('billingOffer.cacheRefreshed'))
  } catch { /* */ } finally { refreshing.value = false }
}

const categoryOptions = ['IMAGE','VIDEO','WEARING'].map(v => ({ label: v, value: v }))
const billingSceneOptions = ['IMAGE_GEN','VIDEO_GEN','CREATION'].map(v => ({ label: v, value: v }))
const qualityTierOptions = ['standard','hd','pro'].map(v => ({ label: v, value: v }))
const settlementTypeOptions = ['ALL_OR_NOTHING','PARTIAL'].map(v => ({ label: v, value: v }))
const statusOptions = ['ENABLED','DISABLED','DRAFT'].map(v => ({ label: v, value: v }))
const componentTypeOptions = ['BASE','OUTPUT','MODULE','DURATION','QUALITY'].map(v => ({ label: v, value: v }))
const costTypeOptions = ['BILLED','COST_ONLY'].map(v => ({ label: v, value: v }))
</script>
