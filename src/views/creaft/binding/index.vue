<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 能力绑定</h2>
      <a-button :loading="loading" @click="loadList">刷新</a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="在这里配置每条能力用哪些模型：计费模型（Java 模型，以 ID 关联）与工作流各步骤的模型角色（网关模型组）。工作流由 Java 编排，供应商与中转站的选择在 AI 网关里配。Agent 选择启用的文本模型即可；按模型计费的能力仍需配置生效定价。"
    />

    <a-alert
      v-if="driftCount"
      type="error"
      show-icon
      style="margin-bottom: 12px"
      :message="`${driftCount} 条结构漂移：库里的绑定与冻结契约不一致，需按提示把数据改回契约。`"
    />
    <a-alert
      v-if="brokenCount"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="brokenMessage"
    />

    <a-alert
      v-for="item in unreadyV1"
      :key="item.capabilityCode"
      type="error"
      show-icon
      style="margin-bottom: 12px"
      :message="`v1 线能力 ${item.capabilityCode}（入口码 ${item.entryCode || '未声明'}）不可提交：${item.problems.join('；')}`"
      description="这条能力属于独立的 v1 协议，配置入口是「计费场景」与「定价管理」，配完记得刷计费缓存。"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select v-model:value="stateFilter" :options="stateOptions" style="width: 220px" />
        <a-input
          v-model:value="keyword"
          placeholder="按路由 / 能力码过滤"
          allow-clear
          style="width: 260px"
        />
        <span class="muted">
          就绪 {{ counts.READY }} · 停用 {{ counts.DISABLED }} · 装配失败
          {{ counts.NOT_ASSEMBLABLE }} · 漂移 {{ counts.DRIFT }} · 价目可出数
          {{ quoteReadyCount }}/{{ rows.length }}
        </span>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="tablePagination"
        row-key="creaftV1Route"
        size="middle"
        :scroll="{ x: 1480 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'creaftV1Route'">
            <div>
              <code class="route-code">{{ record.creaftV1Route }}</code>
            </div>
            <span class="muted">{{ record.displayName || record.capabilityCode }}</span>
          </template>

          <template v-if="column.dataIndex === 'billingPolicyKind'">
            <a-tag :color="record.requiresModelBinding ? 'purple' : 'default'">
              {{ record.billingPolicyKind || '-' }}
            </a-tag>
            <div v-if="record.fixedPoints !== null" class="muted">
              固定 {{ record.fixedPoints }} 点
            </div>
            <div v-if="record.freeQuota !== null" class="muted">
              每日免费 {{ record.freeQuota }} 次
            </div>
          </template>

          <template v-if="column.dataIndex === 'modelCode'">
            <template v-if="record.requiresModelBinding || isAgent(record)">
              <code v-if="record.modelCode" class="route-code">{{ record.modelCode }}</code>
              <a-tag v-else color="orange">未配模型</a-tag>
              <div v-if="catalogMismatch(record)" class="danger-text">
                价目行是 {{ record.pricingCatalogModelCode || '空' }}，与绑定不一致
              </div>
              <div v-else-if="record.pricingCatalogCode" class="muted">
                价目行 {{ record.pricingCatalogEnabled ? '已启用' : '未启用' }}
              </div>
            </template>
            <span v-else class="muted">该策略不按模型计价</span>
            <div v-if="roleEntries(record).length" class="role-list">
              <div v-for="[role, group] in roleEntries(record)" :key="role" class="muted">
                {{ role }} → <code>{{ group }}</code>
              </div>
            </div>
          </template>

          <template v-if="column.dataIndex === 'state'">
            <a-tag :color="stateColor(record.state)">{{ stateLabel(record.state) }}</a-tag>
            <div v-if="record.stateReason" class="muted reason">{{ record.stateReason }}</div>
          </template>

          <template v-if="column.dataIndex === 'quotePreviewReady'">
            <a-tag :color="record.quotePreviewReady ? 'green' : 'orange'">
              {{ record.quotePreviewReady ? '可出数' : '不出数' }}
            </a-tag>
            <a-tag v-if="!record.requiresModelBinding" color="blue">策略定价</a-tag>
            <div v-if="record.quotePreviewReason" class="muted reason">
              {{ record.quotePreviewReason }}
            </div>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4" direction="vertical" style="width: 100%">
              <a-button
                v-permission="'creaft_binding:config'"
                type="link"
                size="small"
                :disabled="!record.bindingId"
                @click="openConfigure(record)"
              >
                配置
              </a-button>
              <a-button
                v-if="record.policyEditable"
                v-permission="'creaft_binding:config'"
                type="link"
                size="small"
                :disabled="!record.bindingId"
                @click="openPolicy(record)"
              >
                改点数
              </a-button>
              <a-popconfirm
                v-if="!record.enabled"
                v-permission="'creaft_binding:config'"
                title="启用前服务端会做一次完整装配自检，缺少必要配置会拒绝启用。确认启用？"
                @confirm="handleEnable(record)"
              >
                <a-button type="link" size="small" :disabled="!record.bindingId">启用</a-button>
              </a-popconfirm>
              <a-popconfirm
                v-else
                v-permission="'creaft_binding:config'"
                title="停用后用户提交不到这条能力，价目接口也不再下发它。确认停用？"
                @confirm="handleDisable(record)"
              >
                <a-button type="link" size="small" danger>停用</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      title="配置能力与模型"
      :confirm-loading="saving"
      width="760px"
      @ok="handleSave"
    >
      <a-descriptions v-if="current" :column="1" size="small" bordered style="margin-bottom: 16px">
        <a-descriptions-item label="路由">{{ current.creaftV1Route }}</a-descriptions-item>
        <a-descriptions-item label="入口码（只读）">{{ current.entryCode }}</a-descriptions-item>
        <a-descriptions-item label="能力码（只读）">
          {{ current.capabilityCode }} / v{{ current.capabilityVersion }}
        </a-descriptions-item>
        <a-descriptions-item label="计费策略（只读）">
          {{ current.billingPolicyKind }}
        </a-descriptions-item>
        <a-descriptions-item label="价目码（只读）">
          {{ current.pricingCatalogCode || '无（该策略不走价目）' }}
        </a-descriptions-item>
      </a-descriptions>

      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 17 }">
        <a-form-item
          v-if="current?.requiresModelBinding || isAgent(current)"
          :label="isAgent(current) ? 'Agent 执行模型' : '计费模型'"
          required
        >
          <a-select
            v-model:value="form.modelId"
            :options="modelOptions"
            :loading="optionsLoading"
            show-search
            option-filter-prop="label"
            placeholder="选择启用中的 Java 模型"
          />
          <div v-if="isAgent(current)" class="muted">
            选择启用的 TEXT 模型，两端共用该模型 ID，模型编码和执行 provider 自动关联。 NO_CHARGE
            不要求计费绑定或定价。
          </div>
          <div v-else class="muted">
            不可选的项缺少前置条件：要么模型没挂到该计费能力，要么没有生效定价。
            这两样分别在「权益/能力」与「定价管理」里配。
          </div>
        </a-form-item>
        <a-form-item v-if="current?.billingPolicyKind === 'CATALOG_PRICE'" label="计费能力码">
          <a-input v-model:value="form.billingFeatureCode" placeholder="留空表示不改" />
        </a-form-item>
        <a-form-item v-if="current?.billingPolicyKind === 'CATALOG_PRICE'" label="计费动作类型">
          <a-input
            v-model:value="form.billingActionType"
            placeholder="留空表示不改，兼容面统一填 CREAFT_V1"
          />
          <div class="muted">
            报价按（计费模型 + 本动作类型）命中定价行，取值必须是「计费动作类型」字典里已启用的码。
            兼容面这 26 条统一用 CREAFT_V1，价钱的差异由模型表达 —— 填成路由或入口码会以
            「动作类型无效或已禁用」被拒。
          </div>
        </a-form-item>
        <template v-if="!isAgent(current)">
          <a-form-item label="工作流">
            <code v-if="current?.workflowCode">{{ current.workflowCode }}</code>
            <span v-else class="muted">未登记（由程序维护）</span>
          </a-form-item>
          <a-form-item label="模型角色">
            <div class="config-rows">
              <div v-for="row in form.roleRows" :key="row.id" class="config-row">
                <a-input v-model:value="row.role" :disabled="row.declared" placeholder="角色" />
                <a-select
                  v-model:value="row.group"
                  :options="groupOptionsFor(row.operation)"
                  :loading="groupsLoading"
                  show-search
                  allow-clear
                  option-filter-prop="label"
                  :placeholder="row.operation ? `选择模型组（${row.operation}）` : '选择模型组'"
                />
                <a-button v-if="!row.declared" danger @click="removeRoleRow(row.id)">移除</a-button>
                <a-tag v-else-if="row.required" color="orange">必填</a-tag>
              </div>
              <a-button @click="addRoleRow">添加角色</a-button>
            </div>
            <div class="muted">
              工作流每一步按角色取模型组；模型组的成员（哪些中转站、怎么切换）在「AI 网关 →
              模型组」里配。 启用时服务端会向网关查就绪度，模型组不存在或无可用部署会拒绝启用。
            </div>
          </a-form-item>
          <a-form-item label="视频模型别名">
            <div class="config-rows">
              <div v-for="row in form.aliasRows" :key="row.id" class="config-row">
                <a-input v-model:value="row.alias" placeholder="端上传的模型别名" />
                <a-select
                  v-model:value="row.group"
                  :options="groupOptionsFor(['video.generate', 'video.enhance'])"
                  :loading="groupsLoading"
                  show-search
                  allow-clear
                  option-filter-prop="label"
                  placeholder="选择视频模型组"
                />
                <a-button danger @click="removeAliasRow(row.id)">移除</a-button>
              </div>
              <a-button @click="addAliasRow">添加别名</a-button>
            </div>
            <div class="muted">只有端上按别名选视频模型的能力需要；其余能力留空。</div>
          </a-form-item>
        </template>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="保存只更新配置，不改启用位。配好后再点「启用」过自检（含网关模型组就绪度）。"
      />
    </a-modal>

    <a-modal v-model:open="policyVisible" title="配置策略点数" width="620px">
      <a-descriptions
        v-if="policyTarget"
        :column="1"
        size="small"
        bordered
        style="margin-bottom: 16px"
      >
        <a-descriptions-item label="路由">{{ policyTarget.creaftV1Route }}</a-descriptions-item>
        <a-descriptions-item label="计费策略（只读）">
          {{ policyTarget.billingPolicyKind }}
        </a-descriptions-item>
        <a-descriptions-item label="当前配置">
          固定 {{ policyTarget.fixedPoints ?? '-' }} 点<template
            v-if="policyTarget.freeQuota !== null"
          >
            ，每日免费 {{ policyTarget.freeQuota }} 次</template
          >
        </a-descriptions-item>
      </a-descriptions>

      <a-form :model="policyForm" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="固定点数" required>
          <a-input-number
            v-model:value="policyForm.fixedPoints"
            :min="0"
            :precision="0"
            style="width: 100%"
          />
          <div class="muted">填 0 表示这条能力改成免费。允许，但它是一次会留痕的显式决定。</div>
        </a-form-item>
        <a-form-item
          v-if="policyTarget?.billingPolicyKind === 'FREE_THEN_FIXED'"
          label="每日免费次数"
          required
        >
          <a-input-number
            v-model:value="policyForm.freeQuota"
            :min="0"
            :precision="0"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="修改原因" required>
          <a-textarea
            v-model:value="policyForm.reason"
            :rows="2"
            placeholder="例：促销期临时降价，负责人 X"
          />
          <div class="muted">必填。改价会进账，没有理由的改动事后无法复盘。</div>
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="保存直接更新唯一的当前点数配置，并记录修改原因。计费策略种类保持不变；按模型定价的能力请在定价管理修改。"
      />

      <template #footer>
        <a-space>
          <a-button @click="policyVisible = false">取消</a-button>
          <a-button type="primary" :loading="policySaving" @click="handleSavePolicy">保存</a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  listModelGroupOptions,
  toModelGroupSelectOptions,
  type ModelGroupOption,
} from '@/api/ai-gateway';
import {
  configureCreaftBinding,
  disableCreaftBinding,
  enableCreaftBinding,
  getCreaftBindingModelOptions,
  getCreaftBindings,
  saveCreaftBindingPolicy,
  type CreaftBindingRow,
  type CreaftBindingState,
  type CreaftV1CapabilityRow,
} from '@/api/creaft-compat';

