<template>
  <div class="dashboard">
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
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card variant="borderless">
          <a-statistic
            :title="$t('dashboard.totalFeatures')"
            :value="stats.totalFeatures"
            :value-style="{ color: '#52c41a' }"
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
            :title="$t('dashboard.totalModels')"
            :value="stats.totalModels"
            :value-style="{ color: '#faad14' }"
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
            :title="$t('dashboard.todayConsumption')"
            :value="stats.todayConsumption"
            :value-style="{ color: '#722ed1' }"
          >
            <template #prefix>
              <AccountBookOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
      <a-col :span="24">
        <a-card :title="$t('dashboard.systemStatus')" variant="borderless">
          <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }">
            <a-descriptions-item :label="$t('dashboard.status')">
              <a-badge status="success" :text="$t('dashboard.running')" />
            </a-descriptions-item>
            <a-descriptions-item :label="$t('dashboard.unionConnected')">
              <a-badge :status="unionConnected ? 'success' : 'default'" :text="unionConnected ? $t('dashboard.connected') : $t('dashboard.disconnected')" />
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
  RobotOutlined,
  TeamOutlined,
} from '@antdv-next/icons'
import { reactive, ref } from 'vue'

const stats = reactive({
  totalUsers: 0,
  totalFeatures: 0,
  totalModels: 0,
  todayConsumption: 0,
})

const unionConnected = ref(false)
</script>

<style scoped>
.dashboard {
  padding: 8px 0;
}
</style>
