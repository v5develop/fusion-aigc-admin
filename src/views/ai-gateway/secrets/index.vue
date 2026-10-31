<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewaySecrets') }}</h2>
      <a-space>
        <a-input-search
          v-model:value="keyword"
          :placeholder="$t('aiGateway.secretSearch')"
          allow-clear
          style="width: 260px"
        />
        <a-checkbox v-model:checked="onlyMissing">{{
          $t('aiGateway.secretOnlyMissing')
        }}</a-checkbox>
        <a-button :loading="loading" @click="load">{{ $t('common.refresh') }}</a-button>
        <a-button v-permission="'ai_gateway:secret'" @click="openWrite()">
          {{ $t('aiGateway.secretWriteOther') }}
        </a-button>
      </a-space>
    </div>
    <a-alert type="info" show-icon style="margin-bottom: 12px">
      <template #message>
        {{ $t('aiGateway.secretChecklistHint', { missing: missingCount, total: slots.length }) }}
      </template>
      <template #description>{{ $t('aiGateway.secretHint') }}</template>
    </a-alert>
    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="visibleSlots"
        :loading="loading"
        :pagination="false"
        :row-key="(r: Slot) => `${r.account}/${r.name}`"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'env'">
            <code v-if="record.env">{{ record.env }}</code>
            <span v-else-if="record.optional" class="muted">{{
              $t('aiGateway.balanceView.balanceKeySlot')
            }}</span>
            <span v-else class="muted">-</span>
          </template>
          <template v-else-if="column.key === 'account'">
            <div>{{ record.displayName || record.account }}</div>
            <div class="muted">
              {{ record.account }}
              <template v-if="record.sharedBy">
                · {{ $t('aiGateway.secretSharedBy', { n: record.sharedBy }) }}
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.fingerprint" color="green">
              {{ $t('aiGateway.secretSet') }} <code>{{ record.fingerprint }}</code>
            </a-tag>
            <a-tag v-else-if="record.optional">{{
              $t('aiGateway.balanceView.balanceKeySlot')
            }}</a-tag>
            <a-tag v-else-if="record.enabled" color="red">{{
              $t('aiGateway.secretMissing')
            }}</a-tag>
            <a-tag v-else>{{ $t('aiGateway.secretOptional') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'ai_gateway:secret'"
                type="link"
                size="small"
                @click="openWrite(record)"
              >
                {{
                  record.fingerprint ? $t('aiGateway.secretRotate') : $t('aiGateway.secretWrite')
                }}
              </a-button>
              <a-popconfirm
                v-if="record.fingerprint"
                v-permission="'ai_gateway:secret'"
                :title="$t('aiGateway.secretConfirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="writeOpen"
      :title="$t('aiGateway.secretWrite')"
      :confirm-loading="saving"
      destroy-on-close
      @ok="handleWrite"
    >
      <a-form layout="vertical">
        <a-form-item v-if="writeForm.env" :label="$t('aiGateway.secretEnv')">
          <code>{{ writeForm.env }}</code>
        </a-form-item>
        <a-form-item :label="$t('aiGateway.selectAccount')" required>
          <a-select
            v-model:value="writeForm.account"
            :options="accountOptions"
            :disabled="writeLocked"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item :label="$t('aiGateway.secretName')" required>
          <a-input v-model:value="writeForm.name" :disabled="writeLocked" placeholder="api_key" />
          <div v-if="writeForm.name === BALANCE_SECRET_NAME" class="muted">
            {{ $t('aiGateway.balanceView.balanceKeySlot') }} ·
            {{ $t('aiGateway.balanceView.needBalanceKey') }}
          </div>
          <div v-else class="muted">{{ $t('aiGateway.secretNameHint') }}</div>
        </a-form-item>
        <a-form-item :label="$t('aiGateway.secretValue')" required>
          <a-input-password v-model:value="writeForm.value" autocomplete="new-password" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import {
  BALANCE_SECRET_NAME,
  deleteSecret,
  listAllSecrets,
  listResources,
  putSecret,
  type GatewayResource,
  type SecretInfo,
} from '@/api/ai-gateway';

/**
 * 供应商密钥「待补清单」：每个账户的每个密钥位一行。密钥位来自账户 labels 里声明的
 * secret_env.<名称>=<旧环境变量>（种子 SQL 写入）加上已录入的密钥名，标出对应旧环境变量与是否已录。
 * 沿用别的账户密钥的账户（secrets_from）不单独列行，只在持有账户上显示「另有 N 个账户共用」。
 *
 * 密钥只写：网关只回指纹（明文 SHA-256 前 16 位），页面不在任何地方留明文——写入后立刻清空输入框。
 * 密钥不进配置快照，写入即生效，不用发布。
 *
 * Atlas 账户（服务商适配器 atlas.*）额外列一个可选密钥位 balance_api_key：独立查余额 key，只用于查 Atlas 余额，
 * 生成仍用 api_key；不计入「待补」。从账户页「去配置查余额 key」跳来时（query.write=balance_api_key）直接打开写入框。
 */

interface Slot {
  account: string;
  displayName: string;
  name: string;
  env: string;
  enabled: boolean;
  sharedBy: number;
  fingerprint: string;
  /** 可选密钥位（不计入待补），目前只有 Atlas 的 balance_api_key */
  optional: boolean;
}

const { t } = useI18n();
const route = useRoute();

const accounts = ref<GatewayResource[]>([]);
const secrets = ref<SecretInfo[]>([]);
/** 服务商编码 → 适配器类型（判定 Atlas 账户） */
const providerKinds = ref<Record<string, string>>({});
const loading = ref(false);
const keyword = ref(typeof route.query.account === 'string' ? route.query.account : '');
const onlyMissing = ref(false);

const slots = computed<Slot[]>(() => {
  const fp = new Map(secrets.value.map((s) => [`${s.account_code}/${s.name}`, s.fingerprint]));
  const shared = new Map<string, number>();
  for (const a of accounts.value) {
    const from = a.secrets_from as string | undefined;
    if (from) shared.set(from, (shared.get(from) || 0) + 1);
  }
  const out: Slot[] = [];
  for (const a of accounts.value) {
    if (a.secrets_from) continue;
    const code = String(a.code);
    const labels = (a.labels as Record<string, string> | undefined) || {};
    // 密钥位 = 标签里声明的 secret_env.<名称>（种子写入，录入前就有）∪ 已录入的密钥名。
    // 不能只看 secret_names：网关按密钥表推导它，没录过的账户永远是空，待补清单会一行都不出。
    const declared = Object.keys(labels)
      .filter((k) => k.startsWith('secret_env.'))
      .map((k) => k.slice('secret_env.'.length));
    const names = Array.from(new Set([...declared, ...((a.secret_names as string[]) || [])]));
    const isAtlas = (providerKinds.value[String(a.provider_code)] || '').startsWith('atlas.');
    if (isAtlas && !names.includes(BALANCE_SECRET_NAME)) names.push(BALANCE_SECRET_NAME);
    for (const name of names) {
      out.push({
        account: code,
        displayName: String(a.display_name || ''),
        name,
        env: labels[`secret_env.${name}`] || '',
        enabled: a.enabled !== false,
        sharedBy: shared.get(code) || 0,
        fingerprint: fp.get(`${code}/${name}`) || '',
        optional: isAtlas && name === BALANCE_SECRET_NAME,
      });
    }
  }
  // 缺的在前（启用的缺 → 停用的缺 → 已录），同组内按变量名
  const rank = (s: Slot) => (s.fingerprint ? 2 : s.optional ? 1.5 : s.enabled ? 0 : 1);
  return out.sort(
    (x, y) => rank(x) - rank(y) || (x.env || x.account).localeCompare(y.env || y.account),
  );
});

const missingCount = computed(
  () => slots.value.filter((s) => !s.fingerprint && s.enabled && !s.optional).length,
);

const visibleSlots = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return slots.value.filter(
    (s) =>
      (!onlyMissing.value || !s.fingerprint) &&
      (!kw || [s.env, s.account, s.displayName, s.name].some((v) => v.toLowerCase().includes(kw))),
  );
});

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    label: a.display_name ? `${a.code}（${a.display_name}）` : String(a.code),
    value: String(a.code),
  })),
);

