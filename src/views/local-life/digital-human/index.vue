<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">AI 数字人</h2>
      <span v-if="ttsModel" class="muted"
        >配音模型：{{ ttsModel.name }}（{{ ttsModel.code }}）</span
      >
    </div>

    <a-card variant="borderless">
      <a-tabs v-model:active-key="tab">
        <a-tab-pane key="options" tab="选项">
          <OptionManager
            :types="optionTypes"
            :api="{
              list: listDhOptions,
              create: createDhOption,
              update: updateDhOption,
              remove: deleteDhOption,
            }"
          />
        </a-tab-pane>

        <a-tab-pane key="voices" tab="系统音色">
          <div class="filter-bar">
            <a-button v-if="canEdit" type="primary" @click="openCreate">新增音色</a-button>
          </div>

          <a-table
            :columns="visibleVoiceColumns"
            :data-source="voices"
            :loading="voiceLoading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'categories'">
                <a-tag v-for="c in record.categories" :key="c">{{ c }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'previewUrl'">
                <audio
                  v-if="record.previewUrl"
                  :src="record.previewUrl"
                  controls
                  preload="none"
                  style="height: 32px"
                />
                <span v-else class="muted">未生成试听</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'green' : 'default'">{{
                  record.status === 1 ? '启用' : '停用'
                }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'operation' && canEdit">
                <a-space>
                  <a-button
                    type="link"
                    size="small"
                    :loading="previewingId === record.id"
                    @click="preview(record)"
                    >生成试听</a-button
                  >
                  <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-popconfirm title="确认删除该音色？" @confirm="removeVoice(record)">
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>

          <a-modal
            v-model:open="voiceModal"
            :title="voiceEditId ? '编辑音色' : '新增音色'"
            :confirm-loading="voiceSaving"
            @ok="saveVoice"
          >
            <a-form :model="voiceForm" layout="vertical">
              <a-form-item label="名称"><a-input v-model:value="voiceForm.name" /></a-form-item>
              <a-form-item label="音色标识（供应商 voice）"
                ><a-input v-model:value="voiceForm.voice"
              /></a-form-item>
              <a-form-item label="性别">
                <a-radio-group v-model:value="voiceForm.gender">
                  <a-radio value="female">女</a-radio>
                  <a-radio value="male">男</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-form-item label="风格"><a-input v-model:value="voiceForm.style" /></a-form-item>
              <a-form-item label="分类">
                <a-select
                  v-model:value="voiceForm.categories"
                  mode="tags"
                  :options="voiceCategoryOptions"
                />
              </a-form-item>
              <a-form-item label="排序（越小越靠前）">
                <a-input-number v-model:value="voiceForm.sortOrder" :min="0" style="width: 100%" />
              </a-form-item>
              <a-form-item label="状态">
                <a-switch
                  :checked="voiceForm.status === 1"
                  @change="(v: boolean) => (voiceForm.status = v ? 1 : 0)"
                />
              </a-form-item>
            </a-form>
          </a-modal>
        </a-tab-pane>

        <a-tab-pane key="list" tab="用户数字人">
          <div class="filter-bar">
            <a-input-number
              v-model:value="userId"
              placeholder="用户 ID"
              :min="1"
              style="width: 160px"
              @change="onFilterChange"
            />
            <a-select
              v-model:value="status"
              :options="statusOptions"
              style="width: 140px"
              @change="onFilterChange"
            />
          </div>

          <a-table
            :columns="listColumns"
            :data-source="rows"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'videoUrl'">
                <video
                  v-if="record.videoUrl"
                  :src="record.videoUrl"
                  controls
                  preload="metadata"
                  style="height: 96px"
                />
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.dataIndex === 'imageUrl'">
                <img
                  v-if="record.imageUrl"
                  :src="record.imageUrl"
                  alt=""
                  style="height: 64px; border-radius: 4px"
                />
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.dataIndex === 'script'">
                <div class="clamp-2">{{ record.script }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'createTime'">{{
                formatTime(record.createTime)
              }}</template>
            </template>
          </a-table>

          <div class="pager">
            <a-pagination
              v-model:current="page"
              v-model:page-size="pageSize"
              :total="total"
              show-size-changer
              :page-size-options="['20', '50', '100']"
              @change="load"
              @show-size-change="onSizeChange"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  createDhOption,
  createVoice,
  deleteDhOption,
  deleteVoice,
  type DigitalHumanItem,
  generateVoicePreview,
  getDhTtsModel,
  listDhOptions,
  listDigitalHumans,
  listVoices,
  type ModelInfo,
  updateDhOption,
  updateVoice,
  type Voice,
  type VoiceForm,
} from '@/api/local-life-admin';
import { formatTime } from '@/utils/format';
import { hasLocalLifePermission, LOCAL_LIFE_UPDATE } from '@/utils/local-life-permission';
import OptionManager from '@/views/local-life/components/OptionManager.vue';

const optionTypes = [
  { label: '年龄', value: 'AGE' },
  { label: '肤色', value: 'SKIN_TONE' },
  { label: '职业', value: 'ROLE' },
  { label: '音色分类', value: 'VOICE_CATEGORY' },
  { label: '提示词', value: 'PROMPT' },
];

