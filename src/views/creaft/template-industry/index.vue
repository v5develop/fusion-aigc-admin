<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">行业管理</h2>
      <a-space>
        <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
        <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="startCreate(null)">
          新建一级行业
        </a-button>
      </a-space>
    </div>

    <IndustrySwitchBar />

    <a-alert
      v-if="unassigned > 0"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`${unassigned} 个启用模板未分配行业，用户端暂不可见`"
    >
      <template #action>
        <a-button size="small" type="link" @click="goUnassigned">去分配</a-button>
      </template>
    </a-alert>

    <a-alert
      v-if="fromSuggestion"
      type="info"
      show-icon
      closable
      style="margin-bottom: 12px"
      :message="`正在根据用户建议「${fromSuggestion.text}」新建行业，保存后会把该建议标记为已采纳`"
    />

    <div class="split">
      <a-card variant="borderless" class="left" :loading="loading">
        <template #title>
          <span>行业列表</span>
          <span class="muted title-sub"
            >共 {{ roots.length }} 个一级行业 · {{ flat.length - roots.length }} 个二级</span
          >
        </template>
        <template #extra>
          <a-radio-group v-if="canEdit" v-model:value="view" size="small" button-style="solid">
            <a-radio-button value="list">列表</a-radio-button>
            <a-radio-button value="sort">调整顺序</a-radio-button>
          </a-radio-group>
        </template>

        <!-- 列表：每一项一列，表头说明含义；点行在右侧编辑 -->
        <template v-if="view === 'list'">
          <a-table
            v-if="tableRows.length"
            :columns="columns"
            :data-source="tableRows"
            :pagination="false"
            row-key="id"
            size="middle"
            default-expand-all-rows
            :row-class-name="rowClass"
            :custom-row="(r: TableRow) => ({ onClick: () => selectRow(r.id) })"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="name-cell">
                  <span class="name" :class="{ off: !record.enabled }">{{ record.name }}</span>
                  <span class="muted code">{{ record.code }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.enabled ? 'green' : 'default'">{{
                  record.enabled ? '启用' : '停用'
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'visible'">
                <a-tooltip v-if="!record.userVisible" :title="invisibleReason(record)">
                  <a-tag color="orange">不可见</a-tag>
                </a-tooltip>
                <a-tag v-else color="blue">可见</a-tag>
              </template>
              <template v-else-if="column.key === 'templates'">
                <div class="num-cell">
                  <span
                    >图 {{ record.templateCount.image }} · 视频
                    {{ record.templateCount.video }}</span
                  >
                  <span class="muted">已发布 {{ record.templateCount.published }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'users'">{{ record.userCount }}</template>
              <template v-else-if="column.key === 'replicate'">{{ record.replicate7d }}</template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="4" @click.stop>
                  <a-button size="small" type="link" @click="selectRow(record.id)">编辑</a-button>
                  <a-button
                    v-if="!record.parentId"
                    v-permission="'creaft_catalog:edit'"
                    size="small"
                    type="link"
                    @click="startCreate(record)"
                  >
                    新建二级
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-else-if="!loading" description="还没有行业" />
        </template>

        <!-- 调整顺序：只显示名称，拖动排序；拖到一级上变成它的二级 -->
        <template v-else>
          <a-alert
            type="info"
            show-icon
            style="margin-bottom: 12px"
            message="拖动调整顺序；拖到某个一级行业上，会变成它的二级。有子级的一级行业不能降为二级。"
          />
          <a-tree
            v-if="treeData.length"
            block-node
            :draggable="canEdit ? { icon: false } : false"
            :tree-data="treeData"
            :expanded-keys="expandedKeys"
            :selectable="false"
            :allow-drop="allowDrop"
            @update:expanded-keys="(k: (string | number)[]) => (expandedKeys = k.map(Number))"
            @drop="onDrop"
          />
        </template>
      </a-card>

      <a-card
        variant="borderless"
        class="right"
        :title="mode === 'create' ? createTitle : current ? `编辑：${current.name}` : '行业详情'"
      >
        <a-empty v-if="mode === 'edit' && !current" description="从左侧选择一个行业" />
        <a-form v-else :model="form" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
          <a-form-item label="名称" required>
            <a-input v-model:value="form.name" :maxlength="32" show-count />
          </a-form-item>
          <a-form-item
            label="code"
            required
            :extra="
              mode === 'edit'
                ? '创建后不可修改'
                : '小写字母开头，仅含小写字母、数字、下划线，2~64 位；不能是 ALL'
            "
          >
            <a-input v-model:value="form.code" :disabled="mode === 'edit'" :maxlength="64" />
          </a-form-item>
          <a-form-item v-if="mode === 'create'" label="上级">
            <a-select
              v-model:value="form.parentId"
              allow-clear
              placeholder="不选 = 一级行业"
              :options="parentOptions"
            />
          </a-form-item>
          <a-form-item
            label="副文"
            :required="form.enabled"
            extra="行业门按钮下的副标题，如「按摩 / 泡脚门店」；启用的行业必填"
          >
            <a-input v-model:value="form.hint" :maxlength="120" show-count />
          </a-form-item>
          <a-form-item label="人群称呼" extra="如「足浴人」，用于「足浴人都在做」">
            <a-input v-model:value="form.audienceName" :maxlength="32" />
          </a-form-item>
          <a-form-item label="图标 URL">
            <a-input v-model:value="form.iconUrl" placeholder="可空" />
          </a-form-item>
          <a-form-item label="输入示例" extra="最多 5 条，每条 ≤40 字">
            <a-select
              v-model:value="form.examples"
              mode="tags"
              :max-tag-count="5"
              :token-separators="['\n']"
            />
          </a-form-item>
          <a-form-item label="下一步建议" extra="最多 4 条，每条 ≤20 字">
            <a-select
              v-model:value="form.nextActions"
              mode="tags"
              :max-tag-count="4"
              :token-separators="['\n']"
            />
          </a-form-item>
          <a-form-item label="启用">
            <a-switch v-model:checked="form.enabled" />
          </a-form-item>
          <a-form-item
            label="无模板时仍展示"
            extra="关闭时，没有用户可见模板的行业不会出现在行业门里"
          >
            <a-switch v-model:checked="form.showWhenEmpty" />
          </a-form-item>
          <a-form-item v-if="mode === 'edit' && current" label="统计">
            <span class="muted">
              模板 {{ current.templateCount.total }}（已发布
              {{ current.templateCount.published }}）· 偏好用户 {{ current.userCount }} · 近 7
              天复刻 {{ current.replicate7d }}
            </span>
          </a-form-item>
          <a-form-item :wrapper-col="{ offset: 5, span: 17 }">
            <a-space>
              <a-button
                v-permission="'creaft_catalog:edit'"
                type="primary"
                :loading="saving"
                @click="submit"
              >
                {{ mode === 'create' ? '创建' : '保存' }}
              </a-button>
              <a-button v-if="mode === 'create'" @click="cancelCreate">取消</a-button>
              <template v-if="mode === 'edit' && current">
                <a-button
                  v-permission="'creaft_catalog:edit'"
                  @click="startCreate(current)"
                  v-if="!current.parentId"
                >
                  新建二级
                </a-button>
                <a-button v-permission="'creaft_catalog:edit'" danger @click="askDelete"
                  >删除</a-button
                >
              </template>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>
    </div>

    <a-modal
      v-model:open="deleteOpen"
      title="删除行业"
      ok-text="迁移并删除"
      :ok-button-props="{ danger: true, disabled: !reassignTo }"
      :confirm-loading="deleting"
      @ok="doDelete(reassignTo)"
    >
      <p>
        「{{ current?.name }}」下还有 {{ current?.templateCount.total ?? 0 }} 个模板、
        {{ current?.children?.length ?? 0 }} 个子级、{{ current?.userCount ?? 0 }} 位偏好用户。
        请选择迁移到的行业，关系行（含排序）与用户偏好会在同一事务里迁走，然后删除。
      </p>
      <a-select
        v-model:value="reassignTo"
        style="width: 100%"
        placeholder="迁移到…"
        :options="reassignOptions"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  PlazaError,
  adoptIndustrySuggestion,
  createIndustry,
  deleteIndustry,
  getIndustries,
  getPlazaTemplates,
  isPlazaMock,
  sortIndustries,
  updateIndustry,
  type IndustryNode,
  type IndustrySaveData,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

import IndustrySwitchBar from './IndustrySwitchBar.vue';
import { computeMove, type DropPosition } from './tree-move';

const router = useRouter();
const route = useRoute();
const { can } = usePermission();
const canEdit = computed(() => can('creaft_catalog:edit'));

const loading = ref(false);
const roots = ref<IndustryNode[]>([]);
const expandedKeys = ref<number[]>([]);
const selectedId = ref<number | null>(null);
const mode = ref<'edit' | 'create'>('edit');
const unassigned = ref(0);
const fromSuggestion = ref<{ normText: string; text: string } | null>(null);

const flat = computed(() => roots.value.flatMap((r) => [r, ...(r.children ?? [])]));
const current = computed(() => flat.value.find((x) => x.id === selectedId.value) ?? null);

interface TreeNodeData {
  key: number;
  title: string;
  node: IndustryNode;
  children?: TreeNodeData[];
}
const sortTitle = (n: IndustryNode) => (n.enabled ? n.name : `${n.name}（停用）`);

/** 列表视图 */
const view = ref<'list' | 'sort'>('list');
type TableRow = Omit<IndustryNode, 'children'> & { children?: TableRow[] };
const tableRows = computed<TableRow[]>(() =>
  roots.value.map((r) => ({
    ...r,
    // 没有子级时不给 children，表格就不会画展开箭头
    children: r.children?.length
      ? r.children.map((c) => ({ ...c, children: undefined }))
      : undefined,
  })),
);
const columns = [
  { title: '行业', key: 'name', width: 220 },
  { title: '状态', key: 'status', width: 80 },
  { title: '用户端', key: 'visible', width: 90 },
  { title: '模板', key: 'templates', width: 150 },
  { title: '偏好用户', key: 'users', width: 90, align: 'right' as const },
  { title: '近 7 天做同款', key: 'replicate', width: 110, align: 'right' as const },
  { title: '操作', key: 'action', width: 140 },
];
function invisibleReason(n: IndustryNode): string {
  if (!n.enabled) return '行业已停用';
  if (n.templateCount.published === 0 && !n.showWhenEmpty)
    return '没有已发布模板，且未开启「无模板时仍展示」';
  return '上级行业停用或不可见';
}
function rowClass(r: TableRow): string {
  return mode.value === 'edit' && r.id === selectedId.value ? 'row-selected' : '';
}
function selectRow(id: number) {
  onSelect([id]);
}

const treeData = computed<TreeNodeData[]>(() =>
  roots.value.map((r) => ({
    key: r.id,
    title: sortTitle(r),
    node: r,
    children: (r.children ?? []).map((c) => ({ key: c.id, title: sortTitle(c), node: c })),
  })),
);

async function load(keepSelection = true) {
  loading.value = true;
  try {
    roots.value = (await getIndustries()) ?? [];
    if (!expandedKeys.value.length) expandedKeys.value = roots.value.map((r) => r.id);
    if (!keepSelection || !current.value) selectedId.value = roots.value[0]?.id ?? null;
    if (mode.value === 'edit') fillForm();
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

async function loadUnassigned() {
  try {
    // 全库未分配行业（未删除）的模板数，列表接口顺带返回
    const res = await getPlazaTemplates({ unassigned: true, page: 1, size: 1 });
    unassigned.value = res?.unassignedCount ?? 0;
  } catch {
    /* 已提示 */
  }
}

// ---- 表单 ----
const form = reactive({
  name: '',
  code: '',
  parentId: undefined as number | undefined,
  hint: '',
  audienceName: '',
  iconUrl: '',
  examples: [] as string[],
  nextActions: [] as string[],
  enabled: true,
  showWhenEmpty: false,
});

function fillForm() {
  const x = current.value;
  if (!x) return;
  Object.assign(form, {
    name: x.name,
    code: x.code,
    parentId: x.parentId ?? undefined,
    hint: x.hint ?? '',
    audienceName: x.audienceName ?? '',
    iconUrl: x.iconUrl ?? '',
    examples: [...(x.examples ?? [])],
    nextActions: [...(x.nextActions ?? [])],
    enabled: x.enabled,
    showWhenEmpty: x.showWhenEmpty,
  });
}

function onSelect(keys: (string | number)[]) {
  const id = Number(keys[0]);
  if (!id) return;
  mode.value = 'edit';
  selectedId.value = id;
  fillForm();
}

const createTitle = computed(() => (form.parentId ? '新建二级行业' : '新建一级行业'));
const parentOptions = computed(() => roots.value.map((r) => ({ label: r.name, value: r.id })));

function startCreate(parent: IndustryNode | null, preset?: { name?: string }) {
  mode.value = 'create';
  Object.assign(form, {
    name: preset?.name ?? '',
    code: '',
    parentId: parent?.id,
    hint: '',
    audienceName: '',
    iconUrl: '',
    examples: [],
    nextActions: [],
    // 新行业默认不启用：补够模板与副文后再开，避免用户端出现空行业
    enabled: false,
    showWhenEmpty: false,
  });
}
function cancelCreate() {
  mode.value = 'edit';
  fillForm();
  fromSuggestion.value = null;
}

function validate(): string | null {
  const strLen = (s: string) => Array.from(s).length;
  if (!form.name.trim()) return '名称必填';
  if (mode.value === 'create' && !/^[a-z][a-z0-9_]{1,63}$/.test(form.code))
    return 'code 格式不对：小写字母开头，仅含小写字母、数字、下划线，2~64 位';
  if (mode.value === 'create' && form.code === 'ALL') return 'ALL 是保留字';
  if (form.name.trim().length > 32) return '名称最多 32 个字';
  if (form.audienceName.trim().length > 32) return '人群称呼最多 32 个字';
  if (Array.from(form.hint.trim()).length > 120) return '副文最多 120 个字';
  if (form.enabled && !form.hint.trim()) return '启用的行业必须填写副文（行业门按钮下的副标题）';
  if (form.examples.length > 5 || form.examples.some((e) => strLen(e) > 40))
    return '输入示例最多 5 条，每条不超过 40 字';
  if (form.nextActions.length > 4 || form.nextActions.some((e) => strLen(e) > 20))
    return '下一步建议最多 4 条，每条不超过 20 字';
  return null;
}

function payload(): IndustrySaveData {
  return {
    name: form.name.trim(),
    hint: form.hint.trim() || null,
    audienceName: form.audienceName.trim() || null,
    iconUrl: form.iconUrl.trim() || null,
    examples: form.examples,
    nextActions: form.nextActions,
    enabled: form.enabled,
    showWhenEmpty: form.showWhenEmpty,
  };
}

const saving = ref(false);

async function submit() {
  const err = validate();
  if (err) {
    message.warning(err);
    return;
  }
  if (mode.value === 'create') return doCreate();
  const x = current.value;
  if (!x) return;
  // 停用 / 改 showWhenEmpty 前二次确认，展示受影响面
  const disabling = x.enabled && !form.enabled;
  const flip = x.showWhenEmpty !== form.showWhenEmpty;
  if (disabling || flip) {
    const affected = x.templateCount.total;
    Modal.confirm({
      title: disabling ? `停用「${x.name}」？` : `修改「${x.name}」的「无模板时仍展示」？`,
      content: `${disabling && !x.parentId ? '停用一级行业会让其整棵子树对用户不可见。' : ''}受影响模板 ${affected} 个，偏好该行业的用户 ${x.userCount} 位。`,
      okText: '确认保存',
      onOk: () => doUpdate(x.id),
    });
    return;
  }
  await doUpdate(x.id);
}

async function doUpdate(id: number) {
  saving.value = true;
  try {
    await updateIndustry(id, payload());
    message.success('已保存');
    await load();
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

async function doCreate() {
  saving.value = true;
  try {
    // 新建只返回 { id }，节点要靠重拉树
    const created = await createIndustry({
      ...payload(),
      code: form.code,
      parentId: form.parentId ?? null,
    });
    const newId = created?.id;
    if (fromSuggestion.value && newId) {
      try {
        await adoptIndustrySuggestion(fromSuggestion.value.normText, newId);
      } catch {
        message.warning('行业已创建，但建议状态回写失败，请到「行业建议」页手动标记');
      }
      fromSuggestion.value = null;
    }
    message.success('已创建');
    mode.value = 'edit';
    selectedId.value = newId ?? null;
    const parentId = form.parentId;
    await load();
    if (parentId) expandedKeys.value = Array.from(new Set([...expandedKeys.value, parentId]));
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}

// ---- 拖拽排序 ----
function allowDrop(info: { dropNode: { key: string | number }; dropPosition: number }): boolean {
  // 只做粗过滤（二级下不可再挂子级）；其余规则在 onDrop 里给出明确原因
  const target = flat.value.find((x) => x.id === Number(info.dropNode.key));
  return !(target?.parentId && info.dropPosition === 0);
}

async function onDrop(info: {
  node: { key: string | number };
  dragNode: { key: string | number };
  dropPosition: number;
  dropToGap?: boolean;
}) {
  const targetId = Number(info.node.key);
  const dragId = Number(info.dragNode.key);
  let position: DropPosition = 'into';
  if (info.dropToGap) {
    const target = flat.value.find((x) => x.id === targetId);
    const siblings = target?.parentId
      ? (roots.value.find((r) => r.id === target.parentId)?.children ?? [])
      : roots.value;
    const idx = siblings.findIndex((s) => s.id === targetId);
    position = info.dropPosition - idx < 0 ? 'above' : 'below';
  }
  const res = computeMove(roots.value, dragId, targetId, position);
  if (res.error) {
    message.warning(res.error);
    return;
  }
  if (!res.items?.length) return;
  const snapshot = roots.value;
  try {
    // 乐观不改本地：成功后整树重拉，失败自然保持原样（等同回滚）
    await sortIndustries(res.items);
    message.success('顺序已调整');
    if (position === 'into')
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, targetId]));
  } catch {
    roots.value = snapshot;
  }
  await load();
}

// ---- 删除 ----
const deleteOpen = ref(false);
const deleting = ref(false);
const reassignTo = ref<number | undefined>();

const reassignOptions = computed(() => {
  const x = current.value;
  if (!x) return [];
  const banned = new Set([x.id, ...(x.children ?? []).map((c) => c.id)]);
  return (
    flat.value
      .filter((c) => !banned.has(c.id))
      // 同级别或父级：一级迁到其他一级；二级迁到同级二级或其父级
      .filter((c) => (x.parentId ? c.parentId === x.parentId || c.id === x.parentId : !c.parentId))
      .map((c) => ({ label: `${c.parentId ? '　' : ''}${c.name}`, value: c.id }))
  );
});

function askDelete() {
  const x = current.value;
  if (!x) return;
  reassignTo.value = undefined;
  if (x.templateCount.total > 0 || (x.children?.length ?? 0) > 0) {
    deleteOpen.value = true;
    return;
  }
  Modal.confirm({
    title: `删除「${x.name}」？`,
    content: '该行业没有模板和子级，删除会写入审计记录。',
    okText: '删除',
    okType: 'danger',
    onOk: () => doDelete(undefined),
  });
}

async function doDelete(reassign: number | undefined) {
  const x = current.value;
  if (!x) return;
  deleting.value = true;
  try {
    await deleteIndustry(x.id, reassign, { silent: true });
    message.success('已删除');
    deleteOpen.value = false;
    selectedId.value = null;
    await load(false);
  } catch (e) {
    if (e instanceof PlazaError && e.reason === 'INDUSTRY_HAS_TEMPLATES') {
      // 页面数据已过期：服务端说还有模板，改走迁移弹窗
      deleteOpen.value = true;
    } else {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  } finally {
    deleting.value = false;
  }
}

function goUnassigned() {
  router.push({ path: '/creaft/plaza-template-manage', query: { unassigned: '1' } });
}

onMounted(async () => {
  await load(false);
  loadUnassigned();
  // 从「行业建议」一键新建带进来
  const name = route.query.create;
  if (typeof name === 'string' && name) {
    const normText = typeof route.query.suggestion === 'string' ? route.query.suggestion : '';
    if (normText) fromSuggestion.value = { normText, text: name };
    startCreate(null, { name });
  }
});
</script>

<style scoped>
.title-sub {
  margin-left: 8px;
  font-weight: 400;
}
.name-cell,
.num-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}
.name {
  font-weight: 500;
}
.name.off {
  opacity: 0.55;
}
.code {
  font-size: 12px;
}
:deep(.row-selected) > td {
  background: var(--ant-color-primary-bg, rgba(22, 119, 255, 0.12)) !important;
}
:deep(.ant-table-tbody > tr) {
  cursor: pointer;
}
.split {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.left {
  flex: 1 1 62%;
  min-width: 0;
}
.right {
  flex: 1 1 38%;
  min-width: 0;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
@media (max-width: 1100px) {
  .split {
    flex-direction: column;
  }
  .left,
  .right {
    width: 100%;
  }
}
</style>
