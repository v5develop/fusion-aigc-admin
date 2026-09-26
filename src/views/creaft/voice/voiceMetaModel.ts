/**
 * 音色扩展信息（v1 voice.meta）与可视化表单之间的互转，纯函数、不碰 Vue。
 *
 * v1 的形状：{"demo": {语言: 试听地址}, "locales": [语言…]}。约定与另外两个编辑器相同：
 * 类型对得上的才由表单接管，对不上的原样带回；原来没有且没填的键不凭空长出来。
 */

let nextUid = 1;

export interface DemoRow {
  /** 只作 v-for 的 key：用下标时，上传途中删了前面的行，回来的地址会写进别的语言 */
  uid: number;
  locale: string;
  url: string;
}

export interface MetaModel {
  demos: DemoRow[];
  locales: string[];
  had: { demo: boolean; locales: boolean };
  extra: Record<string, unknown>;
}

export function demoRow(locale = '', url = ''): DemoRow {
  return { uid: nextUid++, locale, url };
}

export function toMeta(value: Record<string, unknown>): MetaModel {
  const { demo, locales, ...extra } = value;
  const model: MetaModel = { demos: [], locales: [], had: { demo: false, locales: false }, extra };
  if (demo && typeof demo === 'object' && !Array.isArray(demo)
      && Object.values(demo).every((url) => typeof url === 'string')) {
    model.demos = Object.entries(demo as Record<string, string>).map(([locale, url]) => demoRow(locale, url));
    model.had.demo = true;
  } else if (demo !== undefined) {
    extra.demo = demo;
  }
  if (Array.isArray(locales) && locales.every((l) => typeof l === 'string')) {
    model.locales = [...(locales as string[])];
    model.had.locales = true;
  } else if (locales !== undefined) {
    extra.locales = locales;
  }
  return model;
}

export function fromMeta(model: MetaModel): Record<string, unknown> {
  const out: Record<string, unknown> = { ...model.extra };
  const demo: Record<string, string> = {};
  for (const { locale, url } of model.demos) {
    if (locale.trim() && url.trim()) demo[locale.trim()] = url.trim();
  }
  if (!('demo' in out) && (model.had.demo || Object.keys(demo).length)) out.demo = demo;
  if (!('locales' in out) && (model.had.locales || model.locales.length)) out.locales = model.locales;
  return out;
}

export function validateMeta(model: MetaModel): string | null {
  const seen = new Set<string>();
  for (const [i, { locale, url }] of model.demos.entries()) {
    if (!locale.trim() || !url.trim()) return `试听第 ${i + 1} 条的语言和地址都要填`;
    if (!/^https:\/\//i.test(url.trim())) return `试听第 ${i + 1} 条的地址必须是 https 地址`;
    if (seen.has(locale.trim())) return `试听语言 ${locale} 重复了`;
    seen.add(locale.trim());
  }
  return null;
}
