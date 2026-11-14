<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">投放渠道字典</h2>
      <a-space>
        <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
        <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate">
          新建渠道
        </a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="模板的「投放渠道」按渠道 code 引用这里的字典；code 创建后不可修改。停用后新模板不能再选，已引用的模板保持原样；没有任何模板引用（含回收站里的）的渠道可以删除，删除后 code 不可复用。"
    />

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 960 }"
      >
        <template #emptyText>
          <a-empty description="还没有渠道" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'code'">
            <code>{{ record.code }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'mediaType'">
            <a-tag :color="record.mediaType === 'video' ? 'purple' : 'blue'">
              {{ record.mediaType === 'video' ? '视频' : '图片' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'size'">
            {{ record.width }} × {{ record.height }}（{{ record.ratio }}）
          </template>
          <template v-else-if="column.dataIndex === 'note'">
            <span v-if="record.note">{{ record.note }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.dataIndex === 'refs'">
            <a-tooltip v-if="record.templateCount" :title="refsTip(record)">
              <a-tag color="blue">{{ record.templateCount }} 个模板</a-tag>
            </a-tooltip>
            <span v-else class="muted">未引用</span>
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
            <a-button
              v-permission="'creaft_catalog:edit'"
              size="small"
              type="link"
              @click="openEdit(record)"
            >
              编辑
            </a-button>
            <a-tooltip :title="record.templateCount ? refsTip(record) : ''">
              <a-button
                v-permission="'creaft_catalog:edit'"
                size="small"
                type="link"
                danger
                :disabled="!!record.templateCount"
                :loading="deleting[record.id]"
                @click="remove(record)"
              >
                删除
              </a-button>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="formOpen"
      :title="editing ? `编辑渠道：${editing.name}` : '新建渠道'"
      :confirm-loading="saving"
      ok-text="保存"
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-form-item
          label="渠道 code"
          required
          :extra="
            editing ? 'code 创建后不可修改' : '小写字母开头的小写字母 / 数字 / 下划线，2~48 位'
          "
        >
          <a-input
            v-model:value="form.code"
            :disabled="!!editing"
            :maxlength="48"
            placeholder="如 douyin_feed"
          />
        </a-form-item>
        <a-form-item label="渠道名称" required>
          <a-input v-model:value="form.name" :maxlength="32" show-count />
        </a-form-item>
        <a-form-item label="媒体类型" required>
          <a-radio-group v-model:value="form.mediaType">
            <a-radio value="image">图片</a-radio>
            <a-radio value="video">视频</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="默认尺寸（像素）" required>
          <a-space>
            <a-input-number v-model:value="form.width" :min="1" :max="20000" placeholder="宽" />
            <span>×</span>
            <a-input-number v-model:value="form.height" :min="1" :max="20000" placeholder="高" />
            <a-input
              v-model:value="form.ratio"
              :maxlength="8"
              placeholder="比例 9:16"
              style="width: 110px"
            />
            <a-button type="link" size="small" @click="fillRatio">按宽高算比例</a-button>
          </a-space>
        </a-form-item>
        <a-form-item label="备注（≤120 字）">
          <a-input v-model:value="form.note" :maxlength="120" show-count />
        </a-form-item>
        <a-form-item label="排序（小的在前）">
          <a-input-number v-model:value="form.sortOrder" :min="-9999" :max="9999" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  PlazaError,
  createChannel,
  deleteChannel,
  getChannelDict,
  isPlazaMock,
  updateChannel,
  type ChannelDict,
  type ChannelSaveData,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

const { can } = usePermission();
const canEdit = computed(() => can('creaft_catalog:edit'));

const rows = ref<ChannelDict[]>([]);
const loading = ref(false);
const toggling = reactive<Record<number, boolean>>({});
const deleting = reactive<Record<number, boolean>>({});

const columns = [
  { title: 'code', dataIndex: 'code', width: 170 },
  { title: '名称', dataIndex: 'name', width: 150 },
  { title: '媒体类型', dataIndex: 'mediaType', width: 90 },
  { title: '默认宽高（比例）', dataIndex: 'size', width: 190 },
  { title: '备注', dataIndex: 'note' },
  { title: '被引用', dataIndex: 'refs', width: 100 },
  { title: '排序', dataIndex: 'sortOrder', width: 70 },
  { title: '状态', dataIndex: 'enabled', width: 100 },
  { title: '操作', key: 'operation', width: 130, fixed: 'right' as const },
];

async function load() {
  loading.value = true;
  try {
    rows.value = (await getChannelDict()) ?? [];
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

// ---------------- 新建 / 编辑 ----------------
const formOpen = ref(false);
const saving = ref(false);
const editing = ref<ChannelDict | null>(null);
const blank = () => ({
  code: '',
  name: '',
  mediaType: 'image' as 'image' | 'video',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  ratio: '',
  note: '',
  sortOrder: 0 as number | undefined,
  enabled: true,
});
const form = reactive(blank());

function openCreate() {
  editing.value = null;
  Object.assign(form, blank(), {
    sortOrder: (rows.value.reduce((m, r) => Math.max(m, r.sortOrder), 0) || 0) + 10,
  });
  formOpen.value = true;
}

function openEdit(r: ChannelDict) {
  editing.value = r;
  Object.assign(form, {
    code: r.code,
    name: r.name,
    mediaType: r.mediaType,
    width: r.width,
    height: r.height,
    ratio: r.ratio,
    note: r.note ?? '',
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  });
  formOpen.value = true;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function fillRatio() {
  const { width: w, height: h } = form;
  if (!w || !h) {
    message.warning('先填宽高');
    return;
  }
  const g = gcd(w, h);
  form.ratio = `${w / g}:${h / g}`;
}

const CODE_RE = /^[a-z][a-z0-9_]{1,47}$/;

function payload(): ChannelSaveData | null {
  const name = form.name.trim();
  if (!editing.value && !CODE_RE.test(form.code.trim())) {
    message.warning('code 只能是小写字母开头的小写字母 / 数字 / 下划线，长度 2~48');
    return null;
  }
  if (!name) {
    message.warning('请填写渠道名称');
    return null;
  }
  if (!form.width || !form.height) {
    message.warning('请填写默认宽高');
    return null;
  }
  const ratio = form.ratio.trim();
  if (!ratio) {
    message.warning('请填写比例（如 9:16），可点「按宽高算比例」');
    return null;
  }
  return {
    ...(editing.value ? {} : { code: form.code.trim() }),
    name,
    mediaType: form.mediaType,
    width: form.width,
    height: form.height,
    ratio,
    // Go：note 缺省 / null = 不改，空串 = 清空
    note: form.note.trim(),
    sortOrder: form.sortOrder ?? 0,
    enabled: form.enabled,
  };
}

async function submit() {
  const data = payload();
  if (!data) return;
  saving.value = true;
  try {
    if (editing.value) await updateChannel(editing.value.id, data);
    else await createChannel(data);
    message.success('已保存');
    formOpen.value = false;
    await load();
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

/** 启停：渠道没有单独的开关接口，整体 PUT 一次（字段原样带回） */
async function toggle(r: ChannelDict, v: boolean) {
  toggling[r.id] = true;
  try {
    await updateChannel(r.id, {
      name: r.name,
      mediaType: r.mediaType,
      width: r.width,
      height: r.height,
      ratio: r.ratio,
      note: r.note ?? undefined,
      sortOrder: r.sortOrder,
      enabled: v,
    });
    message.success(v ? '已启用' : '已停用');
    await load();
  } catch (e) {
    if (e instanceof PlazaError) message.error(e.message || '操作失败');
  } finally {
    toggling[r.id] = false;
  }
}

const refsTip = (r: ChannelDict) =>
  `被 ${r.templateCount ?? 0} 个模板引用${r.trashCount ? `（其中 ${r.trashCount} 个在回收站）` : ''}，先把这些模板改投其它渠道才能删除`;

/** 删除：逻辑删除，code 不可复用；被引用时后端拒绝并带引用数（按钮已提前置灰，这里兜底并发场景） */
function remove(r: ChannelDict) {
  Modal.confirm({
    title: `删除渠道「${r.name}」？`,
    content: `删除后列表里不再显示，code ${r.code} 不可再用于新建渠道。`,
    okText: '删除',
    okType: 'danger',
    async onOk() {
      deleting[r.id] = true;
      try {
        await deleteChannel(r.id);
        message.success('已删除');
        await load();
      } catch (e) {
        if (e instanceof PlazaError) message.error(e.message || '删除失败');
        await load();
      } finally {
        deleting[r.id] = false;
      }
    },
  });
}

onMounted(load);
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
</style>
