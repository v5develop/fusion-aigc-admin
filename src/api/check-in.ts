import { request } from '@/utils/request'
import type { CheckInSettings } from '@/types/api'

/**
 * 每日签到规则。
 *
 * 签到直接决定送出去多少点数，属于资金侧配置——每次保存都会进审计日志。
 *
 * 读到的是「数据库优先 + yaml 兜底」之后的**实际生效值**，不是数据库里存了什么。
 * 所以页面上看到的就是用户真正会拿到的规则。
 */
export function getCheckInSettings() {
  return request.get<CheckInSettings>('/api/v1/admin/settings/check-in')
}

/**
 * 部分更新：**没传的字段沿用当前值**。
 * 只想关一下开关就只传 enabled，不要把整个对象回传 —— 后端虽然支持整体提交，
 * 但那样一次失手就会把奖励梯度一起改掉。
 */
export function saveCheckInSettings(data: CheckInSettings) {
  return request.put<boolean>('/api/v1/admin/settings/check-in', data)
}