const rows = ref<CreaftBindingRow[]>([]);
const v1Capabilities = ref<CreaftV1CapabilityRow[]>([]);
const loading = ref(false);
/** 这两页的全量数据一次取回（就绪度/绑定态要整批计算，统计数也取自全量），分页只在前端切片 */
const tablePagination = {
  pageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100'],
};
const stateFilter = ref<'' | CreaftBindingState>('');
const keyword = ref('');

const stateOptions = [
  { label: '全部状态', value: '' },
  { label: '就绪 READY', value: 'READY' },
  { label: '停用 DISABLED', value: 'DISABLED' },
  { label: '装配失败 NOT_ASSEMBLABLE', value: 'NOT_ASSEMBLABLE' },
  { label: '结构漂移 DRIFT', value: 'DRIFT' },
];

const counts = computed(() => {
  const base: Record<CreaftBindingState, number> = {
    READY: 0,
    DISABLED: 0,
    NOT_ASSEMBLABLE: 0,
    DRIFT: 0,
  };
  rows.value.forEach((r) => (base[r.state] = (base[r.state] || 0) + 1));
  return base;
});
const driftCount = computed(() => counts.value.DRIFT);
const brokenCount = computed(() => counts.value.NOT_ASSEMBLABLE);
const quoteReadyCount = computed(() => rows.value.filter((r) => r.quotePreviewReady).length);

