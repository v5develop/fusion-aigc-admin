<template>
  <a-modal
    :open="open"
    :title="`渠道与媒体类型：${template?.title ?? ''}`"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: blocked || loading }"
    ok-text="保存"
    destroy-on-close
    @ok="save"
    @cancel="$emit('update:open', false)"
  >
    <a-alert
      v-if="blocked"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="WRITE_DISABLED_TIP"
    />
    <a-spin :spinning="loading">
      <a-form :label-col="{ span: 5 }">
        <a-form-item label="媒体类型" extra="视频模板需要已有预览视频">
          <a-radio-group v-model:value="mediaType" :disabled="blocked">
            <a-radio value="image">图片</a-radio>
            <a-radio value="video">视频</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="投放渠道" extra="可覆盖宽高；留空使用字典默认尺寸">
          <div v-for="c in picked" :key="c.code" class="chan-row">
            <a-tag>{{ dictName(c.code) }}</a-tag>
            <a-input-number
              v-model:value="c.width"
              :min="1"
              :max="20000"
              :disabled="blocked"
              placeholder="宽"
              size="small"
            />
            <span>×</span>
            <a-input-number
              v-model:value="c.height"
              :min="1"
              :max="20000"
              :disabled="blocked"
              placeholder="高"
              size="small"
            />
            <a-button
              type="link"
              size="small"
              danger
              :disabled="blocked"
              @click="removeChan(c.code)"
            >
              移除
            </a-button>
          </div>
          <a-select
            v-model:value="adding"
            placeholder="添加渠道"
            style="width: 100%"
            :disabled="blocked"
            :options="addable"
            @change="addChan"
          />
        </a-form-item>
      </a-form>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, ref, watch } from 'vue';

import {
  WRITE_DISABLED_TIP,
  getChannelDict,
  getPlazaTemplate,
  isOpBlocked,
  reportWriteError,
  saveTemplateAttrs,
  type ChannelDict,
  type PlazaTemplateRow,
  type TemplateChannelRef,
  type TemplateMediaType,
} from '@/api/plaza-admin';

const props = defineProps<{
  open: boolean;
  template: PlazaTemplateRow | null;
}>();
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>();

const blocked = computed(() => isOpBlocked('attrs'));
const loading = ref(false);
const saving = ref(false);
const dict = ref<ChannelDict[]>([]);
const mediaType = ref<TemplateMediaType>('image');
const picked = ref<TemplateChannelRef[]>([]);
const adding = ref<string | undefined>();
let updatedAt: string | undefined;
let revision: number | undefined;

const dictName = (code: string) => {
  const d = dict.value.find((x) => x.code === code);
  return d ? `${d.name} ${d.width}×${d.height}` : code;
};
const addable = computed(() =>
  dict.value
    .filter((d) => d.enabled && !picked.value.some((p) => p.code === d.code))
    .map((d) => ({
      label: `${d.name}（${d.width}×${d.height}，${d.ratio}）`,
      value: d.code,
    })),
);
function addChan(code: string) {
  if (code) picked.value.push({ code });
  adding.value = undefined;
}
function removeChan(code: string) {
  picked.value = picked.value.filter((c) => c.code !== code);
}

watch(
  () => props.open,
  async (v) => {
    if (!v || !props.template) return;
    loading.value = true;
    try {
      const [d, detail] = await Promise.all([
        getChannelDict(),
        getPlazaTemplate(props.template.id),
      ]);
      dict.value = d ?? [];
      mediaType.value = detail.mediaType;
      updatedAt = detail.updateTime;
      revision = detail.revision;
      const raw = Array.isArray(detail.channels) ? (detail.channels as TemplateChannelRef[]) : [];
      picked.value = raw.filter((c) => c?.code).map((c) => ({ ...c }));
    } catch {
      /* 已提示 */
    } finally {
      loading.value = false;
    }
  },
);

async function save() {
  if (!props.template) return;
  if (revision === undefined) {
    message.error('没取到模板版本号（revision），请关闭后重新打开');
    return;
  }
  saving.value = true;
  try {
    await saveTemplateAttrs(props.template.id, {
      mediaType: mediaType.value,
      channels: picked.value.map((c) => ({
        code: c.code,
        ...(c.width ? { width: c.width } : {}),
        ...(c.height ? { height: c.height } : {}),
      })),
      updatedAt,
      revision,
    });
    message.success('已保存');
    emit('saved');
    emit('update:open', false);
  } catch (e) {
    reportWriteError(e, '他人已修改该模板，请关闭后刷新再改');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.chan-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
</style>
