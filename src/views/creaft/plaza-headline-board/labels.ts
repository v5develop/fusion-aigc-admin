import type { HeadlineSource } from '@/api/plaza-admin';

/** 条目来源的展示（Go 只有 AUTO / MANUAL / FILL） */
export const SOURCE_META: Record<HeadlineSource, { label: string; color: string }> = {
  AUTO: { label: '算法', color: 'blue' },
  MANUAL: { label: '人工', color: 'purple' },
  FILL: { label: '补位', color: 'default' },
};

export const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED: '定时',
  OPS: '运营写操作',
  REFRESH_NOW: '立即刷新',
  STARTUP: '启动',
};
export const triggerLabel = (t: string) => TRIGGER_LABEL[t] ?? t;

export const fmtTime = (s: string) => s.replace('T', ' ');
