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
      message="在这里统一配置能力、模型和执行参数，Java 与 Python 读取同一份数据库配置。模型以 ID 关联，模型编码由服务端派生，只读展示。Agent 选择启用的文本模型即可；按模型计费的能力仍需配置生效定价。协议与处理器由程序管理。"
    />

    <a-alert
      v-if="driftCount"
      type="error"
      show-icon
      style="margin-bottom: 12px"
      :message="`${driftCount} 条结构漂移：库里的绑定与冻结契约不一致。执行面开启时这会让应用起不来，需按提示把数据改回契约。`"
    />
    <a-alert
      v-if="brokenCount"
      :type="executionPlaneEnabled ? 'warning' : 'info'"
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
        :pagination="false"
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
      title="配置能力与执行模型"
      :confirm-loading="saving"
      width="680px"
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

      <a-form :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
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
        <template v-if="!isAgent(current) && form.executionProfile">
          <a-form-item label="执行配置">
            <a-checkbox v-model:checked="editExecutionProfile">调整共享执行参数（高级）</a-checkbox>
            <div class="muted">
              默认使用数据库配置。仅在需要调整执行池或候选 provider
              时展开；保存后两端读取同一份数据。
            </div>
          </a-form-item>
          <template v-if="editExecutionProfile">
            <a-form-item label="目标选择方式">
              <a-tag>{{ current?.executionTargetMode || '未登记' }}</a-tag>
              <span class="muted">{{ targetModeHint }}</span>
            </a-form-item>
            <a-form-item v-if="needsPool" label="执行池" required>
              <a-select
                v-model:value="form.executionProfile.poolName"
                :options="poolOptions"
                placeholder="从执行面已装载的池中选择"
                @change="form.executionProfile.providerKeys = []"
              />
            </a-form-item>
            <a-form-item label="选择策略">
              <a-select
                v-model:value="form.executionProfile.selectionPolicy"
                :options="selectionPolicyOptions"
              />
            </a-form-item>
            <a-form-item v-if="needsProviders" label="候选 provider" required>
              <a-space direction="vertical" style="width: 100%">
                <a-space
                  v-for="(_, index) in form.executionProfile.providerKeys"
                  :key="index"
                  style="width: 100%"
                >
                  <a-select
                    v-model:value="form.executionProfile.providerKeys[index]"
                    :options="providerOptions"
                    style="width: 320px"
                    :placeholder="`候选 ${index + 1}（按列表顺序）`"
                  />
                  <a-button danger @click="form.executionProfile.providerKeys.splice(index, 1)"
                    >移除</a-button
                  >
                </a-space>
                <a-button
                  :disabled="needsPool && !form.executionProfile.poolName"
                  @click="form.executionProfile.providerKeys.push('')"
                  >添加候选</a-button
                >
              </a-space>
            </a-form-item>
            <a-form-item label="暂存策略">
              <a-select
                v-model:value="form.executionProfile.stagingProfile"
                :options="stagingOptions"
              />
            </a-form-item>
            <a-form-item label="执行超时">
              <a-select
                v-model:value="form.executionProfile.timeoutProfile"
                :options="timeoutOptions"
              />
            </a-form-item>
          </template>
        </template>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="保存只更新共享配置，不改启用位；模型、计费和执行配置由服务端统一维护。配好后再点「启用」过自检。"
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
  configureCreaftBinding,
  disableCreaftBinding,
  enableCreaftBinding,
  getCreaftBindingModelOptions,
  getCreaftBindings,
  saveCreaftBindingPolicy,
  type CreaftBindingRow,
  type CreaftBindingState,
  type CreaftExecutionOptions,
  type CreaftExecutionProfile,
  type CreaftV1CapabilityRow,
} from '@/api/creaft-compat';

