import {
  PlazaError,
  UPLOAD_LIMITS,
  confirmUpload,
  isPlazaMock,
  presignUpload,
  type UploadConfirmResult,
  type UploadKind,
  type UploadPresign,
} from '@/api/plaza-admin';

/** 上传失败：message 直接可给运营看 */
export class UploadError extends Error {
  /** 已经上传到桶但 confirm 被拒（文件本身有问题，重试同一个文件没有意义） */
  rejected: boolean;
  constructor(msg: string, rejected = false) {
    super(msg);
    this.rejected = rejected;
  }
}

const mb = (n: number) => `${n >> 20} MB`;

/** 选文件时先在前端拦一道（服务端仍强制校验）；通过返回 null */
export function checkFile(file: File, kind: UploadKind): string | null {
  const lim = UPLOAD_LIMITS[kind];
  if (!(lim.types as readonly string[]).includes(file.type))
    return `不支持的文件类型「${file.type || file.name}」：${lim.label}`;
  if (file.size <= 0) return '文件是空的';
  if (file.size > lim.maxBytes)
    return `文件太大：${kind === 'image' ? '图片' : '视频'}最大 ${mb(lim.maxBytes)}`;
  return null;
}

/** 直传到桶：XHR 才有上传进度；不带任何登录态（预签名地址自带签名，别把 token 发给桶）。返回 0~1 的进度回调 */
function putToBucket(
  p: UploadPresign,
  file: File,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isPlazaMock()) {
    // mock：没有真实的桶，模拟一段进度
    return new Promise((resolve, reject) => {
      let r = 0;
      const timer = setInterval(() => {
        r += 0.25;
        onProgress(Math.min(r, 1));
        if (r >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
      signal?.addEventListener('abort', () => {
        clearInterval(timer);
        reject(new UploadError('已取消'));
      });
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(p.method, p.uploadUrl);
    for (const [k, v] of Object.entries(p.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 403) reject(new UploadError('上传地址已过期或签名不符，请重试'));
      else reject(new UploadError(`上传失败（桶返回 HTTP ${xhr.status}）`));
    };
    xhr.onerror = () =>
      reject(new UploadError('上传失败：网络异常，或桶没有放行本站的跨域（CORS）上传'));
    xhr.onabort = () => reject(new UploadError('已取消'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

/**
 * presign → 直传 → confirm。进度 0~1（直传占 90%，confirm 占最后 10%）。
 * confirm 通过后返回的 url / coverUrl 才可以写进模板。
 */
export async function uploadMedia(
  file: File,
  kind: UploadKind,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<UploadConfirmResult> {
  const bad = checkFile(file, kind);
  if (bad) throw new UploadError(bad, true);
  let p: UploadPresign;
  try {
    p = await presignUpload({ kind, contentType: file.type, fileName: file.name, size: file.size });
  } catch (e) {
    throw new UploadError(e instanceof PlazaError ? e.message : '获取上传地址失败，请重试');
  }
  await putToBucket(p, file, (r) => onProgress(r * 0.9), signal);
  onProgress(0.92);
  try {
    const r = await confirmUpload({ url: p.url, kind });
    onProgress(1);
    return r;
  } catch (e) {
    // confirm 被拒 = 文件本身不合格（尺寸 / 类型 / 损坏），重试同一个文件没有意义
    throw new UploadError(
      e instanceof PlazaError ? e.message : '确认上传失败，请重试',
      e instanceof PlazaError,
    );
  }
}
