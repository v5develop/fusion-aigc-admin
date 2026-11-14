<template>
  <a-drawer
    :open="open"
    :title="`${t('replicateSample.detailTitle')} #${sampleId}`"
    width="760"
    destroy-on-close
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item :label="t('replicateSample.colTitle')" :span="2">
            {{ detail.title }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.colIndustry')">
            {{ industryLabel(detail.industry) }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.colSort')">
            {{ detail.sortOrder }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.fSource')" :span="2">
            <code>{{ detail.sourceRid }}</code>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.fCover')">
            <code>{{ detail.coverRid || '—' }}</code>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.fResult')">
            <code>{{ detail.resultRid || '—' }}</code>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.colAnalysis')">
            <a-tag :color="analysisColor(detail.analysisStatus)">
              {{ detail.analysisStatusLabel || detail.analysisStatus }}
            </a-tag>
            <span class="muted">{{ t('replicateSample.round', { n: detail.round }) }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.colUserVisible')">
            <a-tag :color="detail.userVisible ? 'green' : 'default'">
              {{
                detail.userVisible
                  ? t('replicateSample.visibleYes')
                  : t('replicateSample.visibleNo')
              }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.analysisNo')">
            <code>{{ detail.analysisNo || '—' }}</code>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.pendingNo')">
            <code>{{ detail.pendingAnalysisNo || '—' }}</code>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.duration')">
            {{ detail.durationS ? t('replicateSample.seconds', { n: detail.durationS }) : '—' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.analyzedAt')">
            {{ fmtTime(detail.analyzedAt) }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.summary')" :span="2">
            {{ detail.summary || '—' }}
          </a-descriptions-item>
          <a-descriptions-item
            v-if="detail.analysisError"
            :label="t('replicateSample.analysisError')"
            :span="2"
          >
            <span class="bad">{{ detail.analysisError }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.createdAt')">
            {{ fmtTime(detail.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('replicateSample.colUpdatedAt')">
            {{ fmtTime(detail.updatedAt) }}
          </a-descriptions-item>
        </a-descriptions>

        <a-collapse class="json-block" :default-active-key="['analysis']">
          <a-collapse-panel key="annotations" :header="t('replicateSample.fAnnotations')">
            <pre class="json">{{ pretty(detail.annotations) }}</pre>
          </a-collapse-panel>
          <a-collapse-panel key="analysis" :header="t('replicateSample.analysisJson')">
            <pre v-if="detail.analysis" class="json">{{ pretty(detail.analysis) }}</pre>
            <a-empty v-else :description="t('replicateSample.noAnalysis')" />
          </a-collapse-panel>
        </a-collapse>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getSample, type SampleAdminDetail } from '@/api/replicate-admin';

import { fmtTime } from '../replicate-job/job-meta';
import { analysisColor } from './sample-meta';

const props = defineProps<{
  open: boolean;
  sampleId: number;
  industryLabel: (code: string) => string;
}>();
defineEmits<{ (e: 'update:open', v: boolean): void }>();

const { t } = useI18n();
const detail = ref<SampleAdminDetail | null>(null);
const loading = ref(false);

const pretty = (v: unknown) => (v == null ? '—' : JSON.stringify(v, null, 2));

watch(
  () => [props.open, props.sampleId] as const,
  async ([open, id]) => {
    if (!open || !id) return;
    detail.value = null;
    loading.value = true;
    try {
      detail.value = await getSample(id);
    } catch {
      /* 已提示 */
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.muted {
  margin-left: 6px;
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.bad {
  color: var(--ant-color-error, #ff4d4f);
}
.json-block {
  margin-top: 16px;
}
.json {
  max-height: 480px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
