import { request } from '@/utils/request'

/**
 * 存量数据回填（一次性运维接口）。
 *
 * 两条线共用一套形状：`GET /remaining` 看还欠多少，`POST /backfill` 清一批。
 * 两个接口都是幂等的——补好的行不会再被选中，所以反复点没有副作用。
 */

/** 回填方向。后端对拼错的值兜底成 both（运维接口不该因为大小写报 400），前端仍只给这三个 */
export type EntryCodeScope = 'task' | 'asset' | 'both'
export type VideoCoverScope = 'asset' | 'task' | 'both'

// ---------------- 创作入口码 ----------------

/**
 * 入口码欠账报表。
 *
 * 注意 tasks/assets 是「待补条数」而不是「还能补多少」：四个来源全空的老任务推导不出来，
 * 会永远留在这个数里，清到不再下降就可以停。
 */
export interface EntryCodeRemaining {
  /** 还有多少条创作任务 entry_code 为空 */
  tasks: number
  /** 还有多少条素材 entry_code 为空 */
  assets: number
  /**
   * entry_code **有值**、但那个值不是任何启用中的 offer 的任务数。
   *
   * 这批行已经填上了，所以**不计入** tasks，但下游全是静默降级：做同款查不到 offer、
   * 素材库聚合分类进不去任何 tab、后台内容列表按 entry_code 等值也筛不到，全程不报错。
   * 补的是**计费 offer 配置**，不是再跑一次回填。
   */
  unregisteredTasks: number
  /** 上面那批按入口码分组（码 → 条数），用来直接定位是哪个 offer 配置缺了 */
  unregisteredByCode: Record<string, number>
}

/**
 * @param scanned 本批扫了多少行
 * @param filled  真正补上的行数
 * @param stuck   推导不出、留空的行数；它不会降到 0，见 EntryCodeRemaining 注释
 */
export interface EntryCodeResult {
  scanned: number
  filled: number
  stuck: number
}

export interface EntryCodeReport {
  tasks: EntryCodeResult
  assets: EntryCodeResult
}

export interface EntryCodeBackfillParams {
  scope: EntryCodeScope
  limit: number
  /** 跳过队头那批永远补不上的死数据；接口每次都从头扫，不推游标就会原地打转 */
  offset: number
  /** 只统计不写库。后端在 dryRun 下不抢分布式锁，可以和别人的回填并行看影响面 */
  dryRun: boolean
}

/**
 * 回填一批可能扫几百上千行，远超 axios 默认的 15s 超时。
 * 超时只是浏览器侧放弃等待，后端仍在跑并占着 Redis 锁——此时重试只会撞「正在执行」，
 * 所以宁可把等待放宽到分钟级，让调用方拿到真实结果。
 */
const BACKFILL_TIMEOUT = 180_000

export function getEntryCodeRemaining() {
  return request.get<EntryCodeRemaining>('/api/v1/admin/creation/entry-code/remaining')
}

export function backfillEntryCode(params: EntryCodeBackfillParams) {
  // 参数走 query string（后端是 @RequestParam），body 留空
  return request.post<EntryCodeReport>('/api/v1/admin/creation/entry-code/backfill', undefined, {
    params,
    timeout: BACKFILL_TIMEOUT,
  })
}

// ---------------- 视频封面 ----------------

/** 两侧各还剩多少条待补；同样是「待补条数」，ffmpeg 抽不出帧的那批会一直留着 */
export interface VideoCoverRemaining {
  assets: number
  tasks: number
}

/**
 * @param scanned    本次捞出的候选数
 * @param generated  成功抽帧并写回的条数
 * @param failed     抽帧失败的条数（对象已删、格式不认、ffmpeg 未安装等）
 * @param crossFixed 顺带修好的**另一侧**行数（asset 方向指任务，task 方向指素材）
 */
export interface VideoCoverResult {
  scanned: number
  generated: number
  failed: number
  crossFixed: number
}

export interface VideoCoverReport {
  assets: VideoCoverResult
  tasks: VideoCoverResult
}

/** 没有 dryRun：抽帧是下载 + ffmpeg 的重操作，试跑一遍的代价和真跑一样 */
export interface VideoCoverBackfillParams {
  scope: VideoCoverScope
  limit: number
  offset: number
}

export function getVideoCoverRemaining() {
  return request.get<VideoCoverRemaining>('/api/v1/admin/creation/video-cover/remaining')
}

export function backfillVideoCover(params: VideoCoverBackfillParams) {
  return request.post<VideoCoverReport>('/api/v1/admin/creation/video-cover/backfill', undefined, {
    params,
    timeout: BACKFILL_TIMEOUT,
  })
}
