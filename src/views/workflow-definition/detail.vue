<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">
        {{ detail?.name || $t('workflowDefinition.list') }}
        <code v-if="detail" style="margin-left: 8px; font-size: 13px">{{ detail.code }}</code>
      </h2>
      <a-space>
        <a-button @click="router.push('/ai-gateway/workflow-definitions')">
          {{ $t('common.back') }}
        </a-button>
      </a-space>
    </div>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="5">
        <a-card :title="$t('workflowDefinition.versions')" variant="borderless" size="small">
          <a-empty v-if="!versions.length" :description="$t('workflowDefinition.noVersions')" />
          <a-list v-else :data-source="versions" size="small">
            <template #renderItem="{ item }">
              <a-list-item
                style="cursor: pointer"
                :style="
                  viewingVersion === item.version ? { background: 'rgba(22,119,255,0.08)' } : {}
                "
                @click="viewVersion(item.version)"
              >
                <div>
                  <b>{{ $t('workflowDefinition.versionItem', { version: item.version }) }}</b>
                  <div class="muted" style="font-size: 12px">
                    {{ item.publishedAt ? formatDateTime(item.publishedAt) : '-' }}
                    <span v-if="item.publishedBy"> · {{ item.publishedBy }}</span>
                  </div>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="13">
        <a-card :title="$t('workflowDefinition.editor')" variant="borderless" size="small">
          <template #extra>
            <a-space>
              <a-button v-if="!isReadonly" size="small" @click="formatJson">
                {{ $t('workflowDefinition.formatJson') }}
              </a-button>
              <a-button v-if="isReadonly" size="small" @click="backToEdit">
                {{ $t('workflowDefinition.backToEdit') }}
              </a-button>
              <a-button v-if="isReadonly" size="small" @click="loadToEditor">
                {{ $t('workflowDefinition.loadToEditor') }}
              </a-button>
              <a-button v-if="!isReadonly" :loading="validating" @click="doValidate">
                {{ $t('workflowDefinition.validate') }}
              </a-button>
              <a-button
                v-if="!isReadonly"
                v-permission="'ai_gateway:config'"
                type="primary"
                :loading="publishing"
                :disabled="!canPublish"
                @click="doPublish"
              >
                {{ $t('workflowDefinition.publish') }}
              </a-button>
            </a-space>
          </template>

          <a-alert
            v-if="isReadonly"
            type="info"
            show-icon
            style="margin-bottom: 8px"
            :message="$t('workflowDefinition.readonlyView', { version: viewingVersion })"
          />
          <a-alert
            v-else-if="validatedText !== null && validatedText !== text"
            type="warning"
            show-icon
            style="margin-bottom: 8px"
            :message="$t('workflowDefinition.stale')"
          />

          <ProCodeEditor
            :model-value="isReadonly ? readonlyText : text"
            language="json"
            :readonly="isReadonly"
            :height="520"
            @update:model-value="onEdit"
          />

          <div v-if="resultMsg" style="margin-top: 12px">
            <a-alert :type="resultOk ? 'success' : 'error'" show-icon :message="resultMsg" />
            <div v-if="errors.length" style="margin-top: 8px">
              <div style="font-weight: 500; margin-bottom: 4px">
                {{ $t('workflowDefinition.errorList') }}
              </div>
              <ul style="margin: 0; padding-left: 20px">
                <li v-for="(e, i) in errors" :key="i" style="color: #cf1322">
                  {{ formatValidationError(e) }}
                </li>
              </ul>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="6">
        <a-card :title="$t('workflowDefinition.stepKinds')" variant="borderless" size="small">
          <div class="muted" style="margin-bottom: 8px; font-size: 12px">
            {{ $t('workflowDefinition.stepKindsHint') }}
          </div>
          <a-space wrap>
            <a-tag
              v-for="k in stepKinds"
              :key="k"
              style="cursor: pointer"
              color="blue"
              @click="copy(k)"
            >
              {{ k }}
            </a-tag>
          </a-space>
          <a-divider style="margin: 12px 0" />
          <div class="muted" style="font-size: 12px; line-height: 1.7">
            {{ $t('workflowDefinition.structureHint') }}
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
  formatValidationError,
  getWorkflowDefinition,
  getWorkflowDefinitionVersion,
  listWorkflowDefinitionVersions,
  listWorkflowStepKinds,
  publishErrorsOf,
  publishWorkflowDefinition,
  validateWorkflowDefinition,
  type WorkflowDefinitionDetail,
  type WorkflowDefinitionVersion,
  type WorkflowValidationError,
} from '@/api/workflow-definition';
import ProCodeEditor from '@/components/Pro/ProCodeEditor/index.vue';
import { formatDateTime } from '@/utils/helpers';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const TEMPLATE = '{"schema":"workflow-definition/v1","inputs":{},"steps":[],"outputs":{}}';

