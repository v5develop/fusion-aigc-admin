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
        <template #toolbar>
          <a-button type="primary" @click="handleCreate">
            {{ $t('admin.user.create') }}
          </a-button>
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

          <template v-if="column.key === 'operation'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleEdit(record)">
                {{ $t('common.edit') }}
              </a-button>
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

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? $t('admin.user.edit') : $t('admin.user.create')"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form :model="formData" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('admin.user.username')" required>
          <a-input
            v-model:value="formData.username"
            :placeholder="$t('admin.user.usernamePlaceholder')"
            :disabled="isEdit"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.user.realName')" required>
          <a-input
            v-model:value="formData.realName"
            :placeholder="$t('admin.user.realNamePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.user.email')">
          <a-input
            v-model:value="formData.email"
            :placeholder="$t('admin.user.emailPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.user.phone')">
          <a-input
            v-model:value="formData.phone"
            :placeholder="$t('admin.user.phonePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.user.password')" required v-if="!isEdit">
          <a-input-password
            v-model:value="formData.password"
            :placeholder="$t('admin.user.passwordPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.user.roles')" required>
          <a-select
            v-model:value="formData.roleIds"
            mode="multiple"
            :placeholder="$t('admin.user.selectRoles')"
            :options="roleOptions"
          />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-switch
            v-model:checked="formData.statusChecked"
            :checked-value="1"
            :unchecked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'antdv-next'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getAdminUserList,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  resetAdminPassword,
  toggleAdminStatus,
} from '@/api/admin-user'
import { getAdminRoleList } from '@/api/admin-role'
import type { AdminRole } from '@/types/api'

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
    dataIndex: 'operation',
    key: 'operation',
    width: 260,
    fixed: 'right' as const,
    align: 'center' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getAdminUserList({
    username: params.username as string | undefined,
    status: params.status as number | undefined,
    page: (params.current as number) || 1,
    pageSize: (params.pageSize as number) || 10,
  })
  return {
    data: res.list || [],
    total: res.total || 0,
    success: true,
  }
}

// Role options for select
const roleOptions = ref<Array<{ label: string; value: number }>>([])

async function loadRoles() {
  try {
    const res = await getAdminRoleList({ page: 1, pageSize: 100 })
    roleOptions.value = (res.list || []).map((r: AdminRole) => ({
      label: r.roleName,
      value: r.id,
    }))
  } catch (error) {
    console.error('Failed to load roles:', error)
  }
}

// CRUD Modal
const modalVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const formData = reactive({
  username: '',
  realName: '',
  email: '',
  phone: '',
  password: '',
  roleIds: [] as number[],
  statusChecked: 1,
})

function handleCreate() {
  isEdit.value = false
  editId.value = null
  formData.username = ''
  formData.realName = ''
  formData.email = ''
  formData.phone = ''
  formData.password = ''
  formData.roleIds = []
  formData.statusChecked = 1
  modalVisible.value = true
}

function handleEdit(record: Record<string, unknown>) {
  isEdit.value = true
  editId.value = record.id as number
  formData.username = record.username as string
  formData.realName = (record.realName as string) || ''
  formData.email = (record.email as string) || ''
  formData.phone = (record.phone as string) || ''
  formData.password = ''
  formData.roleIds = ((record.roles as Array<{ id: number }>) || []).map(r => r.id)
  formData.statusChecked = record.status as number
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.username) {
    message.error(t('admin.user.usernameRequired'))
    return
  }
  if (!formData.realName) {
    message.error(t('admin.user.realNameRequired'))
    return
  }
  if (!isEdit.value && !formData.password) {
    message.error(t('admin.user.passwordRequired'))
    return
  }
  if (!formData.roleIds.length) {
    message.error(t('admin.user.rolesRequired'))
    return
  }

  submitLoading.value = true
  try {
    const data: Record<string, unknown> = {
      username: formData.username,
      realName: formData.realName,
      email: formData.email,
      phone: formData.phone,
      roleIds: formData.roleIds,
      status: formData.statusChecked,
    }
    if (!isEdit.value) {
      data.password = formData.password
    }

    if (isEdit.value && editId.value) {
      await updateAdminUser(editId.value, data)
      message.success(t('admin.user.updateSuccess'))
    } else {
      await createAdminUser(data)
      message.success(t('admin.user.createSuccess'))
    }
    modalVisible.value = false
  } catch (error) {
    console.error('Failed to save user:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleResetPassword(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('admin.user.resetPassword'),
    content: t('admin.user.resetPasswordConfirm', { username: record.username }),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
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
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
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
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
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

onMounted(() => {
  loadRoles()
})
</script>
