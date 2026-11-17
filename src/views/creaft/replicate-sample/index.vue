<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ t('replicateSample.title') }}</h2>
      <a-tag v-if="isReplicateMock()" color="orange">{{ t('replicateSample.mockTag') }}</a-tag>
    </div>

    <a-card variant="borderless">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="samples" tab="示例" />
        <a-tab-pane key="shares" tab="用户投稿" />
      </a-tabs>
      <SharePanel v-if="activeTab === 'shares'" @open-sample="openDetail" />
      <template v-else>
        <div class="filter-bar">
          <a-select
            v-if="industryOptions.length"
            v-model:value="filters.industry"
            allow-clear
            show-search
            option-filter-prop="label"
            :placeholder="t('replicateSample.industryAll')"
            style="width: 200px"
            :options="industryOptions"
            @change="reloadFirst"
          />
          <a-input
            v-else
            v-model:value="filters.industry"
            allow-clear
            :placeholder="t('replicateSample.industryCodeFilter')"
            style="width: 200px"
            @press-enter="reloadFirst"
          />
          <a-select
            v-model:value="filters.enabled"
            allow-clear
            :placeholder="t('replicateSample.enabledAll')"
            style="width: 140px"
            :options="enabledOptions"
            @change="reloadFirst"
          />
          <a-button type="primary" @click="reloadFirst">{{ t('replicateSample.query') }}</a-button>
          <a-button @click="reset">{{ t('replicateSample.reset') }}</a-button>
          <a-button v-permission="'replicate:sample'" type="primary" ghost @click="openForm(null)">
            {{ t('replicateSample.create') }}
          </a-button>
          <span v-if="polling" class="muted">{{ t('replicateSample.polling') }}</span>
        </div>

        <a-table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="false"
          row-key="id"
          size="middle"
          :scroll="{ x: 1400 }"
        >
          <template #emptyText>
            <a-empty :description="t('replicateSample.empty')" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'title'">
              <a @click="openDetail(record.id)">{{ record.title }}</a>
              <div class="muted">#{{ record.id }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'industry'">
              <a-tooltip
                v-if="!industryKnown(record.industry)"
                :title="`行业编码：${record.industry}`"
              >
                <span class="muted">{{ industryLabel(record.industry) }}</span>
              </a-tooltip>
              <template v-else>{{ industryLabel(record.industry) }}</template>
            </template>
            <template v-else-if="column.key === 'media'">
              <div class="media-cell">
                <SampleThumb
                  v-for="m in MEDIA_SLOTS"
                  :key="m.field"
                  :label="m.label"
                  :configured="!!record[m.field]"
                  :url="previewOf(record[m.field])"
                />
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'enabled'">
              <a-switch
                v-if="canWrite"
                :checked="record.enabled"
                :loading="toggling === record.id"
                size="small"
                @change="toggleEnabled(record)"
              />
              <a-tag v-else :color="record.enabled ? 'green' : 'default'">
                {{
                  record.enabled ? t('replicateSample.enabledOn') : t('replicateSample.enabledOff')
                }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'analysisStatus'">
              <a-tooltip :title="analysisTip(record)">
                <a-tag :color="analysisColor(record.analysisStatus)">
                  {{ record.analysisStatusLabel || record.analysisStatus }}
                </a-tag>
              </a-tooltip>
              <div
                v-if="isSampleAnalyzing(record.analysisStatus) && record.analysisStage"
                class="muted"
              >
                {{ t('replicateSample.stage', { stage: record.analysisStage }) }}
              </div>
              <div v-else-if="record.analysisError" class="bad small">
                {{
                  record.analysisStatus === 'ready'
                    ? t('replicateSample.lastRoundFailed')
                    : record.analysisError
                }}
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'userVisible'">
              <a-tooltip :title="record.userVisible ? '' : t('replicateSample.visibleNoHint')">
                <a-tag :color="record.userVisible ? 'green' : 'default'">
                  {{
                    record.userVisible
                      ? t('replicateSample.visibleYes')
                      : t('replicateSample.visibleNo')
                  }}
                </a-tag>
              </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex === 'updatedAt'">
              {{ fmtTime(record.updatedAt) }}
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-button size="small" type="link" @click="openDetail(record.id)">
                {{ t('replicateSample.detail') }}
              </a-button>
              <template v-if="canWrite">
                <a-button size="small" type="link" @click="openForm(record)">
                  {{ t('replicateSample.edit') }}
                </a-button>
                <a-button
                  size="small"
                  type="link"
                  :disabled="isSampleAnalyzing(record.analysisStatus)"
                  :loading="analyzing === record.id"
                  @click="triggerAnalyze(record)"
                >
                  {{ t('replicateSample.analyze') }}
                </a-button>
                <a-popconfirm
                  :title="t('replicateSample.deleteConfirm', { title: record.title })"
                  @confirm="remove(record)"
                >
                  <a-button size="small" type="link" danger>
                    {{ t('replicateSample.delete') }}
                  </a-button>
                </a-popconfirm>
              </template>
            </template>
          </template>
        </a-table>

        <div class="pager">
          <span class="muted">{{ t('replicateSample.total', { n: total }) }}</span>
          <a-pagination
            v-model:current="page"
            v-model:page-size="size"
            :total="total"
            show-size-changer
            :page-size-options="['20', '50', '100']"
            @change="() => load()"
          />
        </div>
      </template>
    </a-card>

    <SampleFormModal
      v-model:open="formOpen"
      :sample="editing"
      :industry-options="industryOptions"
      @saved="() => load()"
    />
    <SampleDetailDrawer
      v-model:open="detailOpen"
      :sample-id="detailId"
      :industry-label="industryLabel"
    />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { useI18n } from 'vue-i18n';

import { getIndustries, type IndustryNode } from '@/api/plaza-admin';
import {
  ReplicateError,
  SAMPLE_ANALYZING,
  analyzeSample,
  deleteSample,
  getSamples,
  isReplicateMock,
  isSampleAnalyzing,
  updateSample,
  type SampleAdminRow,
} from '@/api/replicate-admin';
import { useAuthStore } from '@/stores/auth';

import { fmtTime } from '../replicate-job/job-meta';
import { analysisColor } from './sample-meta';
import SampleDetailDrawer from './SampleDetailDrawer.vue';
import SampleFormModal from './SampleFormModal.vue';
import SampleThumb from './SampleThumb.vue';
import SharePanel from './SharePanel.vue';

defineOptions({ name: 'ReplicateSamples' });

const POLL_MS = 5000;

const { t } = useI18n();
/** 顶部页签：示例管理 / 用户投稿审核 */
const activeTab = ref<'samples' | 'shares'>('samples');
const authStore = useAuthStore();
const hasPerm = (p: string) => {
  const perms = authStore.user?.permissions ?? [];
  return perms.includes('*') || perms.includes(p);
};
const canWrite = computed(() => hasPerm('replicate:sample'));

const columns = computed(() => [
  { title: t('replicateSample.colTitle'), dataIndex: 'title', width: 220 },
  { title: t('replicateSample.colIndustry'), dataIndex: 'industry', width: 130 },
  { title: '素材', key: 'media', width: 250 },
  { title: t('replicateSample.colSort'), dataIndex: 'sortOrder', width: 70 },
  { title: t('replicateSample.colEnabled'), dataIndex: 'enabled', width: 80 },
  { title: t('replicateSample.colAnalysis'), dataIndex: 'analysisStatus', width: 160 },
  { title: t('replicateSample.colUserVisible'), dataIndex: 'userVisible', width: 100 },
  { title: t('replicateSample.colUpdatedAt'), dataIndex: 'updatedAt', width: 170 },
  { title: t('replicateSample.colActions'), key: 'operation', width: 240, fixed: 'right' as const },
]);
const enabledOptions = computed(() => [
  { label: t('replicateSample.enabledOn'), value: '1' },
  { label: t('replicateSample.enabledOff'), value: '0' },
]);

// ---------------------------------------------------------------- 行业（只读复用模板行业目录；没权限就退回文本输入）

const industries = ref<{ label: string; value: string }[]>([]);
const industryNames = computed(() => new Map(industries.value.map((x) => [x.value, x.label])));
const industryOptions = computed(() => industries.value);
/** 行业编码是给机器的：查到名称显示名称；行业树已加载却查不到 = 未登记（编码只放悬停提示）；没权限加载行业树时无从解析，仍显示编码 */
const industryKnown = (code: string) =>
  !code || industryNames.value.has(code) || industryNames.value.size === 0;
const industryLabel = (code: string) => {
  if (!code) return t('replicateSample.industryGeneric');
  const name = industryNames.value.get(code);
  if (name) return name;
  return industryNames.value.size ? '未登记的行业' : code;
};

async function loadIndustries() {
  if (!hasPerm('creaft_catalog:view')) return;
  try {
    const tree = await getIndustries();
    const out: { label: string; value: string }[] = [];
    const walk = (nodes: IndustryNode[], prefix: string) => {
      for (const n of nodes ?? []) {
        const name = prefix ? `${prefix} / ${n.name}` : n.name;
        out.push({ label: `${name}（${n.code}）`, value: n.code });
        walk(n.children, name);
      }
    };
    walk(tree ?? [], '');
    industries.value = out;
  } catch {
    /* 拿不到行业目录：退回文本输入 */
  }
}

// ---------------------------------------------------------------- 列表 + 轮询

const filters = reactive({
  industry: undefined as string | undefined,
  enabled: undefined as '0' | '1' | undefined,
});
const page = ref(1);
const size = ref(20);
const rows = ref<SampleAdminRow[]>([]);
/** 本页素材的预览地址（后端整页批量签，短时效） */
const previews = ref<Record<string, string>>({});
const MEDIA_SLOTS = [
  { field: 'sourceRid', label: '原视频' },
  { field: 'coverRid', label: '封面' },
  { field: 'resultRid', label: '成片' },
] as const;
const previewOf = (rid: string | undefined): string | undefined =>
  rid ? previews.value[rid.trim().replace(/^mr:\/\//, '')] : undefined;
const total = ref(0);
const loading = ref(false);

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let active = true;
const polling = computed(() => rows.value.some((r) => isSampleAnalyzing(r.analysisStatus)));

function stopPoll() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}
function schedulePoll() {
  stopPoll();
  if (active && polling.value) timer = setTimeout(() => load(true), POLL_MS);
}

/** quiet = 轮询刷新，不转圈 */
async function load(quiet = false) {
  const s = ++seq;
  if (!quiet) loading.value = true;
  try {
    const res = await getSamples({
      industry: filters.industry?.trim() || undefined,
      enabled: filters.enabled,
      page: page.value,
      size: size.value,
    });
    if (s !== seq) return;
    rows.value = res?.items ?? [];
    previews.value = res?.previews ?? {};
    total.value = res?.total ?? 0;
    schedulePoll();
  } catch {
    /* 已提示；轮询中断，下次手动查询恢复 */
  } finally {
    if (s === seq) loading.value = false;
  }
}
function reloadFirst() {
  page.value = 1;
  load();
}
function reset() {
  filters.industry = undefined;
  filters.enabled = undefined;
  reloadFirst();
}

const replaceRow = (row: SampleAdminRow) => {
  const i = rows.value.findIndex((r) => r.id === row.id);
  if (i >= 0) rows.value.splice(i, 1, row);
  schedulePoll();
};

// ---------------------------------------------------------------- 操作

const toggling = ref(0);
async function toggleEnabled(r: SampleAdminRow) {
  toggling.value = r.id;
  try {
    // PUT 是整体覆盖：原样带回其余字段，sourceRid 不变不会清分析
    const row = await updateSample(r.id, {
      title: r.title,
      industry: r.industry,
      sourceRid: r.sourceRid,
      coverRid: r.coverRid,
      resultRid: r.resultRid,
      annotations: r.annotations,
      sortOrder: r.sortOrder,
      enabled: !r.enabled,
    });
    replaceRow(row);
    message.success(t('replicateSample.saved'));
  } catch {
    /* 已提示 */
  } finally {
    toggling.value = 0;
  }
}

const analyzing = ref(0);
async function triggerAnalyze(r: SampleAdminRow) {
  analyzing.value = r.id;
  try {
    replaceRow(await analyzeSample(r.id));
    message.success(t('replicateSample.analyzeStarted'));
  } catch (e) {
    if (e instanceof ReplicateError && e.reason === SAMPLE_ANALYZING) {
      message.warning(t('replicateSample.analyzeBusy'));
      load(true);
    } else if (e instanceof ReplicateError) {
      message.error(e.message || t('replicateSample.opFailed'));
    }
  } finally {
    analyzing.value = 0;
  }
}

async function remove(r: SampleAdminRow) {
  try {
    await deleteSample(r.id);
    message.success(t('replicateSample.deleted'));
    if (rows.value.length === 1 && page.value > 1) page.value -= 1;
    load();
  } catch {
    /* 已提示 */
  }
}

function analysisTip(r: SampleAdminRow): string {
  const parts: string[] = [t('replicateSample.round', { n: r.round })];
  if (r.analysisStage) parts.push(t('replicateSample.stage', { stage: r.analysisStage }));
  if (r.analysisError) parts.push(t('replicateSample.lastError', { err: r.analysisError }));
  if (r.analyzedAt) parts.push(t('replicateSample.analyzedAtTip', { at: fmtTime(r.analyzedAt) }));
  return parts.join(' · ');
}

const formOpen = ref(false);
const editing = ref<SampleAdminRow | null>(null);
function openForm(r: SampleAdminRow | null) {
  editing.value = r;
  formOpen.value = true;
}

const detailOpen = ref(false);
const detailId = ref(0);
function openDetail(id: number) {
  detailId.value = id;
  detailOpen.value = true;
}

onMounted(() => {
  loadIndustries();
  load();
});
onActivated(() => {
  if (active) return;
  active = true;
  load(true);
});
onDeactivated(() => {
  active = false;
  stopPoll();
});
onBeforeUnmount(() => {
  active = false;
  stopPoll();
});
</script>

<style scoped>
.media-cell {
  display: flex;
  gap: 10px;
}
.code {
  font-size: 12px;
  word-break: break-all;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.small {
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
