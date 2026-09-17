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
      message="一行 = 冻结契约里的一条 creaft v1 路由。可改的只有「计费模型 / 计费能力码 / 计费动作类型 / 点数覆盖 / 启用位」；入口码、能力码、执行方选择器、计费策略种类、价目码由契约决定，直接改库会让下次启动判为结构漂移。CATALOG_PRICE 那些的价钱在「定价管理」里配（模型 + 定价）；FIXED / FREE_THEN_FIXED 的点数原本写死在契约里，现在可以用「改点数」覆盖（写独立的覆盖列，不碰契约投影，无缓存即刻生效）；NO_CHARGE 没有可改的数。"
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
      description="这条能力不在下面那 32 条冻结契约里，配置入口是「计费场景」与「定价管理」，配完记得刷计费缓存。"
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
            <div v-if="record.overrideFixedPoints !== null" class="muted">
              <span class="struck">冻结 {{ frozenFixedPoints(record) ?? '-' }} 点</span>
              <a-tag color="gold">覆盖 {{ record.overrideFixedPoints }} 点</a-tag>
            </div>
            <div v-else-if="frozenFixedPoints(record) !== null" class="muted">
              固定 {{ frozenFixedPoints(record) }} 点
            </div>
            <div v-if="record.effectiveFreeQuota !== null" class="muted">
              每日免费 {{ record.effectiveFreeQuota }} 次{{
                record.overrideFreeQuota !== null ? '（覆盖）' : ''
              }}
            </div>
          </template>

          <template v-if="column.dataIndex === 'modelCode'">
            <template v-if="record.requiresModelBinding">
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
                v-if="record.policyOverridable"
                v-permission="'creaft_binding:config'"
                type="link"
                size="small"
                :disabled="!record.bindingId"
                @click="openOverride(record)"
              >
                改点数
              </a-button>
              <a-popconfirm
                v-if="!record.enabled"
                v-permission="'creaft_binding:config'"
                title="启用前服务端会做一次完整装配自检，装配不起来会被拒绝（防止下次重启失败）。确认启用？"
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
      title="配置计费绑定"
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
        <a-form-item label="计费模型">
          <a-select
            v-model:value="form.modelCode"
            :options="modelOptions"
            :loading="optionsLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择启用中的 Java 模型"
          />
          <div class="muted">
            不可选的项缺少前置条件：要么模型没挂到该计费能力，要么没有生效定价。
            这两样分别在「权益/能力」与「定价管理」里配。
          </div>
        </a-form-item>
        <a-form-item label="计费能力码">
          <a-input v-model:value="form.billingFeatureCode" placeholder="留空表示不改" />
        </a-form-item>
        <a-form-item label="计费动作类型">
          <a-input v-model:value="form.billingActionType" placeholder="留空表示不改，兼容面统一填 CREAFT_V1" />
          <div class="muted">
            报价按（计费模型 + 本动作类型）命中定价行，取值必须是「计费动作类型」字典里已启用的码。
            兼容面这 26 条统一用 CREAFT_V1，价钱的差异由模型表达 —— 填成路由或入口码会以
            「动作类型无效或已禁用」被拒。
          </div>
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="保存只写配置，不改启用位；两张表（绑定 + 价目行）由服务端在同一事务里改成一致。配好后再点「启用」过自检。"
      />
    </a-modal>

    <a-modal
      v-model:open="overrideVisible"
      title="覆盖冻结策略里的点数"
      width="620px"
    >
      <a-descriptions v-if="overrideTarget" :column="1" size="small" bordered style="margin-bottom: 16px">
        <a-descriptions-item label="路由">{{ overrideTarget.creaftV1Route }}</a-descriptions-item>
        <a-descriptions-item label="计费策略（只读）">
          {{ overrideTarget.billingPolicyKind }}
        </a-descriptions-item>
        <a-descriptions-item label="契约冻结值">
          固定 {{ frozenFixedPoints(overrideTarget) ?? '-' }} 点<template
            v-if="frozenFreeQuota(overrideTarget) !== null"
          >
            ，每日免费 {{ frozenFreeQuota(overrideTarget) }} 次</template
          >
        </a-descriptions-item>
        <a-descriptions-item label="当前生效值">
          固定 {{ overrideTarget.effectiveFixedPoints ?? '-' }} 点<template
            v-if="overrideTarget.effectiveFreeQuota !== null"
          >
            ，每日免费 {{ overrideTarget.effectiveFreeQuota }} 次</template
          >
        </a-descriptions-item>
        <a-descriptions-item v-if="overrideTarget.overrideBy" label="上次覆盖">
          {{ overrideTarget.overrideBy }} · {{ overrideTarget.overrideTime }} ·
          {{ overrideTarget.overrideReason }}
        </a-descriptions-item>
      </a-descriptions>

      <a-form :model="overrideForm" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="固定点数" required>
          <a-input-number v-model:value="overrideForm.fixedPoints" :min="0" :precision="0" style="width: 100%" />
          <div class="muted">填 0 表示这条能力改成免费。允许，但它是一次会留痕的显式决定。</div>
        </a-form-item>
        <a-form-item v-if="overrideTarget?.billingPolicyKind === 'FREE_THEN_FIXED'" label="每日免费次数">
          <a-input-number v-model:value="overrideForm.freeQuota" :min="0" :precision="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="覆盖原因" required>
          <a-textarea v-model:value="overrideForm.reason" :rows="2" placeholder="例：促销期临时降价，负责人 X" />
          <div class="muted">必填。改价会进账，没有理由的改动事后无法复盘。</div>
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="只覆盖点数，不改计费策略种类：策略种类决定这条路由要不要配模型、价目接口走哪条分支、准入检查什么，运行期改它会让页面显示的判据与实扣脱节。"
      />

      <template #footer>
        <a-space>
          <a-popconfirm
            v-if="overrideTarget && overrideTarget.overrideFixedPoints !== null"
            title="清除后立即回到契约冻结值。确认？"
            @confirm="handleClearOverride"
          >
            <a-button danger>清除覆盖</a-button>
          </a-popconfirm>
          <a-button @click="overrideVisible = false">取消</a-button>
          <a-button type="primary" :loading="overrideSaving" @click="handleSaveOverride">保存</a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { computed, reactive, ref } from 'vue'
