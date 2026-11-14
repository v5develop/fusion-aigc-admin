<template>
  <a-drawer
    :open="open"
    :title="title"
    :width="showPreview ? 1320 : 900"
    :mask-closable="false"
    destroy-on-close
    @update:open="onClose"
  >
    <a-alert
      v-if="readonly"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="WRITE_DISABLED_TIP"
      description="交接期模板基础字段还在原后台维护，这里只能查看；入参配置、行业、渠道与示例素材仍可在列表里单独修改。"
    />
    <a-tabs v-model:active-key="tab">
      <a-tab-pane key="info" tab="基本信息" />
      <a-tab-pane v-if="editId" key="headline" tab="头条情况" />
      <a-tab-pane v-if="editId" key="history" tab="变更历史" />
    </a-tabs>
    <div class="ed-toggle">
      <a-switch v-model:checked="showPreview" size="small" />
      <span class="muted">用户视角预览</span>
    </div>

    <a-spin :spinning="loading">
      <div class="ed-layout">
        <div class="ed-main">
          <a-form
            v-show="tab === 'info'"
            :label-col="{ span: 4 }"
            :disabled="readonly"
            class="ed-form"
          >
            <a-form-item label="标题" required>
              <a-input
                v-model:value="form.title"
                :maxlength="255"
                show-count
                placeholder="用户看到的模板名"
              />
            </a-form-item>
            <a-form-item
              label="说明"
              extra="卡片上显示；同时写入内容里的 description，保持两处一致"
            >
              <a-textarea v-model:value="form.description" :rows="2" :maxlength="1000" show-count />
            </a-form-item>

            <a-form-item label="媒体类型" required>
              <a-radio-group v-model:value="form.mediaType">
                <a-radio value="image">图片</a-radio>
                <a-radio value="video">视频</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item
              label="效果图"
              required
              extra="第 1 张是封面与成品图；可调整顺序，最多 20 张"
            >
              <MediaUploader
                v-model="form.result"
                kind="image"
                :max="20"
                cover-label="封面"
                :disabled="readonly"
                ref="resultUp"
              />
            </a-form-item>
            <a-form-item label="参考输入图" extra="复刻时给用户看的「应该放进去什么」；可不填">
              <MediaUploader
                v-model="form.imageUrls"
                kind="image"
                :max="20"
                :disabled="readonly"
                ref="refUp"
              />
            </a-form-item>

            <template v-if="form.mediaType === 'video'">
              <a-form-item label="预览视频" required>
                <MediaUploader
                  v-model="form.video"
                  kind="video"
                  :max="1"
                  :poster="form.poster[0]"
                  :disabled="readonly"
                  ref="videoUp"
                  @uploaded="onVideoUploaded"
                />
              </a-form-item>
              <a-form-item v-if="mediaInfo" label="处理状态">
                <a-space direction="vertical" :size="6" style="width: 100%">
                  <a-alert
                    v-if="mediaInfo.status === 'PROCESSING'"
                    type="info"
                    show-icon
                    message="视频处理中（抽首帧封面 / 转码），完成后才能发布"
                    :description="
                      mediaInfo.error
                        ? `重试中（已试 ${mediaInfo.attempts} 次），最近一次错误：${mediaInfo.error}`
                        : '通常一两分钟内完成，这里会自动刷新状态'
                    "
                  />
                  <a-alert
                    v-else-if="mediaInfo.status === 'FAILED'"
                    type="error"
                    show-icon
                    message="视频处理失败，不能发布"
                    :description="`${mediaInfo.error || '未知原因'}（已试 ${mediaInfo.attempts} 次）。可点「重新处理」，或换一个视频 / 补传封面后保存。`"
                  >
                    <template #action>
                      <a-button
                        size="small"
                        type="primary"
                        :loading="reprocessing"
                        :disabled="readonly"
                        @click="onReprocess"
                      >
                        重新处理
                      </a-button>
                    </template>
                  </a-alert>
                  <a-alert
                    v-else
                    type="success"
                    show-icon
                    message="视频已处理好"
                    :description="mediaInfo.note || undefined"
                  />
                </a-space>
              </a-form-item>
              <a-form-item
                label="视频封面"
                :extra="
                  noCoverYet
                    ? '还没有封面：保存后由后台任务自动抽首帧；失败时可手动上传一张'
                    : '保存后后台会按需自动抽首帧；也可以手动换一张（手动封面不会被覆盖）'
                "
                :validate-status="noCoverYet ? 'warning' : undefined"
              >
                <MediaUploader
                  v-model="form.poster"
                  kind="image"
                  :max="1"
                  :disabled="readonly"
                  ref="posterUp"
                />
              </a-form-item>
            </template>

            <a-form-item label="引导语" extra="复刻时的提示，例如「上传你的产品图后发送」">
              <a-textarea v-model:value="form.guidance" :rows="2" :maxlength="1000" show-count />
            </a-form-item>
            <a-form-item label="提示词" extra="只给后台运行时用，不会下发给用户；保存时必须保留">
              <a-textarea v-model:value="form.prompt" :rows="5" :maxlength="8000" show-count />
            </a-form-item>

            <a-form-item label="绑定技能" extra="不选 = 用户选中该模板时走默认技能">
              <a-select
                v-model:value="form.agentSkillId"
                show-search
                allow-clear
                placeholder="选择技能"
                :options="skillOptions"
                :filter-option="filterSkill"
                :loading="skillsLoading"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item
              label="行业"
              extra="可多选，含二级；选二级行业时它的模板也会出现在其一级行业里。至少绑定一个才建议发布"
            >
              <a-tree-select
                v-model:value="form.industryIds"
                :tree-data="industryTree"
                multiple
                allow-clear
                tree-default-expand-all
                placeholder="选择行业"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item label="标签" extra="用于搜索，回车添加">
              <a-select
                v-model:value="form.tags"
                mode="tags"
                :token-separators="[',', '，']"
                :open="false"
                placeholder="输入后回车"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item
              label="投放渠道"
              extra="主渠道在前；宽高覆盖请在列表的「渠道与媒体类型」里改，这里保留原有覆盖"
            >
              <a-select
                v-model:value="form.channels"
                mode="multiple"
                :options="channelOptions"
                placeholder="选择渠道"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item label="其它设置">
              <a-space size="large" wrap>
                <span>需要产品图 <a-switch v-model:checked="form.needsProductImage" /></span>
                <span>文字位叠加 <a-switch v-model:checked="form.textOverlay" /></span>
                <span>
                  全局排序
                  <a-input-number
                    v-model:value="form.sortOrder"
                    :min="0"
                    :max="999999"
                    style="width: 110px"
                  />
                </span>
                <span
                  >分类 <a-input v-model:value="form.category" :maxlength="64" style="width: 140px"
                /></span>
              </a-space>
            </a-form-item>

            <a-form-item
              label="入参配置"
              extra="用户做同款时要填的位置（门头图 / 商品图 / 价格 / 店名…），单独保存，不随下面的保存按钮提交"
            >
              <a-button :disabled="!editId" @click="slotsOpen = true">
                {{
                  editId
                    ? `配置入参${slotCount !== null ? `（已有 ${slotCount} 项）` : ''}`
                    : '保存后可配置入参'
                }}
              </a-button>
            </a-form-item>

            <a-form-item
              label="上线时间"
              extra="留空 = 立即上线。上下线时间在点「保存并发布」时生效；已发布的模板改它同样点这个按钮"
            >
              <a-date-picker
                v-model:value="form.onlineAt"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item label="下线时间" extra="留空 = 不限">
              <a-date-picker
                v-model:value="form.offlineAt"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item label="高级">
              <a-collapse ghost>
                <a-collapse-panel key="raw" header="内容里其余的键（原始 JSON，保存时原样保留）">
                  <a-textarea
                    v-model:value="form.extraText"
                    :rows="6"
                    class="ed-mono"
                    :status="extraError ? 'error' : undefined"
                  />
                  <div v-if="extraError" class="ed-err">{{ extraError }}</div>
                </a-collapse-panel>
              </a-collapse>
            </a-form-item>
          </a-form>

          <HeadlineStatusCard
            v-if="editId"
            v-show="tab === 'headline'"
            :template-id="editId"
            :active="tab === 'headline'"
            :reload-key="historyKey"
          />

          <TemplateHistory
            v-if="editId"
            v-show="tab === 'history'"
            :template-id="editId"
            :active="tab === 'history'"
            :reload-key="historyKey"
          />
        </div>
        <aside v-if="showPreview && tab === 'info'" class="ed-side">
          <TemplatePreview
            :title="form.title.trim()"
            :description="form.description.trim()"
            :media-type="form.mediaType"
            :results="form.result"
            :video="form.video[0]"
            :poster="form.poster[0]"
            :tags="form.tags"
            :guidance="form.guidance.trim()"
            :slots="previewSlots"
            :industry-names="previewIndustryNames"
            :channel-names="previewChannelNames"
            :needs-product-image="form.needsProductImage"
          />
        </aside>
      </div>
    </a-spin>

    <template #footer>
      <div class="ed-footer">
        <span class="muted">
          {{ editId ? `#${editId} · 版本 ${base.revision ?? '—'}` : '新建（保存为草稿）' }}
        </span>
        <a-space>
          <a-button @click="onClose(false)">关闭</a-button>
          <a-tooltip :title="readonly ? WRITE_DISABLED_TIP : ''">
            <a-button type="primary" :loading="saving" :disabled="readonly" @click="save(false)">
              保存
            </a-button>
          </a-tooltip>
          <a-tooltip :title="publishBlocked ? WRITE_DISABLED_TIP : ''">
            <a-button
              v-permission="'plaza:publish'"
              type="primary"
              ghost
              :loading="saving"
              :disabled="readonly || publishBlocked"
              @click="save(true)"
            >
              {{ publishedNow ? '保存并更新上下线' : '保存并发布' }}
            </a-button>
          </a-tooltip>
        </a-space>
      </div>
    </template>

    <SlotsDrawer v-model:open="slotsOpen" :template="slotsTarget" @saved="onSlotsSaved" />
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import {
  PlazaError,
  WRITE_DISABLED_TIP,
  createPlazaTemplate,
  getChannelDict,
  getPlazaTemplate,
  getSkills,
  isConflictError,
  isOpBlocked,
  isWriteDisabledError,
  publishTemplate,
  reportWriteError,
  reprocessTemplateMedia,
  updatePlazaTemplate,
  type AdminSkill,
  type ChannelDict,
  type IndustryNode,
  type PlazaTemplateDetail,
  type PlazaTemplateRow,
  type PlazaTemplateSaveData,
  type UploadConfirmResult,
} from '@/api/plaza-admin';

