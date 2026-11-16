<template>
  <a-modal
    :open="open"
    :title="sample ? t('replicateSample.editTitle') : t('replicateSample.createTitle')"
    width="960px"
    :body-style="{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', paddingRight: '8px' }"
    :confirm-loading="saving"
    :mask-closable="false"
    destroy-on-close
    @ok="submit"
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <div class="tabs" role="tablist">
      <button
        v-for="tb in TABS"
        :key="tb.key"
        type="button"
        role="tab"
        class="tab"
        :class="{ active: tab === tb.key }"
        :aria-selected="tab === tb.key"
        @click="tab = tb.key"
      >
        {{ tb.label }}
        <span v-if="tb.done" class="done">✓</span>
      </button>
    </div>

    <div class="sections">
      <section v-show="tab === 'media'" class="sec">
        <h4 class="sec-title">素材</h4>
        <div class="materials">
          <div class="mat">
            <div class="mat-label">
              <span class="req">*</span>{{ t('replicateSample.fSource') }}
            </div>
            <SampleMediaField
              :model-value="form.sourceRid"
              :label="t('replicateSample.fSource')"
              kind="video"
              @update:model-value="form.sourceRid = $event"
            />
            <div v-if="sourceChanged" class="warn">
              {{ t('replicateSample.sourceChangedWarn') }}
            </div>
          </div>
          <div class="mat">
            <div class="mat-label">{{ t('replicateSample.fCover') }}</div>
            <SampleMediaField
              :model-value="form.coverRid"
              :label="t('replicateSample.fCover')"
              kind="any"
              @update:model-value="form.coverRid = $event"
            />
          </div>
          <div class="mat">
            <div class="mat-label">{{ t('replicateSample.fResult') }}</div>
            <SampleMediaField
              :model-value="form.resultRid"
              :label="t('replicateSample.fResult')"
              kind="video"
              @update:model-value="form.resultRid = $event"
            />
          </div>
        </div>
      </section>

      <section v-show="tab === 'basic'" class="sec">
        <h4 class="sec-title">基本信息</h4>
        <div class="basic">
          <label class="field span-2">
            <span class="field-label"
              ><span class="req">*</span>{{ t('replicateSample.fTitle') }}</span
            >
            <a-input
              v-model:value="form.title"
              :maxlength="40"
              show-count
              :placeholder="t('replicateSample.fTitlePh')"
            />
          </label>
          <label class="field span-2">
            <span class="field-label">{{ t('replicateSample.fIndustry') }}</span>
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
          </label>
          <label class="field">
            <span class="field-label">{{ t('replicateSample.fSort') }}</span>
            <a-input-number v-model:value="form.sortOrder" :precision="0" class="w-full" />
          </label>
          <label class="field">
            <span class="field-label">{{ t('replicateSample.fEnabled') }}</span>
            <a-switch v-model:checked="form.enabled" />
          </label>
          <label class="field">
            <span class="field-label">&nbsp;</span>
            <a-checkbox v-model:checked="form.analyze">{{
              t('replicateSample.fAnalyze')
            }}</a-checkbox>
          </label>
        </div>
      </section>

      <section v-show="tab === 'annotation'" class="sec">
        <h4 class="sec-title">改法</h4>
        <AnnotationEditor v-model="form.annotations" />
      </section>
    </div>
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
type TabKey = 'media' | 'basic' | 'annotation';
const tab = ref<TabKey>('media');
const TABS = computed(() => [
  { key: 'media' as TabKey, label: '素材', done: !!form.sourceRid },
  { key: 'basic' as TabKey, label: '基本信息', done: !!form.title.trim() },
  { key: 'annotation' as TabKey, label: '改法', done: !!form.annotations.trim() },
]);

const form = reactive(blank());
const saving = ref(false);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
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
  if (!title) return failOn('basic', t('replicateSample.titleRequired'));
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
.mono :deep(textarea),
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
}
.tab {
  padding: 8px 14px;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ant-color-text-secondary, #666);
  font-size: 14px;
  cursor: pointer;
}
.tab.active {
  color: var(--ant-color-primary, #1677ff);
  border-bottom-color: var(--ant-color-primary, #1677ff);
  font-weight: 600;
}
.done {
  margin-left: 4px;
  color: var(--ant-color-success, #52c41a);
  font-size: 12px;
}
.sections {
  min-height: 300px;
}
.sec {
  padding-bottom: 4px;
}
.sec-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.materials {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.mat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.mat-label,
.field-label {
  font-size: 13px;
  color: var(--ant-color-text-secondary, #666);
}
.basic {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 14px;
  align-items: start;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.span-2 {
  grid-column: span 2;
}
.w-full {
  width: 100%;
}
.req {
  color: var(--ant-color-error, #ff4d4f);
  margin-right: 2px;
}
@media (max-width: 900px) {
  .materials,
  .basic {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: span 1;
  }
}
.warn {
  margin-top: 4px;
  color: var(--ant-color-warning, #faad14);
  font-size: 12px;
}
</style>
