<template>
  <div class="page-container">
    <div class="page-header">
      <a-space>
        <a-button @click="goBack">返回技能目录</a-button>
        <h2 class="ph-title">编辑技能{{ detail ? `：${detail.title}` : '' }}</h2>
        <a-tag v-if="dirty" color="orange">有未保存的修改</a-tag>
      </a-space>
    </div>

    <a-spin v-if="loading" />
    <a-result v-else-if="!detail" status="error" title="技能详情加载失败" sub-title="请返回列表后重试；当前无法保存。">
      <template #extra>
        <a-button type="primary" @click="load">重试</a-button>
      </template>
    </a-result>

    <div v-else class="edit-layout">
      <!-- 分节导航：内容很长（单段提示词上万字），点击直接滚到对应分节 -->
      <nav class="section-nav">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ child: item.child }"
          @click="scrollTo(item.id)"
        >
          {{ item.label }}
        </div>
      </nav>

      <div class="edit-main">
        <a-card id="sec-basic" title="基本信息" variant="borderless" class="edit-card">
          <a-form :model="form" :disabled="saving" :label-col="{ span: 4 }" :wrapper-col="{ span: 18 }">
            <a-form-item label="技能身份">
              <code class="route-code">{{ detail.agentSkillId }}</code>
              <span class="muted" style="margin-left: 8px">与铺货侧共用的 int64，不可改</span>
            </a-form-item>
            <a-form-item label="分类">
              <a-auto-complete
                v-model:value="form.category"
                :options="categoryOptions"
                :filter-option="filterCategoryOption"
                allow-clear
                placeholder="照 v1 的 agent_skill.category 填"
              />
              <div class="muted warn">清空分类 = 这条技能从用户端的 @技能 列表里消失</div>
            </a-form-item>
            <a-form-item label="技能名">
              <a-input v-model:value="form.title" />
            </a-form-item>
            <a-form-item label="描述">
              <a-input v-model:value="form.description" />
            </a-form-item>
            <a-form-item label="图标地址">
              <a-input v-model:value="form.icon" placeholder="选填" />
            </a-form-item>
            <a-form-item label="版本">
              <a-input v-model:value="form.version" placeholder="v1 的 version，是字符串不是数字" />
            </a-form-item>
            <a-form-item label="排序权重">
              <a-input-number v-model:value="form.weight" :min="0" />
              <span class="muted" style="margin-left: 8px">同分类内降序：大的在前（与 v1 一致）</span>
            </a-form-item>
            <a-form-item label="技能编码">
              <a-input v-model:value="form.agentSkillCode" />
              <div class="muted warn">与 v1 对齐身份用的编码。改成别的会让按编码反查的地方找不到，非对齐需要时别动。</div>
            </a-form-item>
            <a-form-item label="启用">
              <a-switch v-model:checked="enabled" />
              <span class="muted" style="margin-left: 8px">停用等于该技能在 @技能 列表里不存在</span>
            </a-form-item>
          </a-form>
        </a-card>

        <a-card id="sec-config" title="执行配置" variant="borderless" class="edit-card">
          <SkillConfigEditor
            ref="editorRef"
            v-model:text="configText"
            :schema="configSchema"
            :skill-code="form.agentSkillCode"
          />
          <div class="muted warn">仅在内容有变化时提交配置；清空全部内容（保存 {}）会清空配置。</div>
        </a-card>

        <div class="save-bar">
          <span class="muted">{{ dirty ? '有未保存的修改' : '没有修改' }}</span>
          <a-space>
            <a-button :disabled="saving" @click="goBack">返回</a-button>
            <a-button
              v-permission="'creaft_catalog:edit'"
              type="primary"
              :loading="saving"
              :disabled="!dirty"
              @click="handleSubmit"
            >
              保存
            </a-button>
          </a-space>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message, Modal } from 'antdv-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';

