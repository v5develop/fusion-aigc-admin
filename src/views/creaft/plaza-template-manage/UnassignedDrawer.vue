<template>
  <a-drawer
    :open="open"
    :title="`待分配行业（${total} 个）`"
    width="760"
    destroy-on-close
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="没挂行业的模板，发布后用户端也看不到。挂上行业后才会出现在对应行业里。"
    />
    <a-alert
      v-if="blocked"
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="WRITE_DISABLED_TIP"
    />
    <div class="bulk">
      <a-checkbox
        :checked="selected.length > 0 && selected.length === rows.length"
        :indeterminate="selected.length > 0 && selected.length < rows.length"
        @change="toggleAll"
      >
        全选本页
      </a-checkbox>
      <a-tooltip :title="blocked ? WRITE_DISABLED_TIP : ''">
        <a-button
          v-permission="'creaft_catalog:edit'"
          type="primary"
          size="small"
          :disabled="!selected.length || blocked"
          @click="openPick(selected)"
        >
          批量挂行业（{{ selected.length }}）
        </a-button>
      </a-tooltip>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !rows.length" description="没有待分配的模板了" />
      <div v-for="r in rows" :key="r.id" class="item">
        <a-checkbox
          :checked="selected.includes(r.id)"
          @change="(e: { target: { checked: boolean } }) => pick(r.id, e.target.checked)"
        />
        <img v-if="r.coverUrl" :src="r.coverUrl" class="thumb" alt="" />
        <div v-else class="thumb empty">无图</div>
        <div class="txt">
          <div class="t">{{ r.title }}</div>
          <div class="muted">
            #{{ r.id }} · {{ r.mediaType === 'video' ? '视频' : '图片' }} ·
            {{ stateLabel[r.displayState] ?? r.displayState }}
          </div>
        </div>
        <a-tooltip :title="blocked ? WRITE_DISABLED_TIP : ''">
          <a-button
            v-permission="'creaft_catalog:edit'"
            size="small"
            type="link"
            :disabled="blocked"
            @click="openPick([r.id])"
          >
            挂行业
          </a-button>
        </a-tooltip>
      </div>
    </a-spin>

    <div class="pager">
      <a-pagination
        v-model:current="page"
        :page-size="size"
        :total="total"
        size="small"
        :show-size-changer="false"
        @change="load"
      />
    </div>

    <IndustryPickModal
      v-model:open="pickOpen"
      mode="assign"
      :count="pickIds.length"
      :industries="industries"
      :loading="acting"
      @ok="doAssign"
    />

    <a-modal v-model:open="failOpen" title="部分没有挂上" :footer="null">
      <ul class="fails">
        <li v-for="f in fails" :key="f.id">#{{ f.id }}：{{ f.reason }}</li>
      </ul>
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { computed, ref, watch } from 'vue';

import {
  WRITE_DISABLED_TIP,
  batchTemplates,
  setTemplateIndustries,
  getPlazaTemplates,
  isOpBlocked,
  reportWriteError,
  type IndustryNode,
  type PlazaTemplateRow,
} from '@/api/plaza-admin';

import IndustryPickModal from './IndustryPickModal.vue';

const props = defineProps<{ open: boolean; industries: IndustryNode[] }>();
const emit = defineEmits<{ 'update:open': [v: boolean]; changed: [] }>();

const stateLabel: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
  SCHEDULED: '定时上线中',
  EXPIRED: '已过期',
};
const blocked = computed(() => isOpBlocked('industryRel'));
const rows = ref<PlazaTemplateRow[]>([]);
const total = ref(0);
const page = ref(1);
const size = 20;
const loading = ref(false);
const selected = ref<number[]>([]);

async function load() {
  loading.value = true;
  selected.value = [];
  try {
    const res = await getPlazaTemplates({
      unassigned: true,
      page: page.value,
      size,
    });
    rows.value = res?.items ?? [];
    total.value = res?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
watch(
  () => props.open,
  (v) => {
    if (v) {
      page.value = 1;
      load();
    }
  },
);

function pick(id: number, on: boolean) {
  selected.value = on ? [...selected.value, id] : selected.value.filter((x) => x !== id);
}
function toggleAll(e: { target: { checked: boolean } }) {
  selected.value = e.target.checked ? rows.value.map((r) => r.id) : [];
}

const pickOpen = ref(false);
const pickIds = ref<number[]>([]);
const acting = ref(false);
const fails = ref<{ id: number; reason: string }[]>([]);
const failOpen = ref(false);
function openPick(ids: number[]) {
  pickIds.value = ids;
  pickOpen.value = true;
}
async function doAssign(industryIds: number[]) {
  acting.value = true;
  try {
    // 单个模板走增量接口（带 revision 防覆盖）；多个走批量
    if (pickIds.value.length === 1) {
      const row = rows.value.find((x) => x.id === pickIds.value[0]);
      await setTemplateIndustries(pickIds.value[0], {
        assign: industryIds,
        revision: row?.revision,
      });
      message.success('已挂上行业');
      pickOpen.value = false;
      emit('changed');
      await load();
      return;
    }
    const r = await batchTemplates('assign', {
      ids: pickIds.value,
      industryIds,
    });
    if (r.failed.length) {
      fails.value = r.failed;
      failOpen.value = true;
    } else message.success(`已挂上 ${r.ok.length} 个`);
    pickOpen.value = false;
    emit('changed');
    await load();
  } catch (e) {
    reportWriteError(e);
  } finally {
    acting.value = false;
  }
}
</script>

<style scoped>
.bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
}
.thumb {
  width: 40px;
  height: 52px;
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
.txt {
  flex: 1;
  min-width: 0;
}
.t {
  font-weight: 600;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.fails {
  margin: 0;
  padding-left: 18px;
}
</style>
