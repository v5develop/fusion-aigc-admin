<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #toolBar>
        <a-button type="primary" @click="showManualAddModal">
          {{ $t('featureGrant.manualAdd') }}
        </a-button>
      </template>
      <template #emptyText>
        <a-empty :description="$t('feature.noGrantData')" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'featureName'">
          {{ record.featureName?.[currentLocale] || record.featureName?.['zh-CN'] || '-' }}
        </template>

        <template v-if="column.dataIndex === 'source'">
          <a-tag :color="record.source === 'union' ? 'blue' : 'orange'">
            {{ featureGrantSourceMap[record.source] || record.source }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColorMap[record.status]">
            {{ featureGrantStatusMap[record.status] || '-' }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'effectiveTime' || column.dataIndex === 'expireTime'">
          {{ record[column.dataIndex] || '-' }}
        </template>

        <template v-if="column.key === 'operation'">
          <a-button
            v-if="record.status === 1"
            type="link"
            size="small"
            danger
            @click="handleRevoke(record)"
          >
            {{ $t('featureGrant.revoke') }}
          </a-button>
          <a-button
            v-if="record.status === 1"
            type="link"
            size="small"
            danger
            @click="handleManualRemove(record)"
          >
            {{ $t('featureGrant.manualRemove') }}
          </a-button>
        </template>
      </template>
    </ProTable>

    <!-- 手动添加创作能力弹窗 -->
    <a-modal
      v-model:open="manualAddVisible"
      :title="$t('featureGrant.manualAdd')"
      @ok="handleManualAddOk"
      @cancel="manualAddVisible = false"
    >
      <a-form :model="manualAddForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('featureGrant.unionUserId')" required>
          <a-input
            v-model:value="manualAddForm.unionUserId"
            :placeholder="$t('featureGrant.unionUserIdPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('featureGrant.featureCode')" required>
          <a-select
            v-model:value="manualAddForm.featureCode"
            :placeholder="$t('featureGrant.selectFeature')"
            :options="featureSelectOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('featureGrant.expireTime')">
          <a-date-picker v-model:value="manualAddForm.expireTime" show-time style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { Feature } from '@/types/api';

import { message, Modal } from 'antdv-next';
import dayjs from 'dayjs';
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getFeatureGrantList,
  revokeFeature,
  manualAddFeature,
  manualRemoveFeature,
  getFeatureOptions,
} from '@/api/feature';
import ProTable from '@/components/Pro/ProTable/index.vue';
import { getLocale } from '@/locales';

const { t } = useI18n();
/**
 * 表格句柄。增删改之后必须重查——本页此前一个 ref 都没有，改完数据列表还是旧的，
 * 看着像没生效，运营会重复点第二次。
 * 用 refresh() 而不是 reload()：refresh 保持当前页码，在第 N 页处理完不会被甩回第一页。
 */
const tableRef = ref();

const currentLocale = computed(() => getLocale());

const featureGrantSourceMap: Record<string, string> = {
  union: t('featureGrant.sourceMap.union'),
  manual: t('featureGrant.sourceMap.manual'),
};

const featureGrantStatusMap: Record<number, string> = {
  1: t('featureGrant.statusMap.active'),
  2: t('featureGrant.statusMap.expired'),
  3: t('featureGrant.statusMap.revoked'),
};

const statusColorMap: Record<number, string> = {
  1: 'green',
  2: 'default',
  3: 'red',
};

const columns = [
  {
    title: t('featureGrant.userId'),
    dataIndex: 'userId',
    search: true,
    searchType: 'input' as const,
    width: 100,
  },
  {
    title: t('featureGrant.username'),
    dataIndex: 'username',
    search: true,
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('featureGrant.featureName'),
    dataIndex: 'featureName',
    width: 180,
  },
  {
    title: t('featureGrant.source'),
    dataIndex: 'source',
    search: true,
    searchType: 'select' as const,
    searchOptions: [
      { label: t('featureGrant.sourceMap.union'), value: 'union' },
      { label: t('featureGrant.sourceMap.manual'), value: 'manual' },
    ],
    width: 100,
  },
  {
    title: t('featureGrant.effectiveTime'),
    dataIndex: 'effectiveTime',
    width: 180,
  },
  {
    title: t('featureGrant.expireTime'),
    dataIndex: 'expireTime',
    width: 180,
  },
  {
    title: t('featureGrant.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('featureGrant.statusMap.active'), value: 1 },
      { label: t('featureGrant.statusMap.expired'), value: 2 },
      { label: t('featureGrant.statusMap.revoked'), value: 3 },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.action'),
    dataIndex: 'operation',
    key: 'operation',
    width: 180,
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

async function loadData(params: Record<string, unknown>) {
  const res = await getFeatureGrantList({
    userId: params.userId as number | undefined,
    username: params.username as string | undefined,
    source: params.source as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  };
}

function handleRevoke(record: { id: number }) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('featureGrant.confirmRevoke'),
    onOk: async () => {
      await revokeFeature(record.id);
      message.success(t('featureGrant.revokeSuccess'));
      tableRef.value?.refresh();
    },
  });
}

function handleManualRemove(record: { id: number }) {
  Modal.confirm({
    title: t('common.warning'),
    content: t('featureGrant.confirmManualRemove'),
    onOk: async () => {
      await manualRemoveFeature(record.id);
      message.success(t('featureGrant.manualRemoveSuccess'));
      tableRef.value?.refresh();
    },
  });
}

// 手动添加相关
const manualAddVisible = ref(false);
const manualAddForm = ref({
  unionUserId: '',
  featureCode: undefined as string | undefined,
  expireTime: undefined as dayjs.Dayjs | undefined,
});
const featureOptions = ref<Feature[]>([]);
const featureSelectOptions = computed(() =>
  featureOptions.value.map((f) => ({
    label: f.featureName?.[currentLocale.value] || f.featureName?.['zh-CN'] || f.featureCode,
    value: f.featureCode,
  })),
);

function showManualAddModal() {
  manualAddForm.value = {
    unionUserId: '',
    featureCode: undefined,
    expireTime: undefined,
  };
  manualAddVisible.value = true;
}

async function handleManualAddOk() {
  if (!manualAddForm.value.unionUserId) {
    message.error(t('featureGrant.unionUserIdRequired'));
    return;
  }
  if (!manualAddForm.value.featureCode) {
    message.error(t('featureGrant.featureCodeRequired'));
    return;
  }
  await manualAddFeature({
    unionUserId: manualAddForm.value.unionUserId,
    featureCode: manualAddForm.value.featureCode,
    expireTime: manualAddForm.value.expireTime?.format('YYYY-MM-DD HH:mm:ss'),
  });
  message.success(t('featureGrant.manualAddSuccess'));
  tableRef.value?.refresh();
  manualAddVisible.value = false;
}

onMounted(async () => {
  const res = await getFeatureOptions();
  featureOptions.value = res || [];
});
</script>
