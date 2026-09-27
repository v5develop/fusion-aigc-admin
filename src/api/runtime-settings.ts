import { request } from '@/utils/request';

/**
 * 运行参数：后端登记在册的少量运行时可调参数（模型组、模型编码、开关、数值……）。
 * 取值口径「数据库 > 配置文件」：DB 有值即生效，所有实例数秒内同步；删掉 DB 值即回退配置文件。
 * label / description / group 由后端给中文，前端原样展示。
 */
export type RuntimeSettingType = 'MODEL_GROUP' | 'MODEL_CODE' | 'BOOLEAN' | 'INT' | 'STRING';

export type RuntimeSettingSource = 'DB' | 'FILE';

export interface RuntimeSetting {
  key: string;
  label: string;
  description: string;
  group: string;
  type: RuntimeSettingType;
  /** 当前实际生效值（DB 优先，否则配置文件） */
  effectiveValue: string | null;
  source: RuntimeSettingSource;
  /** 配置文件里的默认值 */
  fileValue: string | null;
  dbValue: string | null;
  updatedAt: string | null;
}

const BASE = '/api/v1/admin/system/runtime-settings';

export function listRuntimeSettings() {
  return request.get<RuntimeSetting[]>(BASE);
}

/**
 * 保存覆盖值；传空串等同于恢复配置文件默认。
 * 校验不过（模型组未就绪、模型不存在……）走业务错误，由请求拦截器弹出后端的中文原因。
 */
export function updateRuntimeSetting(key: string, value: string) {
  return request.put<RuntimeSetting>(`${BASE}/${encodeURIComponent(key)}`, { value });
}

/** 删除 DB 覆盖值，回退配置文件默认 */
export function resetRuntimeSetting(key: string) {
  return request.delete<RuntimeSetting>(`${BASE}/${encodeURIComponent(key)}`);
}
