<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">{{ $t('creationBackfill.title') }}</h2>
      <a-button :loading="remainingLoading" @click="loadRemaining">
        {{ $t('creationBackfill.refresh') }}
      </a-button>
    </div>

    <a-alert type="info" show-icon style="margin-bottom: 16px" :message="$t('creationBackfill.hint')" />

    <!-- ==================== 创作入口码 ==================== -->
    <a-card variant="borderless" :title="$t('creationBackfill.entryTitle')" style="margin-bottom: 16px">
      <p class="card-desc">{{ $t('creationBackfill.entryDesc') }}</p>

      <a-row :gutter="16" class="stat-row">
        <a-col :span="8">
          <a-statistic
            :title="$t('creationBackfill.entryRemainingTasks')"
            :value="entryRemaining?.tasks ?? 0"
            :loading="remainingLoading"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('creationBackfill.entryRemainingAssets')"
            :value="entryRemaining?.assets ?? 0"
            :loading="remainingLoading"
          />
        </a-col>
        <a-col :span="8">
          <!-- 这一栏与上面两栏不是一回事：那批行已经填上了，只是填的值下游认不出来 -->
          <a-statistic
            :title="$t('creationBackfill.entryUnregisteredStat')"
            :value="entryRemaining?.unregisteredTasks ?? 0"
            :loading="remainingLoading"
            :value-style="unregisteredCount ? { color: '#d46b08' } : undefined"
          />
        </a-col>
      </a-row>
      <div class="muted">{{ $t('creationBackfill.entryStuckHint') }}</div>

      <!--
        未注册入口码告警。这是本页最有价值的信息：这批任务的 entry_code 已经填上了，
        再点多少次回填也不会变，欠的是**计费 offer 配置**。而下游全程静默降级、
        不报错也不留可见痕迹，不主动喊出来没人会发现。
      -->
      <a-alert
        v-if="unregisteredCount"
        type="warning"
        show-icon
        class="unreg-alert"
        :message="$t('creationBackfill.entryUnregisteredTitle', { count: unregisteredCount })"
      >
        <template #description>
          <div class="unreg-desc">{{ $t('creationBackfill.entryUnregisteredDesc') }}</div>
          <div class="unreg-desc">{{ $t('creationBackfill.entryUnregisteredAction') }}</div>
          <a-table
            class="unreg-table"
            :columns="unregisteredColumns"
            :data-source="unregisteredRows"
            :pagination="false"
            row-key="code"
            size="small"
            :scroll="unregisteredRows.length > 8 ? { y: 240 } : undefined"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'code'">
                <code class="code-cell">{{ record.code }}</code>
              </template>
            </template>
          </a-table>
        </template>
      </a-alert>
      <a-alert
        v-else-if="entryRemaining"
        type="success"
        show-icon
        class="unreg-alert"
        :message="$t('creationBackfill.entryUnregisteredNone')"
      />

      <a-divider />

      <a-form layout="inline" class="param-form">
        <a-form-item :label="$t('creationBackfill.scope')">
          <a-select v-model:value="entryForm.scope" :options="entryScopeOptions" style="width: 160px" />
        </a-form-item>
        <a-form-item :label="$t('creationBackfill.limit')">
          <a-input-number v-model:value="entryForm.limit" :min="1" :max="ENTRY_MAX_LIMIT" style="width: 120px" />
        </a-form-item>
        <a-form-item :label="$t('creationBackfill.offset')">
          <a-input-number v-model:value="entryForm.offset" :min="0" style="width: 120px" />
        </a-form-item>
        <a-form-item :label="$t('creationBackfill.dryRun')">
          <a-switch v-model:checked="entryForm.dryRun" />
        </a-form-item>
        <a-form-item>
          <!-- 权限与后端 @PreAuthorize 对齐：看欠账是 task:view，真的写库是 task:force_complete -->
          <a-button
            v-permission="'task:force_complete'"
            type="primary"
            :loading="entryRunning"
            :disabled="entryRunning"
            @click="runEntry"
          >
            {{ $t('creationBackfill.run') }}
          </a-button>
        </a-form-item>
      </a-form>
      <div class="muted">{{ $t('creationBackfill.limitHint', { max: ENTRY_MAX_LIMIT }) }}</div>
      <div class="muted">{{ $t('creationBackfill.offsetHint') }}</div>
      <div class="muted">{{ $t('creationBackfill.dryRunHint') }}</div>

      <a-table
        v-if="entryResultRows.length"
        class="result-table"
        :columns="entryResultColumns"
        :data-source="entryResultRows"
        :pagination="false"
        row-key="key"
        size="small"
      />

      <template v-if="entryHistory.length">
        <div class="history-title">{{ $t('creationBackfill.history') }}</div>
        <a-table
          :columns="historyColumns"
          :data-source="entryHistory"
          :pagination="false"
          row-key="key"
          size="small"
        />
      </template>

      <div class="muted foot-hint">{{ $t('creationBackfill.idempotentHint') }}</div>
      <div class="muted">
        {{ $t('creationBackfill.scriptHint', { script: 'scripts/backfill-entry-code.sh' }) }}
      </div>
    </a-card>

    <!-- ==================== 视频封面 ==================== -->
    <a-card variant="borderless" :title="$t('creationBackfill.coverTitle')">
      <p class="card-desc">{{ $t('creationBackfill.coverDesc') }}</p>

      <a-row :gutter="16" class="stat-row">
        <a-col :span="8">
          <a-statistic
            :title="$t('creationBackfill.coverRemainingAssets')"
            :value="coverRemaining?.assets ?? 0"
            :loading="remainingLoading"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('creationBackfill.coverRemainingTasks')"
            :value="coverRemaining?.tasks ?? 0"
            :loading="remainingLoading"
          />
        </a-col>
      </a-row>
      <div class="muted">{{ $t('creationBackfill.coverRemainingHint') }}</div>

      <a-divider />

      <a-form layout="inline" class="param-form">
        <a-form-item :label="$t('creationBackfill.scope')">
          <a-select v-model:value="coverForm.scope" :options="coverScopeOptions" style="width: 160px" />
        </a-form-item>
        <a-form-item :label="$t('creationBackfill.limit')">
          <a-input-number v-model:value="coverForm.limit" :min="1" :max="COVER_MAX_LIMIT" style="width: 120px" />
        </a-form-item>
        <a-form-item :label="$t('creationBackfill.offset')">
          <a-input-number v-model:value="coverForm.offset" :min="0" style="width: 120px" />
        </a-form-item>
        <a-form-item>
          <a-button
            v-permission="'task:force_complete'"
            type="primary"
            :loading="coverRunning"
            :disabled="coverRunning"
            @click="runCover"
          >
            {{ $t('creationBackfill.run') }}
          </a-button>
        </a-form-item>
      </a-form>
      <div class="muted">{{ $t('creationBackfill.limitHint', { max: COVER_MAX_LIMIT }) }}</div>
      <div class="muted">{{ $t('creationBackfill.offsetHint') }}</div>
      <div class="muted">{{ $t('creationBackfill.coverNoDryRunHint') }}</div>

      <a-table
        v-if="coverResultRows.length"
        class="result-table"
        :columns="coverResultColumns"
        :data-source="coverResultRows"
        :pagination="false"
        row-key="key"
        size="small"
      />

      <template v-if="coverHistory.length">
        <div class="history-title">{{ $t('creationBackfill.history') }}</div>
        <a-table
          :columns="historyColumns"
          :data-source="coverHistory"
          :pagination="false"
          row-key="key"
          size="small"
        />
      </template>

      <div class="muted foot-hint">{{ $t('creationBackfill.idempotentHint') }}</div>
      <div class="muted">
        {{ $t('creationBackfill.scriptHint', { script: 'scripts/backfill-video-cover.sh' }) }}
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  backfillEntryCode,
  backfillVideoCover,
  getEntryCodeRemaining,
  getVideoCoverRemaining,
  type EntryCodeRemaining,
  type EntryCodeReport,
  type EntryCodeScope,
  type VideoCoverRemaining,
  type VideoCoverReport,
  type VideoCoverScope,
} from '@/api/creation-backfill'

