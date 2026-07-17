<template>
  <div class="meta-page">
    <a-tabs v-model:active-key="tab">
      <!-- 分类：树形 -->
      <a-tab-pane key="category" tab="分类">
        <div class="tab-toolbar">
          <span class="tab-desc">给提示词归类的树形目录（父分类 0=根）。</span>
          <a-button type="primary" size="small" @click="openCat()">＋ 新建分类</a-button>
        </div>
        <a-table
          :columns="catColumns"
          :data-source="categoryTree"
          :loading="loading.category"
          :pagination="false"
          row-key="id"
          size="small"
          default-expand-all-rows
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'status'">
              <a-badge :status="record.status === 1 ? 'success' : 'default'" :text="record.status === 1 ? '启用' : '停用'" />
            </template>
            <template v-if="column.key === 'op'">
              <a-button type="link" size="small" @click="openCat(record)">编辑</a-button>
              <a-popconfirm title="删除分类？" @confirm="removeCat(record.id)"><a-button type="link" size="small" danger>删除</a-button></a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- 插槽库：卡片网格 -->
      <a-tab-pane key="slot" tab="插槽库">
        <div class="tab-toolbar">
          <span class="tab-desc">可复用的「填空组件」，正文里用 <code>{{ BRACE }}</code> 占位。</span>
          <a-button type="primary" size="small" @click="openSlot()">＋ 新建插槽</a-button>
        </div>
        <a-empty v-if="!slots.length" description="暂无插槽" />
        <a-row v-else :gutter="[12, 12]">
          <a-col v-for="s in slots" :key="s.id" :span="6">
            <div class="grid-card">
              <div class="gc-head">
                <a-tag :color="slotColor(s.slotType)">{{ s.slotType }}</a-tag>
                <span class="gc-key">{{ wrapKey(s.slotKey) }}</span>
                <a-badge :status="s.status === 1 ? 'success' : 'default'" />
              </div>
              <div class="gc-label">{{ s.label || '（无标签）' }}</div>
              <div class="gc-meta">作用域：{{ s.scope }}</div>
              <div class="gc-actions">
                <a-button type="link" size="small" @click="openSlot(s)">编辑</a-button>
                <a-popconfirm title="删除插槽？" @confirm="removeSlot(s.id)"><a-button type="link" size="small" danger>删除</a-button></a-popconfirm>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-tab-pane>

      <!-- 变量库 / 安全块：卡片网格 -->
      <a-tab-pane key="variable" tab="变量库 / 安全块">
        <div class="tab-toolbar">
          <span class="tab-desc">可复用变量，正文里用 <code>{{ BRACE }}</code> 引用；类型 <b>block</b> 即整段安全块（合规文本）。</span>
          <a-button type="primary" size="small" @click="openVar()">＋ 新建变量</a-button>
        </div>
        <a-empty v-if="!variables.length" description="暂无变量" />
        <a-row v-else :gutter="[12, 12]">
          <a-col v-for="v in variables" :key="v.id" :span="8">
            <div class="grid-card" :class="{ 'is-block': v.varType === 'block' }">
              <div class="gc-head">
                <a-tag :color="varColor(v.varType)">{{ v.varType === 'block' ? '🛡 安全块' : v.varType }}</a-tag>
                <span class="gc-key">{{ wrapKey(v.varKey) }}</span>
                <a-badge :status="v.status === 1 ? 'success' : 'default'" />
              </div>
              <div class="gc-label">{{ v.name || '（无名称）' }}</div>
              <div class="gc-value">{{ preview(v.varValue) }}</div>
              <div class="gc-meta">作用域：{{ v.scope }}</div>
              <div class="gc-actions">
                <a-button type="link" size="small" @click="openVar(v)">编辑</a-button>
                <a-popconfirm title="删除变量？" @confirm="removeVar(v.id)"><a-button type="link" size="small" danger>删除</a-button></a-popconfirm>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-tab-pane>

      <!-- 筛选方案：卡片网格 -->
      <a-tab-pane key="filter" tab="筛选方案">
        <div class="tab-toolbar">
          <span class="tab-desc">保存常用筛选项与选项，供列表页快捷筛选。</span>
          <a-button type="primary" size="small" @click="openFilter()">＋ 新建筛选</a-button>
        </div>
        <a-empty v-if="!filters.length" description="暂无筛选方案" />
        <a-row v-else :gutter="[12, 12]">
          <a-col v-for="f in filters" :key="f.filterId" :span="8">
            <div class="grid-card">
              <div class="gc-head">
                <a-tag color="blue">{{ f.filter.filterType }}</a-tag>
                <span class="gc-key">{{ f.filter.name }}</span>
                <a-badge :status="f.filter.status === 1 ? 'success' : 'default'" />
              </div>
              <div class="gc-meta">key：{{ f.filter.filterKey }}</div>
              <div class="gc-chips">
                <a-tag v-for="o in f.options" :key="o.id" closable @close="removeOption(o.id)">{{ o.label }}={{ o.value }}</a-tag>
                <a-button type="link" size="small" @click="openOption(f.filter.id)">＋ 选项</a-button>
              </div>
              <div class="gc-actions">
                <a-button type="link" size="small" @click="openFilter(f.filter)">编辑</a-button>
                <a-popconfirm title="删除筛选方案？" @confirm="removeFilter(f.filter.id)"><a-button type="link" size="small" danger>删除</a-button></a-popconfirm>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-tab-pane>
    </a-tabs>

    <!-- 分类弹窗 -->
    <a-modal v-model:open="catModal.open" :title="catModal.id ? '编辑分类' : '新建分类'" @ok="submitCat">
      <a-form layout="vertical">
        <a-form-item label="名称" required><a-input v-model:value="catModal.form.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model:value="catModal.form.code" /></a-form-item>
        <a-form-item label="父分类ID（0=根）"><a-input-number v-model:value="catModal.form.parentId" :min="0" style="width:100%" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="catModal.form.sortOrder" :min="0" style="width:100%" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 插槽弹窗 -->
    <a-modal v-model:open="slotModal.open" :title="slotModal.id ? '编辑插槽' : '新建插槽'" @ok="submitSlot">
      <a-form layout="vertical">
        <a-form-item label="Key" required><a-input v-model:value="slotModal.form.slotKey" /></a-form-item>
        <a-form-item label="类型"><a-select v-model:value="slotModal.form.slotType" :options="slotTypeOptions" /></a-form-item>
        <a-form-item label="标签"><a-input v-model:value="slotModal.form.label" /></a-form-item>
        <a-form-item label="配置 config (JSON)"><a-textarea v-model:value="slotModal.configText" :rows="4" /></a-form-item>
        <a-form-item label="作用域"><a-select v-model:value="slotModal.form.scope" :options="scopeOptions" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 变量弹窗 -->
    <a-modal v-model:open="varModal.open" :title="varModal.id ? '编辑变量' : '新建变量'" @ok="submitVar">
      <a-form layout="vertical">
        <a-form-item label="Key" required><a-input v-model:value="varModal.form.varKey" /></a-form-item>
        <a-form-item label="名称"><a-input v-model:value="varModal.form.name" /></a-form-item>
        <a-form-item label="类型"><a-select v-model:value="varModal.form.varType" :options="varTypeOptions" /></a-form-item>
        <a-form-item label="值 / 默认值（block 类型存整段文本，如安全块）">
          <a-textarea v-model:value="varModal.form.varValue" :rows="4" />
        </a-form-item>
        <a-form-item v-if="varModal.form.varType === 'enum'" label="枚举选项 options (JSON)">
          <a-textarea v-model:value="varModal.optionsText" :rows="3" />
        </a-form-item>
        <a-form-item label="描述"><a-input v-model:value="varModal.form.description" /></a-form-item>
        <a-form-item label="作用域"><a-select v-model:value="varModal.form.scope" :options="scopeOptions" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 筛选弹窗 -->
    <a-modal v-model:open="filterModal.open" :title="filterModal.id ? '编辑筛选' : '新建筛选'" @ok="submitFilter">
      <a-form layout="vertical">
        <a-form-item label="Key" required><a-input v-model:value="filterModal.form.filterKey" /></a-form-item>
        <a-form-item label="名称" required><a-input v-model:value="filterModal.form.name" /></a-form-item>
        <a-form-item label="类型"><a-select v-model:value="filterModal.form.filterType" :options="filterTypeOptions" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="filterModal.form.sortOrder" :min="0" style="width:100%" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 选项弹窗 -->
    <a-modal v-model:open="optionModal.open" title="新增选项" @ok="submitOption">
      <a-form layout="vertical">
        <a-form-item label="展示文本" required><a-input v-model:value="optionModal.label" /></a-form-item>
        <a-form-item label="值" required><a-input v-model:value="optionModal.value" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'antdv-next'
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listSlots, createSlot, updateSlot, deleteSlot,
  listVariables, createVariable, updateVariable, deleteVariable,
  listFilters, createFilter, updateFilter, deleteFilter, addFilterOption, deleteFilterOption,
  type PromptCategory, type PromptSlotDef, type PromptVariableDef, type PromptFilterDef, type PromptFilterVO,
} from '@/api/prompt-lab'

