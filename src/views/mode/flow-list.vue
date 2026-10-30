<template>
  <div class="page-container">
    <a-alert type="info" show-icon class="frozen-alert" :message="t('modeRouting.legacyFrozen')">
      <template #action>
        <a-button size="small" type="link" @click="router.push('/workflow/definitions')">
          {{ t('modeRouting.goDefinitions') }}
        </a-button>
      </template>
    </a-alert>
    <div v-if="globalState" class="global-switch">
      <span class="global-label">{{ t('modeRouting.globalSwitch') }}</span>
      <a-switch
        :checked="globalState.enabled"
        :loading="globalSaving"
        :disabled="!canPublish"
        @change="(v: unknown) => toggleGlobal(!!v)"
      />
      <span class="muted">{{
        t(
          globalState.source === 'config'
            ? 'modeRouting.globalSourceConfig'
            : 'modeRouting.globalSourceDefault',
        )
      }}</span>
    </div>
    <ProTable :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText><a-empty description="暂无 Mode 流" /></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'targetModelCode'">
          <a-tag v-if="record.targetModelCode" color="geekblue">{{ record.targetModelCode }}</a-tag>
          <span v-else class="muted">通用</span>
        </template>
        <template v-if="column.dataIndex === 'activeVersionId'">
          <a-tag v-if="record.activeVersionId > 0" color="green">已发布</a-tag>
          <a-tag v-else color="default">无生效版本</a-tag>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">{{
            record.status === 1 ? '启用' : '停用'
          }}</a-tag>
        </template>
        <template v-if="column.key === 'routing'">
          <template v-if="routingOf(record)">
            <div class="routing-cell">
              <div>
                <a-tag v-if="routingOf(record)!.switchOn" color="green">{{
                  t('modeRouting.on')
                }}</a-tag>
                <a-tag v-else>{{ t('modeRouting.off') }}</a-tag>
                <a-tooltip
                  v-if="!routingOf(record)!.globalOn"
                  :title="t('modeRouting.globalOffHint')"
                >
                  <a-tag color="orange">{{ t('modeRouting.globalOff') }}</a-tag>
                </a-tooltip>
              </div>
              <div class="muted">
                <code>{{ routingOf(record)!.definitionCode }}</code>
                <span v-if="routingOf(record)!.versionNo != null">
                  · {{ t('modeRouting.sourceVersion', { version: routingOf(record)!.versionNo }) }}
                </span>
              </div>
              <div v-if="driftAvailable">
                <a-tag v-if="driftLoading[String(record.code)]">…</a-tag>
                <template v-else-if="driftOf(record)">
                  <a-tag v-if="!hasDefinition(record)">{{
                    t('modeRouting.syncNotImported')
                  }}</a-tag>
                  <a-tag v-else-if="driftOf(record)!.inSync" color="green">{{
                    t('modeRouting.syncInSync')
                  }}</a-tag>
                  <a-tooltip v-else :title="t('modeRouting.syncOutOfSyncHint')">
                    <a-tag color="orange">{{ t('modeRouting.syncOutOfSync') }}</a-tag>
                  </a-tooltip>
                  <a
                    v-if="hasDefinition(record)"
                    class="def-link"
                    @click="openDefinition(driftOf(record)!.definitionId!)"
                  >
                    {{
                      t('modeRouting.definitionVersion', {
                        version: driftOf(record)!.definitionVersion ?? '-',
                      })
                    }}
                  </a>
                </template>
              </div>
              <div>
                <a-tag v-if="routingOf(record)!.convertible" color="green">{{
                  t('modeRouting.convertOk')
                }}</a-tag>
                <a-popover v-else :title="t('modeRouting.errorsTitle')" placement="left">
                  <template #content>
                    <ul class="error-list">
                      <li v-for="(e, i) in modeRoutingErrors(routingOf(record)!)" :key="i">
                        {{ e }}
                      </li>
                    </ul>
                  </template>
                  <a-tag color="red" class="clickable">{{
                    t('modeRouting.convertFail', {
                      count: modeRoutingErrors(routingOf(record)!).length,
                    })
                  }}</a-tag>
                </a-popover>
              </div>
            </div>
          </template>
          <span v-else-if="routingLoading[String(record.code)]" class="muted">…</span>
          <span v-else class="muted">-</span>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="4" wrap>
            <a-button type="link" size="small" @click="openVersions(record)">{{
              t('modeRouting.viewVersions')
            }}</a-button>
            <a-button
              type="link"
              size="small"
              :loading="!!routingLoading[String(record.code)]"
              @click="recheck(record)"
              >{{ t('modeRouting.recheck') }}</a-button
            >
            <a-button
              v-if="driftAvailable"
              v-permission="'mode:publish'"
              type="link"
              size="small"
              :loading="!!importing[String(record.code)]"
              @click="doImport(record)"
              >{{
                hasDefinition(record)
                  ? t('modeRouting.reimport')
                  : t('modeRouting.importDefinition')
              }}</a-button
            >
            <span v-permission="'mode:publish'">
              <a-tooltip :title="switchDisabledReason(record)">
                <a-switch
                  size="small"
                  :checked="!!routingOf(record)?.switchOn"
                  :disabled="switchDisabled(record)"
                  :loading="!!switching[String(record.code)]"
                  @change="(v: unknown) => toggle(record, !!v)"
                />
              </a-tooltip>
            </span>
          </a-space>
        </template>
      </template>
    </ProTable>
    <a-modal
      v-model:open="previewOpen"
      :title="t('modeRouting.previewTitle')"
      width="800px"
      destroy-on-close
    >
      <div class="muted preview-code">
        <code>{{ previewCode }}</code>
      </div>
      <ProCodeEditor :model-value="previewJson" language="json" readonly :height="480" />
      <template #footer>
        <a-button @click="previewOpen = false">{{ t('modeRouting.previewClose') }}</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { pageFlows, type ModeFlow } from '@/api/mode';
