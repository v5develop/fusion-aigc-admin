<template>
  <a-modal
    :open="open"
    :title="sample ? t('replicateSample.editTitle') : t('replicateSample.createTitle')"
    width="960px"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }"
    :mask-closable="false"
    destroy-on-close
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <!-- 身份信息：始终可见（标题是示例在列表里的名字） -->
    <a-form layout="vertical" class="head">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item :label="t('replicateSample.fTitle')" required>
            <a-input
              v-model:value="form.title"
              :maxlength="40"
              show-count
              :placeholder="t('replicateSample.fTitlePh')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="t('replicateSample.fIndustry')">
            <a-select
              v-if="industryOptions.length"
              v-model:value="form.industry"
              allow-clear
              show-search
              option-filter-prop="label"
              :options="industryOptions"
              :placeholder="t('replicateSample.fIndustryPh')"
            />
            <a-input
              v-else
              v-model:value="form.industry"
              :maxlength="64"
              allow-clear
              :placeholder="t('replicateSample.fIndustryCodePh')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="4">
          <a-form-item :label="t('replicateSample.fSort')">
            <a-input-number v-model:value="form.sortOrder" :precision="0" class="full" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <!-- 内容多的两块用标签切换；面板不销毁，切换不丢已上传的素材与改法 -->
    <a-tabs v-model:active-key="tab" class="tabs">
      <a-tab-pane key="media" :tab="mediaTabLabel">
        <div class="pane">
          <a-row :gutter="16">
            <a-col :span="8">
              <div class="mat-label">
                <span class="req">*</span>{{ t('replicateSample.fSource') }}
              </div>
              <SampleMediaField
                :model-value="form.sourceRid"
                :label="t('replicateSample.fSource')"
                kind="video"
                layout="card"
                @update:model-value="form.sourceRid = $event"
              />
              <div v-if="sourceChanged" class="warn">
                {{ t('replicateSample.sourceChangedWarn') }}
              </div>
            </a-col>
            <a-col :span="8">
              <div class="mat-label">{{ t('replicateSample.fCover') }}</div>
              <SampleMediaField
                :model-value="form.coverRid"
                :label="t('replicateSample.fCover')"
                kind="any"
                layout="card"
                @update:model-value="form.coverRid = $event"
              />
            </a-col>
            <a-col :span="8">
              <div class="mat-label">{{ t('replicateSample.fResult') }}</div>
              <SampleMediaField
                :model-value="form.resultRid"
                :label="t('replicateSample.fResult')"
                kind="video"
                layout="card"
                @update:model-value="form.resultRid = $event"
              />
            </a-col>
          </a-row>
        </div>
      </a-tab-pane>
      <a-tab-pane key="annotation" :tab="annotationTabLabel">
        <div class="pane">
          <AnnotationEditor v-model="form.annotations" />
        </div>
      </a-tab-pane>
    </a-tabs>

    <!-- 保存时才需要决定的两项放在按钮旁边 -->
    <template #footer>
      <div class="footer">
        <div class="footer-opts">
          <span class="opt">
            <a-switch v-model:checked="form.enabled" size="small" />
            <span>{{ t('replicateSample.fEnabled') }}</span>
          </span>
          <a-checkbox v-model:checked="form.analyze">{{
            t('replicateSample.fAnalyze')
          }}</a-checkbox>
        </div>
        <a-space>
          <a-button @click="$emit('update:open', false)">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submit">保存</a-button>
        </a-space>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  createSample,
  updateSample,
  type SampleAdminRow,
  type SampleSaveBody,
} from '@/api/replicate-admin';

import AnnotationEditor from './AnnotationEditor.vue';
import { isRidLike, parseAnnotations } from './sample-meta';
import SampleMediaField from './SampleMediaField.vue';

const props = defineProps<{
  open: boolean;
  /** null = 新建 */
  sample: SampleAdminRow | null;
  industryOptions: { label: string; value: string }[];
}>();
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'saved', row: SampleAdminRow): void;
}>();

const { t } = useI18n();