const tab = ref('category')
const loading = reactive({ category: false, slot: false, variable: false, filter: false })

const slotTypeOptions = ['text', 'select', 'chip', 'image', 'number', 'separator'].map((v) => ({ label: v, value: v }))
const varTypeOptions = ['text', 'enum', 'block'].map((v) => ({ label: v, value: v }))
const filterTypeOptions = ['select', 'multi'].map((v) => ({ label: v, value: v }))
const scopeOptions = ['global', 'prompt'].map((v) => ({ label: v, value: v }))

function slotColor(t?: string) {
  return ({ text: 'blue', select: 'green', chip: 'orange', image: 'purple', number: 'cyan', separator: 'gold' } as Record<string, string>)[t || ''] || 'default'
}
function varColor(t?: string) {
  return ({ text: 'blue', enum: 'green', block: 'gold' } as Record<string, string>)[t || ''] || 'default'
}
function preview(v?: string) {
  if (!v) return '（空）'
  return v.length > 60 ? v.slice(0, 60) + '…' : v
}
// 花括号示例/包裹（避免在模板 mustache 内写字面 {{ 触发编译错误）
const BRACE = '{{key}}'
function wrapKey(k?: string) {
  return '{{' + (k ?? '') + '}}'
}

// ===== 分类 =====
const categories = ref<PromptCategory[]>([])
const categoryTree = computed(() => {
  const map = new Map<number, PromptCategory & { children?: PromptCategory[] }>()
  categories.value.forEach((c) => map.set(c.id, { ...c, children: [] }))
  const roots: (PromptCategory & { children?: PromptCategory[] })[] = []
  map.forEach((node) => {
    const parent = node.parentId && map.get(node.parentId)
    if (parent) parent.children!.push(node)
    else roots.push(node)
  })
  // 清掉空 children，避免展开箭头空占位
  map.forEach((n) => {
    if (n.children && !n.children.length) delete n.children
  })
  return roots
})
const catColumns = [
  { title: '名称', dataIndex: 'name' },
  { title: '编码', dataIndex: 'code', width: 160 },
  { title: '排序', dataIndex: 'sortOrder', width: 80 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '操作', key: 'op', width: 140 },
]
const catModal = reactive<{ open: boolean; id?: number; form: Partial<PromptCategory> }>({ open: false, form: {} })
async function loadCategories() {
  loading.category = true
  try { categories.value = await listCategories() } catch { /* */ } finally { loading.category = false }
}
function openCat(record?: PromptCategory) {
  catModal.id = record?.id
  catModal.form = record ? { ...record } : { parentId: 0, sortOrder: 0, status: 1 }
  catModal.open = true
}
async function submitCat() {
  if (!catModal.form.name) { message.warning('请填写名称'); return }
  try {
    if (catModal.id) await updateCategory(catModal.id, catModal.form)
    else await createCategory(catModal.form)
    message.success('已保存'); catModal.open = false; loadCategories()
  } catch { /* */ }
}
async function removeCat(id: number) { try { await deleteCategory(id); message.success('已删除'); loadCategories() } catch { /* */ } }

