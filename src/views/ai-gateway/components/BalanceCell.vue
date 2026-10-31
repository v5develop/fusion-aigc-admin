<template>
  <span
    v-if="!row || (row.balance == null && !row.balance_state && !row.balance_error)"
    class="muted"
    >-</span
  >
  <div v-else class="balance-cell">
    <a-popover
      v-if="detailRows.length"
      placement="left"
      :title="$t('aiGateway.balanceView.details')"
    >
      <template #content>
        <table class="balance-details">
          <tbody>
            <tr v-for="d in detailRows" :key="d.key">
              <th>{{ d.label }}</th>
              <td>{{ d.value }}</td>
            </tr>
          </tbody>
        </table>
        <div class="muted hint">{{ $t('aiGateway.balanceView.effectiveHint') }}</div>
      </template>
      <a-tag :color="stateColor" class="amount">{{ amountText }}</a-tag>
    </a-popover>
    <a-tag
      v-else-if="row.balance != null || row.balance_state"
      :color="stateColor"
      class="amount"
      >{{ amountText }}</a-tag
    >
    <span v-if="row.balance_state" class="state" :style="{ color: stateTextColor }">{{
      stateText
    }}</span>
    <div v-if="row.balance_checked_at" class="muted">
      {{ formatDateTime(row.balance_checked_at) }}
    </div>
    <div v-if="row.balance_error" class="balance-error">
      <a-tooltip :title="errorTooltip">
        <a-tag color="red">{{ $t('aiGateway.balanceView.queryFailed') }}</a-tag>
      </a-tooltip>
      <code class="muted">{{ row.balance_error }}</code>
      <div v-if="needBalanceKey" class="need-key">
        {{ $t('aiGateway.balanceView.needBalanceKey') }}
        <a v-if="secretsAccount" @click="goConfigureKey">{{
          $t('aiGateway.balanceView.configureBalanceKey')
        }}</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AccountRuntime } from '@/api/ai-gateway';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { BALANCE_SECRET_NAME } from '@/api/ai-gateway';
import { formatDateTime } from '@/utils/helpers';

/**
 * 账户余额单元格：可用额 + 币种（按 balance_state 着色）、查询时间；有明细（balance_details）时悬停看现金 /
 * 赠送 / 订阅赠送 / 冻结 / 授信 / 查询用 key。账户列表与运行态页共用。
 *
 * 最近一次查询失败（balance_error）时显示判据；用的是主 key 且判据为 key_format / http_403 时提示配置独立查余额 key
 * （balance_api_key），传了 secretsAccount（持有密钥的账户，secrets_from 指向的源账户）就给出跳转到密钥页的入口。
 */
const props = defineProps<{ row?: AccountRuntime | null; secretsAccount?: string }>();
const { t, te } = useI18n();
const router = useRouter();

/** 明细展示顺序；未列出的键排在后面、原样显示 */
const DETAIL_ORDER = [
  'effective_available',
  'available',
  'cash',
  'bonus',
  'subscription_bonus',
  'frozen',
  'credit_status',
  'credit_granted',
  'credit_used',
  'credit_remaining_overdraft',
  'credit_overdrawn',
  'low_threshold',
  'account_type',
  'account_name',
  'key_source',
];
const HIDDEN = new Set(['currency']);

const state = computed(() => String(props.row?.balance_state || '').toUpperCase());

const stateColor = computed(() => {
  if (state.value === 'AVAILABLE') return 'green';
  if (state.value === 'LOW') return 'orange';
  if (state.value === 'INSUFFICIENT' || state.value === 'QUOTA_EXHAUSTED') return 'red';
  return 'default';
});

const stateTextColor = computed(
  () =>
    ({ green: '#389e0d', orange: '#d46b08', red: '#cf1322' })[stateColor.value as string] ||
    'inherit',
);

const stateText = computed(() => {
  const key = `aiGateway.balanceView.state.${state.value}`;
  return te(key) ? t(key) : state.value;
});

const currency = computed(
  () => props.row?.balance_currency || props.row?.balance_details?.currency || '',
);

function trimAmount(v: string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

const keySource = computed(() =>
  String(props.row?.balance_key_source || props.row?.balance_details?.key_source || ''),
);

function keySourceText(v: string) {
  if (v === 'balance') return t('aiGateway.balanceView.keySourceBalance');
  if (v === 'main') return t('aiGateway.balanceView.keySourceMain');
  return v;
}

/** 用主 key 查余额且因 key 格式 / 403 失败：需要为账户配置独立查余额 key */
const needBalanceKey = computed(() => {
  const err = String(props.row?.balance_error || '');
  return keySource.value === 'main' && (err.endsWith('.key_format') || err.endsWith('.http_403'));
});

const errorTooltip = computed(() => {
  const parts = [String(props.row?.balance_error || '')];
  if (keySource.value)
    parts.push(`${t('aiGateway.balanceView.keySource')}: ${keySourceText(keySource.value)}`);
  if (props.row?.balance_error_at) parts.push(formatDateTime(props.row.balance_error_at));
  return parts.join(' · ');
});

function goConfigureKey() {
  router.push({
    name: 'AiGatewaySecrets',
    query: { account: props.secretsAccount, write: BALANCE_SECRET_NAME },
  });
}

const amountText = computed(() => `${trimAmount(props.row?.balance)} ${currency.value}`.trim());

const detailRows = computed(() => {
  const d = props.row?.balance_details || {};
  const keys = Object.keys(d).filter((k) => !HIDDEN.has(k));
  keys.sort((a, b) => {
    const ia = DETAIL_ORDER.indexOf(a);
    const ib = DETAIL_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return keys.map((k) => {
    const labelKey = `aiGateway.balanceView.field.${k}`;
    const raw = d[k];
    const numeric = raw !== '' && Number.isFinite(Number(raw));
    let value = numeric ? `${trimAmount(raw)} ${currency.value}`.trim() : raw;
    if (k === 'key_source') value = keySourceText(raw);
    return { key: k, label: te(labelKey) ? t(labelKey) : k, value };
  });
});
</script>

<style scoped>
.balance-cell .amount {
  cursor: default;
  margin-right: 4px;
}
.balance-cell .state {
  font-size: 12px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.balance-details th {
  padding: 2px 16px 2px 0;
  font-weight: normal;
  color: var(--color-text-secondary, #666);
  text-align: left;
  white-space: nowrap;
}
.balance-details td {
  padding: 2px 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.balance-error {
  margin-top: 4px;
}
.need-key {
  max-width: 260px;
  color: #d46b08;
  font-size: 12px;
  white-space: normal;
}
.need-key a {
  margin-left: 4px;
  cursor: pointer;
}
.hint {
  max-width: 280px;
  margin-top: 6px;
}
</style>
