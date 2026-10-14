<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">Creaft 工作流模板</h2>
      <a-button v-permission="'creaft_catalog:edit'" type="primary" @click="openCreate">
        新增工作流
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="被 GET /api/v1/workflows/templates/{category} 读：只下发启用的行，按排序升序。端侧回包的 workflowId 就是这里的 #id。标题（title）是端侧提交体里的工作流名，服务端按它决定出图 / 出片前的处理步骤，建好后不可改。"
    />

    <a-alert
      v-if="fallbackCategories.length"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`${fallbackCategories.map(categoryLabel).join('、')} 一条启用的都没有：这些分类的下发接口会退回旧的按能力绑定生成的列表（视频流只有一条 video，服装 / 电商为空）。`"
    />

    <a-card variant="borderless">
      <div class="filter-bar">
        <a-select
          v-model:value="categoryFilter"
          :options="categoryFilterOptions"
          style="width: 160px"
          @change="onFilterChange"
        />
        <a-input
          v-model:value="keyword"
          placeholder="按标题或中文名过滤"
          allow-clear
          style="width: 220px"
          @press-enter="onFilterChange"
          @change="onKeywordChange"
        />
        <a-select
          v-model:value="enabledFilter"
          :options="enabledFilterOptions"
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
          <a-empty description="暂无工作流模板" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'preview'">
            <MediaThumb :url="firstResult(record)" />
          </template>

          <template v-if="column.dataIndex === 'title'">
            <div class="title-cell">{{ record.titleZh }}</div>
            <code class="route-code">{{ record.title }}</code>
            <span class="muted" style="margin-left: 6px">#{{ record.id }}</span>
            <a-tag v-if="record.payloadJson == null" color="orange" style="margin-left: 6px"
              >未导入</a-tag
            >
          </template>

          <template v-if="column.dataIndex === 'category'">
            <a-tag :color="CATEGORY_COLORS[record.category] || 'default'">
              {{ categoryLabel(record.category) }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'slots'">
            <template v-if="slotSummary(record).length">
              <div v-for="line in slotSummary(record)" :key="line" class="muted slot-line">
                {{ line }}
              </div>
            </template>
            <span v-else class="muted">无输入槽位</span>
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
                title="删除后该工作流立刻从端侧列表消失。v1 原有的工作流建议改成「停用」。确认删除？"
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
      :title="editId ? '编辑工作流' : '新增工作流'"
      :confirm-loading="saving"
      destroy-on-hidden
      width="960px"
      @ok="handleSubmit"
    >
      <a-alert
        v-if="editingUnimported"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="这一行还没导入载荷（V1.0.149 只预置了标题）。先跑 ops/sql/creaft-v1-workflow-template-import.sql，或在下面填好载荷再启用；只改名称、排序时保存不会影响之后的导入。"
      />
      <a-form :model="form" :label-col="{ span: 4 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="分类" required>
          <a-select v-model:value="form.category" :options="categoryOptions" />
        </a-form-item>
        <a-form-item label="标题" required>
          <a-input
            v-model:value="form.title"
            :disabled="!!editId"
            placeholder="小写字母、数字和连字符，如 video-product-sell"
          />
          <div class="muted">
            端侧提交体里的 title，也是工作流历史的分桶键，<strong>建好后不可改</strong>。 v1
            之外的新标题服务端不认识，按该分类的通用方式处理（例如视频流只按用户原话出片）。
          </div>
        </a-form-item>
        <a-form-item label="中文名" required>
          <a-input v-model:value="form.titleZh" placeholder="展示给用户，如 模特带货" />
        </a-form-item>
        <a-form-item label="排序 / 启用">
          <a-space>
            <a-input-number v-model:value="form.sortOrder" :min="0" />
            <span class="muted">升序</span>
            <a-switch v-model:checked="enabled" />
            <span class="muted">停用等于该工作流在端侧不存在</span>
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
      <a-tabs v-model:active-key="payloadTab" @change="onPayloadTabChange">
        <a-tab-pane key="visual" tab="可视化编辑">
          <div class="section">
            <div class="section-title">
              示例产物
              <span class="muted">端侧卡片上展示的效果图 / 视频</span>
            </div>
            <div v-for="(row, index) in editor.results" :key="row.uid" class="url-row">
              <a-input v-model:value="row.url" placeholder="https://…" />
              <CatalogMediaUpload
                v-if="uploadEnabled"
                :accept="IMAGE_OR_VIDEO"
                @uploaded="(url) => (row.url = url)"
              />
              <MediaThumb :url="row.url" />
              <a-button type="text" danger @click="editor.results.splice(index, 1)">移除</a-button>
            </div>
            <a-space>
              <a-button
                type="dashed"
                size="small"
                @click="editor.results.push({ uid: uid(), url: '' })"
                >+ 添加示例地址</a-button
              >
              <CatalogMediaUpload
                v-if="uploadEnabled"
                :accept="IMAGE_OR_VIDEO"
                text="上传新示例"
                @uploaded="(url) => editor.results.push({ uid: uid(), url })"
              />
            </a-space>
          </div>

          <div class="section">
            <div class="section-title">
              提示词
              <span class="muted">原样下发，端侧作为该工作流的默认提示词</span>
            </div>
            <a-textarea v-model:value="editor.prompt" :rows="5" placeholder="可留空" />
          </div>

          <div class="section">
            <div class="section-title">
              图片输入槽位
              <span class="muted">端侧按顺序渲染上传位；最多张数不填表示不限</span>
            </div>
            <div v-for="(slot, index) in editor.images" :key="slot.uid" class="slot-card">
              <div class="slot-head">
                <span class="slot-index">图 {{ index + 1 }}</span>
                <a-space :size="4">
                  <a-button
                    type="text"
                    size="small"
                    :disabled="index === 0"
                    @click="move(editor.images, index, -1)"
                    >上移</a-button
                  >
                  <a-button
                    type="text"
                    size="small"
                    :disabled="index === editor.images.length - 1"
                    @click="move(editor.images, index, 1)"
                  >
                    下移
                  </a-button>
                  <a-button type="text" size="small" danger @click="editor.images.splice(index, 1)"
                    >移除</a-button
                  >
                </a-space>
              </div>
              <div class="slot-body">
                <MediaThumb :url="slot.url" :size="88" />
                <div class="slot-fields">
                  <a-space wrap>
                    <a-input
                      v-model:value="slot.title"
                      placeholder="槽位标题，如 模特图"
                      style="width: 200px"
                    />
                    <a-input-number
                      v-model:value="slot.maxNum"
                      :min="1"
                      :precision="0"
                      placeholder="最多张数"
                      style="width: 120px"
                    />
                  </a-space>
                  <div class="url-row">
                    <a-input v-model:value="slot.url" placeholder="示例图地址 https://…" />
                    <CatalogMediaUpload
                      v-if="uploadEnabled"
                      @uploaded="(url) => (slot.url = url)"
                    />
                  </div>
                  <a-input v-model:value="slot.tips" placeholder="提示（tips，选填）" />
                  <a-input v-model:value="slot.content" placeholder="说明（content，选填）" />
                </div>
              </div>
            </div>
            <a-button type="dashed" size="small" @click="editor.images.push(emptySlot())"
              >+ 添加图片槽位</a-button
            >
          </div>

          <div class="section">
            <div class="section-title">
              视频输入槽位
              <span class="muted">视频流带货复刻 / 产品替换的参考视频；没有就不要加</span>
            </div>
            <div v-for="(slot, index) in editor.videos" :key="slot.uid" class="slot-card">
              <div class="slot-head">
                <span class="slot-index">视频 {{ index + 1 }}</span>
                <a-button type="text" size="small" danger @click="editor.videos.splice(index, 1)"
                  >移除</a-button
                >
              </div>
              <div class="slot-body">
                <MediaThumb :url="slot.url" :size="88" />
                <div class="slot-fields">
                  <a-input
                    v-model:value="slot.title"
                    placeholder="槽位标题，如 参考视频"
                    style="width: 200px"
                  />
                  <div class="url-row">
                    <a-input v-model:value="slot.url" placeholder="示例视频地址 https://…" />
                    <CatalogMediaUpload
                      v-if="uploadEnabled"
                      :accept="VIDEO_ACCEPT"
                      @uploaded="(url) => (slot.url = url)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <a-button type="dashed" size="small" @click="editor.videos.push(emptySlot())"
              >+ 添加视频槽位</a-button
            >
          </div>
        </a-tab-pane>

        <a-tab-pane key="json" tab="原文 JSON">
          <a-textarea v-model:value="rawJson" :rows="18" class="json-area" />
          <div class="muted">
            必须是 JSON
            对象。可视化编辑没有覆盖的字段在这里改；两边切换时会互相同步，表单不认识的字段原样保留。
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, defineComponent, h, reactive, ref } from 'vue';

