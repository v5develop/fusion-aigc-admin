<template>
  <div class="page-container">
    <a-card :title="$t('reconciliation.difference')">
      <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
        <template #emptyText>
          <a-empty :description="$t('reconciliation.noDifferenceData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'differenceType'">
            <a-tag :color="typeColorMap[record.differenceType]">
              {{ typeMap[record.differenceType] || record.differenceType }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColorMap[record.status]">
              {{ statusMap[record.status] || '-' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'amount'">
            <span :class="record.amount > 0 ? 'text-green-500' : 'text-red-500'">
              {{ record.amount > 0 ? '+' : '' }}{{ record.amount }}
            </span>
          </template>

          <template v-if="column.key === 'operation'">
            <a-button
              v-if="record.status === 'OPEN'"
              type="link"
              size="small"
              @click="handleOpenDialog(record)"
            >
              {{ $t('reconciliation.handleAction') }}
            </a-button>
          </template>
        </template>
      </ProTable>

      <a-modal
        v-model:open="dialogVisible"
        :title="$t('reconciliation.handleAction')"
        @ok="handleConfirm"
        :confirmLoading="submitting"
      >
        <a-form layout="vertical" :model="formState" ref="formRef">
          <a-form-item :label="$t('reconciliation.reservationNo')">
            <span>{{ currentRecord.reservationNo || '-' }}</span>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.bizType')">
            <a-tag>{{ currentRecord.bizType || '-' }}</a-tag>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.type')">
            <a-tag :color="typeColorMap[currentRecord.differenceType]">
              {{ typeMap[currentRecord.differenceType] || currentRecord.differenceType }}
            </a-tag>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.localPoints')">
            <span>{{ currentRecord.localPoints ?? '-' }}</span>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.remotePoints')">
            <span>{{ currentRecord.remotePoints ?? '-' }}</span>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.differenceValue')">
            <span :class="currentRecord.amount > 0 ? 'text-green-500' : 'text-red-500'">
              {{ currentRecord.amount > 0 ? '+' : '' }}{{ currentRecord.amount }}
            </span>
          </a-form-item>
          <a-form-item :label="$t('reconciliation.handleAction')" name="action">
            <a-select
              v-model:value="formState.action"
              :options="actionOptions"
              :placeholder="$t('reconciliation.actionRequired')"
            />
          </a-form-item>
          <a-form-item :label="$t('reconciliation.handleRemark')" name="remark">
            <a-textarea
              v-model:value="formState.remark"
              :rows="3"
              :placeholder="$t('reconciliation.handleRemarkRequired')"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getDifferenceList, handleDifference } from '@/api/reconciliation';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();

const tableRef = ref();

const dialogVisible = ref(false);
const submitting = ref(false);
const currentRecord = reactive({
  id: 0,
  differenceType: '',
  amount: 0,
  reservationNo: '',
  bizType: '',
  localPoints: 0,
  remotePoints: 0,
});

/**
 * 处理方式下拉项。
 *
 * <b>必须用 :options，不能写 a-select-option 子标签。</b>
 * antdv-next 的 a-select 在渲染底层 VcSelect 时第三个参数（children）直接传 null
 * （见 antdv-next/dist/select/index.js 的 createVNode(VcSelect, ..., null)），
 * 默认插槽全程没被引用过——所以 a-select-option 写了也到不了下拉框。
 * 组件本身是注册过的（ASelectOption），因此不会有 Vue 警告、不会报错，
 * 只是下拉框空着，这个坑仓库里已经踩过一次（见 user/detail 的注释）。
 *
 * 用 computed 是因为标签要跟着语言切换走，写成常量切语言就不更新了。
 */
const actionOptions = computed(() => [
  { label: t('reconciliation.compensate'), value: 'compensate' },
  { label: t('reconciliation.deduct'), value: 'deduct' },
  { label: t('reconciliation.ignore'), value: 'ignore' },
]);

const formState = reactive({
  action: '',
  remark: '',
});

const typeMap: Record<string, string> = {
  grant_missing: '发放遗漏',
  grant_extra: '多发',
  consume_missing: '消费遗漏',
  consume_extra: '多扣',
  refund_missing: '退款遗漏',
  refund_extra: '多退',
};

const typeColorMap: Record<string, string> = {
  grant_missing: 'orange',
  grant_extra: 'red',
  consume_missing: 'orange',
  consume_extra: 'red',
  refund_missing: 'orange',
  refund_extra: 'red',
};

const statusMap: Record<string, string> = {
  OPEN: t('reconciliation.statusMap.pending'),
  COMPENSATED: t('reconciliation.statusMap.compensated'),
  DEDUCTED: t('reconciliation.statusMap.deducted'),
  IGNORED: t('reconciliation.statusMap.ignored'),
};

const statusColorMap: Record<string, string> = {
  OPEN: 'orange',
  COMPENSATED: 'green',
  DEDUCTED: 'green',
  IGNORED: 'default',
};

const columns = [
  {
    title: t('reconciliation.reconcileNo'),
    dataIndex: 'reconcileNo',
    width: 180,
  },
  {
    title: t('reconciliation.reservationNo'),
    dataIndex: 'reservationNo',
    width: 180,
  },
  {
    title: t('reconciliation.type'),
    dataIndex: 'differenceType',
    search: true,
    searchType: 'select' as const,
    searchOptions: Object.entries(typeMap).map(([value, label]) => ({ label, value })),
    width: 120,
  },
  {
    title: t('reconciliation.bizType'),
    dataIndex: 'bizType',
    width: 120,
  },
  {
    title: t('reconciliation.differenceValue'),
    dataIndex: 'amount',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.localPoints'),
    dataIndex: 'localPoints',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.remotePoints'),
    dataIndex: 'remotePoints',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.status'),
    dataIndex: 'status',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('reconciliation.statusMap.pending'), value: 'OPEN' },
      { label: t('reconciliation.statusMap.compensated'), value: 'COMPENSATED' },
      { label: t('reconciliation.statusMap.deducted'), value: 'DEDUCTED' },
      { label: t('reconciliation.statusMap.ignored'), value: 'IGNORED' },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('reconciliation.bizId'),
    dataIndex: 'bizId',
    width: 120,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 120,
    align: 'center' as const,
  },
];

async function loadData(params: Record<string, unknown>) {
  const res = await getDifferenceList({
    status: params.status as string | undefined,
    differenceType: params.differenceType as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 20,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

function handleOpenDialog(record: {
  id: number;
  differenceType: string;
  amount: number;
  reservationNo?: string;
  bizType?: string;
  localPoints?: number;
  remotePoints?: number;
}) {
  currentRecord.id = record.id;
  currentRecord.differenceType = record.differenceType;
  currentRecord.amount = record.amount;
  currentRecord.reservationNo = record.reservationNo || '';
  currentRecord.bizType = record.bizType || '';
  currentRecord.localPoints = record.localPoints ?? 0;
  currentRecord.remotePoints = record.remotePoints ?? 0;
  formState.action = '';
  formState.remark = '';
  dialogVisible.value = true;
}

async function handleConfirm() {
  if (!formState.action) {
    message.warning(t('reconciliation.actionRequired'));
    return;
  }
  if (!formState.remark) {
    message.warning(t('reconciliation.handleRemarkRequired'));
    return;
  }
  submitting.value = true;
  try {
    await handleDifference({
      id: currentRecord.id,
      action: formState.action,
      remark: formState.remark,
    });
    message.success(t('reconciliation.handleSuccess'));
    dialogVisible.value = false;
    // 处理完必须重查：差异行的状态会从 OPEN 变成已处理，不刷新的话那一行还挂在
    // 列表上、状态也没变，看着像没生效，运营会重复点第二次
    tableRef.value?.refresh();
  } catch {
    // 拦截器已提示。这里必须接住：不接的话异常会逃逸成 unhandled rejection，
    // 只在控制台留一行日志。也不能顺手关弹窗——失败时留着，用户改完可以直接重试
  } finally {
    submitting.value = false;
  }
}
</script>