const { t } = useI18n()

/** 与后端 service 里的 MAX_LIMIT 对齐：填超了后端会静默截断，界面上先拦住免得对不上数 */
const ENTRY_MAX_LIMIT = 500
const COVER_MAX_LIMIT = 200
/** 执行记录只留在内存里，刷新页面就没了；留太多也没人回看 */
const HISTORY_LIMIT = 20

interface HistoryRow {
  key: number
  time: string
  params: string
  summary: string
}

// ---------------- 欠账数字 ----------------

const remainingLoading = ref(false)
const entryRemaining = ref<EntryCodeRemaining | null>(null)
const coverRemaining = ref<VideoCoverRemaining | null>(null)

/**
 * 两条线的 remaining 一起拉。它们互不相干，但运维看的是同一件事「还欠多少」，
 * 分开刷会出现一半新一半旧的画面。
 */
async function loadRemaining() {
  remainingLoading.value = true
  try {
    const [entry, cover] = await Promise.allSettled([
      getEntryCodeRemaining(),
      getVideoCoverRemaining(),
    ])
    // allSettled 而不是 all：一侧接口挂了不该把另一侧已经拿到的数字也抹掉
    if (entry.status === 'fulfilled') entryRemaining.value = entry.value
    if (cover.status === 'fulfilled') coverRemaining.value = cover.value
  } finally {
    remainingLoading.value = false
  }
}
loadRemaining()

