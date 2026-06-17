<template>
  <div class="page-container">
    <a-card :title="$t('generationMonitor.title')">
      <template #extra>
        <a-space>
          <a-switch
            v-model:checked="autoRefresh"
            :checked-children="$t('generationMonitor.autoRefreshOn')"
            :un-checked-children="$t('generationMonitor.autoRefreshOff')"
          />
          <a-button :loading="loading" @click="loadData">
            {{ $t('common.refresh') }}
          </a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="queueName"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noQueue')" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getGenerationMetrics, type GenerationQueueMetric } from '@/api/generation'

const { t } = useI18n()

const rows = ref<GenerationQueueMetric[]>([])
const loading = ref(false)
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const columns = [
  { title: t('generationMonitor.queueName'), dataIndex: 'queueName', width: 280 },
  { title: t('generationMonitor.queueLength'), dataIndex: 'queueLength', width: 120, align: 'center' as const },
  { title: t('generationMonitor.concurrent'), dataIndex: 'concurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.maxConcurrent'), dataIndex: 'maxConcurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.availableSlots'), dataIndex: 'availableSlots', width: 120, align: 'center' as const },
]

async function loadData() {
  loading.value = true
  try {
    rows.value = (await getGenerationMetrics()) || []
  } catch (error) {
    console.error('Failed to load generation metrics:', error)
  } finally {
    loading.value = false
  }
}

function startTimer() {
  stopTimer()
  timer = setInterval(loadData, 5000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoRefresh, (on) => {
  if (on) {
    startTimer()
  } else {
    stopTimer()
  }
})

onMounted(loadData)
onUnmounted(stopTimer)
</script>
