// 业务术语：编码 → 标准中文名。与后端 common/dict/BizTerms.java、docs/terminology.md 同步。
// 用户可见处显示中文名；如需动态可改从 GET /api/v1/admin/dict/terms 拉取覆盖。

export const STEP_KIND: Record<string, string> = {
  LOCAL: '本地步骤',
  AIGC: 'AIGC生成',
  VOLC: '火山方舟',
  GENERATION: '生成队列',
}
export const VERSION_STATUS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}
export const COST_TYPE: Record<string, string> = {
  BILLED: '计费',
  COST_ONLY: '仅记成本',
}
export const SETTLEMENT_TYPE: Record<string, string> = {
  ALL_OR_NOTHING: '整单结算',
  PER_CHILD: '逐子结算',
}
export const PROMPT_TYPE: Record<string, string> = {
  optimize: '优化模板',
  agent: 'Agent提示词',
}

function label(dict: Record<string, string>, code?: string): string {
  if (!code) return ''
  return dict[code] || code
}

export const stepKindLabel = (c?: string) => label(STEP_KIND, c)
export const versionStatusLabel = (c?: string) => label(VERSION_STATUS, c)
export const costTypeLabel = (c?: string) => label(COST_TYPE, c)
export const settlementTypeLabel = (c?: string) => label(SETTLEMENT_TYPE, c)
export const promptTypeLabel = (c?: string) => label(PROMPT_TYPE, c)
