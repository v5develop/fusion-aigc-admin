import { request } from '@/utils/request'

/** 生成队列实时指标行（Redis 队列：原生图片/视频生成） */
export interface GenerationQueueMetric {
  queueName: string
  queueLength: number
  concurrent: number
  maxConcurrent: number
  availableSlots: number
}

/** 外发型创作任务在途指标行（电商/创作类：外发 AIGC/Ark + 回调/轮询） */
export interface CreationTaskMetric {
  type: string
  queued: number
  processing: number
  inflight: number
  recentFailed: number
}

/** 生成监控统一视图（Redis 队列 + 外发创作任务两段） */
export interface GenerationMetricsOverview {
  redisQueues: GenerationQueueMetric[]
  creationTasks: CreationTaskMetric[]
}

/** 获取图片/视频生成队列实时指标（仅 Redis 队列段，向后兼容旧端点） */
export function getGenerationMetrics() {
  return request.get<GenerationQueueMetric[]>('/api/v1/admin/generation/metrics')
}

/**
 * 获取生成监控统一视图：Redis 队列 + 外发创作任务在途。
 * @param failedWindowMinutes 失败计数回看窗口（分钟），默认 60
 */
export function getGenerationMetricsOverview(failedWindowMinutes = 60) {
  return request.get<GenerationMetricsOverview>('/api/v1/admin/generation/metrics/overview', {
    params: { failedWindowMinutes },
  })
}
