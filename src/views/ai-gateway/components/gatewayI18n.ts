/**
 * 网关字段名 / 枚举值 / 发布判据的显示文案。
 *
 * 查找顺序：词典（`aiGateway.fieldLabel|fieldHelp|enum|checkCode`，按当前语言 `te()` 判存在）
 * → schema 自带的 title / description → 原始名。所以网关新加的字段或枚举值不改前端也能显示
 * （退回英文或原值）；词典只负责把已知的换成运营看得懂的话。
 */
import i18n from '@/locales';

type Params = Record<string, unknown>;

function tr(key: string, params?: Params): string | undefined {
  const g = i18n.global;
  if (!g.te(key, g.locale.value)) return undefined;
  const t = g.t as unknown as (k: string, p?: Params) => string;
  return params ? t(key, params) : t(key);
}

/** 枚举键里不能有 "."（vue-i18n 会当路径拆），统一换成 "_" */
function enumKey(value: unknown) {
  return String(value).replace(/\./g, '_');
}

/** 字段标签：词典 → schema title → 字段名 */
export function fieldLabel(name: string, schemaTitle?: unknown): string {
  return (
    tr(`aiGateway.fieldLabel.${name}`) || (typeof schemaTitle === 'string' && schemaTitle) || name
  );
}

/** 字段说明：词典 → schema description → 无 */
export function fieldHelp(name: string, schemaDescription?: unknown): string | undefined {
  return (
    tr(`aiGateway.fieldHelp.${name}`) ||
    (typeof schemaDescription === 'string' && schemaDescription) ||
    undefined
  );
}

/** 枚举值译文；没有词条时返回 undefined */
export function enumText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return tr(`aiGateway.enum.${enumKey(value)}`);
}

/** 标签 / 单元格里显示：有译文显示译文，否则原值 */
export function enumShort(value: unknown): string {
  return enumText(value) ?? String(value ?? '');
}

/** 下拉选项里显示：`中文（raw）`，便于对照文档；没有词条时只显示原值 */
export function enumLabel(value: unknown): string {
  const text = enumText(value);
  const raw = String(value);
  return text && text !== raw ? `${text}（${raw}）` : raw;
}

/** 发布校验判据：`中文（check）`；没有词条时原样 */
export function checkLabel(check: string): string {
  const text = tr(`aiGateway.checkCode.${enumKey(check)}`);
  return text ? `${text}（${check}）` : check;
}

/** 表单 / 校验里的固定文案（走 fallbackLocale，缺词条时退回中文） */
export function formText(key: string, params?: Params): string {
  const t = i18n.global.t as unknown as (k: string, p?: Params) => string;
  return params ? t(`aiGateway.form.${key}`, params) : t(`aiGateway.form.${key}`);
}
