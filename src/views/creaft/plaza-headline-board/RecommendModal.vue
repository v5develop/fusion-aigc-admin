<template>
  <a-modal
    :open="open"
    title="手动推荐"
    :confirm-loading="saving"
    ok-text="确认推荐"
    @update:open="(v: boolean) => emit('update:open', v)"
    @ok="submit"
  >
    <a-form layout="vertical">
      <a-form-item label="模板" required>
        <a-select
          v-if="!fixedTarget"
          v-model:value="pickedId"
          show-search
          :filter-option="false"
          :options="templateOptions"
          :loading="searching"
          placeholder="搜索已发布模板（灰显 = 在当前范围被抑制）"
          @search="onSearch"
          @dropdown-visible-change="(o: boolean) => o && !templateOptions.length && search('')"
          @change="onPick"
        />
        <div v-else class="fixed">{{ fixedTarget.title }}</div>
      </a-form-item>

      <a-form-item label="范围" required>
        <ScopePicker
          v-model:scopes="form.scopes"
          v-model:all="form.all"
          :options="scopeOptions"
          allow-all
        />
      </a-form-item>

      <a-form-item label="名次（可空，范围内名次）">
        <a-input-number v-model:value="form.pin" :min="1" :max="50" style="width: 140px" />
      </a-form-item>

      <a-form-item label="推荐语（≤60 字）" required>
        <a-input v-model:value="form.why" :maxlength="60" show-count />
        <a-button type="link" size="small" style="padding-left: 0" @click="fillWhy"
          >按算法文案生成</a-button
        >
      </a-form-item>

      <a-form-item label="生效日期" required extra="默认今天起 7 天">
        <a-range-picker v-model:value="form.window" value-format="YYYY-MM-DD" style="width: 100%" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';

import {
  createHeadlineRule,
  getHeadlineTemplateStatus,
  getPlazaTemplates,
  type HeadlineSuppression,
} from '@/api/plaza-admin';

import ScopePicker from './ScopePicker.vue';

export interface RecommendTarget {
  id: number;
  title: string;
  uses7d?: number | null;
}

const props = defineProps<{
  open: boolean;
  /** 从榜单某一行进入时固定模板；顶部按钮进入时为空，需要选模板 */
  fixedTarget?: RecommendTarget | null;
  defaultScope?: string;
  /** 当前范围的抑制名单，用来灰显 */
  suppressions?: HeadlineSuppression[];
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'done'): void }>();

const form = reactive({
  scopes: [] as string[],
  all: false,
  pin: undefined as number | undefined,
  why: '',
  window: undefined as [string, string] | undefined,
});
const saving = ref(false);
const picked = ref<RecommendTarget | null>(null);
const pickedId = ref<number | undefined>();
const found = ref<RecommendTarget[]>([]);
const searching = ref(false);

const target = computed(() => props.fixedTarget ?? picked.value);
/** 可选范围 = 该模板所属的行业榜（headline-status 的 scopes 去掉 ALL；全站总榜不可写规则） */
const scopeOptions = ref<{ label: string; value: string }[]>([]);
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
      .map((x) => ({ label: x.name, value: x.scope }));
    applyDefaultScope();
  } catch {
    /* 已提示 */
  }
}
watch(
  () => target.value?.id,
  (id) => {
    if (props.open) loadScopeOptions(id);
  },
);
const suppressedIds = computed(
  () =>
    new Set(
      (props.suppressions ?? [])
        .filter((s) => s.scope === props.defaultScope)
        .map((s) => s.plazaTemplateId),
    ),
);
const templateOptions = computed(() =>
  found.value.map((t) => ({
    label: `${t.title}（#${t.id}）${suppressedIds.value.has(t.id) ? ' · 抑制中' : ''}`,
    value: t.id,
    disabled: suppressedIds.value.has(t.id),
  })),
);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    picked.value = null;
    pickedId.value = undefined;
    found.value = [];
    const today = dayjs();
    Object.assign(form, {
      scopes: [],
      all: false,
      pin: undefined,
      why: '',
      window: [today.format('YYYY-MM-DD'), today.add(6, 'day').format('YYYY-MM-DD')],
    });
    loadScopeOptions(target.value?.id);
  },
);

function applyDefaultScope() {
  if (props.defaultScope && scopeOptions.value.some((o) => o.value === props.defaultScope)) {
    form.scopes = [props.defaultScope];
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
function onSearch(kw: string) {
  clearTimeout(timer);
  timer = setTimeout(() => search(kw), 300);
}
async function search(kw: string) {
  const s = ++seq;
  searching.value = true;
  try {
    const res = await getPlazaTemplates({
      keyword: kw.trim() || undefined,
      state: 'PUBLISHED',
      sort: 'uses7d',
      order: 'desc',
      page: 1,
      size: 30,
    });
    if (s !== seq) return;
    found.value = (res?.items ?? []).map((t) => ({ id: t.id, title: t.title, uses7d: t.uses7d }));
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) searching.value = false;
  }
}
function onPick(id: number) {
  picked.value = found.value.find((t) => t.id === id) ?? null;
  form.scopes = [];
}

function fillWhy() {
  const n = target.value?.uses7d;
  form.why = n ? `本周 ${n} 人做了同款` : '本周做同款的人在变多';
}

async function submit() {
  const t = target.value;
  if (!t) {
    message.warning('请选择模板');
    return;
  }
  const scopes = form.all ? ['*'] : form.scopes;
  if (!scopes.length) {
    message.warning('请选择范围');
    return;
  }
  const why = form.why.trim();
  if (!why) {
    message.warning('推荐语必填');
    return;
  }
  if (Array.from(why).length > 60) {
    message.warning('推荐语最多 60 个字');
    return;
  }
  if (!form.window?.[0] || !form.window?.[1]) {
    message.warning('请选择生效日期');
    return;
  }
  saving.value = true;
  try {
    await createHeadlineRule({
      plazaTemplateId: t.id,
      scopes,
      why,
      pinPosition: form.pin ?? null,
      startDate: form.window[0],
      endDate: form.window[1],
      enabled: true,
    });
    message.success('已推荐，榜单已刷新');
    emit('update:open', false);
    emit('done');
  } catch {
    /* 已提示（含 HEADLINE_TEMPLATE_SUPPRESSED / NOT_IN_SCOPE / DUPLICATE） */
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.fixed {
  font-weight: 600;
}
</style>
