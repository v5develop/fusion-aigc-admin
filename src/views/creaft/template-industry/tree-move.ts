import type { IndustryNode, IndustrySortItem } from '@/api/plaza-admin';

export type DropPosition = 'above' | 'below' | 'into';

export interface MoveResult {
  /** 不合法时给出原因（用于 tooltip / message） */
  error?: string;
  /** 只含 parentId 或 sortOrder 发生变化的节点，步长 10 */
  items?: IndustrySortItem[];
}

interface Slim {
  id: number;
  children: number[];
}

/**
 * 行业树拖拽落点 → PUT /industries/sort 的增量载荷。
 * 规则（DESIGN 6.1）：最多两级；有子级的一级不可降为二级；二级之下不能再挂子级。
 */
export function computeMove(
  roots: IndustryNode[],
  dragId: number,
  targetId: number,
  position: DropPosition,
): MoveResult {
  if (dragId === targetId) return {};
  const rootList: Slim[] = roots.map((r) => ({
    id: r.id,
    children: (r.children ?? []).map((c) => c.id),
  }));
  const before = new Map<number, { parentId: number | null; sortOrder: number }>();
  rootList.forEach((r, i) => {
    before.set(r.id, { parentId: null, sortOrder: roots[i].sortOrder });
    (roots[i].children ?? []).forEach((c) =>
      before.set(c.id, { parentId: r.id, sortOrder: c.sortOrder }),
    );
  });

  const dragIsRoot = rootList.some((r) => r.id === dragId);
  const dragHasKids = (rootList.find((r) => r.id === dragId)?.children.length ?? 0) > 0;
  const targetIsRoot = rootList.some((r) => r.id === targetId);

  if (position === 'into') {
    if (!targetIsRoot) return { error: '二级行业下不能再挂子级（最多两级）' };
    if (dragIsRoot && dragHasKids) return { error: '有子级的一级行业不可降为二级，请先移走其子级' };
  } else if (!targetIsRoot && dragHasKids) {
    return { error: '有子级的一级行业不可降为二级，请先移走其子级' };
  }

  // 摘下被拖节点
  const rIdx = rootList.findIndex((r) => r.id === dragId);
  if (rIdx >= 0) rootList.splice(rIdx, 1);
  else rootList.forEach((r) => (r.children = r.children.filter((c) => c !== dragId)));

  const dragSlim: Slim = { id: dragId, children: [] };
  if (position === 'into') {
    const parent = rootList.find((r) => r.id === targetId);
    if (!parent) return { error: '目标行业不存在' };
    parent.children.push(dragId);
  } else if (targetIsRoot) {
    const ti = rootList.findIndex((r) => r.id === targetId);
    // 保留被拖一级自身的子级（此时它没有子级才可能降级；仍为一级则带着子级）
    const orig = roots.find((r) => r.id === dragId);
    dragSlim.children = dragIsRoot ? (orig?.children ?? []).map((c) => c.id) : [];
    rootList.splice(ti + (position === 'below' ? 1 : 0), 0, dragSlim);
  } else {
    const parent = rootList.find((r) => r.children.includes(targetId));
    if (!parent) return { error: '目标行业不存在' };
    const ti = parent.children.indexOf(targetId);
    parent.children.splice(ti + (position === 'below' ? 1 : 0), 0, dragId);
  }

  const items: IndustrySortItem[] = [];
  const push = (id: number, parentId: number | null, idx: number) => {
    const sortOrder = (idx + 1) * 10;
    const old = before.get(id);
    if (!old || old.parentId !== parentId || old.sortOrder !== sortOrder)
      items.push({ id, parentId, sortOrder });
  };
  rootList.forEach((r, i) => {
    push(r.id, null, i);
    r.children.forEach((c, j) => push(c, r.id, j));
  });
  return { items };
}
