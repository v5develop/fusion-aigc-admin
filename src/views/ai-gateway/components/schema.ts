/**
 * JSON Schema（2020-12 子集）→ 表单的纯函数工具，不碰 Vue。
 *
 * 目的只有一个：网关加一个配置字段，前端不改代码就能填。所以这里不认识任何具体字段名，
 * 只认 schema 的结构；认不出的形状一律退回 JSON 编辑框，而不是丢掉。
 */

import { fieldLabel, formText } from './gatewayI18n';

export type Schema = Record<string, unknown>;

export type FieldKind =
  | 'adapter-params'
  | 'enum'
  | 'boolean'
  | 'integer'
  | 'number'
  | 'string'
  | 'text'
  | 'string-list'
  | 'enum-list'
  | 'object-list'
  | 'object'
  | 'map'
  | 'const'
  | 'json';

export const ADAPTER_PARAMS_FLAG = 'x-aig-adapter-params';

function isObj(v: unknown): v is Schema {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 按 `#/$defs/X`、`#/definitions/X` 解析引用；解析不了原样返回 */
export function resolveRef(schema: Schema, root: Schema, depth = 0): Schema {
  const ref = schema.$ref;
  if (typeof ref !== 'string' || depth > 16) return schema;
  const m = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
  if (!m) return schema;
  const bag = root[m[1]];
  const target = isObj(bag) ? bag[decodeURIComponent(m[2])] : undefined;
  if (!isObj(target)) return schema;
  const { $ref: _ignored, ...rest } = schema;
  return resolveRef({ ...target, ...rest }, root, depth + 1);
}

export interface Normalized {
  schema: Schema;
  nullable: boolean;
}

/**
 * 展开 $ref、剥掉 anyOf/oneOf 里的 null 分支、合并单元素 allOf，
 * 把 `type: ["string","null"]` 也归成 nullable。
 */
export function normalize(input: Schema | undefined, root: Schema): Normalized {
  let schema: Schema = resolveRef(isObj(input) ? input : {}, root);
  let nullable = false;

  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      const resolved = branches.filter(isObj).map((b) => resolveRef(b, root));
      const nonNull = resolved.filter((b) => b.type !== 'null');
      if (nonNull.length < resolved.length) nullable = true;
      if (nonNull.length === 1) {
        const { [key]: _drop, ...outer } = schema;
        const inner = normalize(nonNull[0], root);
        nullable = nullable || inner.nullable;
        schema = { ...inner.schema, ...outer };
      }
    }
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf) && allOf.length === 1 && isObj(allOf[0])) {
    const { allOf: _drop, ...outer } = schema;
    schema = { ...normalize(allOf[0], root).schema, ...outer };
  }

  if (Array.isArray(schema.type)) {
    const types = (schema.type as unknown[]).filter((t) => t !== 'null');
    if (types.length < (schema.type as unknown[]).length) nullable = true;
    schema = { ...schema, type: types.length === 1 ? types[0] : types };
  }
  return { schema, nullable };
}

function isScalarType(t: unknown) {
  return t === 'string' || t === 'integer' || t === 'number' || t === 'boolean';
}

export function fieldKind(schema: Schema, root: Schema): FieldKind {
  if (schema[ADAPTER_PARAMS_FLAG] === true) return 'adapter-params';
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) return 'json';
  if ('const' in schema) return 'const';
  if (Array.isArray(schema.enum)) return 'enum';
  const t = schema.type;
  if (t === 'boolean') return 'boolean';
  if (t === 'integer') return 'integer';
  if (t === 'number') return 'number';
  if (t === 'string') {
    const max = typeof schema.maxLength === 'number' ? schema.maxLength : 0;
    return max >= 1024 ? 'text' : 'string';
  }
  if (t === 'array') {
    const items = isObj(schema.items) ? normalize(schema.items, root).schema : {};
    if (Array.isArray(items.enum)) return 'enum-list';
    if (items.type === 'string') return 'string-list';
    if (items.type === 'object' || isObj(items.properties)) return 'object-list';
    return 'json';
  }
  if (t === 'object' || isObj(schema.properties) || 'additionalProperties' in schema) {
    if (isObj(schema.properties) && Object.keys(schema.properties).length) return 'object';
    const ap = schema.additionalProperties;
    if (isObj(ap)) {
      const apn = normalize(ap, root).schema;
      if (isScalarType(apn.type) && !Array.isArray(apn.enum)) return 'map';
    }
    return 'json';
  }
  return 'json';
}

/** 字段标签：词典 → schema title → 字段名 */
export function titleOf(schema: Schema, key: string) {
  return fieldLabel(key, schema.title);
}

export function propertiesOf(schema: Schema): [string, Schema][] {
  const props = schema.properties;
  if (!isObj(props)) return [];
  return Object.entries(props).filter((e): e is [string, Schema] => isObj(e[1]));
}

