<template>
  <div class="page-container">
    <ProTable ref="tableRef" :columns="columns" :request="loadData" :search="{}" row-key="id">
      <template #emptyText>
        <a-empty description="暂无节点，点「新建节点」创建" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="openCreate">新建节点</a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'kind'">
          <a-tag :color="kindColor(record.kind)" :title="record.kind">{{ stepKindLabel(record.kind) }}</a-tag>
        </template>
        <template v-if="column.dataIndex === 'formSchema'">
          <a-tag v-if="record.formSchema" color="cyan">已配置</a-tag>
          <span v-else class="muted">无</span>
        </template>
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
        </template>
        <template v-if="column.key === 'op'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm title="删除该节点？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- 创建/编辑 -->
    <a-modal v-model:open="modalOpen" :title="editId ? '编辑节点' : '新建节点'" :confirm-loading="saving" width="640px" @ok="submit">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="节点编码 Code" required>
              <a-input v-model:value="form.code" :disabled="!!editId" placeholder="如 image_gen_103 / hitVideoStoryboard / t2v" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="名称" required><a-input v-model:value="form.name" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="类型 Kind"><a-select v-model:value="form.kind" :options="kindOptions" /></a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Mode 号（AIGC 步）">
              <a-select
                v-model:value="form.mode"
                :options="metaModes.map((m) => ({ label: String(m), value: m }))"
                allow-clear
                show-search
                placeholder="选择已注册 Mode 号"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Handler（LOCAL 步）">
              <a-select
                v-model:value="form.handler"
                :options="metaHandlers.map((h) => ({ label: h, value: h }))"
                allow-clear
                show-search
                option-filter-prop="label"
                placeholder="选择已注册 Handler"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="排序"><a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="启用">
              <a-switch v-model:checked="enabledChecked" checked-children="启用" un-checked-children="停用" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 12px"
          message="计费类型（BILLED/COST_ONLY）随计费场景，在 Mode 流的步骤上配置，不属节点定义——节点保持可跨流复用。"
        />
        <a-form-item label="描述"><a-textarea v-model:value="form.description" :rows="2" /></a-form-item>
        <a-form-item label="节点输入表单（form-create JSON）">
          <div class="schema-bar">
            <a-button type="primary" ghost size="small" @click="openDesigner">可视化设计表单</a-button>
            <a-button size="small" @click="openPreview">预览表单</a-button>
            <a-button size="small" @click="openJsonGen">粘贴入参JSON生成</a-button>
            <span class="muted">拖拽设计后自动写回下方 JSON。</span>
          </div>
          <a-textarea v-model:value="formSchemaText" :rows="5" placeholder='{"rule":[],"option":{}}' />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 粘贴入参 JSON → 自动生成表单（字段名与入参一致） -->
    <a-modal v-model:open="jsonGenOpen" title="粘贴入参 JSON → 自动生成表单（字段名一致）" width="560px" :ok-text="genOkText" @ok="genFormFromJson">
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 8px"
        message="粘贴一段真实入参（locals/params）JSON：每个键生成一个同名字段，类型按值自动推断（数字/布尔/文本/数组），避免手工设计字段名与实际入参对不上。生成会用本次 JSON 整体覆盖下方表单，可反复重贴重生成。"
      />
      <a-textarea v-model:value="jsonGenText" :rows="8" placeholder='粘贴形如 {"buyPoint":"夏季连衣裙","aspectRatio":"9:16","duration":32} 的入参对象' />
      <div style="margin-top: 8px; text-align: right">
        <a-button size="small" @click="jsonGenText = ''">清空输入</a-button>
      </div>
    </a-modal>

    <!-- 可视化表单设计器 -->
    <a-drawer v-model:open="designerOpen" title="表单可视化设计" width="90%" :body-style="{ padding: 0 }">
      <template #extra>
        <a-space>
          <a-button @click="designerOpen = false">取消</a-button>
          <a-button type="primary" @click="applyDesigner">应用到表单 JSON</a-button>
        </a-space>
      </template>
      <component :is="'fc-designer'" ref="designerRef" style="height: calc(100vh - 108px)" />
    </a-drawer>

    <!-- 表单预览（form-create 渲染器） -->
    <a-drawer v-model:open="previewOpen" title="表单预览（form-create 渲染）" width="520">
      <a-alert type="info" show-icon style="margin-bottom: 12px" message="测试/提交时即用此渲染节点表单收集 locals 输入。" />
      <a-empty v-if="!previewRule.length" description="无表单可预览" />
      <component v-else :is="'form-create'" :rule="previewRule" :option="previewOption" />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { message } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import { pageModes, createMode, updateMode, deleteMode, getModeMeta, type Mode, type ModeSaveReq } from '@/api/mode'
