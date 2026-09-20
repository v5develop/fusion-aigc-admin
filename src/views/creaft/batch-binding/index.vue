<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 批量托管绑定</h2>
      <a-space>
        <a-button @click="reload">刷新</a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="/batch-hosting/ecom-image/* 的技能绑定。一行技能 = 一条绑定：没有绑定的技能，用户点批量托管会收到「该技能尚未配置Java权威提交能力」。"
    />

    <a-alert
      v-if="unboundExpected > 0"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`有 ${unboundExpected} 条电商平台生图技能还没有绑定，这些技能的批量托管现在是不可用的。它们共用同一套取值，选中后用上方「批量绑定」一次配完。`"
    />

    <a-card variant="borderless" style="margin-bottom: 12px">
      <div class="filter-bar">
        <span class="field-label">批量绑定</span>
        <a-select
          v-model:value="form.modelCode"
          :options="modelSelectOptions"
          placeholder="选择模型"
          style="width: 240px"
          @change="loadEntryOptions"
        />
        <a-select
          v-model:value="form.entryCode"
          :options="entrySelectOptions"
          placeholder="选择计费入口"
          style="width: 320px"
          option-label-prop="label"
        />
        <a-input
          v-model:value="form.taskType"
          placeholder="创作类型，留空按入口归一"
          style="width: 200px"
        />
        <a-button
          type="primary"
          :loading="bulkSaving"
          :disabled="!selectedIds.length || !form.modelCode || !form.entryCode"
          @click="bulkBind"
        >
          绑定选中 {{ selectedIds.length }} 条
        </a-button>
      </div>
      <div v-if="selectedEntry" class="muted">
        {{ selectedEntry.name }} · 计费能力 {{ selectedEntry.featureCode || '—' }} · 档位
        {{ selectedEntry.variantCode || '—' }} ·
        <template v-if="selectedEntry.resolvedMode != null">
          提交会走 <strong>mode {{ selectedEntry.resolvedMode }}</strong>
        </template>
        <template v-else>未选模型，执行 mode 待定</template>
        <span v-if="selectedEntry.billedComponents === 1" class="muted warn">
          　该入口只有一条计费项，模型不参与选档——换模型不会改变出图方式
        </span>
        <span v-if="selectedEntry.problem" class="muted warn">　{{ selectedEntry.problem }}</span>
      </div>
    </a-card>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="按技能名或编码过滤"
          allow-clear
          style="width: 240px"
          @press-enter="loadList"
          @change="onKeywordChange"
        />
        <a-checkbox v-model:checked="onlyUnbound" @change="loadList">只看未绑定</a-checkbox>
        <span class="muted">
          共 {{ rows.length }} 条 / 已绑定 {{ boundCount }} 条 / 其中可提交 {{ usableCount }} 条
        </span>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        :row-selection="rowSelection"
        row-key="agentSkillId"
        size="middle"
      >
        <template #emptyText>
          <a-empty description="技能目录为空。技能身份来自 v1，本页不新增技能" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">{{ record.title }}</div>
            <code class="route-code">{{ record.agentSkillCode }}</code>
            <a-tag v-if="record.amazonImageTypes" color="blue" style="margin-left: 4px">
              亚马逊A+
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'binding'">
            <template v-if="record.bound">
              <code class="route-code">{{ record.entryCode }}</code>
              <span class="muted">　{{ record.modelCode }}　{{ record.taskType }}</span>
            </template>
            <span v-else class="muted">
              未绑定<template v-if="record.expectedBatchSkill">（按 v1 该有）</template>
            </span>
          </template>

          <template v-if="column.dataIndex === 'resolvedMode'">
            <span v-if="record.resolvedMode != null">mode {{ record.resolvedMode }}</span>
            <span v-else class="muted">—</span>
          </template>

          <template v-if="column.dataIndex === 'state'">
            <a-tag v-if="!record.bound">未配置</a-tag>
            <a-tag v-else-if="record.problem" color="red">不可提交</a-tag>
            <a-tag v-else-if="record.enabled !== 1" color="orange">已停用</a-tag>
            <a-tag v-else color="green">可提交</a-tag>
            <div v-if="record.problem" class="muted warn">{{ record.problem }}</div>
            <div v-if="record.bound && record.skillTitleInSync === false" class="muted warn">
              绑定里的技能名与目录不一致，亚马逊图种判定可能是旧的，重新保存即可同步
            </div>
          </template>

          <template v-if="column.dataIndex === 'operation'">
            <a-space size="small">
              <a-button type="link" size="small" @click="openEdit(record)">配置</a-button>
              <a-button
                v-if="record.bound && record.enabled === 1"
                type="link"
                size="small"
                danger
                @click="toggle(record, false)"
              >
                停用
              </a-button>
              <a-button
                v-else-if="record.bound"
                type="link"
                size="small"
                @click="toggle(record, true)"
              >
                启用
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="`配置绑定 — ${editing?.title ?? ''}`"
      :confirm-loading="saving"
      width="620px"
      @ok="save"
    >
      <a-form layout="vertical">
        <a-form-item label="模型">
          <a-select
            v-model:value="editForm.modelCode"
            :options="modelSelectOptions"
            placeholder="选择模型"
            @change="loadEditEntryOptions"
          />
        </a-form-item>
        <a-form-item label="计费入口">
          <a-select
            v-model:value="editForm.entryCode"
            :options="editEntrySelectOptions"
            placeholder="选择计费入口"
            option-label-prop="label"
          />
          <div v-if="editEntry" class="muted">
            <template v-if="editEntry.resolvedMode != null">
              提交会走 mode {{ editEntry.resolvedMode }}
            </template>
            <template v-else>执行 mode 待定</template>
            <span v-if="editEntry.problem" class="muted warn">　{{ editEntry.problem }}</span>
          </div>
        </a-form-item>
        <a-form-item label="创作类型">
          <a-input
            v-model:value="editForm.taskType"
            placeholder="留空则按入口的类目归一，电商生图是 image"
          />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="editForm.enabled" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  bulkBindCreaftBatchBindings,
  disableCreaftBatchBinding,
  enableCreaftBatchBinding,
  getCreaftBatchBindingEntryOptions,
  getCreaftBatchBindingModelOptions,
  getCreaftBatchBindings,
  saveCreaftBatchBinding,
  type CreaftBatchBindingEntryOption,
  type CreaftBatchBindingModelOption,
  type CreaftBatchBindingRow,
} from '@/api/creaft-compat';

