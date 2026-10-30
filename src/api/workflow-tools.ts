import type { AxiosRequestConfig } from 'axios';

import { request } from '@/utils/request';

/**
 * 工作流工具总览：已发布工作流定义用到的模型组，及其在 AI 网关的就绪状态。
 * 基路径 `/api/v1/admin/workflow-tools`，应答为 CommonResult，拦截器已解包。
 * 网关不提供价格，这里也没有价格字段。
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

export interface WorkflowToolRow {
  modelGroup: string;
  operation: string;
  /** true 就绪；false 未就绪（见 reason）；null 网关不可达，无法判断 */
  ready: boolean | null;
  reason: string | null;
  usedBy: WorkflowToolUsage[];
}

/** 后端未上线时 404（用 isEndpointMissing 判断），调用方静默隐藏，故不弹全局错误 */
export function listWorkflowTools() {
  return request
    .get<unknown>(BASE, cfg({ silentError: true, noRetry: true }))
    .then((res) =>
      (Array.isArray(res) ? (res as WorkflowToolRow[]) : [])
        .filter((r) => r && typeof r.modelGroup === 'string')
        .map((r) => ({ ...r, usedBy: Array.isArray(r.usedBy) ? r.usedBy : [] })),
    );
}
