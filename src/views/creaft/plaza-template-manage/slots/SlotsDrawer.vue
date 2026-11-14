<template>
  <a-drawer
    :open="open"
    :title="`入参配置：${template?.title ?? ''}`"
    width="1240"
    :mask-closable="false"
    destroy-on-close
    @update:open="onClose"
  >
    <template #extra>
      <a-space>
        <a-dropdown>
          <a-button>套用预设</a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item v-for="p in SLOT_PRESETS" :key="p.id" @click="applyPreset(p)">
                <div>{{ p.name }}</div>
                <div class="muted">{{ p.desc }}</div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button @click="onClose(false)">关闭</a-button>
        <a-button
          v-permission="'creaft_catalog:edit'"
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存
        </a-button>
      </a-space>
    </template>

    <a-spin :spinning="loading">
      <a-alert
        v-if="issues.length"
        type="error"
        show-icon
        style="margin-bottom: 12px"
        :message="`有 ${issues.length} 处问题，点击定位`"
      >
        <template #description>
          <div v-for="(it, n) in issues.slice(0, 6)" :key="n" class="issue" @click="locate(it)">
            <code>{{ it.path }}</code> {{ it.message }}
          </div>
          <div v-if="issues.length > 6" class="muted">还有 {{ issues.length - 6 }} 处…</div>
        </template>
      </a-alert>

      <div class="cols">
        <!-- 左：列表 -->
        <div class="col-list">
          <div class="col-title">
            入参列表（{{ drafts.length }}）
            <a-dropdown>
              <a-button size="small" type="primary">添加</a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item v-for="t in SLOT_TYPES" :key="t.value" @click="add(t.value)">
                    {{ t.label }}
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <a-empty v-if="!drafts.length" description="还没有入参，可添加或套用预设" />
          <draggable
            v-model="drafts"
            item-key="uid"
            handle=".grip"
            animation="150"
            @end="onDragEnd"
          >
            <template #item="{ element, index }">
              <div
                class="row"
                :class="{ active: index === sel, bad: hasIssue(index) }"
                @click="sel = index"
              >
                <span class="grip" title="拖动排序">⋮⋮</span>
                <div class="row-main">
                  <div class="row-name">
                    {{ element.label || '（未命名）' }}
                  </div>
                  <div class="muted">
                    <code>{{ element.key }}</code> · {{ typeLabel(element.type)
                    }}<template v-if="element.required"> · 必填</template>
                  </div>
                </div>
                <a-space :size="0">
                  <a-button
                    size="small"
                    type="text"
                    :disabled="index === 0"
                    @click.stop="move(index, -1)"
                    >↑</a-button
                  >
                  <a-button
                    size="small"
                    type="text"
                    :disabled="index === drafts.length - 1"
                    @click.stop="move(index, 1)"
                    >↓</a-button
                  >
                  <a-button size="small" type="text" danger @click.stop="remove(index)"
                    >删</a-button
                  >
                </a-space>
              </div>
            </template>
          </draggable>
        </div>

        <!-- 中：属性 -->
        <div class="col-form">
          <a-empty v-if="!cur" description="从左侧选择一个入参" />
          <a-form v-else layout="vertical" class="form">
            <div class="grid2">
              <a-form-item label="类型" v-bind="st('type')" data-field="type">
                <a-select :value="cur.type" :options="SLOT_TYPES" @change="changeType" />
              </a-form-item>
              <a-form-item label="key（模板内唯一）" v-bind="st('key')" data-field="key">
                <a-input v-model:value="cur.key" :maxlength="32" @change="renameKey" />
              </a-form-item>
              <a-form-item label="名称" v-bind="st('label')" data-field="label">
                <a-input v-model:value="cur.label" :maxlength="32" />
              </a-form-item>
              <a-form-item label="分组（同名分组在一起显示）" data-field="group">
                <a-input v-model:value="cur.group" :maxlength="32" />
              </a-form-item>
            </div>
            <a-form-item label="帮助说明" data-field="help">
              <a-input v-model:value="cur.help" :maxlength="100" />
            </a-form-item>
            <a-form-item
              v-if="cur.type !== 'switch' && !isMedia(cur.type)"
              label="占位提示"
              data-field="placeholder"
            >
              <a-input v-model:value="cur.placeholder" :maxlength="60" />
            </a-form-item>
            <a-form-item label="必填" data-field="required">
              <a-switch v-model:checked="cur.required" />
            </a-form-item>

            <!-- image / video -->
            <template v-if="isMedia(cur.type)">
              <div class="grid2">
                <a-form-item label="最少数量" v-bind="st('minCount')" data-field="minCount">
                  <a-input-number v-model:value="cur.minCount" :min="0" style="width: 100%" />
                </a-form-item>
                <a-form-item label="最多数量" v-bind="st('maxCount')" data-field="maxCount">
                  <a-input-number v-model:value="cur.maxCount" :min="1" style="width: 100%" />
                </a-form-item>
                <a-form-item
                  label="接受比例（如 3:4）"
                  v-bind="st('acceptRatio')"
                  data-field="acceptRatio"
                >
                  <a-input v-model:value="cur.acceptRatio" placeholder="留空 = 不限" />
                </a-form-item>
                <a-form-item
                  v-if="cur.type === 'video'"
                  label="最长时长（秒）"
                  v-bind="st('maxDurationSec')"
                  data-field="maxDurationSec"
                >
                  <a-input-number v-model:value="cur.maxDurationSec" :min="1" style="width: 100%" />
                </a-form-item>
              </div>
              <a-form-item label="拍摄 / 上传指引" data-field="guidance">
                <a-textarea v-model:value="cur.guidance" :rows="2" :maxlength="200" />
              </a-form-item>
              <a-form-item label="示例图 URL" data-field="exampleUrl">
                <a-input v-model:value="cur.exampleUrl" placeholder="公有桶地址，可空" />
              </a-form-item>
            </template>

            <!-- text / textarea -->
            <template v-if="isTextual(cur.type)">
              <a-form-item label="最大字数" v-bind="st('maxLength')" data-field="maxLength">
                <a-input-number v-model:value="cur.maxLength" :min="1" style="width: 200px" />
              </a-form-item>
              <a-form-item label="默认值" v-bind="st('default')" data-field="default">
                <a-input
                  :value="cur.default as string"
                  @update:value="(v: unknown) => (cur!.default = v)"
                />
              </a-form-item>
              <a-form-item
                v-if="cur.type === 'text'"
                label="图上文字版式"
                v-bind="st('layout')"
                data-field="layout"
              >
                <LayoutEditor
                  :text="cur.layoutText"
                  :drafts="drafts"
                  :cur-index="sel"
                  :cover-url="template?.coverUrl"
                  @update:text="(v) => (cur!.layoutText = v)"
                />
              </a-form-item>
              <a-form-item
                v-else-if="cur.layoutText"
                label="layout（仅单行文字可用，请清空）"
                v-bind="st('layout')"
                data-field="layout"
              >
                <a-textarea v-model:value="cur.layoutText" :rows="3" />
              </a-form-item>
            </template>

            <!-- number / price -->
            <template v-if="isNumeric(cur.type)">
              <div class="grid2">
                <a-form-item label="最小值" data-field="min">
                  <a-input-number v-model:value="cur.min" style="width: 100%" />
                </a-form-item>
                <a-form-item label="最大值" v-bind="st('max')" data-field="max">
                  <a-input-number v-model:value="cur.max" style="width: 100%" />
                </a-form-item>
                <a-form-item label="步长" v-bind="st('step')" data-field="step">
                  <a-input-number v-model:value="cur.step" :min="0" style="width: 100%" />
                </a-form-item>
                <a-form-item label="单位" data-field="unit">
                  <a-input v-model:value="cur.unit" :maxlength="8" placeholder="如 元" />
                </a-form-item>
                <a-form-item label="默认值" v-bind="st('default')" data-field="default">
                  <a-input-number
                    :value="cur.default as number"
                    @update:value="(v: unknown) => (cur!.default = v)"
                    style="width: 100%"
                  />
                </a-form-item>
              </div>
            </template>

            <!-- select / multiselect -->
            <template v-if="isChoice(cur.type)">
              <a-form-item label="选项" v-bind="st('options')" data-field="options">
                <div v-for="(o, i) in cur.options" :key="i" class="opt">
                  <a-input v-model:value="o.value" placeholder="value" style="width: 38%" />
                  <a-input v-model:value="o.label" placeholder="显示名称" />
                  <a-button size="small" danger type="text" @click="cur.options!.splice(i, 1)"
                    >删</a-button
                  >
                </div>
                <a-button size="small" @click="addOption">添加选项</a-button>
              </a-form-item>
              <a-form-item label="默认值" v-bind="st('default')" data-field="default">
                <a-select
                  :value="cur.default as string | string[] | undefined"
                  :mode="cur.type === 'multiselect' ? 'multiple' : undefined"
                  allow-clear
                  :options="(cur.options ?? []).filter((o) => o.value && o.label)"
                  @change="(v: unknown) => (cur!.default = v)"
                />
              </a-form-item>
            </template>

            <a-form-item
              v-if="cur.type === 'switch'"
              label="默认值"
              v-bind="st('default')"
              data-field="default"
            >
              <a-switch
                :checked="cur.default === true"
                @update:checked="(v: boolean) => (cur!.default = v)"
              />
            </a-form-item>
            <a-form-item
              v-if="cur.type === 'color'"
              label="默认值"
              v-bind="st('default')"
              data-field="default"
            >
              <a-input
                :value="cur.default as string"
                @update:value="(v: unknown) => (cur!.default = v)"
                placeholder="#FF8800"
                style="width: 160px"
              />
            </a-form-item>

            <!-- visibleWhen -->
            <a-form-item
              label="显示条件（visibleWhen）"
              v-bind="st('visibleWhen')"
              data-field="visibleWhen"
            >
              <a-space wrap>
                <a-select
                  :value="cur.visibleWhen?.key"
                  :options="otherKeyOptions"
                  allow-clear
                  placeholder="当某个入参…"
                  style="width: 200px"
                  @change="(v: unknown) => setWhenKey(v as string | undefined)"
                />
                <template v-if="cur.visibleWhen?.key">
                  <span>等于</span>
                  <a-select
                    v-if="whenOptions"
                    :value="cur.visibleWhen.equals as string | boolean"
                    :options="whenOptions"
                    style="width: 180px"
                    @change="(v: unknown) => (cur!.visibleWhen!.equals = v)"
                  />
                  <a-input
                    v-else
                    :value="cur.visibleWhen.equals as string"
                    style="width: 180px"
                    @update:value="(v: string) => (cur!.visibleWhen!.equals = v)"
                  />
                </template>
              </a-space>
            </a-form-item>
          </a-form>
        </div>

        <!-- 右：预览 -->
        <div class="col-preview">
          <SlotsPreview :items="drafts" />
        </div>
      </div>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, nextTick, ref, watch } from 'vue';