// ===== 插槽 =====
const slots = ref<PromptSlotDef[]>([])
const slotModal = reactive<{ open: boolean; id?: number; form: Partial<PromptSlotDef>; configText: string }>({ open: false, form: {}, configText: '' })
async function loadSlots() { loading.slot = true; try { slots.value = await listSlots() } catch { /* */ } finally { loading.slot = false } }
function openSlot(record?: PromptSlotDef) {
  slotModal.id = record?.id
  slotModal.form = record ? { ...record } : { slotType: 'text', scope: 'global', status: 1 }
  slotModal.configText = record?.config ? JSON.stringify(record.config, null, 2) : ''
  slotModal.open = true
}
async function submitSlot() {
  if (!slotModal.form.slotKey) { message.warning('请填写 key'); return }
  const payload: Partial<PromptSlotDef> = { ...slotModal.form }
  if (slotModal.configText.trim()) {
    try { payload.config = JSON.parse(slotModal.configText) } catch { message.error('config 不是合法 JSON'); return }
  }
  try {
    if (slotModal.id) await updateSlot(slotModal.id, payload)
    else await createSlot(payload)
    message.success('已保存'); slotModal.open = false; loadSlots()
  } catch { /* */ }
}
async function removeSlot(id: number) { try { await deleteSlot(id); message.success('已删除'); loadSlots() } catch { /* */ } }

