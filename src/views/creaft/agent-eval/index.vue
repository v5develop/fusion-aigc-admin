<template>
  <div class="page">
    <a-card v-permission="'agent_eval:run'" variant="borderless" title="发起评测" class="block">
      <a-alert
        type="info"
        show-icon
        class="note"
        message="评测在沙箱里运行：只真实调用所选模型，不会生成视频、不扣点、不影响线上数据"
      />
      <a-form layout="vertical" class="form">
        <a-form-item label="调用方式">
          <a-segmented v-model:value="form.mode" :options="modeOptions" @change="onModeChange" />
        </a-form-item>
        <a-form-item label="模型">
          <a-select
            v-model:value="form.ref"
            :options="modelOptions"
            :loading="optLoading"
            placeholder="选择模型"
            show-search
            option-filter-prop="label"
            class="w-model"
          >
            <template #option="{ label, isDefault }">
              {{ label }}
              <a-tag v-if="isDefault" color="green" class="tag-default">生产当前</a-tag>
            </template>
          </a-select>
          <a-tag v-if="refIsDefault" color="green" class="tag-inline">生产当前</a-tag>
        </a-form-item>
        <a-form-item label="调用上限" extra="到上限自动停止">
          <a-input-number v-model:value="form.maxCalls" :min="1" :max="2000" :precision="0" />
        </a-form-item>
        <a-form-item v-if="options && options.pass5CaseIds.length">
          <a-checkbox v-model:checked="form.onlyPass5">
            只跑 Pass^5 关键用例（{{ options.pass5CaseIds.length }} 个）
          </a-checkbox>
        </a-form-item>
        <a-form-item>
          <a-space align="center">
            <a-button
              type="primary"
              :loading="starting"
              :disabled="!!activeRun || !form.ref"
              @click="start"
            >
              开始评测
            </a-button>
            <span v-if="activeRun" class="muted">
              评测 #{{ activeRun.id }}（{{
                statusInfo(activeRun.status).label
              }}）进行中，同一时间只允许一个
              <a @click="openDetail(activeRun.id)">查看</a>
            </span>
            <span v-else-if="options" class="muted">
              共 {{ options.cases.total }} 个用例（档 2：{{ options.cases.tier2 }}，Pass^5：{{
                options.cases.pass5
              }}）
            </span>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card v-permission="'agent_eval:view'" variant="borderless" title="评测记录">
      <template #extra>
        <a-button size="small" @click="load()">刷新</a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #emptyText>
          <a-empty description="还没有评测记录" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'startedAt'">{{
            fmtTime(record.startedAt)
          }}</template>
          <template v-else-if="column.dataIndex === 'mode'">
            {{ MODE_LABEL[record.mode as EvalMode] }}
          </template>
          <template v-else-if="column.dataIndex === 'modelLabel'">
            {{ record.modelLabel || record.modelRef }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusInfo(record.status).color">{{
              statusInfo(record.status).label
            }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'progress'">
            <div class="prog">
              <a-progress
                :percent="progressPct(record)"
                size="small"
                :show-info="false"
                :status="isActive(record.status) ? 'active' : undefined"
              />
              <span class="muted">{{ doneOf(record) }} / {{ record.total }}</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'passRate'">{{ passRate(record) }}</template>
          <template v-else-if="column.dataIndex === 'pass5'">
            {{ record.pass5Passed }}/{{ record.pass5Total }}
          </template>
          <template v-else-if="column.dataIndex === 'llmCalls'">
            {{ record.llmCalls
            }}<span v-if="record.maxCalls" class="muted"> / {{ record.maxCalls }}</span>
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-button size="small" type="link" @click="openDetail(record.id)">查看</a-button>
            <a-popconfirm
              v-if="isActive(record.status)"
              title="取消这次评测？已跑完的用例结果会保留"
              @confirm="cancel(record.id)"
            >
              <a-button v-permission="'agent_eval:run'" size="small" type="link" danger>
                取消
              </a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
      <div class="pager">
        <span class="muted">共 {{ total }} 条</span>
        <a-pagination
          v-model:current="page"
          v-model:page-size="size"
          :total="total"
          show-size-changer
          :page-size-options="['10', '20', '50']"
          @change="load()"
        />
      </div>
    </a-card>

    <RunDetailDrawer v-model:open="detailOpen" :run-id="detailId" />
  </div>
</template>

<script setup lang="ts">
/**
 * 智能体评测（契约 §W）：发起（agent_eval:run）+ 运行列表 / 详情（agent_eval:view）。
 * 有评测在跑时每 5 秒刷新列表；同一时间只允许一个评测，后端有库内状态 + 行锁兜底，前端只是提前禁用按钮。
 */
