<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <ExclamationCircleOutlined />
      </div>
      <h2 class="error-title">页面出错了</h2>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <a-button type="primary" @click="handleReload"> 重新加载 </a-button>
        <a-button @click="handleGoHome"> 返回首页 </a-button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ExclamationCircleOutlined } from '@antdv-next/icons';
import { ref, onErrorCaptured } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const hasError = ref(false);
const errorMessage = ref('发生了未知错误');

onErrorCaptured((err, _instance, info) => {
  console.error('[ErrorBoundary]', err, info);

  // 生产环境可接入错误监控平台
  if (import.meta.env.PROD) {
    reportError(err, info);
  }

  errorMessage.value = err instanceof Error ? err.message : String(err);
  hasError.value = true;
  return false;
});

function handleReload() {
  hasError.value = false;
  window.location.reload();
}

function handleGoHome() {
  hasError.value = false;
  router.push('/');
}

function reportError(error: unknown, info: string) {
  try {
    navigator.sendBeacon?.(
      '/api/error-report',
      JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        info,
        url: window.location.href,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // 静默失败
  }
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-layout);
}

.error-content {
  max-width: 400px;
  padding: 32px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  color: var(--color-error);
  margin-bottom: 16px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.error-message {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