import {
  createCreaftWorkflowTemplate,
  deleteCreaftWorkflowTemplate,
  getCreaftWorkflowTemplateCategoryCoverage,
  getCreaftWorkflowTemplates,
  updateCreaftWorkflowTemplate,
  type CreaftWorkflowCategory,
  type CreaftWorkflowTemplateRow,
} from '@/api/creaft-compat';

import CatalogMediaUpload from '../components/CatalogMediaUpload.vue';
import {
  emptySlot,
  fromPayloadModel,
  toPayloadModel,
  uid,
  type PayloadModel,
} from './workflowPayloadModel';

/** 上传默认隐藏：v1 的素材都是填地址，上传只在需要时打开 */
const uploadEnabled = ref(false);

const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';
const IMAGE_OR_VIDEO = `image/png,image/jpeg,image/webp,image/gif,${VIDEO_ACCEPT}`;

// ---- 媒体缩略图：按扩展名区分图片与视频，地址空或不是 http(s) 时显示占位 ----
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;
const MediaThumb = defineComponent({
  props: { url: { type: String, default: '' }, size: { type: Number, default: 56 } },
  setup(props) {
    return () => {
      const style = { width: `${props.size}px`, height: `${props.size}px` };
      const url = (props.url || '').trim();
      if (!/^https?:\/\//i.test(url))
        return h('div', { class: 'thumb thumb-empty', style }, '无预览');
      if (VIDEO_EXT.test(url)) {
        return h('video', {
          class: 'thumb',
          style,
          src: url,
          muted: true,
          preload: 'metadata',
          controls: true,
        });
      }
      return h('a', { href: url, target: '_blank', rel: 'noopener' }, [
        h('img', { class: 'thumb', style, src: url, loading: 'lazy' }),
      ]);
    };
  },
});

const CATEGORY_LABELS: Record<CreaftWorkflowCategory, string> = {
  fashion: '服装',
  ecommerce: '电商',
  video: '视频流',
  visual: '视觉复刻',
  'local-life': '本地生活',
};
const CATEGORY_COLORS: Record<string, string> = {
  fashion: 'magenta',
  ecommerce: 'orange',
  video: 'blue',
  visual: 'purple',
  'local-life': 'green',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as CreaftWorkflowCategory[];

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as CreaftWorkflowCategory] || category;
}