import HeadlineStatusCard from '../HeadlineStatusCard.vue';
import SlotsDrawer from '../slots/SlotsDrawer.vue';
import MediaUploader from './MediaUploader.vue';
import TemplateHistory from './TemplateHistory.vue';
import TemplatePreview from './TemplatePreview.vue';

const props = defineProps<{
  open: boolean;
  /** null = 新建 */
  template: PlazaTemplateRow | null;
  industries: IndustryNode[];
}>();
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'saved'): void;
}>();

/** payload 里由编辑器表单管理的键；其余键（extraText）原样保留 */
const KNOWN_KEYS = ['result', 'image_urls', 'description', 'guidance', 'prompt'] as const;

interface FormState {
  title: string;
  description: string;
  category: string;
  tags: string[];
  mediaType: 'image' | 'video';
  result: string[];
  imageUrls: string[];
  video: string[];
  poster: string[];
  guidance: string;
  prompt: string;
  agentSkillId: string | undefined;
  industryIds: number[];
  channels: string[];
  needsProductImage: boolean;
  textOverlay: boolean;
  sortOrder: number | undefined;
  onlineAt: string | undefined;
  offlineAt: string | undefined;
  extraText: string;
}

const blankForm = (): FormState => ({
  title: '',
  description: '',
  category: '',
  tags: [],
  mediaType: 'image',
  result: [],
  imageUrls: [],
  video: [],
  poster: [],
  guidance: '',
  prompt: '',
  agentSkillId: undefined,
  industryIds: [],
  channels: [],
  needsProductImage: true,
  textOverlay: false,
  sortOrder: undefined,
  onlineAt: undefined,
  offlineAt: undefined,
  extraText: '{}',
});

