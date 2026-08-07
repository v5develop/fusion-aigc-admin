<template>
  <div class="page-container">
    <a-card :title="$t('feature.modelMapping')">
      <a-form layout="inline" class="filter-form">
        <a-form-item :label="$t('feature.featureName')">
          <a-select
            v-model:value="selectedFeatureId"
            :placeholder="$t('feature.featureNamePlaceholder')"
            style="width: 300px"
            show-search
            :options="featureOptions"
            :filter-option="filterFeatureOption"
            @change="loadFeatureModels"
          />
        </a-form-item>
      </a-form>

      <div v-if="selectedFeatureId" class="model-mapping-content">
        <div class="save-bar">
          <a-button type="primary" :loading="saveLoading" @click="handleSave">
            <SaveOutlined /> {{ $t('common.save') }}
          </a-button>
        </div>

        <a-checkbox-group v-model:value="selectedModelIds" style="width: 100%">
          <a-row :gutter="[16, 16]">
            <a-col v-for="model in filteredModelList" :key="model.id" :xs="24" :sm="12" :md="8" :lg="6">
              <a-card size="small" :class="{ 'model-card-selected': selectedModelIds.includes(model.id) }">
                <a-checkbox :value="model.id">
                  <div class="model-info">
                    <div class="model-name">{{ model.name }}</div>
                    <div class="model-meta">{{ model.code }} · {{ model.modelType }}</div>
                  </div>
                </a-checkbox>
              </a-card>
            </a-col>
          </a-row>
        </a-checkbox-group>
      </div>

      <a-empty v-else :description="$t('feature.featureNamePlaceholder')" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SaveOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { getFeatureOptions, getFeatureModelMapping, saveFeatureModelMapping } from '@/api/feature'
import { getModelOptions } from '@/api/model'
import type { Feature, AIModel } from '@/types/api'
import { getLocale } from '@/locales'

const { t } = useI18n()
const currentLocale = computed(() => getLocale())

const featureList = ref<Feature[]>([])
const modelList = ref<AIModel[]>([])
const selectedFeatureId = ref<number | null>(null)
const selectedModelIds = ref<number[]>([])
const saveLoading = ref(false)

const actionTypeModelTypeMap: Record<string, number> = {
  IMAGE_GEN: 2,
  VIDEO_GEN: 3,
  TEXT_CHAT: 1,
}

const selectedFeature = computed(() =>
  featureList.value.find(f => f.id === selectedFeatureId.value),
)

const filteredModelList = computed(() => {
  const feature = selectedFeature.value
  if (!feature?.actionType) return modelList.value
  const requiredType = actionTypeModelTypeMap[feature.actionType]
  if (!requiredType) return modelList.value
  return modelList.value.filter(m => m.modelType === requiredType)
})

const featureOptions = computed(() =>
  featureList.value.map(feature => ({
    label: feature.featureName?.[currentLocale.value] || feature.featureName?.['zh-CN'] || feature.featureCode,
    value: feature.id,
  })),
)

async function loadFeatures() {
  try {
    featureList.value = await getFeatureOptions()
  } catch (error) {
    console.error('Failed to load features:', error)
  }
}

async function loadModels() {
  try {
    modelList.value = await getModelOptions()
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

async function loadFeatureModels() {
  if (!selectedFeatureId.value) {
    selectedModelIds.value = []
    return
  }

  try {
    const res = await getFeatureModelMapping(selectedFeatureId.value)
    const modelIds = res.modelIds || []
    // Filter out modelIds that don't match the current feature's actionType
    const feature = selectedFeature.value
    if (feature?.actionType) {
      const requiredType = actionTypeModelTypeMap[feature.actionType]
      if (requiredType) {
        const validIds = new Set(modelList.value.filter(m => m.modelType === requiredType).map(m => m.id))
        selectedModelIds.value = modelIds.filter(id => validIds.has(id))
        return
      }
    }
    selectedModelIds.value = modelIds
  } catch (error) {
    console.error('Failed to load feature models:', error)
    selectedModelIds.value = []
  }
}

async function handleSave() {
  if (!selectedFeatureId.value) return

  saveLoading.value = true
  try {
    await saveFeatureModelMapping(selectedFeatureId.value, {
      modelIds: selectedModelIds.value,
    })
    message.success(t('feature.mappingSaveSuccess'))
  } catch (error) {
    console.error('Failed to save model mapping:', error)
  } finally {
    saveLoading.value = false
  }
}

function filterFeatureOption(input: string, option: any) {
  const feature = featureList.value.find(f => f.id === option.value)
  if (!feature) return false
  const name = feature.featureName?.[currentLocale.value] || feature.featureName?.['zh-CN'] || ''
  return name.toLowerCase().includes(input.toLowerCase()) || feature.featureCode.toLowerCase().includes(input.toLowerCase())
}

onMounted(() => {
  loadFeatures()
  loadModels()
})
</script>

<style scoped>
.filter-form {
  margin-bottom: 16px;
}

.save-bar {
  margin-bottom: 16px;
}

.model-mapping-content {
  margin-top: 16px;
}

.model-card-selected {
  border-color: #1890ff;
  background-color: #e6f7ff;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-name {
  font-weight: 500;
}

.model-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