const columns = [
  { title: t('aiGateway.secretEnv'), key: 'env', width: 240 },
  { title: t('aiGateway.account'), key: 'account' },
  { title: t('aiGateway.secretName'), dataIndex: 'name', width: 160 },
  { title: t('aiGateway.secretStatus'), key: 'status', width: 240 },
  { title: t('common.action'), key: 'operation', width: 140 },
];

async function load() {
  loading.value = true;
  try {
    const [acc, sec, providers] = await Promise.all([
      listResources('/accounts').catch(() => []),
      listAllSecrets().catch(() => []),
      listResources('/providers').catch(() => [] as GatewayResource[]),
    ]);
    accounts.value = acc;
    secrets.value = sec;
    providerKinds.value = Object.fromEntries(
      providers.map((p) => [String(p.code), String(p.adapter_kind || '')]),
    );
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  // 从账户页「去配置查余额 key」跳来：直接打开该账户的 balance_api_key 写入框
  const account = typeof route.query.account === 'string' ? route.query.account : '';
  if (route.query.write === BALANCE_SECRET_NAME && account) {
    const slot = slots.value.find((s) => s.account === account && s.name === BALANCE_SECRET_NAME);
    openWrite(
      slot || {
        account,
        displayName: '',
        name: BALANCE_SECRET_NAME,
        env: '',
        enabled: true,
        sharedBy: 0,
        fingerprint: '',
        optional: true,
      },
    );
  }
});

const writeOpen = ref(false);
const saving = ref(false);
const writeLocked = ref(false);
const writeForm = reactive({ account: '', name: '', env: '', value: '' });

function openWrite(slot?: Slot) {
  writeForm.account = slot?.account || '';
  writeForm.name = slot?.name || '';
  writeForm.env = slot?.env || '';
  writeForm.value = '';
  writeLocked.value = !!slot;
  writeOpen.value = true;
}

async function handleWrite() {
  const name = writeForm.name.trim();
  if (!writeForm.account) {
    message.warning(t('aiGateway.selectAccount'));
    return;
  }
  if (!/^[a-z0-9_]{1,64}$/.test(name)) {
    message.warning(t('aiGateway.secretNameHint'));
    return;
  }
  if (!writeForm.value) {
    message.warning(t('aiGateway.secretValueRequired'));
    return;
  }
  saving.value = true;
  try {
    const info = await putSecret(writeForm.account, name, writeForm.value);
    message.success(t('aiGateway.secretSaved', { fingerprint: info?.fingerprint || '-' }));
    writeOpen.value = false;
    load();
  } catch {
    /* 拦截器已提示 */
  } finally {
    writeForm.value = '';
    saving.value = false;
  }
}

async function handleDelete(slot: Slot) {
  try {
    await deleteSecret(slot.account, slot.name);
    message.success(t('common.deleteSuccess'));
    load();
  } catch {
    /* 拦截器已提示 */
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
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