const form = reactive<FormState>(blankForm());
const loading = ref(false);
const saving = ref(false);
const tab = ref<'info' | 'headline' | 'history'>('info');
const historyKey = ref(0);
const slotsOpen = ref(false);

/** 当前编辑的模板 id（新建保存后变成新 id，之后的保存按编辑走） */
const editId = ref<number | null>(null);
const detail = ref<PlazaTemplateDetail | null>(null);
/** 乐观并发基线：每次保存成功后换成服务端返回的 */
const base = reactive<{ revision?: number; updatedAt?: string }>({});
/** 原 payload 键序（保存时按原序写回）与原渠道项（保留宽高覆盖） */
let payloadOrder: string[] = [];
let channelsRaw: unknown[] = [];
let origSkill = '';
const slotCount = ref<number | null>(null);

const resultUp = ref<InstanceType<typeof MediaUploader>>();
const refUp = ref<InstanceType<typeof MediaUploader>>();
const videoUp = ref<InstanceType<typeof MediaUploader>>();
const posterUp = ref<InstanceType<typeof MediaUploader>>();

const readonly = computed(() => isOpBlocked('edit'));
const publishBlocked = computed(() => isOpBlocked('status'));
const publishedNow = computed(() => detail.value?.state === 'PUBLISHED');
const noCoverYet = computed(
  () => form.mediaType === 'video' && !!form.video.length && !form.poster.length,
);
/** 视频处理状态（来自详情；新建未保存时没有） */
const mediaInfo = computed(() => {
  const d = detail.value;
  if (!d || form.mediaType !== 'video' || d.mediaType !== 'video' || !d.mediaStatus) return null;
  const status = d.mediaStatus === 'PENDING' ? 'PROCESSING' : d.mediaStatus;
  return { status, error: d.mediaError, note: d.mediaNote, attempts: d.mediaAttempts ?? 0 };
});
const reprocessing = ref(false);
async function onReprocess() {
  if (!editId.value) return;
  reprocessing.value = true;
  try {
    await reprocessTemplateMedia(editId.value);
    message.success('已重新排队，后台处理中');
    await syncAfterMedia();
  } catch (e) {
    reportWriteError(e);
  } finally {
    reprocessing.value = false;
  }
}

