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
        <a-empty :description="$t('feature.noFeatureData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> {{ $t('feature.createFeature') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'featureName'">
          {{ record.featureName?.[currentLocale] || record.featureName?.['zh-CN'] || '-' }}
        </template>

        <template v-if="column.dataIndex === 'description'">
          {{ record.description?.[currentLocale] || record.description?.['zh-CN'] || '-' }}
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
      :title="isEdit ? $t('feature.editFeature') : $t('feature.createFeature')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('feature.featureCode')" required>
          <a-input
            v-model:value="formData.featureCode"
            :placeholder="$t('feature.featureCodePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.featureName')" required>
          <I18nInput
            v-model:value="formData.featureName"
            :placeholder="$t('feature.featureNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.description')">
          <I18nInput
            v-model:value="formData.description"
            :placeholder="$t('feature.descriptionPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('feature.status')">
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
import { ref, reactive, computed } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import I18nInput from '@/components/I18nInput/index.vue'
import { getFeatureList, createFeature, updateFeature, deleteFeature } from '@/api/feature'
import type { Feature } from '@/types/api'
import { getLocale } from '@/locales'

const { t } = useI18n()
const currentLocale = computed(() => getLocale())

const columns = [
  {
    title: t('feature.featureCode'),
    dataIndex: 'featureCode',
    searchType: 'input' as const,
    width: 150,
  },
  {
    title: t('feature.featureName'),
    dataIndex: 'featureName',
    searchType: 'input' as const,
    width: 200,
  },
  {
    title: t('feature.description'),
    dataIndex: 'description',
    ellipsis: true,
  },
  {
    title: t('feature.modelCount'),
    dataIndex: 'modelCount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('feature.status'),
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
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 150,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  featureCode: '',
  featureName: {} as Record<string, string>,
  description: {} as Record<string, string>,
  statusChecked: 1,
})

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureList({
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
  formData.featureCode = ''
  formData.featureName = {}
  formData.description = {}
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: Feature) {
  isEdit.value = true
  editId.value = record.id
  formData.featureCode = record.featureCode
  formData.featureName = record.featureName || {}
  formData.description = record.description || {}
  formData.statusChecked = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.featureCode) {
    message.error(t('feature.featureCodeRequired'))
    return
  }
  if (!formData.featureName || !Object.values(formData.featureName).some(v => v)) {
    message.error(t('feature.featureNameRequired'))
    return
  }

  submitLoading.value = true
  try {
    const data = {
      featureCode: formData.featureCode,
      featureName: formData.featureName,
      description: formData.description,
      status: formData.statusChecked,
    }

    if (isEdit.value && editId.value) {
      await updateFeature(editId.value, data)
      message.success(t('feature.updateSuccess'))
    } else {
      await createFeature(data)
      message.success(t('feature.createSuccess'))
    }
    modalVisible.value = false
  } catch (error) {
    console.error('Failed to save feature:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleDelete(record: Feature) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('feature.confirmDeleteFeature'),
    onOk: async () => {
      await deleteFeature(record.id)
      message.success(t('feature.deleteSuccess'))
    },
  })
}
</script>
