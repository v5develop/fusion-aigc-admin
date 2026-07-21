<template>
  <div class="page-container">
    <ProTable
      :columns="columns"
      :request="loadData"
      :search="{}"
      row-key="id"
    >
      <template #emptyText>
        <a-empty :description="$t('admin.role.noRoleData')" />
      </template>
      <template #toolbar>
        <a-button type="primary" @click="handleCreate">
          {{ $t('admin.role.create') }}
        </a-button>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </a-tag>
        </template>

        <template v-if="column.key === 'operation'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="handleEdit(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-button type="link" size="small" @click="handleAssignPermission(record)">
              {{ $t('admin.role.assignPermission') }}
            </a-button>
            <a-button type="link" size="small" danger @click="handleDelete(record)">
              {{ $t('common.delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </ProTable>

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:open="roleModalVisible"
      :title="isEdit ? $t('admin.role.edit') : $t('admin.role.create')"
      :confirm-loading="roleSubmitLoading"
      @ok="handleRoleSubmit"
      width="500px"
    >
      <a-form :model="roleForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item :label="$t('admin.role.roleCode')" v-if="!isEdit">
          <a-input
            v-model:value="roleForm.roleCode"
            :placeholder="$t('admin.role.roleCode')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.role.roleName')">
          <a-input
            v-model:value="roleForm.roleName"
            :placeholder="$t('admin.role.roleName')"
          />
        </a-form-item>
        <a-form-item :label="$t('admin.role.description')">
          <a-textarea
            v-model:value="roleForm.description"
            :rows="3"
          />
        </a-form-item>
        <a-form-item :label="$t('model.status')">
          <a-switch
            v-model:checked="roleForm.statusChecked"
            :checked-value="1"
            :un-checked-value="0"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Permission Assignment Modal -->
    <a-modal
      v-model:open="permModalVisible"
      :title="$t('admin.role.assignPermission')"
      :confirm-loading="permSubmitLoading"
      @ok="handlePermSubmit"
      width="700px"
    >
      <div class="perm-tree-container">
        <a-tree
          v-model:checked-keys="selectedPermissions"
          :tree-data="permTreeData"
          checkable
          :field-names="{ children: 'children', title: 'title', key: 'key' }"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { message, Modal } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import ProTable from '@/components/Pro/ProTable/index.vue'
import {
  getAdminRoleList,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getRolePermissions,
  saveRolePermissions,
  type Permission,
} from '@/api/admin-role'
import { getPermissionTree } from '@/api/admin-permission'

const { t, locale } = useI18n()

// Role list columns
const columns = [
  {
    title: t('admin.role.roleCode'),
    dataIndex: 'roleCode',
    search: true,
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('admin.role.roleName'),
    dataIndex: 'roleName',
    search: true,
    searchType: 'input' as const,
    width: 180,
  },
  {
    title: t('admin.role.description'),
    dataIndex: 'description',
    ellipsis: true,
  },
  {
    title: t('model.status'),
    dataIndex: 'status',
    search: true,
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
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]

async function loadData(params: Record<string, unknown>) {
  const res = await getAdminRoleList({
    roleCode: params.roleCode as string | undefined,
    roleName: params.roleName as string | undefined,
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

// Role CRUD
const roleModalVisible = ref(false)
const roleSubmitLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number | null>(null)

const roleForm = reactive({
  roleCode: '',
  roleName: '',
  description: '',
  statusChecked: 1,
})

function handleCreate() {
  isEdit.value = false
  editId.value = null
  roleForm.roleCode = ''
  roleForm.roleName = ''
  roleForm.description = ''
  roleForm.statusChecked = 1
  roleModalVisible.value = true
}

function handleEdit(record: Record<string, unknown>) {
  isEdit.value = true
  editId.value = record.id as number
  roleForm.roleCode = record.roleCode as string
  roleForm.roleName = record.roleName as string
  roleForm.description = (record.description as string) || ''
  roleForm.statusChecked = record.status as number
  roleModalVisible.value = true
}

async function handleRoleSubmit() {
  roleSubmitLoading.value = true
  try {
    if (isEdit.value && editId.value) {
      await updateAdminRole(editId.value, {
        roleName: roleForm.roleName,
        description: roleForm.description,
        status: roleForm.statusChecked,
      })
      message.success(t('admin.role.updateSuccess'))
    } else {
      await createAdminRole({
        roleCode: roleForm.roleCode,
        roleName: roleForm.roleName,
        description: roleForm.description,
        status: roleForm.statusChecked,
      })
      message.success(t('admin.role.createSuccess'))
    }
    roleModalVisible.value = false
  } catch (error) {
    console.error('Failed to save role:', error)
  } finally {
    roleSubmitLoading.value = false
  }
}

function handleDelete(record: Record<string, unknown>) {
  Modal.confirm({
    title: t('admin.role.delete'),
    content: t('admin.role.confirmDelete'),
    onOk: async () => {
      try {
        await deleteAdminRole(record.id as number)
        message.success(t('admin.role.deleteSuccess'))
      } catch (error) {
        console.error('Failed to delete role:', error)
      }
    },
  })
}

// Permission assignment
const permModalVisible = ref(false)
const permSubmitLoading = ref(false)
const currentRoleId = ref<number | null>(null)
const selectedPermissions = ref<string[]>([])

interface PermTreeNode {
  key: string
  title: string
  children?: PermTreeNode[]
}

const permTreeData = ref<PermTreeNode[]>([])

function getPermName(p: Permission): string {
  try {
    const parsed = JSON.parse(p.permissionName)
    return parsed[locale.value] || parsed['zh-CN'] || parsed['en-US'] || p.permissionCode
  } catch {
    return p.permissionName || p.permissionCode
  }
}

function buildPermTreeFromGroups(groups: Array<{ resource: string; resourceName: string; permissions: Permission[] }>): PermTreeNode[] {
  return groups.map(group => ({
    key: `group_${group.resource}`,
    title: getResourceName(group),
    selectable: false,
    children: group.permissions.map(p => ({
      key: p.permissionCode,
      title: getPermName(p),
    })),
  }))
}

function getResourceName(group: { resource: string; resourceName: string }): string {
  try {
    if (group.resourceName) {
      const parsed = JSON.parse(group.resourceName)
      return parsed[locale.value] || parsed['zh-CN'] || parsed['en-US'] || group.resource
    }
    return group.resource
  } catch {
    return group.resource
  }
}

async function handleAssignPermission(record: Record<string, unknown>) {
  currentRoleId.value = record.id as number
  permModalVisible.value = true

  try {
    const [treeRes, assigned] = await Promise.all([
      getPermissionTree(),
      getRolePermissions(record.id as number),
    ])
    permTreeData.value = buildPermTreeFromGroups(treeRes)
    selectedPermissions.value = assigned
  } catch (error) {
    console.error('Failed to load permissions:', error)
  }
}

async function handlePermSubmit() {
  permSubmitLoading.value = true
  try {
    if (currentRoleId.value) {
      await saveRolePermissions(currentRoleId.value, selectedPermissions.value)
      message.success(t('common.saveSuccess'))
      permModalVisible.value = false
    }
  } catch (error) {
    console.error('Failed to save permissions:', error)
  } finally {
    permSubmitLoading.value = false
  }
}
</script>

<style scoped>
.perm-tree-container {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 0;
}
</style>
