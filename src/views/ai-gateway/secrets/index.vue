<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewaySecrets') }}</h2>
      <a-space>
        <a-select
          v-model:value="account"
          :options="accountOptions"
          show-search
          option-filter-prop="label"
          :placeholder="$t('aiGateway.selectAccount')"
          style="width: 300px"
          @change="loadSecrets"
        />
        <a-button :loading="loading" :disabled="!account" @click="loadSecrets">
          {{ $t('common.refresh') }}
        </a-button>
        <a-button
          v-permission="'ai_gateway:secret'"
          type="primary"
          :disabled="!account"
          @click="openWrite()"
        >
          {{ $t('aiGateway.secretWrite') }}
        </a-button>
      </a-space>
    </div>

    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="$t('aiGateway.secretHint')"
    />

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="secrets"
        :loading="loading"
        :pagination="false"
        row-key="name"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fingerprint'">
            <code>{{ record.fingerprint }}</code>
          </template>
          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'ai_gateway:secret'"
                type="link"
                size="small"
                @click="openWrite(record.name)"
              >
                {{ $t('aiGateway.secretRotate') }}
              </a-button>
              <a-popconfirm
                v-permission="'ai_gateway:secret'"
                :title="$t('aiGateway.secretConfirmDelete')"
                @confirm="handleDelete(record.name)"
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
        <a-form-item :label="$t('aiGateway.secretName')" required>
          <a-input
            v-model:value="writeForm.name"
            :disabled="writeNameLocked"
            placeholder="api_key"
          />
          <div class="muted">{{ $t('aiGateway.secretNameHint') }}</div>
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
  deleteSecret,
  listResources,
  listSecrets,
  putSecret,
  type GatewayResource,
  type SecretInfo,
} from '@/api/ai-gateway';

/**
 * 供应商密钥：只写。网关只回指纹（明文 SHA-256 前 16 位）与主密钥 id，页面也不在任何地方留明文——
 * 写入后立刻清空输入框。密钥不进配置快照，写入即生效，不用发布。
 */
const { t } = useI18n();
const route = useRoute();

const accounts = ref<GatewayResource[]>([]);
const account = ref<string | undefined>(
  typeof route.query.account === 'string' ? route.query.account : undefined,
);
const secrets = ref<SecretInfo[]>([]);
const loading = ref(false);

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    label: a.display_name ? `${a.code}（${a.display_name}）` : String(a.code),
    value: String(a.code),
  })),
);

const columns = [
  { title: t('aiGateway.secretName'), dataIndex: 'name', width: 200 },
  { title: t('aiGateway.fingerprint'), dataIndex: 'fingerprint', width: 200 },
  { title: 'master_key_id', dataIndex: 'master_key_id', width: 160 },
  { title: t('aiGateway.updatedAt'), dataIndex: 'updated_at', width: 200 },
  { title: t('aiGateway.updatedBy'), dataIndex: 'updated_by', width: 140 },
  { title: t('common.action'), key: 'operation', width: 160 },
];

async function loadSecrets() {
  if (!account.value) return;
  loading.value = true;
  try {
    secrets.value = await listSecrets(account.value);
  } catch {
    secrets.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  accounts.value = await listResources('/accounts').catch(() => []);
  loadSecrets();
});

const writeOpen = ref(false);
const saving = ref(false);
const writeNameLocked = ref(false);
const writeForm = reactive({ name: '', value: '' });

function openWrite(name?: string) {
  writeForm.name = name || '';
  writeForm.value = '';
  writeNameLocked.value = !!name;
  writeOpen.value = true;
}

async function handleWrite() {
  if (!account.value) return;
  const name = writeForm.name.trim();
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
    const info = await putSecret(account.value, name, writeForm.value);
    message.success(t('aiGateway.secretSaved', { fingerprint: info?.fingerprint || '-' }));
    writeOpen.value = false;
    loadSecrets();
  } catch {
    /* 拦截器已提示 */
  } finally {
    writeForm.value = '';
    saving.value = false;
  }
}

async function handleDelete(name: string) {
  if (!account.value) return;
  try {
    await deleteSecret(account.value, name);
    message.success(t('common.deleteSuccess'));
    loadSecrets();
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
