<template>
  <div class="page-container">
    <a-card :title="$t('feature.modelMapping')">
      <a-form layout="inline" class="mb-4">
        <a-form-item :label="$t('feature.featureName')">
          <a-select
            v-model:value="selectedFeatureId"
            :placeholder="$t('feature.featureNamePlaceholder')"
            style="width: 300px"
            show-search
            :filter-option="filterFeatureOption"
            @change="loadFeatureModels"
          >
            <a-select-option v-for="feature in featureList" :key="feature.id" :value="feature.id">
              {{ feature.featureName?.[currentLocale] || feature.featureName?.['zh-CN'] || feature.featureCode }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>

      <a-divider />

      <div v-if="selectedFeatureId" class="model-mapping-content">
        <div class="mb-4">
          <a-button type="primary" :loading="saveLoading" @click="handleSave">
            <SaveOutlined /> {{ $t('common.save') }}
          </a-button>
        </div>

        <a-row :gutter="[16, 16]">
          <a-col v-for="model in modelList" :key="model.id" :xs="24" :sm="12" :md="8" :lg="6">
            <a-card size="small" :class="{ 'model-card-selected': selectedModelIds.includes(model.id) }">
              <a-checkbox v-model:checked="selectedModelIds" :value="model.id">
                <div class="model-info">
                  <div class="model-name">{{ model.modelName }}</div>
                  <div class="model-meta">{{ model.provider }} · {{ model.modelType }}</div>
                </div>
              </a-checkbox>
            </a-card>
          </a-col>
        </a-row>
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
import { getFeatureList, getFeatureModelMapping, saveFeatureModelMapping } from '@/api/feature'
import { getModelList } from '@/api/model'
import type { Feature, AIModel } from '@/types/api'
import { getLocale } from '@/locales'

const { t } = useI18n()
const currentLocale = computed(() => getLocale())

const featureList = ref<Feature[]>([])
const modelList = ref<AIModel[]>([])
const selectedFeatureId = ref<number | null>(null)
const selectedModelIds = ref<number[]>([])
const saveLoading = ref(false)

async function loadFeatures() {
  try {
    const res = await getFeatureList({ pageNo: 1, pageSize: 100 })
    featureList.value = res.items
  } catch (error) {
    console.error('Failed to load features:', error)
  }
}

async function loadModels() {
  try {
    const res = await getModelList({ pageNo: 1, pageSize: 100 })
    modelList.value = res.items
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
    selectedModelIds.value = res.modelIds || []
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
  color: #999;
}
</style>