/** v1 线能力缺配时提交会被直接拒，且它不在下面的表里 —— 只能单独告警 */
const unreadyV1 = computed(() => v1Capabilities.value.filter((item) => !item.ready));

/** 普通配置缺失只影响对应能力，不阻止整个 Java 服务启动。 */
const brokenMessage = computed(
  () =>
    `${brokenCount.value} 条已启用能力缺少必要配置，暂不可用；不影响整个 Java 服务启动。请补齐模型、模型角色（网关模型组需已发布且有可用部署）或定价，也可先停用这些能力。`,
);

const filteredRows = computed(() => {
  const word = keyword.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (stateFilter.value && r.state !== stateFilter.value) return false;
    if (!word) return true;
    return (
      r.creaftV1Route.toLowerCase().includes(word) ||
      (r.capabilityCode || '').toLowerCase().includes(word)
    );
  });
});

const columns = [
  { title: '路由', dataIndex: 'creaftV1Route', width: 300, fixed: 'left' as const },
  { title: '计费策略', dataIndex: 'billingPolicyKind', width: 170 },
  { title: '关联模型', dataIndex: 'modelCode', width: 280 },
  { title: '准入状态', dataIndex: 'state', width: 300 },
  { title: '价目接口', dataIndex: 'quotePreviewReady', width: 300 },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 90, fixed: 'right' as const },
];

