<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ pageTitle }}</h2>
      <a-space>
        <a-button :loading="loading" @click="reload">{{ $t('common.refresh') }}</a-button>
        <a-button
          v-permission="'ai_gateway:config'"
          type="primary"
          :disabled="!schema"
          @click="openCreate"
        >
          {{ $t('aiGateway.create') }}
        </a-button>
      </a-space>
    </div>

    <a-alert type="info" show-icon style="margin-bottom: 12px" :message="$t('aiGateway.draftHint')">
      <template v-if="description" #description>{{ description }}</template>
    </a-alert>
    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      style="margin-bottom: 12px"
      :message="loadError"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          :placeholder="$t('aiGateway.keywordPlaceholder')"
          allow-clear
          style="width: 280px"
        />
        <span class="muted">{{ $t('aiGateway.total', { count: filteredRows.length }) }}</span>
      </div>
      <a-table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="{ pageSize: 20, showSizeChanger: true }"
        :row-key="(r: GatewayResource) => String(r[codeField])"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="openEdit(record)">
                {{ $t('common.edit') }}
              </a-button>
              <slot name="row-actions" :record="record" />
              <a-popconfirm
                v-permission="'ai_gateway:config'"
                :title="$t('aiGateway.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>{{ $t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled === false ? 'default' : 'green'">
              {{ record.enabled === false ? $t('common.disabled') : $t('common.enabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === codeField">
            <code class="code-chip">{{ record[codeField] }}</code>
          </template>
          <template v-else>
            {{ displayValue(record[column.dataIndex as string]) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer
      v-model:open="editorOpen"
      :title="editingCode ? `${$t('common.edit')} ${editingCode}` : $t('aiGateway.create')"
      width="760"
      destroy-on-close
    >
      <a-alert
        v-if="formErrors.length"
        type="error"
        show-icon
        style="margin-bottom: 12px"
        :message="$t('aiGateway.formInvalid')"
      >
        <template #description>
          <div v-for="e in formErrors" :key="e.path + e.message">
            <code>{{ e.path }}</code> {{ e.message }}
          </div>
        </template>
      </a-alert>
      <SchemaForm
        v-if="schema"
        v-model="form"
        :schema="schema"
        :adapter-params-schema="adapterParamsSchema"
        :ref-options="refOptions"
        :disabled-keys="editingCode ? [codeField] : []"
        :errors="formErrors"
      />
      <template #footer>
        <a-space>
          <a-button @click="editorOpen = false">{{ $t('common.cancel') }}</a-button>
          <a-button
            v-permission="'ai_gateway:config'"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >
            {{ $t('aiGateway.saveDraft') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  deleteResource,
  getSchema,
  listAdapters,
  listResources,
  listSchemas,
  putResource,
  type AdapterCaps,
  type GatewayResource,
} from '@/api/ai-gateway';

import {
  ADAPTER_PARAMS_FLAG,
  buildDefault,
  displayValue,
  listColumnsOf,
  normalize,
  propertiesOf,
  prune,
  validate,
  type FieldError,
  type Schema,
} from './schema';
import SchemaForm from './SchemaForm.vue';

/**
 * 网关配置资源的通用增删改查页（服务商、账户、部署、模型组、价格模型）。
 *
 * 列、表单、校验都从 `GET schemas/{resource}` 推出来，页面本身不认识任何业务字段——
 * 网关新增配置项时这里不用改。写入的是网关**草稿**，到「配置版本」页校验并发布后才生效。
 */
const props = withDefaults(
  defineProps<{
    /** 资源名，与网关集合路径末段一致，如 `deployments`、`price-models` */
    resource: string;
    title?: string;
    description?: string;
    codeField?: string;
  }>(),
  { title: '', description: '', codeField: 'code' },
);

const { t } = useI18n();

const loading = ref(false);
const loadError = ref('');
const rows = ref<GatewayResource[]>([]);
const keyword = ref('');
const schema = ref<Schema | null>(null);
const indexTitle = ref('');
const collection = ref(`/${props.resource}`);
const adapters = ref<AdapterCaps[]>([]);
/** 引用字段候选：字段名 → 被引用集合的条目 */
const refCollections = ref<Record<string, GatewayResource[]>>({});

const pageTitle = computed(() => props.title || indexTitle.value || props.resource);

const columns = computed(() => {
  const cols = schema.value
    ? listColumnsOf(normalize(schema.value, schema.value).schema, schema.value)
    : [props.codeField];
  return [
    ...cols.map((key, i) => ({
      title: key,
      dataIndex: key,
      width: i === 0 ? 220 : 160,
      ellipsis: true,
      fixed: i === 0 ? ('left' as const) : undefined,
    })),
    {
      title: t('common.action'),
      key: 'operation',
      dataIndex: 'operation',
      width: 200,
      fixed: 'right' as const,
    },
  ];
});

const filteredRows = computed(() => {
  const word = keyword.value.trim().toLowerCase();
  if (!word) return rows.value;
  return rows.value.filter((r) => JSON.stringify(r).toLowerCase().includes(word));
});

/** 递归收集 schema 里出现过的属性名，用来判断要不要拉适配器与引用集合 */
function collectKeys(s: unknown, root: Schema, out: Set<string>, depth = 0) {
  if (!s || typeof s !== 'object' || depth > 8) return;
  const n = normalize(s as Schema, root).schema;
  if (n[ADAPTER_PARAMS_FLAG] === true) out.add(ADAPTER_PARAMS_FLAG);
  for (const [k, sub] of propertiesOf(n)) {
    out.add(k);
    collectKeys(sub, root, out, depth + 1);
  }
  if (n.items) collectKeys(n.items, root, out, depth + 1);
}

/** `provider_code` → `providers`，`price_model_code` → `price-models`：按命名约定推，不写死 */
function collectionForRefKey(key: string) {
  const base = key.slice(0, -'_code'.length).replace(/_/g, '-');
  return `/${base}s`;
}

async function loadMeta() {
  let schemaName = props.resource;
  try {
    const index = await listSchemas();
    const hit = index.find(
      (i) =>
        i.resource === props.resource ||
        i.path.endsWith(`/${props.resource}`) ||
        `${i.resource}s` === props.resource,
    );
    if (hit) {
      schemaName = hit.resource;
      collection.value = hit.path;
      indexTitle.value = hit.title;
    }
  } catch {
    /* 索引拿不到时按资源名直取 */
  }
  const res = await getSchema(schemaName);
  schema.value = (res?.schema as Schema) || null;

  const keys = new Set<string>();
  if (schema.value) collectKeys(schema.value, schema.value, keys);
  if (keys.has(ADAPTER_PARAMS_FLAG) || keys.has('adapter_kind')) {
    adapters.value = await listAdapters().catch(() => []);
  }
  const refs: Record<string, GatewayResource[]> = {};
  await Promise.all(
    [...keys]
      .filter((k) => k.endsWith('_code') && k !== props.codeField)
      .map(async (k) => {
        const path = collectionForRefKey(k);
        if (path === `/${props.resource}`) return;
        refs[k] = await listResources(path).catch(() => []);
      }),
  );
  refCollections.value = refs;
}

async function loadList() {
  rows.value = await listResources(collection.value);
}

async function reload() {
  loading.value = true;
  loadError.value = '';
  try {
    if (!schema.value) await loadMeta();
    await loadList();
  } catch (e) {
    loadError.value = (e as Error)?.message || t('aiGateway.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

// ---- 编辑 ----
const editorOpen = ref(false);
const editingCode = ref<string | null>(null);
const form = ref<Record<string, unknown>>({});
const formErrors = ref<FieldError[]>([]);
const saving = ref(false);

const refOptions = computed(() => {
  const out: Record<string, { label: string; value: string }[]> = {};
  for (const [key, list] of Object.entries(refCollections.value)) {
    out[key] = list
      .filter((r) => typeof r.code === 'string')
      .map((r) => ({
        label: r.display_name ? `${r.code}（${r.display_name}）` : String(r.code),
        value: String(r.code),
      }));
  }
  if (adapters.value.length) {
    out.adapter_kind = adapters.value.map((a) => ({ label: a.kind, value: a.kind }));
  }
  return out;
});

/**
 * 当前表单用哪个适配器：自身带 adapter_kind（服务商），或经 provider_code 查服务商的
 * adapter_kind（部署）。找不到时适配器参数退回 JSON 编辑。
 */
const adapterParamsSchema = computed<Schema | null>(() => {
  let kind = form.value.adapter_kind as string | undefined;
  if (!kind && typeof form.value.provider_code === 'string') {
    const provider = (refCollections.value.provider_code || []).find(
      (p) => p.code === form.value.provider_code,
    );
    kind = provider?.adapter_kind as string | undefined;
  }
  const hit = kind ? adapters.value.find((a) => a.kind === kind) : undefined;
  return (hit?.params_schema as Schema) || null;
});

function openCreate() {
  if (!schema.value) return;
  editingCode.value = null;
  const init = buildDefault(schema.value, schema.value);
  form.value = init && typeof init === 'object' ? (init as Record<string, unknown>) : {};
  formErrors.value = [];
  editorOpen.value = true;
}

function openEdit(record: GatewayResource) {
  editingCode.value = String(record[props.codeField]);
  form.value = JSON.parse(JSON.stringify(record));
  formErrors.value = [];
  editorOpen.value = true;
}

async function handleSave() {
  if (!schema.value) return;
  const body = prune(form.value) as GatewayResource;
  formErrors.value = validate(
    schema.value,
    body,
    schema.value,
    '',
    adapterParamsSchema.value || undefined,
  );
  const code = body[props.codeField];
  if (typeof code !== 'string' || !code) {
    formErrors.value.push({ path: `/${props.codeField}`, message: t('aiGateway.codeRequired') });
  }
  if (formErrors.value.length) return;
  saving.value = true;
  try {
    await putResource(collection.value, String(code), body);
    message.success(t('aiGateway.savedToDraft'));
    editorOpen.value = false;
    await loadList();
  } catch {
    /* 422 的具体判据由拦截器提示 */
  } finally {
    saving.value = false;
  }
}

async function handleDelete(record: GatewayResource) {
  try {
    await deleteResource(collection.value, String(record[props.codeField]));
    message.success(t('aiGateway.deletedFromDraft'));
    await loadList();
  } catch {
    /* 409：仍被引用，拦截器已提示 */
  }
}

defineExpose({ reload });
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
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.code-chip {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  font-size: 12px;
}
</style>
