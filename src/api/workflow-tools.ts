import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * 工作流工具总览：已发布工作流定义用到的模型组，及其在 AI 网关的就绪状态。
 * 基路径 `/api/v1/admin/workflow-tools`，应答为 CommonResult，拦截器已解包。
 * prices 为网关运营维护的标价（原币种、不换算）；后端未下发时归一为 []。
 */
const BASE = '/api/v1/admin/workflow-tools';

function cfg(extra?: Record<string, unknown>): AxiosRequestConfig {
  return { noErrorRedirect: true, ...extra } as AxiosRequestConfig;
}

export interface WorkflowToolUsage {
  definitionId: number;
  definitionCode: string;
  version: number;
}

export interface WorkflowToolPriceComponent {
  unit: string;
  price: number;
  resolution: string | null;
  /** 档位上限（同 unit 计量）；null/缺省表示无上限 */
  upTo?: number | null;
}

export interface WorkflowToolPrice {
  deploymentCode: string;
  /** null 表示该部署未配置价格模型（reason 为 no_price_model） */
  priceModelCode: string | null;
  currency: string | null;
  components: WorkflowToolPriceComponent[];
  reason: string | null;
}

export interface WorkflowToolRow {
  modelGroup: string;
  operation: string;
  /** true 就绪；false 未就绪（见 reason）；null 网关不可达，无法判断 */
  ready: boolean | null;
  reason: string | null;
  usedBy: WorkflowToolUsage[];
  /** 后端未上线该字段时缺省，listWorkflowTools 归一为 [] */
  prices: WorkflowToolPrice[];
  /** 价格来源：published=网关已发布快照（正在生效）；draft=网关草稿（旧网关或未发布时的回退）；null=无价格 */
  priceSource?: 'published' | 'draft' | null;
  /** 价格来源为 published 时的网关配置版本号 */
  configVersion?: number | null;
  /** 模型组支持的全部操作（scope=all 起下发；旧后端缺省） */
  operations?: string[];
  /** 模型组显示名（scope=all 起下发；旧后端缺省） */
  displayName?: string | null;
}

/**
 * 后端未上线时 404（用 isEndpointMissing 判断），调用方静默隐藏，故不弹全局错误。
 * scope=all：返回网关全部模型组（含未被定义引用的）；旧后端忽略该参数，只返回已引用的，
 * 调用方对查不到的组按「就绪/价格未知」处理。
 */
export function listWorkflowTools(scope: 'used' | 'all' = 'used') {
  return request
    .get<unknown>(
      BASE,
      cfg({ silentError: true, noRetry: true, params: scope === 'all' ? { scope } : undefined }),
    )
    .then((res) =>
      (Array.isArray(res) ? (res as WorkflowToolRow[]) : [])
        .filter((r) => r && typeof r.modelGroup === 'string')
        .map((r) => ({
          ...r,
          usedBy: Array.isArray(r.usedBy) ? r.usedBy : [],
          priceSource: r.priceSource === 'published' || r.priceSource === 'draft' ? r.priceSource : null,
          configVersion: typeof r.configVersion === 'number' ? r.configVersion : null,
          operations: Array.isArray(r.operations)
            ? r.operations.filter((op): op is string => typeof op === 'string')
            : undefined,
          displayName: typeof r.displayName === 'string' ? r.displayName : null,
          prices: (Array.isArray(r.prices) ? r.prices : []).map((p) => ({
            ...p,
            components: (Array.isArray(p?.components) ? p.components : []).map((c) => ({
              ...c,
              upTo: typeof c?.upTo === 'number' ? c.upTo : null,
            })),
          })),
        })),
    );
}
