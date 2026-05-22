<template>
  <div class="page-container">
    <a-card :title="$t('billing.exceptionTitle')">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'billingStatus'">
            <a-tag :color="billingStatusColorMap[record.billingStatus]">
              {{ billingStatusMap[record.billingStatus] || record.billingStatus || '-' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="processStatusColorMap[record.status]">
              {{ processStatusMap[record.status] || record.status || '-' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'errorMsg'">
            <a-tooltip :title="record.errorMsg">
              <span class="text-ellipsis">{{ record.errorMsg }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a-space>
              <a-button
                v-if="record.status === 'OPEN'"
                type="link"
                size="small"
                @click="handleRetry(record)"
              >
                {{ $t('billing.retry') }}
              </a-button>
              <a-button
                v-if="record.status === 'OPEN'"
                type="link"
                size="small"
                danger
                @click="handleOpenIgnore(record)"
              >
                {{ $t('billing.ignore') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>

    <a-modal
      v-model:open="ignoreVisible"
      :title="$t('billing.ignore')"
      @ok="handleConfirmIgnore"
      :confirmLoading="submitting"
    >
      <a-form layout="vertical" :model="ignoreForm" ref="ignoreFormRef">
        <a-form-item
          :label="$t('billing.remark')"
          name="remark"
          :rules="[{ required: true, message: $t('billing.remarkRequired') }]"
        >
          <a-textarea
            v-model:value="ignoreForm.remark"
            :rows="3"
            :placeholder="$t('billing.remarkRequired')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getExceptionList, retryException, ignoreException } from '@/api/billing-exception'
import type { FormInstance } from 'antdv-next'

const { t } = useI18n()

const billingStatusMap: Record<string, string> = {
  HELD: t('billing.billingStatusMap.held'),
  CONFIRMED: t('billing.billingStatusMap.confirmed'),
  REFUNDED: t('billing.billingStatusMap.refunded'),
  CANCELLED: t('billing.billingStatusMap.cancelled'),
  SETTLEMENT_FAILED: t('billing.billingStatusMap.settlementFailed'),
}

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
}

const processStatusMap: Record<string, string> = {
  OPEN: t('billing.processStatusMap.open'),
  RESOLVED: t('billing.processStatusMap.resolved'),
  IGNORED: t('billing.processStatusMap.ignored'),
}

const processStatusColorMap: Record<string, string> = {
  OPEN: 'red',
  RESOLVED: 'green',
  IGNORED: 'default',
}

const columns = [
  {
    title: t('billing.taskId'),
    dataIndex: 'taskId',
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('billing.reservationNo'),
    dataIndex: 'reservationNo',
    width: 180,
  },
  {
    title: t('billing.userId'),
    dataIndex: 'userId',
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('billing.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('billing.bizType'),
    dataIndex: 'bizType',
    searchType: 'select' as const,
    searchOptions: [
      { label: 'IMAGE_GEN', value: 'IMAGE_GEN' },
      { label: 'VIDEO_GEN', value: 'VIDEO_GEN' },
    ],
    width: 120,
  },
  {
    title: t('billing.billingStatus'),
    dataIndex: 'billingStatus',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('billing.billingStatusMap.held'), value: 'HELD' },
      { label: t('billing.billingStatusMap.confirmed'), value: 'CONFIRMED' },
      { label: t('billing.billingStatusMap.refunded'), value: 'REFUNDED' },
      { label: t('billing.billingStatusMap.cancelled'), value: 'CANCELLED' },
      { label: t('billing.billingStatusMap.settlementFailed'), value: 'SETTLEMENT_FAILED' },
    ],
    width: 140,
    align: 'center' as const,
  },
  {
    title: t('billing.pricePoints'),
    dataIndex: 'pricePoints',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('billing.processStatus'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('billing.processStatusMap.open'), value: 'OPEN' },
      { label: t('billing.processStatusMap.resolved'), value: 'RESOLVED' },
      { label: t('billing.processStatusMap.ignored'), value: 'IGNORED' },
    ],
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('billing.errorMsg'),
    dataIndex: 'errorMsg',
    ellipsis: true,
    width: 200,
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

async function loadData(params: Record<string, unknown>) {
  const res = await getExceptionList({
    userId: params.userId as number | undefined,
    bizType: params.bizType as string | undefined,
    billingStatus: params.billingStatus as string | undefined,
    status: params.status as string | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.items || [],
    total: res.total || 0,
    success: true,
  }
}

const submitting = ref(false)
const ignoreVisible = ref(false)
const ignoreFormRef = ref<FormInstance>()
const ignoreForm = ref({ remark: '' })
const currentExceptionId = ref(0)

function handleRetry(record: { id: number }) {
  Modal.confirm({
    title: t('billing.retry'),
    content: t('billing.confirmRetry'),
    onOk: async () => {
      try {
        await retryException(record.id)
        message.success(t('billing.retrySuccess'))
      } catch (error) {
        console.error('Failed to retry exception:', error)
      }
    },
  })
}

function handleOpenIgnore(record: { id: number }) {
  currentExceptionId.value = record.id
  ignoreForm.value.remark = ''
  ignoreVisible.value = true
}

async function handleConfirmIgnore() {
  try {
    await ignoreFormRef.value?.validateFields()
    submitting.value = true
    await ignoreException({
      id: currentExceptionId.value,
      remark: ignoreForm.value.remark,
    })
    message.success(t('billing.ignoreSuccess'))
    ignoreVisible.value = false
  } catch (error) {
    if ((error as any).errorFields) return
    console.error('Failed to ignore exception:', error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.text-ellipsis {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
