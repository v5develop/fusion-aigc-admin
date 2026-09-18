<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-alert type="warning" show-icon class="mb-4" :message="$t('pointsPackage.hint')" />

      <a-space class="mb-4">
        <a-button type="primary" @click="openCreate">{{ $t('pointsPackage.create') }}</a-button>
        <a-button @click="load">{{ $t('common.refresh') }}</a-button>
      </a-space>

      <a-table
        :columns="columns"
        :data-source="packages"
        :loading="loading"
        row-key="id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'priceAmount'">
            {{ toMajor(record.priceAmount) }}
          </template>
          <template v-else-if="column.key === 'points'">
            {{ record.basePoints }}
            <span v-if="record.bonusPoints" class="bonus">+{{ record.bonusPoints }}</span>
            <!-- 汇率改过、这个档位没跟着改：它仍在按旧汇率卖点数。
                 不做成拦截是因为这行本来就在正常售卖，硬拦会让一次汇率调整把全站充值打死 -->
            <a-tooltip v-if="record.rateConsistent === false">
              <template #title>
                {{ $t('pointsPackage.rateMismatchTip', { expected: record.expectedBasePoints }) }}
              </template>
              <a-tag color="red" class="mismatch">{{ $t('pointsPackage.rateMismatch') }}</a-tag>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'badge'">
            <a-tag v-if="record.badge" color="orange">{{ record.badge }}</a-tag>
            <span v-else class="form-hint">—</span>
          </template>
          <template v-else-if="column.key === 'enabled'">
            <!-- 切换即保存：下架是止损动作，不该还要再点一次「保存」 -->
            <a-switch
              :checked="record.enabled"
              :loading="togglingId === record.id"
              @change="(checked: boolean) => handleToggle(record, checked)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">{{ $t('common.edit') }}</a>
              <a-popconfirm
                :title="$t('pointsPackage.deleteConfirm')"
                @confirm="handleDelete(record)"
              >
                <a class="danger-link">{{ $t('common.delete') }}</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? $t('pointsPackage.edit') : $t('pointsPackage.create')"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical">
        <a-form-item :label="$t('pointsPackage.packageCode')" name="packageCode">
          <a-input v-model:value="form.packageCode" placeholder="PKG_128" />
          <div class="form-hint">{{ $t('pointsPackage.packageCodeDesc') }}</div>
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.name')" name="name">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.priceMajor')" name="priceMajor">
          <a-input-number
            v-model:value="form.priceMajor"
            :min="0.01"
            :step="1"
            :precision="2"
            class="w-full"
            @change="syncBasePoints"
          />
          <div class="form-hint">{{ $t('pointsPackage.priceDesc') }}</div>
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.basePoints')" name="basePoints">
          <a-input-number v-model:value="form.basePoints" :min="0" :step="100" class="w-full" />
          <div class="form-hint" :class="{ 'text-danger': !baseMatchesRate }">
            {{
              knownRate === null
                ? $t('pointsPackage.basePointsDescNoRate')
                : $t('pointsPackage.basePointsDesc', { expected: expectedBase })
            }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.bonusPoints')">
          <a-input-number v-model:value="form.bonusPoints" :min="0" :step="100" class="w-full" />
          <div class="form-hint">{{ $t('pointsPackage.bonusDesc') }}</div>
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.badge')">
          <a-input v-model:value="form.badge" :placeholder="$t('pointsPackage.badgePlaceholder')" />
        </a-form-item>
        <a-form-item :label="$t('pointsPackage.recommended')">
          <a-switch v-model:checked="form.recommended" />
        </a-form-item>
        <a-form-item :label="$t('common.sort')">
          <a-input-number v-model:value="form.sort" :min="0" class="w-full" />
        </a-form-item>
        <a-form-item :label="$t('common.enabled')">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
        <a-form-item :label="$t('common.remark')">
          <a-input v-model:value="form.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { AdminPointsPackage, PointsPackage } from '@/types/api';

import { message } from 'antdv-next';
/**
 * 点数包（充值套餐）管理。
 *
 * 这张表是**下单金额的唯一出处**：C 端下单只传 packageId，金额与点数一律以本行为准。
 * 在这里改价即改真实售价，不是改一个展示值。
 *
 * 金额在页面上按主单位（元）填，提交时乘 100 转成最小单位（分）——
 * 后端与订单表全程用分，换算只发生在这一层，不要让两种口径同时在接口里流动。
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  getPointsPackages,
  createPointsPackage,
  updatePointsPackage,
  togglePointsPackage,
  deletePointsPackage,
} from '@/api/points-package';

const { t } = useI18n();

const MINOR_UNITS_PER_MAJOR = 100;

const packages = ref<AdminPointsPackage[]>([]);
const loading = ref(false);
const togglingId = ref<number | null>(null);

const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<PointsPackage | null>(null);
// 与其它页一致：不引框架内部类型，避免 antdv-next 版本升级时类型路径漂移
const formRef = ref();

/** 表单里存主单位价格（priceMajor），提交时才换成最小单位。 */
const form = reactive({
  packageCode: '',
  name: '',
  priceMajor: 0,
  basePoints: 0,
  bonusPoints: 0,
  badge: '',
  recommended: false,
  sort: 0,
  enabled: true,
  remark: '',
});

const formRules: Record<string, Array<Record<string, unknown>>> = {
  packageCode: [{ required: true, message: 'PKG_128' }],
  name: [{ required: true }],
  priceMajor: [{ required: true }],
  basePoints: [{ required: true }],
};

const columns = [
  { title: t('pointsPackage.packageCode'), dataIndex: 'packageCode', key: 'packageCode' },
  { title: t('pointsPackage.name'), dataIndex: 'name', key: 'name' },
  { title: t('pointsPackage.priceMajor'), key: 'priceAmount' },
  { title: t('pointsPackage.points'), key: 'points' },
  { title: t('pointsPackage.badge'), key: 'badge' },
  { title: t('common.sort'), dataIndex: 'sort', key: 'sort' },
  { title: t('common.enabled'), key: 'enabled', width: 90 },
  { title: t('common.action'), key: 'action', width: 140 },
];

function toMajor(minor?: number) {
  return ((minor ?? 0) / MINOR_UNITS_PER_MAJOR).toFixed(2);
}

/**
 * 从列表里反推服务端汇率（点/主单位）。
 *
 * 汇率是后端配置（`app.payment.points-per-yuan`），没有单独的接口下发它；
 * 但列表每行都带了「该售价应对应多少基础点数」，除一下就得到汇率。
 * 只认 rateConsistent 的行 —— 失配行的 expectedBasePoints 本身是对的，
 * 但用它反推同样正确，所以这里其实只要一行有效数据；取第一条即可。
 *
 * 列表为空（一个档位都还没建）时返回 null，此时不做自动填充，
 * 让服务端的校验去报准确的数字，而不是让前端瞎猜一个。
 */
const knownRate = computed<number | null>(() => {
  const sample = packages.value.find(
    (item) => (item.priceAmount ?? 0) > 0 && item.expectedBasePoints != null,
  );
  if (!sample) return null;
  return sample.expectedBasePoints! / (sample.priceAmount! / MINOR_UNITS_PER_MAJOR);
});

const expectedBase = computed(() =>
  knownRate.value === null ? null : Math.round(form.priceMajor * knownRate.value),
);

const baseMatchesRate = computed(
  () => expectedBase.value === null || form.basePoints === expectedBase.value,
);

/**
 * 改售价时同步基础点数。
 *
 * 服务端硬校验 `basePoints == 售价 × 汇率`，加送只能进赠送点数。
 * 不自动同步的话，运营每改一次价都要自己心算一遍，而算错的反馈要等到提交被拒。
 * 赠送点数**不动** —— 那是运营的定价决策，不是派生值。
 */
function syncBasePoints() {
  if (expectedBase.value !== null) {
    form.basePoints = expectedBase.value;
  }
}

async function load() {
  loading.value = true;
  try {
    packages.value = await getPointsPackages();
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    packageCode: '',
    name: '',
    priceMajor: 0,
    basePoints: 0,
    bonusPoints: 0,
    badge: '',
    recommended: false,
    sort: packages.value.length * 10,
    enabled: true,
    remark: '',
  });
  modalOpen.value = true;
}