const rows = ref<CreaftBatchBindingRow[]>([]);
const loading = ref(false);
const keyword = ref('');
const onlyUnbound = ref(false);
const selectedIds = ref<string[]>([]);
const bulkSaving = ref(false);

const models = ref<CreaftBatchBindingModelOption[]>([]);
const entries = ref<CreaftBatchBindingEntryOption[]>([]);
const editEntries = ref<CreaftBatchBindingEntryOption[]>([]);

const form = reactive({
  modelCode: undefined as string | undefined,
  entryCode: undefined as string | undefined,
  taskType: '',
});

const columns = [
  { title: '技能', dataIndex: 'title', width: 300 },
  { title: '绑定', dataIndex: 'binding', width: 320 },
  { title: '执行', dataIndex: 'resolvedMode', width: 110 },
  { title: '状态', dataIndex: 'state', width: 240 },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 140, align: 'center' as const },
];

const boundCount = computed(() => rows.value.filter((row) => row.bound).length);
const usableCount = computed(
  () => rows.value.filter((row) => row.bound && !row.problem && row.enabled === 1).length,
);
/** 按 v1 的编码形状该有绑定、却还没绑的条数——这一页要消掉的就是这个数 */
const unboundExpected = computed(
  () => rows.value.filter((row) => row.expectedBatchSkill && !row.bound).length,
);

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys: (string | number)[]) => {
    selectedIds.value = keys.map(String);
  },
}));

/**
 * 非图片模型也列出来，但标注清楚。
 *
 * 服务端不按 model_type 过滤——类型是后台手填的，填错一个这里就会少一行且没有任何提示，
 * 而少的那一行恰好是要选的模型时，页面表现是下拉空着。选错的后果由保存时的校验拦。
 */
const modelSelectOptions = computed(() =>
  models.value.map((model) => ({
    label: `${model.name}（${model.code}）${model.imageModel === false ? ' · 非图片模型' : ''}`,
    value: model.code,
    // 提交侧反查不到的模型置灰：不置灰的话运营能选中一个「一保存就报模型不存在」的模型，
    // 而它明明就在列表里。原因挂在 title 上，鼠标悬停即可看到该怎么办
    disabled: model.selectable === false,
    title: model.problem ?? undefined,
  })),
);

