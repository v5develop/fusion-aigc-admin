<template>
  <div class="page-container">
    <a-card :bordered="false" :title="$t('runtimeSettings.title')">
      <template #extra>
        <a-button :loading="loading" @click="load">{{ $t('runtimeSettings.refresh') }}</a-button>
      </template>

      <a-alert type="info" show-icon class="mb-4" :message="$t('runtimeSettings.alertTitle')">
        <template #description>
          <ul class="alert-list">
            <li>{{ $t('runtimeSettings.alertPriority') }}</li>
            <li>{{ $t('runtimeSettings.alertPropagation') }}</li>
            <li>{{ $t('runtimeSettings.alertValidation') }}</li>
          </ul>
        </template>
      </a-alert>

      <a-spin :spinning="loading">
        <a-empty v-if="!loading && !groups.length" />
        <div v-for="g in groups" :key="g.name" class="group-block">
          <h3 class="group-title">{{ g.name }}</h3>
          <a-table
            :columns="columns"
            :data-source="g.items"
            row-key="key"
            :pagination="false"
            size="middle"
            :scroll="{ x: 960 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'label'">
                <div class="setting-label">{{ record.label }}</div>
                <div v-if="record.description" class="setting-desc">{{ record.description }}</div>
                <div class="setting-key">{{ record.key }}</div>
              </template>
              <template v-else-if="column.key === 'effectiveValue'">
                <span class="value-text">{{ displayValue(record, record.effectiveValue) }}</span>
              </template>
              <template v-else-if="column.key === 'source'">
                <a-tag :color="record.source === 'DB' ? 'blue' : 'default'">
                  {{
                    record.source === 'DB'
                      ? $t('runtimeSettings.sourceDb')
                      : $t('runtimeSettings.sourceFile')
                  }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'fileValue'">
                <span class="value-text muted">{{ displayValue(record, record.fileValue) }}</span>
              </template>
              <template v-else-if="column.key === 'updatedAt'">
                <span class="muted">{{ formatTime(record.updatedAt) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a v-permission="'runtime_settings:update'" @click="openEdit(record)">
                    {{ $t('runtimeSettings.edit') }}
                  </a>
                  <a-popconfirm
                    v-if="record.source === 'DB'"
                    :title="$t('runtimeSettings.resetConfirm')"
                    @confirm="handleReset(record)"
                  >
                    <a v-permission="'runtime_settings:update'" class="danger-link">
                      {{ $t('runtimeSettings.reset') }}
                    </a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </a-spin>
    </a-card>

    <a-modal
      v-model:open="editOpen"
      :title="$t('runtimeSettings.editTitle', { label: editing?.label ?? '' })"
      :confirm-loading="saving"
      @ok="handleSave"
    >
      <template v-if="editing">
        <div class="setting-desc mb-2">{{ editing.description }}</div>
        <div class="setting-key mb-4">{{ editing.key }}</div>

        <a-form layout="vertical">
          <a-form-item :label="$t('runtimeSettings.newValue')">
            <a-auto-complete
              v-if="editing.type === 'MODEL_GROUP'"
              v-model:value="editText"
              :options="modelGroupOptions"
              :filter-option="filterOption"
              allow-clear
              style="width: 100%"
              :placeholder="$t('runtimeSettings.modelGroupPlaceholder')"
            />
            <a-select
              v-else-if="editing.type === 'MODEL_CODE' && modelCodeOptions.length"
              v-model:value="editSelect"
              :options="modelCodeOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              style="width: 100%"
              :placeholder="$t('runtimeSettings.modelCodePlaceholder')"
            />
            <a-switch v-else-if="editing.type === 'BOOLEAN'" v-model:checked="editBool" />
            <a-input-number
              v-else-if="editing.type === 'INT'"
              v-model:value="editNumber"
              :precision="0"
              style="width: 100%"
            />
            <a-input v-else v-model:value="editText" allow-clear />

            <div class="form-hint">
              {{
                $t('runtimeSettings.fileDefaultHint', {
                  value: displayValue(editing, editing.fileValue),
                })
              }}
            </div>
            <div v-if="editing.type !== 'BOOLEAN' && editing.type !== 'INT'" class="form-hint">
              {{ $t('runtimeSettings.blankHint') }}
            </div>
          </a-form-item>
        </a-form>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { RuntimeSetting } from '@/api/runtime-settings';
import type { AIModel } from '@/types/api';

import { message } from 'antdv-next';
/**
 * 运行参数：后端登记在册的运行时可调参数（DB > 配置文件）。
 *
 * 分组、名称、说明都由后端给中文，前端原样展示；这里只负责按类型给编辑器。
 * 保存前后端会做校验（模型组须在网关已就绪、模型须存在），不通过时拦截器会弹出后端的中文原因。
 */
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { listModelGroupOptions, toModelGroupSelectOptions } from '@/api/ai-gateway';
import { getModelOptions } from '@/api/model';
import {
  listRuntimeSettings,
  resetRuntimeSetting,
  updateRuntimeSetting,
} from '@/api/runtime-settings';

const { t } = useI18n();

const loading = ref(false);
const settings = ref<RuntimeSetting[]>([]);

const columns = computed(() => [
  { title: t('runtimeSettings.colLabel'), key: 'label', width: 360 },
  { title: t('runtimeSettings.colEffective'), key: 'effectiveValue', width: 200 },
  { title: t('runtimeSettings.colSource'), key: 'source', width: 110 },
  { title: t('runtimeSettings.colFileValue'), key: 'fileValue', width: 180 },
  { title: t('runtimeSettings.colUpdatedAt'), key: 'updatedAt', width: 170 },
  { title: t('common.action'), key: 'action', width: 150, fixed: 'right' as const },
]);

/** 按后端给的 group 分组，保持后端返回的先后顺序 */
const groups = computed(() => {
  const map = new Map<string, RuntimeSetting[]>();
  for (const s of settings.value) {
    const name = s.group || t('runtimeSettings.ungrouped');
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(s);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
});

function displayValue(s: RuntimeSetting, v: string | null | undefined) {
  if (v === null || v === undefined || v === '') return t('runtimeSettings.empty');
  if (s.type === 'BOOLEAN') {
    return v === 'true' ? t('runtimeSettings.on') : t('runtimeSettings.off');
  }
  if (s.type === 'MODEL_CODE') {
    const m = models.value.find((x) => x.code === v);
    if (m) return `${v}（${m.name}）`;
  }
  if (s.type === 'MODEL_GROUP') {
    const g = modelGroupOptions.value.find((x) => x.value === v);
    if (g) return g.label;
  }
  return v;
}

function formatTime(v: string | null) {
  return v ? v.replace('T', ' ').slice(0, 19) : '—';
}

async function load() {
  loading.value = true;
  try {
    settings.value = (await listRuntimeSettings()) ?? [];
  } catch {
    // Error handled by interceptor
  } finally {
    loading.value = false;
  }
}

// ===== 候选项：网关模型组 / 本地 AI 模型；取不到不影响页面，编辑器退化成文本框 =====
const modelGroupOptions = ref<{ label: string; value: string; disabled?: boolean }[]>([]);
const models = ref<AIModel[]>([]);

const modelCodeOptions = computed(() =>
  models.value
    .filter((m) => m.code)
    .map((m) => ({ label: `${m.code}（${m.name}）`, value: m.code })),
);

async function loadCandidates() {
  const [groupsRes, modelsRes] = await Promise.allSettled([
    listModelGroupOptions(),
    getModelOptions(),
  ]);
  if (groupsRes.status === 'fulfilled') {
    modelGroupOptions.value = toModelGroupSelectOptions(groupsRes.value);
  }
  if (modelsRes.status === 'fulfilled') {
    models.value = modelsRes.value ?? [];
  }
}

function filterOption(input: string, option?: { value?: unknown; label?: unknown }) {
  const q = input.toLowerCase();
  return (
    String(option?.value ?? '')
      .toLowerCase()
      .includes(q) ||
    String(option?.label ?? '')
      .toLowerCase()
      .includes(q)
  );
}

// ===== 编辑 =====
const editOpen = ref(false);
const saving = ref(false);
const editing = ref<RuntimeSetting | null>(null);
const editText = ref('');
const editSelect = ref<string | undefined>(undefined);
const editBool = ref(false);
const editNumber = ref<number | null>(null);

function openEdit(s: RuntimeSetting) {
  editing.value = s;
  const v = s.effectiveValue ?? '';
  editText.value = v;
  editSelect.value = v || undefined;
  editBool.value = v === 'true';
  const n = Number(v);
  editNumber.value = v !== '' && Number.isFinite(n) ? n : null;
  editOpen.value = true;
}

function currentValue(s: RuntimeSetting): string {
  switch (s.type) {
    case 'BOOLEAN':
      return editBool.value ? 'true' : 'false';
    case 'INT':
      return editNumber.value === null || editNumber.value === undefined
        ? ''
        : String(editNumber.value);
    case 'MODEL_CODE':
      return modelCodeOptions.value.length ? (editSelect.value ?? '') : editText.value.trim();
    default:
      return (editText.value ?? '').trim();
  }
}

function replaceItem(updated: RuntimeSetting | null | undefined) {
  if (!updated) return;
  const idx = settings.value.findIndex((s) => s.key === updated.key);
  if (idx >= 0) settings.value.splice(idx, 1, updated);
}

async function handleSave() {
  if (!editing.value) return;
  saving.value = true;
  try {
    const updated = await updateRuntimeSetting(editing.value.key, currentValue(editing.value));
    replaceItem(updated);
    message.success(t('runtimeSettings.saveSuccess'));
    editOpen.value = false;
  } catch {
    // 校验失败的中文原因由拦截器弹出，弹窗保持打开便于修改
  } finally {
    saving.value = false;
  }
}

async function handleReset(s: RuntimeSetting) {
  try {
    const updated = await resetRuntimeSetting(s.key);
    replaceItem(updated);
    message.success(t('runtimeSettings.resetSuccess'));
  } catch {
    // Error handled by interceptor
  }
}

onMounted(() => {
  load();
  loadCandidates();
});
</script>

<style scoped>
.alert-list {
  margin: 0;
  padding-left: 18px;
}

.group-block + .group-block {
  margin-top: 24px;
}

.group-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.setting-label {
  font-weight: 500;
}

.setting-desc {
  margin-top: 2px;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
  font-size: 12px;
  white-space: pre-wrap;
}

.setting-key,
.muted {
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  font-size: 12px;
}

.setting-key {
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.value-text {
  word-break: break-all;
}

.form-hint {
  margin-top: 4px;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  font-size: 12px;
}

.danger-link {
  color: var(--ant-color-error, #ff4d4f);
}
</style>
