<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 公共模板</h2>
      <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate">
        新增模板
      </a-button>
    </div>

    <a-alert type="info" show-icon style="margin-bottom: 12px" :message="typeHint" />

    <a-alert
      v-if="!loading && !rows.length"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="这一类一条模板都没有：对应的用户端接口会正常回 200 + 空分页信封，调用方分不清「还没铺数据」和「接口没通」。创意广场空着时，端上的「做同款」「热门模板」整块是空白页。"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="typeFilter"
          :options="typeFilterOptions"
          style="width: 260px"
          @change="onTypeChange"
        />
        <a-select
          v-model:value="categoryFilter"
          :options="categoryFilterOptions"
          style="width: 200px"
          @change="loadList"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按标题过滤"
          allow-clear
          style="width: 220px"
          @press-enter="loadList"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
          style="width: 140px"
          @change="loadList"
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
          <a-empty description="暂无模板" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">{{ record.title }}</div>
            <div v-if="record.description" class="muted">{{ record.description }}</div>
            <code class="route-code">#{{ record.id }}</code>
          </template>

          <template v-if="column.dataIndex === 'templateType'">
            <a-tag :color="record.templateType === 'PLAZA' ? 'blue' : 'purple'">
              {{ record.templateType === 'PLAZA' ? '创意广场' : '本地生活' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'tags'">
            <a-space v-if="record.tags?.length" :size="4" wrap>
              <a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag>
            </a-space>
            <span v-else class="muted">—</span>
          </template>

          <template v-if="column.dataIndex === 'payloadJson'">
            <a-button type="link" size="small" @click="openPayload(record)">查看载荷</a-button>
            <div v-if="hasPrompt(record)" class="muted">含提示词（不下发给端侧）</div>
          </template>

          <template v-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled === 1 ? 'green' : 'default'">
              {{ record.enabled === 1 ? '启用' : '停用' }}
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
                title="删除后该模板立刻从用户端列表消失。只想临时下架请改成「停用」。确认删除？"
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
      :title="editId ? '编辑模板' : '新增模板'"
      :confirm-loading="saving"
      width="720px"
      @ok="handleSubmit"
    >
      <a-form :model="form" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
        <a-form-item label="模板类型" required>
          <a-select v-model:value="form.templateType" :options="typeOptions" />
          <div class="muted">{{ DESCRIPTIONS[form.templateType] }}</div>
        </a-form-item>

        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" placeholder="展示给用户的标题" />
        </a-form-item>

        <a-form-item label="分类">
          <!-- 既要能选已有分类、又要能输新的：仓库里这种场合用的是 a-auto-complete
               （select 的 combobox 模式在 antdv 4 已经去掉了） -->
          <a-auto-complete
            v-model:value="form.category"
            :options="categoryOptions"
            :filter-option="filterCategoryOption"
            allow-clear
            placeholder="从已有分类里选，或直接输入新分类"
          />
          <div v-if="form.templateType === 'LOCAL_LIFE'" class="muted warn">
            本地生活的分类要与品牌档案的行业分类<strong>字面量一致</strong>：只是同义不同字面时，
            用户端列表会恒空且不报错。
          </div>
        </a-form-item>

        <a-form-item label="描述">
          <a-input v-model:value="form.description" placeholder="选填" />
        </a-form-item>

        <a-form-item v-if="form.templateType === 'PLAZA'" label="标签">
          <a-select
            v-model:value="form.tags"
            :options="tagOptions"
            mode="tags"
            allow-clear
            placeholder="回车添加；从已有标签里选可避免同义标签分叉"
          />
          <div class="muted">
            用户端多标签筛选取<strong>并集</strong>（命中任一即返回，与 v1 一致）。
          </div>
        </a-form-item>

        <a-form-item label="模板载荷">
          <a-textarea
            v-model:value="form.payloadJson"
            :rows="8"
            placeholder='必须是 JSON 对象，例如 {"prompt":"…","imageUrls":["https://…"]}'
          />
          <div class="muted">
            提示词照常写在这里：下发时服务端会<strong>递归摘掉 prompt</strong>（与 v1 一致），
            提交任务时再按模板 id 从库里取，不会泄漏给端侧。
          </div>
        </a-form-item>

        <a-form-item label="排序">
          <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
          <div class="muted">升序：小的靠前。与 v1 的 weight 语义相反，别照那边的数字抄。</div>
        </a-form-item>

        <a-form-item label="启用">
          <a-switch v-model:checked="enabled" />
          <span class="muted" style="margin-left: 8px">停用等于该模板在用户端不存在</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="payloadVisible"
      title="模板载荷（库里原文）"
      width="720px"
      :footer="null"
    >
      <pre class="payload-view">{{ payloadText }}</pre>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { computed, reactive, ref } from 'vue'

import {
  createCreaftTemplate,
  deleteCreaftTemplate,
  getCreaftTemplateCategories,
  getCreaftTemplateTags,
  getCreaftTemplates,
  updateCreaftTemplate,
  type CreaftTemplateRow,
  type CreaftTemplateType,
} from '@/api/creaft-compat'

const DESCRIPTIONS: Record<CreaftTemplateType, string> = {
  PLAZA:
    '创意广场模板，被 GET /api/v1/plaza-templates/list 与 /plaza-templates/tags 读。标签多值取并集；列表排序就是这一页的先后。',
  LOCAL_LIFE:
    '本地生活官方模板，被 GET /api/v1/local-life-templates/list、/{id}、/categories 读，按分类筛。',
}

const rows = ref<CreaftTemplateRow[]>([])
const loading = ref(false)
/** 默认落在创意广场：阶段 6 卡的就是它（整站 0 模板 0 标签） */
const typeFilter = ref<CreaftTemplateType>('PLAZA')
const categoryFilter = ref<string>('')
const enabledFilter = ref<'' | 1 | 0>('')
const keyword = ref('')
const categories = ref<string[]>([])
const tags = ref<string[]>([])

const typeOptions: { label: string; value: CreaftTemplateType }[] = [
  { label: '创意广场 PLAZA', value: 'PLAZA' },
  { label: '本地生活 LOCAL_LIFE', value: 'LOCAL_LIFE' },
]
const typeFilterOptions = typeOptions
const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]
const categoryFilterOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...categories.value.map((c) => ({ label: c, value: c })),
])
const categoryOptions = computed(() => categories.value.map((c) => ({ label: c, value: c })))
const tagOptions = computed(() => tags.value.map((t) => ({ label: t, value: t })))
const typeHint = computed(() => DESCRIPTIONS[typeFilter.value])

function filterCategoryOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase())
}

const columns = [
  { title: '模板', dataIndex: 'title', width: 300 },
  { title: '类型', dataIndex: 'templateType', width: 110, align: 'center' as const },
  { title: '分类', dataIndex: 'category', width: 130 },
  { title: '标签', dataIndex: 'tags', width: 220 },
  { title: '载荷', dataIndex: 'payloadJson', width: 150 },
  { title: '排序', dataIndex: 'sortOrder', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'enabled', width: 90, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 140, align: 'center' as const },
]

let keywordTimer: ReturnType<typeof setTimeout> | undefined
function onKeywordChange() {
  clearTimeout(keywordTimer)
  keywordTimer = setTimeout(loadList, 300)
}

function onTypeChange() {
  // 分类是按类型分的：切类型不清掉旧筛选，会出现「明明有模板却一条不显示」
  categoryFilter.value = ''
  loadList()
  loadOptions()
}

async function loadList() {
  loading.value = true
  try {
    rows.value =
      (await getCreaftTemplates({
        templateType: typeFilter.value,
        category: categoryFilter.value || undefined,
        keyword: keyword.value.trim() || undefined,
        enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
      })) || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    categories.value = (await getCreaftTemplateCategories(typeFilter.value)) || []
    tags.value = (await getCreaftTemplateTags()) || []
  } catch {
    /* 下拉候选缺失不影响录入：两个字段都允许直接输入 */
  }
}

loadList()
loadOptions()

// ---- 载荷查看 ----
const payloadVisible = ref(false)
const payloadText = ref('')

function openPayload(record: CreaftTemplateRow) {
  payloadText.value = pretty(record.payloadJson)
  payloadVisible.value = true
}

function pretty(json: string | null) {
  if (!json) return '{}'
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    // 库里本来就可能有手工塞进去的脏值，原样显示比抛错有用
    return json
  }
}

function hasPrompt(record: CreaftTemplateRow) {
  return !!record.payloadJson && record.payloadJson.includes('"prompt"')
}

// ---- 新增 / 编辑 ----
const modalVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)

const form = reactive({
  templateType: 'PLAZA' as CreaftTemplateType,
  title: '',
  category: undefined as string | undefined,
  description: '',
  tags: [] as string[],
  payloadJson: '',
  sortOrder: 0,
  enabled: 1,
})

const enabled = computed({
  get: () => form.enabled === 1,
  set: (value: boolean) => (form.enabled = value ? 1 : 0),
})

function openCreate() {
  editId.value = null
  Object.assign(form, {
    templateType: typeFilter.value,
    title: '',
    category: undefined,
    description: '',
    tags: [],
    payloadJson: '',
    sortOrder: 0,
    enabled: 1,
  })
  modalVisible.value = true
}

function openEdit(record: CreaftTemplateRow) {
  editId.value = record.id
  Object.assign(form, {
    templateType: record.templateType,
    title: record.title,
    category: record.category || undefined,
    description: record.description || '',
    tags: [...(record.tags || [])],
    payloadJson: pretty(record.payloadJson),
    sortOrder: record.sortOrder ?? 0,
    enabled: record.enabled ?? 1,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.title.trim()) {
    message.warning('标题必填')
    return
  }
  // 后端也校验，但在这里挡一次能指出具体哪儿不是对象——服务端只会说「必须是 JSON 对象」
  if (form.payloadJson.trim()) {
    try {
      const parsed = JSON.parse(form.payloadJson)
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        message.warning('模板载荷必须是 JSON 对象（形如 {"key": ...}），数组和标量都不行')
        return
      }
    } catch {
      message.warning('模板载荷不是合法 JSON')
      return
    }
  }
  saving.value = true
  try {
    const payload = {
      templateType: form.templateType,
      title: form.title.trim(),
      category: form.category || undefined,
      description: form.description || undefined,
      // 本地生活模板没有标签维度，传空数组而不是当前表单值，免得切类型后带上残留
      tags: form.templateType === 'PLAZA' ? form.tags : [],
      payloadJson: form.payloadJson.trim() || undefined,
      sortOrder: form.sortOrder ?? 0,
      enabled: form.enabled,
    }
    if (editId.value) await updateCreaftTemplate(editId.value, payload)
    else await createCreaftTemplate(payload)
    message.success('已保存')
    modalVisible.value = false
    loadList()
    loadOptions()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: CreaftTemplateRow) {
  try {
    await deleteCreaftTemplate(record.id)
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
  flex-wrap: wrap;
}
.title-cell {
  font-weight: 500;
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
.payload-view {
  max-height: 60vh;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