// ===== 变量 =====
const variables = ref<PromptVariableDef[]>([])
const varModal = reactive<{ open: boolean; id?: number; form: Partial<PromptVariableDef>; optionsText: string }>({ open: false, form: {}, optionsText: '' })
async function loadVariables() { loading.variable = true; try { variables.value = await listVariables() } catch { /* */ } finally { loading.variable = false } }
function openVar(record?: PromptVariableDef) {
  varModal.id = record?.id
  varModal.form = record ? { ...record } : { varType: 'text', scope: 'global', status: 1 }
  varModal.optionsText = record?.options ? JSON.stringify(record.options, null, 2) : ''
  varModal.open = true
}
async function submitVar() {
  if (!varModal.form.varKey) { message.warning('请填写 key'); return }
  const payload: Partial<PromptVariableDef> = { ...varModal.form }
  if (varModal.form.varType === 'enum' && varModal.optionsText.trim()) {
    try { payload.options = JSON.parse(varModal.optionsText) } catch { message.error('options 不是合法 JSON'); return }
  }
  try {
    if (varModal.id) await updateVariable(varModal.id, payload)
    else await createVariable(payload)
    message.success('已保存'); varModal.open = false; loadVariables()
  } catch { /* */ }
}
async function removeVar(id: number) { try { await deleteVariable(id); message.success('已删除'); loadVariables() } catch { /* */ } }

// ===== 筛选 =====
const filters = ref<(PromptFilterVO & { filterId: number })[]>([])
const filterModal = reactive<{ open: boolean; id?: number; form: Partial<PromptFilterDef> }>({ open: false, form: {} })
const optionModal = reactive<{ open: boolean; filterId?: number; label: string; value: string }>({ open: false, label: '', value: '' })
async function loadFilters() {
  loading.filter = true
  try {
    const list = await listFilters()
    filters.value = (list || []).map((f) => ({ ...f, filterId: f.filter.id }))
  } catch { /* */ } finally { loading.filter = false }
}
function openFilter(record?: PromptFilterDef) {
  filterModal.id = record?.id
  filterModal.form = record ? { ...record } : { filterType: 'select', sortOrder: 0, status: 1 }
  filterModal.open = true
}
async function submitFilter() {
  if (!filterModal.form.filterKey || !filterModal.form.name) { message.warning('请填写 key 和名称'); return }
  try {
    if (filterModal.id) await updateFilter(filterModal.id, filterModal.form)
    else await createFilter(filterModal.form)
    message.success('已保存'); filterModal.open = false; loadFilters()
  } catch { /* */ }
}
async function removeFilter(id: number) { try { await deleteFilter(id); message.success('已删除'); loadFilters() } catch { /* */ } }
function openOption(filterId: number) { optionModal.filterId = filterId; optionModal.label = ''; optionModal.value = ''; optionModal.open = true }
async function submitOption() {
  if (!optionModal.filterId || !optionModal.label || !optionModal.value) { message.warning('请填写选项'); return }
  try {
    await addFilterOption(optionModal.filterId, { label: optionModal.label, value: optionModal.value })
    message.success('已添加'); optionModal.open = false; loadFilters()
  } catch { /* */ }
}
async function removeOption(id: number) { try { await deleteFilterOption(id); message.success('已删除'); loadFilters() } catch { /* */ } }

onMounted(() => {
  loadCategories(); loadSlots(); loadVariables(); loadFilters()
})
</script>

<style scoped>
.meta-page {
  padding: 24px;
}
.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.tab-desc {
  font-size: 12px;
  color: var(--color-text-secondary, #888);
}
.tab-desc code {
  padding: 1px 5px;
  background: var(--color-bg-layout, #f5f5f5);
  border-radius: 4px;
}
.grid-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  padding: 12px;
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: 8px;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.grid-card:hover {
  border-color: var(--color-primary, #1677ff);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}
.grid-card.is-block {
  background: linear-gradient(180deg, rgba(250, 173, 20, 0.06), transparent);
  border-color: rgba(250, 173, 20, 0.4);
}
.gc-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gc-key {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gc-label {
  font-size: 13px;
}
.gc-value {
  font-size: 12px;
  color: var(--color-text-secondary, #888);
  max-height: 44px;
  overflow: hidden;
  word-break: break-word;
}
.gc-meta {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
}
.gc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.gc-actions {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px dashed var(--color-border, #f0f0f0);
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}
</style>
