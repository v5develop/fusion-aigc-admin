import type { UserLevelAssignment, UserLevelRule, UserLevelSettings } from '@/types/api';

import { request } from '@/utils/request';

/**
 * 经验等级 LV0..LVn。
 *
 * 口径见后端 docs/WATERMARK_AND_USER_TIER.md：等级由「累计充值额 / 付费月数 /
 * 最高单笔充值额」加权打分得出，**只驱动生成排队优先级**，不参与水印这类权利边界。
 * 权利边界看的是免费/付费分层（设置页的「用户分层」开关），两者不要混。
 *
 * 金额一律按「主单位」计，命名与阈值刻意不带币种 —— 将来上国外市场只换币种与汇率归一。
 */
export function getUserLevelRules() {
  return request.get<UserLevelRule[]>('/api/v1/admin/user-levels');
}

export function createUserLevelRule(data: UserLevelRule) {
  return request.post<number>('/api/v1/admin/user-levels', data);
}

export function updateUserLevelRule(id: number, data: UserLevelRule) {
  return request.put<boolean>(`/api/v1/admin/user-levels/${id}`, data);
}

/** 最低档（minScore=0）是兜底档位，后端会拒绝删除。 */
export function deleteUserLevelRule(id: number) {
  return request.delete<boolean>(`/api/v1/admin/user-levels/${id}`);
}

/**
 * 按用户指定等级。指定**覆盖**打分：被指定的人等级就是那一档，排队优先级与按等级计价的规则
 * （如 Prime-2 图片七折）都跟着它；到期或档位被停用后回落到打分等级。
 */
export function getUserLevelAssignments() {
  return request.get<UserLevelAssignment[]>('/api/v1/admin/user-levels/assignments');
}

/** 同一用户再次指定即覆盖；expireTime 留空表示长期有效。 */
export function assignUserLevel(
  userId: string,
  data: { levelCode: string; reason?: string | null; expireTime?: string | null },
) {
  return request.put<boolean>(`/api/v1/admin/user-levels/assignments/${userId}`, data);
}

export function unassignUserLevel(userId: string) {
  return request.delete<boolean>(`/api/v1/admin/user-levels/assignments/${userId}`);
}

export function getUserLevelSettings() {
  return request.get<UserLevelSettings>('/api/v1/admin/user-levels/settings');
}

/** weights 留空表示只改开关、不动系数。后端会校验它是合法 JSON 对象，写坏了当场拒绝。 */
export function saveUserLevelSettings(data: UserLevelSettings) {
  return request.put<boolean>('/api/v1/admin/user-levels/settings', data);
}