export function requiredOf(schema: Schema): string[] {
  return Array.isArray(schema.required) ? (schema.required as string[]) : [];
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** 新建时的初值：只放 schema 声明的 default 与必填对象骨架，不猜 */
export function buildDefault(input: Schema, root: Schema): unknown {
  const { schema } = normalize(input, root);
  if ('default' in schema) return clone(schema.default);
  const kind = fieldKind(schema, root);
  if (kind === 'object') {
    const out: Record<string, unknown> = {};
    const req = requiredOf(schema);
    for (const [k, s] of propertiesOf(schema)) {
      const v = buildDefault(s, root);
      if (v !== undefined) out[k] = v;
      else if (req.includes(k)) {
        const sk = fieldKind(normalize(s, root).schema, root);
        if (sk === 'object' || sk === 'map') out[k] = {};
        else if (sk.endsWith('-list')) out[k] = [];
      }
    }
    return out;
  }
  return undefined;
}

/**
 * 提交前清理：去掉 undefined 与可选的空串，保留 null（显式清空）。
 * 递归到对象与对象数组。
 */
export function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || v === '') continue;
      out[k] = prune(v);
    }
    return out;
  }
  return value;
}

export interface FieldError {
  path: string;
  message: string;
}

/** 轻量校验：必填、类型大类、枚举、范围、长度、正则。完整校验以网关 422 为准 */
export function validate(
  input: Schema,
  value: unknown,
  root: Schema,
  path = '',
  adapterParams?: Schema,
): FieldError[] {
  const { schema, nullable } = normalize(input, root);
  const errors: FieldError[] = [];
  const at = path || '/';
  if (value === undefined) return errors;
  if (value === null) {
    if (!nullable && schema.type !== 'null' && fieldKind(schema, root) !== 'json') {
      errors.push({ path: at, message: formText('notNull') });
    }
    return errors;
  }
  if (schema[ADAPTER_PARAMS_FLAG] === true) {
    return adapterParams ? validate(adapterParams, value, adapterParams, path) : errors;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push({ path: at, message: formText('enumOnly', { values: schema.enum.join(' / ') }) });
  }
  const t = schema.type;
  if ((t === 'integer' || t === 'number') && typeof value === 'number') {
    if (t === 'integer' && !Number.isInteger(value))
      errors.push({ path: at, message: formText('integerOnly') });
    if (typeof schema.minimum === 'number' && value < schema.minimum)
      errors.push({ path: at, message: formText('min', { min: schema.minimum }) });
    if (typeof schema.maximum === 'number' && value > schema.maximum)
      errors.push({ path: at, message: formText('max', { max: schema.maximum }) });
  }
  if (t === 'string' && typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength)
      errors.push({ path: at, message: formText('minLength', { n: schema.minLength }) });
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength)
      errors.push({ path: at, message: formText('maxLength', { n: schema.maxLength }) });
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value))
          errors.push({ path: at, message: formText('pattern', { pattern: schema.pattern }) });
      } catch {
        /* 前端不支持的正则方言交给网关判 */
      }
    }
  }
  if (t === 'array' && Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems)
      errors.push({ path: at, message: formText('minItems', { n: schema.minItems }) });
    if (isObj(schema.items)) {
      value.forEach((item, i) =>
        errors.push(...validate(schema.items as Schema, item, root, `${path}/${i}`)),
      );
    }
  }
  if (isObj(value) && isObj(schema.properties)) {
    const obj = value as Record<string, unknown>;
    for (const key of requiredOf(schema)) {
      if (obj[key] === undefined || obj[key] === '') {
        errors.push({ path: `${path}/${key}`, message: formText('required') });
      }
    }
    for (const [key, s] of propertiesOf(schema)) {
      if (key in obj) errors.push(...validate(s, obj[key], root, `${path}/${key}`, adapterParams));
    }
  }
  return errors;
}

/** 列表页取几列展示：code、名称、若干标量字段、enabled。纯按 schema 推，不写死字段 */
export function listColumnsOf(schema: Schema, root: Schema, max = 6): string[] {
  const cols: string[] = [];
  const props = propertiesOf(schema);
  const has = (k: string) => props.some(([p]) => p === k);
  if (has('code')) cols.push('code');
  if (has('display_name')) cols.push('display_name');
  for (const [key, s] of props) {
    if (cols.length >= max) break;
    if (cols.includes(key) || key === 'enabled' || key === 'notes' || key === 'description')
      continue;
    const kind = fieldKind(normalize(s, root).schema, root);
    if (['enum', 'string', 'integer', 'number', 'boolean', 'enum-list'].includes(kind)) {
      cols.push(key);
    }
  }
  if (has('enabled')) cols.push('enabled');
  return cols;
}

export function displayValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return '-';
  if (Array.isArray(v))
    return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