import {
  convertModeRouting,
  getModeRouting,
  getModeRoutingGlobal,
  getModeRoutingDrift,
  importModeDefinition,
  modeRoutingErrors,
  setModeRouting,
  setModeRoutingGlobal,
  type ModeRoutingDrift,
  type ModeRoutingGlobal,
  type ModeRoutingStatus,
} from '@/api/mode-routing';
import { isEndpointMissing } from '@/api/workflow-definition';
import { usePermission } from '@/composables/usePermission';
import ProCodeEditor from '@/components/Pro/ProCodeEditor/index.vue';
import ProTable from '@/components/Pro/ProTable/index.vue';

const { t } = useI18n();
const router = useRouter();

/** 按流编码存切换状态；取不到的行显示「-」，不阻塞表格 */
const routing = reactive<Record<string, ModeRoutingStatus | undefined>>({});
const routingLoading = reactive<Record<string, boolean>>({});
const switching = reactive<Record<string, boolean>>({});

/** 定义表同步状态（定义表是改走定义后的唯一来源）；接口未上线（404）时整列降级为旧行为 */
const drift = reactive<Record<string, ModeRoutingDrift | undefined>>({});
const driftLoading = reactive<Record<string, boolean>>({});
const driftAvailable = ref(true);
const importing = reactive<Record<string, boolean>>({});

/** 干跑后的只读定义预览：转换出的定义不落库，这里只看不存 */
const previewOpen = ref(false);
const previewJson = ref('');
const previewCode = ref('');

