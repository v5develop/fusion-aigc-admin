<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 音色</h2>
      <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate"
        >新增音色</a-button
      >
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="被 GET /api/v1/voices/list 读：只下发启用的行，按权重降序。端侧提交视频翻译时把「模型」「音色键」原样作为 voice_model / voice_key 带上。「模型」是供应商语音模型名（如 qwen3-tts-flash），系统据此映射到 AI 网关的 TTS 模型组；只能从下拉选。音色键不回查，填错只会在调用时被供应商拒。"
    />

    <a-alert
      v-if="facets && !facets.anyEnabled"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="一个启用的音色都没有：端侧的视频翻译选不了音色。"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="按名称或音色键过滤"
          allow-clear
          style="width: 220px"
          @press-enter="onFilterChange"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="statusFilter"
          :options="statusFilterOptions"
          style="width: 140px"
          @change="onFilterChange"
        />
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty description="暂无音色" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'voiceName'">
            <div class="title-cell">{{ record.voiceName }}</div>
            <code class="route-code">{{ record.voiceKey }}</code>
            <span class="muted" style="margin-left: 6px">#{{ record.id }}</span>
          </template>

          <template v-if="column.dataIndex === 'tags'">
            <a-space v-if="record.tags?.length" :size="4" wrap>
              <a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag>
            </a-space>
            <span v-else class="muted">—</span>
          </template>

          <template v-if="column.dataIndex === 'demo'">
            <a-space v-if="demoEntries(record).length" :size="4" wrap>
              <a-button
                v-for="[locale, url] in demoEntries(record)"
                :key="locale"
                size="small"
                :type="playing === url ? 'primary' : 'default'"
                @click="togglePlay(url)"
              >
                {{ locale }}
              </a-button>
            </a-space>
            <span v-else class="muted">无试听</span>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button
                v-permission="'creaft_catalog:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >
                编辑
              </a-button>
              <a-popconfirm
                v-permission="'creaft_catalog:edit'"
                title="删除后该音色立刻从端侧列表消失。只想临时下架请改成「停用」。确认删除？"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
      <div class="pager">
        <a-pagination
          v-model:current="page"
          v-model:page-size="pageSize"
          :total="total"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="loadList"
          @show-size-change="onSizeChange"
        />
      </div>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? '编辑音色' : '新增音色'"
      :confirm-loading="saving"
      destroy-on-hidden
      width="860px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 4 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="名称" required>
          <a-input v-model:value="form.voiceName" placeholder="展示给用户，如 芊悦" />
        </a-form-item>
        <a-form-item label="音色键" required>
          <a-input v-model:value="form.voiceKey" placeholder="供应商的音色键，如 Cherry" />
          <div class="muted">端侧提交时原样作为 voice_key，必须是供应商实际可用的音色。</div>
        </a-form-item>
        <a-form-item label="模型" required>
          <a-select
            v-model:value="form.model"
            :options="modelOptions"
            :loading="groupsLoading"
            show-search
            option-filter-prop="label"
            placeholder="选择供应商语音模型，如 qwen3-tts-flash"
          />
          <div class="muted">
            这里填的是供应商语音模型名，不是网关模型组代码：视频翻译据此映射到网关的 TTS 模型组，
            填成 tts.xxx
            会在提交时被拒。括号里是映射到的模型组；标「网关未提供」的说明网关里现在没有这个组。
          </div>
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="form.tags"
            :options="tagOptions"
            mode="tags"
            allow-clear
            placeholder="回车添加"
          />
          <div class="muted">端侧按标签筛选时要求全部命中；单个标签里不能有英文逗号。</div>
        </a-form-item>
        <a-form-item label="权重 / 启用">
          <a-space>
            <a-input-number v-model:value="form.weight" :min="0" />
            <span class="muted">降序：大的靠前</span>
            <a-switch v-model:checked="enabled" />
          </a-space>
        </a-form-item>
      </a-form>

      <div class="upload-toggle">
        <a-checkbox v-model:checked="uploadEnabled">使用上传</a-checkbox>
        <span class="muted"
          >默认填地址（与 v1 一致：素材先放到
          OSS，再把地址填进来）；勾选后每个地址旁出现上传按钮，文件进系统公有桶。</span
        >
      </div>
      <a-tabs v-model:active-key="metaTab" @change="onMetaTabChange">
        <a-tab-pane key="visual" tab="试听（可视化）">
          <div class="muted" style="margin-bottom: 8px">
            每种语言一条试听音频，端侧在选音色时播放。「支持的语言」默认与试听语言一致，可以多于试听。
          </div>
          <div v-for="(demo, index) in meta.demos" :key="demo.uid" class="demo-row">
            <a-auto-complete
              v-model:value="demo.locale"
              :options="localeOptions"
              placeholder="语言，如 zh-CN"
              style="width: 140px"
            />
            <a-input v-model:value="demo.url" placeholder="试听音频地址 https://…" />
            <CatalogMediaUpload
              v-if="uploadEnabled"
              :accept="AUDIO_ACCEPT"
              @uploaded="(url) => (demo.url = url)"
            />
            <a-button size="small" :disabled="!demo.url" @click="togglePlay(demo.url)">
              {{ playing === demo.url ? '停止' : '试听' }}
            </a-button>
            <a-button type="text" danger size="small" @click="meta.demos.splice(index, 1)"
              >移除</a-button
            >
          </div>
          <a-button type="dashed" size="small" @click="meta.demos.push(demoRow())"
            >+ 添加试听</a-button
          >

          <div class="section-title" style="margin-top: 16px">支持的语言</div>
          <a-space align="start">
            <a-select
              v-model:value="meta.locales"
              :options="localeOptions"
              mode="tags"
              style="width: 560px"
              placeholder="回车添加"
            />
            <a-button size="small" @click="syncLocales">与试听语言一致</a-button>
          </a-space>
        </a-tab-pane>

        <a-tab-pane key="json" tab="原文 JSON">
          <a-textarea v-model:value="rawMeta" :rows="14" class="json-area" />
          <div class="muted">
            下发为 meta。必须是 JSON
            对象；可视化没有覆盖的字段在这里改，两边切换时互相同步，表单不认识的字段原样保留。
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { listModelGroupOptions, type ModelGroupOption } from '@/api/ai-gateway';
import {
  createCreaftVoice,
  deleteCreaftVoice,
  getCreaftVoiceFacets,
  getCreaftVoices,
  updateCreaftVoice,
  type CreaftVoiceFacets,
  type CreaftVoiceRow,
} from '@/api/creaft-compat';

