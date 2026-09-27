<template>
  <ResourcePage
    resource="accounts"
    :title="$t('menu.aiGatewayAccounts')"
    :description="$t('aiGateway.desc.accounts')"
  >
    <template #row-actions="{ record }">
      <a-button type="link" size="small" @click="openSecrets(String(record.code))">
        {{ $t('aiGateway.secrets') }}
      </a-button>
    </template>
  </ResourcePage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import ResourcePage from '../components/ResourcePage.vue';

const router = useRouter();

function openSecrets(account: string) {
  router.push({ name: 'AiGatewaySecrets', query: { account } });
}
</script>
