import { request } from '@/utils/request'

/** 生成队列实时指标行 */
export interface GenerationQueueMetric {
  queueName: string
  queueLength: number
  concurrent: number
  maxConcurrent: number
  availableSlots: number
}

/** 获取图片/视频生成队列实时指标 */
export function getGenerationMetrics() {
  return request.get<GenerationQueueMetric[]>('/api/v1/admin/generation/metrics')
}
