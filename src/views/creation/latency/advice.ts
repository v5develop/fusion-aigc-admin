import type { LatencyGroupBy, LatencyGroupStat, LatencyStats } from '@/api/creation-latency';

/**
 * 调优建议：纯函数、确定性规则，只看 stats。文案走 i18n（latency.advice.<code>），params 供插值。
 * 阈值集中在 THRESHOLDS，便于以后调。
 */
export const THRESHOLDS = {
  vendor: 60,
  queue: 30,
  transfer: 20, // postprocess / input_transfer 各自
  gatewayQueue: 15,
  moderation: 15,
  settle: 10,
  tail: 5, // p99 / p50
} as const;

export type AdviceLevel = 'warning' | 'info' | 'success';

export interface Advice {
  code: string;
  level: AdviceLevel;
  params: Record<string, string | number>;
  /** 命中的类别，用于着色 */
  category?: string;
}

function share(stats: LatencyStats, category: string): number {
  return stats.categories.find((c) => c.category === category)?.sharePct ?? 0;
}

/** 按某类别 P90 找最慢的分组（样本太少的分组不参与，避免偶发值误导） */
export function slowestGroup(
  groups: readonly LatencyGroupStat[],
  category: string,
  minSamples = 3,
): LatencyGroupStat | null {
  let best: LatencyGroupStat | null = null;
  for (const g of groups) {
    if (g.sampleCount < minSamples) continue;
    const v = g.categories?.[category]?.p90 ?? 0;
    if (v > (best?.categories?.[category]?.p90 ?? 0)) best = g;
  }
  return best;
}

/** 当前 groupBy 能否指名「哪个厂商 / 部署」 */
export function groupNamesTarget(by: LatencyGroupBy | undefined): boolean {
  return by === 'provider' || by === 'deployment' || by === 'model';
}

export function buildAdvice(
  stats: LatencyStats | null | undefined,
  groupBy: LatencyGroupBy | undefined,
  groupLabel: (g: LatencyGroupStat) => string,
  fmt: (ms: number) => string,
): Advice[] {
  if (!stats || !stats.sampleCount) return [];
  const out: Advice[] = [];
  const pct = (n: number) => n.toFixed(1);

  const vendor = share(stats, 'vendor');
  if (vendor > THRESHOLDS.vendor) {
    const g = groupNamesTarget(groupBy) ? slowestGroup(stats.groups, 'vendor') : null;
    out.push({
      code: g ? 'vendorNamed' : 'vendor',
      level: 'warning',
      category: 'vendor',
      params: {
        share: pct(vendor),
        target: g ? groupLabel(g) : '',
        p90: g ? fmt(g.categories.vendor?.p90 ?? 0) : '',
      },
    });
  }
  const queue = share(stats, 'queue');
  if (queue > THRESHOLDS.queue)
    out.push({ code: 'queue', level: 'warning', category: 'queue', params: { share: pct(queue) } });

  for (const cat of ['postprocess', 'input_transfer'] as const) {
    const v = share(stats, cat);
    if (v > THRESHOLDS.transfer)
      out.push({
        code: 'transfer',
        level: 'warning',
        category: cat,
        params: { share: pct(v), category: cat },
      });
  }
  const gq = share(stats, 'gateway_queue');
  if (gq > THRESHOLDS.gatewayQueue)
    out.push({
      code: 'gatewayQueue',
      level: 'warning',
      category: 'gateway_queue',
      params: { share: pct(gq) },
    });
  const mod = share(stats, 'moderation');
  if (mod > THRESHOLDS.moderation)
    out.push({
      code: 'moderation',
      level: 'info',
      category: 'moderation',
      params: { share: pct(mod) },
    });
  const settle = share(stats, 'settle');
  if (settle > THRESHOLDS.settle)
    out.push({ code: 'settle', level: 'info', category: 'settle', params: { share: pct(settle) } });

  if (stats.total.p50 > 0 && stats.total.p99 / stats.total.p50 > THRESHOLDS.tail)
    out.push({
      code: 'tail',
      level: 'info',
      params: {
        ratio: (stats.total.p99 / stats.total.p50).toFixed(1),
        p50: fmt(stats.total.p50),
        p99: fmt(stats.total.p99),
      },
    });

  if (stats.truncated) out.push({ code: 'truncated', level: 'info', params: {} });
  if (!out.some((a) => a.level === 'warning'))
    out.unshift({ code: 'balanced', level: 'success', params: {} });
  return out;
}