const unregisteredCount = computed(() => entryRemaining.value?.unregisteredTasks ?? 0)

/** 未注册入口码明细，按条数从多到少——先补影响面最大的那个 offer */
const unregisteredRows = computed(() => {
  const map = entryRemaining.value?.unregisteredByCode || {}
  return Object.entries(map)
    .map(([code, count]) => ({ code, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
})

const unregisteredColumns = computed(() => [
  { title: t('creationBackfill.entryCodeCol'), dataIndex: 'code' },
  {
    title: t('creationBackfill.entryCountCol'),
    dataIndex: 'count',
    width: 120,
    align: 'right' as const,
  },
])

// ---------------- 参数 ----------------

const entryForm = reactive({
  scope: 'both' as EntryCodeScope,
  limit: 200,
  offset: 0,
  dryRun: false,
})

const coverForm = reactive({
  scope: 'both' as VideoCoverScope,
  limit: 50,
  offset: 0,
})

const entryScopeOptions = computed(() => [
  { value: 'both', label: t('creationBackfill.scopeBoth') },
  { value: 'task', label: t('creationBackfill.scopeTask') },
  { value: 'asset', label: t('creationBackfill.scopeAsset') },
])

const coverScopeOptions = computed(() => [
  { value: 'both', label: t('creationBackfill.scopeBoth') },
  { value: 'asset', label: t('creationBackfill.scopeAsset') },
  { value: 'task', label: t('creationBackfill.scopeTask') },
])

function scopeLabel(scope: string) {
  if (scope === 'task') return t('creationBackfill.scopeTask')
  if (scope === 'asset') return t('creationBackfill.scopeAsset')
  return t('creationBackfill.scopeBoth')
}

// ---------------- 执行 ----------------

const entryRunning = ref(false)
const coverRunning = ref(false)
const entryReport = ref<EntryCodeReport | null>(null)
const coverReport = ref<VideoCoverReport | null>(null)
const entryHistory = ref<HistoryRow[]>([])
const coverHistory = ref<HistoryRow[]>([])

/** 追加一条执行记录，超出上限的从尾部丢——最新的排在最前面 */
function pushHistory(list: typeof entryHistory, params: string, summary: string) {
  list.value = [
    { key: Date.now(), time: dayjs().format('HH:mm:ss'), params, summary },
    ...list.value,
  ].slice(0, HISTORY_LIMIT)
}

function paramsText(scope: string, limit: number, offset: number, dryRun?: boolean) {
  const base = t('creationBackfill.paramsSummary', {
    scope: scopeLabel(scope),
    limit,
    offset,
  })
  return dryRun ? `${base} · ${t('creationBackfill.dryRunTag')}` : base
}

async function runEntry() {
  // loading 期间按钮已 disabled，这里再挡一次：键盘回车/双击能在 disabled 生效前挤进第二次调用
  if (entryRunning.value) return
  entryRunning.value = true
  try {
    const report = await backfillEntryCode({ ...entryForm })
    entryReport.value = report
    pushHistory(
      entryHistory,
      paramsText(entryForm.scope, entryForm.limit, entryForm.offset, entryForm.dryRun),
      [
        t('creationBackfill.entryHistorySide', {
          side: t('creationBackfill.sideTask'),
          ...entryResult(report?.tasks),
        }),
        t('creationBackfill.entryHistorySide', {
          side: t('creationBackfill.sideAsset'),
          ...entryResult(report?.assets),
        }),
      ].join('；'),
    )
    const filled = entryResult(report?.tasks).filled + entryResult(report?.assets).filled
    message.success(
      entryForm.dryRun
        ? t('creationBackfill.dryRunDone', { count: filled })
        : t('creationBackfill.runDone', { count: filled }),
    )
    // 试跑不写库，欠账不会变，但重刷一次没有坏处、还能顺带确认数字确实没动
    loadRemaining()
  } catch {
    /* 拦截器已提示（含「正在执行，请稍后重试」这种撞锁的情况） */
  } finally {
    entryRunning.value = false
  }
}

async function runCover() {
  if (coverRunning.value) return
  coverRunning.value = true
  try {
    const report = await backfillVideoCover({ ...coverForm })
    coverReport.value = report
    pushHistory(
      coverHistory,
      paramsText(coverForm.scope, coverForm.limit, coverForm.offset),
      [
        t('creationBackfill.coverHistorySide', {
          side: t('creationBackfill.sideAsset'),
          ...coverResult(report?.assets),
        }),
        t('creationBackfill.coverHistorySide', {
          side: t('creationBackfill.sideTask'),
          ...coverResult(report?.tasks),
        }),
      ].join('；'),
    )
    const generated = coverResult(report?.assets).generated + coverResult(report?.tasks).generated
    message.success(t('creationBackfill.coverRunDone', { count: generated }))
    loadRemaining()
  } catch {
    /* 拦截器已提示 */
  } finally {
    coverRunning.value = false
  }
}

// ---------------- 结果表 ----------------

/** 没跑的方向后端给的是空结果，但别假设字段一定在——缺字段渲染成 undefined 会显示空白格 */
function entryResult(r?: { scanned?: number; filled?: number; stuck?: number } | null) {
  return { scanned: r?.scanned ?? 0, filled: r?.filled ?? 0, stuck: r?.stuck ?? 0 }
}

function coverResult(
  r?: { scanned?: number; generated?: number; failed?: number; crossFixed?: number } | null,
) {
  return {
    scanned: r?.scanned ?? 0,
    generated: r?.generated ?? 0,
    failed: r?.failed ?? 0,
    crossFixed: r?.crossFixed ?? 0,
  }
}

const entryResultRows = computed(() => {
  const r = entryReport.value
  if (!r) return []
  return [
    { key: 'task', side: t('creationBackfill.sideTask'), ...entryResult(r.tasks) },
    { key: 'asset', side: t('creationBackfill.sideAsset'), ...entryResult(r.assets) },
  ]
})

const coverResultRows = computed(() => {
  const r = coverReport.value
  if (!r) return []
  return [
    { key: 'asset', side: t('creationBackfill.sideAsset'), ...coverResult(r.assets) },
    { key: 'task', side: t('creationBackfill.sideTask'), ...coverResult(r.tasks) },
  ]
})

const entryResultColumns = computed(() => [
  { title: t('creationBackfill.colSide'), dataIndex: 'side', width: 160 },
  { title: t('creationBackfill.colScanned'), dataIndex: 'scanned', width: 120 },
  { title: t('creationBackfill.colFilled'), dataIndex: 'filled', width: 120 },
  { title: t('creationBackfill.colStuck'), dataIndex: 'stuck' },
])

const coverResultColumns = computed(() => [
  { title: t('creationBackfill.colSide'), dataIndex: 'side', width: 160 },
  { title: t('creationBackfill.colScanned'), dataIndex: 'scanned', width: 120 },
  { title: t('creationBackfill.colGenerated'), dataIndex: 'generated', width: 120 },
  { title: t('creationBackfill.colFailed'), dataIndex: 'failed', width: 120 },
  { title: t('creationBackfill.colCrossFixed'), dataIndex: 'crossFixed' },
])

const historyColumns = computed(() => [
  { title: t('creationBackfill.colTime'), dataIndex: 'time', width: 100 },
  { title: t('creationBackfill.colParams'), dataIndex: 'params', width: 320 },
  { title: t('creationBackfill.colResult'), dataIndex: 'summary' },
])
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
.card-desc {
  margin: 0 0 16px;
  color: var(--color-text-secondary, #666);
  line-height: 1.7;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
  line-height: 1.7;
}
.stat-row {
  margin-bottom: 8px;
}
.unreg-alert {
  margin-top: 16px;
}
.unreg-desc {
  margin-bottom: 8px;
  line-height: 1.7;
}
/* 明细表塞在 alert 的描述区里，背景是警告色，给它一块白底才看得清 */
.unreg-table {
  max-width: 520px;
  background: var(--bg-color, #fff);
  border-radius: 4px;
}
.code-cell {
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary, #f5f5f5);
  font-size: 12px;
}
.param-form {
  row-gap: 8px;
}
.result-table {
  margin-top: 16px;
}
.history-title {
  margin: 16px 0 8px;
  font-weight: 500;
}
.foot-hint {
  margin-top: 16px;
}
</style>