import {
  clearCreaftBindingPolicyOverride,
  configureCreaftBinding,
  disableCreaftBinding,
  enableCreaftBinding,
  getCreaftBindingModelOptions,
  getCreaftBindings,
  saveCreaftBindingPolicyOverride,
  type CreaftBindingRow,
  type CreaftBindingState,
  type CreaftV1CapabilityRow,
} from '@/api/creaft-compat'

const rows = ref<CreaftBindingRow[]>([])
const v1Capabilities = ref<CreaftV1CapabilityRow[]>([])
const executionPlaneEnabled = ref(false)
const loading = ref(false)
const stateFilter = ref<'' | CreaftBindingState>('')
const keyword = ref('')

const stateOptions = [
  { label: '全部状态', value: '' },
  { label: '就绪 READY', value: 'READY' },
  { label: '停用 DISABLED', value: 'DISABLED' },
  { label: '装配失败 NOT_ASSEMBLABLE', value: 'NOT_ASSEMBLABLE' },
  { label: '结构漂移 DRIFT', value: 'DRIFT' },
]

const counts = computed(() => {
  const base: Record<CreaftBindingState, number> = {
    READY: 0,
    DISABLED: 0,
    NOT_ASSEMBLABLE: 0,
    DRIFT: 0,
  }
  rows.value.forEach((r) => (base[r.state] = (base[r.state] || 0) + 1))
  return base
})
const driftCount = computed(() => counts.value.DRIFT)
const brokenCount = computed(() => counts.value.NOT_ASSEMBLABLE)
const quoteReadyCount = computed(() => rows.value.filter((r) => r.quotePreviewReady).length)

/** v1 线能力缺配时提交会被直接拒，且它不在下面的表里 —— 只能单独告警 */
const unreadyV1 = computed(() => v1Capabilities.value.filter((item) => !item.ready))