import draggable from 'vuedraggable';

import {
  PlazaError,
  getPlazaTemplate,
  isConflictError,
  saveTemplateSlots,
  type PlazaTemplateRow,
  type SlotType,
} from '@/api/plaza-admin';

import {
  SLOT_PRESETS,
  SLOT_TYPES,
  isChoice,
  isMedia,
  isNumeric,
  isTextual,
  newSlot,
  parsePath,
  toConfig,
  toDrafts,
  validateSlots,
  type SlotDraft,
  type SlotIssue,
  type SlotPreset,
} from './slot-model';
import LayoutEditor from './layout/LayoutEditor.vue';
import SlotsPreview from './SlotsPreview.vue';

type Row = SlotDraft & { uid: number };

const props = defineProps<{
  open: boolean;
  template: PlazaTemplateRow | null;
}>();
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'saved'): void;
}>();

let uidSeq = 0;
const withUid = (list: SlotDraft[]): Row[] => list.map((d) => ({ ...d, uid: ++uidSeq }));

const drafts = ref<Row[]>([]);
const sel = ref(0);
const loading = ref(false);
const saving = ref(false);
const issues = ref<SlotIssue[]>([]);
let updatedAt: string | undefined;
let revision: number | undefined;
let baseline = '';

const cur = computed(() => drafts.value[sel.value] ?? null);
const typeLabel = (t: SlotType) => SLOT_TYPES.find((x) => x.value === t)?.label ?? t;

