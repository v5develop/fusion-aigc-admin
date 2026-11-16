<template>
  <div class="annotation-editor">
    <div v-if="parseError" class="raw">
      <div class="warn">这份改法的格式无法用表单展示，下面是原始内容，保存时按原样保留。</div>
      <a-textarea :value="modelValue" :auto-size="{ minRows: 4, maxRows: 10 }" readonly />
    </div>

    <template v-else>
      <div class="intro">
        逐项选择这个示例里每一方面怎么处理。没有特别要改的保持「保持原样」即可。
      </div>

      <div class="dims">
        <div v-for="d in DIMS" :key="d.key" class="dim">
          <div class="dim-name">
            <span class="name">{{ d.label }}</span>
            <span class="hint">{{ d.hint }}</span>
          </div>
          <div class="dim-control">
            <a-select
              v-model:value="rows[d.key].mode"
              size="small"
              :options="MODE_OPTIONS"
              class="mode"
            />
            <a-input
              v-if="rows[d.key].mode === 'describe'"
              v-model:value="rows[d.key].note"
              size="small"
              :maxlength="200"
              placeholder="用一句话描述要改成什么，例如：改成红色连衣裙"
            />
            <a-input-number
              v-if="rows[d.key].mode === 'replace'"
              v-model:value="rows[d.key].ref"
              size="small"
              :min="1"
              :max="9"
              addon-before="用用户的第"
              addon-after="张参考图"
              class="ref"
            />
          </div>
        </div>
      </div>

      <div class="audio">
        <span class="name">配乐 / 声音</span>
        <a-select
          v-model:value="audio"
          size="small"
          :options="AUDIO_OPTIONS"
          class="audio-select"
        />
      </div>

      <a-collapse ghost class="advanced">
        <a-collapse-panel key="raw" header="高级：查看原始 JSON（只读）">
          <pre class="json">{{ preview }}</pre>
        </a-collapse-panel>
      </a-collapse>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 示例改法（annotations）的表单版：把 {dims, audio} 的 JSON 拆成每个方面一行的选项，运营不需要看懂 JSON。
 * 输出仍是 JSON 文本（保存接口不变）；遇到表单表达不了的内容（比如多余字段）原样保留。
 */
import { computed, reactive, ref, watch } from 'vue';

type Mode = 'keep' | 'replace' | 'describe';
interface Row {
  mode: Mode;
  note: string;
  ref: number;
}

const DIMS: { key: string; label: string; hint: string }[] = [
  { key: 'model', label: '模特', hint: '人物的长相与身材' },
  { key: 'garment', label: '服装', hint: '穿的衣服' },
  { key: 'accessory', label: '配饰', hint: '帽子、包、首饰等' },
  { key: 'product', label: '商品', hint: '画面里的主推商品' },
  { key: 'motion', label: '动作', hint: '人物的动作与走位' },
  { key: 'expression', label: '表情', hint: '人物的表情与神态' },
  { key: 'line', label: '线条 / 构图', hint: '画面的线条与构图' },
  { key: 'camera', label: '运镜', hint: '镜头推拉摇移' },
  { key: 'light', label: '光线', hint: '明暗与光源' },
  { key: 'scene', label: '场景', hint: '背景与环境' },
  { key: 'style', label: '风格', hint: '整体画面质感与调性' },
];

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'keep', label: '保持原样' },
  { value: 'replace', label: '换成用户的图' },
  { value: 'describe', label: '按文字描述改' },
];
const AUDIO_OPTIONS = [
  { value: 'regenerate', label: '重新配乐（默认）' },
  { value: 'keep', label: '保留原声' },
  { value: 'mute', label: '静音' },
];

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [text: string] }>();

const rows = reactive<Record<string, Row>>(
  Object.fromEntries(DIMS.map((d) => [d.key, { mode: 'keep' as Mode, note: '', ref: 1 }])),
);
const audio = ref<string>('regenerate');
/** 表单之外的字段（原样保留，不在界面上改） */
const extra = ref<Record<string, unknown>>({});
const parseError = ref(false);