function openEdit(record: AdminPointsPackage) {
  editing.value = record;
  Object.assign(form, {
    packageCode: record.packageCode,
    name: record.name,
    priceMajor: (record.priceAmount ?? 0) / MINOR_UNITS_PER_MAJOR,
    basePoints: record.basePoints ?? 0,
    bonusPoints: record.bonusPoints ?? 0,
    // 修改是整体替换，没填的字段会被写成 null。所以必须把当前值全部回填，
    // 否则运营只改一个名字就会把角标和备注一起清掉。
    badge: record.badge ?? '',
    recommended: record.recommended ?? false,
    sort: record.sort ?? 0,
    enabled: record.enabled ?? true,
    remark: record.remark ?? '',
  });
  modalOpen.value = true;
}

function toPayload(): PointsPackage {
  return {
    packageCode: form.packageCode.trim(),
    name: form.name.trim(),
    priceAmount: Math.round(form.priceMajor * MINOR_UNITS_PER_MAJOR),
    basePoints: form.basePoints,
    bonusPoints: form.bonusPoints,
    // 空串按「清空」提交 null，而不是存一个空字符串 ——
    // 空串和 null 在展示端是两种判断，混着存迟早出现「角标位空了一格」
    badge: form.badge.trim() || null,
    recommended: form.recommended,
    sort: form.sort,
    enabled: form.enabled,
    remark: form.remark.trim() || null,
  };
}

async function handleSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (editing.value?.id) {
      await updatePointsPackage(editing.value.id, toPayload());
    } else {
      await createPointsPackage(toPayload());
    }
    message.success(t('common.saveSuccess'));
    modalOpen.value = false;
    await load();
  } catch {
    /* 编码重复等冲突由后端返回 409，拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function handleToggle(record: AdminPointsPackage, checked: boolean) {
  if (!record.id) return;
  togglingId.value = record.id;
  try {
    await togglePointsPackage(record.id, checked);
    record.enabled = checked;
    message.success(checked ? t('pointsPackage.enabledOn') : t('pointsPackage.enabledOff'));
  } catch {
    /* 失败时不改本地值，开关自动回弹到原状态 */
  } finally {
    togglingId.value = null;
  }
}

async function handleDelete(record: AdminPointsPackage) {
  if (!record.id) return;
  await deletePointsPackage(record.id);
  message.success(t('common.deleteSuccess'));
  await load();
}

onMounted(load);
</script>

<style scoped>
/* 这两个局部工具类沿用各设置页的写法；说明文字的 .form-hint 已提到 global.css，不要再在这里复制一份 */
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
.danger-link {
  color: #ff4d4f;
}
.text-danger {
  color: #ff4d4f;
}
.bonus {
  margin-left: 4px;
  color: #fa8c16;
}
.mismatch {
  margin-left: 6px;
}
</style>
