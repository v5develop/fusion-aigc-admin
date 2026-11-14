<template>
  <div class="mu">
    <div class="mu-list">
      <div
        v-for="(it, i) in items"
        :key="it.uid"
        class="mu-item"
        :class="{ 'is-err': it.state === 'error' }"
      >
        <div class="mu-box">
          <template v-if="kind === 'image'">
            <img v-if="it.preview || it.url" :src="it.preview || it.url" alt="" class="mu-media" />
          </template>
          <template v-else>
            <video
              v-if="it.preview || it.url"
              :src="it.preview || it.url"
              :poster="poster || undefined"
              class="mu-media"
              muted
              controls
              preload="metadata"
            />
          </template>
          <div v-if="it.state === 'uploading'" class="mu-mask">
            <a-progress type="circle" :percent="it.percent" :size="48" />
          </div>
          <div v-else-if="it.state === 'error'" class="mu-mask mu-err">
            <div class="mu-err-text">{{ it.error }}</div>
            <a-space :size="4">
              <a-button
                v-if="it.file && !it.rejected"
                size="small"
                type="primary"
                @click="start(it)"
                >重试</a-button
              >
              <a-button size="small" @click="remove(it)">移除</a-button>
            </a-space>
          </div>
        </div>
        <div v-if="it.state === 'done'" class="mu-ops">
          <a-button
            v-if="multiple"
            size="small"
            type="link"
            :disabled="disabled || i === 0"
            @click="move(i, -1)"
            >前移</a-button
          >
          <a-button
            v-if="multiple"
            size="small"
            type="link"
            :disabled="disabled || i === lastDone"
            @click="move(i, 1)"
            >后移</a-button
          >
          <a-button size="small" type="link" danger :disabled="disabled" @click="remove(it)"
            >删除</a-button
          >
        </div>
        <div v-else-if="it.state === 'uploading'" class="mu-ops">
          <a-button size="small" type="link" @click="cancel(it)">取消</a-button>
        </div>
        <div v-if="it.state === 'done' && it.note" class="mu-note">{{ it.note }}</div>
        <div v-if="multiple && it.state === 'done' && i === 0 && coverLabel" class="mu-badge">
          {{ coverLabel }}
        </div>
      </div>

      <label
        v-if="canAdd"
        class="mu-add"
        :class="{ 'is-disabled': disabled, 'is-over': dragging }"
        @dragover.prevent="dragging = !disabled"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input
          type="file"
          class="mu-input"
          :accept="accept"
          :multiple="multiple"
          :disabled="disabled"
          @change="onPick"
        />
        <span class="mu-plus">+</span>
        <span>{{ kind === 'image' ? '上传图片' : '上传视频' }}</span>
      </label>
    </div>
    <div class="mu-hint">{{ hint || limits.label }}</div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { UPLOAD_LIMITS, type UploadConfirmResult, type UploadKind } from '@/api/plaza-admin';

import { UploadError, checkFile, uploadMedia } from './upload';

interface Item {
  uid: number;
  url: string;
  /** 本地预览（objectURL），上传期间与刚传完时用，避免等 CDN */
  preview?: string;
  state: 'done' | 'uploading' | 'error';
  percent: number;
  error?: string;
  /** 失败后可重试的原文件 */
  file?: File;
  rejected?: boolean;
  note?: string;
  ctrl?: AbortController;
}

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    kind: UploadKind;
    /** 最多几个；1 = 单个（再传会替换） */
    max?: number;
    disabled?: boolean;
    hint?: string;
    /** 第一个的角标（如「封面」） */
    coverLabel?: string;
    /** 视频预览用的封面图 */
    poster?: string;
  }>(),
  { max: 1, disabled: false, hint: '', coverLabel: '', poster: '' },
);
const emit = defineEmits<{
  (e: 'update:modelValue', v: string[]): void;
  /** 一个文件 confirm 通过（视频带 coverUrl / mediaStatus，由编辑器决定怎么用） */
  (e: 'uploaded', r: UploadConfirmResult): void;
}>();

const limits = computed(() => UPLOAD_LIMITS[props.kind]);
const accept = computed(() => limits.value.types.join(','));
const multiple = computed(() => props.max > 1);

let seq = 0;
const items = ref<Item[]>([]);
const dragging = ref(false);

const done = computed(() => items.value.filter((x) => x.state === 'done'));
const lastDone = computed(() => items.value.map((x) => x.state).lastIndexOf('done'));
const canAdd = computed(
  () => !props.disabled && (multiple.value ? items.value.length < props.max : true),
);

/** 外部值变化（打开 / 重置 / 别处改了）：按 url 复用已有的完成项，保留进行中 / 失败的项 */
watch(
  () => props.modelValue,
  (urls) => {
    const cur = done.value.map((x) => x.url);
    if (cur.length === urls.length && cur.every((u, i) => u === urls[i])) return;
    const byUrl = new Map(done.value.map((x) => [x.url, x] as const));
    const next: Item[] = urls.map(
      (u) => byUrl.get(u) ?? { uid: ++seq, url: u, state: 'done', percent: 100 },
    );
    items.value = [...next, ...items.value.filter((x) => x.state !== 'done')];
  },
  { immediate: true, deep: true },
);