const categoryOptions = CATEGORIES.map((c) => ({ label: `${CATEGORY_LABELS[c]} ${c}`, value: c }));
const categoryFilterOptions = [{ label: '全部分类', value: '' }, ...categoryOptions];
const enabledFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

const columns = [
  { title: '示例', dataIndex: 'preview', width: 80, align: 'center' as const },
  { title: '工作流', dataIndex: 'title', width: 280 },
  { title: '分类', dataIndex: 'category', width: 100, align: 'center' as const },
  { title: '输入槽位', dataIndex: 'slots' },
  { title: '排序', dataIndex: 'sortOrder', width: 70, align: 'center' as const },
  { title: '状态', dataIndex: 'enabled', width: 80, align: 'center' as const },
  { title: '操作', dataIndex: 'operation', key: 'operation', width: 130, align: 'center' as const },
];

const rows = ref<CreaftWorkflowTemplateRow[]>([]);
/** 不带筛选的全量，用来判断哪些分类会退回旧列表 */
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
const categoryFilter = ref<string>('');
const enabledFilter = ref<'' | 1 | 0>('');
const keyword = ref('');

/** 没有任何启用模板的分类（全量口径，取自 category-coverage，不能从当前页推导） */
const coveredCategories = ref<string[]>([]);
const fallbackCategories = computed(() =>
  CATEGORIES.filter((c) => !coveredCategories.value.includes(c)),
);

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
function onKeywordChange() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(onFilterChange, 300);
}

