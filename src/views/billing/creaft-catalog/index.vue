<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 目录</h2>
      <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate">
        新增目录行
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="一张表按类型分四类，各自被不同接口读；下发侧只读「启用」的行，停用等于该项不存在。"
    />

    <a-alert
      v-if="typeFilter === 'AVG_DURATION' && !rows.length && !loading"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="平均耗时一行都没有：GET /api/v1/features/task-avg-duration/{taskType} 此时对任何取值都返回 4001「资源不存在」，前端容易误判成「值传错了」。目录键填任务类型码（与能力清单里的能力码一致）。"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="typeFilter"
          :options="typeFilterOptions"
          style="width: 240px"
          @change="loadList"
        />
        <a-input
          v-model:value="keyFilter"
          placeholder="按目录键过滤"
          allow-clear
          style="width: 240px"
          @press-enter="loadList"
          @change="onKeyFilterChange"
        />
        <span class="muted">{{ typeHint }}</span>
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
          <a-empty description="暂无目录行" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'catalogKey'">
            <code class="route-code">{{ record.catalogKey }}</code>
            <div v-if="record.title" class="muted">{{ record.title }}</div>
          </template>

          <template v-if="column.dataIndex === 'value'">
            <span v-if="record.catalogType === 'AVG_DURATION'">
              {{ record.avgSeconds ?? '-' }} 秒
            </span>
            <span v-else-if="record.catalogType === 'BIZ_POINT'">
              {{ record.pointPrice ?? '-' }} 点
            </span>
            <span v-else-if="record.catalogType === 'MODEL_CONFIG'">
              modelType={{ record.modelType ?? '-' }}
            </span>
            <span v-else class="muted">{{ record.category || '-' }}</span>
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
                title="删除后对应接口立刻不再下发该项，确认删除？"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editId ? '编辑目录行' : '新增目录行'"
      :confirm-loading="saving"
      width="620px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="目录类型" required>
          <a-select v-model:value="form.catalogType" :options="typeOptions" />
          <div class="muted">{{ typeDescription(form.catalogType) }}</div>
        </a-form-item>
        <a-form-item label="目录键" required>
          <a-input v-model:value="form.catalogKey" :placeholder="keyPlaceholder" />
        </a-form-item>

        <a-form-item v-if="form.catalogType === 'AVG_DURATION'" label="平均耗时（秒）" required>
          <a-input-number v-model:value="form.avgSeconds" :min="0" style="width: 100%" />
          <div class="muted">历史统计均值，前端只用它做进度提示，不是本次任务的预测。</div>
        </a-form-item>
        <a-form-item v-if="form.catalogType === 'BIZ_POINT'" label="点数">
          <a-input-number v-model:value="form.pointPrice" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item v-if="form.catalogType === 'MODEL_CONFIG'" label="模型类型">
          <a-input-number v-model:value="form.modelType" style="width: 100%" />
        </a-form-item>
        <a-form-item v-if="form.catalogType === 'FEATURE'" label="分组">
          <a-input v-model:value="form.category" placeholder="能力清单按它分组" />
        </a-form-item>

        <a-form-item label="展示标题">
          <a-input v-model:value="form.title" />
        </a-form-item>
        <a-form-item label="附加载荷">
          <a-textarea
            v-model:value="form.payloadJson"
            :rows="3"
            placeholder="原样下发的 JSON 文本"
          />
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="form.sortOrder" style="width: 100%" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="enabled" />
          <span class="muted" style="margin-left: 8px">停用的行不会被下发接口读到</span>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { computed, reactive, ref } from 'vue'
import {
  createCreaftCatalog,
  deleteCreaftCatalog,
  getCreaftCatalog,
  updateCreaftCatalog,
  type CreaftCatalogRow,
  type CreaftCatalogType,
} from '@/api/creaft-compat'

const rows = ref<CreaftCatalogRow[]>([])
const loading = ref(false)
/** 默认落在平均耗时：仓库里没有任何迁移种过它，它是最常见的"接口回 4001"来源 */
const typeFilter = ref<'' | CreaftCatalogType>('AVG_DURATION')
const keyFilter = ref('')

const typeOptions: { label: string; value: CreaftCatalogType }[] = [
  { label: '平均耗时 AVG_DURATION', value: 'AVG_DURATION' },
  { label: '能力清单 FEATURE', value: 'FEATURE' },
  { label: '模型可选项 MODEL_CONFIG', value: 'MODEL_CONFIG' },
  { label: '业务点数 BIZ_POINT', value: 'BIZ_POINT' },
]
const typeFilterOptions = [{ label: '全部类型', value: '' }, ...typeOptions]