import {
  getCreaftAgentSkillConfigSchema,
  getCreaftAgentSkillDetail,
  getCreaftAgentSkills,
  updateCreaftAgentSkill,
  type CreaftAgentSkillDetail,
  type CreaftSkillConfigSchema,
} from '@/api/creaft-compat';

import SkillConfigEditor from '../components/SkillConfigEditor.vue';
import { canonical, parseConfig } from '../components/skillConfigModel';

/**
 * 技能编辑页。原先是列表页里的弹窗，但一条技能的规划提示词就上万字、再加工具与十几个分段，
 * 弹窗里只能层层滚动、点一下遮罩就全丢，所以改成独立页：分节导航、底部固定保存栏、离开前拦未保存的修改。
 */
const route = useRoute();
const router = useRouter();
const id = computed(() => Number(route.params.id));

const loading = ref(true);
const saving = ref(false);
const detail = ref<CreaftAgentSkillDetail | null>(null);
const configSchema = ref<CreaftSkillConfigSchema | null>(null);
const categories = ref<string[]>([]);
const configText = ref('');
const editorRef = ref<{ shape: 'react' | 'localLife' | 'overrides'; hasProblems: boolean } | null>(null);

const form = reactive({
  category: undefined as string | undefined,
  title: '',
  description: '',
  icon: '',
  version: '',
  weight: 0,
  enabled: 1,
  agentSkillCode: '',
});
/** 加载时 / 上次保存后的快照（键排序序列化），用来判断有没有未保存的修改 */
const originalForm = ref('');
const originalConfig = ref('');

const enabled = computed({
  get: () => form.enabled === 1,
  set: (value: boolean) => (form.enabled = value ? 1 : 0),
});

const categoryOptions = computed(() => categories.value.map((c) => ({ label: c, value: c })));
function filterCategoryOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase());
}

function formSnapshot() {
  return canonical({ ...form, category: form.category || '' });
}

/** 配置按内容比较：可视化改写会调整键顺序与缩进，内容没变不算修改 */
const configChanged = computed(() => {
  const parsed = parseConfig(configText.value);
  return parsed === null || canonical(parsed) !== originalConfig.value;
});
// 标红的行（键名为空、重名）不在配置文本里，文本看不出改动：也算未保存，离开时要提示
const dirty = computed(() => !!detail.value
  && (formSnapshot() !== originalForm.value || configChanged.value || !!editorRef.value?.hasProblems));

async function load() {
  loading.value = true;
  detail.value = null;
  try {
    const result = await getCreaftAgentSkillDetail(id.value);
    if (!result || result.id !== id.value || !result.config || typeof result.config !== 'object' || Array.isArray(result.config)) {
      message.error('技能详情缺少有效配置，请刷新后重试');
      return;
    }
    Object.assign(form, {
      category: result.category || undefined,
      title: result.title || '',
      description: result.description || '',
      icon: result.icon || '',
      version: result.version || '',
      weight: result.weight ?? 0,
      enabled: result.enabled ?? 1,
      agentSkillCode: result.agentSkillCode || '',
    });
    configText.value = JSON.stringify(result.config, null, 2);
    originalForm.value = formSnapshot();
    originalConfig.value = canonical(result.config);
    detail.value = result;
  } catch {
    /* 拦截器已提示，保持禁止保存 */
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  getCreaftAgentSkillConfigSchema().then((schema) => (configSchema.value = schema || null), () => undefined);
  getCreaftAgentSkills().then(
    (rows) => (categories.value = [...new Set((rows || []).map((r) => r.category).filter((c): c is string => !!c))].sort()),
    () => undefined,
  );
});