async function loadList() {
  loading.value = true;
  try {
    const [result, covered] = await Promise.all([
      getCreaftWorkflowTemplates({
        category: categoryFilter.value || undefined,
        keyword: keyword.value.trim() || undefined,
        enabled: enabledFilter.value === '' ? undefined : enabledFilter.value,
        page: page.value,
        pageSize: pageSize.value,
      }),
      getCreaftWorkflowTemplateCategoryCoverage(),
    ]);
    rows.value = result?.list || [];
    total.value = result?.total || 0;
    // 删掉末页最后一条后，回退到前一页，避免停在空页上
    if (!rows.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value));
      return loadList();
    }
    coveredCategories.value = covered || [];
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

function firstResult(record: CreaftWorkflowTemplateRow) {
  const result = parseObject(record.payloadJson).result;
  return Array.isArray(result) && typeof result[0] === 'string' ? result[0] : '';
}

function slotSummary(record: CreaftWorkflowTemplateRow) {
  const inner = parseObject(record.payloadJson).payload as Record<string, unknown> | undefined;
  const lines: string[] = [];
  const describe = (label: string, list: unknown) => {
    if (!Array.isArray(list) || !list.length) return;
    const titles = list.map((item) => {
      const slot = (item || {}) as Record<string, unknown>;
      const limit = typeof slot.max_num === 'number' ? ` ≤${slot.max_num}` : '';
      return `${slot.title ?? '未命名'}${limit}`;
    });
    lines.push(`${label}：${titles.join('、')}`);
  };
  describe('图片', inner?.image_urls);
  describe('视频', inner?.video_urls);
  return lines;
}

// ---- 载荷的可视化模型：见 workflowPayloadModel.ts（纯函数，已用 43 条真实工作流验证原样往返） ----
type EditorModel = PayloadModel;
const toEditor = toPayloadModel;
const fromEditor = fromPayloadModel;

function validateEditor(model: EditorModel): string | null {
  const badUrl = (u: string) => u.trim() && !/^https:\/\//i.test(u.trim());
  if (model.results.some((r) => badUrl(r.url))) return '示例产物地址必须是 https 地址';
  for (const [label, list] of [
    ['图片', model.images],
    ['视频', model.videos],
  ] as const) {
    for (const [i, slot] of list.entries()) {
      if (!slot.title.trim()) return `${label}槽位 ${i + 1} 缺标题`;
      if (badUrl(slot.url)) return `${label}槽位 ${i + 1} 的示例地址必须是 https 地址`;
    }
  }
  return null;
}

function move<T>(list: T[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item as T);
}

// ---- 新增 / 编辑 ----
const modalVisible = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
/** 正在编辑的行还没导入载荷：服务端不允许把它启用，保存空载荷时也会保持为空，留给导入脚本去填 */
const editingUnimported = ref(false);
const payloadTab = ref<'visual' | 'json'>('visual');
const rawJson = ref('{}');
const editor = reactive<EditorModel>(toEditor({}));

