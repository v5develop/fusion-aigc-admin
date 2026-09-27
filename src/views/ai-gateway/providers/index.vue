<template>
  <ResourcePage
    resource="providers"
    :title="$t('menu.aiGatewayProviders')"
    :description="$t('aiGateway.desc.providers')"
  />
</template>

<script setup lang="ts">
import ResourcePage from '../components/ResourcePage.vue';
</script>
