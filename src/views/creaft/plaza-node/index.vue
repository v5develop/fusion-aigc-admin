<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">营销节点管理</h2>
      <a-space>
        <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
        <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate">
          新建节点
        </a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="节点是智能体首页的「节点内容推荐」条（年货节、七夕、换季……）：在「节点日期 - 提前展示天数」到「节点当天」之间展示；同一行业下没有可见模板的节点不会出现。只做内容推荐，推荐语里不要写优惠 / 折扣 / 赠送。"
    />

    <a-card variant="borderless">
      <div class="bar">
        <a-input-search
          v-model:value="query.keyword"
          allow-clear
          placeholder="搜索名称 / code"
          style="width: 240px"
          @search="reload"
        />
        <a-select
          v-model:value="query.enabled"
          allow-clear
          placeholder="启用状态"
          style="width: 120px"
          :options="enabledOptions"
          @change="reload"
        />
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
        @change="onTableChange"
      >
        <template #emptyText>
          <a-empty description="还没有营销节点" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'name'">
            <div class="nm">{{ record.name }}</div>
            <code class="muted">{{ record.code }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'range'">
            {{ record.showFrom }} ~ {{ record.eventDate }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusMeta[record.status as MarketingNodeStatus].color">
              {{ statusMeta[record.status as MarketingNodeStatus].text }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'templateCount'">
            <a-button type="link" size="small" @click="openTemplates(record)">
              {{ record.templateCount }} 个
            </a-button>
          </template>
          <template v-else-if="column.dataIndex === 'why'">
            <span v-if="record.why">{{ record.why }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-switch
              :checked="record.enabled"
              :loading="toggling[record.id]"
              :disabled="!canEdit"
              checked-children="启用"
              un-checked-children="停用"
              @change="(v: boolean | string | number) => toggle(record, Boolean(v))"
            />
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-space size="small">
              <a-button size="small" type="link" @click="openTemplates(record)">
                关联模板
              </a-button>
              <a-button
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="link"
                @click="openEdit(record)"
              >
                编辑
              </a-button>
              <a-button
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="link"
                danger
                @click="confirmDelete(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="formOpen"
      :title="editing ? `编辑节点：${editing.name}` : '新建节点'"
      :confirm-loading="saving"
      ok-text="保存"
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-form-item
          label="节点 code"
          required
          :extra="
            editing
              ? 'code 创建后不可修改'
              : '前端据此记「已关闭」，一个节点每年一行时带年份，如 qixi_2027；小写字母 / 数字开头，字母数字下划线，2~64 位'
          "
        >
          <a-input
            v-model:value="form.code"
            :disabled="!!editing"
            :maxlength="64"
            placeholder="如 nianhuo_2027"
          />
        </a-form-item>
        <a-form-item label="节点名称" required>
          <a-input v-model:value="form.name" :maxlength="40" show-count placeholder="如 年货节" />
        </a-form-item>
        <a-form-item label="一句推荐语" extra="可空；仅内容推荐，不含任何优惠 / 折扣 / 赠送">
          <a-input
            v-model:value="form.why"
            :maxlength="60"
            show-count
            placeholder="如 年货节海报和短视频，现在就能做"
          />
        </a-form-item>
        <a-form-item label="节点日期" required extra="节点当天；过了这天就不再展示">
          <a-date-picker
            v-model:value="form.eventDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item
          label="提前展示天数"
          required
          :extra="
            rangeHint
              ? `展示区间：${rangeHint}`
              : '节点前多少天起展示（含节点当天），0~365，默认 14'
          "
        >
          <a-input-number v-model:value="form.leadDays" :min="0" :max="365" style="width: 140px" />
        </a-form-item>
        <a-form-item label="排序（同日节点先后，小的在前）">
          <a-input-number v-model:value="form.sortOrder" :min="-9999" :max="9999" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
      </a-form>
    </a-modal>

    <NodeTemplatesDrawer
      v-model:open="tplOpen"
      :node="tplNode"
      :industries="industries"
      @changed="load"
    />
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  PlazaError,
  createMarketingNode,
  deleteMarketingNode,
  getIndustries,
  getMarketingNodes,
  isPlazaMock,
  setMarketingNodeEnabled,
  updateMarketingNode,
  type IndustryNode,
  type MarketingNode,
  type MarketingNodeSaveData,
  type MarketingNodeStatus,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

import NodeTemplatesDrawer from './NodeTemplatesDrawer.vue';

const { can } = usePermission();
const canEdit = computed(() => can('creaft_catalog:edit'));

const statusMeta: Record<MarketingNodeStatus, { text: string; color: string }> = {
  UPCOMING: { text: '未到展示期', color: 'default' },
  ACTIVE: { text: '展示中', color: 'green' },
  ENDED: { text: '已结束', color: 'red' },
};
const enabledOptions = [
  { value: '1', label: '已启用' },
  { value: '0', label: '已停用' },
];

const rows = ref<MarketingNode[]>([]);
const total = ref(0);
const loading = ref(false);
const toggling = reactive<Record<number, boolean>>({});
const query = reactive<{
  keyword: string;
  enabled: '1' | '0' | undefined;
  page: number;
  size: number;
}>({
  keyword: '',
  enabled: undefined,
  page: 1,
  size: 20,
});
const industries = ref<IndustryNode[]>([]);

const columns = [
  { title: '节点', dataIndex: 'name', width: 190 },
  { title: '展示区间', dataIndex: 'range', width: 210 },
  { title: '提前天数', dataIndex: 'leadDays', width: 90 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '关联模板', dataIndex: 'templateCount', width: 100 },
  { title: '推荐语', dataIndex: 'why' },
  { title: '排序', dataIndex: 'sortOrder', width: 70 },
  { title: '启用', dataIndex: 'enabled', width: 100 },
  { title: '操作', key: 'operation', width: 190, fixed: 'right' as const },
];

const pagination = computed(() => ({
  current: query.page,
  pageSize: query.size,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 个`,
}));

async function load() {
  loading.value = true;
  try {
    const r = await getMarketingNodes({
      keyword: query.keyword.trim() || undefined,
      enabled: query.enabled,
      page: query.page,
      size: query.size,
    });
    rows.value = r?.items ?? [];
    total.value = r?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

function reload() {
  query.page = 1;
  load();
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  query.page = p.current ?? 1;
  query.size = p.pageSize ?? 20;
  load();
}

// ---------------- 新建 / 编辑 ----------------
const formOpen = ref(false);
const saving = ref(false);
const editing = ref<MarketingNode | null>(null);
const blank = () => ({
  code: '',
  name: '',
  why: '',
  eventDate: undefined as string | undefined,
  leadDays: 14 as number | undefined,
  sortOrder: 10 as number | undefined,
  enabled: true,
});
const form = reactive(blank());

const rangeHint = computed(() => {
  if (!form.eventDate || form.leadDays === undefined || form.leadDays === null) return '';
  const d = new Date(`${form.eventDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() - form.leadDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ~ ${form.eventDate}`;
});

function openCreate() {
  editing.value = null;
  Object.assign(form, blank());
  formOpen.value = true;
}

function openEdit(r: MarketingNode) {
  editing.value = r;
  Object.assign(form, {
    code: r.code,
    name: r.name,
    why: r.why,
    eventDate: r.eventDate,
    leadDays: r.leadDays,
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  });
  formOpen.value = true;
}

const CODE_RE = /^[a-z0-9][a-z0-9_]{1,63}$/;

function payload(): MarketingNodeSaveData | null {
  const name = form.name.trim();
  if (!editing.value && !CODE_RE.test(form.code.trim())) {
    message.warning('code 只能是小写字母 / 数字开头的字母、数字、下划线，长度 2~64');
    return null;
  }
  if (!name) {
    message.warning('请填写节点名称');
    return null;
  }
  if (!form.eventDate) {
    message.warning('请选择节点日期');
    return null;
  }
  if (form.leadDays === undefined || form.leadDays === null) {
    message.warning('请填写提前展示天数');
    return null;
  }
  return {
    ...(editing.value ? {} : { code: form.code.trim() }),
    name,
    why: form.why.trim(),
    eventDate: form.eventDate,
    leadDays: form.leadDays,
    sortOrder: form.sortOrder ?? 0,
    enabled: form.enabled,
  };
}

async function submit() {
  const data = payload();
  if (!data) return;
  saving.value = true;
  try {
    if (editing.value) await updateMarketingNode(editing.value.id, data);
    else await createMarketingNode(data);
    message.success('已保存');
    formOpen.value = false;
    await load();
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggle(r: MarketingNode, v: boolean) {
  toggling[r.id] = true;
  try {
    await setMarketingNodeEnabled(r.id, v);
    message.success(v ? '已启用' : '已停用');
    await load();
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '操作失败');
  } finally {
    toggling[r.id] = false;
  }
}

function confirmDelete(r: MarketingNode) {
  Modal.confirm({
    title: `删除节点「${r.name}」？`,
    content: `会同时清掉它关联的 ${r.templateCount} 个模板，删除后不能恢复（code 会释放，可重新创建）。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteMarketingNode(r.id);
        message.success('已删除');
        if (rows.value.length === 1 && query.page > 1) query.page -= 1;
        await load();
      } catch (e) {
        if (e instanceof PlazaError) message.error(e.message || '删除失败');
      }
    },
  });
}

// ---------------- 关联模板 ----------------
const tplOpen = ref(false);
const tplNode = ref<MarketingNode | null>(null);
function openTemplates(r: MarketingNode) {
  tplNode.value = r;
  tplOpen.value = true;
}

onMounted(async () => {
  load();
  try {
    industries.value = (await getIndustries()) ?? [];
  } catch {
    /* 已提示 */
  }
});
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.nm {
  font-weight: 600;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
</style>