const DESCRIPTIONS: Record<CreaftCatalogType, string> = {
  AVG_DURATION:
    '被 GET /api/v1/features/task-avg-duration/{taskType} 读：目录键就是 URL 上的 taskType，值取平均耗时。',
  FEATURE: '被 GET /api/v2/features 读：按分组给标题。',
  MODEL_CONFIG: '模型可选项，按模型类型过滤。',
  BIZ_POINT: '业务点数表，取目录键 + 点数 + 附加载荷。',
}

function typeDescription(type: CreaftCatalogType) {
  return DESCRIPTIONS[type]
}
const typeHint = computed(() => (typeFilter.value ? DESCRIPTIONS[typeFilter.value] : ''))
const keyPlaceholder = computed(() =>
  form.catalogType === 'AVG_DURATION' ? '任务类型码，例如 ai-image-generator' : '目录键',
)

const columns = [
  { title: '类型', dataIndex: 'catalogType', width: 170 },
  { title: '目录键', dataIndex: 'catalogKey', width: 280 },
  { title: '取值', dataIndex: 'value', width: 160 },
  { title: '排序', dataIndex: 'sortOrder', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 140, align: 'center' as const },
]

let keyFilterTimer: ReturnType<typeof setTimeout> | undefined
function onKeyFilterChange() {
  clearTimeout(keyFilterTimer)
  keyFilterTimer = setTimeout(loadList, 300)
}

async function loadList() {
  loading.value = true
  try {
    rows.value =
      (await getCreaftCatalog({
        catalogType: typeFilter.value || undefined,
        catalogKey: keyFilter.value.trim() || undefined,
      })) || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
loadList()

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)

const form = reactive({
  catalogType: 'AVG_DURATION' as CreaftCatalogType,
  catalogKey: '',
  category: '',
  title: '',
  modelType: undefined as number | undefined,
  pointPrice: undefined as number | undefined,
  avgSeconds: undefined as number | undefined,
  payloadJson: '',
  sortOrder: 0,
  status: 1,
})

const enabled = computed({
  get: () => form.status === 1,
  set: (value: boolean) => (form.status = value ? 1 : 0),
})

function reset(type: CreaftCatalogType) {
  Object.assign(form, {
    catalogType: type,
    catalogKey: '',
    category: '',
    title: '',
    modelType: undefined,
    pointPrice: undefined,
    avgSeconds: undefined,
    payloadJson: '',
    sortOrder: 0,
    status: 1,
  })
}

function openCreate() {
  editId.value = null
  reset(typeFilter.value || 'AVG_DURATION')
  modalVisible.value = true
}

function openEdit(record: CreaftCatalogRow) {
  editId.value = record.id
  Object.assign(form, {
    catalogType: record.catalogType,
    catalogKey: record.catalogKey,
    category: record.category || '',
    title: record.title || '',
    modelType: record.modelType ?? undefined,
    pointPrice: record.pointPrice ?? undefined,
    avgSeconds: record.avgSeconds ?? undefined,
    payloadJson: record.payloadJson || '',
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.catalogKey.trim()) {
    message.warning('目录键必填')
    return
  }
  if (form.catalogType === 'AVG_DURATION' && form.avgSeconds == null) {
    message.warning('平均耗时必填，否则这一行读出来没有值')
    return
  }
  saving.value = true
  try {
    const payload = {
      catalogType: form.catalogType,
      catalogKey: form.catalogKey.trim(),
      category: form.category || undefined,
      title: form.title || undefined,
      modelType: form.modelType ?? null,
      pointPrice: form.pointPrice ?? null,
      avgSeconds: form.avgSeconds ?? null,
      payloadJson: form.payloadJson || undefined,
      sortOrder: form.sortOrder ?? 0,
      status: form.status,
    }
    if (editId.value) await updateCreaftCatalog(editId.value, payload)
    else await createCreaftCatalog(payload)
    message.success('已保存')
    modalVisible.value = false
    loadList()
  } catch {
    /* 同类型下目录键重复由后端拒绝，原因由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: CreaftCatalogRow) {
  try {
    await deleteCreaftCatalog(record.id)
    message.success('已删除')
    loadList()
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
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  /* 描边让 chip 在浅色下（#fafafa 贴着 #fff）也有边界；暗色下是 #303030 的柔和边 */
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
</style>
