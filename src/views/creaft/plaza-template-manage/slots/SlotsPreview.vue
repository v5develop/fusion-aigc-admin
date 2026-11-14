<template>
  <div class="pv">
    <div class="pv-head">
      <b>用户端预览</b>
      <span class="muted">按当前配置渲染，示例交互不保存</span>
    </div>
    <a-empty v-if="!items.length" description="还没有入参" />
    <template v-else>
      <template v-for="g in groups" :key="g.name">
        <div v-if="g.name" class="pv-group">{{ g.name }}</div>
        <div v-for="s in g.items" :key="s.key">
          <div v-if="isVisible(s, values)" class="pv-item">
            <div class="pv-label">
              <span v-if="s.required" class="req">*</span>{{ s.label || '（未命名）' }}
              <span v-if="s.help" class="muted"> · {{ s.help }}</span>
            </div>

            <div v-if="s.type === 'image' || s.type === 'video'" class="pv-media">
              <div class="pv-drop">
                {{ s.type === 'image' ? '点击上传图片' : '点击上传视频' }}
                <span class="muted">
                  {{ countText(s) }}
                  <template v-if="s.acceptRatio"> · 比例 {{ s.acceptRatio }}</template>
                  <template v-if="s.type === 'video' && s.maxDurationSec">
                    · ≤{{ s.maxDurationSec }} 秒</template
                  >
                </span>
              </div>
              <img v-if="s.exampleUrl" :src="s.exampleUrl" class="pv-ex" alt="示例" />
              <div v-if="s.guidance" class="muted">{{ s.guidance }}</div>
            </div>

            <a-input
              v-else-if="s.type === 'text'"
              :value="values[s.key] as string"
              @update:value="(v: unknown) => (values[s.key] = v)"
              :placeholder="s.placeholder"
              :maxlength="s.maxLength"
              :show-count="!!s.maxLength"
            />
            <a-textarea
              v-else-if="s.type === 'textarea'"
              :value="values[s.key] as string"
              @update:value="(v: unknown) => (values[s.key] = v)"
              :rows="3"
              :placeholder="s.placeholder"
              :maxlength="s.maxLength"
              :show-count="!!s.maxLength"
            />
            <a-input-number
              v-else-if="s.type === 'number' || s.type === 'price'"
              :value="values[s.key] as number"
              @update:value="(v: unknown) => (values[s.key] = v)"
              :min="s.min"
              :max="s.max"
              :step="s.step"
              :placeholder="s.placeholder"
              style="width: 100%"
            >
              <template v-if="s.type === 'price'" #prefix>¥</template>
              <template v-if="s.unit" #suffix>{{ s.unit }}</template>
            </a-input-number>
            <a-select
              v-else-if="s.type === 'select'"
              :value="values[s.key] as string"
              @update:value="(v: unknown) => (values[s.key] = v)"
              :options="s.options ?? []"
              :placeholder="s.placeholder || '请选择'"
              allow-clear
              style="width: 100%"
            />
            <a-select
              v-else-if="s.type === 'multiselect'"
              :value="values[s.key] as string[]"
              @update:value="(v: unknown) => (values[s.key] = v)"
              mode="multiple"
              :options="s.options ?? []"
              :placeholder="s.placeholder || '请选择'"
              style="width: 100%"
            />
            <a-switch
              v-else-if="s.type === 'switch'"
              :checked="values[s.key] as boolean"
              @update:checked="(v: boolean) => (values[s.key] = v)"
            />
            <input
              v-else-if="s.type === 'color'"
              :value="values[s.key] as string"
              type="color"
              @input="(e: Event) => (values[s.key] = (e.target as HTMLInputElement).value)"
              class="pv-color"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SlotItem } from '@/api/plaza-admin';

import { computed, reactive, watch } from 'vue';

import { isVisible, type SlotDraft } from './slot-model';

const props = defineProps<{ items: (SlotItem | SlotDraft)[] }>();

const values = reactive<Record<string, unknown>>({});

/** 配置变化时按 default 重置预览值，并保留用户已在预览里改过且仍存在的 key */
watch(
  () => props.items,
  (list) => {
    const keys = new Set(list.map((s) => s.key));
    for (const k of Object.keys(values)) if (!keys.has(k)) delete values[k];
    for (const s of list) {
      if (!(s.key in values))
        values[s.key] =
          s.default ?? (s.type === 'multiselect' ? [] : s.type === 'switch' ? false : undefined);
    }
  },
  { immediate: true, deep: true },
);

const groups = computed(() => {
  const out: { name: string; items: (SlotItem | SlotDraft)[] }[] = [];
  for (const s of props.items) {
    const name = s.group?.trim() ?? '';
    let g = out.find((x) => x.name === name);
    if (!g) out.push((g = { name, items: [] }));
    g.items.push(s);
  }
  return out;
});

function countText(s: SlotItem | SlotDraft) {
  const mn = s.minCount ?? 0;
  const mx = s.maxCount ?? 1;
  return mn === mx ? `${mx} 个` : `${mn}–${mx} 个`;
}
</script>

<style scoped>
.pv {
  border: 1px solid var(--ant-color-border-secondary, #eee);
  border-radius: 8px;
  padding: 12px;
  background: var(--ant-color-bg-container, #fff);
}
.pv-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.pv-group {
  font-weight: 600;
  margin: 12px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--ant-color-border-secondary, #eee);
}
.pv-item {
  margin-bottom: 12px;
}
.pv-label {
  font-size: 13px;
  margin-bottom: 4px;
}
.req {
  color: #cf1322;
  margin-right: 2px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.pv-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 8px;
  border: 1px dashed var(--ant-color-border, #d9d9d9);
  border-radius: 6px;
  font-size: 13px;
}
.pv-ex {
  width: 72px;
  margin-top: 6px;
  border-radius: 4px;
}
.pv-color {
  width: 56px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 4px;
}
</style>
