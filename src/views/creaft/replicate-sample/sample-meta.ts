import type { SampleAnalysisStatus } from '@/api/replicate-admin';

export const analysisColor = (s: SampleAnalysisStatus): string =>
  ({
    none: 'default',
    queued: 'processing',
    running: 'processing',
    ready: 'green',
    failed: 'red',
  })[s] ?? 'default';

/** 裸 rid 或 mr://rid；空串视为合法（可选字段由调用方判必填），真正的合法性由后端校验 */
export function isRidLike(v: string): boolean {
  const s = v.trim().replace(/^mr:\/\//, '');
  if (!v.trim()) return true;
  return s.length > 0 && !/[\s/]/.test(s);
}

/** 解析 annotations 文本：空 → null；合法 JSON 对象 → 对象；其余 → undefined（不合法） */
export function parseAnnotations(text: string): Record<string, unknown> | null | undefined {
  const t = text.trim();
  if (!t) return null;
  try {
    const v: unknown = JSON.parse(t);
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