/**
 * 处理中轮询：只在表单没有未保存修改时把后端结果同步进来（revision 基线、自动抽出的封面、转码后的新视频地址）。
 * 有未保存修改时不动基线：之后保存会按 revision 冲突提示重新载入，避免把任务写好的封面覆盖掉。
 */
async function syncAfterMedia() {
  const id = editId.value;
  if (!id) return;
  const d = await getPlazaTemplate(id);
  if (id !== editId.value) return;
  const clean = !dirty.value;
  detail.value = d;
  if (clean) {
    base.revision = d.revision;
    base.updatedAt = d.updateTime;
    form.video = d.videoUrl ? [d.videoUrl] : [];
    form.poster = d.posterUrl ? [d.posterUrl] : [];
    takeSnapshot();
  }
  historyKey.value++;
  if (d.mediaStatus !== 'PROCESSING') emit('saved');
}
let mediaPoll: ReturnType<typeof setInterval> | undefined;
watch(
  () => [props.open, detail.value?.mediaStatus, editId.value] as const,
  ([open, st, id]) => {
    clearInterval(mediaPoll);
    if (!open || !id || st !== 'PROCESSING') return;
    mediaPoll = setInterval(() => {
      syncAfterMedia().catch(() => undefined);
    }, 6000);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(mediaPoll));
const title = computed(() =>
  editId.value ? `编辑模板：${form.title || detail.value?.title || ''}` : '新建模板',
);
const slotsTarget = computed(() => detail.value as PlazaTemplateRow | null);

// ---- 用户视角预览（右侧）----
const showPreview = ref(true);
/** 入参在「配置入参」里单独保存，预览用已保存的那份 */
const previewSlots = computed(() => detail.value?.slots?.items ?? []);
const flatIndustries = computed(() => props.industries.flatMap((r) => [r, ...(r.children ?? [])]));
const previewIndustryNames = computed(() =>
  form.industryIds
    .map((id) => flatIndustries.value.find((x) => x.id === id)?.name)
    .filter((n): n is string => !!n),
);
const previewChannelNames = computed(() =>
  form.channels.map((code) => channelDict.value.find((c) => c.code === code)?.name ?? code),
);

// ---- 未保存修改：快照与二次确认 ----
/** 载入 / 保存成功后的表单快照；与当前表单不同 = 有未保存修改 */
const snapshot = ref('');
const takeSnapshot = () => {
  snapshot.value = JSON.stringify(form);
};
const dirty = computed(() => JSON.stringify(form) !== snapshot.value);

// ---- 字典：技能 / 渠道 / 行业 ----
const skills = ref<AdminSkill[]>([]);
const skillsLoading = ref(false);
const channelDict = ref<ChannelDict[]>([]);

async function loadDicts() {
  skillsLoading.value = true;
  try {
    skills.value = (await getSkills())?.items ?? [];
  } catch {
    skills.value = [];
    message.warning('技能列表加载失败，绑定技能暂不可改');
  } finally {
    skillsLoading.value = false;
  }
  try {
    channelDict.value = (await getChannelDict()) ?? [];
  } catch {
    channelDict.value = [];
  }
}

const skillOptions = computed(() => {
  const list = skills.value.map((s) => ({
    value: s.agentSkillId,
    label: `${s.title}${s.category ? `（${s.category}）` : ''}${s.enabled ? '' : ' · 已停用'}`,
    // 已停用的不让新绑定；当前已绑的保留可见
    disabled: !s.enabled && s.agentSkillId !== form.agentSkillId,
  }));
  // 技能列表里没有（被删 / 列表没加载出来）但模板已绑：保留一项让它回显，不静默丢掉绑定
  if (form.agentSkillId && !list.some((x) => x.value === form.agentSkillId))
    list.unshift({
      value: form.agentSkillId,
      label: `技能 #${form.agentSkillId}（不在目录里）`,
      disabled: false,
    });
  return list;
});
const filterSkill = (input: string, opt?: { label?: unknown }) =>
  String(opt?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());

const channelOptions = computed(() => {
  const list = channelDict.value
    .filter((c) => c.enabled || form.channels.includes(c.code))
    .map((c) => ({
      value: c.code,
      label: `${c.name}（${c.width}×${c.height}）${c.enabled ? '' : ' · 已停用'}`,
    }));
  for (const code of form.channels)
    if (!list.some((x) => x.value === code)) list.push({ value: code, label: code });
  return list;
});

const industryTree = computed(() =>
  props.industries.map((r) => ({
    title: r.enabled ? r.name : `${r.name}（停用）`,
    value: r.id,
    children: (r.children ?? []).map((c) => ({
      title: c.enabled ? c.name : `${c.name}（停用）`,
      value: c.id,
    })),
  })),
);

// ---- 载入 ----
const toLocal = (t: string | null | undefined) =>
  t ? t.replace('T', ' ').slice(0, 19) : undefined;

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const asText = (v: unknown): string => (typeof v === 'string' ? v : '');

function fillFrom(d: PlazaTemplateDetail) {
  detail.value = d;
  editId.value = d.id;
  const payload = (d.payload ?? {}) as Record<string, unknown>;
  payloadOrder = Object.keys(payload);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload))
    if (!(KNOWN_KEYS as readonly string[]).includes(k)) extra[k] = v;
  Object.assign(form, {
    title: d.title,
    description: d.description ?? '',
    category: d.category ?? '',
    tags: [...(d.tags ?? [])],
    mediaType: d.mediaType,
    result: asStrings(payload.result),
    imageUrls: asStrings(payload.image_urls),
    video: d.videoUrl ? [d.videoUrl] : [],
    poster: d.posterUrl ? [d.posterUrl] : [],
    guidance: asText(payload.guidance),
    prompt: asText(payload.prompt),
    agentSkillId: d.agentSkillId || undefined,
    industryIds: [...(d.industryIds ?? [])],
    needsProductImage: d.needsProductImage,
    textOverlay: d.textOverlay,
    sortOrder: d.sortOrder,
    onlineAt: toLocal(d.onlineAt),
    offlineAt: toLocal(d.offlineAt),
    extraText: JSON.stringify(extra, null, 2),
  } satisfies Partial<FormState>);
  channelsRaw = Array.isArray(d.channels) ? d.channels : [];
  form.channels = channelsRaw
    .map((c) => (typeof c === 'string' ? c : (c as { code?: string })?.code))
    .filter((c): c is string => !!c);
  origSkill = d.agentSkillId ?? '';
  slotCount.value = d.slots?.items?.length ?? null;
  base.revision = d.revision;
  base.updatedAt = d.updateTime;
  takeSnapshot();
}

