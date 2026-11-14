<template>
  <div class="le">
    <div class="le-head">
      <a-switch :checked="enabled" @change="toggle" />
      <span>启用叠字版式</span>
      <a-button v-if="enabled" type="link" size="small" @click="open = !open">
        {{ open ? '收起' : '展开' }}
      </a-button>
    </div>
    <div class="muted">
      需在模板上打开「文字走后期叠加」，且提示词里写明「画面里不要出现任何文字」。
    </div>

    <template v-if="enabled && open">
      <a-alert
        v-if="!L"
        type="warning"
        :message="
          parsed.ok
            ? 'layout 缺少合法的 box，可视化编辑不可用，请在下方 JSON 中补全，或关闭后重新启用'
            : 'layout 不是合法 JSON，可视化编辑不可用，请在下方 JSON 中修正'
        "
        style="margin: 8px 0"
      />
      <div v-if="L" class="le-body">
        <div class="le-left">
          <div class="le-src">
            <a-select
              v-model:value="pick"
              :options="candidates"
              size="small"
              style="width: 150px"
              placeholder="样例图来源"
              @change="(v: unknown) => (sampleUrl = String(v ?? ''))"
            />
            <a-input
              v-model:value="sampleUrl"
              size="small"
              allow-clear
              placeholder="样例图 URL（可粘贴；留空为灰底）"
            />
          </div>
          <div ref="stage" class="le-stage" :style="{ width: STAGE_W + 'px', height: stageH + 'px' }">
            <canvas ref="canvas" class="le-canvas" />
            <div
              class="le-box"
              :style="{
                left: L.box.x * 100 + '%',
                top: L.box.y * 100 + '%',
                width: L.box.w * 100 + '%',
                height: L.box.h * 100 + '%',
              }"
              @pointerdown="(e) => startDrag(e, 'move')"
            >
              <i
                v-for="h in HANDLES"
                :key="h"
                :class="['le-h', 'h-' + h]"
                @pointerdown.stop="(e) => startDrag(e, h)"
              />
            </div>
          </div>
          <div class="muted">预览为近似效果，以服务端出图为准（预览使用系统通用中文字体）。</div>
        </div>

        <div class="le-right">
          <div class="le-sec">框（相对画面 0~1）</div>
          <div class="grid4">
            <label v-for="k in BOX_KEYS" :key="k">
              {{ k }}
              <a-input-number
                :value="L.box[k]"
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
                style="width: 100%"
                @change="(v: unknown) => setBoxField(k, v)"
              />
            </label>
          </div>

          <div class="le-sec">字号（相对画面高度）</div>
          <div class="row">
            <a-checkbox :checked="!L.size" @change="(e: { target: { checked: boolean } }) => setSize(e.target.checked ? 0 : 0.05)">
              自适应
            </a-checkbox>
            <a-slider
              v-if="L.size"
              :value="L.size"
              :min="0.005"
              :max="0.5"
              :step="0.005"
              style="flex: 1"
              @change="(v: unknown) => setSize(Number(v))"
            />
            <a-input-number
              v-if="L.size"
              :value="L.size"
              :min="0"
              :max="0.5"
              :step="0.005"
              size="small"
              @change="(v: unknown) => v !== null && setSize(Number(v))"
            />
          </div>

          <div class="le-sec">颜色</div>
          <div class="row">
            <input
              type="color"
              class="clr"
              :value="hex6(L.color ?? DEFAULT_COLOR)"
              @input="(e) => setColor('color', (e.target as HTMLInputElement).value)"
            />
            <a-input
              :value="L.color"
              :placeholder="DEFAULT_COLOR"
              size="small"
              style="width: 130px"
              @update:value="(v: string) => setOpt('color', v)"
            />
          </div>

          <div class="le-sec">描边</div>
          <div class="row">
            <a-switch :checked="!!L.stroke" size="small" @change="toggleStroke" />
            <template v-if="L.stroke">
              <input
                type="color"
                class="clr"
                :value="hex6(L.stroke.color ?? '#000000')"
                @input="(e) => setColor('stroke.color', (e.target as HTMLInputElement).value)"
              />
              <a-input
                :value="L.stroke.color"
                placeholder="#000000"
                size="small"
                style="width: 100px"
                @update:value="(v: string) => setStrokeColor(v)"
              />
              <span>粗细</span>
              <a-input-number
                :value="L.stroke.width"
                :min="0"
                :max="0.05"
                :step="0.001"
                size="small"
                style="width: 90px"
                @change="(v: unknown) => v !== null && patch((o) => (o.stroke.width = Number(v)))"
              />
            </template>
          </div>

          <div class="le-sec">排版</div>
          <div class="row">
            <a-select
              :value="L.align ?? 'center'"
              size="small"
              style="width: 90px"
              :options="ALIGNS"
              @change="(v: unknown) => patch((o) => (o.align = v))"
            />
            <a-select
              :value="L.valign ?? 'middle'"
              size="small"
              style="width: 100px"
              :options="VALIGNS"
              @change="(v: unknown) => patch((o) => (o.valign = v))"
            />
          </div>
          <div class="row">
            <label>
              最大行数
              <a-input-number
                :value="L.maxLines"
                :min="1"
                :max="10"
                :precision="0"
                size="small"
                placeholder="不限"
                style="width: 90px"
                @change="(v: unknown) => setNum('maxLines', v)"
              />
            </label>
            <label>
              行高
              <a-input-number
                :value="L.lineHeight"
                :min="0.8"
                :max="3"
                :step="0.1"
                size="small"
                placeholder="1.2"
                style="width: 90px"
                @change="(v: unknown) => setNum('lineHeight', v)"
              />
            </label>
          </div>

          <div class="le-sec">字体 rid（留空 = 系统默认字体）</div>
          <a-input
            :value="L.fontRid"
            size="small"
            :maxlength="200"
            placeholder="mr://…"
            @update:value="(v: string) => setOpt('fontRid', v)"
          />
          <div class="le-sec">样例文字（预览用）</div>
          <a-input
            :value="L.defaultText"
            size="small"
            placeholder="留空则用默认值 / 名称"
            @update:value="(v: string) => setOpt('defaultText', v)"
          />
        </div>
      </div>

      <a-button type="link" size="small" @click="raw = !raw">
        {{ raw || !L ? '收起 JSON' : '高级：编辑 JSON' }}
      </a-button>
      <a-textarea
        v-if="raw || !L"
        :value="text"
        :rows="6"
        @update:value="(v: string) => emit('update:text', v)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
  DEFAULT_COLOR,
  DEFAULT_LAYOUT,
  clampBox,
  parseLayoutText,
  stringifyLayout,
  tolerantLayout,
  type LayoutBox,
  type TextLayout,
} from './layout-model';
import { drawLayout } from './layoutPreview';

