<template>
  <div class="media-field">
    <!-- 已有素材：显示预览 + 基本信息 -->
    <div v-if="preview" class="filled">
      <div class="thumb">
        <video
          v-if="preview.kind === 'video' && preview.previewUrl"
          :src="preview.previewUrl"
          controls
          muted
          preload="metadata"
          playsinline
        />
        <img v-else-if="preview.previewUrl" :src="preview.previewUrl" :alt="label" />
        <span v-else class="muted">无预览</span>
      </div>
      <div class="info">
        <div class="kind">{{ kindText(preview.kind) }} · 已就绪</div>
        <div class="muted">{{ metaText(preview) }}</div>
        <div class="actions">
          <a-button size="small" :disabled="disabled || uploading" @click="pickFile">替换</a-button>
          <a-button size="small" danger :disabled="disabled || uploading" @click="clear"
            >移除</a-button
          >
          <a-button size="small" type="link" @click="showTech = !showTech">
            {{ showTech ? '收起技术编号' : '技术编号' }}
          </a-button>
        </div>
        <div v-if="showTech" class="tech">
          <code>{{ preview.rid }}</code>
          <a-button size="small" type="link" @click="copyRid">复制</a-button>
        </div>
      </div>
    </div>

    <!-- 上传中 -->
    <div v-else-if="uploading" class="drop busy">
      <a-spin size="small" />
      <span>正在上传「{{ uploadingName }}」…</span>
      <span class="muted">大文件可能需要几分钟，请不要关闭页面</span>
    </div>

    <!-- 空：上传 或 粘贴已有编号 -->
    <div v-else>
      <label
        class="drop"
        :class="{ disabled, over: dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <span class="title">点击或拖入{{ label }}</span>
        <span class="muted">{{ acceptHint }}，最大 200MB</span>
        <input
          ref="fileEl"
          type="file"
          class="hidden"
          :accept="accept"
          :disabled="disabled"
          @change="onFileChange"
        />
      </label>
      <div class="paste">
        <a-button
          v-if="!pasting"
          type="link"
          size="small"
          :disabled="disabled"
          @click="pasting = true"
        >
          已有素材？粘贴素材编号
        </a-button>
        <div v-else class="paste-row">
          <a-input
            v-model:value="pasteValue"
            size="small"
            allow-clear
            placeholder="粘贴编号（如 mr://xxxx 或 xxxx）"
            @press-enter="resolvePaste"
          />
          <a-button size="small" type="primary" :loading="resolving" @click="resolvePaste"
            >确认</a-button
          >
          <a-button size="small" @click="cancelPaste">取消</a-button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error" role="alert">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 示例素材输入（原视频 / 封面 / 成片）：运营上传文件或粘贴已有编号，界面只展示预览和信息，
 * 裸编号收在「技术编号」里，排查时才展开。上传与解析走 admin-api（replicate:sample）。
 */
import { message } from 'antdv-next';
import { onMounted, ref, watch } from 'vue';

import {
  resolveSampleMedia,
  uploadSampleMedia,
  type SampleMediaPreview,
} from '@/api/replicate-admin';

const props = withDefaults(
  defineProps<{
    /** 当前编号（裸 rid 或 mr://rid；空串 = 未设置） */
    modelValue: string;
    label: string;
    /** video = 只收视频；any = 视频或图片 */
    kind?: 'video' | 'any';
    disabled?: boolean;
  }>(),
  { kind: 'any', disabled: false },
);
const emit = defineEmits<{
  'update:modelValue': [rid: string];
  preview: [p: SampleMediaPreview | null];
}>();

const preview = ref<SampleMediaPreview | null>(null);
const error = ref('');
const uploading = ref(false);
const uploadingName = ref('');
const resolving = ref(false);
const pasting = ref(false);
const pasteValue = ref('');
const showTech = ref(false);
const dragging = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);

const accept =
  props.kind === 'video'
    ? 'video/mp4,video/quicktime,video/webm'
    : 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp';
const acceptHint =
  props.kind === 'video' ? 'MP4 / MOV / WebM' : 'MP4 / MOV / WebM，或 JPG / PNG / WebP';

