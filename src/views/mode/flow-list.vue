<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText><a-empty description="暂无 Mode 流，点「新建流程」创建" /></template>
      <template #toolbar>
        <a-button type="primary" @click="openCreate">新建流程</a-button>
      </template>
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
          <a-tag :color="record.status === 1 ? 'green' : 'red'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="openVersions(record)">版本/编排</a-button>
            <a-popconfirm title="删除该流程（含全部版本）？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- 创建/编辑元数据 -->
    <a-modal v-model:open="metaOpen" :title="editId ? '编辑流程' : '新建流程'" :confirm-loading="saving" @ok="submitMeta">
      <a-form layout="vertical">
        <a-form-item label="编码 Code" required>
          <a-input v-model:value="meta.code" :disabled="!!editId" placeholder="如 local_video_hitVideo" />
        </a-form-item>
        <a-form-item label="名称" required><a-input v-model:value="meta.name" /></a-form-item>
        <a-form-item label="关联目标生成模型（如 local-image/local-video，空=通用）">
          <a-select v-model:value="meta.targetModelCode" :options="modelCodeOptions" allow-clear show-search option-filter-prop="label" placeholder="选择目标模型 code" />
        </a-form-item>
        <a-form-item label="细分入口 EntryCode（可空 = 通用）">
          <a-select
            v-model:value="meta.entryCode"
            :options="entryCodeOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择计费场景 entryCode（来自已配置计费 offer）"
          />
        </a-form-item>
        <a-form-item label="描述"><a-textarea v-model:value="meta.description" :rows="2" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 版本抽屉 -->
    <a-drawer v-model:open="versionOpen" :title="`版本 · ${currentFlow?.name || ''}`" width="640">
      <template #extra>
        <a-space>
          <a-button size="small" @click="editMeta">编辑元数据</a-button>
          <a-button type="primary" size="small" @click="newDraft">新建草稿</a-button>
        </a-space>
      </template>
      <a-table :columns="versionColumns" :data-source="versions" :loading="loadingVersions" :pagination="false" row-key="id" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'versionNo'">
            v{{ record.versionNo }}
            <a-tag v-if="record.id === currentFlow?.activeVersionId" color="green" size="small">生效中</a-tag>
          </template>
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="vStatusColor(record.status)">{{ vStatusLabel(record.status) }}</a-tag>
          </template>
          <template v-if="column.key === 'op'">
            <a-space :size="2" wrap>
              <a-button v-if="record.status === 'draft'" type="link" size="small" @click="openEditor(record)">可视化编排</a-button>
              <a-button v-else type="link" size="small" @click="openEditor(record)">查看</a-button>
              <a-button type="link" size="small" :loading="previewing" @click="previewPlan(record)">预览计划</a-button>
              <a-button type="link" size="small" @click="cloneDraft(record)">克隆</a-button>
              <a-popconfirm
                v-if="record.id !== currentFlow?.activeVersionId"
                :title="record.status === 'draft' ? '发布该版本？' : '回滚：发布该历史版本？'"
                @confirm="setActive(record)"
              >
                <a-button type="link" size="small">{{ record.status === 'draft' ? '发布' : '回滚' }}</a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status === 'draft' && record.id !== currentFlow?.activeVersionId"
                title="删除草稿？"
                @confirm="removeDraft(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-drawer>

    <!-- 干跑预览：该版本组装后的可执行 plan（不执行/不计费） -->
    <a-modal v-model:open="previewOpen" title="干跑预览 · 组装后的可执行计划（不执行/不计费/不落库）" :footer="null" width="760px">
      <template v-if="previewData">
        <a-space style="margin-bottom: 10px" wrap>
          <a-tag color="blue">拓扑 {{ previewData.topology }}</a-tag>
          <a-tag color="purple">结算 {{ previewData.settlementType }}</a-tag>
          <span class="muted">共 {{ previewData.steps?.length || 0 }} 步（版本列拓扑权威 + costType 缺省 COST_ONLY）</span>
        </a-space>
        <a-table
          :data-source="previewData.steps"
          :columns="stepColumns"
          size="small"
          :pagination="false"
          row-key="code"
        />
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { getModelOptions } from '@/api/model'
import {
  pageFlows, createFlow, updateFlow, deleteFlow,
  getFlowDetail, createFlowDraft, deleteFlowDraft, publishFlowVersion, rollbackFlowVersion,
  previewFlowVersion, getModeMeta,
  type ModeFlow, type ModeFlowVersion, type FlowSaveReq, type ModePlanPreview,
} from '@/api/mode'

const router = useRouter()
const tableRef = ref<InstanceType<typeof ProTable>>()
const modelCodeOptions = ref<{ label: string; value: string }[]>([])

// 干跑预览
const previewing = ref(false)
const previewOpen = ref(false)
const previewData = ref<ModePlanPreview | null>(null)
const stepColumns = [
  { title: '步骤编码', dataIndex: 'code', ellipsis: true },
  { title: '类型', dataIndex: 'kind', width: 90 },
  { title: 'Handler', dataIndex: 'handler', ellipsis: true },
  { title: 'Mode', dataIndex: 'mode', width: 80 },
  { title: '计费', dataIndex: 'costType', width: 100 },
]
async function previewPlan(record: ModeFlowVersion) {
  previewing.value = true
  try {
    previewData.value = await previewFlowVersion(record.id)
    previewOpen.value = true
  } catch {
    /* 拦截器已提示 */
  } finally {
    previewing.value = false
  }
}