const canEdit = computed(() => hasLocalLifePermission(LOCAL_LIFE_UPDATE));
const tab = ref('options');
const ttsModel = ref<ModelInfo | null>(null);

// ---------------- 音色 ----------------
const voices = ref<Voice[]>([]);
const voiceLoading = ref(false);
// 音色分类取自「音色分类」选项（运营在本页第一个 tab 维护），不写死
const voiceCategoryOptions = ref<{ label: string; value: string }[]>([]);
const voiceModal = ref(false);
const voiceSaving = ref(false);
const voiceEditId = ref<number | null>(null);
const previewingId = ref<number | null>(null);
const voiceForm = reactive<VoiceForm>({
  name: '',
  voice: '',
  gender: 'female',
  style: '',
  categories: [],
  sortOrder: 0,
  status: 1,
});

const voiceColumns = [
  { title: '名称', dataIndex: 'name', width: 140 },
  { title: '音色标识', dataIndex: 'voice', width: 160 },
  { title: '性别', dataIndex: 'gender', width: 80, align: 'center' as const },
  { title: '风格', dataIndex: 'style', width: 120 },
  { title: '分类', dataIndex: 'categories' },
  { title: '试听', dataIndex: 'previewUrl', width: 260 },
  { title: '排序', dataIndex: 'sortOrder', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', width: 230, align: 'center' as const },
];
const visibleVoiceColumns = computed(() =>
  voiceColumns.filter((c) => canEdit.value || c.dataIndex !== 'operation'),
);

async function loadVoices() {
  voiceLoading.value = true;
  try {
    const result = await listVoices();
    voices.value = result?.list || [];
  } catch {
    /* 已由 API 层提示 */
  } finally {
    voiceLoading.value = false;
  }
}

function openCreate() {
  voiceEditId.value = null;
  Object.assign(voiceForm, {
    name: '',
    voice: '',
    gender: 'female',
    style: '',
    categories: [],
    sortOrder: 0,
    status: 1,
  });
  voiceModal.value = true;
}

function openEdit(record: Voice) {
  voiceEditId.value = record.id;
  Object.assign(voiceForm, {
    name: record.name,
    voice: record.voice,
    gender: record.gender === 'male' ? 'male' : 'female',
    style: record.style,
    categories: [...(record.categories || [])],
    sortOrder: record.sortOrder,
    status: record.status,
  });
  voiceModal.value = true;
}

async function saveVoice() {
  if (!voiceForm.name.trim() || !voiceForm.voice.trim()) {
    message.warning('名称和音色标识不能为空');
    return;
  }
  voiceSaving.value = true;
  try {
    const payload: VoiceForm = {
      ...voiceForm,
      name: voiceForm.name.trim(),
      voice: voiceForm.voice.trim(),
    };
    if (voiceEditId.value) await updateVoice(voiceEditId.value, payload);
    else await createVoice(payload);
    message.success('已保存');
    voiceModal.value = false;
    loadVoices();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    voiceSaving.value = false;
  }
}

async function removeVoice(record: Voice) {
  try {
    await deleteVoice(record.id);
    message.success('已删除');
    loadVoices();
  } catch {
    /* 已由 API 层提示 */
  }
}

async function preview(record: Voice) {
  previewingId.value = record.id;
  try {
    await generateVoicePreview(record.id);
    message.success('试听已生成');
    loadVoices();
  } catch {
    /* 已由 API 层提示 */
  } finally {
    previewingId.value = null;
  }
}

// ---------------- 用户数字人 ----------------
const rows = ref<DigitalHumanItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const userId = ref<number | null>(null);
const status = ref(-1);
const statusOptions = [
  { label: '全部状态', value: -1 },
  { label: '待生成', value: 0 },
  { label: '生成中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '失败', value: 3 },
];

const listColumns = [
  { title: '用户', dataIndex: 'userId', width: 90 },
  { title: '名称', dataIndex: 'name', width: 140 },
  { title: '形象', dataIndex: 'imageUrl', width: 110 },
  { title: '音色', dataIndex: 'voiceName', width: 120 },
  { title: '口播文案', dataIndex: 'script' },
  { title: '视频', dataIndex: 'videoUrl', width: 220 },
  { title: '时长(秒)', dataIndex: 'duration', width: 90, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '失败原因', dataIndex: 'failReason', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'createTime', width: 170 },
];

function onFilterChange() {
  page.value = 1;
  load();
}

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    const result = await listDigitalHumans({
      userId: userId.value ?? undefined,
      status: status.value,
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = result?.list || [];
    total.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    ttsModel.value = await getDhTtsModel();
  } catch {
    /* 仅展示 */
  }
  try {
    const cats = await listDhOptions('VOICE_CATEGORY');
    voiceCategoryOptions.value = (cats?.list || []).map((o) => ({ label: o.label, value: o.code }));
  } catch {
    /* 下拉缺失不影响浏览，分类可手输 */
  }
  loadVoices();
  load();
});
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
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
</style>
