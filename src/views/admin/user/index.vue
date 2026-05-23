<template>
  <div class="page-container">
    <a-card :title="$t('admin.user.management')">
      <ProTable
        :columns="columns"
        :request="loadData"
        :search="{}"
        row-key="id"
      >
        <template #emptyText>
          <a-empty :description="$t('admin.user.noUserData')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColorMap[record.status]">
              {{ statusMap[record.status] || '-' }}
            </a-tag>
          </template>

          <template v-if="column.dataIndex === 'roles'">
            <a-tag v-for="role in record.roles" :key="role.id">{{ role.roleName }}</a-tag>
          </template>

          <template v-if="column.dataIndex === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleResetPassword(record)">
                {{ $t('admin.user.resetPassword') }}
              </a-button>
              <a-button
                type="link"
                size="small"
                :danger="record.status === 1"
                @click="handleToggleStatus(record)"
              >
                {{ record.status === 1 ? $t('common.disable') : $t('common.enable') }}
              </a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)">
                {{ $t('common.delete') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </ProTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getAdminUserList,
  deleteAdminUser,
  resetAdminPassword,
  toggleAdminStatus,
} from '@/api/admin-user'

const { t } = useI18n()

const statusMap: Record<number, string> = {
  1: t('common.enabled'),
  0: t('common.disabled'),
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const columns = [
  {
    title: t('admin.user.username'),
    dataIndex: 'username',
    searchType: 'input' as const,
    width: 120,
  },
  {
    title: t('admin.user.realName'),
    dataIndex: 'realName',
    width: 120,
  },
  {
    title: t('admin.user.email'),
    dataIndex: 'email',
    width: 180,
  },
  {
    title: t('admin.user.phone'),
    dataIndex: 'phone',
    width: 140,
  },
  {
    title: t('admin.user.roles'),
    dataIndex: 'roles',
    width: 150,
  },
  {
    title: t('common.status'),
    dataIndex: 'status',
    searchType: 'select' as const,
    searchOptions: [
      { label: t('common.enabled'), value: 1 },
      { label: t('common.disabled'), value: 0 },
    ],
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('common.createTime'),
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: t('common.action'),
    dataIndex: 'action',
    width: 200,
    fixed: 'right' as const,
    align: 'center' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getAdminUserList({
    username: params.username as string | undefined,
    status: params.status as number | undefined,
    pageNo: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

function handleResetPassword(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('admin.user.resetPassword'),
    content: t('admin.user.resetPasswordConfirm', { username: record.username }),
    onOk: async () => {
      try {
        await resetAdminPassword(record.id as number, { newPassword: '123456' })
        message.success(t('common.success'))
      } catch (error) {
        console.error('Reset password failed:', error)
      }
    },
  })
}

function handleToggleStatus(record: Record<string, unknown>) {
  const newStatus = record.status === 1 ? 0 : 1
  Modal.confirm({
    title: newStatus === 1 ? t('common.enable') : t('common.disable'),
    content: t('admin.user.toggleStatusConfirm', {
      username: record.username,
      action: newStatus === 1 ? t('common.enable') : t('common.disable'),
    }),
    onOk: async () => {
      try {
        await toggleAdminStatus(record.id as number, newStatus)
        message.success(t('common.success'))
      } catch (error) {
        console.error('Toggle status failed:', error)
      }
    },
  })
}

function handleDelete(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('common.delete'),
    content: t('admin.user.deleteConfirm', { username: record.username }),
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteAdminUser(record.id as number)
        message.success(t('common.success'))
      } catch (error) {
        console.error('Delete failed:', error)
      }
    },
  })
}
</script>