interface DraftLike {
  key: string;
  label: string;
  default?: unknown;
  exampleUrl?: string;
  layoutText?: string;
}

const props = defineProps<{
  text?: string;
  drafts: DraftLike[];
  curIndex: number;
  coverUrl?: string;
}>();
const emit = defineEmits<{ (e: 'update:text', v: string | undefined): void }>();

const STAGE_W = 360;
const BOX_KEYS = ['x', 'y', 'w', 'h'] as const;
const HANDLES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;
const ALIGNS = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
];
const VALIGNS = [
  { value: 'top', label: '顶部' },
  { value: 'middle', label: '垂直居中' },
  { value: 'bottom', label: '底部' },
];

const open = ref(true);
const raw = ref(false);
const enabled = computed(() => !!props.text?.trim());
const parsed = computed(() => parseLayoutText(props.text));
const L = computed(() => tolerantLayout(props.text));

/* ---------- 编辑：始终在解析后的对象副本上改，未知键原样保留 ---------- */
// oxlint-disable-next-line typescript/no-explicit-any -- 原始 JSON 对象，含未知键
function patch(fn: (o: Record<string, any>) => void) {
  const p = parsed.value;
  if (!p.ok || typeof p.value !== 'object' || p.value === null) return;
  const o = JSON.parse(JSON.stringify(p.value));
  fn(o);
  emit('update:text', stringifyLayout(o));
}
function toggle(on: unknown) {
  emit('update:text', on ? stringifyLayout(DEFAULT_LAYOUT()) : undefined);
  open.value = true;
}
const setBox = (b: LayoutBox) =>
  patch((o) => {
    o.box = { ...o.box, ...clampBox(b) };
  });
