import { request } from '@/utils/request'
import type { AdminPointsPackage, PointsPackage } from '@/types/api'

/**
 * 点数包（充值套餐）目录。
 *
 * 这张表是**下单金额的唯一出处**：C 端下单只传 packageId，金额与赠送点数一律以这里的行为准，
 * 客户端传的 amount/points 根本不读。所以在这里改价 = 改真实售价，不是改一个展示值。
 *
 * 金额单位是**最小货币单位（分）**，与订单 amount 同口径。页面上要按元展示就除以 100，
 * 提交时乘回去——不要在接口层做换算，两处口径不一致是支付对账里最常见的一类差异。
 */
/** 含已停用档位，每行带 rateConsistent —— false 表示汇率改过而这个档位没跟着改。 */
export function getPointsPackages() {
  return request.get<AdminPointsPackage[]>('/api/v1/admin/points-packages')
}

/**
 * 两条服务端硬校验，提交前先在表单上拦掉，别让运营填完一屏才被拒：
 * 1. 售价必须 > 0 —— 0 元订单会被支付网关拒，下得了单却永远付不掉；
 * 2. 基础点数必须等于「售价 × 汇率」，加送一律填到赠送点数。
 */
export function createPointsPackage(data: PointsPackage) {
  return request.post<number>('/api/v1/admin/points-packages', data)
}

/**
 * 修改是**整体替换**：没传的字段会被写成 null（角标、备注因此可以清空）。
 * 编辑前先把当前值填进表单，只提交改动的那几个字段会把其余字段清掉。
 */
export function updatePointsPackage(id: number, data: PointsPackage) {
  return request.put<boolean>(`/api/v1/admin/points-packages/${id}`, data)
}

/** 停用后 C 端立即不可见，且拿着旧页面来下单的请求会被拒，不会按旧价成交。 */
export function togglePointsPackage(id: number, enabled: boolean) {
  return request.put<boolean>(`/api/v1/admin/points-packages/${id}/enabled`, null, {
    params: { enabled },
  })
}

/** 逻辑删除。历史订单仍保留 package_id 指向它，仅作出处追溯，不影响订单金额。 */
export function deletePointsPackage(id: number) {
  return request.delete<boolean>(`/api/v1/admin/points-packages/${id}`)
}