const stripRid = (v: string) => v.trim().replace(/^mr:\/\//, '');

const blank = () => ({
  title: '',
  industry: undefined as string | undefined,
  sourceRid: '',
  coverRid: '',
  resultRid: '',
  annotations: '',
  sortOrder: 0 as number | null,
  enabled: true,
  analyze: true,
});
type TabKey = 'media' | 'annotation';
const tab = ref<TabKey>('media');
const form = reactive(blank());
const saving = ref(false);

/** 标签名直接显示进度：素材已放几项、改法改了几项 */
const mediaTabLabel = computed(() => {
  const n = [form.sourceRid, form.coverRid, form.resultRid].filter((v) => v.trim()).length;
  return `素材 ${n}/3`;
});
const annotationTabLabel = computed(() => {
  const a = parseAnnotations(form.annotations);
  if (!a) return '改法 · 未设置';
  const dims = a.dims && typeof a.dims === 'object' ? Object.keys(a.dims as object).length : 0;
  const n = dims + (a.audio ? 1 : 0);
  return n ? `改法 · 改了 ${n} 项` : '改法 · 未设置';
});

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    tab.value = 'media';
    const s = props.sample;
    Object.assign(
      form,
      s
        ? {
            title: s.title,
            industry: s.industry || undefined,
            sourceRid: s.sourceRid,
            coverRid: s.coverRid,
            resultRid: s.resultRid,
            annotations: s.annotations ? JSON.stringify(s.annotations, null, 2) : '',
            sortOrder: s.sortOrder,
            enabled: s.enabled,
            analyze: false,
          }
        : blank(),
    );
  },
  { immediate: true },
);

/** 编辑时换了原片：后端会清掉已发布的分析 */
const sourceChanged = computed(
  () =>
    !!props.sample &&
    !!form.sourceRid.trim() &&
    stripRid(form.sourceRid) !== stripRid(props.sample.sourceRid),
);

/** 校验没过：切到出问题的标签页再提示，运营不用自己去找 */
function failOn(key: TabKey, msg: string) {
  tab.value = key;
  return message.warning(msg);
}

async function submit() {
  const title = form.title.trim();
  if (!title) return message.warning(t('replicateSample.titleRequired'));
  if (!form.sourceRid.trim()) return failOn('media', t('replicateSample.sourceRequired'));
  const rids: [string, string][] = [
    [t('replicateSample.fSource'), form.sourceRid],
    [t('replicateSample.fCover'), form.coverRid],
    [t('replicateSample.fResult'), form.resultRid],
  ];
  const bad = rids.find(([, v]) => !isRidLike(v));
  if (bad) return failOn('media', t('replicateSample.ridInvalid', { field: bad[0] }));
  const annotations = parseAnnotations(form.annotations);
  if (annotations === undefined)
    return failOn('annotation', t('replicateSample.annotationsInvalid'));

  const body: SampleSaveBody = {
    title,
    industry: (form.industry ?? '').trim(),
    sourceRid: form.sourceRid.trim(),
    coverRid: form.coverRid.trim(),
    resultRid: form.resultRid.trim(),
    annotations,
    sortOrder: form.sortOrder ?? 0,
    enabled: form.enabled,
    analyze: form.analyze,
  };
  saving.value = true;
  try {
    const row = props.sample ? await updateSample(props.sample.id, body) : await createSample(body);
    message.success(t('replicateSample.saved'));
    emit('saved', row);
    emit('update:open', false);
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.head :deep(.ant-form-item) {
  margin-bottom: 8px;
}
.full {
  width: 100%;
}
.tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}
/* 素材卡片已上传时约 290px：空 / 已上传之间不跳；改法内容更多时弹窗向下长 */
.pane {
  min-height: 290px;
}
.mat-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--ant-color-text-secondary, #666);
}
.req {
  margin-right: 2px;
  color: var(--ant-color-error, #ff4d4f);
}
.warn {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ant-color-warning, #faad14);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.footer-opts {
  display: flex;
  align-items: center;
  gap: 20px;
}
.opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