const otherKeyOptions = computed(() =>
  drafts.value
    .filter((_, i) => i !== sel.value)
    .map((d) => ({
      label: `${d.label || '（未命名）'}（${d.key}）`,
      value: d.key,
    })),
);
/** equals 的候选：目标是开关 / 选择类时给下拉，其余手填 */
const whenOptions = computed(() => {
  const t = drafts.value.find((d) => d.key === cur.value?.visibleWhen?.key);
  if (!t) return null;
  if (t.type === 'switch')
    return [
      { label: '开', value: true },
      { label: '关', value: false },
    ];
  if (isChoice(t.type))
    return (t.options ?? [])
      .filter((o) => o.value)
      .map((o) => ({ label: o.label || o.value, value: o.value }));
  return null;
});

const snapshot = () => JSON.stringify(toConfig(drafts.value));

watch(
  () => [props.open, props.template?.id] as const,
  async ([open, id]) => {
    if (!open || !id) return;
    loading.value = true;
    issues.value = [];
    sel.value = 0;
    try {
      const detail = await getPlazaTemplate(id);
      // 乐观并发的基准是详情里的 updateTime（PUT /slots 的 updatedAt 与它比对）
      updatedAt = detail?.updateTime;
      revision = detail?.revision;
      drafts.value = withUid(toDrafts(detail?.slots));
      baseline = snapshot();
    } catch {
      drafts.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function onClose(v: boolean) {
  if (v) return emit('update:open', true);
  if (snapshot() !== baseline) {
    Modal.confirm({
      title: '有未保存的修改，确定关闭？',
      okText: '放弃修改并关闭',
      okType: 'danger',
      onOk: () => emit('update:open', false),
    });
    return;
  }
  emit('update:open', false);
}

// ---- 列表操作 ----
function add(type: SlotType) {
  drafts.value.push(
    ...withUid([
      newSlot(
        type,
        drafts.value.map((d) => d.key),
      ),
    ]),
  );
  sel.value = drafts.value.length - 1;
}
function remove(i: number) {
  drafts.value.splice(i, 1);
  sel.value = Math.min(sel.value, drafts.value.length - 1);
  issues.value = [];
}
function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= drafts.value.length) return;
  const [x] = drafts.value.splice(i, 1);
  drafts.value.splice(j, 0, x);
  if (sel.value === i) sel.value = j;
  else if (sel.value === j) sel.value = i;
  issues.value = [];
}
function onDragEnd(e: { newIndex?: number }) {
  if (e.newIndex !== undefined) sel.value = e.newIndex;
  issues.value = [];
}

function applyPreset(p: SlotPreset) {
  const apply = () => {
    drafts.value = withUid(toDrafts(JSON.parse(JSON.stringify(p.config))));
    sel.value = 0;
    issues.value = [];
  };
  if (!drafts.value.length) return apply();
  Modal.confirm({
    title: `套用预设「${p.name}」？`,
    content: '会替换当前全部入参（保存前仍可关闭放弃）。',
    onOk: apply,
  });
}

// ---- 属性编辑 ----
/** 切类型：丢掉与新类型无关的属性，避免残留 */
function changeType(t: SlotType) {
  const c = cur.value;
  if (!c) return;
  const fresh = newSlot(t, []);
  Object.assign(c, {
    type: t,
    default: undefined,
    minCount: fresh.minCount,
    maxCount: fresh.maxCount,
    options: fresh.options,
    guidance: undefined,
    exampleUrl: undefined,
    acceptRatio: undefined,
    maxDurationSec: undefined,
    maxLength: undefined,
    layoutText: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    unit: undefined,
  });
}

/** key 改名时，把别的入参里指向它的 visibleWhen 一并改过去 */
let lastKey = '';
watch(
  () => cur.value?.uid,
  () => (lastKey = cur.value?.key ?? ''),
  { immediate: true },
);
function renameKey() {
  const c = cur.value;
  if (!c) return;
  if (lastKey && lastKey !== c.key) {
    for (const d of drafts.value) if (d.visibleWhen?.key === lastKey) d.visibleWhen.key = c.key;
  }
  lastKey = c.key;
}

function addOption() {
  const c = cur.value;
  if (!c) return;
  c.options = [...(c.options ?? []), { value: `opt_${(c.options?.length ?? 0) + 1}`, label: '' }];
}
function setWhenKey(k: string | undefined) {
  const c = cur.value;
  if (!c) return;
  c.visibleWhen = k ? { key: k, equals: undefined } : undefined;
}

// ---- 校验与定位 ----
const issueMap = computed(() => {
  const m = new Map<string, string>();
  for (const it of issues.value) {
    const p = parsePath(it.path);
    if (p && !m.has(`${p.index}.${p.field}`)) m.set(`${p.index}.${p.field}`, it.message);
  }
  return m;
});
const hasIssue = (i: number) => issues.value.some((x) => parsePath(x.path)?.index === i);
const st = (field: string) => {
  const msg = issueMap.value.get(`${sel.value}.${field}`);
  return msg ? { validateStatus: 'error' as const, help: msg } : {};
};

async function locate(it: SlotIssue) {
  const p = parsePath(it.path);
  if (!p) return;
  sel.value = p.index;
  await nextTick();
  const el = document.querySelector<HTMLElement>(`.col-form [data-field="${p.field}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el?.querySelector<HTMLElement>('input,textarea')?.focus();
}

async function save() {
  const id = props.template?.id;
  if (!id) return;
  const found = validateSlots(drafts.value);
  issues.value = found;
  if (found.length) {
    message.warning(`有 ${found.length} 处配置不合法，已定位到第一处`);
    locate(found[0]);
    return;
  }
  saving.value = true;
  try {
    const saved = await saveTemplateSlots(id, toConfig(drafts.value), updatedAt, revision);
    updatedAt = saved?.updatedAt ?? updatedAt;
    revision = saved?.revision ?? revision;
    baseline = snapshot();
    message.success('入参配置已保存');
    emit('saved');
  } catch (e) {
    if (e instanceof PlazaError) {
      // 4002：只改入参是 CONFLICT，整体编辑是 TEMPLATE_CONFLICT，两种都当「他人已修改」
      if (isConflictError(e)) {
        message.error('他人已修改该模板，请关闭抽屉刷新后再改');
        return;
      }
      // 1003 · SLOTS_INVALID：data.errors 是全部错误（field 为路径），data.field 是第一处
      const all = (e.errors ?? [])
        .filter((x) => parsePath(x.field))
        .map((x) => ({ path: x.field, message: x.message }));
      if (!all.length && e.field && parsePath(e.field))
        all.push({ path: e.field, message: e.message });
      if (all.length) {
        issues.value = all;
        message.error(`服务端校验未通过：${e.message}`);
        locate(all[0]);
      } else {
        message.error(e.message || '保存失败');
      }
    } else {
      message.error('保存失败');
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}
.col-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 6px;
  cursor: pointer;
  background: var(--ant-color-bg-container, #fff);
}
.row.active {
  border-color: var(--ant-color-primary, #1677ff);
  background: var(--ant-color-primary-bg, #e6f4ff);
}
.row.bad {
  border-color: #cf1322;
}
.grip {
  cursor: grab;
  color: var(--ant-color-text-tertiary, #888);
  user-select: none;
}
.row-main {
  flex: 1;
  min-width: 0;
}
.row-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.opt {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.issue {
  cursor: pointer;
  font-size: 13px;
}
.issue:hover {
  text-decoration: underline;
}
@media (max-width: 1200px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
