<template>
  <a-drawer
    :open="open"
    title="行业内排序"
    width="640"
    :mask-closable="false"
    destroy-on-close
    @update:open="onClose"
  >
    <template #extra>
      <a-space>
        <a-button :disabled="!industryId" @click="$emit('samples', industryId!)"
          >行业示例素材</a-button
        >
        <a-tooltip :title="blocked ? WRITE_DISABLED_TIP : ''">
          <a-button
            v-permission="'creaft_catalog:edit'"
            type="primary"
            :loading="saving"
            :disabled="blocked || readOnly || !dirty"
            @click="save"
          >
            保存顺序
          </a-button>
        </a-tooltip>
      </a-space>
    </template>

    <a-tree-select
      v-model:value="industryId"
      :tree-data="tree"
      tree-default-expand-all
      placeholder="选择要排序的行业"
      style="width: 100%; margin-bottom: 12px"
      @change="load"
    />
    <a-alert
      v-if="blocked"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="WRITE_DISABLED_TIP"
    />
    <a-alert
      v-else-if="readOnly"
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="hint || '该视图只读，请进入具体二级行业排序'"
    />
    <p v-else-if="industryId" class="muted">
      拖动调整顺序；只改本行业里的先后，不影响全局排序和其他行业。
    </p>

    <a-spin :spinning="loading">
      <a-empty v-if="industryId && !loading && !items.length" description="该行业下还没有模板" />
      <draggable
        v-model="items"
        item-key="id"
        handle=".grip"
        :disabled="blocked || readOnly"
        @change="dirty = true"
      >
        <template #item="{ element, index }">
          <div class="item">
            <span class="grip" :class="{ off: blocked || readOnly }">⠿</span>
            <span class="no">{{ index + 1 }}</span>
            <img v-if="element.coverUrl" :src="element.coverUrl" class="thumb" alt="" />
            <div v-else class="thumb empty">无图</div>
            <div class="txt">
              <div class="t">{{ element.title }}</div>
              <div class="muted">
                #{{ element.id }} ·
                {{ stateLabel[element.displayState] ?? element.displayState }}
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, ref, watch } from 'vue';
import draggable from 'vuedraggable';

import {
  WRITE_DISABLED_TIP,
  getIndustryTemplates,
  isOpBlocked,
  reportWriteError,
  saveIndustryOrder,
  type IndustryNode,
  type PlazaTemplateRow,
} from '@/api/plaza-admin';

const props = defineProps<{
  open: boolean;
  industries: IndustryNode[];
  /** 打开时默认选中的行业 */
  initialIndustryId?: number;
}>();
const emit = defineEmits<{
  'update:open': [v: boolean];
  samples: [industryId: number];
  saved: [];
}>();

const stateLabel: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
  SCHEDULED: '定时上线中',
  EXPIRED: '已过期',
};
const blocked = computed(() => isOpBlocked('industryOrder'));
const tree = computed(() =>
  props.industries.map((r) => ({
    title: r.enabled ? r.name : `${r.name}（停用）`,
    value: r.id,
    children: (r.children ?? []).map((c) => ({ title: c.name, value: c.id })),
  })),
);

const industryId = ref<number | undefined>();
const items = ref<PlazaTemplateRow[]>([]);
const readOnly = ref(false);
const hint = ref('');
const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);

let seq = 0;
async function load() {
  dirty.value = false;
  items.value = [];
  readOnly.value = false;
  hint.value = '';
  if (!industryId.value) return;
  const s = ++seq;
  loading.value = true;
  try {
    const r = await getIndustryTemplates(industryId.value);
    if (s !== seq) return;
    items.value = r?.items ?? [];
    readOnly.value = !!r?.readOnly;
    hint.value = r?.hint ?? '';
  } catch {
    /* 已提示 */
  } finally {
    if (s === seq) loading.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    industryId.value = props.initialIndustryId;
    load();
  },
);

async function save() {
  if (!industryId.value) return;
  saving.value = true;
  try {
    await saveIndustryOrder(
      industryId.value,
      items.value.map((x) => x.id),
    );
    message.success('顺序已保存');
    dirty.value = false;
    emit('saved');
  } catch (e) {
    reportWriteError(e, '列表已被他人改动，请刷新后再排');
    // 模板集合变了（有人挂入 / 移出）会被拒：重新拉取，避免继续拿旧列表保存
    await load();
  } finally {
    saving.value = false;
  }
}

function onClose(v: boolean) {
  if (v || !dirty.value) {
    emit('update:open', v);
    return;
  }
  Modal.confirm({
    title: '顺序还没保存，确定关闭？',
    okText: '放弃修改',
    okType: 'danger',
    onOk: () => emit('update:open', false),
  });
}
</script>

<style scoped>
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  border-radius: 6px;
  background: var(--ant-color-bg-container, #fff);
}
.grip {
  cursor: grab;
  font-size: 18px;
  color: var(--ant-color-text-tertiary, #888);
  user-select: none;
}
.grip.off {
  cursor: not-allowed;
  opacity: 0.4;
}
.no {
  width: 24px;
  text-align: right;
  color: var(--ant-color-text-tertiary, #888);
}
.thumb {
  width: 36px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.thumb.empty {
  display: grid;
  place-items: center;
  font-size: 12px;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
  color: var(--ant-color-text-quaternary, #bbb);
}
.t {
  font-weight: 600;
}
</style>
