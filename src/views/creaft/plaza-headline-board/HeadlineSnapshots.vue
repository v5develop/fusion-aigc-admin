<template>
  <div>
    <a-card variant="borderless" style="margin-bottom: 12px">
      <div class="bar">
        <span class="muted">按时间查：该时刻生效的版本</span>
        <a-date-picker
          v-model:value="atTime"
          show-time
          allow-clear
          placeholder="选时间点"
          value-format="YYYY-MM-DDTHH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          :disabled-date="(d: Dayjs) => d.isAfter(dayjs(), 'day')"
          style="width: 220px"
        />
        <a-select
          v-model:value="atScope"
          :options="scopeOptions"
          show-search
          :filter-option="filterOption"
          style="width: 200px"
        />
        <a-button type="primary" :loading="finding" :disabled="!atTime" @click="findAt">
          查找并查看
        </a-button>
        <a-button @click="loadList">刷新列表</a-button>
      </div>
      <div class="muted" style="margin-top: 6px">
        历史版本只读；超过保留期的版本取不到。榜单页顶部的「版本」下拉也能切到某个历史版本。
      </div>
    </a-card>

    <a-card variant="borderless">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="{
          current: page,
          pageSize: SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t: number) => `共 ${t} 个版本`,
        }"
        row-key="version"
        size="middle"
        :scroll="{ x: 1000 }"
        @change="onTableChange"
      >
        <template #emptyText>
          <a-empty description="还没有版本，先在榜单页点「立即刷新」" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'version'">
            <b>v{{ record.version }}</b>
            <a-tag v-if="record.version === latestVersion" color="green" style="margin-left: 6px"
              >最新</a-tag
            >
          </template>
          <template v-else-if="column.dataIndex === 'computedAt'">
            {{ fmtTime(record.computedAt) }}
          </template>
          <template v-else-if="column.dataIndex === 'trigger'">
            {{ triggerLabel(record.trigger) }}
            <span v-if="record.operatorId" class="muted">· 管理员 #{{ record.operatorId }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'signalSource'">
            <a-tag :color="record.signalSource === 'REDIS' ? 'green' : 'orange'">
              {{ record.signalSource === 'REDIS' ? 'Redis' : 'DB 降级' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'paramsHash'">
            <code>{{ record.paramsHash.slice(0, 8) }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'durationMs'">
            {{ record.durationMs === null ? '—' : `${record.durationMs} ms` }}
          </template>
          <template v-else-if="column.key === 'operation'">
            <a-button size="small" type="link" @click="openVersion(record.version)">查看</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:open="drawerOpen" :title="drawerTitle" width="960" destroy-on-close>
      <div class="bar" style="margin-bottom: 12px">
        <span class="muted">范围</span>
        <a-select
          v-model:value="viewScope"
          :options="scopeOptions"
          show-search
          :filter-option="filterOption"
          style="width: 220px"
          @change="loadView"
        />
        <a-tag color="default">只读</a-tag>
        <a-button
          v-if="viewVersion"
          size="small"
          @click="emit('open-in-board', viewVersion, viewScope)"
        >
          在榜单页打开
        </a-button>
      </div>

      <a-alert v-if="gone" type="warning" show-icon message="该版本已超过保留期，取不到了" />
      <a-spin :spinning="viewLoading">
        <template v-if="view">
          <a-alert type="info" show-icon style="margin-bottom: 12px">
            <template #message>
              <a-space wrap>
                <span>版本 v{{ view.snapshot.version }}</span>
                <span>计算于 {{ fmtTime(view.snapshot.computedAt) }}</span>
                <span class="muted">触发：{{ triggerLabel(view.snapshot.trigger) }}</span>
                <span class="muted"
                  >统计窗口 {{ fmtTime(view.snapshot.windowStart) }} ~
                  {{ fmtTime(view.snapshot.windowEnd) }}</span
                >
                <span class="muted">参数 {{ view.snapshot.paramsHash.slice(0, 8) }}</span>
              </a-space>
            </template>
          </a-alert>
          <a-table
            :columns="itemColumns"
            :data-source="view.items"
            :pagination="false"
            row-key="plazaTemplateId"
            size="small"
            :scroll="{ x: 780 }"
          >
            <template #emptyText>
              <a-empty description="该版本这个范围没有榜单" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'rank'">
                <b>{{ String(record.rank).padStart(2, '0') }}</b>
              </template>
              <template v-else-if="column.dataIndex === 'title'">
                <div class="tpl">
                  <img
                    v-if="record.template.cover"
                    :src="record.template.cover"
                    class="thumb"
                    alt=""
                  />
                  <div>
                    <div class="t-title">
                      {{ record.template.exists ? record.template.title : '（模板已不在目录）' }}
                    </div>
                    <div class="muted">#{{ record.plazaTemplateId }}</div>
                  </div>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'source'">
                <a-tag :color="SOURCE_META[record.source as HeadlineSource].color">
                  {{ SOURCE_META[record.source as HeadlineSource].label }}
                </a-tag>
                <a-tag v-if="record.adopted" color="magenta">接管</a-tag>
                <a-tag v-if="record.suppressed" color="red">已抑制</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'score'">
                {{ record.score === null ? '—' : Math.round(record.score * 100) / 100 }}
              </template>
              <template v-else-if="column.dataIndex === 'rule'">
                <span v-if="record.rule">
                  {{ record.ruleStartDate }} ~ {{ record.ruleEndDate }}
                  <span v-if="record.rule.pinPosition" class="muted"
                    >· 定位 {{ record.rule.pinPosition }}</span
                  >
                </span>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
          <a-collapse ghost style="margin-top: 12px">
            <a-collapse-panel v-if="view.snapshot.params" key="params" header="当时的参数（JSON）">
              <pre class="pre">{{ prettyParams }}</pre>
            </a-collapse-panel>
          </a-collapse>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import dayjs, { type Dayjs } from 'dayjs';
import { computed, onMounted, ref } from 'vue';

import {
  GLOBAL_SCOPE,
  PlazaError,
  getHeadlineSnapshot,
  getHeadlineSnapshotAt,
  getHeadlineSnapshots,
  type HeadlineBoard,
  type HeadlineScopeSummary,
  type HeadlineSnapshotMeta,
  type HeadlineSource,
} from '@/api/plaza-admin';

import { SOURCE_META, fmtTime, triggerLabel } from './labels';

const props = defineProps<{ scopes: HeadlineScopeSummary[] }>();
const emit = defineEmits<{
  (e: 'open-in-board', version: number, scope: string): void;
}>();

const SIZE = 20;
const list = ref<HeadlineSnapshotMeta[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const latestVersion = ref<number | undefined>();

const columns = [
  { title: '版本', dataIndex: 'version', width: 110 },
  { title: '计算时间', dataIndex: 'computedAt', width: 170 },
  { title: '触发', dataIndex: 'trigger', width: 170 },
  { title: '信号源', dataIndex: 'signalSource', width: 90 },
  { title: '候选', dataIndex: 'candidateCount', width: 70 },
  { title: '范围数', dataIndex: 'scopeCount', width: 70 },
  { title: '条目数', dataIndex: 'itemCount', width: 70 },
  { title: '耗时', dataIndex: 'durationMs', width: 90 },
  { title: '参数', dataIndex: 'paramsHash', width: 90 },
  { title: '操作', key: 'operation', width: 80, fixed: 'right' as const },
];
const itemColumns = [
  { title: '名次', dataIndex: 'rank', width: 56 },
  { title: '模板', dataIndex: 'title', width: 230 },
  { title: '来源', dataIndex: 'source', width: 150 },
  { title: '分数', dataIndex: 'score', width: 70 },
  { title: '推荐语', dataIndex: 'why', width: 180 },
  { title: '近 7 天', dataIndex: 'uses7d', width: 70 },
  { title: '人工规则生效期', dataIndex: 'rule', width: 190 },
];

const scopeOptions = computed(() =>
  [...props.scopes]
    .sort((a, b) => (a.scope === GLOBAL_SCOPE ? -1 : b.scope === GLOBAL_SCOPE ? 1 : 0))
    .map((s) => ({
      value: s.scope,
      label: s.scope === GLOBAL_SCOPE ? '全站总榜' : `${s.parentCode ? '　' : ''}${s.name}`,
    })),
);
const filterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').includes(input);

async function loadList() {
  loading.value = true;
  try {
    const r = await getHeadlineSnapshots({ page: page.value, size: SIZE });
    list.value = r?.list ?? [];
    total.value = r?.total ?? 0;
    if (page.value === 1) latestVersion.value = list.value[0]?.version;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
function onTableChange(p: { current?: number }) {
  page.value = p.current ?? 1;
  loadList();
}

// ---------------- 只读查看 ----------------
const atTime = ref<string | undefined>();
const atScope = ref(GLOBAL_SCOPE);
const finding = ref(false);

const drawerOpen = ref(false);
const viewVersion = ref<number | undefined>();
const viewScope = ref(GLOBAL_SCOPE);
const view = ref<HeadlineBoard | null>(null);
const viewLoading = ref(false);
const gone = ref(false);
const drawerTitle = computed(() =>
  view.value ? `历史版本 v${view.value.snapshot.version}（只读）` : '历史版本（只读）',
);
const prettyParams = computed(() => {
  const raw = view.value?.snapshot.params;
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
});

let seq = 0;
async function loadView() {
  if (!viewVersion.value) return;
  const s = ++seq;
  viewLoading.value = true;
  gone.value = false;
  try {
    const b = await getHeadlineSnapshot(viewVersion.value, viewScope.value, { silent: true });
    if (s === seq) view.value = b;
  } catch (e) {
    if (s !== seq) return;
    view.value = null;
    if (e instanceof PlazaError && e.reason === 'HEADLINE_SNAPSHOT_EXPIRED') gone.value = true;
    else message.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    if (s === seq) viewLoading.value = false;
  }
}

function openVersion(v: number) {
  viewVersion.value = v;
  viewScope.value = atScope.value;
  view.value = null;
  drawerOpen.value = true;
  loadView();
}

async function findAt() {
  if (!atTime.value) return;
  finding.value = true;
  try {
    const b = await getHeadlineSnapshotAt(atTime.value, atScope.value, { silent: true });
    viewVersion.value = b.snapshot.version;
    viewScope.value = atScope.value;
    view.value = b;
    gone.value = false;
    drawerOpen.value = true;
  } catch (e) {
    if (e instanceof PlazaError && e.reason === 'HEADLINE_SNAPSHOT_EXPIRED')
      message.warning('该时间点没有榜单版本（早于第一个版本，或超过保留期）');
    else message.error(e instanceof Error ? e.message : '查找失败');
  } finally {
    finding.value = false;
  }
}

onMounted(loadList);
defineExpose({ reload: loadList });
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.tpl {
  display: flex;
  gap: 8px;
  align-items: center;
}
.thumb {
  width: 32px;
  height: 42px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.t-title {
  font-weight: 500;
}
.pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  background: var(--ant-color-fill-quaternary, #fafafa);
  padding: 8px;
  border-radius: 4px;
}
</style>