function resetNew() {
  Object.assign(form, blankForm());
  detail.value = null;
  editId.value = null;
  payloadOrder = [];
  channelsRaw = [];
  origSkill = '';
  slotCount.value = null;
  base.revision = undefined;
  base.updatedAt = undefined;
  takeSnapshot();
}

async function loadDetail(id: number) {
  loading.value = true;
  try {
    fillFrom(await getPlazaTemplate(id));
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (o) => {
    if (!o) return;
    tab.value = 'info';
    historyKey.value++;
    loadDicts();
    if (props.template) loadDetail(props.template.id);
    else resetNew();
  },
  { immediate: true },
);

// ---- 上传联动 ----
function onVideoUploaded(r: UploadConfirmResult) {
  // 抽到了封面就用它（覆盖旧封面：旧视频的封面对新视频没有意义）；没抽到不要紧，保存后后台任务会再抽
  if (r.coverUrl) form.poster = [r.coverUrl];
  else {
    form.poster = [];
    message.info(r.note || '封面暂未生成，保存后由后台任务自动抽取');
  }
}

// ---- 构造请求 ----
const extraObj = computed<
  { ok: true; value: Record<string, unknown> } | { ok: false; error: string }
>(() => {
  const t = form.extraText.trim();
  if (!t) return { ok: true, value: {} };
  try {
    const v = JSON.parse(t) as unknown;
    if (v === null || typeof v !== 'object' || Array.isArray(v))
      return { ok: false, error: '必须是 JSON 对象' };
    return { ok: true, value: v as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: `不是合法 JSON：${e instanceof Error ? e.message : ''}` };
  }
});
const extraError = computed(() => (extraObj.value.ok ? '' : extraObj.value.error));

/** 已知键由表单覆盖、其余键原样保留；键序沿用原载荷，新增的键排在后面 */
function buildPayload(extra: Record<string, unknown>): Record<string, unknown> {
  const known: Record<string, unknown> = {
    result: form.result,
    image_urls: form.imageUrls,
    description: form.description.trim(),
    guidance: form.guidance.trim(),
    prompt: form.prompt,
  };
  const out: Record<string, unknown> = {};
  for (const k of payloadOrder) {
    if (k in known) out[k] = known[k];
    else if (k in extra) out[k] = extra[k];
  }
  for (const [k, v] of Object.entries(extra)) if (!(k in out) && !(k in known)) out[k] = v;
  for (const k of KNOWN_KEYS) {
    const v = known[k];
    const empty = Array.isArray(v) ? v.length === 0 : v === '';
    if (!(k in out) && !empty) out[k] = v;
  }
  return out;
}

function buildChannels(): unknown[] {
  return form.channels.map((code) => {
    const orig = channelsRaw.find(
      (c) => (typeof c === 'string' ? c : (c as { code?: string })?.code) === code,
    );
    return orig ?? code;
  });
}

function validate(): string | null {
  if (!form.title.trim()) return '标题必填';
  if (!extraObj.value.ok) return `「其余的键」${extraObj.value.error}`;
  if (form.mediaType === 'video' && !form.video.length) return '视频模板必须上传预览视频';
  for (const up of [resultUp, refUp, videoUp, posterUp])
    if (up.value?.busy()) return '还有素材在上传，请等它传完（或取消）再保存';
  return null;
}

function buildBody(): PlazaTemplateSaveData {
  const extra = extraObj.value.ok ? extraObj.value.value : {};
  const body: PlazaTemplateSaveData = {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    tags: form.tags.map((t) => t.trim()).filter(Boolean),
    payload: buildPayload(extra),
    mediaType: form.mediaType,
    videoUrl: form.mediaType === 'video' ? form.video[0] : '',
    posterUrl: form.mediaType === 'video' ? (form.poster[0] ?? '') : '',
    channels: buildChannels(),
    needsProductImage: form.needsProductImage,
    textOverlay: form.textOverlay,
    industryIds: form.industryIds,
  };
  if (form.sortOrder !== undefined && form.sortOrder !== null) body.sortOrder = form.sortOrder;
  // 编辑：清空 = 解绑（""），没动 = 不改；新建：没选就不带
  const skill = form.agentSkillId ?? '';
  if (editId.value) {
    if (skill !== origSkill) body.agentSkillId = skill;
  } else if (skill) body.agentSkillId = skill;
  return body;
}

// ---- 保存 ----
async function save(andPublish: boolean) {
  const bad = validate();
  if (bad) {
    message.warning(bad);
    return;
  }
  let force = false;
  if (andPublish) {
    if (!form.result.length) {
      message.warning('发布需要至少一张效果图');
      return;
    }
    if (form.onlineAt && form.offlineAt && form.offlineAt <= form.onlineAt) {
      message.warning('下线时间必须晚于上线时间');
      return;
    }
    if (!form.industryIds.length) {
      const goOn = await new Promise<boolean>((resolve) =>
        Modal.confirm({
          title: '没有绑定行业，仍然发布？',
          content: '没有行业的模板用户端看不到。可以先去绑定行业，也可以先发布。',
          okText: '仍然发布',
          cancelText: '去绑定',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        }),
      );
      if (!goOn) return;
      force = true;
    }
  }

  saving.value = true;
  try {
    const body = buildBody();
    if (editId.value) {
      body.updatedAt = base.updatedAt;
      body.revision = base.revision;
      const r = await updatePlazaTemplate(editId.value, body);
      if (r) {
        base.updatedAt = r.updatedAt;
        base.revision = r.revision;
      }
    } else {
      const r = await createPlazaTemplate(body);
      editId.value = r.id;
    }
  } catch (e) {
    onSaveError(e);
    saving.value = false;
    return;
  }

  // 保存已成功。发布失败不回滚保存，留在编辑器里让运营修
  const id = editId.value!;
  if (andPublish) {
    try {
      const pr = await publishTemplate(id, {
        onlineAt: form.onlineAt || undefined,
        offlineAt: form.offlineAt || undefined,
        force: force || undefined,
      });
      pr?.warnings?.forEach((w) => message.warning(w));
    } catch {
      saving.value = false;
      message.warning('已保存，但发布没成功（原因见上一条提示）');
      await loadDetail(id);
      emit('saved');
      return;
    }
  }
  saving.value = false;
  message.success(andPublish ? '已保存并发布' : '已保存');
  emit('saved');
  emit('update:open', false);
}

function onSaveError(e: unknown) {
  if (isConflictError(e)) {
    Modal.confirm({
      title: '他人已修改这个模板',
      content:
        '你打开之后它被改过（可能是别人，也可能是你在别处保存过）。重新载入会丢掉你当前未保存的修改。',
      okText: '重新载入最新内容',
      cancelText: '先不，我复制一下再说',
      onOk: () => (editId.value ? loadDetail(editId.value) : undefined),
    });
  } else if (isWriteDisabledError(e)) {
    message.warning(WRITE_DISABLED_TIP);
  } else if (e instanceof PlazaError && e.field) {
    message.error(`${e.message}（${e.field}）`);
  } else {
    reportWriteError(e);
  }
}

// ---- 入参配置 ----
async function onSlotsSaved() {
  // 入参接口也 bump revision：只刷新乐观并发基线与计数，不动表单里没保存的修改
  if (!editId.value) return;
  try {
    const d = await getPlazaTemplate(editId.value);
    detail.value = d;
    base.revision = d.revision;
    base.updatedAt = d.updateTime;
    slotCount.value = d.slots?.items?.length ?? null;
    historyKey.value++;
  } catch {
    /* 已提示 */
  }
  emit('saved');
}

// ---- 关闭 ----
function onClose(v: boolean) {
  if (v) return;
  if (!dirty.value || readonly.value) {
    emit('update:open', false);
    return;
  }
  Modal.confirm({
    title: '有未保存的修改，确定关闭？',
    content: '关闭后这些修改会丢失。',
    okText: '放弃修改并关闭',
    okType: 'danger',
    cancelText: '继续编辑',
    onOk: () => emit('update:open', false),
  });
}
</script>

<style scoped>
.ed-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin: -8px 0 8px;
}
.ed-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.ed-main {
  flex: 1;
  min-width: 0;
}
.ed-side {
  position: sticky;
  top: 0;
  width: 400px;
  flex: none;
}
.ed-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.ed-mono :deep(textarea),
.ed-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.ed-err {
  margin-top: 4px;
  color: var(--ant-color-error, #ff4d4f);
  font-size: 12px;
}
</style>
