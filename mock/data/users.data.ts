export const adminUser = {
  id: 1,
  username: 'admin',
  nickname: '系统管理员',
  avatar: '',
  roles: ['super_admin'],
  permissions: ['*'],
}

export const regularUser = {
  id: 2,
  username: 'user',
  nickname: '普通用户',
  avatar: '',
  roles: ['user'],
  permissions: ['user:view'],
}