const columns = [
  { title: '编码', dataIndex: 'code', width: 200, ellipsis: true, search: true, searchType: 'input' as const },
  { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
  { title: '目标模型', dataIndex: 'targetModelCode', width: 160, ellipsis: true, search: true, searchType: 'input' as const },
  { title: '入口', dataIndex: 'entryCode', width: 140, ellipsis: true },
  { title: '生效状态', dataIndex: 'activeVersionId', width: 110, align: 'center' as const },
  { title: '启用', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updateTime', width: 170 },
  { title: '操作', dataIndex: 'op', key: 'op', width: 160, align: 'center' as const, fixed: 'right' as const },
]

async function loadData(params: Record<string, unknown>) {
  const res = await pageFlows({
    keyword: params.code as string | undefined,
    targetModelCode: params.targetModelCode as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

async function loadModelCodes() {
  try {
    const list = await getModelOptions()
    modelCodeOptions.value = (list || [])
      .filter((m: { code?: string }) => !!m.code)
      .map((m: { name: string; code?: string }) => ({ label: `${m.name} (${m.code})`, value: m.code as string }))
  } catch { /* 忽略 */ }
}

// entryCode = 计费场景（来自已配置 offer），下拉选择免手填
const entryCodeOptions = ref<{ label: string; value: string }[]>([])
async function loadEntryCodes() {
  try {
    const m = await getModeMeta()
    entryCodeOptions.value = (m.entryCodes || []).map((c) => ({ label: c, value: c }))
  } catch { /* 忽略；空则手填 */ }
}

// 元数据
const metaOpen = ref(false)
const saving = ref(false)
const editId = ref<number>()
const meta = reactive<FlowSaveReq>({ code: '', name: '', targetModelCode: '', entryCode: '', description: '', status: 1 })
function openCreate() {
  editId.value = undefined
  Object.assign(meta, { code: '', name: '', targetModelCode: '', entryCode: '', description: '', status: 1 })
  metaOpen.value = true
}
function editMeta() {
  if (!currentFlow.value) return
  editId.value = currentFlow.value.id
  Object.assign(meta, {
    code: currentFlow.value.code,
    name: currentFlow.value.name,
    targetModelCode: currentFlow.value.targetModelCode || '',
    entryCode: currentFlow.value.entryCode || '',
    description: currentFlow.value.description || '',
    status: currentFlow.value.status,
  })
  metaOpen.value = true
}
async function submitMeta() {
  if (!meta.code?.trim() || !meta.name?.trim()) { message.warning('请填写编码与名称'); return }
  saving.value = true
  try {
    if (editId.value) await updateFlow(editId.value, meta)
    else await createFlow(meta)
    message.success('已保存')
    metaOpen.value = false
    tableRef.value?.refresh()
    if (currentFlow.value) reloadVersions(currentFlow.value.id)
  } catch { /* 拦截器已提示 */ } finally { saving.value = false }
}
async function handleDelete(record: ModeFlow) {
  try { await deleteFlow(record.id); message.success('已删除'); tableRef.value?.refresh() } catch { /* */ }
}

// 版本抽屉
const versionOpen = ref(false)
const currentFlow = ref<ModeFlow | null>(null)
const versions = ref<ModeFlowVersion[]>([])
const loadingVersions = ref(false)
const versionColumns = [
  { title: '版本', dataIndex: 'versionNo', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '拓扑', dataIndex: 'topology', width: 100 },
  { title: '变更', dataIndex: 'changelog', ellipsis: true },
  { title: '发布时间', dataIndex: 'publishedAt', width: 160 },
  { title: '操作', key: 'op', width: 260 },
]
function vStatusLabel(s?: string) { return s === 'published' ? '已发布' : s === 'archived' ? '已归档' : '草稿' }
function vStatusColor(s?: string) { return s === 'published' ? 'green' : s === 'archived' ? 'default' : 'blue' }

async function openVersions(record: ModeFlow) {
  currentFlow.value = record
  versionOpen.value = true
  await reloadVersions(record.id)
}
async function reloadVersions(flowId: number) {
  loadingVersions.value = true
  try {
    const detail = await getFlowDetail(flowId)
    currentFlow.value = detail.flow
    versions.value = detail.versions || []
  } catch { /* */ } finally { loadingVersions.value = false }
}
function openEditor(v: ModeFlowVersion) {
  if (!currentFlow.value) return
  router.push(`/mode/flow-editor/${currentFlow.value.id}?versionId=${v.id}`)
}
async function newDraft() {
  if (!currentFlow.value) return
  try {
    const vid = await createFlowDraft(currentFlow.value.id, {})
    message.success('已建草稿')
    await reloadVersions(currentFlow.value.id)
    router.push(`/mode/flow-editor/${currentFlow.value.id}?versionId=${vid}`)
  } catch { /* */ }
}
async function cloneDraft(v: ModeFlowVersion) {
  if (!currentFlow.value) return
  try {
    const vid = await createFlowDraft(currentFlow.value.id, { cloneFromVersionId: v.id })
    message.success('已克隆为新草稿')
    await reloadVersions(currentFlow.value.id)
    router.push(`/mode/flow-editor/${currentFlow.value.id}?versionId=${vid}`)
  } catch { /* */ }
}
async function setActive(v: ModeFlowVersion) {
  if (!currentFlow.value) return
  try {
    if (v.status === 'draft') await publishFlowVersion(v.id)
    else await rollbackFlowVersion(currentFlow.value.id, v.id)
    message.success('已设为生效')
    await reloadVersions(currentFlow.value.id)
    tableRef.value?.refresh()
  } catch { /* */ }
}
async function removeDraft(v: ModeFlowVersion) {
  try { await deleteFlowDraft(v.id); message.success('已删除'); if (currentFlow.value) reloadVersions(currentFlow.value.id) } catch { /* */ }
}

onMounted(() => {
  loadModelCodes()
  loadEntryCodes()
})
</script>

<style scoped>
.page-container { padding: 24px; }
.muted { color: var(--color-text-tertiary, #999); font-size: 12px; }
</style>
