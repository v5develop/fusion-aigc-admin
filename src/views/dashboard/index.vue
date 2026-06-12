<template>
  <div class="dashboard">
    <!-- 核心指标卡片 -->
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.totalUsers')"
            :value="stats.totalUsers"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix>
              <TeamOutlined />
            </template>
            <template #suffix>
              <span class="stat-suffix" v-if="stats.todayNewUsers > 0">
                +{{ stats.todayNewUsers }}
              </span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.totalProjects')"
            :value="stats.totalProjects"
            :value-style="{ color: '#13c2c2' }"
          >
            <template #prefix>
              <FolderOutlined />
            </template>
            <template #suffix>
              <span class="stat-suffix" v-if="stats.todayNewProjects > 0">
                +{{ stats.todayNewProjects }}
              </span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.todayTasks')"
            :value="stats.todayTasks"
            :value-style="{ color: '#722ed1' }"
          >
            <template #prefix>
              <ThunderboltOutlined />
            </template>
            <template #suffix>
              <span class="stat-suffix stat-success" v-if="stats.todaySuccessTasks > 0">
                ✓{{ stats.todaySuccessTasks }}
              </span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.todayConsumption')"
            :value="stats.todayConsumption"
            :value-style="{ color: '#fa541c' }"
          >
            <template #prefix>
              <AccountBookOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 次要指标卡片 -->
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.totalModels')"
            :value="stats.totalModels"
            :value-style="{ color: '#faad14' }"
            :precision="0"
          >
            <template #prefix>
              <RobotOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.totalFeatures')"
            :value="stats.totalFeatures"
            :value-style="{ color: '#52c41a' }"
            :precision="0"
          >
            <template #prefix>
              <AppstoreOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.openDifferences')"
            :value="stats.openDifferences"
            :value-style="{ color: stats.openDifferences > 0 ? '#ff4d4f' : '#52c41a' }"
          >
            <template #prefix>
              <WarningOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 趋势图表 -->
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
      <a-col :xs="24" :lg="12">
        <a-card :title="$t('dashboard.taskTrend')" variant="borderless">
          <div ref="taskChartRef" class="chart-container"></div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="$t('dashboard.consumptionTrend')" variant="borderless">
          <div ref="consumeChartRef" class="chart-container"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 系统状态 -->
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
      <a-col :span="24">
        <a-card :title="$t('dashboard.systemStatus')" variant="borderless">
          <a-descriptions :column="{ xs: 1, sm: 2, md: 4 }">
            <a-descriptions-item :label="$t('dashboard.status')">
              <a-badge status="success" :text="$t('dashboard.running')" />
            </a-descriptions-item>
            <a-descriptions-item :label="$t('dashboard.unionConnected')">
              <a-badge :status="unionConnected ? 'success' : 'default'" :text="unionConnected ? $t('dashboard.connected') : $t('dashboard.disconnected')" />
            </a-descriptions-item>
            <a-descriptions-item :label="$t('dashboard.todayUnionRequests')">
              {{ stats.todayUnionRequests }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('dashboard.todayUnionSuccess')">
              {{ stats.todayUnionSuccess }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import {
  AccountBookOutlined,
  AppstoreOutlined,
  FolderOutlined,
  RobotOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@antdv-next/icons'
import { reactive, ref, onMounted, nextTick } from 'vue'
import { getDashboardStats } from '@/api/dashboard'

const stats = reactive({
  totalUsers: 0,
  totalFeatures: 0,
  totalModels: 0,
  totalProjects: 0,
  todayNewUsers: 0,
  todayNewProjects: 0,
  todayTasks: 0,
  todaySuccessTasks: 0,
  todayFailedTasks: 0,
  todayConsumption: 0,
  todayUnionRequests: 0,
  todayUnionSuccess: 0,
  openDifferences: 0,
})

const unionConnected = ref(false)
const taskChartRef = ref<HTMLElement>()
const consumeChartRef = ref<HTMLElement>()

async function loadStats() {
  try {
    const res = await getDashboardStats()
    stats.totalUsers = res.totalUsers || 0
    stats.totalFeatures = res.totalFeatures || 0
    stats.totalModels = res.totalModels || 0
    stats.totalProjects = res.totalProjects || 0
    stats.todayNewUsers = res.todayNewUsers || 0
    stats.todayNewProjects = res.todayNewProjects || 0
    stats.todayTasks = res.todayTasks || 0
    stats.todaySuccessTasks = res.todaySuccessTasks || 0
    stats.todayFailedTasks = res.todayFailedTasks || 0
    stats.todayConsumption = res.todayConsumption || 0
    stats.todayUnionRequests = res.todayUnionRequests || 0
    stats.todayUnionSuccess = res.todayUnionSuccess || 0
    stats.openDifferences = res.openDifferences || 0

    await nextTick()
    renderCharts(res.trend)
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  }
}

function renderCharts(trend: Record<string, unknown> | undefined) {
  if (!trend) return
  const labels = trend.labels as string[]
  const taskCounts = trend.taskCounts as number[]
  const consumeAmounts = trend.consumeAmounts as number[]

  // Simple bar chart using CSS (no external chart library needed)
  if (taskChartRef.value && labels?.length) {
    const maxTask = Math.max(...taskCounts, 1)
    taskChartRef.value.innerHTML = `
      <div class="bar-chart">
        ${labels.map((label, i) => `
          <div class="bar-item">
            <div class="bar-track">
              <div class="bar" style="height: ${(taskCounts[i] / maxTask) * 100}%">
                <span class="bar-value">${taskCounts[i]}</span>
              </div>
            </div>
            <div class="bar-label">${label.slice(5)}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  if (consumeChartRef.value && labels?.length) {
    const maxConsume = Math.max(...consumeAmounts, 1)
    consumeChartRef.value.innerHTML = `
      <div class="bar-chart">
        ${labels.map((label, i) => `
          <div class="bar-item">
            <div class="bar-track">
              <div class="bar bar-consume" style="height: ${(consumeAmounts[i] / maxConsume) * 100}%">
                <span class="bar-value">${consumeAmounts[i]}</span>
              </div>
            </div>
            <div class="bar-label">${label.slice(5)}</div>
          </div>
        `).join('')}
      </div>
    `
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard {
  padding: 8px 0;
}

.stat-suffix {
  font-size: 12px;
  color: #52c41a;
  margin-left: 4px;
}

.stat-suffix.stat-success {
  color: #52c41a;
}

.chart-container {
  height: 280px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow-x: auto;
}

.chart-container :deep(.bar-chart) {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100%;
  padding: 0 16px;
  gap: 8px;
  min-width: 100%;
}

.chart-container :deep(.bar-item) {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  min-width: 32px;
  max-width: 60px;
}

.chart-container :deep(.bar-track) {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 0;
  padding-top: 18px;
  box-sizing: border-box;
}

.chart-container :deep(.bar) {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, #1890ff 0%, #69c0ff 100%);
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transition: height 0.3s ease;
  position: relative;
}

.chart-container :deep(.bar-consume) {
  background: linear-gradient(180deg, #fa541c 0%, #ff7a45 100%);
}

.chart-container :deep(.bar-value) {
  position: absolute;
  top: -16px;
  font-size: 11px;
  color: #595959;
  padding: 0;
  white-space: nowrap;
  line-height: 1;
}

.chart-container :deep(.bar-label) {
  font-size: 11px;
  color: #8c8c8c;
  margin-top: 8px;
  white-space: nowrap;
  text-align: center;
  line-height: 1.2;
}

@media (max-width: 768px) {
  .chart-container :deep(.bar-item) {
    min-width: 24px;
    max-width: 40px;
  }

  .chart-container :deep(.bar-value) {
    font-size: 10px;
    padding: 1px 2px;
  }

  .chart-container :deep(.bar-label) {
    font-size: 10px;
    margin-top: 4px;
  }
}
</style>
