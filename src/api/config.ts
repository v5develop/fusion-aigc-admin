import type {
  UnionConfig,
  AiProvider,
  AiProviderPageParams,
  PageResult,
  StorageConfig,
  SystemConfig,
  SystemStorageConfig,
  AgentModelProfile,
  AiWritingModel,
  AiTtsModel,
} from '@/types/api';

import { request } from '@/utils/request';

export function getUnionConfig() {
  return request.get<UnionConfig>('/api/v1/admin/settings/union');
}

export function saveUnionConfig(data: UnionConfig) {
  return request.put('/api/v1/admin/settings/union', data);
}

export function getApiConfigList() {
  return request.get<AiProvider[]>('/api/v1/admin/ai-provider/list');
}

// ===== AI 供应商 CRUD =====

export function getAiProviderList() {
  return request.get<AiProvider[]>('/api/v1/admin/ai-provider/list');
}

export function getAiProviderPage(params: AiProviderPageParams) {
  return request.get<PageResult<AiProvider>>('/api/v1/admin/ai-provider', { params });
}

export function createAiProvider(data: Partial<AiProvider>) {
  return request.post<number>('/api/v1/admin/ai-provider', data);
}

export function updateAiProvider(id: number, data: Partial<AiProvider>) {
  return request.put(`/api/v1/admin/ai-provider/${id}`, { ...data, id });
}

export function deleteAiProvider(id: number) {
  return request.delete(`/api/v1/admin/ai-provider/${id}`);
}

/** 兼容旧引用（getAIProviderConfig → 取列表第一条全局默认） */
export async function getAIProviderConfig() {
  const list = await getAiProviderList();
  return { providers: list, defaultProvider: '', enableRemoteModels: '' };
}

export function testAiProviderConnection(data: Partial<AiProvider>) {
  return request.post('/api/v1/admin/settings/ai-provider/test', data);
}

/** 兼容旧引用 */
export function saveAIProviderConfig(_data: unknown) {
  // 不再直接调用，由 CRUD 接口替代
  return Promise.resolve(true);
}

/** 兼容旧引用 */
export { testAiProviderConnection as testAIProviderConnection };

// ===== 存储配置 =====

export function getStorageConfigs() {
  return request.get<StorageConfig[]>('/api/v1/admin/storage-configs/list');
}

export async function getStorageConfig() {
  const configs = await getStorageConfigs();
  return configs.find((config) => config.isDefault) ?? configs[0] ?? null;
}

export function createStorageConfig(data: StorageConfig) {
  return request.post<number>('/api/v1/admin/storage-configs/create', data);
}

export function updateStorageConfig(data: StorageConfig) {
  return request.put<boolean>('/api/v1/admin/storage-configs/update', data);
}

export function saveStorageConfig(data: StorageConfig) {
  return data.id ? updateStorageConfig(data) : createStorageConfig(data);
}

export function setDefaultStorageConfig(id: number) {
  return request.put<boolean>(`/api/v1/admin/storage-configs/set-default/${id}`);
}

export function getSystemConfig() {
  return request.get<SystemConfig>('/api/v1/admin/settings/system');
}

export function saveSystemConfig(data: SystemConfig) {
  return request.put('/api/v1/admin/settings/system', data);
}

/** Agent 模型档位绑定（提示词优化按是否带图自动路由 TEXT/VISION 档；与用户权限角色无关） */
export function getAgentModelProfiles() {
  return request.get<AgentModelProfile[]>('/api/v1/admin/settings/agent-model-profiles');
}

export function bindAgentModelProfile(profile: string, modelId: number | null) {
  return request.put<boolean>(`/api/v1/admin/settings/agent-model-profiles/${profile}`, {
    modelId,
  });
}

/** 前端「AI 帮写」专用提示词优化模型（独立一档，与管线内部自动优化解耦） */
export function getAiWritingModel() {
  return request.get<AiWritingModel>('/api/v1/admin/settings/ai-writing-model');
}

export function saveAiWritingModel(modelId: number | null) {
  return request.put<boolean>('/api/v1/admin/settings/ai-writing-model', { modelId });
}

/** AI语音合成模型配置，供所有需要配音的业务共用 */
export function getAiTtsModel() {
  return request.get<AiTtsModel>('/api/v1/admin/settings/ai-tts-model');
}

