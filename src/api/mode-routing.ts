import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * 按 mode 改走数据驱动定义：逐 mode 开关 + 已发布版本的转换/校验结果。
 * 基路径 `/api/v1/admin/mode-routing/{modeCode}`，modeCode = Mode 流编码（afv_mode_flow.code）。
 * 应答为 CommonResult，拦截器已解包。
 */
const BASE = '/api/v1/admin/mode-routing';

function cfg(extra?: Record<string, unknown>): AxiosRequestConfig {
  return { noErrorRedirect: true, ...extra } as AxiosRequestConfig;
}

/** 写开关改变线上提交走哪条路径，不自动重传 */
function writeCfg(extra?: Record<string, unknown>): AxiosRequestConfig {
  return cfg({ noRetry: true, ...extra });
}

/** 对应后端 ModeRoutingAdminService.RoutingStatus */
export interface ModeRoutingStatus {
  modeCode: string;
  /** 该 mode 的逐 mode 开关 */
  switchOn: boolean;
  /** 总开关；关闭时逐 mode 开关不生效 */
  globalOn: boolean;
  /** 后端按固定规则推出的定义编码，前端只显示不自拼 */
  definitionCode: string;
  /** 参与转换的已发布版本号；无已发布版本为 null */
  versionNo?: number | null;
  /** 转换成功且定义校验通过 */
  convertible: boolean;
  /** 转换失败原因（流不存在/未启用/无已发布版本/转换异常） */
  convertError?: string | null;
  /** 定义校验错误 */
  validationErrors?: string[];
}

function path(modeCode: string) {
  return `${BASE}/${encodeURIComponent(modeCode)}`;
}

/** 列表页逐行调用，失败只在该格显示「-」，不逐条弹错 */
export function getModeRouting(modeCode: string) {
  return request.get<ModeRoutingStatus>(path(modeCode), cfg({ silentError: true }));
}

/** 对应后端 ModeRoutingAdminService.ConvertPreview：干跑结果另带转换出的定义 */
export interface ModeRoutingConvertPreview extends ModeRoutingStatus {
  /** 转换出的定义 JSON，仅供只读预览（不落库）；转换失败为 null */
  definitionJson: string | null;
}

/** 干跑：转换已发布版本并校验，不落库 */
export function convertModeRouting(modeCode: string) {
  return request.post<ModeRoutingConvertPreview>(`${path(modeCode)}/convert`, undefined, cfg());
}

/** 写逐 mode 开关；开启时后端要求可转换且校验通过，否则拒绝并给出原因 */
export function setModeRouting(modeCode: string, enabled: boolean) {
  return request.put<ModeRoutingStatus>(path(modeCode), { enabled }, writeCfg());
}

/** 不可转换的原因列表：转换错误优先，其次校验错误 */
export function modeRoutingErrors(s: ModeRoutingStatus): string[] {
  const list: string[] = [];
  if (s.convertError) list.push(s.convertError);
  if (Array.isArray(s.validationErrors)) list.push(...s.validationErrors);
  return list;
}

/** 定义表与 Mode 流的同步状态；definitionId 为空 = 尚未导入为定义 */
export interface ModeRoutingDrift {
  inSync: boolean;
  definitionId?: number | string | null;
  definitionVersion?: number | null;
}

/** 列表页逐行调用；接口未上线时 404（用 isEndpointMissing 判断），不逐条弹错 */
export function getModeRoutingDrift(modeCode: string) {
  return request.get<ModeRoutingDrift>(
    `${path(modeCode)}/drift`,
    cfg({ silentError: true, noRetry: true }),
  );
}

export interface ModeRoutingImportResult {
  definitionId: number | string;
  code: string;
  version: number;
}

/** 把 Mode 流导入为工作流定义：不存在则创建，已存在则发布新版本 */
export function importModeDefinition(modeCode: string) {
  return request.post<ModeRoutingImportResult>(
    `${path(modeCode)}/import-definition`,
    undefined,
    writeCfg(),
  );
}