import { message } from 'antdv-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  cancelEvalRun,
  createEvalRun,
  getEvalOptions,
  listEvalRuns,
  type EvalMode,
  type EvalOptions,
  type EvalRun,
} from '@/api/agent-eval';

import {
  MODE_LABEL,
  doneOf,
  fmtTime,
  isActive,
  passRate,
  progressPct,
  statusInfo,
} from './eval-meta';
import RunDetailDrawer from './RunDetailDrawer.vue';

const modeOptions = [
  { label: '网关', value: 'gateway' },
  { label: '直连', value: 'direct' },
];

const columns = [
  { title: '开始时间', dataIndex: 'startedAt', width: 170 },
  { title: '方式', dataIndex: 'mode', width: 70 },
  { title: '模型', dataIndex: 'modelLabel', width: 200, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 120 },
  { title: '进度', dataIndex: 'progress', width: 190 },
  { title: '通过率', dataIndex: 'passRate', width: 90 },
  { title: 'Pass^5', dataIndex: 'pass5', width: 90 },
  { title: '模型调用次数', dataIndex: 'llmCalls', width: 130 },
  { title: '操作', key: 'operation', width: 130, fixed: 'right' as const },
];

const options = ref<EvalOptions | null>(null);
const optLoading = ref(false);
const form = reactive({
  mode: 'gateway' as EvalMode,
  ref: undefined as string | undefined,
  maxCalls: 600 as number | null,
  onlyPass5: false,
});
const starting = ref(false);

const modelOptions = computed(() => {
  const o = options.value;
  if (!o) return [];
  const def = o.defaultModel;
  const isDef = (ref: string) => !!def && def.mode === form.mode && def.ref === ref;
  return form.mode === 'gateway'
    ? o.gatewayModelGroups.map((g) => ({
        value: g.code,
        label: g.label,
        isDefault: isDef(g.code),
      }))
    : o.directModels.map((m) => ({
        value: m.id,
        label: m.platform ? `${m.label}（${m.platform}）` : m.label,
        isDefault: isDef(m.id),
      }));
});
const refIsDefault = computed(
  () =>
    !!options.value?.defaultModel &&
    options.value.defaultModel.mode === form.mode &&
    options.value.defaultModel.ref === form.ref,
);

/** 切方式：回到该方式下的生产默认模型，没有则清空等用户选 */
function onModeChange() {
  const def = options.value?.defaultModel;
  form.ref = def && def.mode === form.mode ? def.ref : undefined;
}

async function loadOptions() {
  optLoading.value = true;
  try {
    options.value = await getEvalOptions();
    const def = options.value.defaultModel;
    if (def) {
      form.mode = def.mode;
      form.ref = def.ref;
    }
  } catch {
    /* 已提示 */
  } finally {
    optLoading.value = false;
  }
}

const rows = ref<EvalRun[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const loading = ref(false);
const activeRun = computed(() => rows.value.find((r) => isActive(r.status)));

let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
async function load(silent = false) {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const s = ++seq;
  if (!silent) loading.value = true;
  try {
    const res = await listEvalRuns(page.value, size.value);
    if (s !== seq) return;
    rows.value = res.list;
    total.value = res.total;
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
  // 有评测在跑就 5 秒后再拉；失败也继续，网络抖一下不该停掉刷新
  if (s === seq && rows.value.some((r) => isActive(r.status))) {
    timer = setTimeout(() => load(true), 5000);
  }
}

async function start() {
  if (!form.ref) return;
  const body = {
    mode: form.mode,
    ref: form.ref,
    maxCalls: form.maxCalls ?? 600,
    caseIds:
      form.onlyPass5 && options.value?.pass5CaseIds.length ? options.value.pass5CaseIds : undefined,
  };
  starting.value = true;
  try {
    await createEvalRun(body);
    message.success('评测已开始');
    page.value = 1;
    await load();
  } catch {
    /* 已提示（如已有评测在跑） */
    load(true);
  } finally {
    starting.value = false;
  }
}

async function cancel(id: string) {
  try {
    await cancelEvalRun(id);
    message.success('已请求取消');
    load();
  } catch {
    /* 已提示 */
  }
}

const detailOpen = ref(false);
const detailId = ref('');
function openDetail(id: string) {
  detailId.value = id;
  detailOpen.value = true;
}

onMounted(() => {
  loadOptions();
  load();
});
onBeforeUnmount(() => {
  seq++;
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.note {
  margin-bottom: 16px;
}
.form {
  max-width: 560px;
}
.w-model {
  width: 360px;
}
.tag-inline {
  margin-left: 8px;
}
.tag-default {
  margin-left: 6px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.prog {
  display: flex;
  align-items: center;
  gap: 8px;
}
.prog :deep(.ant-progress) {
  flex: 1;
  margin: 0;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