function setBoxField(k: keyof LayoutBox, v: unknown) {
  if (v === null || v === '' || !L.value) return;
  setBox({ ...L.value.box, [k]: Number(v) });
}
function setSize(v: number) {
  patch((o) => {
    if (v > 0) o.size = Math.round(v * 1000) / 1000;
    else delete o.size;
  });
}
/** 字符串类可选字段：空 → 删除键；其余原样写入，交给校验提示 */
function setOpt(k: string, v: string) {
  patch((o) => {
    if (v === undefined || v === null || v === '') delete o[k];
    else o[k] = v;
  });
}
function setNum(k: string, v: unknown) {
  patch((o) => {
    if (v === null || v === undefined || v === '') delete o[k];
    else o[k] = Number(v);
  });
}
const hex6 = (c: string) => (/^#[0-9a-fA-F]{6}/.test(c) ? c.slice(0, 7) : '#000000');
function setColor(path: string, rgb: string) {
  patch((o) => {
    const [a, b] = path.split('.');
    const holder = b ? o[a] : o;
    const key = b ?? a;
    const old = typeof holder[key] === 'string' ? holder[key] : '';
    holder[key] = old.length === 9 ? rgb + old.slice(7) : rgb.toUpperCase();
  });
}
function toggleStroke(on: unknown) {
  patch((o) => {
    if (on) o.stroke = { color: '#000000', width: 0.004 };
    else delete o.stroke;
  });
}
function setStrokeColor(v: string) {
  patch((o) => {
    if (!o.stroke) return;
    if (!v) delete o.stroke.color;
    else o.stroke.color = v;
  });
}

/* ---------- 样例图 ---------- */
const candidates = computed(() => {
  const list: { label: string; value: string }[] = [];
  if (props.coverUrl) list.push({ label: '模板封面', value: props.coverUrl });
  for (const d of props.drafts)
    if (d.exampleUrl?.trim())
      list.push({ label: `示例图：${d.label || d.key}`, value: d.exampleUrl.trim() });
  return list;
});
const pick = ref<string>();
const sampleUrl = ref('');
let seeded = false;
watch(
  candidates,
  (c) => {
    if (seeded || !c.length) return;
    seeded = true;
    pick.value = c[0].value;
    sampleUrl.value = c[0].value;
  },
  { immediate: true },
);

const img = ref<HTMLImageElement | null>(null);
const ratio = ref(3 / 4);
let loadSeq = 0;
watch(
  sampleUrl,
  (url) => {
    const seq = ++loadSeq;
    img.value = null;
    if (!url.trim()) return;
    const im = new Image();
    im.onload = () => {
      if (seq !== loadSeq) return;
      img.value = im;
      ratio.value = im.naturalWidth / im.naturalHeight || 3 / 4;
    };
    im.onerror = () => {
      if (seq === loadSeq) img.value = null;
    };
    im.src = url.trim();
  },
  { immediate: true },
);
const stageH = computed(() => Math.round(STAGE_W / ratio.value));

/* ---------- 画布 ---------- */
const canvas = ref<HTMLCanvasElement | null>(null);
const stage = ref<HTMLElement | null>(null);

function sampleText(d: DraftLike, l: TextLayout) {
  if (typeof l.defaultText === 'string' && l.defaultText) return l.defaultText;
  if (typeof d.default === 'string' && d.default) return d.default;
  return d.label || '示例文字';
}
function redraw() {
  const c = canvas.value;
  if (!c) return;
  const W = STAGE_W;
  const H = stageH.value;
  const dpr = window.devicePixelRatio || 1;
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#8c8c8c';
  ctx.fillRect(0, 0, W, H);
  if (img.value) ctx.drawImage(img.value, 0, 0, W, H);
  props.drafts.forEach((d, i) => {
    const l = tolerantLayout(i === props.curIndex ? props.text : d.layoutText);
    if (!l) return;
    if (i !== props.curIndex) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(l.box.x * W, l.box.y * H, l.box.w * W, l.box.h * H);
      ctx.restore();
    }
    drawLayout(ctx, W, H, { text: sampleText(d, l), layout: l });
  });
}
watch(
  () => [props.text, props.curIndex, props.drafts.map((d) => d.layoutText + '|' + d.default + d.label), img.value, stageH.value, enabled.value, open.value],
  () => nextTick(redraw),
  { deep: true, immediate: true },
);