const columns = [
  {
    title: '编码',
    dataIndex: 'code',
    width: 200,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
  {
    title: '目标模型',
    dataIndex: 'targetModelCode',
    width: 160,
    ellipsis: true,
    search: true,
    searchType: 'input' as const,
  },
  { title: '入口', dataIndex: 'entryCode', width: 140, ellipsis: true },
  { title: '生效状态', dataIndex: 'activeVersionId', width: 110, align: 'center' as const },
  { title: t('modeRouting.column'), dataIndex: 'routing', key: 'routing', width: 260 },
  { title: '启用', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updateTime', width: 170 },
  {
    title: '操作',
    dataIndex: 'op',
    key: 'op',
    width: 300,
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

function routingOf(record: ModeFlow): ModeRoutingStatus | undefined {
  return routing[String(record.code)];
}

function driftOf(record: ModeFlow): ModeRoutingDrift | undefined {
  return drift[String(record.code)];
}

function hasDefinition(record: ModeFlow): boolean {
  const d = driftOf(record);
  return !!d && d.definitionId !== null && d.definitionId !== undefined && d.definitionId !== '';
}

/**
 * 开启的前置条件：已导入为定义（同步接口可用时）且可转换。
 * 已开启的始终允许关闭（关闭是应急手段）。
 */
function switchDisabledReason(record: ModeFlow): string {
  const s = routingOf(record);
  if (!s) return t('modeRouting.needConvertible');
  if (s.switchOn) return '';
  if (driftAvailable.value && !hasDefinition(record)) return t('modeRouting.needDefinition');
  if (!s.convertible) return t('modeRouting.needConvertible');
  return '';
}

function switchDisabled(record: ModeFlow): boolean {
  return switchDisabledReason(record) !== '';
}

async function loadDrift(code: string) {
  if (!driftAvailable.value) return;
  driftLoading[code] = true;
  try {
    drift[code] = await getModeRoutingDrift(code);
  } catch (e) {
    drift[code] = undefined;
    if (isEndpointMissing(e)) driftAvailable.value = false;
  } finally {
    driftLoading[code] = false;
  }
}

function openDefinition(definitionId: number | string) {
  router.push(`/workflow/definitions/${definitionId}`);
}

function doImport(record: ModeFlow) {
  const code = String(record.code);
  Modal.confirm({
    title: t(hasDefinition(record) ? 'modeRouting.reimportConfirm' : 'modeRouting.importConfirm', {
      modeCode: code,
    }),
    onOk: async () => {
      importing[code] = true;
      try {
        const res = await importModeDefinition(code);
        await Promise.all([loadDrift(code), loadRouting(code)]);
        Modal.confirm({
          title: t('modeRouting.importOk', { code: res.code, version: res.version }),
          okText: t('modeRouting.openDefinition'),
          cancelText: t('modeRouting.previewClose'),
          onOk: () => openDefinition(res.definitionId),
        });
      } catch (e) {
        if (isEndpointMissing(e)) {
          driftAvailable.value = false;
          message.warning(t('modeRouting.importUnavailable'));
        }
        /* 其它错误拦截器已提示 */
      } finally {
        importing[code] = false;
      }
    },
  });
}

async function loadRouting(code: string) {
  routingLoading[code] = true;
  try {
    routing[code] = await getModeRouting(code);
  } catch {
    routing[code] = undefined;
  } finally {
    routingLoading[code] = false;
  }
}

async function loadData(params: Record<string, unknown>) {
  const res = await pageFlows({
    keyword: params.code as string | undefined,
    targetModelCode: params.targetModelCode as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  });
  const list = res.list || [];
  list.forEach((f) => {
    if (f.code) {
      void loadRouting(String(f.code));
      void loadDrift(String(f.code));
    }
  });
  return { data: list, total: res.total || 0, success: true };
}

function openVersions(record: ModeFlow) {
  router.push(`/workflow/modes/flows/${record.id}/versions`);
}

/** 干跑转换 + 校验，不落库；转换成功则弹出只读预览（转换失败的原因已在该格显示） */
async function recheck(record: ModeFlow) {
  const code = String(record.code);
  routingLoading[code] = true;
  try {
    const { definitionJson, ...status } = await convertModeRouting(code);
    routing[code] = status;
    if (definitionJson) {
      previewJson.value = definitionJson;
      previewCode.value = status.definitionCode;
      previewOpen.value = true;
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    routingLoading[code] = false;
  }
}

function toggle(record: ModeFlow, enabled: boolean) {
  const code = String(record.code);
  const s = routing[code];
  if (!s) return;
  Modal.confirm({
    title: t(enabled ? 'modeRouting.confirmOn' : 'modeRouting.confirmOff', {
      modeCode: code,
      definitionCode: s.definitionCode,
    }),
    onOk: async () => {
      switching[code] = true;
      try {
        routing[code] = await setModeRouting(code, enabled);
        message.success(t('modeRouting.saved'));
      } catch {
        /* 拦截器已提示原因；开关由 routing 驱动，保持原值 */
        await loadRouting(code);
      } finally {
        switching[code] = false;
      }
    },
  });
}

/** 总开关：GET 404 时隐藏；写入需 mode:publish，无权限时开关只读 */
const globalState = ref<ModeRoutingGlobal>();
const globalSaving = ref(false);
const { can } = usePermission();
const canPublish = computed(() => can('mode:publish'));

async function loadGlobal() {
  try {
    globalState.value = await getModeRoutingGlobal();
  } catch {
    globalState.value = undefined;
  }
}
void loadGlobal();

function toggleGlobal(enabled: boolean) {
  Modal.confirm({
    title: t(enabled ? 'modeRouting.globalConfirmOn' : 'modeRouting.globalConfirmOff'),
    content: t(enabled ? 'modeRouting.globalOnWarn' : 'modeRouting.globalOffWarn'),
    onOk: async () => {
      globalSaving.value = true;
      try {
        globalState.value = await setModeRoutingGlobal(enabled);
        message.success(t('modeRouting.saved'));
        await Promise.all(Object.keys(routing).map((code) => loadRouting(code)));
      } catch {
        /* 拦截器已提示 */
        await loadGlobal();
      } finally {
        globalSaving.value = false;
      }
    },
  });
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.global-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.global-label {
  font-weight: 500;
}
.frozen-alert {
  margin-bottom: 16px;
}
.routing-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.error-list {
  max-width: 420px;
  margin: 0;
  padding-left: 18px;
}
.def-link {
  margin-left: 4px;
  font-size: 12px;
}
.clickable {
  cursor: pointer;
}
.preview-code {
  margin-bottom: 8px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
</style>