/**
 * 同一个 NOT_ASSEMBLABLE，后果取决于执行面开没开：
 * 开着时启动校验器会拦（下次重启起不来），关着时它根本不注册，只是开启前的待办。
 * 两种情况用同一句话说，必然有一边被误导。
 */
const brokenMessage = computed(() =>
  executionPlaneEnabled.value
    ? `${brokenCount.value} 条已启用但装配不起来：下一次重启会失败。请补齐模型/定价，或先停用这些能力。`
    : `${brokenCount.value} 条已启用但装配不起来。执行面当前未开启，暂不影响启动；开启执行面前必须补齐或停用，否则应用起不来。`,
)

const filteredRows = computed(() => {
  const word = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (stateFilter.value && r.state !== stateFilter.value) return false
    if (!word) return true
    return (
      r.creaftV1Route.toLowerCase().includes(word) ||
      (r.capabilityCode || '').toLowerCase().includes(word)
    )
  })
})

const columns = [
  { title: '路由', dataIndex: 'creaftV1Route', width: 300, fixed: 'left' as const },
  { title: '计费策略', dataIndex: 'billingPolicyKind', width: 170 },
  { title: '计费模型', dataIndex: 'modelCode', width: 280 },
  { title: '准入状态', dataIndex: 'state', width: 300 },
  { title: '价目接口', dataIndex: 'quotePreviewReady', width: 300 },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 90, fixed: 'right' as const },
]

/**
 * 冻结契约里的固定点数。解析失败就不显示——策略原文是只读的，这里不负责纠错。
 *
 * 生效值不在这里算：后端已经下发 effectiveFixedPoints（与提交、价目预览同一份解析）。
 * 前端自己再算一遍就是给同一个价钱造第二个口径。
 */
function frozenFixedPoints(record: CreaftBindingRow): number | null {
  if (!record.billingPolicyJson) return null
  try {
    const policy = JSON.parse(record.billingPolicyJson)
    return typeof policy.fixed_points === 'number' ? policy.fixed_points : null
  } catch {
    return null
  }
}

/** 契约冻结的每日免费次数，仅 FREE_THEN_FIXED 有 */
function frozenFreeQuota(record: CreaftBindingRow): number | null {
  if (!record.billingPolicyJson) return null
  try {
    const policy = JSON.parse(record.billingPolicyJson)
    return typeof policy.free_quota === 'number' ? policy.free_quota : null
  } catch {
    return null
  }
}

/** 两张表的模型码必须逐字一致，不一致时装配自检会判失败 */
function catalogMismatch(record: CreaftBindingRow) {
  return (
    record.requiresModelBinding &&
    !!record.pricingCatalogCode &&
    record.modelCode !== record.pricingCatalogModelCode
  )
}

function stateColor(state: CreaftBindingState) {
  if (state === 'READY') return 'green'
  if (state === 'DISABLED') return 'default'
  return state === 'DRIFT' ? 'red' : 'orange'
}
function stateLabel(state: CreaftBindingState) {
  if (state === 'READY') return '就绪'
  if (state === 'DISABLED') return '停用'
  return state === 'DRIFT' ? '结构漂移' : '装配失败'
}

