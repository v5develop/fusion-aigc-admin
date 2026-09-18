<!-- src/views/template/builder/props/SectionProps.vue -->
<!--
  SectionProps — 区域 (TemplateSection) 属性编辑器。

  编辑字段：title / subtitle / role / backgroundColor / padding /
            collapsible / collapsedByDefault。

  数据流：任意字段变化即 emit('update', patch)，由 PropertyPanel 转发为
          update-section。padding 仅以数值形态编辑（统一内边距 px）；
          当底层为 Spacing 对象时，数值输入框留空，输入数字后覆盖为统一值。
-->
<template>
  <a-form class="section-props" layout="vertical" :colon="false">
    <a-form-item :label="$t('template.sectionTitle')">
      <a-input
        :value="section.title"
        :placeholder="$t('template.sectionTitlePlaceholder')"
        allow-clear
        @update:value="onUpdate('title', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sectionSubtitle')">
      <a-input
        :value="section.subtitle"
        :placeholder="$t('template.sectionSubtitlePlaceholder')"
        allow-clear
        @update:value="onUpdate('subtitle', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sectionRole')">
      <a-select
        :value="section.role"
        :options="roleOptions"
        @update:value="onUpdate('role', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sectionBackgroundColor')">
      <a-input
        :value="section.backgroundColor"
        :placeholder="$t('template.sectionBackgroundColorPlaceholder')"
        allow-clear
        @update:value="onUpdate('backgroundColor', $event)"
      />
    </a-form-item>

    <a-form-item :label="$t('template.sectionPadding')">
      <a-input-number
        class="section-props__number"
        :value="paddingValue"
        :min="0"
        :step="4"
        suffix="px"
        @update:value="onPaddingUpdate"
      />
    </a-form-item>

    <div class="section-props__switches">
      <a-form-item :label="$t('template.sectionCollapsible')">
        <a-switch
          :checked="section.collapsible === true"
          size="small"
          @update:checked="onUpdate('collapsible', $event)"
        />
      </a-form-item>

      <a-form-item v-if="section.collapsible" :label="$t('template.sectionCollapsedByDefault')">
        <a-switch
          :checked="section.collapsedByDefault === true"
          size="small"
          @update:checked="onUpdate('collapsedByDefault', $event)"
        />
      </a-form-item>
    </div>
  </a-form>
</template>

<script setup lang="ts">
import type { TemplateSection } from '@/types/template-builder';

import { computed } from 'vue';

import { $t } from '@/locales';

const props = defineProps<{
  section: TemplateSection;
}>();

const emit = defineEmits<{
  (e: 'update', patch: Partial<TemplateSection>): void;
}>();

type SectionRole = TemplateSection['role'];

const roleOptions: { label: string; value: SectionRole }[] = [
  { label: $t('template.sectionRolePrimary'), value: 'primary' },
  { label: $t('template.sectionRoleSidebar'), value: 'sidebar' },
  { label: $t('template.sectionRoleFull'), value: 'full' },
  { label: $t('template.sectionRoleInline'), value: 'inline' },
];

/** padding 仅以数值形态编辑；Spacing 对象时输入框留空 */
const paddingValue = computed<number | undefined>(() =>
  typeof props.section.padding === 'number' ? props.section.padding : undefined,
);

function onUpdate<K extends keyof TemplateSection>(field: K, value: TemplateSection[K]): void {
  emit('update', { [field]: value } as Partial<TemplateSection>);
}

function onPaddingUpdate(value: number | string | null): void {
  if (value === null || value === '') {
    onUpdate('padding', undefined);
    return;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return;
  onUpdate('padding', num);
}
</script>

<style scoped>
.section-props {
  display: flex;
  flex-direction: column;
}

.section-props :deep(.ant-form-item) {
  margin-bottom: var(--spacing-md);
}

.section-props__number {
  width: 140px;
}

.section-props__switches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
}

.section-props__switches :deep(.ant-form-item) {
  margin-bottom: var(--spacing-sm);
}
</style>
