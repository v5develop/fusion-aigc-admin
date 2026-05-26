import { request } from '@/utils/request'

export function getUnionConfig() {
  return request.get('/api/v1/admin/settings/union')
}

export function saveUnionConfig(data: Record<string, unknown>) {
  return request.put('/api/v1/admin/settings/union', data)
}

export function getAIProviderConfig() {
  return request.get('/api/v1/admin/settings/ai-provider')
}

export function saveAIProviderConfig(data: Record<string, unknown>) {
  return request.put('/api/v1/admin/settings/ai-provider', data)
}

export function getStorageConfig() {
  return request.get('/api/v1/admin/settings/storage')
}

export function saveStorageConfig(data: Record<string, unknown>) {
  return request.put('/api/v1/admin/settings/storage', data)
}

export function getSystemConfig() {
  return request.get('/api/v1/admin/settings/system')
}

export function saveSystemConfig(data: Record<string, unknown>) {
  return request.put('/api/v1/admin/settings/system', data)
}

export function testUnionConnection(data: Record<string, unknown>) {
  return request.post('/api/v1/admin/settings/union/test', data)
}

export function testAIProviderConnection(data: Record<string, unknown>) {
  return request.post('/api/v1/admin/settings/ai-provider/test', data)
}

export function testStorageConnection(data: Record<string, unknown>) {
  return request.post('/api/v1/admin/settings/storage/test', data)
}
