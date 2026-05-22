import { request } from '@/utils/request'

export function getUnionConfig() {
  return request.get('/api/admin/settings/union')
}

export function saveUnionConfig(data: Record<string, unknown>) {
  return request.put('/api/admin/settings/union', data)
}

export function getAIProviderConfig() {
  return request.get('/api/admin/settings/ai-provider')
}

export function saveAIProviderConfig(data: Record<string, unknown>) {
  return request.put('/api/admin/settings/ai-provider', data)
}

export function getStorageConfig() {
  return request.get('/api/admin/settings/storage')
}

export function saveStorageConfig(data: Record<string, unknown>) {
  return request.put('/api/admin/settings/storage', data)
}

export function getSystemConfig() {
  return request.get('/api/admin/settings/system')
}

export function saveSystemConfig(data: Record<string, unknown>) {
  return request.put('/api/admin/settings/system', data)
}
