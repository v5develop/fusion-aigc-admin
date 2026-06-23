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

      <a-typography-title :level="5">{{ $t('generationMonitor.redisQueueSection') }}</a-typography-title>
      <a-table
        :columns="queueColumns"
        :data-source="queueRows"
        :loading="loading"
        :pagination="false"
        row-key="queueName"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noQueue')" />
        </template>
      </a-table>

      <a-typography-title :level="5" style="margin-top: 24px">
        {{ $t('generationMonitor.creationSection') }}
      </a-typography-title>
      <a-table
        :columns="creationColumns"
        :data-source="creationRows"
        :loading="loading"
        :pagination="false"
        row-key="type"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="$t('generationMonitor.noCreation')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'recentFailed'">
            <a-tag v-if="record.recentFailed > 0" color="error">{{ record.recentFailed }}</a-tag>
            <span v-else>0</span>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getGenerationMetricsOverview,
  type GenerationQueueMetric,
  type CreationTaskMetric,
} from '@/api/generation'

const { t } = useI18n()

const queueRows = ref<GenerationQueueMetric[]>([])
const creationRows = ref<CreationTaskMetric[]>([])
const loading = ref(false)
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const queueColumns = [
  { title: t('generationMonitor.queueName'), dataIndex: 'queueName', width: 280 },
  { title: t('generationMonitor.queueLength'), dataIndex: 'queueLength', width: 120, align: 'center' as const },
  { title: t('generationMonitor.concurrent'), dataIndex: 'concurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.maxConcurrent'), dataIndex: 'maxConcurrent', width: 120, align: 'center' as const },
  { title: t('generationMonitor.availableSlots'), dataIndex: 'availableSlots', width: 120, align: 'center' as const },
]

const creationColumns = [
  { title: t('generationMonitor.creationType'), dataIndex: 'type', width: 280 },
  { title: t('generationMonitor.queued'), dataIndex: 'queued', width: 120, align: 'center' as const },
  { title: t('generationMonitor.processing'), dataIndex: 'processing', width: 120, align: 'center' as const },
  { title: t('generationMonitor.inflight'), dataIndex: 'inflight', width: 120, align: 'center' as const },
  { title: t('generationMonitor.recentFailed'), dataIndex: 'recentFailed', width: 120, align: 'center' as const },
]

async function loadData() {
  loading.value = true
  try {
    const overview = await getGenerationMetricsOverview()
    queueRows.value = overview?.redisQueues || []
    creationRows.value = overview?.creationTasks || []
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