const stripRid = (v: string) => v.trim().replace(/^mr:\/\//, '');
const kindText = (k: SampleMediaPreview['kind']) =>
  ({ video: '视频', image: '图片', other: '文件' })[k];
function metaText(p: SampleMediaPreview): string {
  const parts: string[] = [];
  if (p.durationS > 0) parts.push(`${p.durationS.toFixed(1)} 秒`);
  if (p.width > 0 && p.height > 0) parts.push(`${p.width}×${p.height}`);
  if (p.bytes > 0) parts.push(`${(p.bytes / 1024 / 1024).toFixed(1)} MB`);
  return parts.join(' · ') || '—';
}

function setPreview(p: SampleMediaPreview | null) {
  preview.value = p;
  emit('preview', p);
}

/** 外部改了编号（比如打开编辑）：编号不一样才重新解析，避免上传后重复请求 */
async function loadFrom(value: string) {
  const rid = stripRid(value);
  if (!rid) return setPreview(null);
  if (preview.value?.rid === rid) return;
  try {
    setPreview(await resolveSampleMedia(rid));
    error.value = '';
  } catch {
    // 解析失败：保留编号，告诉运营「找不到」，让他重新上传或换编号
    setPreview(null);
    error.value = '找不到这份素材（编号可能已失效），请重新上传';
  }
}

async function upload(file: File) {
  error.value = '';
  if (
    props.kind === 'video' &&
    !/^video\//.test(file.type) &&
    !/\.(mp4|mov|webm)$/i.test(file.name)
  ) {
    error.value = '这里只收视频文件';
    return;
  }
  if (file.size > 200 * 1024 * 1024) {
    error.value = '文件超过 200MB，请先压缩后再上传';
    return;
  }
  uploading.value = true;
  uploadingName.value = file.name;
  try {
    const p = await uploadSampleMedia(file);
    emit('update:modelValue', p.rid);
    setPreview(p);
    message.success('上传完成');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    error.value = msg && msg !== 'network' ? msg : '上传没成功，请重新选择文件';
  } finally {
    uploading.value = false;
  }
}

function pickFile() {
  fileEl.value?.click();
}
function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void upload(f);
  (e.target as HTMLInputElement).value = '';
}
function onDrop(e: DragEvent) {
  dragging.value = false;
  if (props.disabled) return;
  const f = e.dataTransfer?.files?.[0];
  if (f) void upload(f);
}

async function resolvePaste() {
  const rid = stripRid(pasteValue.value);
  if (!rid) {
    error.value = '请粘贴素材编号';
    return;
  }
  resolving.value = true;
  error.value = '';
  try {
    const p = await resolveSampleMedia(rid);
    emit('update:modelValue', p.rid);
    setPreview(p);
    pasting.value = false;
    pasteValue.value = '';
  } catch {
    error.value = '找不到这个编号的素材，请确认后再试';
  } finally {
    resolving.value = false;
  }
}
function cancelPaste() {
  pasting.value = false;
  pasteValue.value = '';
  error.value = '';
}

function clear() {
  error.value = '';
  emit('update:modelValue', '');
  setPreview(null);
}

async function copyRid() {
  if (!preview.value) return;
  try {
    await navigator.clipboard.writeText(preview.value.rid);
    message.success('已复制');
  } catch {
    message.warning('复制失败，请手动选择编号');
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (stripRid(v) !== (preview.value?.rid ?? '')) void loadFrom(v);
  },
);
onMounted(() => {
  if (props.modelValue) void loadFrom(props.modelValue);
});
</script>

<style scoped>
.media-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.hidden {
  display: none;
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 96px;
  padding: 12px;
  border: 1px dashed var(--ant-color-border, #d9d9d9);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
}
.drop:hover,
.drop.over {
  border-color: var(--ant-color-primary, #1677ff);
}
.drop.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.drop.busy {
  cursor: default;
  flex-direction: row;
  gap: 8px;
}
.title {
  font-weight: 500;
}
.paste-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.filled {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.thumb {
  flex: 0 0 96px;
  height: 128px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ant-color-fill-tertiary, #f5f5f5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb video,
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.kind {
  font-weight: 500;
}
.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tech {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.tech code {
  word-break: break-all;
  font-size: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.error {
  color: var(--ant-color-error, #ff4d4f);
  font-size: 12px;
}
</style>