async function loadList() {
  loading.value = true
  try {
    const overview = await getCreaftBindings()
    rows.value = overview?.rows || []
    v1Capabilities.value = overview?.protocolV1Capabilities || []
    executionPlaneEnabled.value = !!overview?.executionPlaneEnabled
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
loadList()

// ---- 配置 ----
const modalVisible = ref(false)
const saving = ref(false)
const optionsLoading = ref(false)
const current = ref<CreaftBindingRow | null>(null)
const modelOptions = ref<{ label: string; value: string; disabled: boolean }[]>([])
const form = reactive({
  modelCode: undefined as string | undefined,
  billingFeatureCode: '',
  billingActionType: '',
})

async function openConfigure(record: CreaftBindingRow) {
  if (!record.bindingId) return
  current.value = record
  form.modelCode = record.modelCode || undefined
  form.billingFeatureCode = record.billingFeatureCode || ''
  form.billingActionType = record.billingActionType || ''
  modalVisible.value = true
  optionsLoading.value = true
  try {
    const options = (await getCreaftBindingModelOptions(record.bindingId)) || []
    modelOptions.value = options.map((option) => {
      const missing = [
        option.boundToFeature ? '' : '未挂到计费能力',
        option.hasActivePrice ? '' : '无生效定价',
      ]
        .filter(Boolean)
        .join('、')
      return {
        label: `${option.code}（${option.name}）${missing ? ' — ' + missing : ''}`,
        value: option.code,
        disabled: !option.selectable,
      }
    })
  } catch {
    modelOptions.value = []
  } finally {
    optionsLoading.value = false
  }
}

async function handleSave() {
  if (!current.value?.bindingId) return
  saving.value = true
  try {
    await configureCreaftBinding(current.value.bindingId, {
      modelCode: form.modelCode ?? '',
      billingFeatureCode: form.billingFeatureCode.trim(),
      billingActionType: form.billingActionType.trim(),
    })
    message.success('已保存')
    modalVisible.value = false
    loadList()
  } catch {
    /* 模型码不唯一等由后端拒绝，原因由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleEnable(record: CreaftBindingRow) {
  if (!record.bindingId) return
  try {
    await enableCreaftBinding(record.bindingId)
    message.success('已启用')
    loadList()
  } catch {
    /* 装配自检不通过时后端返回缺什么，拦截器已提示 */
  }
}

// ---- 点数覆盖 ----
const overrideVisible = ref(false)
const overrideSaving = ref(false)
const overrideTarget = ref<CreaftBindingRow | null>(null)
const overrideForm = reactive({
  fixedPoints: 0 as number | null,
  freeQuota: null as number | null,
  reason: '',
})

function openOverride(record: CreaftBindingRow) {
  if (!record.bindingId) return
  overrideTarget.value = record
  // 默认填当前生效值而不是 0：多数改价是"在现价上调一点"，填 0 等于给一次误操作让路
  overrideForm.fixedPoints = record.effectiveFixedPoints ?? frozenFixedPoints(record) ?? 0
  overrideForm.freeQuota = record.effectiveFreeQuota
  overrideForm.reason = ''
  overrideVisible.value = true
}

async function handleSaveOverride() {
  const target = overrideTarget.value
  if (!target?.bindingId) return
  if (overrideForm.fixedPoints === null || overrideForm.fixedPoints < 0) {
    message.warning('固定点数必填且不能为负')
    return
  }
  if (!overrideForm.reason.trim()) {
    message.warning('请填写覆盖原因')
    return
  }
  overrideSaving.value = true
  try {
    await saveCreaftBindingPolicyOverride(target.bindingId, {
      fixedPoints: overrideForm.fixedPoints,
      // 非 FREE_THEN_FIXED 传了会被后端拒（避免在页面上留一个永远不生效的值）
      freeQuota:
        target.billingPolicyKind === 'FREE_THEN_FIXED' ? overrideForm.freeQuota : undefined,
      reason: overrideForm.reason.trim(),
    })
    message.success('已覆盖，立即生效')
    overrideVisible.value = false
    loadList()
  } catch {
    /* CATALOG_PRICE / NO_CHARGE 等由后端拒绝并说明原因，拦截器已提示 */
  } finally {
    overrideSaving.value = false
  }
}

async function handleClearOverride() {
  const target = overrideTarget.value
  if (!target?.bindingId) return
  try {
    await clearCreaftBindingPolicyOverride(target.bindingId)
    message.success('已清除覆盖，回到契约冻结值')
    overrideVisible.value = false
    loadList()
  } catch {
    /* 拦截器已提示 */
  }
}

async function handleDisable(record: CreaftBindingRow) {
  if (!record.bindingId) return
  try {
    await disableCreaftBinding(record.bindingId)
    message.success('已停用')
    loadList()
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
.struck {
  text-decoration: line-through;
  margin-right: 6px;
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