import CatalogMediaUpload from '../components/CatalogMediaUpload.vue';
import { demoRow, fromMeta, toMeta, validateMeta, type MetaModel } from './voice-meta-model';

/** 上传默认隐藏：v1 的素材都是填地址，上传只在需要时打开 */
const uploadEnabled = ref(false);

const AUDIO_ACCEPT = 'audio/wav,audio/x-wav,audio/mpeg,.wav,.mp3';
const LOCALES = [
  'zh-CN',
  'en-US',
  'en-GB',
  'ja-JP',
  'ko-KR',
  'de-DE',
  'es-ES',
  'fr-FR',
  'it-IT',
  'pt-PT',
];
const localeOptions = LOCALES.map((l) => ({ label: l, value: l }));

const columns = [
  { title: '音色', dataIndex: 'voiceName', width: 220 },
  { title: '模型', dataIndex: 'model', width: 150 },
  { title: '标签', dataIndex: 'tags', width: 220 },
  { title: '试听', dataIndex: 'demo' },
  { title: '权重', dataIndex: 'weight', width: 70, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 80, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 130, align: 'center' as const },
];
const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

const rows = ref<CreaftVoiceRow[]>([]);
/** 不带筛选的全量：「一个启用的都没有」要看全部，不能看当前筛选后的结果 */
/** 模型、标签、启用概况取自 facets 接口（全量），不能从当前页推导 */
const facets = ref<CreaftVoiceFacets | null>(null);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

/** 筛选、搜索变化回到第一页；翻页与改每页条数直接重载 */
function onFilterChange() {
  page.value = 1;
  loadList();
}

function onSizeChange(_current: number, size: number) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}
const keyword = ref('');
const statusFilter = ref<'' | 1 | 0>('');

/** TTS 模型组来自网关；存量行里网关已不存在的值也列出来，编辑时不至于显示成空 */
const ttsGroups = ref<ModelGroupOption[]>([]);
const groupsLoading = ref(false);
async function loadTtsGroups() {
  groupsLoading.value = true;
  try {
    ttsGroups.value = await listModelGroupOptions();
  } catch {
    message.warning('网关模型组加载失败，无法确认映射的模型组是否可用');
  } finally {
    groupsLoading.value = false;
  }
}
loadTtsGroups();

/**
 * 下拉选的是供应商语音模型名（音色表 model 的合法值，与视频翻译的映射表一致），括号里给出映射到的网关组，
 * 并标出网关里是否还有这个组。存量里不受支持的值单独列出来，编辑时可见但标明不能再用。
 */
const modelOptions = computed(() => {
  // 网关列表还没取到（或取失败）时不下结论，只显示映射组，不标「网关未提供」
  const groupCodes = new Set(ttsGroups.value.map((g) => g.code));
  const checked = groupCodes.size > 0;
  const supported = (facets.value?.supportedModels || []).map(({ model, group }) => ({
    label:
      checked && !groupCodes.has(group)
        ? `${model}（${group}，网关未提供）`
        : `${model}（${group}）`,
    value: model,
    disabled: false,
  }));
  const supportedValues = new Set(supported.map((o) => o.value));
  const stale = (facets.value?.models || [])
    .filter((m) => !supportedValues.has(m))
    .map((m) => ({ label: `${m}（不受支持，请改选）`, value: m, disabled: true }));
  return [...supported, ...stale];
});
const tagOptions = computed(() => (facets.value?.tags || []).map((t) => ({ label: t, value: t })));

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(onFilterChange, 300);
}

