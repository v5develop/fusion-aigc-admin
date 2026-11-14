<template>
  <a-modal
    :open="open"
    :title="sample ? t('replicateSample.editTitle') : t('replicateSample.createTitle')"
    width="720px"
    :confirm-loading="saving"
    :mask-closable="false"
    destroy-on-close
    @ok="submit"
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <a-form :model="form" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
      <a-form-item :label="t('replicateSample.fTitle')" required>
        <a-input
          v-model:value="form.title"
          :maxlength="40"
          show-count
          :placeholder="t('replicateSample.fTitlePh')"
        />
      </a-form-item>
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
      <a-form-item :label="t('replicateSample.fSource')" required>
        <a-input
          v-model:value="form.sourceRid"
          allow-clear
          :placeholder="t('replicateSample.ridPh')"
        />
        <div v-if="sourceChanged" class="warn">{{ t('replicateSample.sourceChangedWarn') }}</div>
      </a-form-item>
      <a-form-item :label="t('replicateSample.fCover')">
        <a-input
          v-model:value="form.coverRid"
          allow-clear
          :placeholder="t('replicateSample.ridPh')"
        />
      </a-form-item>
      <a-form-item :label="t('replicateSample.fResult')">
        <a-input
          v-model:value="form.resultRid"
          allow-clear
          :placeholder="t('replicateSample.ridPh')"
        />
      </a-form-item>
      <a-form-item
        :label="t('replicateSample.fAnnotations')"
        :validate-status="annotationsInvalid ? 'error' : undefined"
        :help="
          annotationsInvalid
            ? t('replicateSample.annotationsInvalid')
            : t('replicateSample.annotationsHint')
        "
      >
        <a-textarea
          v-model:value="form.annotations"
          :rows="6"
          class="mono"
          :placeholder="ANNOTATIONS_PH"
        />
      </a-form-item>
      <a-form-item :label="t('replicateSample.fSort')">
        <a-input-number v-model:value="form.sortOrder" :precision="0" style="width: 160px" />
      </a-form-item>
      <a-form-item :label="t('replicateSample.fEnabled')">
        <a-switch v-model:checked="form.enabled" />
      </a-form-item>
      <a-form-item :wrapper-col="{ offset: 5, span: 18 }">
        <a-checkbox v-model:checked="form.analyze">{{ t('replicateSample.fAnalyze') }}</a-checkbox>
      </a-form-item>
    </a-form>
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

import { isRidLike, parseAnnotations } from './sample-meta';

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

const ANNOTATIONS_PH = '{"dims":{"product":{"mode":"replace","refs":[1]}},"audio":"regenerate"}';
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

const annotationsInvalid = computed(() => parseAnnotations(form.annotations) === undefined);
/** 编辑时换了原片：后端会清掉已发布的分析 */
const sourceChanged = computed(
  () =>
    !!props.sample &&
    !!form.sourceRid.trim() &&
    stripRid(form.sourceRid) !== stripRid(props.sample.sourceRid),
);

async function submit() {
  const title = form.title.trim();
  if (!title) return message.warning(t('replicateSample.titleRequired'));
  if (!form.sourceRid.trim()) return message.warning(t('replicateSample.sourceRequired'));
  const rids: [string, string][] = [
    [t('replicateSample.fSource'), form.sourceRid],
    [t('replicateSample.fCover'), form.coverRid],
    [t('replicateSample.fResult'), form.resultRid],
  ];
  const bad = rids.find(([, v]) => !isRidLike(v));
  if (bad) return message.warning(t('replicateSample.ridInvalid', { field: bad[0] }));
  const annotations = parseAnnotations(form.annotations);
  if (annotations === undefined) return message.warning(t('replicateSample.annotationsInvalid'));

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
.warn {
  margin-top: 4px;
  color: var(--ant-color-warning, #faad14);
  font-size: 12px;
}
</style>