function sync() {
  emit(
    'update:modelValue',
    done.value.map((x) => x.url),
  );
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  addFiles(Array.from(input.files ?? []));
  input.value = '';
}
function onDrop(e: DragEvent) {
  dragging.value = false;
  if (props.disabled) return;
  addFiles(Array.from(e.dataTransfer?.files ?? []));
}

function addFiles(files: File[]) {
  if (!files.length) return;
  let list = files;
  if (!multiple.value) list = files.slice(0, 1);
  else {
    const room = props.max - items.value.length;
    if (list.length > room)
      message.warning(`最多 ${props.max} 个，已忽略多出的 ${list.length - room} 个`);
    list = list.slice(0, Math.max(room, 0));
  }
  for (const f of list) {
    const bad = checkFile(f, props.kind);
    if (bad) {
      message.error(bad);
      continue;
    }
    // 单个模式：先把旧的拿掉（新的传成功才算数，失败时旧的已经被替换会丢；所以成功后再移除旧项）
    const it: Item = {
      uid: ++seq,
      url: '',
      preview: URL.createObjectURL(f),
      state: 'uploading',
      percent: 0,
      file: f,
    };
    items.value.push(it);
    start(it);
  }
}

async function start(it: Item) {
  it.state = 'uploading';
  it.percent = 0;
  it.error = undefined;
  it.rejected = false;
  const ctrl = new AbortController();
  it.ctrl = ctrl;
  const file = it.file!;
  try {
    const r = await uploadMedia(
      file,
      props.kind,
      (ratio) => (it.percent = Math.round(ratio * 100)),
      ctrl.signal,
    );
    it.url = r.url;
    it.state = 'done';
    it.percent = 100;
    it.note = r.note;
    it.file = undefined;
    if (!multiple.value) {
      // 单个模式：新的成功了，换掉旧的
      for (const old of items.value.filter((x) => x !== it && x.state === 'done')) release(old);
      items.value = items.value.filter((x) => x === it || x.state !== 'done');
    }
    sync();
    emit('uploaded', r);
  } catch (e) {
    if (ctrl.signal.aborted) {
      remove(it);
      return;
    }
    it.state = 'error';
    it.error = e instanceof Error ? e.message : '上传失败';
    it.rejected = e instanceof UploadError && e.rejected;
  }
}

function release(it: Item) {
  if (it.preview) URL.revokeObjectURL(it.preview);
}
function cancel(it: Item) {
  it.ctrl?.abort();
}
function remove(it: Item) {
  it.ctrl?.abort();
  release(it);
  items.value = items.value.filter((x) => x !== it);
  sync();
}
function move(i: number, d: -1 | 1) {
  const arr = items.value;
  const j = i + d;
  if (j < 0 || j >= arr.length || arr[j].state !== 'done') return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  sync();
}

onBeforeUnmount(() => {
  for (const it of items.value) {
    it.ctrl?.abort();
    release(it);
  }
});

/** 是否还有进行中的上传（编辑器保存前用来拦一下） */
defineExpose({ busy: () => items.value.some((x) => x.state === 'uploading') });
</script>

<style scoped>
.mu-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.mu-item {
  position: relative;
  width: 112px;
}
.mu-box {
  position: relative;
  width: 112px;
  height: 112px;
  overflow: hidden;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 6px;
  background: var(--ant-color-fill-quaternary, #fafafa);
}
.is-err .mu-box {
  border-color: var(--ant-color-error, #ff4d4f);
}
.mu-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.mu-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px;
  background: rgb(255 255 255 / 78%);
}
.mu-err-text {
  color: var(--ant-color-error, #ff4d4f);
  font-size: 12px;
  line-height: 1.3;
  text-align: center;
  max-height: 60px;
  overflow: hidden;
}
.mu-ops {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}
.mu-ops :deep(.ant-btn) {
  padding: 0 4px;
}
.mu-note {
  color: var(--ant-color-warning, #faad14);
  font-size: 12px;
  line-height: 1.3;
}
.mu-badge {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0 6px;
  border-radius: 6px 0 6px 0;
  background: var(--ant-color-primary, #1677ff);
  color: #fff;
  font-size: 12px;
}
.mu-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  cursor: pointer;
  border: 1px dashed var(--ant-color-border, #d9d9d9);
  border-radius: 6px;
  color: var(--ant-color-text-secondary, #666);
  font-size: 12px;
}
.mu-add:hover,
.mu-add.is-over {
  border-color: var(--ant-color-primary, #1677ff);
  color: var(--ant-color-primary, #1677ff);
}
.mu-add.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.mu-plus {
  font-size: 24px;
  line-height: 1;
}
.mu-input {
  display: none;
}
.mu-hint {
  margin-top: 6px;
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
</style>
