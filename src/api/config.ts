import { request } from '@/utils/request'
import type { UnionConfig, AIProviderConfig, StorageConfig, SystemConfig } from '@/types/api'

export function getUnionConfig() {
  return request.get<UnionConfig>('/api/v1/admin/settings/union')
}

export function saveUnionConfig(data: UnionConfig) {
  return request.put('/api/v1/admin/settings/union', data)
}

export function getAIProviderConfig() {
  return request.get<AIProviderConfig>('/api/v1/admin/settings/ai-provider')
}

export function saveAIProviderConfig(data: AIProviderConfig) {
  return request.put('/api/v1/admin/settings/ai-provider', data)
}

export function getStorageConfigs() {
  return request.get<StorageConfig[]>('/api/v1/admin/storage/config/list')
}

export async function getStorageConfig() {
  const configs = await getStorageConfigs()
  return configs.find((config) => config.isDefault) ?? configs[0] ?? null
}

export function createStorageConfig(data: StorageConfig) {
  return request.post<number>('/api/v1/admin/storage/config/create', data)
}

export function updateStorageConfig(data: StorageConfig) {
  return request.put<boolean>('/api/v1/admin/storage/config/update', data)
}

export function saveStorageConfig(data: StorageConfig) {
  return data.id ? updateStorageConfig(data) : createStorageConfig(data)
}

export function setDefaultStorageConfig(id: number) {
  return request.put<boolean>('/api/v1/admin/storage/config/set-default', null, { params: { id } })
}

export function getSystemConfig() {
  return request.get<SystemConfig>('/api/v1/admin/settings/system')
}

export function saveSystemConfig(data: SystemConfig) {
  return request.put('/api/v1/admin/settings/system', data)
}

export function testUnionConnection(data: UnionConfig) {
  return request.post('/api/v1/admin/settings/union/test', data)
}

export function testAIProviderConnection(data: AIProviderConfig) {
  return request.post('/api/v1/admin/settings/ai-provider/test', data)
}

export function deleteStorageConfig(id: number) {
  return request.delete<boolean>('/api/v1/admin/storage/config/delete', { params: { id } })
}

export function validateStorageConfig(_data: StorageConfig) {
  return Promise.resolve(true)
}
