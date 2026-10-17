import dayjs from 'dayjs';

/** 后端时间统一为 unix 毫秒；空值显示为 - */
export function formatTime(ms?: number | null): string {
  if (!ms) return '-';
  return dayjs(ms).format('YYYY-MM-DD HH:mm:ss');
}
