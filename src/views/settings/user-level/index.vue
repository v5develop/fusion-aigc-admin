<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-alert type="info" show-icon class="mb-4" :message="$t('userLevel.hint')" />

      <a-form layout="inline" class="mb-4">
        <a-form-item :label="$t('userLevel.enabled')">
          <!-- 切换即保存：单个布尔值没有「改几项再一起提交」的需求，
               而排队优先级出问题时要能一键立刻退回 FIFO -->
          <a-switch
            v-model:checked="settings.enabled"
            :loading="savingSettings"
            @change="handleToggleEnabled"
          />
        </a-form-item>
        <a-form-item :label="$t('userLevel.weights')">
          <a-input
            v-model:value="weightsText"
            class="weights-input"
            :placeholder="WEIGHTS_PLACEHOLDER"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :loading="savingSettings" @click="handleSaveWeights">
            {{ $t('common.save') }}
          </a-button>
        </a-form-item>
      </a-form>
      <div class="form-hint mb-4">{{ $t('userLevel.weightsDesc') }}</div>

      <a-space class="mb-4">
        <a-button type="primary" @click="openCreate">{{ $t('userLevel.create') }}</a-button>
        <a-button @click="loadRules">{{ $t('common.refresh') }}</a-button>
      </a-space>

      <a-table
        :columns="columns"
        :data-source="rules"
        :loading="loading"
        row-key="id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'enabled'">
            <a-tag :color="record.enabled ? 'green' : 'default'">
              {{ record.enabled ? $t('common.enabled') : $t('common.disabled') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">{{ $t('common.edit') }}</a>
              <!-- 最低档不给删除入口：后端也会拒，但把一个注定失败的按钮摆出来
                   等于让运营先点一次才知道不行 -->
              <a-popconfirm
                v-if="Number(record.minScore) !== 0"
                :title="$t('userLevel.deleteConfirm')"
                @confirm="handleDelete(record)"
              >
                <a class="danger-link">{{ $t('common.delete') }}</a>
              </a-popconfirm>
              <span v-else class="form-hint">{{ $t('userLevel.baseLevel') }}</span>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? $t('userLevel.edit') : $t('userLevel.create')"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical">
        <a-form-item :label="$t('userLevel.levelCode')" name="levelCode">
          <a-input v-model:value="form.levelCode" placeholder="LV3" />
        </a-form-item>
        <a-form-item :label="$t('userLevel.levelName')" name="levelName">
          <a-input v-model:value="form.levelName" />
        </a-form-item>
        <a-form-item :label="$t('userLevel.minScore')" name="minScore">
          <a-input-number v-model:value="form.minScore" :min="0" :step="10" class="w-full" />
          <div class="form-hint">{{ $t('userLevel.minScoreDesc') }}</div>
        </a-form-item>
        <a-form-item :label="$t('userLevel.queuePriority')" name="queuePriority">
          <a-input-number v-model:value="form.queuePriority" :min="0" :max="99" class="w-full" />
          <div class="form-hint">{{ $t('userLevel.queuePriorityDesc') }}</div>
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
/**
 * 经验等级 LV0..LVn 管理。
 *
 * 等级由「累计充值额 / 付费月数 / 最高单笔充值额」加权打分得出，**只驱动生成排队优先级**。
 * 它不参与水印这类权利边界 —— 那个看的是设置页的「免费/付费分层」开关。
 * 两者混在一起的后果：改一次运营梯度，用户已有产物就会突然长出或掉掉水印。
 */
import { ref, reactive, onMounted } from 'vue'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import {
  getUserLevelRules,
  createUserLevelRule,
  updateUserLevelRule,
  deleteUserLevelRule,
  getUserLevelSettings,
  saveUserLevelSettings,
} from '@/api/user-level'
import type { UserLevelRule } from '@/types/api'

const { t } = useI18n()

const WEIGHTS_PLACEHOLDER =
  '{"rechargeAmountWeight":1.0,"paidMonthWeight":20.0,"topPackageAmountWeight":0.5}'

const rules = ref<UserLevelRule[]>([])
const loading = ref(false)
const settings = reactive({ enabled: true })
const weightsText = ref('')
const savingSettings = ref(false)

const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<UserLevelRule | null>(null)
// 与 profile 页一致：不引框架内部类型，避免 antdv-next 版本升级时类型路径漂移
const formRef = ref()
const form = reactive<UserLevelRule>({
  levelCode: '',
  levelName: '',
  minScore: 0,
  queuePriority: 0,
  sort: 0,
  enabled: true,
  remark: '',
})

const formRules: Record<string, Array<Record<string, unknown>>> = {
  levelCode: [{ required: true, message: 'LV0..LVn' }],
  levelName: [{ required: true }],
  minScore: [{ required: true }],
  queuePriority: [{ required: true }],
}

const columns = [
  { title: t('userLevel.levelCode'), dataIndex: 'levelCode', key: 'levelCode' },
  { title: t('userLevel.levelName'), dataIndex: 'levelName', key: 'levelName' },
  { title: t('userLevel.minScore'), dataIndex: 'minScore', key: 'minScore' },
  { title: t('userLevel.queuePriority'), dataIndex: 'queuePriority', key: 'queuePriority' },
  { title: t('common.enabled'), key: 'enabled' },
  { title: t('common.remark'), dataIndex: 'remark', key: 'remark' },
  { title: t('common.action'), key: 'action', width: 160 },
]

async function loadRules() {
  loading.value = true
  try {
    rules.value = await getUserLevelRules()
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  try {
    const data = await getUserLevelSettings()
    settings.enabled = data.enabled
    weightsText.value = data.weights ?? ''
  } catch {
    /* 错误已由拦截器提示 */
  }
}

async function handleToggleEnabled(checked: boolean) {
  savingSettings.value = true
  try {
    // 只改开关时不带 weights：后端约定 weights 为空=不动系数。
    // 把当前输入框内容一起提交，会把运营正在编辑但还没想好的中间态写进 DB。
    await saveUserLevelSettings({ enabled: checked })
    message.success(checked ? t('userLevel.enabledOn') : t('userLevel.enabledOff'))
  } catch {
    settings.enabled = !checked
  } finally {
    savingSettings.value = false
  }
}

async function handleSaveWeights() {
  savingSettings.value = true
  try {
    await saveUserLevelSettings({ enabled: settings.enabled, weights: weightsText.value })
    message.success(t('common.saveSuccess'))
    await loadSettings()
  } catch {
    /* 后端会拒绝不可解析的 JSON 并给出原因 */
  } finally {
    savingSettings.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, {
    levelCode: '',
    levelName: '',
    minScore: 0,
    queuePriority: 0,
    sort: rules.value.length,
    enabled: true,
    remark: '',
  })
  modalOpen.value = true
}

function openEdit(record: UserLevelRule) {
  editing.value = record
  Object.assign(form, { ...record })
  modalOpen.value = true
}

async function handleSubmit() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value?.id) {
      await updateUserLevelRule(editing.value.id, { ...form })
    } else {
      await createUserLevelRule({ ...form })
    }
    message.success(t('common.saveSuccess'))
    modalOpen.value = false
    await loadRules()
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: UserLevelRule) {
  if (!record.id) return
  try {
    await deleteUserLevelRule(record.id)
    message.success(t('common.deleteSuccess'))
    await loadRules()
  } catch {
    /* 错误已由拦截器提示 */
  }
}

onMounted(() => {
  loadRules()
  loadSettings()
})
</script>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
.weights-input {
  width: 420px;
}
.form-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.danger-link {
  color: #ff4d4f;
}
</style>
