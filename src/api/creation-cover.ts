import type { PageResult } from '@/types/api';

import { request } from '@/utils/request';

/**
 * 视频封面待人工处理：工作流内自动抽帧多次失败的已完成任务。
 * 失败原因是原文（ffmpeg 等的报错），仅供排查，不直接展示给用户端。
 */
export interface CoverPendingRow {
  taskId: string;
  /** 2 成功 / 5 部分成功 */
  status: number;
  /** 成片地址（可直接预览） */
  resultUrl: string | null;
  /** 最近一次抽帧的失败原因 */
  coverError: string | null;
  /** 是否还留着源视频（没有就无法重新抽帧） */
  hasSourceVideo: boolean;
  createTime: string;
  updateTime: string;
}

export function getCoverPending(params: { page: number; pageSize: number }) {
  return request.get<PageResult<CoverPendingRow>>('/api/v1/admin/creation/cover-pending', {
    params,
  });
}

/** 用源视频重新抽帧并发布封面；仍失败时接口报错，原因由拦截器提示。 */
export function regenerateCover(taskId: string) {
  return request.post<string>(`/api/v1/admin/creation/cover-pending/${taskId}/regenerate`);
}