/** 两张表的模型码必须逐字一致，不一致时装配自检会判失败 */
function catalogMismatch(record: CreaftBindingRow) {
  return (
    record.requiresModelBinding &&
    !!record.pricingCatalogCode &&
    record.modelCode !== record.pricingCatalogModelCode
  );
}

function stateColor(state: CreaftBindingState) {
  if (state === 'READY') return 'green';
  if (state === 'DISABLED') return 'default';
  return state === 'DRIFT' ? 'red' : 'orange';
}
function stateLabel(state: CreaftBindingState) {
  if (state === 'READY') return '就绪';
  if (state === 'DISABLED') return '停用';
  return state === 'DRIFT' ? '结构漂移' : '装配失败';
}

async function loadList() {
  loading.value = true;
  try {
    const overview = await getCreaftBindings();
    rows.value = overview?.rows || [];
    v1Capabilities.value = overview?.protocolV1Capabilities || [];
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
loadList();

// ---- 配置 ----
const modalVisible = ref(false);
const saving = ref(false);
const optionsLoading = ref(false);
const current = ref<CreaftBindingRow | null>(null);
const modelOptions = ref<{ label: string; value: number; disabled: boolean }[]>([]);

// ---- 模型角色 / 视频别名（选项来自网关模型组） ----
const modelGroups = ref<ModelGroupOption[]>([]);
const groupsLoading = ref(false);

async function loadModelGroups() {
  if (modelGroups.value.length || groupsLoading.value) return;
  groupsLoading.value = true;
  try {
    modelGroups.value = await listModelGroupOptions();
  } catch {
    message.warning('网关模型组加载失败，下拉为空；已配置的值照常保留');
  } finally {
    groupsLoading.value = false;
  }
}

/** 已配的值即使网关里已不存在也要能显示出来，否则一保存就被清掉 */
function groupOptionsFor(operation?: string | string[] | null) {
  const options = toModelGroupSelectOptions(modelGroups.value, operation || undefined);
  const known = new Set(options.map((o) => o.value));
  const extra = [...form.roleRows.map((r) => r.group), ...form.aliasRows.map((r) => r.group)]
    .filter((g): g is string => !!g && !known.has(g))
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .filter((g) => !modelGroups.value.some((m) => m.code === g))
    .map((g) => ({ label: `${g}（网关中不存在）`, value: g, disabled: false }));
  return [...options, ...extra];
}

function roleEntries(record: CreaftBindingRow) {
  return Object.entries(record.modelRoles || {});
}

let rowSeq = 0;
type RoleRow = {
  id: number;
  role: string;
  group: string | undefined;
  operation: string | null;
  declared: boolean;
  required: boolean;
};
type AliasRow = { id: number; alias: string; group: string | undefined };

function buildRoleRows(record: CreaftBindingRow): RoleRow[] {
  const roles = record.modelRoles || {};
  const rows: RoleRow[] = (record.modelRoleSlots || []).map((slot) => ({
    id: ++rowSeq,
    role: slot.role,
    group: roles[slot.role] || undefined,
    operation: slot.operation || null,
    declared: true,
    required: !!slot.required,
  }));
  for (const [role, group] of Object.entries(roles)) {
    if (!rows.some((r) => r.role === role)) {
      rows.push({ id: ++rowSeq, role, group, operation: null, declared: false, required: false });
    }
  }
  return rows;
}

function addRoleRow() {
  form.roleRows.push({
    id: ++rowSeq,
    role: '',
    group: undefined,
    operation: null,
    declared: false,
    required: false,
  });
}
function removeRoleRow(id: number) {
  form.roleRows = form.roleRows.filter((r) => r.id !== id);
}
function addAliasRow() {
  form.aliasRows.push({ id: ++rowSeq, alias: '', group: undefined });
}
function removeAliasRow(id: number) {
  form.aliasRows = form.aliasRows.filter((r) => r.id !== id);
}

const form = reactive({
  modelId: undefined as number | undefined,
  roleRows: [] as RoleRow[],
  aliasRows: [] as AliasRow[],
  billingFeatureCode: '',
  billingActionType: '',
});

/**
 * 执行模型取自所选 Java 模型（当前只有 /agent/stream）。
 *
 * 判据取自后端下发的 usesJavaModel，不是路由字面量：前端留一个 `route === '/agent/stream'`
 * 就是又一份副本，而且是加一条新的模型派生能力时最容易忘的那份。
 */
function isAgent(record: CreaftBindingRow | null) {
  return !!record?.usesJavaModel;
}

let configureRequest = 0;

async function openConfigure(record: CreaftBindingRow) {
  if (!record.bindingId) return;
  current.value = record;
  const requestId = ++configureRequest;
  modelOptions.value = [];
  form.modelId = record.modelId ?? undefined;
  form.roleRows = buildRoleRows(record);
  form.aliasRows = Object.entries(record.videoModelAliases || {}).map(([alias, group]) => ({
    id: ++rowSeq,
    alias,
    group,
  }));
  loadModelGroups();
  form.billingFeatureCode = record.billingFeatureCode || '';
  form.billingActionType = record.billingActionType || '';
  modalVisible.value = true;
  optionsLoading.value = true;
  try {
    const options = (await getCreaftBindingModelOptions(record.bindingId)) || [];
    if (requestId !== configureRequest) return;
    modelOptions.value = options.map((option) => {
      const missing = (
        record.billingPolicyKind === 'CATALOG_PRICE'
          ? [
              option.boundToFeature ? '' : '未挂到计费能力',
              option.hasActivePrice ? '' : '无生效定价',
            ]
          : []
      )
        .filter(Boolean)
        .join('、');
      return {
        label: `${option.code}（${option.name}）${missing ? ' — ' + missing : ''}`,
        value: option.modelId,
        disabled: !option.selectable,
      };
    });
  } catch {
    if (requestId === configureRequest) modelOptions.value = [];
  } finally {
    if (requestId === configureRequest) optionsLoading.value = false;
  }
}

async function handleSave() {
  if (!current.value?.bindingId) return;
  if (saving.value || optionsLoading.value) return;
  if ((current.value.requiresModelBinding || isAgent(current.value)) && !form.modelId) {
    message.warning('请选择模型');
    return;
  }
  let modelRoles: Record<string, string> | undefined;
  let videoModelAliases: Record<string, string> | undefined;
  if (!isAgent(current.value)) {
    modelRoles = {};
    for (const row of form.roleRows) {
      const role = row.role.trim();
      if (!role && !row.group) continue;
      if (!role) {
        message.warning('模型角色名不能为空');
        return;
      }
      if (role in modelRoles) {
        message.warning(`模型角色重复：${role}`);
        return;
      }
      if (!row.group) {
        if (row.required) {
          message.warning(`必填角色未选模型组：${role}`);
          return;
        }
        continue;
      }
      modelRoles[role] = row.group;
    }
    videoModelAliases = {};
    for (const row of form.aliasRows) {
      const alias = row.alias.trim();
      if (!alias && !row.group) continue;
      if (!alias || !row.group) {
        message.warning('视频模型别名与模型组须成对填写');
        return;
      }
      if (alias in videoModelAliases) {
        message.warning(`视频模型别名重复：${alias}`);
        return;
      }
      videoModelAliases[alias] = row.group;
    }
  }
  saving.value = true;
  try {
    await configureCreaftBinding(current.value.bindingId, {
      modelId: form.modelId,
      modelRoles,
      videoModelAliases,
      billingFeatureCode: form.billingFeatureCode.trim(),
      billingActionType: form.billingActionType.trim(),
    });
    message.success('已保存');
    modalVisible.value = false;
    loadList();
  } catch {
    /* 模型码不唯一等由后端拒绝，原因由拦截器提示 */
  } finally {
    saving.value = false;
  }
}

async function handleEnable(record: CreaftBindingRow) {
  if (!record.bindingId) return;
  try {
    await enableCreaftBinding(record.bindingId);
    message.success('已启用');
    loadList();
  } catch {
    /* 装配自检不通过时后端返回缺什么，拦截器已提示 */
  }
}

// ---- 当前策略点数 ----
const policyVisible = ref(false);
const policySaving = ref(false);
const policyTarget = ref<CreaftBindingRow | null>(null);
const policyForm = reactive({
  fixedPoints: 0 as number | null,
  freeQuota: null as number | null,
  reason: '',
});

function openPolicy(record: CreaftBindingRow) {
  if (!record.bindingId) return;
  policyTarget.value = record;
  policyForm.fixedPoints = record.fixedPoints;
  policyForm.freeQuota = record.freeQuota;
  policyForm.reason = '';
  policyVisible.value = true;
}

async function handleSavePolicy() {
  const target = policyTarget.value;
  if (!target?.bindingId) return;
  if (policyForm.fixedPoints === null || policyForm.fixedPoints < 0) {
    message.warning('固定点数必填且不能为负');
    return;
  }
  if (
    target.billingPolicyKind === 'FREE_THEN_FIXED' &&
    (policyForm.freeQuota === null || policyForm.freeQuota < 0)
  ) {
    message.warning('每日免费次数必填且不能为负');
    return;
  }
  if (!policyForm.reason.trim()) {
    message.warning('请填写修改原因');
    return;
  }
  policySaving.value = true;
  try {
    await saveCreaftBindingPolicy(target.bindingId, {
      fixedPoints: policyForm.fixedPoints,
      // 非 FREE_THEN_FIXED 传了会被后端拒（避免在页面上留一个永远不生效的值）
      freeQuota: target.billingPolicyKind === 'FREE_THEN_FIXED' ? policyForm.freeQuota : undefined,
      reason: policyForm.reason.trim(),
    });
    message.success('点数配置已保存');
    policyVisible.value = false;
    loadList();
  } catch {
    /* CATALOG_PRICE / NO_CHARGE 等由后端拒绝并说明原因，拦截器已提示 */
  } finally {
    policySaving.value = false;
  }
}

async function handleDisable(record: CreaftBindingRow) {
  if (!record.bindingId) return;
  try {
    await disableCreaftBinding(record.bindingId);
    message.success('已停用');
    loadList();
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
.reason {
  white-space: normal;
  word-break: break-all;
}
.danger-text {
  color: #cf1322;
  font-size: 12px;
}
.role-list {
  margin-top: 4px;
}
.config-rows {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.config-row {
  display: grid;
  grid-template-columns: minmax(0, 150px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.config-row > :first-child,
.config-row > :nth-child(2) {
  width: 100%;
  min-width: 0;
}
@media (max-width: 640px) {
  .config-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .config-row > :first-child {
    grid-column: 1 / -1;
  }
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  /* 描边让 chip 在浅色下（#fafafa 贴着 #fff）也有边界；暗色下是 #303030 的柔和边 */
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
</style>
