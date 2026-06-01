<template>
  <div class="page-container">
    <a-card :title="$t('settingsStorage.title')">
      <template #extra>
        <a-button type="primary" @click="handleAdd">
          <PlusOutlined /> {{ $t('settingsStorage.addConfig') }}
        </a-button>
      </template>

      <a-alert
        class="storage-alert"
        type="info"
        show-icon
        :message="$t('settingsStorage.realConfigTip')"
      />

      <a-table
        :columns="columns"
        :data-source="configList"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('settingsStorage.noConfigData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'type'">
            <a-tag color="blue">{{ platformMap[record.type] || record.type }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'status'">
            <a-switch
              v-model:checked="record.status"
              :checked-value="1"
              :unchecked-value="0"
              @change="handleStatusChange(record)"
            />
          </template>

          <template v-if="column.dataIndex === 'isDefault'">
            <a-tag v-if="record.isDefault" color="green">{{ $t('common.yes') }}</a-tag>
            <span v-else>-</span>
          </template>

          <template v-if="column.key === 'operation'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                {{ $t('common.edit') }}
              </a-button>
              <a-button
                v-if="!record.isDefault"
                type="link"
                size="small"
                @click="handleSetDefault(record)"
              >
                {{ $t('settingsStorage.setDefault') }}
              </a-button>
              <a-popconfirm
                :title="$t('settingsStorage.confirmDelete')"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>
                  {{ $t('common.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- Add/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('settingsStorage.editConfig') : $t('settingsStorage.addConfig')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="700px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('settingsStorage.name')" required>
          <a-input
            v-model:value="formData.name"
            :placeholder="$t('settingsStorage.namePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('settingsStorage.type')" required>
          <a-select
            v-model:value="formData.storagePlatform"
            :placeholder="$t('settingsStorage.typePlaceholder')"
            :options="platformOptions"
            @change="handlePlatformChange"
          />
          <div class="form-hint">{{ currentPlatformConfig.description }}</div>
        </a-form-item>

        <template v-if="isLocalPlatform">
          <a-form-item :label="$t('settingsStorage.basePath')" required>
            <a-input
              v-model:value="formData.basePath"
              :placeholder="$t('settingsStorage.localBasePathPlaceholder')"
            />
            <div class="form-hint">{{ $t('settingsStorage.localBasePathHint') }}</div>
          </a-form-item>
        </template>

        <template v-else>
          <a-form-item :label="$t('settingsStorage.endpoint')" required>
            <a-input
              v-model:value="formData.endpoint"
              :placeholder="currentPlatformConfig.endpointPlaceholder"
            />
            <div class="form-hint">{{ currentPlatformConfig.endpointHint }}</div>
          </a-form-item>

          <a-form-item :label="$t('settingsStorage.bucketName')" required>
            <a-input
              v-model:value="formData.bucketName"
              :placeholder="$t('settingsStorage.bucketNamePlaceholder')"
            />
          </a-form-item>

          <a-form-item :label="currentPlatformConfig.accessKeyLabel" required>
            <a-input
              v-model:value="formData.accessKey"
              :placeholder="currentPlatformConfig.accessKeyPlaceholder"
            />
          </a-form-item>

          <a-form-item :label="currentPlatformConfig.secretKeyLabel" required>
            <a-input-password
              v-model:value="formData.secretKey"
              :placeholder="currentPlatformConfig.secretKeyPlaceholder"
            />
            <div v-if="hasMaskedSecret" class="form-hint">{{ $t('settingsStorage.maskedSecretHint') }}</div>
          </a-form-item>

          <a-form-item :label="$t('settingsStorage.region')">
            <a-input
              v-model:value="formData.region"
              :placeholder="currentPlatformConfig.regionPlaceholder"
            />
          </a-form-item>

          <a-form-item :label="$t('settingsStorage.basePath')">
            <a-input
              v-model:value="formData.basePath"
              :placeholder="$t('settingsStorage.objectPrefixPlaceholder')"
            />
            <div class="form-hint">{{ $t('settingsStorage.objectPrefixHint') }}</div>
          </a-form-item>

          <a-form-item :label="$t('settingsStorage.customDomain')">
            <a-input
              v-model:value="formData.customDomain"
              :placeholder="$t('settingsStorage.customDomainPlaceholder')"
            />
            <div class="form-hint">{{ $t('settingsStorage.customDomainHint') }}</div>
          </a-form-item>

          <template v-if="supportsSts">
            <a-form-item :label="currentPlatformConfig.stsRoleArnLabel">
              <a-input
                v-model:value="formData.stsRoleArn"
                :placeholder="currentPlatformConfig.stsRoleArnPlaceholder"
              />
              <div class="form-hint">{{ $t('settingsStorage.stsRoleArnHint') }}</div>
            </a-form-item>

            <a-form-item :label="currentPlatformConfig.stsRegionLabel">
              <a-space style="width: 100%">
                <a-checkbox v-model:checked="stsRegionSameAsRegion" @change="handleStsRegionSameChange">
                  {{ $t('settingsStorage.stsRegionSameAsRegion') }}
                </a-checkbox>
              </a-space>
              <a-input
                v-if="!stsRegionSameAsRegion"
                v-model:value="formData.stsRegion"
                :placeholder="currentPlatformConfig.stsRegionPlaceholder"
                style="margin-top: 8px"
              />
              <div v-if="stsRegionSameAsRegion" class="form-hint">
                {{ $t('settingsStorage.stsRegionHint') }}: {{ formData.region || '-' }}
              </div>
              <div v-else class="form-hint">{{ $t('settingsStorage.stsRegionHint') }}</div>
            </a-form-item>
          </template>
        </template>

        <a-form-item :label="$t('settingsStorage.remark')">
          <a-textarea
            v-model:value="formData.remark"
            :placeholder="$t('settingsStorage.remarkPlaceholder')"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'antdv-next'
import { PlusOutlined } from '@antdv-next/icons'
import { useI18n } from 'vue-i18n'
import {
  getStorageConfigs,
  createStorageConfig,
  updateStorageConfig,
  setDefaultStorageConfig,
  deleteStorageConfig,
} from '@/api/config'
import type { StorageConfig, StoragePlatform } from '@/types/api'

interface StorageFormData {
  id?: number
  name: string
  storagePlatform: StoragePlatform
  endpoint: string
  bucketName: string
  accessKey: string
  secretKey: string
  region: string
  basePath: string
  customDomain: string
  stsRoleArn: string
  stsRegion: string
  remark: string
}

interface PlatformConfig {
  value: StoragePlatform
  label: string
  description: string
  endpointPlaceholder: string
  endpointHint: string
  accessKeyLabel: string
  accessKeyPlaceholder: string
  secretKeyLabel: string
  secretKeyPlaceholder: string
  regionPlaceholder: string
  stsRoleArnLabel: string
  stsRoleArnPlaceholder: string
  stsRegionLabel: string
  stsRegionPlaceholder: string
}

const { t } = useI18n()

const loading = ref(false)
const submitLoading = ref(false)
const modalVisible = ref(false)
const isEdit = ref(false)
const configList = ref<StorageConfig[]>([])
const stsRegionSameAsRegion = ref(true)

const formData = reactive<StorageFormData>({
  name: '',
  storagePlatform: 'local',
  endpoint: '',
  bucketName: '',
  accessKey: '',
  secretKey: '',
  region: '',
  basePath: './data/media',
  customDomain: '',
  stsRoleArn: '',
  stsRegion: '',
  remark: '',
})

const platformConfigs = computed<Record<StoragePlatform, PlatformConfig>>(() => ({
  local: {
    value: 'local',
    label: t('settingsStorage.platform.local'),
    description: t('settingsStorage.platformDesc.local'),
    endpointPlaceholder: '',
    endpointHint: '',
    accessKeyLabel: t('settingsStorage.accessKey'),
    accessKeyPlaceholder: '',
    secretKeyLabel: t('settingsStorage.secretKey'),
    secretKeyPlaceholder: '',
    regionPlaceholder: '',
    stsRoleArnLabel: '',
    stsRoleArnPlaceholder: '',
    stsRegionLabel: '',
    stsRegionPlaceholder: '',
  },
  aliyun_oss: {
    value: 'aliyun_oss',
    label: t('settingsStorage.platform.aliyunOss'),
    description: t('settingsStorage.platformDesc.aliyunOss'),
    endpointPlaceholder: 'https://oss-cn-hangzhou.aliyuncs.com',
    endpointHint: t('settingsStorage.endpointHint.aliyunOss'),
    accessKeyLabel: t('settingsStorage.aliyunAccessKeyLabel'),
    accessKeyPlaceholder: t('settingsStorage.aliyunAccessKeyPlaceholder'),
    secretKeyLabel: t('settingsStorage.aliyunSecretKeyLabel'),
    secretKeyPlaceholder: t('settingsStorage.aliyunSecretKeyPlaceholder'),
    regionPlaceholder: 'cn-hangzhou',
    stsRoleArnLabel: t('settingsStorage.aliyunStsRoleArn'),
    stsRoleArnPlaceholder: t('settingsStorage.aliyunStsRoleArnPlaceholder'),
    stsRegionLabel: t('settingsStorage.aliyunStsRegion'),
    stsRegionPlaceholder: t('settingsStorage.aliyunStsRegionPlaceholder'),
  },
  tencent_cos: {
    value: 'tencent_cos',
    label: t('settingsStorage.platform.tencentCos'),
    description: t('settingsStorage.platformDesc.tencentCos'),
    endpointPlaceholder: 'https://cos.ap-guangzhou.myqcloud.com',
    endpointHint: t('settingsStorage.endpointHint.tencentCos'),
    accessKeyLabel: t('settingsStorage.secretId'),
    accessKeyPlaceholder: t('settingsStorage.secretIdPlaceholder'),
    secretKeyLabel: t('settingsStorage.secretKey'),
    secretKeyPlaceholder: t('settingsStorage.secretKeyPlaceholder'),
    regionPlaceholder: 'ap-guangzhou',
    stsRoleArnLabel: t('settingsStorage.tencentStsRoleArn'),
    stsRoleArnPlaceholder: t('settingsStorage.tencentStsRoleArnPlaceholder'),
    stsRegionLabel: t('settingsStorage.tencentStsRegion'),
    stsRegionPlaceholder: t('settingsStorage.tencentStsRegionPlaceholder'),
  },
  aws_s3: {
    value: 'aws_s3',
    label: t('settingsStorage.platform.awsS3'),
    description: t('settingsStorage.platformDesc.awsS3'),
    endpointPlaceholder: 'https://s3.us-east-1.amazonaws.com',
    endpointHint: t('settingsStorage.endpointHint.awsS3'),
    accessKeyLabel: t('settingsStorage.awsAccessKeyLabel'),
    accessKeyPlaceholder: t('settingsStorage.awsAccessKeyPlaceholder'),
    secretKeyLabel: t('settingsStorage.awsSecretKeyLabel'),
    secretKeyPlaceholder: t('settingsStorage.awsSecretKeyPlaceholder'),
    regionPlaceholder: 'us-east-1',
    stsRoleArnLabel: t('settingsStorage.awsStsRoleArn'),
    stsRoleArnPlaceholder: t('settingsStorage.awsStsRoleArnPlaceholder'),
    stsRegionLabel: t('settingsStorage.awsStsRegion'),
    stsRegionPlaceholder: t('settingsStorage.awsStsRegionPlaceholder'),
  },
  s3: {
    value: 's3',
    label: t('settingsStorage.platform.s3'),
    description: t('settingsStorage.platformDesc.s3'),
    endpointPlaceholder: 'https://s3.example.com',
    endpointHint: t('settingsStorage.endpointHint.s3'),
    accessKeyLabel: t('settingsStorage.accessKey'),
    accessKeyPlaceholder: t('settingsStorage.accessKeyPlaceholder'),
    secretKeyLabel: t('settingsStorage.secretKey'),
    secretKeyPlaceholder: t('settingsStorage.secretKeyPlaceholder'),
    regionPlaceholder: 'us-east-1',
    stsRoleArnLabel: t('settingsStorage.stsRoleArn'),
    stsRoleArnPlaceholder: t('settingsStorage.stsRoleArnPlaceholder'),
    stsRegionLabel: t('settingsStorage.stsRegion'),
    stsRegionPlaceholder: t('settingsStorage.stsRegionPlaceholder'),
  },
  minio: {
    value: 'minio',
    label: t('settingsStorage.platform.minio'),
    description: t('settingsStorage.platformDesc.minio'),
    endpointPlaceholder: 'http://localhost:9000',
    endpointHint: t('settingsStorage.endpointHint.minio'),
    accessKeyLabel: t('settingsStorage.accessKey'),
    accessKeyPlaceholder: t('settingsStorage.accessKeyPlaceholder'),
    secretKeyLabel: t('settingsStorage.secretKey'),
    secretKeyPlaceholder: t('settingsStorage.secretKeyPlaceholder'),
    regionPlaceholder: 'us-east-1',
    stsRoleArnLabel: t('settingsStorage.stsRoleArn'),
    stsRoleArnPlaceholder: t('settingsStorage.stsRoleArnPlaceholder'),
    stsRegionLabel: t('settingsStorage.stsRegion'),
    stsRegionPlaceholder: t('settingsStorage.stsRegionPlaceholder'),
  },
}))

const platformOptions = computed(() => Object.values(platformConfigs.value).map((item) => ({
  label: item.label,
  value: item.value,
})))

const platformMap = computed(() => {
  const map: Record<string, string> = {}
  Object.values(platformConfigs.value).forEach((item) => {
    map[item.value] = item.label
  })
  return map
})

const currentPlatformConfig = computed(() => platformConfigs.value[formData.storagePlatform])
const isLocalPlatform = computed(() => formData.storagePlatform === 'local')
const isMinioPlatform = computed(() => formData.storagePlatform === 'minio')
const supportsSts = computed(() => !isLocalPlatform.value && !isMinioPlatform.value)
const hasMaskedSecret = computed(() => isMaskedValue(formData.accessKey) || isMaskedValue(formData.secretKey))

const columns = computed(() => [
  { title: t('settingsStorage.name'), dataIndex: 'name', key: 'name' },
  { title: t('settingsStorage.type'), dataIndex: 'type', key: 'type' },
  { title: t('settingsStorage.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('settingsStorage.isDefault'), dataIndex: 'isDefault', key: 'isDefault', width: 100 },
  { title: t('settingsStorage.remark'), dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: t('common.operation'), key: 'operation', width: 220 },
])

function isMaskedValue(value?: string) {
  return !!value && value.includes('****')
}

function inferPlatform(config: StorageConfig): StoragePlatform {
  if (config.type === 'local') return 'local'

  const endpoint = (config.endpoint || '').toLowerCase()
  if (endpoint.includes('aliyuncs.com')) return 'aliyun_oss'
  if (endpoint.includes('myqcloud.com') || endpoint.includes('tencentcos')) return 'tencent_cos'
  if (endpoint.includes('amazonaws.com')) return 'aws_s3'
  if (endpoint.includes('minio')) return 'minio'
  return 's3'
}

function hydrateForm(config: StorageConfig) {
  Object.assign(formData, {
    id: config.id,
    name: config.name || '',
    storagePlatform: inferPlatform(config),
    endpoint: config.endpoint || '',
    bucketName: config.bucketName || '',
    accessKey: config.accessKey || '',
    secretKey: config.secretKey || '',
    region: config.region || '',
    basePath: config.basePath || (config.type === 'local' ? './data/media' : ''),
    customDomain: config.customDomain || '',
    stsRoleArn: config.stsRoleArn || '',
    stsRegion: config.stsRegion || '',
    remark: config.remark || '',
  })
  stsRegionSameAsRegion.value = !config.stsRegion || config.stsRegion === config.region
}

function resetForm() {
  Object.assign(formData, {
    id: undefined,
    name: '',
    storagePlatform: 'local',
    endpoint: '',
    bucketName: '',
    accessKey: '',
    secretKey: '',
    region: '',
    basePath: './data/media',
    customDomain: '',
    stsRoleArn: '',
    stsRegion: '',
    remark: '',
  })
  stsRegionSameAsRegion.value = true
}

function handleStsRegionSameChange() {
  if (stsRegionSameAsRegion.value) {
    formData.stsRegion = formData.region
  }
}

function toSavePayload(): StorageConfig {
  const payload: StorageConfig = {
    id: formData.id,
    name: formData.name.trim(),
    type: isLocalPlatform.value ? 'local' : 's3',
    basePath: formData.basePath.trim() || undefined,
    status: 1,
    remark: formData.remark.trim() || undefined,
  }

  if (!isLocalPlatform.value) {
    payload.endpoint = formData.endpoint.trim()
    payload.bucketName = formData.bucketName.trim()
    payload.region = formData.region.trim() || undefined
    payload.customDomain = formData.customDomain.trim() || undefined
    payload.stsRoleArn = formData.stsRoleArn.trim() || undefined
    payload.stsRegion = stsRegionSameAsRegion.value ? formData.region.trim() || undefined : formData.stsRegion.trim() || undefined
    if (!isMaskedValue(formData.accessKey)) {
      payload.accessKey = formData.accessKey.trim()
    }
    if (!isMaskedValue(formData.secretKey)) {
      payload.secretKey = formData.secretKey.trim()
    }
  }

  return payload
}

function handlePlatformChange() {
  if (isLocalPlatform.value) {
    formData.endpoint = ''
    formData.bucketName = ''
    formData.accessKey = ''
    formData.secretKey = ''
    formData.region = ''
    formData.customDomain = ''
    if (!formData.basePath) {
      formData.basePath = './data/media'
    }
    return
  }

  if (formData.basePath === './data/media') {
    formData.basePath = ''
  }
  if (!formData.region && ['aws_s3', 'minio', 's3'].includes(formData.storagePlatform)) {
    formData.region = 'us-east-1'
  }
}

async function loadConfigs() {
  loading.value = true
  try {
    const res = await getStorageConfigs()
    configList.value = res || []
  } catch {
    configList.value = []
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  isEdit.value = false
  resetForm()
  modalVisible.value = true
}

function handleEdit(record: StorageConfig) {
  isEdit.value = true
  hydrateForm(record)
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.name.trim()) {
    message.error(t('settingsStorage.nameRequired'))
    return
  }
  if (!isLocalPlatform.value) {
    if (!formData.endpoint.trim()) {
      message.error(t('settingsStorage.endpointRequired'))
      return
    }
    if (!formData.bucketName.trim()) {
      message.error(t('settingsStorage.bucketNameRequired'))
      return
    }
    if (!formData.accessKey.trim()) {
      message.error(t('settingsStorage.accessKeyRequired'))
      return
    }
    if (!formData.secretKey.trim()) {
      message.error(t('settingsStorage.secretKeyRequired'))
      return
    }
  } else if (!formData.basePath.trim()) {
    message.error(t('settingsStorage.basePathRequired'))
    return
  }

  submitLoading.value = true
  try {
    const result = await (isEdit.value ? updateStorageConfig : createStorageConfig)(toSavePayload())
    if (!isEdit.value && typeof result === 'number') {
      formData.id = result
    }
    message.success(t('settingsStorage.saveSuccess'))
    modalVisible.value = false
    await loadConfigs()
  } finally {
    submitLoading.value = false
  }
}

async function handleStatusChange(record: StorageConfig) {
  try {
    await updateStorageConfig({
      ...record,
      status: record.status === 1 ? 0 : 1,
    })
    message.success(t('common.operationSuccess'))
    await loadConfigs()
  } catch {
    record.status = record.status === 1 ? 0 : 1
  }
}

async function handleSetDefault(record: StorageConfig) {
  try {
    await setDefaultStorageConfig(record.id!)
    message.success(t('settingsStorage.setDefaultSuccess'))
    await loadConfigs()
  } catch {
    // Error handled by interceptor
  }
}

async function handleDelete(record: StorageConfig) {
  try {
    await deleteStorageConfig(record.id!)
    message.success(t('common.deleteSuccess'))
    await loadConfigs()
  } catch {
    // Error handled by interceptor
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.storage-alert {
  margin-bottom: 16px;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
