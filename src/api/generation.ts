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

/** Pipeline 监控指标（交付 B 多步成片任务） */
export interface PipelineMetric {
  inflightCount: number
  avgStepDurationMs: number
  inflightWithProgress: number
  typeDistribution: string
}

/** 获取 Pipeline 监控指标 */
export function getPipelineMetrics() {
  return request.get<PipelineMetric>('/api/v1/admin/generation/metrics/pipeline')
}

/** 步骤耗时分布（P50/P90/P99） */
export interface StepDurationDistribution {
  stepCode: string
  p50: number
  p90: number
  p99: number
  count: number
}

/** 获取 Pipeline 步骤耗时分布 */
export function getPipelineStepDuration(hours = 24) {
  return request.get<StepDurationDistribution[]>('/api/v1/admin/generation/metrics/pipeline/step-duration', {
    params: { hours },
  })
}

/** 告警历史记录 */
export interface PipelineAlertHistory {
  id: number
  alertType: string
  alertLevel: string
  message: string
  currentValue: number
  threshold: number
  extraData?: string
  alertTime: string
}

/** 获取 Pipeline 告警历史 */
export function getPipelineAlertHistory(hours = 24, limit = 100, alertType?: string) {
  return request.get<PipelineAlertHistory[]>('/api/v1/admin/generation/metrics/pipeline/alert-history', {
    params: { hours, limit, alertType },
  })
}

/** 慢步骤趋势数据点 */
export interface SlowStepTrend {
  timeBucket: string
  slowCount: number
}

/** 获取慢步骤趋势分析 */
export function getSlowStepTrend(hours = 24, thresholdMs = 60000, bucketMinutes = 60) {
  return request.get<SlowStepTrend[]>('/api/v1/admin/generation/metrics/pipeline/slow-step-trend', {
    params: { hours, thresholdMs, bucketMinutes },
  })
}

/** 步骤耗时趋势数据点 */
export interface StepDurationTrend {
  timeBucket: string
  stepCode: string
  avgDurationMs: number
  count: number
}

/** 获取步骤耗时趋势分析 */
export function getStepDurationTrend(hours = 24, bucketMinutes = 60) {
  return request.get<StepDurationTrend[]>('/api/v1/admin/generation/metrics/pipeline/duration-trend', {
    params: { hours, bucketMinutes },
  })
}
