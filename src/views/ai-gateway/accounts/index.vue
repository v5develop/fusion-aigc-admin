<template>
  <div>
    <ResourcePage
      resource="accounts"
      :title="$t('menu.aiGatewayAccounts')"
      :description="$t('aiGateway.desc.accounts')"
      :extra-columns="extraColumns"
      @reloaded="loadBalances"
    >
      <template #extra-cell="{ column, record }">
        <template v-if="column.key === 'runtime_balance'">
          <BalanceCell
            v-if="supportsBalance(record)"
            :row="runtimeOf(record)"
            :secrets-account="String(record.secrets_from || record.code)"
          />
          <span v-else class="muted">-</span>
        </template>
      </template>
      <template #row-actions="{ record }">
        <a-button type="link" size="small" @click="openSecrets(String(record.code))">
          {{ $t('aiGateway.secrets') }}
        </a-button>
        <a-button
          v-if="supportsBalance(record)"
          v-permission="'ai_gateway:runtime'"
          type="link"
          size="small"
          @click="openRecheck(String(record.code))"
        >
          {{ $t('aiGateway.balanceView.queryNow') }}
        </a-button>
      </template>
    </ResourcePage>

    <a-modal
      v-model:open="recheckOpen"
      :title="`${$t('aiGateway.balanceView.queryNow')} · ${recheckCode}`"
      :confirm-loading="rechecking"
      @ok="handleRecheck"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        :message="$t('aiGateway.balanceView.queryNowHint')"
      />
      <a-form layout="vertical">
        <a-form-item :label="$t('aiGateway.reason')" required>
          <a-textarea v-model:value="recheckReason" :rows="2" :maxlength="512" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
  forceAccount,
  getRuntime,
  listAdapters,
  listResources,
  type AccountRuntime,
  type GatewayResource,
} from '@/api/ai-gateway';

import BalanceCell from '../components/BalanceCell.vue';
import ResourcePage from '../components/ResourcePage.vue';

/**
 * 账户：配置字段由网关 schema 驱动（ResourcePage），本页只追加运行态「余额」列与「立即查询余额」。
 * 余额列只对适配器声明 `balance_query` 的账户显示（目前是 Atlas），其余显示「-」；
 * 「立即查询余额」复用运行态的强制动作 `recheck_balance`（必填原因，网关记审计）。
 * 用主 key 查余额失败（key 格式 / 403）时余额列提示配置独立查余额 key（balance_api_key），跳到持有密钥的账户
 * （secrets_from 指向的源账户）的密钥页。
 */
const { t } = useI18n();
const router = useRouter();

const extraColumns = computed(() => [
  { key: 'runtime_balance', title: t('aiGateway.balance'), width: 220 },
]);

const runtime = ref<Record<string, AccountRuntime>>({});
/** 服务商编码 → 是否支持余额查询（服务商的适配器声明了 balance_query） */
const providerBalance = ref<Record<string, boolean>>({});

async function loadBalances() {
  const [snap, adapters, providers] = await Promise.all([
    getRuntime().catch(() => null),
    listAdapters().catch(() => []),
    listResources('/providers').catch(() => [] as GatewayResource[]),
  ]);
  const caps = new Map(adapters.map((a) => [a.kind, a.balance_query]));
  providerBalance.value = Object.fromEntries(
    providers.map((p) => [String(p.code), !!caps.get(String(p.adapter_kind))]),
  );
  if (snap) runtime.value = Object.fromEntries(snap.accounts.map((a) => [a.account_code, a]));
}

function supportsBalance(record: GatewayResource) {
  return !!providerBalance.value[String(record.provider_code)];
}

function runtimeOf(record: GatewayResource) {
  return runtime.value[String(record.code)] || null;
}

function openSecrets(account: string) {
  router.push({ name: 'AiGatewaySecrets', query: { account } });
}

// ---- 立即查询余额（recheck_balance） ----
const recheckOpen = ref(false);
const rechecking = ref(false);
const recheckCode = ref('');
const recheckReason = ref('');

function openRecheck(code: string) {
  recheckCode.value = code;
  recheckReason.value = '';
  recheckOpen.value = true;
}

async function handleRecheck() {
  const reason = recheckReason.value.trim();
  if (!reason) {
    message.warning(t('aiGateway.reasonRequired'));
    return;
  }
  rechecking.value = true;
  try {
    const snap = await forceAccount(recheckCode.value, { action: 'recheck_balance', reason });
    runtime.value = Object.fromEntries(snap.accounts.map((a) => [a.account_code, a]));
    message.success(t('aiGateway.forceDone'));
    recheckOpen.value = false;
  } catch {
    /* 拦截器已提示（如 403：key 缺少账户余额读取权限）；网关已把失败判据写入运行态，刷新后余额列给出处置提示 */
    loadBalances();
  } finally {
    rechecking.value = false;
  }
}
</script>

<style scoped>
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
