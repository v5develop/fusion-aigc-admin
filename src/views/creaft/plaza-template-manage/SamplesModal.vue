<template>
  <a-modal
    :open="open"
    :title="`示例素材：${targetName}`"
    width="760px"
    :footer="null"
    destroy-on-close
    @cancel="$emit('update:open', false)"
  >
    <a-alert
      v-if="blocked"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="WRITE_DISABLED_TIP"
    />
    <div class="head">
      <span class="muted">
        每个范围最多
        {{ MAX_SAMPLES }}
        条；「放进去的」是用户该上传的样子，「做出来的」是成品效果。
        {{ scopeType === 'INDUSTRY' ? '行业示例会补给该行业下没有自己示例的模板。' : '' }}
      </span>
      <a-button
        type="primary"
        size="small"
        :disabled="blocked || list.length >= MAX_SAMPLES || !!editing"
        @click="startNew"
      >
        新增
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!list.length && !editing" description="还没有示例素材" />
      <div v-for="s in list" :key="s.id" class="row">
        <img :src="s.thumbUrl || s.url" class="img" alt="" />
        <div class="info">
          <div>
            <a-tag :color="s.role === 'INPUT' ? 'blue' : 'green'">
              {{ s.role === 'INPUT' ? '放进去的' : '做出来的' }}
            </a-tag>
            <b>{{ s.title }}</b>
            <a-tag v-if="!s.enabled" color="default">已停用</a-tag>
          </div>
          <div class="muted url">{{ s.url }}</div>
        </div>
        <a-space :size="2">
          <a-button size="small" type="link" :disabled="blocked" @click="startEdit(s)"
            >编辑</a-button
          >
          <a-button size="small" type="link" danger :disabled="blocked" @click="remove(s)"
            >删除</a-button
          >
        </a-space>
      </div>
    </a-spin>

    <a-form v-if="editing" :label-col="{ span: 4 }" class="form">
      <a-form-item label="类型">
        <a-radio-group v-model:value="form.role">
          <a-radio value="OUTPUT">做出来的</a-radio>
          <a-radio value="INPUT">放进去的</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="标题" required>
        <a-input v-model:value="form.title" :maxlength="40" placeholder="如：示例：足浴店门头" />
      </a-form-item>
      <a-form-item label="图片地址" required>
        <a-input v-model:value="form.url" placeholder="https://…（公有桶地址）">
          <template #suffix>
            <CatalogMediaUpload @uploaded="(u: string) => (form.url = u)" />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item label="缩略图">
        <a-input v-model:value="form.thumbUrl" placeholder="可选，缺省用原图" />
      </a-form-item>
      <a-form-item label="排序">
        <a-input-number v-model:value="form.sortOrder" :min="0" />
        <a-checkbox v-model:checked="form.enabled" style="margin-left: 16px">启用</a-checkbox>
      </a-form-item>
      <a-form-item :wrapper-col="{ offset: 4 }">
        <a-space>
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
          <a-button @click="editing = false">取消</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import { computed, reactive, ref, watch } from 'vue';

import {
  MAX_SAMPLES,
  WRITE_DISABLED_TIP,
  createSample,
  deleteSample,
  getSamples,
  isOpBlocked,
  reportWriteError,
  updateSample,
  type SampleAsset,
  type SampleRole,
  type SampleScope,
} from '@/api/plaza-admin';

import CatalogMediaUpload from '../components/CatalogMediaUpload.vue';

const props = defineProps<{
  open: boolean;
  scopeType: SampleScope;
  /** 行业 id 或模板 id */
  targetId: number;
  targetName: string;
}>();

const blocked = computed(() => isOpBlocked('samples'));
const loading = ref(false);
const saving = ref(false);
const list = ref<SampleAsset[]>([]);
const editing = ref(false);
const editId = ref<number | null>(null);
const form = reactive({
  role: 'OUTPUT' as SampleRole,
  title: '',
  url: '',
  thumbUrl: '',
  sortOrder: 0,
  enabled: true,
});

const scopeParams = () =>
  props.scopeType === 'INDUSTRY'
    ? { scopeType: props.scopeType, industryId: props.targetId }
    : { scopeType: props.scopeType, templateId: props.targetId };

async function load() {
  loading.value = true;
  try {
    list.value = (await getSamples(scopeParams())) ?? [];
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
watch(
  () => props.open,
  (v) => {
    editing.value = false;
    if (v) load();
  },
);

function startNew() {
  editId.value = null;
  Object.assign(form, {
    role: 'OUTPUT',
    title: '',
    url: '',
    thumbUrl: '',
    sortOrder: (list.value.at(-1)?.sortOrder ?? -10) + 10,
    enabled: true,
  });
  editing.value = true;
}
function startEdit(s: SampleAsset) {
  editId.value = s.id;
  Object.assign(form, {
    role: s.role ?? 'OUTPUT',
    title: s.title,
    url: s.url,
    thumbUrl: s.thumbUrl ?? '',
    sortOrder: s.sortOrder,
    enabled: s.enabled,
  });
  editing.value = true;
}

async function save() {
  if (!form.title.trim() || !form.url.trim()) {
    message.warning('标题和图片地址必填');
    return;
  }
  saving.value = true;
  const body = {
    role: form.role,
    title: form.title.trim(),
    url: form.url.trim(),
    thumbUrl: form.thumbUrl.trim() || null,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  };
  try {
    if (editId.value === null) await createSample({ ...scopeParams(), ...body });
    else await updateSample(editId.value, body);
    message.success('已保存');
    editing.value = false;
    await load();
  } catch (e) {
    reportWriteError(e);
  } finally {
    saving.value = false;
  }
}

function remove(s: SampleAsset) {
  Modal.confirm({
    title: `删除示例「${s.title}」？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteSample(s.id);
        message.success('已删除');
        await load();
      } catch (e) {
        reportWriteError(e);
      }
    },
  });
}
</script>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
}
.img {
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.info {
  flex: 1;
  min-width: 0;
}
.url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.form {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--ant-color-border, #d9d9d9);
}
</style>
