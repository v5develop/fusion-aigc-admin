import { request } from '@/utils/request'
import type { UnionConfig, AiProvider, AiProviderPageParams, PageResult, StorageConfig, SystemConfig, SystemStorageConfig } from '@/types/api'

export function getUnionConfig() {
  return request.get<UnionConfig>('/api/v1/admin/settings/union')
}

export function saveUnionConfig(data: UnionConfig) {
  return request.put('/api/v1/admin/settings/union', data)
}

export function getApiConfigList() {
  return request.get<AiProvider[]>('/api/v1/admin/ai-provider/list')
}

// ===== AI 供应商 CRUD =====

export function getAiProviderList() {
  return request.get<AiProvider[]>('/api/v1/admin/ai-provider/list')
}

export function getAiProviderPage(params: AiProviderPageParams) {
  return request.get<PageResult<AiProvider>>('/api/v1/admin/ai-provider', { params })
}

export function createAiProvider(data: Partial<AiProvider>) {
  return request.post<number>('/api/v1/admin/ai-provider', data)
}

export function updateAiProvider(id: number, data: Partial<AiProvider>) {
  return request.put(`/api/v1/admin/ai-provider/${id}`, { ...data, id })
}

export function deleteAiProvider(id: number) {
  return request.delete(`/api/v1/admin/ai-provider/${id}`)
}

/** 兼容旧引用（getAIProviderConfig → 取列表第一条全局默认） */
export async function getAIProviderConfig() {
  const list = await getAiProviderList()
  return { providers: list, defaultProvider: '', enableRemoteModels: '' }
}

export function testAiProviderConnection(data: Partial<AiProvider>) {
  return request.post('/api/v1/admin/settings/ai-provider/test', data)
}

/** 兼容旧引用 */
export function saveAIProviderConfig(_data: unknown) {
  // 不再直接调用，由 CRUD 接口替代
  return Promise.resolve(true)
}

/** 兼容旧引用 */
export { testAiProviderConnection as testAIProviderConnection }

// ===== 存储配置 =====

export function getStorageConfigs() {
  return request.get<StorageConfig[]>('/api/v1/admin/storage-configs/list')
}

export async function getStorageConfig() {
  const configs = await getStorageConfigs()
  return configs.find((config) => config.isDefault) ?? configs[0] ?? null
}

export function createStorageConfig(data: StorageConfig) {
  return request.post<number>('/api/v1/admin/storage-configs/create', data)
}

export function updateStorageConfig(data: StorageConfig) {
  return request.put<boolean>('/api/v1/admin/storage-configs/update', data)
}

export function saveStorageConfig(data: StorageConfig) {
  return data.id ? updateStorageConfig(data) : createStorageConfig(data)
}

export function setDefaultStorageConfig(id: number) {
  return request.put<boolean>(`/api/v1/admin/storage-configs/set-default/${id}`)
}

export function getSystemConfig() {
  return request.get<SystemConfig>('/api/v1/admin/settings/system')
}

export function saveSystemConfig(data: SystemConfig) {
  return request.put('/api/v1/admin/settings/system', data)
}

/** 系统级存储（数据库配置 B，双桶 + STS）。覆盖系统文件配置 A，被用户级配置 C 覆盖。 */
export function getSystemStorageConfig() {
  return request.get<SystemStorageConfig>('/api/v1/admin/settings/storage')
}

export function saveSystemStorageConfig(data: SystemStorageConfig) {
  return request.put('/api/v1/admin/settings/storage', data)
}

export function testSystemStorageConnection(data: SystemStorageConfig) {
  return request.post('/api/v1/admin/settings/storage/test', data)
}

export function testUnionConnection(data: UnionConfig) {
  return request.post('/api/v1/admin/settings/union/test', data)
}

export function deleteStorageConfig(id: number) {
  return request.delete<boolean>(`/api/v1/admin/storage-configs/delete/${id}`)
}

export function validateStorageConfig(_data: StorageConfig) {
  return Promise.resolve(true)
}