const form = reactive({
  category: 'fashion' as CreaftWorkflowCategory,
  title: '',
  titleZh: '',
  sortOrder: 0,
  enabled: 1,
});

const enabled = computed({
  get: () => form.enabled === 1,
  set: (value: boolean) => (form.enabled = value ? 1 : 0),
});

function loadEditor(payload: Record<string, unknown>) {
  Object.assign(editor, toEditor(payload));
  rawJson.value = JSON.stringify(payload, null, 2);
}

function onPayloadTabChange(key: string | number) {
  if (key === 'json') {
    rawJson.value = JSON.stringify(fromEditor(editor), null, 2);
    return;
  }
  // 从原文切回可视化：原文不合法就留在原文页，免得把没写完的内容静默丢掉
  try {
    const parsed = JSON.parse(rawJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('not object');
    Object.assign(editor, toEditor(parsed));
  } catch {
    message.warning('原文不是合法的 JSON 对象，先改好再切回可视化');
    payloadTab.value = 'json';
  }
}

function openCreate() {
  editId.value = null;
  editingUnimported.value = false;
  Object.assign(form, {
    category: (categoryFilter.value || 'fashion') as CreaftWorkflowCategory,
    title: '',
    titleZh: '',
    sortOrder: 0,
    enabled: 1,
  });
  loadEditor({ result: [], payload: { prompt: '', image_urls: [] } });
  payloadTab.value = 'visual';
  modalVisible.value = true;
}

function openEdit(record: CreaftWorkflowTemplateRow) {
  editId.value = record.id;
  editingUnimported.value = record.payloadJson == null;
  Object.assign(form, {
    category: record.category,
    title: record.title,
    titleZh: record.titleZh,
    sortOrder: record.sortOrder ?? 0,
    enabled: record.enabled ?? 1,
  });
  loadEditor(parseObject(record.payloadJson));
  payloadTab.value = 'visual';
  modalVisible.value = true;
}

function currentPayload(): string | null {
  if (payloadTab.value === 'visual') {
    const problem = validateEditor(editor);
    if (problem) {
      message.warning(problem);
      return null;
    }
    return JSON.stringify(fromEditor(editor));
  }
  try {
    const parsed = JSON.parse(rawJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      message.warning('载荷必须是 JSON 对象（形如 {"key": ...}），数组和标量都不行');
      return null;
    }
    return JSON.stringify(parsed);
  } catch {
    message.warning('载荷不是合法 JSON');
    return null;
  }
}

async function handleSubmit() {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.title.trim())) {
    message.warning('标题只能由小写字母、数字和连字符组成，如 video-product-sell');
    return;
  }
  if (!form.titleZh.trim()) {
    message.warning('中文名必填');
    return;
  }
  const payloadJson = currentPayload();
  if (payloadJson == null) return;
  saving.value = true;
  try {
    const data = {
      category: form.category,
      title: form.title.trim(),
      titleZh: form.titleZh.trim(),
      payloadJson,
      sortOrder: form.sortOrder ?? 0,
      enabled: form.enabled,
    };
    if (editId.value) await updateCreaftWorkflowTemplate(editId.value, data);
    else await createCreaftWorkflowTemplate(data);
    message.success('已保存');
    modalVisible.value = false;
    loadList();
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function handleDelete(record: CreaftWorkflowTemplateRow) {
  try {
    await deleteCreaftWorkflowTemplate(record.id);
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
.slot-line {
  line-height: 20px;
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
.section {
  margin-bottom: 20px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.section-title .muted {
  font-weight: 400;
  margin-left: 8px;
}
.url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.slot-card {
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.slot-index {
  font-weight: 500;
}
.slot-body {
  display: flex;
  gap: 12px;
}
.slot-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.json-area {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
:deep(.thumb) {
  display: block;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  flex: none;
}
:deep(.thumb-empty) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-quaternary, #bbb);
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