import { stepKindLabel } from '@/utils/terms'

const tableRef = ref<InstanceType<typeof ProTable>>()

const kindOptions = ['LOCAL', 'AIGC', 'VOLC', 'GENERATION'].map((v) => ({ label: `${stepKindLabel(v)}（${v}）`, value: v }))
function kindColor(k?: string) {
  return ({ LOCAL: 'blue', AIGC: 'green', VOLC: 'gold', GENERATION: 'purple' } as Record<string, string>)[k || ''] || 'default'
}

const columns = [
  { title: '编码', dataIndex: 'code', width: 200, ellipsis: true, search: true, searchType: 'input' as const },
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true },
  { title: '类型', dataIndex: 'kind', width: 120, search: true, searchType: 'select' as const, searchOptions: kindOptions },
  { title: 'Mode', dataIndex: 'mode', width: 80, align: 'center' as const },
  { title: 'Handler', dataIndex: 'handler', width: 160, ellipsis: true },
  { title: '表单', dataIndex: 'formSchema', width: 90, align: 'center' as const },
  { title: '启用', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'op', key: 'op', width: 140, align: 'center' as const, fixed: 'right' as const },
]

async function loadData(params: Record<string, unknown>) {
  const res = await pageModes({
    keyword: params.code as string | undefined,
    kind: params.kind as string | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return { data: res.list || [], total: res.total || 0, success: true }
}

// 表单
const modalOpen = ref(false)
const saving = ref(false)
const editId = ref<number>()
const form = reactive<ModeSaveReq>({
  code: '',
  name: '',
  kind: 'AIGC',
  mode: undefined,
  handler: '',
  sortOrder: 0,
  status: 1,
  description: '',
})
const formSchemaText = ref('')
const enabledChecked = computed({
  get: () => form.status === 1,
  set: (v: boolean) => (form.status = v ? 1 : 0),
})

// 元数据下拉（从代码/计费配置读取，免翻代码）
const metaHandlers = ref<string[]>([])
const metaModes = ref<number[]>([])
onMounted(async () => {
  try {
    const meta = await getModeMeta()
    metaHandlers.value = meta.handlers || []
    metaModes.value = meta.modes || []
  } catch {
    /* 拦截器已提示；下拉为空时仍可手填 */
  }
})

// 粘贴入参 JSON → 自动生成表单（字段名与入参一致）
const jsonGenOpen = ref(false)
const jsonGenText = ref('')
function openJsonGen() {
  jsonGenText.value = '' // 每次打开清空，便于重新粘贴重生成
  jsonGenOpen.value = true
}
// 已有表单数据→重新生成（覆盖）；无→立即生成
const genOkText = computed(() => (formSchemaText.value.trim() ? '重新生成' : '立即生成'))
function genFormFromJson() {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(jsonGenText.value)
  } catch {
    message.error('JSON 解析失败，请检查格式')
    return
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    message.error('请粘贴一个 JSON 对象（键值对）')
    return
  }
  const rule = Object.entries(obj).map(([key, val]) => {
    const base = { field: key, title: key }
    if (typeof val === 'number') return { ...base, type: 'inputNumber', value: val }
    if (typeof val === 'boolean') return { ...base, type: 'switch', value: val }
    if (Array.isArray(val) || (val !== null && typeof val === 'object'))
      return { ...base, type: 'input', props: { type: 'textarea' }, value: JSON.stringify(val) }
    return { ...base, type: 'input', value: (val as string) ?? '' }
  })
  // label 置顶独占一行（ant 的 layout:vertical）：字段名长度不定（entryCode/optimizeImageUrls…），避免被默认窄 label 宽度截断
  formSchemaText.value = JSON.stringify({ rule, option: { form: { layout: 'vertical' } } }, null, 2)
  jsonGenOpen.value = false
  message.success(`已生成 ${rule.length} 个字段（字段名与入参一致），可再用可视化设计器微调`)
}

function resetForm() {
  Object.assign(form, {
    code: '',
    name: '',
    kind: 'AIGC',
    mode: undefined,
    handler: '',
    defaultCostType: 'COST_ONLY',
    sortOrder: 0,
    status: 1,
    description: '',
  })
  formSchemaText.value = ''
}
function openCreate() {
  editId.value = undefined
  resetForm()
  modalOpen.value = true
}
function openEdit(record: Mode) {
  editId.value = record.id
  Object.assign(form, {
    code: record.code,
    name: record.name,
    kind: record.kind,
    mode: record.mode ?? undefined,
    handler: record.handler || '',
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
    description: record.description || '',
  })
  formSchemaText.value = record.formSchema ? JSON.stringify(record.formSchema, null, 2) : ''
  modalOpen.value = true
}

async function submit() {
  if (!form.code?.trim() || !form.name?.trim()) {
    message.warning('请填写编码与名称')
    return
  }
  let formSchema: unknown = undefined
  if (formSchemaText.value.trim()) {
    try {
      formSchema = JSON.parse(formSchemaText.value)
    } catch {
      message.error('表单 JSON 不合法')
      return
    }
  }
  const payload: ModeSaveReq = { ...form, formSchema }
  saving.value = true
  try {
    if (editId.value) await updateMode(editId.value, payload)
    else await createMode(payload)
    message.success('已保存')
    modalOpen.value = false
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: Mode) {
  try {
    await deleteMode(record.id)
    message.success('已删除')
    tableRef.value?.refresh()
  } catch {
    /* 拦截器已提示 */
  }
}

// 可视化设计器
const designerOpen = ref(false)
const designerRef = ref<any>()
function openDesigner() {
  designerOpen.value = true
  nextTick(() => {
    let rule: unknown[] = []
    let option: Record<string, unknown> = {}
    if (formSchemaText.value.trim()) {
      try {
        const parsed = JSON.parse(formSchemaText.value)
        rule = parsed.rule || parsed || []
        option = parsed.option || {}
      } catch {
        /* 忽略脏 JSON */
      }
    }
    try {
      designerRef.value?.setRule?.(rule)
      designerRef.value?.setOption?.(option)
    } catch {
      /* 忽略 */
    }
  })
}
function applyDesigner() {
  try {
    const rule = designerRef.value?.getRule?.() ?? []
    const option = designerRef.value?.getOption?.() ?? {}
    formSchemaText.value = JSON.stringify({ rule, option }, null, 2)
    designerOpen.value = false
    message.success('已应用到表单 JSON')
  } catch {
    message.error('读取设计结果失败')
  }
}

// 表单预览（form-create 渲染器）
const previewOpen = ref(false)
const previewRule = ref<unknown[]>([])
const previewOption = ref<Record<string, unknown>>({})
function openPreview() {
  let rule: unknown[] = []
  let option: Record<string, unknown> = {}
  if (formSchemaText.value.trim()) {
    try {
      const parsed = JSON.parse(formSchemaText.value)
      rule = parsed.rule || parsed || []
      option = parsed.option || {}
    } catch {
      message.error('表单 JSON 不合法')
      return
    }
  }
  previewRule.value = Array.isArray(rule) ? rule : []
  // 默认 label 置顶独占一行（ant layout:vertical），避免长字段名被截断；已显式设 layout/labelWidth/labelCol 则尊重原设置
  const formOpt = (option.form as Record<string, unknown> | undefined) || {}
  if (formOpt.layout == null && formOpt.labelWidth == null && formOpt.labelCol == null) {
    option = { ...option, form: { ...formOpt, layout: 'vertical' } }
  }
  previewOption.value = option
  previewOpen.value = true
}
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.schema-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