/* ---------- 拖框 ---------- */
let drag: null | { mode: string; sx: number; sy: number; box: LayoutBox } = null;
function startDrag(e: PointerEvent, mode: string) {
  if (!L.value) return;
  drag = { mode, sx: e.clientX, sy: e.clientY, box: { ...L.value.box } };
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stop);
  e.preventDefault();
}
function onMove(e: PointerEvent) {
  if (!drag || !stage.value) return;
  const r = stage.value.getBoundingClientRect();
  const dx = (e.clientX - drag.sx) / r.width;
  const dy = (e.clientY - drag.sy) / r.height;
  const b = drag.box;
  const MIN = 0.02;
  let { x, y, w, h } = b;
  if (drag.mode === 'move') {
    x = Math.min(Math.max(b.x + dx, 0), 1 - b.w);
    y = Math.min(Math.max(b.y + dy, 0), 1 - b.h);
  } else {
    const m = drag.mode;
    if (m.includes('w')) {
      const nx = Math.min(Math.max(b.x + dx, 0), b.x + b.w - MIN);
      w = b.x + b.w - nx;
      x = nx;
    }
    if (m.includes('e')) w = Math.min(Math.max(b.w + dx, MIN), 1 - b.x);
    if (m.includes('n')) {
      const ny = Math.min(Math.max(b.y + dy, 0), b.y + b.h - MIN);
      h = b.y + b.h - ny;
      y = ny;
    }
    if (m.includes('s')) h = Math.min(Math.max(b.h + dy, MIN), 1 - b.y);
  }
  setBox({ x, y, w, h });
}
function stop() {
  drag = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', stop);
}
onBeforeUnmount(stop);
</script>

<style scoped>
.le {
  width: 100%;
}
.le-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--ant-color-text-secondary, #888);
  font-size: 12px;
}
.le-body {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.le-left {
  flex: none;
}
.le-right {
  flex: 1;
  min-width: 260px;
}
.le-src {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  width: 360px;
}
.le-stage {
  position: relative;
  user-select: none;
  touch-action: none;
  background: #8c8c8c;
}
.le-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.le-box {
  position: absolute;
  border: 2px solid var(--ant-color-primary, #1677ff);
  background: rgba(22, 119, 255, 0.12);
  cursor: move;
  box-sizing: border-box;
}
.le-h {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1px solid var(--ant-color-primary, #1677ff);
  box-sizing: border-box;
}
.h-n { left: 50%; top: -6px; margin-left: -5px; cursor: ns-resize; }
.h-s { left: 50%; bottom: -6px; margin-left: -5px; cursor: ns-resize; }
.h-e { top: 50%; right: -6px; margin-top: -5px; cursor: ew-resize; }
.h-w { top: 50%; left: -6px; margin-top: -5px; cursor: ew-resize; }
.h-nw { top: -6px; left: -6px; cursor: nwse-resize; }
.h-se { bottom: -6px; right: -6px; cursor: nwse-resize; }
.h-ne { top: -6px; right: -6px; cursor: nesw-resize; }
.h-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.le-sec {
  margin: 10px 0 4px;
  font-weight: 600;
  font-size: 12px;
}
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.clr {
  width: 32px;
  height: 24px;
  padding: 0;
  border: 1px solid #d9d9d9;
  background: none;
}
</style>
