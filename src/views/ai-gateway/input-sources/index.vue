<template>
  <div class="input-sources">
    <a-card :loading="loading" :title="t('aiGateway.inputSources.title')">
      <a-alert
        :type="data.configured ? 'success' : 'warning'"
        show-icon
        :message="data.configured ? t('aiGateway.inputSources.statusConfigured') : t('aiGateway.inputSources.statusFallback')"
        :description="t('aiGateway.inputSources.hint')"
        style="margin-bottom: 16px"
      />

      <a-form layout="vertical" style="max-width: 720px">
        <a-form-item :label="t('aiGateway.inputSources.hostsLabel')" :validate-status="invalidHosts.length ? 'error' : ''" :help="invalidHostsHelp">
          <a-select
            v-model:value="form.hosts"
            mode="tags"
            style="width: 100%"
            :token-separators="[',', ' ']"
            :placeholder="t('aiGateway.inputSources.hostPlaceholder')"
            :open="false"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="saving" :disabled="invalidHosts.length > 0" @click="save">
              {{ t('aiGateway.inputSources.save') }}
            </a-button>
            <a-button :disabled="saving" @click="reset">{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getInputSourceHosts, putInputSourceHosts, type InputSourceHosts } from '@/api/ai-gateway';

const { t } = useI18n();
const router = useRouter();

// 与后端 InputSourceHosts 的校验一致：小写主机名，不含协议、路径、端口或用户信息
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

const loading = ref(false);
const saving = ref(false);
const data = reactive<InputSourceHosts>({ hosts: [], configured: false });
const form = reactive<{ hosts: string[] }>({ hosts: [] });

const invalidHosts = computed(() =>
  form.hosts.filter((host) => !HOST_RE.test(String(host).trim().toLowerCase())),
);
const invalidHostsHelp = computed(() =>
  invalidHosts.value.length
    ? `${t('aiGateway.inputSources.invalidHost')}: ${invalidHosts.value.join(', ')}`
    : '',
);

function apply(value: InputSourceHosts) {
  data.hosts = value.hosts ?? [];
  data.configured = value.configured !== false;
  form.hosts = [...data.hosts];
}

async function load() {
  loading.value = true;
  try {
    apply(await getInputSourceHosts());
  } catch {
    message.error(t('aiGateway.inputSources.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function reset() {
  form.hosts = [...data.hosts];
}

async function save() {
  saving.value = true;
  try {
    const normalized = [...new Set(form.hosts.map((host) => String(host).trim().toLowerCase()))].sort();
    const saved = await putInputSourceHosts(normalized);
    apply(saved);
    // 草稿已写入，发布后才生效：提示里给出去发布的入口（VNode，不用函数）
    message.success({
      content: h('span', [
        t('aiGateway.inputSources.saved', { count: saved.hosts.length }),
        ' ',
        h(
          'a',
          { onClick: () => router.push({ name: 'AiGatewayConfigVersions' }) },
          t('aiGateway.goPublish'),
        ),
      ]),
      duration: 6,
    });
  } catch {
    message.error(t('aiGateway.inputSources.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.input-sources {
  padding: 16px;
}
</style>
