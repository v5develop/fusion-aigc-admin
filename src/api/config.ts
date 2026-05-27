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

export function getStorageConfig() {
  return request.get<StorageConfig>('/api/v1/admin/settings/storage')
}

export function saveStorageConfig(data: StorageConfig) {
  return request.put('/api/v1/admin/settings/storage', data)
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

export function testStorageConnection(data: StorageConfig) {
  return request.post('/api/v1/admin/settings/storage/test', data)
}
