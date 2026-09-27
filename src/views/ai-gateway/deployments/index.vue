<template>
  <ResourcePage
    resource="deployments"
    :title="$t('menu.aiGatewayDeployments')"
    :description="$t('aiGateway.desc.deployments')"
  />
</template>

<script setup lang="ts">
import ResourcePage from '../components/ResourcePage.vue';
</script>
