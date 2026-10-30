/**
 * 工作流模板载荷（v1 workflow.payload）与可视化表单之间的互转，纯函数、不碰 Vue。
 *
 * v1 的形状：{"result": [示例地址], "payload": {"prompt", "image_urls": [槽位], "video_urls": [槽位]}}。
 * 约定与技能配置编辑器相同：类型对得上的才由表单接管，对不上的原样带回；原来没有且没填的键不凭空长出来。
 */

/** 列表行的内部编号：只作 v-for 的 key，不写进载荷。用下标作 key 时，上传途中删 / 挪了前面的行，
 * 同一个上传组件会被复用到另一行上，回来的地址就写错了行。 */
let nextUid = 1;
export function uid() {
  return nextUid++;
}

export interface ResultModel {
  uid: number;
  url: string;
}

export interface SlotModel {
  uid: number;
  title: string;
  url: string;
  maxNum: number | null;
  tips: string;
  content: string;
  /** 原槽位里就有的 tips / content 键：清空后仍写回空串，不让键凭空消失（v1 数据里有 "content": ""） */
  hadTips: boolean;
  hadContent: boolean;
  extra: Record<string, unknown>;
}

export interface PayloadModel {
  results: ResultModel[];
  prompt: string;
  images: SlotModel[];
  videos: SlotModel[];
  had: { result: boolean; payload: boolean; prompt: boolean; images: boolean; videos: boolean };
  topExtra: Record<string, unknown>;
  innerExtra: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function emptySlot(): SlotModel {
  return {
    uid: uid(),
    title: '',
    url: '',
    maxNum: null,
    tips: '',
    content: '',
    hadTips: false,
    hadContent: false,
    extra: {},
  };
}

export function toSlot(value: Record<string, unknown>): SlotModel {
  const { title, url, max_num: maxNum, tips, content, ...extra } = value;
  // 类型对得上的才接管；对不上的（比如 max_num 写成了字符串）原样留在 extra 里带回
  const keep = (key: string, raw: unknown, ok: boolean) => {
    if (raw !== undefined && !ok) extra[key] = raw;
  };
  keep('title', title, typeof title === 'string');
  keep('url', url, typeof url === 'string');
  keep('max_num', maxNum, typeof maxNum === 'number');
  keep('tips', tips, typeof tips === 'string');
  keep('content', content, typeof content === 'string');
  return {
    uid: uid(),
    title: typeof title === 'string' ? title : '',
    url: typeof url === 'string' ? url : '',
    maxNum: typeof maxNum === 'number' ? maxNum : null,
    tips: typeof tips === 'string' ? tips : '',
    content: typeof content === 'string' ? content : '',
    hadTips: typeof tips === 'string',
    hadContent: typeof content === 'string',
    extra,
  };
}

/** 图片槽位与视频槽位同一套写法：表单上视频槽位不显示张数 / 提示，但原文里有就原样带回 */
export function fromSlot(slot: SlotModel): Record<string, unknown> {
  const out: Record<string, unknown> = { ...slot.extra };
  if (slot.title.trim() || !('title' in out)) out.title = slot.title.trim();
  if (slot.url.trim() || !('url' in out)) out.url = slot.url.trim();
  if (slot.maxNum != null) out.max_num = slot.maxNum;
  if (slot.tips.trim() || slot.hadTips) out.tips = slot.tips.trim();
  if (slot.content.trim() || slot.hadContent) out.content = slot.content.trim();
  return out;
}

const isSlotList = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isPlainObject);

export function toPayloadModel(payload: Record<string, unknown>): PayloadModel {
  const { result, payload: inner, ...topExtra } = payload;
  const model: PayloadModel = {
    results: [],
    prompt: '',
    images: [],
    videos: [],
    had: { result: false, payload: false, prompt: false, images: false, videos: false },
    topExtra,
    innerExtra: {},
  };
  if (Array.isArray(result) && result.every((u) => typeof u === 'string')) {
    model.results = (result as string[]).map((url) => ({ uid: uid(), url }));
    model.had.result = true;
  } else if (result !== undefined) {
    topExtra.result = result;
  }
  if (isPlainObject(inner)) {
    model.had.payload = true;
    const { prompt, image_urls: images, video_urls: videos, ...innerExtra } = inner;
    model.innerExtra = innerExtra;
    if (typeof prompt === 'string') {
      model.prompt = prompt;
      model.had.prompt = true;
    } else if (prompt !== undefined) innerExtra.prompt = prompt;
    if (isSlotList(images)) {
      model.images = images.map(toSlot);
      model.had.images = true;
    } else if (images !== undefined) innerExtra.image_urls = images;
    if (isSlotList(videos)) {
      model.videos = videos.map(toSlot);
      model.had.videos = true;
    } else if (videos !== undefined) innerExtra.video_urls = videos;
  } else if (inner !== undefined) {
    topExtra.payload = inner;
  }
  return model;
}

export function fromPayloadModel(model: PayloadModel): Record<string, unknown> {
  const results = model.results.map((r) => r.url.trim()).filter(Boolean);
  const out: Record<string, unknown> = { ...model.topExtra };
  const filled =
    results.length > 0 ||
    !!model.prompt.trim() ||
    model.images.length > 0 ||
    model.videos.length > 0;
  // 本地生活两条在 v1 里就是 {}：什么都没填时保持空对象，不凭空长出 result / payload 两个键
  if (!('result' in out) && (model.had.result || filled)) out.result = results;
  if (!('payload' in out) && (model.had.payload || filled)) {
    const inner: Record<string, unknown> = { ...model.innerExtra };
    if (!('prompt' in inner) && (model.had.prompt || filled)) inner.prompt = model.prompt;
    if (!('image_urls' in inner) && (model.had.images || filled))
      inner.image_urls = model.images.map(fromSlot);
    if (!('video_urls' in inner) && (model.had.videos || model.videos.length > 0)) {
      inner.video_urls = model.videos.map(fromSlot);
    }
    out.payload = inner;
  }
  return out;
}