function fromText(text: string) {
  const t = text.trim();
  if (!t) {
    parseError.value = false;
    reset();
    return;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(t);
  } catch {
    parseError.value = true;
    return;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    parseError.value = true;
    return;
  }
  const { dims, audio: a, ...rest } = obj as Record<string, unknown>;
  reset();
  if (dims && typeof dims === 'object' && !Array.isArray(dims)) {
    for (const [k, v] of Object.entries(dims as Record<string, unknown>)) {
      if (!rows[k] || !v || typeof v !== 'object') {
        // 不认识的维度：保留到 extra，保存时原样带回
        extra.value = { ...extra.value, dims: { ...((extra.value.dims as object) ?? {}), [k]: v } };
        continue;
      }
      const d = v as { mode?: string; note?: string; refs?: unknown[] };
      const mode = (['keep', 'replace', 'describe'] as const).includes(d.mode as Mode)
        ? (d.mode as Mode)
        : 'keep';
      rows[k] = {
        mode,
        note: d.note ?? '',
        ref: typeof d.refs?.[0] === 'number' ? (d.refs[0] as number) : 1,
      };
    }
  }
  if (typeof a === 'string' && ['regenerate', 'keep', 'mute'].includes(a)) audio.value = a;
  extra.value = { ...extra.value, ...rest };
  parseError.value = false;
}

function reset() {
  for (const d of DIMS) rows[d.key] = { mode: 'keep', note: '', ref: 1 };
  audio.value = 'regenerate';
  extra.value = {};
}

/** 表单 → JSON：只写非默认的内容，空改法输出空串（= 不做标注） */
function toText(): string {
  const dims: Record<string, unknown> = {};
  for (const d of DIMS) {
    const r = rows[d.key];
    if (r.mode === 'keep') continue;
    const item: Record<string, unknown> = { mode: r.mode };
    if (r.mode === 'describe' && r.note.trim()) item.note = r.note.trim();
    if (r.mode === 'replace') item.refs = [r.ref];
    dims[d.key] = item;
  }
  const out: Record<string, unknown> = { ...extra.value };
  const extraDims = (extra.value.dims as Record<string, unknown> | undefined) ?? {};
  const allDims = { ...extraDims, ...dims };
  if (Object.keys(allDims).length) out.dims = allDims;
  else delete out.dims;
  if (audio.value !== 'regenerate') out.audio = audio.value;
  else delete out.audio;
  return Object.keys(out).length ? JSON.stringify(out, null, 2) : '';
}

const preview = computed(() => toText() || '（无改法：保持原视频）');

let internal = false;
watch(
  () => props.modelValue,
  (v) => {
    if (internal) return;
    fromText(v);
  },
  { immediate: true },
);
watch(
  [rows, audio],
  () => {
    if (parseError.value) return;
    const text = toText();
    internal = true;
    emit('update:modelValue', text);
    internal = false;
  },
  { deep: true },
);
</script>

<style scoped>
.annotation-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.intro {
  color: var(--ant-color-text-secondary, #666);
  font-size: 12px;
}
.warn {
  color: var(--ant-color-warning, #faad14);
  font-size: 12px;
  margin-bottom: 6px;
}
.dims {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  border-radius: 8px;
  overflow: hidden;
}
.dim {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
}
.dim:last-child {
  border-bottom: none;
}
.dim-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: 500;
}
.hint {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.dim-control {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}
.mode {
  width: 160px;
}
.ref {
  width: 260px;
}
.audio {
  display: flex;
  align-items: center;
  gap: 12px;
}
.audio-select {
  width: 200px;
}
.json {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}
@media (max-width: 720px) {
  .dim {
    grid-template-columns: 1fr;
  }
}
</style>
