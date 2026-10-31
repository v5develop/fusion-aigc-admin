<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">官方模板</h2>
      <span class="muted">画布模板库；官方模板可新建 / 编辑 / 启停，用户模板仅查看</span>
    </div>

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="query.scope"
          :options="scopeOptions"
          style="width: 130px"
          @change="onFilter"
        />
        <a-select
          v-model:value="query.enabled"
          :options="enabledOptions"
          style="width: 120px"
          @change="onFilter"
        />
        <a-input-search
          v-model:value="query.q"
          placeholder="标题关键词"
          allow-clear
          style="width: 220px"
          @search="onFilter"
        />
        <a-button @click="load">刷新</a-button>
        <a-button v-if="canUpdate" type="primary" @click="openEdit()">新建官方模板</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">
              <a-image
                v-if="record.cover_url"
                :src="record.cover_url"
                :width="40"
                :height="40"
                class="cover"
              />
              <div>
                <div>{{ record.title }}</div>
                <div class="muted">
                  {{ record.scope === 'official' ? '官方' : `用户 ${record.user_id}` }}
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'count'">
            {{ record.node_count }} / {{ record.edge_count }}
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-switch
              :checked="record.enabled"
              :disabled="!canUpdate"
              :loading="togglingId === record.id"
              @change="(v: boolean) => onToggle(record, v)"
            />
          </template>
          <template v-else-if="column.dataIndex === 'updated_at'">{{
            formatTime(record.updated_at)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="canUpdate && record.scope === 'official'"
              type="link"
              size="small"
              @click="openEdit(record)"
              >编辑</a-button
            >
          </template>
        </template>
      </a-table>
      <div class="pager">
        <a-pagination
          v-model:current="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="load"
          @show-size-change="onSize"
        />
      </div>
    </a-card>

    <a-drawer
      v-model:open="drawerOpen"
      :title="form.id ? '编辑官方模板' : '新建官方模板'"
      :width="640"
      destroy-on-close
    >
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" :maxlength="100" show-count />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="form.description" :rows="2" :maxlength="500" show-count />
        </a-form-item>
        <a-form-item label="封面 URL">
          <a-input v-model:value="form.cover_url" placeholder="https://..." />
        </a-form-item>
        <a-form-item label="排序（越小越靠前）">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 160px" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
        <a-form-item
          label="snapshot（JSON：{ nodes, edges }）"
          required
          :validate-status="snapshotInfo.ok || !form.snapshot.trim() ? undefined : 'error'"
          :help="snapshotInfo.ok || !form.snapshot.trim() ? undefined : snapshotInfo.error"
        >
          <a-radio-group
            v-model:value="snapshotMode"
            button-style="solid"
            size="small"
            style="margin-bottom: 8px"
          >
            <a-radio-button value="visual">可视化</a-radio-button>
            <a-radio-button value="json">JSON</a-radio-button>
          </a-radio-group>
          <template v-if="snapshotMode === 'visual'">
            <a-button size="small" style="margin-bottom: 8px" @click="fullscreenOpen = true">
              满屏编辑
            </a-button>
            <SnapshotVisualEditor v-model="form.snapshot" />
          </template>
          <a-textarea
            v-else
            v-model:value="form.snapshot"
            :rows="14"
            spellcheck="false"
            class="mono"
            placeholder='{"nodes": [], "edges": []}'
          />
          <div v-if="snapshotInfo.ok" class="ok preview">
            JSON 有效：{{ snapshotInfo.nodes }} 个节点，{{ snapshotInfo.edges }}
            条边（连线规则由服务端校验）
          </div>
        </a-form-item>
      </a-form>
      <a-drawer
        v-model:open="fullscreenOpen"
        title="可视化编辑（满屏）"
        placement="right"
        width="100%"
        :body-style="{ padding: '12px' }"
      >
        <SnapshotVisualEditor v-model="form.snapshot" height="calc(100vh - 140px)" />
      </a-drawer>
      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref } from 'vue';

import {
  createTemplate,
  listTemplates,
  toggleTemplate,
  updateTemplate,
  type CanvasTemplate,
} from '@/api/canvas-admin';
import { inspectSnapshot } from '@/utils/canvas';
import { CANVAS_UPDATE, hasCanvasPermission } from '@/utils/canvas-permission';
import { parseSnapshot, stripRuntime, validateSnapshot } from '@/utils/canvas-snapshot';
import { formatTime } from '@/utils/format';

import SnapshotVisualEditor from './SnapshotVisualEditor.vue';

const canUpdate = computed(() => hasCanvasPermission(CANVAS_UPDATE));

const scopeOptions = [
  { label: '全部来源', value: '' },
  { label: '官方', value: 'official' },
  { label: '用户', value: 'user' },
];
const enabledOptions = [
  { label: '全部状态', value: -1 },
  { label: '已启用', value: 1 },
  { label: '已停用', value: 0 },
];

const query = ref({
  scope: '' as '' | 'official' | 'user',
  enabled: -1,
  q: '',
  page: 1,
  pageSize: 20,
});
const rows = ref<CanvasTemplate[]>([]);
const total = ref(0);
const loading = ref(false);
const togglingId = ref(0);

const columns = [
  { title: '标题', dataIndex: 'title', width: 260 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '节点 / 边', dataIndex: 'count', width: 100 },
  { title: '排序', dataIndex: 'sort', width: 80, align: 'right' as const },
  { title: '启用', dataIndex: 'enabled', width: 80 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' as const },
];

function onFilter() {
  query.value.page = 1;
  load();
}

function onSize(_c: number, size: number) {
  query.value.pageSize = size;
  query.value.page = 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    const q = query.value;
    const result = await listTemplates({
      scope: q.scope,
      enabled: q.enabled,
      q: q.q.trim() || undefined,
      page: q.page,
      page_size: q.pageSize,
    });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

async function onToggle(record: CanvasTemplate, enabled: boolean) {
  togglingId.value = record.id;
  try {
    await toggleTemplate(record.id, enabled);
    record.enabled = enabled;
    message.success(enabled ? '已启用' : '已停用');
  } catch {
    /* 已由 API 层提示 */
  } finally {
    togglingId.value = 0;
  }
}

// ---------------- 新建 / 编辑 ----------------

const drawerOpen = ref(false);
const saving = ref(false);
const form = reactive({
  id: 0,
  title: '',
  description: '',
  cover_url: '',
  sort: 0,
  enabled: true,
  snapshot: '',
});

const snapshotInfo = computed(() => inspectSnapshot(form.snapshot));
/** 快照编辑方式：可视化（Vue Flow）与 JSON 文本互相切换，数据都是 form.snapshot */
const snapshotMode = ref<'visual' | 'json'>('visual');
/** 可视化编辑的满屏右抽屉 */
const fullscreenOpen = ref(false);

function openEdit(record?: CanvasTemplate) {
  Object.assign(form, {
    id: record?.id ?? 0,
    title: record?.title ?? '',
    description: record?.description ?? '',
    cover_url: record?.cover_url ?? '',
    sort: record?.sort ?? 0,
    enabled: record?.enabled ?? true,
    snapshot: prettySnapshot(record?.snapshot ?? ''),
  });
  drawerOpen.value = true;
}

function prettySnapshot(text: string): string {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

async function save() {
  if (!form.title.trim()) return message.warning('请填写标题');
  if (!snapshotInfo.value.ok) return message.warning(snapshotInfo.value.error || 'snapshot 无效');
  const parsed = parseSnapshot(form.snapshot);
  if (!parsed.ok) return message.warning(parsed.error);
  // 校验与提交的是同一份数据：先剥离运行态字段，大小按压缩后的提交内容计算
  const payload = stripRuntime(parsed.snapshot);
  const errors = validateSnapshot(payload);
  if (errors.length) return message.warning(`画布校验未通过：${errors.slice(0, 3).join('；')}`);
  saving.value = true;
  try {
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      cover_url: form.cover_url.trim(),
      sort: form.sort ?? 0,
      enabled: form.enabled,
      // 剥离模型 / 工具节点的运行态字段，压缩成单行再提交
      snapshot: JSON.stringify(payload),
    };
    if (form.id) await updateTemplate(form.id, body);
    else await createTemplate(body);
    message.success('已保存');
    drawerOpen.value = false;
    load();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    saving.value = false;
  }
}

load();
</script>

<style scoped>
.page-container {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.ph-title {
  margin: 0;
  font-size: 18px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cover {
  object-fit: cover;
  border-radius: 4px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.preview {
  margin-top: 6px;
}
.ok {
  color: var(--ant-color-success, #52c41a);
}
</style>
