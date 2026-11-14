<template>
  <a-modal
    :open="open"
    title="以用户视角预览"
    width="960px"
    :footer="null"
    destroy-on-close
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <div class="bar">
      <a-select
        v-model:value="industry"
        :options="topOptions"
        placeholder="选择行业"
        style="width: 160px"
        @change="onIndustryChange"
      />
      <a-select
        v-model:value="subIndustry"
        :options="subOptions"
        allow-clear
        placeholder="二级（可选）"
        style="width: 150px"
        :disabled="!subOptions.length"
        @change="reload"
      />
      <a-segmented v-model:value="tab" :options="tabs" @change="reload" />
      <a-date-picker
        v-model:value="asOf"
        show-time
        value-format="YYYY-MM-DD HH:mm:ss"
        placeholder="预览某个时刻（默认此刻）"
        style="width: 210px"
        @change="reload"
      />
      <a-checkbox v-model:checked="includeDraft" @change="reload">含草稿 / 已下线</a-checkbox>
    </div>

    <a-alert
      v-if="asOf"
      type="info"
      show-icon
      style="margin-bottom: 10px"
      :message="`正在预览 ${asOf} 这一刻用户会看到的内容（含定时上线 / 下线的效果）`"
    />

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !items.length" :description="emptyText" />
      <div v-else class="grid">
        <div
          v-for="(it, idx) in items"
          :key="it.plazaTemplateId"
          class="card"
          :class="{ hidden: !it.userVisible }"
        >
          <div class="cover">
            <video
              v-if="it.mediaType === 'video' && it.videoUrl"
              :src="it.videoUrl"
              :poster="it.posterUrl ?? undefined"
              muted
              loop
              playsinline
              autoplay
            />
            <img v-else-if="it.coverThumbUrl" :src="it.coverThumbUrl" alt="" />
            <div v-else class="noimg">无图</div>
            <span v-if="tab === 'headline'" class="rank">{{
              String(idx + 1).padStart(2, '0')
            }}</span>
            <span v-if="it.mediaType === 'video'" class="vid">视频</span>
            <span v-if="it.isNew" class="new">新</span>
            <span v-if="!it.userVisible" class="invisible">用户当前不可见</span>
          </div>
          <div class="meta">
            <div class="title" :title="it.title">{{ it.title }}</div>
            <div class="sub">
              <template v-if="it.usageVisible">{{ it.usageCount }} 人做过同款</template>
              <template v-else>做同款人数不足，不显示</template>
              <a-tag v-if="it.state && it.state !== 'PUBLISHED'" style="margin-left: 4px">{{
                stateText[it.state]
              }}</a-tag>
            </div>
          </div>
        </div>
      </div>
    </a-spin>
    <div v-if="total > items.length" class="more">
      仅显示前 {{ items.length }} 条，共 {{ total }} 条
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  getHeadlineCurrent,
  getIndustries,
  previewTemplates,
  type IndustryNode,
  type PreviewTemplateItem,
} from '@/api/plaza-admin';

const props = defineProps<{
  open: boolean;
  /** 打开时预选的行业 code（一级或二级） */
  initialIndustryCode?: string;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const stateText: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
};
const tabs = [
  { label: '头条', value: 'headline' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];

const roots = ref<IndustryNode[]>([]);
const industry = ref<string | undefined>();
const subIndustry = ref<string | undefined>();
const tab = ref<'headline' | 'image' | 'video'>('image');
const asOf = ref<string | undefined>();
const includeDraft = ref(false);
const loading = ref(false);
/** 卡片只用到的字段：模板预览与头条榜单两种来源都能映射成它 */
type CardItem = Pick<
  PreviewTemplateItem,
  | 'plazaTemplateId'
  | 'title'
  | 'mediaType'
  | 'coverThumbUrl'
  | 'videoUrl'
  | 'posterUrl'
  | 'usageCount'
  | 'usageVisible'
  | 'isNew'
  | 'userVisible'
> & { state?: PreviewTemplateItem['state'] };
const items = ref<CardItem[]>([]);
const total = ref(0);

const topOptions = computed(() =>
  roots.value.map((r) => ({
    label: r.enabled ? r.name : `${r.name}（已停用）`,
    value: r.code,
  })),
);
const subOptions = computed(() =>
  (roots.value.find((r) => r.code === industry.value)?.children ?? []).map((c) => ({
    label: c.name,
    value: c.code,
  })),
);
const emptyText = computed(() =>
  tab.value === 'headline'
    ? '这个行业此刻没有头条（总榜只在「头条管理」里看）'
    : '用户此刻在这个行业下看不到任何模板',
);

function onIndustryChange() {
  subIndustry.value = undefined;
  reload();
}

let seq = 0;
async function reload() {
  if (!industry.value) return;
  const s = ++seq;
  loading.value = true;
  try {
    if (tab.value === 'headline') {
      const code = subIndustry.value || industry.value;
      // 头条榜单取管理端 current：用户端的 /plaza/headlines 在 gateway-api，后台没有挂
      const board = await getHeadlineCurrent(code, { silent: true });
      if (s !== seq) return;
      items.value = (board?.items ?? []).map((i) => ({
        plazaTemplateId: i.plazaTemplateId,
        title: i.template.title,
        mediaType: (i.template.mediaType || 'image') as PreviewTemplateItem['mediaType'],
        coverThumbUrl: i.template.cover,
        videoUrl: null,
        posterUrl: i.template.cover,
        usageCount: i.usageVisible ? i.uses7d : null,
        usageVisible: i.usageVisible,
        isNew: i.isNew,
        userVisible: i.template.visible,
      }));
      total.value = items.value.length;
    } else {
      const res = await previewTemplates({
        industry: industry.value,
        subIndustry: subIndustry.value,
        mediaType: tab.value,
        asOf: asOf.value,
        includeDraft: includeDraft.value || undefined,
        page: 1,
        size: 48,
      });
      if (s !== seq) return;
      items.value = res?.data ?? [];
      total.value = res?.total ?? 0;
    }
  } catch {
    if (s === seq) items.value = [];
  } finally {
    if (s === seq) loading.value = false;
  }
}

watch(
  () => props.open,
  async (v) => {
    if (!v) return;
    if (!roots.value.length) {
      try {
        roots.value = (await getIndustries()) ?? [];
      } catch {
        return;
      }
    }
    const code = props.initialIndustryCode;
    const parent = roots.value.find(
      (r) => r.code === code || r.children?.some((c) => c.code === code),
    );
    industry.value = parent?.code ?? industry.value ?? roots.value[0]?.code;
    subIndustry.value = parent && parent.code !== code ? code : undefined;
    reload();
  },
  { immediate: true },
);
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}
.card {
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 8px;
  overflow: hidden;
}
.card.hidden {
  opacity: 0.6;
  border-style: dashed;
}
.cover {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
}
.cover img,
.cover video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.noimg {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--ant-color-text-quaternary, #bbb);
}
.rank,
.vid,
.new,
.invisible {
  position: absolute;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 4px;
  color: #fff;
}
.rank {
  top: 6px;
  left: 6px;
  background: rgba(114, 46, 209, 0.9);
}
.vid {
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.55);
}
.new {
  bottom: 6px;
  left: 6px;
  background: #fa8c16;
}
.invisible {
  bottom: 6px;
  right: 6px;
  background: #cf1322;
}
.meta {
  padding: 6px 8px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
}
.more {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
  text-align: center;
}
</style>