const rows = ref<CreaftBindingRow[]>([]);
const v1Capabilities = ref<CreaftV1CapabilityRow[]>([]);
const executionPlaneEnabled = ref(false);
const executionOptions = ref<CreaftExecutionOptions>({
  selectionPolicies: [],
  stagingProfiles: [],
  timeoutProfiles: [],
  pools: {},
  variantProviders: [],
  textModels: [],
});
const loading = ref(false);
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
const brokenMessage = computed(() =>
  executionPlaneEnabled.value
    ? `${brokenCount.value} 条已启用能力缺少必要配置，暂不可用；不影响整个 Java 服务启动。请补齐模型、执行配置或定价，也可先停用这些能力。`
    : `${brokenCount.value} 条已启用能力缺少必要配置。执行面当前未开启，请在使用这些能力前补齐模型、执行配置或定价；不影响整个 Java 服务启动。`,
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
    executionPlaneEnabled.value = !!overview?.executionPlaneEnabled;
    if (overview?.executionOptions) executionOptions.value = overview.executionOptions;
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
const editExecutionProfile = ref(false);
/**
 * 取值**集合**一律来自后端下发的执行清单，这里只放中文说明。
 *
 * 此前三张词表整份抄在这里，与后端校验、执行面的 profile_config.py、迁移的 CHECK 约束
 * 并列为第四份副本；池名和候选 provider 还是自由文本框，拼错要等到启动准入才有反馈。
 * 现在后端多一个取值这里自动出现（无中文说明就直接显示原值），少一个就自动消失。
 */
const VOCABULARY_LABELS: Record<string, string> = {
  FIXED_FIRST: '固定首个',
  ORDERED_FIRST_AVAILABLE: '按顺序选择可用项',
  ROUND_ROBIN: '轮询',
  'none-v1': '无需暂存',
  'verified-spool-v1': '校验后的暂存文件',
  'private-url-15m-v1': '私有链接（15 分钟）',
  'sync-60s-v1': '同步任务（60 秒）',
  'image-150s-v1': '图片任务（150 秒）',
  'media-600s-v1': '媒体任务（600 秒）',
};

function labelled(values: string[]) {
  return values.map((value) => ({
    label: VOCABULARY_LABELS[value] ? `${VOCABULARY_LABELS[value]}（${value}）` : value,
    value,
  }));
}

const selectionPolicyOptions = computed(() => labelled(executionOptions.value.selectionPolicies));
const stagingOptions = computed(() => labelled(executionOptions.value.stagingProfiles));
const timeoutOptions = computed(() => labelled(executionOptions.value.timeoutProfiles));
const poolOptions = computed(() =>
  Object.keys(executionOptions.value.pools).map((value) => ({ label: value, value })),
);

/**
 * 候选的可选集合。
 *
 * POOL 能力只能从所选池里挑（池外的 provider 执行面查不到，后端也会拒）；
 * SINGLE_PROVIDER 能力由后端按能力下发自己的集合（prompt-write 是已实现的文本模型）。
 */
const providerOptions = computed(() => {
  if (targetMode.value === 'SINGLE_PROVIDER') {
    return (current.value?.executionTargetOptions || []).map((value) => ({ label: value, value }));
  }
  const pool = form.executionProfile?.poolName;
  const members = pool ? executionOptions.value.pools[pool] : undefined;
  return (members || []).map((value) => ({ label: value, value }));
});

/** 执行目标怎么选。为空（执行面没实现这条能力）时按最保守的 POOL 渲染。 */
const targetMode = computed(() => current.value?.executionTargetMode ?? null);
const needsPool = computed(() => targetMode.value === 'POOL' || targetMode.value === null);
const needsProviders = computed(
  () =>
    targetMode.value === 'POOL' ||
    targetMode.value === 'SINGLE_PROVIDER' ||
    targetMode.value === null,
);
const targetModeHint = computed(() => {
  switch (targetMode.value) {
    case 'POOL':
      return '按池查 provider：先选池，再按顺序配候选。';
    case 'VARIANT':
      return '按请求里的模型别名区分执行目标，别名表由后端维护，这里不配池和候选。';
    case 'SINGLE_PROVIDER':
      return '固定一个 provider，不按池查找。';
    case 'JAVA_MODEL':
      return '执行目标由上面所选的模型派生，不需要配池和候选。';
    case 'HANDLER_OWNED':
      return 'provider 由执行面代码按操作类型自己挑，池和候选都不填。';
    default:
      return '执行面没有登记这条能力，保存可能被拒。';
  }
});
const form = reactive({
  modelId: undefined as number | undefined,
  executionProfile: null as CreaftExecutionProfile | null,
  billingFeatureCode: '',
  billingActionType: '',
});

/**
 * 执行目标由 Java 侧所选模型派生（当前只有 /agent/stream）。
 *
 * 判据取自后端下发的 executionTargetMode，不是路由字面量：同一件事后端已经把 Java、
 * 执行面注册表里写死的那两处删成了清单查表，这里再留一个 `route === '/agent/stream'`
 * 就是第三份，而且是加一条新的模型派生能力时最容易忘的那份。
 */
function isAgent(record: CreaftBindingRow | null) {
  return record?.executionTargetMode === 'JAVA_MODEL';
}

let configureRequest = 0;

async function openConfigure(record: CreaftBindingRow) {
  if (!record.bindingId) return;
  current.value = record;
  const requestId = ++configureRequest;
  modelOptions.value = [];
  form.modelId = record.modelId ?? undefined;
  form.executionProfile = record.executionProfile
    ? { ...record.executionProfile, providerKeys: [...record.executionProfile.providerKeys] }
    : null;
  editExecutionProfile.value = false;
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
  let executionProfile: CreaftExecutionProfile | undefined;
  if (!isAgent(current.value) && editExecutionProfile.value && form.executionProfile) {
    // 池与候选按目标选择方式取舍：此前这里无条件要求两者非空，而 VARIANT / HANDLER_OWNED
    // 两类能力在后端恰恰必须**没有**它们——那 10 条能力从这个弹窗根本存不下去。
    executionProfile = {
      ...form.executionProfile,
      poolName: needsPool.value ? (form.executionProfile.poolName || '').trim() || null : null,
      providerKeys: needsProviders.value
        ? form.executionProfile.providerKeys.map((key) => key.trim()).filter(Boolean)
        : [],
    };
    if (needsPool.value && !executionProfile.poolName) {
      message.warning('请选择执行池');
      return;
    }
    if (needsProviders.value && !executionProfile.providerKeys.length) {
      message.warning('请至少配置一个候选 provider');
      return;
    }
    if (targetMode.value === 'SINGLE_PROVIDER' && executionProfile.providerKeys.length !== 1) {
      message.warning('该能力必须恰好配置一个 provider');
      return;
    }
    if (new Set(executionProfile.providerKeys).size !== executionProfile.providerKeys.length) {
      message.warning('候选 provider 不能重复');
      return;
    }
  }
  saving.value = true;
  try {
    await configureCreaftBinding(current.value.bindingId, {
      modelId: form.modelId,
      executionProfile,
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