// ---- 分节导航 ----
const navItems = computed(() => {
  const items: { id: string; label: string; child?: boolean }[] = [
    { id: 'sec-basic', label: '基本信息' },
    { id: 'sec-config', label: '执行配置' },
  ];
  const schema = configSchema.value;
  const shape = editorRef.value?.shape;
  if (!schema || !shape) return items;
  if (shape === 'react') {
    for (const field of schema.promptFields) items.push({ id: `cfg-${field.key}`, label: field.label, child: true });
    items.push({ id: 'cfg-tags', label: '标签', child: true }, { id: 'cfg-tools', label: '工具', child: true });
    items.push({ id: 'cfg-overrides', label: '提示词覆盖', child: true });
  } else if (shape === 'localLife') {
    items.push({ id: 'cfg-stage-PIPELINE', label: '出图流水线', child: true });
    items.push({ id: 'cfg-stage-TEMPLATE', label: 'AI 生成模板', child: true });
    items.push({ id: 'cfg-overrides', label: '其他分段', child: true });
  } else {
    items.push({ id: 'cfg-overrides', label: '提示词覆盖', child: true });
  }
  return items;
});

function scrollTo(elementId: string) {
  document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 保存 ----
async function handleSubmit() {
  if (!detail.value || saving.value) return;
  if (!form.agentSkillCode.trim()) {
    message.warning('技能编码不能为空');
    return;
  }
  if (editorRef.value?.hasProblems) {
    message.warning('执行配置里有标红的行（键名为空或重名），这些行不会被保存，请先改好或移除');
    return;
  }
  const parsed = parseConfig(configText.value);
  if (!parsed) {
    message.warning('执行配置必须是合法的 JSON 对象');
    return;
  }
  saving.value = true;
  try {
    await updateCreaftAgentSkill(detail.value.id, {
      // 配置没变就不传：服务端对省略的 config 保留现值
      ...(canonical(parsed) === originalConfig.value ? {} : { config: parsed }),
      category: form.category || undefined,
      title: form.title.trim() || undefined,
      description: form.description || undefined,
      icon: form.icon || undefined,
      version: form.version || undefined,
      weight: form.weight ?? 0,
      enabled: form.enabled,
      agentSkillCode: form.agentSkillCode.trim(),
    });
    originalForm.value = formSnapshot();
    originalConfig.value = canonical(parsed);
    message.success('已保存');
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

// ---- 离开拦截 ----
function goBack() {
  router.push({ name: 'CreaftSkill' });
}

function confirmLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: '有未保存的修改',
      content: '离开后这些修改会丢失。确定离开？',
      okText: '离开',
      cancelText: '继续编辑',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

async function guardLeave() {
  if (saving.value) {
    // 保存还没回来就离开：要是这次保存失败，修改会随页面一起丢掉
    message.warning('正在保存，请等保存完成再离开');
    return false;
  }
  if (!dirty.value) return true;
  return confirmLeave();
}

onBeforeRouteLeave(guardLeave);
// 从一条技能的编辑页直接到另一条（浏览器前进 / 后退）是同一条路由换参数，走的是 update 而不是 leave
onBeforeRouteUpdate(guardLeave);

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}
window.addEventListener('beforeunload', onBeforeUnload);
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));
</script>

<style scoped>
.page-container {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header .ph-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}
.edit-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.section-nav {
  position: sticky;
  top: 16px;
  width: 160px;
  flex: none;
  padding: 8px 0;
  border-right: 1px solid var(--color-border-secondary, #f0f0f0);
}
.nav-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary, #262626);
}
.nav-item.child {
  padding-left: 24px;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}
.nav-item:hover {
  color: var(--color-primary, #1677ff);
}
.edit-main {
  flex: 1;
  min-width: 0;
}
.edit-card {
  margin-bottom: 16px;
  scroll-margin-top: 16px;
}
.edit-main :deep(.section) {
  scroll-margin-top: 16px;
}
.save-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-bg-container, #fff);
  border-top: 1px solid var(--color-border-secondary, #f0f0f0);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.muted {
  color: var(--color-text-tertiary, #999);
  font-size: 12px;
}
.muted.warn {
  color: var(--color-warning, #d48806);
}
.route-code {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border-secondary, #f0f0f0);
  background: var(--color-fill-quaternary, #fafafa);
  color: var(--color-text-primary, #262626);
  font-size: 12px;
}
</style>