const detail = ref<WorkflowDefinitionDetail | null>(null);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const stepKinds = ref<string[]>([]);

const text = ref('');
/** 最近一次校验通过时的内容；内容改动后与 text 不一致 => 需重新校验 */
const validatedText = ref<string | null>(null);

const viewingVersion = ref<number | null>(null);
const readonlyText = ref('');
const isReadonly = computed(() => viewingVersion.value !== null);

const validating = ref(false);
const publishing = ref(false);
const resultMsg = ref('');
const resultOk = ref(false);
const errors = ref<WorkflowValidationError[]>([]);

const canPublish = computed(
  () => validatedText.value !== null && validatedText.value === text.value,
);

function pretty(v: unknown): string {
  if (v === null || v === undefined) return pretty(JSON.parse(TEMPLATE));
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  return JSON.stringify(v, null, 2);
}

function parseText(): unknown | undefined {
  try {
    return JSON.parse(text.value);
  } catch (e) {
    resultOk.value = false;
    resultMsg.value = t('workflowDefinition.invalidJson', { msg: (e as Error).message });
    errors.value = [];
    return undefined;
  }
}

function onEdit(v: string) {
  text.value = v;
}

function formatJson() {
  try {
    text.value = JSON.stringify(JSON.parse(text.value), null, 2);
  } catch (e) {
    resultOk.value = false;
    resultMsg.value = t('workflowDefinition.invalidJson', { msg: (e as Error).message });
    errors.value = [];
  }
}

async function doValidate() {
  const def = parseText();
  if (def === undefined) return;
  validating.value = true;
  try {
    const snapshot = text.value;
    const res = await validateWorkflowDefinition(id, def);
    errors.value = res.errors ?? [];
    resultOk.value = !!res.valid;
    if (res.valid) {
      validatedText.value = snapshot;
      resultMsg.value = t('workflowDefinition.validateOk');
    } else {
      validatedText.value = null;
      resultMsg.value = t('workflowDefinition.validateFailed', { count: errors.value.length });
    }
  } finally {
    validating.value = false;
  }
}

function doPublish() {
  if (!canPublish.value) {
    message.warning(t('workflowDefinition.mustValidate'));
    return;
  }
  const def = parseText();
  if (def === undefined) return;
  Modal.confirm({
    title: t('workflowDefinition.publishConfirm'),
    async onOk() {
      publishing.value = true;
      try {
        const res = await publishWorkflowDefinition(id, def);
        message.success(t('workflowDefinition.publishOk', { version: res.version }));
        resultOk.value = true;
        resultMsg.value = t('workflowDefinition.publishOk', { version: res.version });
        errors.value = [];
        await refreshMeta();
      } catch (e) {
        const errs = publishErrorsOf(e);
        if (errs) {
          errors.value = errs;
          resultOk.value = false;
          resultMsg.value = t('workflowDefinition.publishFailed', { count: errs.length });
          validatedText.value = null;
        }
      } finally {
        publishing.value = false;
      }
    },
  });
}

async function viewVersion(version: number) {
  const content = await getWorkflowDefinitionVersion(id, version);
  readonlyText.value = pretty(content);
  viewingVersion.value = version;
}

function backToEdit() {
  viewingVersion.value = null;
}

function loadToEditor() {
  text.value = readonlyText.value;
  validatedText.value = null;
  viewingVersion.value = null;
}

async function copy(k: string) {
  try {
    await navigator.clipboard.writeText(k);
    message.success(t('workflowDefinition.copied'));
  } catch {
    // 剪贴板不可用时静默
  }
}

async function refreshMeta() {
  const [d, vs] = await Promise.all([
    getWorkflowDefinition(id),
    listWorkflowDefinitionVersions(id),
  ]);
  detail.value = d;
  versions.value = [...vs].sort((a, b) => b.version - a.version);
}

onMounted(async () => {
  try {
    await refreshMeta();
    text.value = pretty(detail.value?.content ?? null);
    stepKinds.value = await listWorkflowStepKinds();
  } catch {
    message.error(t('workflowDefinition.loadFailed'));
  }
});
</script>
