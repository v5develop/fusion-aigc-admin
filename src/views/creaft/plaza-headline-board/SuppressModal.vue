<template>
  <a-modal
    :open="open"
    :title="`取消推荐 / 屏蔽：${target?.title ?? ''}`"
    :confirm-loading="saving"
    ok-text="确认"
    :ok-button-props="{ danger: form.duration === 'permanent' }"
    @update:open="(v: boolean) => emit('update:open', v)"
    @ok="submit"
  >
    <a-form layout="vertical">
      <a-form-item label="时长" required>
        <a-radio-group v-model:value="form.duration">
          <a-radio-button value="24h">24 小时</a-radio-button>
          <a-radio-button value="sunday">到本周日结束</a-radio-button>
          <a-radio-button value="custom">自定义日期</a-radio-button>
          <a-radio-button value="permanent">永久屏蔽</a-radio-button>
        </a-radio-group>
        <div v-if="form.duration === 'custom'" style="margin-top: 8px">
          <a-date-picker
            v-model:value="form.date"
            value-format="YYYY-MM-DD"
            :disabled-date="(d: Dayjs) => d.isBefore(dayjs(), 'day')"
          />
          <span class="muted" style="margin-left: 8px">当日 24:00 结束</span>
        </div>
      </a-form-item>

      <a-form-item label="范围" required>
        <ScopePicker
          v-model:scopes="form.scopes"
          v-model:all="form.all"
          :options="scopeOptions"
          allow-all
        />
        <a-checkbox v-if="hasSubScope" v-model:checked="form.alsoParent" style="margin-top: 6px">
          同时作用于上级行业
        </a-checkbox>
      </a-form-item>

      <a-form-item label="原因" required>
        <a-input
          v-model:value="form.reason"
          :maxlength="200"
          show-count
          placeholder="写给同事看的原因，会留痕"
        />
      </a-form-item>
    </a-form>
    <a-alert
      type="info"
      show-icon
      :message="
        form.duration === 'permanent'
          ? '永久屏蔽后，该模板在所选范围不再参与评选，直到手动解除。'
          : '到期前该模板在所选范围不参与评选；已有的人工推荐在此期间不生效（规则保留，到期后恢复）。'
      "
    />
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import dayjs, { type Dayjs } from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';

import {
  getHeadlineTemplateStatus,
  suppressHeadline,
  type HeadlineScopeSummary,
  type SuppressDuration,
} from '@/api/plaza-admin';

import ScopePicker from './ScopePicker.vue';

const props = defineProps<{
  open: boolean;
  target: { id: number; title: string } | null;
  /** 预选范围（当前行业榜）；总榜为空，必须手选 */
  defaultScope?: string;
  /** 范围目录（取二级行业的 parentCode，决定要不要给「同时作用于上级」） */
  scopeCatalog?: HeadlineScopeSummary[];
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'done'): void }>();

const form = reactive({
  duration: '24h' as SuppressDuration,
  date: undefined as string | undefined,
  scopes: [] as string[],
  all: false,
  alsoParent: false,
  reason: '',
});
const saving = ref(false);

/** 可选范围 = 该模板所属的行业榜（headline-status 的 scopes 去掉 ALL；全站总榜不接受抑制） */
const scopeOptions = ref<{ label: string; value: string; parentCode?: string }[]>([]);
let scopeSeq = 0;
async function loadScopeOptions(id: number | undefined) {
  const s = ++scopeSeq;
  scopeOptions.value = [];
  if (!id) return;
  try {
    const st = await getHeadlineTemplateStatus(id);
    if (s !== scopeSeq) return;
    scopeOptions.value = (st?.scopes ?? [])
      .filter((x) => x.scope !== 'ALL')
      .map((x) => ({
        label: x.name,
        value: x.scope,
        parentCode: props.scopeCatalog?.find((c) => c.scope === x.scope)?.parentCode,
      }));
    if (
      props.defaultScope &&
      scopeOptions.value.some((o) => o.value === props.defaultScope) &&
      !form.scopes.length
    )
      form.scopes = [props.defaultScope];
  } catch {
    /* 已提示 */
  }
}
const hasSubScope = computed(() =>
  form.all
    ? scopeOptions.value.some((o) => o.parentCode)
    : scopeOptions.value.some((o) => o.parentCode && form.scopes.includes(o.value)),
);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    Object.assign(form, {
      duration: '24h',
      date: undefined,
      scopes: [],
      all: false,
      alsoParent: false,
      reason: '',
    });
    loadScopeOptions(props.target?.id);
  },
);

async function submit() {
  if (!props.target) return;
  if (form.duration === 'custom' && !form.date) {
    message.warning('请选择结束日期');
    return;
  }
  const scopes = form.all ? ['*'] : form.scopes;
  if (!scopes.length) {
    message.warning('请选择范围');
    return;
  }
  if (!form.reason.trim()) {
    message.warning('请填写原因');
    return;
  }
  saving.value = true;
  try {
    // 截止时刻由服务端按时长快捷项算（24h / 本周日 24:00 / 自定义日当日 24:00 / 永久）
    await suppressHeadline({
      plazaTemplateId: props.target.id,
      scopes,
      duration: form.duration,
      customDate: form.duration === 'custom' ? form.date : undefined,
      reason: form.reason.trim(),
      alsoParent: form.alsoParent || undefined,
    });
    message.success('已生效，榜单已刷新');
    emit('update:open', false);
    emit('done');
  } catch {
    /* 已提示 */
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
</style>