/** 不可选的入口也留在列表里并注明原因：只给可选项会让「我要的入口去哪了」无从下手 */
function toEntryOptions(list: CreaftBatchBindingEntryOption[]) {
  return list.map((entry) => ({
    label: `${entry.name ?? entry.entryCode}（${entry.entryCode}）`,
    value: entry.entryCode,
    disabled: !entry.selectable,
    title: entry.problem ?? `mode ${entry.resolvedMode ?? '待定'}`,
  }));
}
const entrySelectOptions = computed(() => toEntryOptions(entries.value));
const editEntrySelectOptions = computed(() => toEntryOptions(editEntries.value));
const selectedEntry = computed(() => entries.value.find((e) => e.entryCode === form.entryCode));
const editEntry = computed(() => editEntries.value.find((e) => e.entryCode === editForm.entryCode));

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(loadList, 300);
}

async function loadList() {
  loading.value = true;
  try {
    rows.value =
      (await getCreaftBatchBindings({
        onlyUnbound: onlyUnbound.value || undefined,
        keyword: keyword.value.trim() || undefined,
      })) || [];
    // 选中项跟着可见行收敛，避免"筛掉了还在选中里"导致批量绑定命中看不见的行
    const visible = new Set(rows.value.map((row) => row.agentSkillId));
    selectedIds.value = selectedIds.value.filter((id) => visible.has(id));
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadModelOptions() {
  try {
    models.value = (await getCreaftBatchBindingModelOptions()) || [];
  } catch {
    /* 候选缺失不影响列表 */
  }
}

async function loadEntryOptions() {
  try {
    entries.value = (await getCreaftBatchBindingEntryOptions(form.modelCode)) || [];
    // 换模型后原入口可能已不可选（该入口没为新模型配档），清掉比留着更安全
    if (
      form.entryCode &&
      !entries.value.some((e) => e.entryCode === form.entryCode && e.selectable)
    ) {
      form.entryCode = undefined;
    }
  } catch {
    /* 拦截器已提示 */
  }
}

async function loadEditEntryOptions() {
  try {
    editEntries.value = (await getCreaftBatchBindingEntryOptions(editForm.modelCode)) || [];
  } catch {
    /* 拦截器已提示 */
  }
}

function reload() {
  loadList();
  loadModelOptions();
  loadEntryOptions();
}

reload();

async function bulkBind() {
  bulkSaving.value = true;
  try {
    const result = await bulkBindCreaftBatchBindings(selectedIds.value, {
      entryCode: form.entryCode as string,
      modelCode: form.modelCode as string,
      taskType: form.taskType.trim() || undefined,
    });
    message.success(`已绑定 ${result.bound} 条，提交会走 mode ${result.resolvedMode ?? '—'}`);
    selectedIds.value = [];
    loadList();
  } catch {
    /* 拦截器已提示 */
  } finally {
    bulkSaving.value = false;
  }
}

// ---- 单条配置 ----
const modalVisible = ref(false);
const saving = ref(false);
const editing = ref<CreaftBatchBindingRow | null>(null);
const editForm = reactive({
  modelCode: undefined as string | undefined,
  entryCode: undefined as string | undefined,
  taskType: '',
  enabled: true,
});

function openEdit(record: CreaftBatchBindingRow) {
  editing.value = record;
  // 未绑定时用批量那栏已选的取值预填：多半就是要配成同一套
  editForm.modelCode = record.modelCode ?? form.modelCode;
  editForm.entryCode = record.entryCode ?? form.entryCode;
  editForm.taskType = record.taskType ?? '';
  editForm.enabled = record.bound ? record.enabled === 1 : true;
  editEntries.value = [];
  modalVisible.value = true;
  loadEditEntryOptions();
}

async function save() {
  if (!editing.value) return;
  if (!editForm.modelCode || !editForm.entryCode) {
    message.warning('请先选择模型与计费入口');
    return;
  }
  saving.value = true;
  try {
    await saveCreaftBatchBinding(editing.value.agentSkillId, {
      entryCode: editForm.entryCode,
      modelCode: editForm.modelCode,
      taskType: editForm.taskType.trim() || undefined,
      enabled: editForm.enabled ? 1 : 0,
    });
    message.success('已保存');
    modalVisible.value = false;
    loadList();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function toggle(record: CreaftBatchBindingRow, enabled: boolean) {
  try {
    await (enabled
      ? enableCreaftBatchBinding(record.agentSkillId)
      : disableCreaftBatchBinding(record.agentSkillId));
    message.success(enabled ? '已启用' : '已停用');
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
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.field-label {
  font-weight: 500;
}
.title-cell {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
</style>
