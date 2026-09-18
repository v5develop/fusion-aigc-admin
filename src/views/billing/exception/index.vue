<template>
  <div class="page-container">
    <a-card :title="$t('billing.exceptionTitle')">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="tasks" :tab="$t('billing.exceptionTasks')" />
        <a-tab-pane key="aged" :tab="$t('billing.agedHeldReservations')" />
      </a-tabs>

      <!-- 异常任务列表 -->
      <ProTable
        v-if="activeTab === 'tasks'"
        :columns="taskColumns"
        :request="loadTasks"
        :search="{}"
        row-key="taskId"
      >
        <template #emptyText>
          <a-empty :description="$t('billing.noExceptionData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'taskType'">
            <a-tag :color="record.taskType === 'IMAGE' ? 'blue' : 'purple'">
              {{ record.taskType === 'IMAGE' ? '图片' : '视频' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'billingStatus'">
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
          <template v-else-if="column.key === 'operation'">
            <a-space>
              <a-button type="link" size="small" @click="handleOpenCompensation(record, 'RETRY')">
                重试
              </a-button>
              <a-button type="link" size="small" @click="handleOpenCompensation(record, 'REFUND')">
                退款
              </a-button>
              <a-button
                type="link"
                size="small"
                danger
                @click="handleOpenCompensation(record, 'IGNORE')"
              >
                忽略
              </a-button>
            </a-space>
          </template>
        </template>
      </ProTable>

      <!-- 过期占用扣费单 -->
      <a-table
        v-if="activeTab === 'aged'"
        :columns="agedColumns"
        :data-source="agedList"
        :loading="agedLoading"
        row-key="reservationNo"
        :pagination="false"
      >
        <template #title>
          <a-button type="primary" size="small" :loading="recoverLoading" @click="handleRecover">
            手动恢复
          </a-button>
        </template>
        <template #emptyText>
          <a-empty description="暂无过期占用扣费单" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'classificationReason'">
            <a-tag :color="getClassificationColor(record.classificationReason)">
              {{ record.classificationReason || '-' }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 补偿操作弹窗 -->
    <a-modal
      v-model:open="compensationVisible"
      :title="compensationTitle"
      @ok="handleConfirmCompensation"
      :confirmLoading="submitting"
    >
      <a-form layout="vertical" :model="compensationForm">
        <a-form-item label="原因" name="reason">
          <a-textarea
            v-model:value="compensationForm.reason"
            :rows="3"
            placeholder="请输入操作原因"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, computed } from 'vue';

import {
  getExceptionTasks,
  getAgedHeldReservations,
  executeCompensation,
  recoverAgedHeldReservations,
} from '@/api/billing-exception';
import ProTable from '@/components/Pro/ProTable/index.vue';
import { uuid } from '@/utils/helpers';

const activeTab = ref('tasks');

const billingStatusMap: Record<string, string> = {
  HELD: '预扣占用',
  CONFIRMED: '已确认',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
  SETTLEMENT_FAILED: '结算失败',
  PARTIALLY_REFUNDED: '部分退款',
  BILLING_PENDING_REVIEW: '待审核',
};

const billingStatusColorMap: Record<string, string> = {
  HELD: 'blue',
  CONFIRMED: 'green',
  REFUNDED: 'orange',
  PARTIALLY_REFUNDED: 'warning',
  CANCELLED: 'default',
  SETTLEMENT_FAILED: 'red',
  BILLING_PENDING_REVIEW: 'warning',
};

const processStatusMap: Record<string, string> = {
  0: '排队中',
  1: '处理中',
  2: '已完成',
  3: '失败',
  5: '部分成功',
};

const processStatusColorMap: Record<string, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'error',
  5: 'warning',
};

const taskColumns = [
  {
    title: '任务类型',
    dataIndex: 'taskType',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: '图片', value: 'IMAGE' },
      { label: '视频', value: 'VIDEO' },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: '任务ID',
    dataIndex: 'taskId',
    width: 200,
  },
  {
    title: '扣费单号',
    dataIndex: 'reservationNo',
    width: 180,
  },
  {
    title: '用户ID',
    dataIndex: 'userId',
    search: true,
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: '计费状态',
    dataIndex: 'billingStatus',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: '结算失败', value: 'SETTLEMENT_FAILED' },
      { label: '待审核', value: 'BILLING_PENDING_REVIEW' },
    ],
    width: 140,
    align: 'center' as const,
  },
  {
    title: '预扣点数',
    dataIndex: 'pricePoints',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '任务状态',
    dataIndex: 'status',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '错误信息',
    dataIndex: 'errorMsg',
    ellipsis: true,
    width: 200,
  },
  {
    title: '审核原因',
    dataIndex: 'reviewReason',
    width: 180,
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: '操作',
    dataIndex: 'operation',
    key: 'operation',
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

const agedColumns = [
  { title: '扣费单号', dataIndex: 'reservationNo', width: 180 },
  { title: '用户ID', dataIndex: 'userId', width: 100 },
  { title: '功能编码', dataIndex: 'featureCode', width: 120 },
  { title: '模型ID', dataIndex: 'modelId', width: 100 },
  { title: '预扣点数', dataIndex: 'pricePoints', width: 100, align: 'center' as const },
  { title: '业务类型', dataIndex: 'bizType', width: 120 },
  { title: '业务ID', dataIndex: 'bizId', width: 180 },
  { title: '分类原因', dataIndex: 'classificationReason', width: 200 },
  { title: '过期时间', dataIndex: 'expireTime', width: 180 },
  { title: '创建时间', dataIndex: 'createTime', width: 180 },
];

const recoverLoading = ref(false);

function getClassificationColor(reason: string): string {
  if (!reason) return 'default';
  if (reason.includes('FAILED')) return 'red';
  if (reason.includes('UNSETTLED')) return 'orange';
  if (reason.includes('RUNNING')) return 'blue';
  return 'default';
}

async function handleRecover() {
  try {
    recoverLoading.value = true;
    const count = await recoverAgedHeldReservations();
    message.success(`恢复成功，共处理 ${count} 条记录`);
    await loadAgedReservations();
  } catch (error) {
    console.error('Failed to recover aged held reservations:', error);
  } finally {
    recoverLoading.value = false;
  }
}

async function loadTasks(params: Record<string, unknown>) {
  const res = await getExceptionTasks({
    taskType: params.taskType as string | undefined,
    userId: params.userId as number | undefined,
    billingStatus: params.billingStatus as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

const agedList = ref<any[]>([]);
const agedLoading = ref(false);

async function loadAgedReservations() {
  agedLoading.value = true;
  try {
    const res = await getAgedHeldReservations({ limit: 100 });
    agedList.value = res || [];
  } catch (error) {
    console.error('Failed to load aged held reservations:', error);
  } finally {
    agedLoading.value = false;
  }
}

// 补偿操作
const submitting = ref(false);
const compensationVisible = ref(false);
const compensationForm = ref({ reason: '' });
const compensationAction = ref('RETRY' as 'RETRY' | 'IGNORE' | 'REFUND');
const compensationReservationNo = ref('');

const compensationTitle = computed(() => {
  const map = { RETRY: '重试结算', REFUND: '退款', IGNORE: '忽略' };
  return map[compensationAction.value] || '补偿操作';
});

function handleOpenCompensation(
  record: { reservationNo: string },
  action: 'RETRY' | 'IGNORE' | 'REFUND',
) {
  compensationAction.value = action;
  compensationReservationNo.value = record.reservationNo;
  compensationForm.value.reason = '';
  compensationVisible.value = true;
}

async function handleConfirmCompensation() {
  const reason = compensationForm.value.reason.trim();
  if (!reason) {
    message.warning('请输入操作原因');
    return;
  }
  if (/^\d+$/.test(reason) || reason.length < 2) {
    message.warning('操作原因不能为纯数字且至少2个字符');
    return;
  }
  try {
    submitting.value = true;
    await executeCompensation({
      actionType: compensationAction.value,
      reservationNo: compensationReservationNo.value,
      requestId: uuid(),
      reason,
    });
    message.success('操作成功');
    compensationVisible.value = false;
    // 刷新列表
    if (activeTab.value === 'tasks') {
      // ProTable 会自动刷新
    } else {
      await loadAgedReservations();
    }
  } catch (error) {
    console.error('Failed to execute compensation:', error);
  } finally {
    submitting.value = false;
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