async function loadList() {
  loading.value = true;
  try {
    const [result, facetData] = await Promise.all([
      getCreaftVoices({
        keyword: keyword.value.trim() || undefined,
        status: statusFilter.value === '' ? undefined : statusFilter.value,
        page: page.value,
        pageSize: pageSize.value,
      }),
      getCreaftVoiceFacets(),
    ]);
    rows.value = result?.list || [];
    total.value = result?.total || 0;
    // 删掉末页最后一条后，回退到前一页，避免停在空页上
    if (!rows.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
      return loadList();
    }
    facets.value = facetData || null;
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

loadList();

function parseObject(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function demoEntries(record: CreaftVoiceRow): [string, string][] {
  const demo = parseObject(record.metaJson).demo;
  if (!demo || typeof demo !== 'object' || Array.isArray(demo)) return [];
  return Object.entries(demo as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
}

// ---- 试听：全页只放一个，点另一个先停上一个 ----
const playing = ref('');
let audio: HTMLAudioElement | null = null;
function togglePlay(url: string) {
  if (audio) audio.pause();
  if (playing.value === url) {
    playing.value = '';
    return;
  }
  audio = new Audio(url);
  audio.onended = () => (playing.value = '');
  audio.play().then(
    () => (playing.value = url),
    () => message.warning('这条试听地址播放不了'),
  );
}
onBeforeUnmount(() => audio?.pause());

// ---- meta 的可视化模型：见 voiceMetaModel.ts（纯函数，已用 10 条真实音色验证原样往返） ----

// ---- 新增 / 编辑 ----
const modalVisible = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
const metaTab = ref<'visual' | 'json'>('visual');
const rawMeta = ref('{}');
const meta = reactive<MetaModel>(toMeta({}));

const form = reactive({
  voiceName: '',
  voiceKey: '',
  model: '',
  tags: [] as string[],
  weight: 10,
  status: 1,
});

const enabled = computed({
  get: () => form.status === 1,
  set: (value: boolean) => (form.status = value ? 1 : 0),
});

function loadMeta(value: Record<string, unknown>) {
  Object.assign(meta, toMeta(value));
  rawMeta.value = JSON.stringify(value, null, 2);
}

function syncLocales() {
  meta.locales = meta.demos.map((d) => d.locale.trim()).filter(Boolean);
}

function onMetaTabChange(key: string | number) {
  if (key === 'json') {
    rawMeta.value = JSON.stringify(fromMeta(meta), null, 2);
    return;
  }
  try {
    const parsed = JSON.parse(rawMeta.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('not object');
    Object.assign(meta, toMeta(parsed));
  } catch {
    message.warning('原文不是合法的 JSON 对象，先改好再切回可视化');
    metaTab.value = 'json';
  }
}

function openCreate() {
  editId.value = null;
  Object.assign(form, {
    voiceName: '',
    voiceKey: '',
    model: modelOptions.value.find((o) => !o.disabled)?.value || '',
    tags: [],
    weight: 10,
    status: 1,
  });
  loadMeta({ demo: {}, locales: [] });
  metaTab.value = 'visual';
  modalVisible.value = true;
}

function openEdit(record: CreaftVoiceRow) {
  editId.value = record.id;
  Object.assign(form, {
    voiceName: record.voiceName,
    voiceKey: record.voiceKey,
    model: record.model,
    tags: [...(record.tags || [])],
    weight: record.weight ?? 0,
    status: record.status ?? 1,
  });
  loadMeta(parseObject(record.metaJson));
  metaTab.value = 'visual';
  modalVisible.value = true;
}

function currentMeta(): string | null {
  if (metaTab.value === 'visual') {
    const problem = validateMeta(meta);
    if (problem) {
      message.warning(problem);
      return null;
    }
    return JSON.stringify(fromMeta(meta));
  }
  try {
    const parsed = JSON.parse(rawMeta.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      message.warning('扩展信息必须是 JSON 对象');
      return null;
    }
    return JSON.stringify(parsed);
  } catch {
    message.warning('扩展信息不是合法 JSON');
    return null;
  }
}

async function handleSubmit() {
  if (!form.voiceName.trim() || !form.voiceKey.trim() || !form.model.trim()) {
    message.warning('名称、音色键、模型都必填');
    return;
  }
  if (form.tags.some((t) => t.includes(','))) {
    message.warning('标签里不能有英文逗号');
    return;
  }
  const metaJson = currentMeta();
  if (metaJson == null) return;
  saving.value = true;
  try {
    const data = {
      voiceName: form.voiceName.trim(),
      voiceKey: form.voiceKey.trim(),
      model: form.model.trim(),
      metaJson,
      tags: form.tags,
      weight: form.weight ?? 0,
      status: form.status,
    };
    if (editId.value) await updateCreaftVoice(editId.value, data);
    else await createCreaftVoice(data);
    message.success('已保存');
    modalVisible.value = false;
    loadList();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function handleDelete(record: CreaftVoiceRow) {
  try {
    await deleteCreaftVoice(record.id);
    message.success('已删除');
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
  flex-wrap: wrap;
}
.title-cell {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.json-area {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.upload-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 8px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
