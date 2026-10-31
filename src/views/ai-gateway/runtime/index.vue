<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewayRuntime') }}</h2>
      <a-space>
        <span class="muted" v-if="snapshot"
          >{{ $t('aiGateway.capturedAt') }} {{ formatDateTime(snapshot.captured_at) }}</span
        >
        <a-switch v-model:checked="autoRefresh" />
        <span class="muted">{{ $t('aiGateway.autoRefresh') }}</span>
        <a-button :loading="loading" @click="load">{{ $t('common.refresh') }}</a-button>
      </a-space>
    </div>

    <a-card
      :title="$t('aiGateway.deploymentRuntime')"
      variant="borderless"
      style="margin-bottom: 16px"
    >
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          allow-clear
          style="width: 260px"
          :placeholder="$t('aiGateway.keywordPlaceholder')"
        />
        <a-checkbox v-model:checked="onlyAbnormal">{{ $t('aiGateway.onlyAbnormal') }}</a-checkbox>
      </div>
      <a-table
        :columns="deploymentColumns"
        :data-source="deploymentRows"
        :loading="loading"
        :pagination="{ pageSize: 30 }"
        row-key="deployment_code"
        size="small"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'deployment_code'">
            <code>{{ record.deployment_code }}</code>
          </template>
          <template v-if="column.dataIndex === 'circuit'">
            <a-tag :color="circuitColor(record.circuit)" :title="record.circuit">{{
              enumShort(record.circuit)
            }}</a-tag>
            <a-tag
              v-if="record.forced && record.forced !== 'none'"
              color="purple"
              :title="record.forced"
            >
              {{ enumShort(record.forced)
              }}{{ record.forced_until ? ` → ${formatDateTime(record.forced_until)}` : '' }}
            </a-tag>
          </template>
          <template v-if="column.dataIndex === 'failure_ewma'">
            {{ (Number(record.failure_ewma) * 100).toFixed(1) }}% / {{ record.sample_count }}
          </template>
          <template v-if="column.dataIndex === 'capacity'">
            {{ record.submitting }}/{{ record.max_submitting ?? '∞' }} · {{ record.running }}/{{
              record.max_running ?? '∞'
            }}
          </template>
          <template v-if="column.dataIndex === 'gates'">
            <div v-if="record.cooldown_until">
              {{ formText('gateCooldown') }} → {{ formatDateTime(record.cooldown_until) }}
            </div>
            <div v-if="record.rate_limited_until">
              {{ formText('gateRateLimited') }}（429）→
              {{ formatDateTime(record.rate_limited_until) }}
            </div>
            <div v-if="record.probe_failed_until">
              {{ formText('gateProbe') }} → {{ formatDateTime(record.probe_failed_until) }}
            </div>
            <span
              v-if="
                !record.cooldown_until && !record.rate_limited_until && !record.probe_failed_until
              "
              >-</span
            >
          </template>
          <template v-if="column.dataIndex === 'updated_at'">
            {{ formatDateTime(record.updated_at) }}
          </template>
          <template v-if="column.dataIndex === 'last_outcome'">
            <a-tag v-if="record.last_outcome" :title="record.last_outcome">{{
              enumShort(record.last_outcome)
            }}</a-tag>
            <div v-if="record.last_error" class="muted reason">{{ record.last_error }}</div>
          </template>
          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'ai_gateway:runtime'"
                type="link"
                size="small"
                @click="openForce('deployment', record.deployment_code)"
              >
                {{ $t('aiGateway.force') }}
              </a-button>
              <a-dropdown v-permission="'ai_gateway:runtime'">
                <a-button type="link" size="small">{{ $t('aiGateway.probe') }}</a-button>
                <template #overlay>
                  <a-menu
                    @click="(e: { key: string }) => handleProbe(record.deployment_code, e.key)"
                  >
                    <a-menu-item key="auth">{{ enumLabel('auth') }}</a-menu-item>
                    <a-menu-item key="balance">{{ enumLabel('balance') }}</a-menu-item>
                    <a-menu-item key="minimal_call"
                      >{{ enumLabel('minimal_call') }} · {{ $t('aiGateway.billable') }}</a-menu-item
                    >
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card :title="$t('aiGateway.accountRuntime')" variant="borderless">
      <a-table
        :columns="accountColumns"
        :data-source="snapshot?.accounts || []"
        :loading="loading"
        :pagination="false"
        row-key="account_code"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'account_code'">
            <code>{{ record.account_code }}</code>
          </template>
          <template v-if="column.dataIndex === 'running'">
            {{ record.running }}/{{ record.max_running ?? '∞' }}
          </template>
          <template v-if="column.dataIndex === 'balance'">
            <BalanceCell :row="record" />
          </template>
          <template v-if="column.dataIndex === 'excluded_until'">
            <template v-if="record.excluded_until">
              <a-tag color="red">{{ formatDateTime(record.excluded_until) }}</a-tag>
              <div class="muted">{{ record.exclusion_reason }}</div>
            </template>
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'operation'">
            <a-button
              v-permission="'ai_gateway:runtime'"
              type="link"
              size="small"
              @click="openForce('account', record.account_code)"
            >
              {{ $t('aiGateway.force') }}
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="forceOpen"
      :title="`${$t('aiGateway.force')} · ${$t(`aiGateway.${forceTarget.kind}`)} ${forceTarget.code}`"
      :confirm-loading="forcing"
      @ok="handleForce"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('aiGateway.forceAction')" required>
          <a-select v-model:value="forceForm.action" :options="actionOptions" />
        </a-form-item>
        <a-form-item
          v-if="forceForm.action === 'force_open' || forceForm.action === 'force_closed'"
          :label="$t('aiGateway.ttlSeconds')"
        >
          <a-input-number
            v-model:value="forceForm.ttl_s"
            :min="1"
            :max="604800"
            :precision="0"
            style="width: 200px"
          />
          <div class="muted">{{ $t('aiGateway.ttlHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('aiGateway.reason')" required>
          <a-textarea v-model:value="forceForm.reason" :rows="2" :maxlength="512" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  FORCE_ACTIONS,
  forceAccount,
  forceDeployment,
  getRuntime,
  probeDeployment,
  type DeploymentRuntime,
  type RuntimeSnapshot,
} from '@/api/ai-gateway';
import { formatDateTime } from '@/utils/helpers';

import BalanceCell from '../components/BalanceCell.vue';
import { enumLabel, enumShort, formText } from '../components/gatewayI18n';

/**
 * 运行态：每个部署的熔断、失败率、容量、冷却，每个账户的并发、余额、排除状态。
 * 强制动作（强开/强关熔断、清冷却、复检余额、解除排除）必须写原因，网关记审计。
 * 余额列按 balance_state 着色，悬停看供应商明细（如 Atlas 的现金 / 赠送 / 冻结 / 授信）。
 */
const { t } = useI18n();

const snapshot = ref<RuntimeSnapshot | null>(null);
const loading = ref(false);
const keyword = ref('');
const onlyAbnormal = ref(false);
const autoRefresh = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  loading.value = true;
  try {
    snapshot.value = await getRuntime();
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(autoRefresh, (on) => {
  if (timer) clearInterval(timer);
  timer = on ? setInterval(load, 10000) : null;
});
onUnmounted(() => timer && clearInterval(timer));

function isAbnormal(r: DeploymentRuntime) {
  return (
    String(r.circuit).toUpperCase() !== 'CLOSED' ||
    (r.forced && r.forced !== 'none') ||
    !!r.cooldown_until ||
    !!r.rate_limited_until ||
    !!r.probe_failed_until
  );
}

const deploymentRows = computed(() => {
  const word = keyword.value.trim().toLowerCase();
  return (snapshot.value?.deployments || []).filter(
    (r) =>
      (!onlyAbnormal.value || isAbnormal(r)) &&
      (!word || r.deployment_code.toLowerCase().includes(word)),
  );
});

function circuitColor(c: string) {
  const v = String(c).toUpperCase();
  if (v === 'CLOSED') return 'green';
  if (v === 'HALF_OPEN') return 'orange';
  return 'red';
}

const deploymentColumns = computed(() => [
  {
    title: t('aiGateway.deployment'),
    dataIndex: 'deployment_code',
    width: 240,
    fixed: 'left' as const,
  },
  { title: t('aiGateway.circuit'), dataIndex: 'circuit', width: 220 },
  { title: t('aiGateway.failureRate'), dataIndex: 'failure_ewma', width: 130 },
  { title: t('aiGateway.consecutiveFailures'), dataIndex: 'consecutive_failures', width: 100 },
  { title: t('aiGateway.capacity'), dataIndex: 'capacity', width: 150 },
  { title: t('aiGateway.gates'), dataIndex: 'gates', width: 260 },
  { title: t('aiGateway.lastOutcome'), dataIndex: 'last_outcome', width: 260 },
  { title: t('aiGateway.updatedAt'), dataIndex: 'updated_at', width: 190 },
  { title: t('common.action'), key: 'operation', width: 140, fixed: 'right' as const },
]);

const accountColumns = computed(() => [
  { title: t('aiGateway.account'), dataIndex: 'account_code', width: 240 },
  { title: t('aiGateway.running'), dataIndex: 'running', width: 120 },
  { title: t('aiGateway.balance'), dataIndex: 'balance', width: 220 },
  { title: t('aiGateway.excluded'), dataIndex: 'excluded_until', width: 280 },
  { title: t('common.action'), key: 'operation', width: 100 },
]);

// ---- 强制动作 ----
const forceOpen = ref(false);
const forcing = ref(false);
const forceTarget = reactive({ kind: 'deployment' as 'deployment' | 'account', code: '' });
const forceForm = reactive({
  action: 'force_open' as string,
  reason: '',
  ttl_s: null as number | null,
});

const actionOptions = computed(() =>
  FORCE_ACTIONS.map((a) => ({ label: `${t(`aiGateway.forceActions.${a}`)}（${a}）`, value: a })),
);

function openForce(kind: 'deployment' | 'account', code: string) {
  forceTarget.kind = kind;
  forceTarget.code = code;
  forceForm.action = kind === 'deployment' ? 'force_open' : 'recheck_balance';
  forceForm.reason = '';
  forceForm.ttl_s = null;
  forceOpen.value = true;
}

async function handleForce() {
  if (!forceForm.reason.trim()) {
    message.warning(t('aiGateway.reasonRequired'));
    return;
  }
  const body = {
    action: forceForm.action,
    reason: forceForm.reason.trim(),
    ttl_s:
      forceForm.action === 'force_open' || forceForm.action === 'force_closed'
        ? forceForm.ttl_s
        : null,
  };
  forcing.value = true;
  try {
    snapshot.value =
      forceTarget.kind === 'deployment'
        ? await forceDeployment(forceTarget.code, body)
        : await forceAccount(forceTarget.code, body);
    message.success(t('aiGateway.forceDone'));
    forceOpen.value = false;
  } catch {
    /* 拦截器已提示 */
  } finally {
    forcing.value = false;
  }
}

// ---- 探测 ----
function handleProbe(code: string, kind: string) {
  const run = async () => {
    const hide = message.loading(t('aiGateway.probing'), 0);
    try {
      const r = await probeDeployment(code, kind as 'auth' | 'balance' | 'minimal_call');
      const outcome = r?.outcome_class ? enumLabel(r.outcome_class) : '';
      const detail = [outcome, r?.check, r?.message].filter(Boolean).join(' · ');
      if (r?.ok) message.success(`${code} ${enumShort('ok')} ${r.latency_ms ?? '-'}ms ${detail}`);
      else message.error(`${code} ${detail || formText('probeFailed')}`);
      load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      hide();
    }
  };
  if (kind === 'minimal_call') {
    Modal.confirm({
      title: t('common.warning'),
      content: t('aiGateway.minimalCallConfirm'),
      onOk: run,
    });
  } else {
    run();
  }
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.reason {
  white-space: normal;
  word-break: break-all;
}
</style>
