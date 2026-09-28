<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('menu.aiGatewayConfigVersions') }}</h2>
      <a-button :loading="versionsLoading" @click="loadVersions">{{
        $t('common.refresh')
      }}</a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="$t('aiGateway.publishFlowHint')"
    />

    <a-card :title="$t('aiGateway.draft')" variant="borderless" style="margin-bottom: 16px">
      <a-space style="margin-bottom: 12px">
        <a-button v-permission="'ai_gateway:config'" :loading="validating" @click="handleValidate">
          {{ $t('aiGateway.validateDraft') }}
        </a-button>
        <a-button
          v-permission="'ai_gateway:config'"
          type="primary"
          :disabled="!validation || !validation.valid"
          @click="publishOpen = true"
        >
          {{ $t('aiGateway.publish') }}
        </a-button>
        <span v-if="validation" class="muted">
          {{ fieldLabel('draft_revision') }} = {{ validation.draft_revision }}
        </span>
      </a-space>

      <template v-if="validation">
        <a-alert
          :type="validation.valid ? (warnings.length ? 'warning' : 'success') : 'error'"
          show-icon
          style="margin-bottom: 12px"
          :message="
            validation.valid
              ? $t('aiGateway.validateOk', { warnings: warnings.length })
              : $t('aiGateway.validateFailed', { errors: errors.length })
          "
        />
        <a-table
          v-if="issues.length"
          :columns="issueColumns"
          :data-source="issues"
          :pagination="false"
          size="small"
          :row-key="(r: IssueRow) => r.level + r.path + r.check"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'level'">
              <a-tag :color="record.level === 'error' ? 'red' : 'orange'">{{
                enumShort(record.level)
              }}</a-tag>
            </template>
            <template v-if="column.dataIndex === 'path'">
              <code>{{ record.path }}</code>
            </template>
            <template v-if="column.dataIndex === 'check'">
              <span :title="record.check">{{ checkLabel(record.check) }}</span>
            </template>
          </template>
        </a-table>
      </template>
    </a-card>

    <a-card :title="$t('aiGateway.versions')" variant="borderless">
      <template #extra>
        <a-space v-if="canConfig">
          <span class="muted">{{ $t('aiGateway.versionProtectedHint') }}</span>
          <a-popconfirm
            :title="$t('aiGateway.batchDeleteVersionsConfirm', { n: selectedVersions.length })"
            :disabled="!selectedVersions.length"
            @confirm="removeVersions(selectedVersions)"
          >
            <a-button
              danger
              :loading="deleting"
              :disabled="
                !selectedVersions.length || selectedVersions.length > CONFIG_VERSION_DELETE_MAX
              "
            >
              {{ $t('aiGateway.batchDeleteVersions', { n: selectedVersions.length }) }}
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
      <a-table
        :columns="versionColumns"
        :data-source="versions"
        :loading="versionsLoading"
        :pagination="{ pageSize: 20 }"
        :row-selection="
          canConfig
            ? {
                selectedRowKeys: selectedVersions,
                onChange: (keys: (string | number)[]) => (selectedVersions = keys.map(Number)),
                getCheckboxProps: (r: ConfigVersion) => ({ disabled: isProtected(r) }),
              }
            : undefined
        "
        row-key="version"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'version'">
            <b>v{{ record.version }}</b>
            <a-tag v-if="record.current" color="green" style="margin-left: 6px">
              {{ $t('aiGateway.current') }}
            </a-tag>
          </template>
          <template v-if="column.dataIndex === 'sha256'">
            <code>{{ String(record.sha256).slice(0, 12) }}</code>
          </template>
          <template v-if="isTimeField(column.dataIndex)">
            {{ formatDateTime(record[column.dataIndex as string]) }}
          </template>
          <template v-if="column.dataIndex === 'rolled_back_from'">
            {{ record.rolled_back_from != null ? `v${record.rolled_back_from}` : '-' }}
          </template>
          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-if="!record.current"
                v-permission="'ai_gateway:config'"
                type="link"
                size="small"
                danger
                @click="openRollback(record.version)"
              >
                {{ $t('aiGateway.rollbackTo') }}
              </a-button>
              <a-popconfirm
                v-if="canConfig && !isProtected(record as ConfigVersion)"
                :title="$t('aiGateway.deleteVersionConfirm', { version: record.version })"
                @confirm="removeVersions([record.version])"
              >
                <a-button type="link" size="small" danger :disabled="deleting">
                  {{ $t('aiGateway.deleteVersion') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="publishOpen"
      :title="$t('aiGateway.publish')"
      :confirm-loading="publishing"
      @ok="handlePublish"
    >
      <p class="muted">
        {{ $t('aiGateway.publishConfirm', { revision: validation?.draft_revision ?? '-' }) }}
      </p>
      <a-textarea v-model:value="publishComment" :rows="3" :placeholder="$t('aiGateway.comment')" />
    </a-modal>

    <a-modal
      v-model:open="rollbackOpen"
      :title="$t('aiGateway.rollbackTo') + ` v${rollbackVersion}`"
      :confirm-loading="rollingBack"
      @ok="handleRollback"
    >
      <p class="muted">{{ $t('aiGateway.rollbackConfirm') }}</p>
      <a-textarea
        v-model:value="rollbackComment"
        :rows="3"
        :placeholder="$t('aiGateway.comment')"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  CONFIG_VERSION_DELETE_MAX,
  deleteConfigVersions,
  gatewayErrorOf,
  listConfigVersions,
  publishConfig,
  rollbackConfig,
  validateConfig,
  type ConfigIssue,
  type ConfigValidateResult,
  type ConfigVersion,
} from '@/api/ai-gateway';
import { usePermission } from '@/composables/usePermission';
import { formatDateTime } from '@/utils/helpers';

import { checkLabel, enumShort, fieldLabel } from '../components/gatewayI18n';
import { isTimeField } from '../components/schema';

/**
 * 草稿 → 校验 → 发布 → 回滚。
 *
 * 发布带上校验时的 draft_revision：校验之后若别人又改了草稿，网关回 409，
 * 要求重新校验——避免把没看过校验结果的改动一起发出去。回滚是把旧快照再发布成新版本，
 * 在途调用继续用各自开始时的快照。
 */
const { t } = useI18n();

type IssueRow = { level: 'error' | 'warning'; path: string; check: string; message: string };

const validation = ref<ConfigValidateResult | null>(null);
const validating = ref(false);
const errors = computed(() => validation.value?.errors || []);
const warnings = computed(() => validation.value?.warnings || []);
const issues = computed<IssueRow[]>(() => [
  ...errors.value.map((i) => ({ level: 'error' as const, ...i })),
  ...warnings.value.map((i) => ({ level: 'warning' as const, ...i })),
]);

const issueColumns = computed(() => [
  { title: t('aiGateway.level'), dataIndex: 'level', width: 90 },
  { title: t('aiGateway.path'), dataIndex: 'path', width: 320 },
  { title: t('aiGateway.check'), dataIndex: 'check', width: 200 },
  { title: t('aiGateway.message'), dataIndex: 'message' },
]);

async function handleValidate() {
  validating.value = true;
  try {
    validation.value = await validateConfig();
  } catch {
    validation.value = null;
  } finally {
    validating.value = false;
  }
}

const versions = ref<ConfigVersion[]>([]);
const versionsLoading = ref(false);
const versionColumns = computed(() => [
  { title: t('aiGateway.version'), dataIndex: 'version', width: 140 },
  { title: fieldLabel('sha256'), dataIndex: 'sha256', width: 140 },
  { title: t('aiGateway.publishedAt'), dataIndex: 'published_at', width: 200 },
  { title: t('aiGateway.publishedBy'), dataIndex: 'published_by', width: 140 },
  { title: t('aiGateway.comment'), dataIndex: 'comment', ellipsis: true },
  { title: t('aiGateway.rolledBackFrom'), dataIndex: 'rolled_back_from', width: 120 },
  { title: t('common.action'), key: 'operation', width: 180 },
]);

async function loadVersions() {
  versionsLoading.value = true;
  try {
    versions.value = await listConfigVersions(100);
  } catch {
    versions.value = [];
  } finally {
    versionsLoading.value = false;
  }
}
onMounted(loadVersions);

const publishOpen = ref(false);
const publishing = ref(false);
const publishComment = ref('');

async function handlePublish() {
  if (!validation.value) return;
  if (!publishComment.value.trim()) {
    message.warning(t('aiGateway.commentRequired'));
    return;
  }
  publishing.value = true;
  try {
    const v = await publishConfig({
      draft_revision: validation.value.draft_revision,
      comment: publishComment.value.trim(),
    });
    message.success(t('aiGateway.published', { version: v?.version ?? '-' }));
    publishOpen.value = false;
    publishComment.value = '';
    validation.value = null;
    loadVersions();
  } catch (e) {
    // 422 config.invalid：把网关给的逐条错误（error.details.errors）摆进校验结果表，不必再点一次校验；
    // 其余（409 = 校验后草稿又被改过等）：要求重新校验
    const ge = gatewayErrorOf(e);
    const list = ge?.check === 'config.invalid' ? ge.details?.errors : undefined;
    validation.value =
      Array.isArray(list) && validation.value
        ? {
            valid: false,
            draft_revision: validation.value.draft_revision,
            errors: list as ConfigIssue[],
          }
        : null;
    if (validation.value) publishOpen.value = false;
  } finally {
    publishing.value = false;
  }
}

// ---------------------------------------------------------------- 删除历史版本
// 当前版本与最新版本受保护：前者删了网关无配置可载，后者删了新发布会复用这个版本号（调用记录按版本号追溯）。
// 网关同样拦（409 details.protected），这里只是不给勾、不给按钮。
const { can } = usePermission();
const canConfig = computed(() => can('ai_gateway:config'));
const selectedVersions = ref<number[]>([]);
const deleting = ref(false);
const latestVersion = computed(() => Math.max(0, ...versions.value.map((v) => v.version)));

function isProtected(v: ConfigVersion) {
  return v.current || v.version === latestVersion.value;
}

async function removeVersions(list: number[]) {
  if (!list.length) return;
  deleting.value = true;
  try {
    const res = await deleteConfigVersions(list);
    message.success(t('aiGateway.versionsDeleted', { n: res?.deleted?.length ?? list.length }));
    selectedVersions.value = [];
  } catch (e) {
    // 全有或全无：把网关点名的版本列出来（拦截器只提示了概要）
    const details = gatewayErrorOf(e)?.details;
    const named = (key: string) =>
      Array.isArray(details?.[key]) && details[key].length
        ? (details[key] as number[]).map((v) => `v${v}`).join(', ')
        : '';
    const protectedList = named('protected');
    const missing = named('missing');
    if (protectedList) {
      message.warning({
        content: t('aiGateway.versionsProtected', { versions: protectedList }),
        duration: 8,
      });
    } else if (missing) {
      message.warning({
        content: t('aiGateway.versionsMissing', { versions: missing }),
        duration: 8,
      });
    }
  } finally {
    deleting.value = false;
    await loadVersions();
    // 拒收后留下的勾选里可能有已不存在或刚变成受保护的版本，只保留仍可删的
    const deletable = new Set(versions.value.filter((v) => !isProtected(v)).map((v) => v.version));
    selectedVersions.value = selectedVersions.value.filter((v) => deletable.has(v));
  }
}

const rollbackOpen = ref(false);
const rollingBack = ref(false);
const rollbackVersion = ref<number | null>(null);
const rollbackComment = ref('');

function openRollback(version: number) {
  rollbackVersion.value = version;
  rollbackComment.value = '';
  rollbackOpen.value = true;
}

async function handleRollback() {
  if (rollbackVersion.value == null) return;
  if (!rollbackComment.value.trim()) {
    message.warning(t('aiGateway.commentRequired'));
    return;
  }
  rollingBack.value = true;
  try {
    const v = await rollbackConfig({
      to_version: rollbackVersion.value,
      comment: rollbackComment.value.trim(),
    });
    message.success(t('aiGateway.published', { version: v?.version ?? '-' }));
    rollbackOpen.value = false;
    loadVersions();
  } catch {
    /* 拦截器已提示 */
  } finally {
    rollingBack.value = false;
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
