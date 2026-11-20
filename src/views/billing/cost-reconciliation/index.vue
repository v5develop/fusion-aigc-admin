<template>
  <div class="page-container">
    <a-card :title="$t('costRecon.title')">
      <template #extra>
        <a-space wrap>
          <a-range-picker
            v-model:value="range"
            :allow-clear="false"
            :disabled-date="disableFuture"
            @change="loadDaily"
          />
          <a-button :loading="dailyLoading" @click="loadDaily">{{ $t('common.refresh') }}</a-button>
          <a-button v-if="canRun" type="primary" @click="openRun">
            {{ $t('costRecon.run.button') }}
          </a-button>
        </a-space>
      </template>

      <!-- 判据说明：只报警，不自动追扣 -->
      <a-collapse v-model:activeKey="guideOpen" ghost class="guide">
        <a-collapse-panel key="guide" :header="$t('costRecon.guide.title')">
          <p class="sub-text">{{ $t('costRecon.guide.intro') }}</p>
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item v-for="c in CHECK_GUIDE" :key="c.code">
              <template #label>
                <a-tag :color="levelColor(c.level)">{{ c.level }}</a-tag>
                {{ checkName(c.code) }}
              </template>
              <div>{{ $t(`costRecon.guide.${c.key}.meaning`) }}</div>
              <div class="sub-text">
                {{ $t('costRecon.guide.actionPrefix') }}{{ $t(`costRecon.guide.${c.key}.action`) }}
              </div>
            </a-descriptions-item>
          </a-descriptions>
        </a-collapse-panel>
      </a-collapse>

      <!-- 日汇总：日期 × 判据 × 来源 -->
      <a-table
        :columns="dailyColumns"
        :data-source="dailyRows"
        :loading="dailyLoading"
        :row-key="dailyRowKey"
        :row-class-name="dailyRowClass"
        :custom-row="dailyCustomRow"
        :pagination="false"
        :scroll="{ x: 1200 }"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('costRecon.emptyDaily')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'check'">
            <a-tag :color="levelColor(record.level)">{{ record.level || '-' }}</a-tag>
            <span>{{ checkName(record.check, record.checkLabel) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'costCny'">
            {{ formatCny(record.costCny) }}
          </template>
          <template v-else-if="column.dataIndex === 'revenueCny'">
            {{ formatCny(record.revenueCny) }}
          </template>
          <template v-else-if="column.dataIndex === 'chargedPoints'">
            {{ record.chargedPoints ?? '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'sampleBizNos'">
            <a-space v-if="record.sampleBizNos?.length" :size="4" wrap>
              <a-typography-text
                v-for="no in record.sampleBizNos"
                :key="no"
                code
                :copyable="{ text: no }"
              >
                {{ no }}
              </a-typography-text>
            </a-space>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-button
              v-if="drillable(record)"
              type="link"
              size="small"
              @click.stop="openDetails(record)"
            >
              {{ $t('costRecon.viewDetails') }}
            </a-button>
            <a-tooltip v-else :title="$t('costRecon.infoNoDetail')">
              <span class="sub-text">-</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 明细：某日某判据，按成本降序 -->
    <a-card v-if="selected" class="detail-card">
      <template #title>
        {{ $t('costRecon.detailTitle', { date: selected.date }) }}
        <a-tag :color="levelColor(selected.level)" class="title-tag">
          {{ checkName(selected.check, selected.checkLabel) }}
        </a-tag>
      </template>
      <template #extra>
        <a-space wrap>
          <a-select
            v-model:value="filter.source"
            :options="sourceOptions"
            :placeholder="$t('costRecon.col.source')"
            allow-clear
            style="width: 160px"
            @change="searchDetails"
          />
          <a-input-search
            v-model:value="filter.bizNo"
            :placeholder="$t('costRecon.bizNoPlaceholder')"
            allow-clear
            style="width: 240px"
            @search="searchDetails"
          />
          <a-button @click="selected = null">{{ $t('common.close') }}</a-button>
        </a-space>
      </template>

      <a-table
        :columns="detailColumns"
        :data-source="detailRows"
        :loading="detailLoading"
        row-key="id"
        :pagination="detailPagination"
        :scroll="{ x: 1700 }"
        size="middle"
        @change="onDetailTableChange"
      >
        <template #emptyText>
          <a-empty :description="$t('costRecon.emptyDetail')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'bizNo'">
            <a-typography-text v-if="record.bizNo" :copyable="{ text: record.bizNo }">
              {{ record.bizNo }}
            </a-typography-text>
            <span v-else class="sub-text">{{ $t('costRecon.noBizNo') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'costCny'">
            {{ formatCny(record.costCny) }}
          </template>
          <template v-else-if="column.dataIndex === 'revenueCny'">
            {{ formatCny(record.revenueCny) }}
          </template>
          <template v-else-if="column.dataIndex === 'chargedPoints'">
            {{ record.chargedPoints ?? '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'reservationNo'">
            <div v-if="record.reservationNo">
              <a-typography-text :copyable="{ text: record.reservationNo }">
                {{ record.reservationNo }}
              </a-typography-text>
              <div>
                <a-tag v-if="record.reservationStatus">{{ record.reservationStatus }}</a-tag>
              </div>
            </div>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.dataIndex === 'callId'">
            <a-tooltip v-if="record.callId" :title="callTooltip(record)">
              <a-typography-text code :copyable="{ text: record.callId }">
                {{ record.callId }}
              </a-typography-text>
            </a-tooltip>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.dataIndex === 'attemptCount'">
            <a-tag :color="(record.attemptCount ?? 0) > 1 ? 'orange' : 'default'">
              {{ record.attemptCount ?? '-' }}
            </a-tag>
          </template>
          <template
            v-else-if="column.dataIndex === 'callerId' || column.dataIndex === 'modelGroup'"
          >
            {{ record[column.dataIndex as 'callerId' | 'modelGroup'] || '-' }}
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 手动重跑某天 -->
    <a-modal
      v-model:open="runVisible"
      :title="$t('costRecon.run.title')"
      :confirm-loading="running"
      :ok-text="$t('costRecon.run.ok')"
      @ok="confirmRun"
    >
      <a-alert type="info" show-icon class="run-hint" :message="$t('costRecon.run.hint')" />
      <a-date-picker
        v-model:value="runDate"
        :disabled-date="disableTodayAndFuture"
        :allow-clear="false"
        style="width: 100%"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type {
  CostReconDaily,
  CostReconDetail,
  CostReconLevel,
  CostReconRunResult,
} from '@/api/billing-cost-reconciliation';
import type { RequestError } from '@/utils/request';
import type { Dayjs } from 'dayjs';

import { Modal, message } from 'antdv-next';
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getCostReconDaily,
  getCostReconDetails,
  runCostRecon,
} from '@/api/billing-cost-reconciliation';
import { usePermission } from '@/composables/usePermission';

const { t, te } = useI18n();
const { hasAnyRole } = usePermission();

/** 与后端 run 接口的 @PreAuthorize 一致 */
const canRun = computed(() => hasAnyRole(['super_admin', 'billing_admin']));

const DATE_FMT = 'YYYY-MM-DD';
const MAX_RANGE_DAYS = 92;
const DEFAULT_PAGE_SIZE = 20;

/** 判据说明：key 对应 locales 里 costRecon.guide.<key> */
const CHECK_GUIDE: { code: string; key: string; level: CostReconLevel }[] = [
  { code: 'recon.cost_refunded', key: 'refunded', level: 'ERROR' },
  { code: 'recon.cost_no_charge', key: 'noCharge', level: 'ERROR' },
  { code: 'recon.cost_unkeyed', key: 'unkeyed', level: 'WARN' },
  { code: 'recon.cost_over_revenue', key: 'overRevenue', level: 'WARN' },
  { code: 'recon.cost_overhead', key: 'overhead', level: 'INFO' },
  { code: 'recon.cost_free', key: 'free', level: 'INFO' },
];
const CHECK_KEY = Object.fromEntries(CHECK_GUIDE.map((c) => [c.code, c.key]));
const LEVEL_ORDER: Record<string, number> = { ERROR: 0, WARN: 1, INFO: 2 };

function checkName(code: string, fallback?: string) {
  const key = CHECK_KEY[code];
  const path = `costRecon.check.${key}`;
  if (key && te(path)) return t(path);
  return fallback || code;
}

function levelColor(level: string | null | undefined) {
  if (level === 'ERROR') return 'red';
  if (level === 'WARN') return 'gold';
  return 'default';
}

function formatCny(v: number | null | undefined) {
  if (v === null || v === undefined) return '-';
  return `¥${Number(v).toFixed(4)}`;
}

function disableFuture(d: Dayjs) {
  return d.isAfter(dayjs(), 'day');
}

function disableTodayAndFuture(d: Dayjs) {
  return !d.isBefore(dayjs(), 'day');
}

// ---- 日汇总 ----

const guideOpen = ref<string[]>([]);
const yesterday = dayjs().subtract(1, 'day');
const range = ref<[Dayjs, Dayjs]>([yesterday.subtract(6, 'day'), yesterday]);
const dailyRows = ref<CostReconDaily[]>([]);
const dailyLoading = ref(false);

const dailyColumns = computed(() => [
  { title: t('costRecon.col.date'), dataIndex: 'date', width: 120, fixed: 'left' as const },
  { title: t('costRecon.col.check'), dataIndex: 'check', width: 240 },
  { title: t('costRecon.col.source'), dataIndex: 'source', width: 120 },
  {
    title: t('costRecon.col.orderCount'),
    dataIndex: 'orderCount',
    width: 90,
    align: 'right' as const,
  },
  { title: t('costRecon.col.costCny'), dataIndex: 'costCny', width: 120, align: 'right' as const },
  {
    title: t('costRecon.col.chargedPoints'),
    dataIndex: 'chargedPoints',
    width: 110,
    align: 'right' as const,
  },
  {
    title: t('costRecon.col.revenueCny'),
    dataIndex: 'revenueCny',
    width: 120,
    align: 'right' as const,
  },
  { title: t('costRecon.col.sampleBizNos'), dataIndex: 'sampleBizNos', width: 320 },
  {
    title: t('common.operation'),
    key: 'operation',
    width: 100,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]);

function dailyRowKey(r: CostReconDaily) {
  return `${r.date}|${r.check}|${r.source}`;
}

function drillable(r: CostReconDaily) {
  return r.level !== 'INFO';
}

function dailyRowClass(r: CostReconDaily) {
  return drillable(r) ? 'row-clickable' : 'row-info';
}

function dailyCustomRow(r: CostReconDaily) {
  return {
    onClick: () => {
      if (drillable(r)) openDetails(r);
    },
  };
}

/** 请求序号：只认最后一次发出的请求，先发后到的旧响应直接丢弃 */
let dailySeq = 0;

async function loadDaily() {
  const [from, to] = range.value;
  if (to.diff(from, 'day') >= MAX_RANGE_DAYS) {
    message.warning(t('costRecon.rangeTooLong', { days: MAX_RANGE_DAYS }));
    return;
  }
  const seq = ++dailySeq;
  dailyLoading.value = true;
  try {
    const rows = await getCostReconDaily({ from: from.format(DATE_FMT), to: to.format(DATE_FMT) });
    if (seq !== dailySeq) return;
    // 日期倒序；同一天内 ERROR → WARN → INFO，再按成本降序
    dailyRows.value = (rows || []).slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const lv = (LEVEL_ORDER[a.level ?? ''] ?? 9) - (LEVEL_ORDER[b.level ?? ''] ?? 9);
      if (lv !== 0) return lv;
      return Number(b.costCny ?? 0) - Number(a.costCny ?? 0);
    });
  } catch (error) {
    if (seq === dailySeq) console.error('Failed to load cost reconciliation daily:', error);
  } finally {
    if (seq === dailySeq) dailyLoading.value = false;
  }
}

// ---- 明细 ----

const selected = ref<CostReconDaily | null>(null);
const filter = reactive<{ source?: string; bizNo: string }>({ source: undefined, bizNo: '' });
const detailRows = ref<CostReconDetail[]>([]);
const detailLoading = ref(false);
const detailPage = reactive({ current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });

/** 来源选项：取汇总里同日同判据出现过的来源 */
const sourceOptions = computed(() => {
  const s = selected.value;
  if (!s) return [];
  const set = new Set(
    dailyRows.value.filter((r) => r.date === s.date && r.check === s.check).map((r) => r.source),
  );
  return [...set].filter(Boolean).map((v) => ({ label: v, value: v }));
});

const detailPagination = computed(() => ({
  current: detailPage.current,
  pageSize: detailPage.pageSize,
  total: detailPage.total,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100', '200'],
  showTotal: (total: number) => t('costRecon.total', { total }),
}));

const detailColumns = computed(() => [
  { title: t('costRecon.col.bizNo'), dataIndex: 'bizNo', width: 240, fixed: 'left' as const },
  { title: t('costRecon.col.source'), dataIndex: 'source', width: 110 },
  { title: t('costRecon.col.callerId'), dataIndex: 'callerId', width: 140 },
  { title: t('costRecon.col.modelGroup'), dataIndex: 'modelGroup', width: 170 },
  { title: t('costRecon.col.costCny'), dataIndex: 'costCny', width: 120, align: 'right' as const },
  { title: t('costRecon.col.reservation'), dataIndex: 'reservationNo', width: 230 },
  {
    title: t('costRecon.col.chargedPoints'),
    dataIndex: 'chargedPoints',
    width: 110,
    align: 'right' as const,
  },
  {
    title: t('costRecon.col.revenueCny'),
    dataIndex: 'revenueCny',
    width: 120,
    align: 'right' as const,
  },
  {
    title: t('costRecon.col.attemptCount'),
    dataIndex: 'attemptCount',
    width: 100,
    align: 'center' as const,
  },
  { title: t('costRecon.col.callId'), dataIndex: 'callId', width: 300 },
]);

function callTooltip(r: CostReconDetail) {
  const parts = [];
  if (r.attemptId != null) parts.push(`attemptId: ${r.attemptId}`);
  if (r.idempotencyKey) parts.push(`idempotencyKey: ${r.idempotencyKey}`);
  return parts.join('\n') || undefined;
}

function openDetails(r: CostReconDaily) {
  selected.value = r;
  filter.source = r.source || undefined;
  filter.bizNo = '';
  detailPage.current = 1;
  loadDetails();
}

function searchDetails() {
  detailPage.current = 1;
  loadDetails();
}

function onDetailTableChange(pag: { current?: number; pageSize?: number }) {
  detailPage.current = pag.current || 1;
  detailPage.pageSize = Math.min(pag.pageSize || DEFAULT_PAGE_SIZE, 200);
  loadDetails();
}

let detailSeq = 0;

async function loadDetails() {
  const s = selected.value;
  if (!s) return;
  const seq = ++detailSeq;
  detailLoading.value = true;
  try {
    const res = await getCostReconDetails({
      date: s.date,
      check: s.check,
      source: filter.source || undefined,
      bizNo: filter.bizNo.trim() || undefined,
      page: detailPage.current,
      pageSize: detailPage.pageSize,
    });
    if (seq !== detailSeq) return;
    detailRows.value = res.list || [];
    detailPage.total = res.total || 0;
  } catch (error) {
    if (seq === detailSeq) console.error('Failed to load cost reconciliation details:', error);
  } finally {
    if (seq === detailSeq) detailLoading.value = false;
  }
}

// ---- 手动重跑 ----

const runVisible = ref(false);
const runDate = ref<Dayjs>(yesterday);
const running = ref(false);

function openRun() {
  runDate.value = yesterday;
  runVisible.value = true;
}

function confirmRun() {
  const date = runDate.value.format(DATE_FMT);
  Modal.confirm({
    title: t('costRecon.run.confirmTitle'),
    content: t('costRecon.run.confirmContent', { date }),
    onOk: () => doRun(date),
  });
}

async function doRun(date: string) {
  running.value = true;
  try {
    const res: CostReconRunResult = await runCostRecon(date);
    message.success(
      t('costRecon.run.success', {
        date: res?.date ?? date,
        costRows: res?.costRows ?? 0,
        details: res?.details ?? 0,
      }),
    );
    runVisible.value = false;
    await loadDaily();
    if (selected.value?.date === date) await loadDetails();
  } catch (error) {
    const err = error as RequestError;
    // 409 / RESOURCE_CONFLICT(4002)：定时任务或他人正在跑同一把锁
    if (err?.status === 409 || err?.code === 409 || err?.code === 4002) {
      message.warning(t('costRecon.run.conflict'));
    } else {
      message.error(err?.message || t('costRecon.run.failed'));
    }
  } finally {
    running.value = false;
  }
}

onMounted(loadDaily);
</script>

<style scoped>
.guide {
  margin-bottom: 12px;
}

.sub-text {
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
}

.detail-card {
  margin-top: 16px;
}

.title-tag {
  margin-left: 8px;
}

.run-hint {
  margin-bottom: 12px;
}

:deep(.row-clickable) {
  cursor: pointer;
}

:deep(.row-info) td {
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
}
</style>