export function saveAiTtsModel(modelId: number | null) {
  return request.put<boolean>('/api/v1/admin/settings/ai-tts-model', { modelId });
}

/** 传空串/ null 即清除，回退配置文件默认值。 */

/**
 * 视频展示水印开关。
 *
 * 返回的是「DB 优先、未配置回退 yaml」之后的<b>实际生效值</b>，不是裸 DB 值——
 * 所以首次打开看到的可能是 yaml 的默认（false），此时 DB 里并无该行。
 *
 * 开启后由后台扫描任务为视频生成加水印副本：展示走水印版、下载仍给原件。
 * 代价是每条视频多一次整段 ffmpeg 编码 + 另存一份，与图片水印（OSS 实时处理、零存储）
 * 完全不是一个量级，故默认关闭。
 */
export function getVideoWatermarkEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/video-watermark');
}

/** 写入 DB 即时生效、覆盖 yaml，无需重启。 */
export function setVideoWatermarkEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/video-watermark', undefined, {
    params: { enabled },
  });
}

/**
 * 图片盲水印开关。同样是「DB 优先、未配置回退 yaml」后的实际生效值。
 *
 * 开启后每张出图都会调外部盲水印微服务嵌入溯源信息；该服务异常时会拖慢整条出图链路，
 * 故保留一键关闭。未配置 app.blind-watermark.base-url 时后端会拒绝开启。
 */
export function getBlindWatermarkEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/blind-watermark');
}

export function setBlindWatermarkEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/blind-watermark', undefined, {
    params: { enabled },
  });
}

/**
 * 图片展示水印总开关（可见水印，**不是**盲水印）。
 *
 * 口径见后端 docs/WATERMARK_AND_USER_TIER.md：免费用户查看/下载/进资产库一律带水印，
 * 付费用户查看带（可开关）、下载与资产库不带。关掉总开关后谁都不带，
 * 且交付管线停止生成新的展示副本。
 *
 * 同样是「DB 优先、未配置回退 yaml」后的实际生效值。
 * 未配置 logo 与文字时后端会拒绝开启 —— 否则开着也画不出任何东西。
 */
export function getDisplayWatermarkEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/display-watermark');
}

export function setDisplayWatermarkEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/display-watermark', undefined, {
    params: { enabled },
  });
}

/**
 * 付费用户查看是否也带水印。**只管付费档**。
 *
 * 免费用户查看/下载/进资产库恒带水印，不受它影响 ——
 * 它决定的是付费档走「付费即无水印」还是「付费仅下载无水印」。
 */
export function getPaidViewWatermarkEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/paid-view-watermark');
}

export function setPaidViewWatermarkEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/paid-view-watermark', undefined, {
    params: { enabled },
  });
}

/**
 * 免费/付费分层总开关。
 *
 * 判据是「是否曾经收到过付费来源的点数批次」，不看余额 ——
 * 按余额判会让用户把买来的点数用完那一刻掉回免费档，已有产物突然全部长出水印。
 *
 * 关掉后所有人按**付费**档处理：不区分时走更宽松的那一档，
 * 否则一个开关就能让全站产物全部带上水印。
 */
export function getUserTierEnabled() {
  return request.get<boolean>('/api/v1/admin/settings/user-tier');
}

export function setUserTierEnabled(enabled: boolean) {
  return request.put<boolean>('/api/v1/admin/settings/user-tier', undefined, {
    params: { enabled },
  });
}

/** 系统级存储（数据库配置 B，双桶 + STS）。覆盖系统文件配置 A，被用户级配置 C 覆盖。 */
export function getSystemStorageConfig() {
  return request.get<SystemStorageConfig>('/api/v1/admin/settings/storage');
}

export function saveSystemStorageConfig(data: SystemStorageConfig) {
  return request.put('/api/v1/admin/settings/storage', data);
}

export function testSystemStorageConnection(data: SystemStorageConfig) {
  return request.post('/api/v1/admin/settings/storage/test', data);
}

export function testUnionConnection(data: UnionConfig) {
  return request.post('/api/v1/admin/settings/union/test', data);
}

export function deleteStorageConfig(id: number) {
  return request.delete<boolean>(`/api/v1/admin/storage-configs/delete/${id}`);
}

export function validateStorageConfig(_data: StorageConfig) {
  return Promise.resolve(true);
}
