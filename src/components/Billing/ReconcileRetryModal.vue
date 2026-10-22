<template>
  <a-modal
    :open="open"
    :title="$t('reconcile.dialog.title')"
    :confirm-loading="submitting"
    :mask-closable="false"
    destroy-on-close
    @ok="handleOk"
    @cancel="emit('update:open', false)"
    @after-close="reset"
  >
    <a-alert
      type="warning"
      show-icon
      class="mb-3"
      :message="$t('reconcile.dialog.tip', { taskId })"
    />
    <a-form layout="vertical">
      <a-form-item :label="$t('reconcile.dialog.outcome')" v-bind="outcomeValidate">
        <a-radio-group v-model:value="outcome" class="outcome-group">
          <a-radio value="BILLED">
            <div class="outcome-title">{{ $t('reconcile.dialog.billed') }}</div>
            <div class="outcome-desc">{{ $t('reconcile.dialog.billedDesc') }}</div>
          </a-radio>
          <a-radio value="NOT_BILLED">
            <div class="outcome-title">{{ $t('reconcile.dialog.notBilled') }}</div>
            <div class="outcome-desc">{{ $t('reconcile.dialog.notBilledDesc') }}</div>
          </a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item :label="$t('reconcile.dialog.note')" v-bind="noteValidate">
        <a-textarea
          v-model:value="note"
          :rows="4"
          :maxlength="NOTE_MAX"
          show-count
          :placeholder="$t('reconcile.dialog.notePlaceholder')"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { retryCreationTask, type RetryBillingDeclaration } from '@/api/creation-task';

const props = defineProps<{
  open: boolean;
  taskId: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}>();

const { t } = useI18n();

const NOTE_MAX = 500;
const outcome = ref<RetryBillingDeclaration['billingOutcome'] | undefined>();
const note = ref('');
const submitting = ref(false);
const touched = ref(false);

const outcomeError = computed(() =>
  touched.value && !outcome.value ? t('reconcile.dialog.outcomeRequired') : '',
);

const noteError = computed(() => {
  if (!touched.value) return '';
  const v = note.value.trim();
  if (!v) return t('reconcile.dialog.noteRequired');
  if (v.length > NOTE_MAX) return t('reconcile.dialog.noteTooLong', { max: NOTE_MAX });
  // 后端不接受链接或凭证，前端先挡一道明显的链接
  if (/https?:\/\/|www\./i.test(v)) return t('reconcile.dialog.noteNoLink');
  return '';
});

const outcomeValidate = computed(() =>
  outcomeError.value ? { validateStatus: 'error' as const, help: outcomeError.value } : {},
);
const noteValidate = computed(() =>
  noteError.value ? { validateStatus: 'error' as const, help: noteError.value } : {},
);

function reset() {
  outcome.value = undefined;
  note.value = '';
  touched.value = false;
}

function handleOk() {
  touched.value = true;
  if (!outcome.value || noteError.value) return;
  const declaration: RetryBillingDeclaration = {
    billingOutcome: outcome.value,
    note: note.value.trim(),
  };
  const billed = declaration.billingOutcome === 'BILLED';
  Modal.confirm({
    title: t(billed ? 'reconcile.confirm.billedTitle' : 'reconcile.confirm.notBilledTitle'),
    content: t(billed ? 'reconcile.confirm.billedContent' : 'reconcile.confirm.notBilledContent'),
    okButtonProps: { danger: true },
    onOk: async () => {
      submitting.value = true;
      try {
        await retryCreationTask(props.taskId, declaration);
        message.success(t(billed ? 'reconcile.billedSuccess' : 'reconcile.retrySuccess'));
        emit('update:open', false);
        emit('success');
      } catch (e) {
        // 全局拦截器已弹出业务错误；保持对话框打开以便修改后重试
        console.error('Retry with billing declaration failed:', e);
      } finally {
        submitting.value = false;
      }
    },
  });
}
</script>

<style scoped>
.outcome-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.outcome-title {
  font-weight: 500;
}

.outcome-desc {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
