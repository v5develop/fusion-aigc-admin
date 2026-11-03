import { message } from 'antdv-next';
import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  create,
} from 'axios';

import router from '@/router';
import { useAuthStore } from '@/stores/auth';
import { useTwoFactorStore } from '@/stores/two-factor';
import { getToken, getRefreshToken, clearTokens } from '@/utils/storage';

const service: AxiosInstance = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Retry config ----
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

/**
 * 按请求声明的两个开关：
 * - noRetry：不自动重传。大文件上传失败后自动重传只会把同一个文件再传两遍（每次都在桶里多留一个对象）；
 * - noErrorRedirect：出错只在原地提示、不跳 /403、/500。弹窗里正在编辑时一跳页，没保存的内容就全丢了。
 */
type RequestFlags = {
  silentError?: boolean;
  noRetry?: boolean;
  noErrorRedirect?: boolean;
};

/**
 * 业务失败时 reject 的错误：仍是 `Error`（`message` = 后端 msg，老代码照旧只读 message），
 * 另外带上 CommonResult 的 `code` 与 `data`，以及 HTTP 状态 `status`（HTTP 非 2xx 时才有）。
 * 例：AI 网关发布校验失败 → `code=422`，`data` = 网关 error 对象（`{code, check, message, details}`）。
 */
export type RequestError = Error & { code?: number; data?: unknown; status?: number };

function requestError(msg: string, code?: number, data?: unknown, status?: number): RequestError {
  const err = new Error(msg) as RequestError;
  if (code !== undefined) err.code = code;
  if (data !== undefined && data !== null) err.data = data;
  if (status !== undefined) err.status = status;
  return err;
}

/** 取业务错误携带的 CommonResult.data（没有则 undefined） */
export function errorDataOf<T = unknown>(e: unknown): T | undefined {
  return e && typeof e === 'object' && 'data' in e && !('isAxiosError' in e)
    ? ((e as RequestError).data as T)
    : undefined;
}

/** 从错误响应体（CommonResult `{code, msg}`）里取可读原因 */
export function extractErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as { msg?: string; message?: string };
  return d.msg || d.message || undefined;
}
/**
 * 2FA 开关开着、当前管理员未绑定时，后端对后台接口回 HTTP 403，错误码 2FA_BIND_REQUIRED
 * （CommonResult 的 reason，兼容放在 code 里的写法）。这种 403 不是权限不足：
 * 不弹通用错误、不跳 /403，改为打开强制绑定弹窗。
 */
const TWO_FACTOR_BIND_REQUIRED = '2FA_BIND_REQUIRED';

function isTwoFactorBindRequired(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as { reason?: unknown; code?: unknown };
  return b.reason === TWO_FACTOR_BIND_REQUIRED || b.code === TWO_FACTOR_BIND_REQUIRED;
}

const MAX_RETRY_COUNT = 2;
const RETRY_DELAY_BASE = 500;

// ---- Token refresh queue ----
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

function handleAuthFailure() {
  clearTokens();
  const authStore = useAuthStore();
  authStore.logout();
  if (router.currentRoute.value.path !== '/login') {
    message.error('登录已过期，请重新登录');
    router.push('/login');
  }
}

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  return (
    url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')
  );
}

service.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && !isAuthEndpoint(config.url)) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('Request error:', error);
    message.error('请求发送失败');
    return Promise.reject(error);
  },
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    // Blob responses (file downloads) return the response directly
    if (response.config.responseType === 'blob') {
      return response.data;
    }

    const res = response.data;

    if (res.code !== undefined && res.code !== 0) {
      const { code } = res;
      const msg = res.msg || res.message || '';

      // Check if request opts out of auto error message
      const silentError = (response.config as AxiosRequestConfig & { silentError?: boolean })
        ?.silentError;

      // Auth error: HTTP 标准 401
      if (code === 401) {
        if (!silentError) handleAuthFailure();
        const authError = requestError(msg || 'Unauthorized', code, res.data) as RequestError & {
          isAuthError: boolean;
        };
        authError.isAuthError = true;
        return Promise.reject(authError);
      }

      // 未绑定 2FA：打开强制绑定弹窗，不当成权限不足
      if (isTwoFactorBindRequired(res)) {
        useTwoFactorStore().requireBind();
        return Promise.reject(requestError(msg || '请先绑定两步验证', code, res.data, 403));
      }

      // Access denied: HTTP 标准 403
      if (code === 403) {
        if (!silentError) message.error(msg || '访问被拒绝');
        return Promise.reject(requestError(msg || 'Access Denied', code, res.data));
      }

      // Bad request: HTTP 标准 400
      if (code === 400) {
        if (!silentError) message.error(msg || '请求参数错误');
        return Promise.reject(requestError(msg || 'Bad Request', code, res.data));
      }

      // Not found: HTTP 标准 404
      if (code === 404) {
        if (!silentError) message.error(msg || '资源不存在');
        return Promise.reject(requestError(msg || 'Not Found', code, res.data));
      }

      // Conflict: HTTP 标准 409
      if (code === 409) {
        if (!silentError) message.error(msg || '资源冲突');
        return Promise.reject(requestError(msg || 'Conflict', code, res.data));
      }

      // System error: 5xxx 业务错误码
      if (code >= 5000 && code < 6000) {
        if (!silentError) message.error(msg || '服务器内部错误');
        return Promise.reject(requestError(msg || 'Server Error', code, res.data));
      }

      // All other business errors (1xxx/2xxx/3xxx/4xxx/6xxx/7xxx/40xxx/46xxx)
      // Display the specific error message from backend
      if (!silentError) message.error(msg || '请求失败');
      return Promise.reject(requestError(msg || 'Error', code, res.data));
    }

    return res.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    // 重试逻辑：对可重试状态码进行指数退避重试
    if (
      originalRequest &&
      !(originalRequest as RequestFlags).noRetry &&
      RETRYABLE_STATUS.includes(error.response?.status ?? 0)
    ) {
      const retryCount = originalRequest._retryCount ?? 0;
      if (retryCount < MAX_RETRY_COUNT) {
        originalRequest._retryCount = retryCount + 1;
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        console.warn(
          `[HTTP Retry] ${originalRequest.method?.toUpperCase()} ${originalRequest.url} - attempt ${retryCount + 1}/${MAX_RETRY_COUNT} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return service(originalRequest);
      }
    }

    // 未绑定 2FA 的 403：打开强制绑定弹窗，不弹通用错误、不跳 /403
    if (error.response?.status === 403 && isTwoFactorBindRequired(error.response.data)) {
      useTwoFactorStore().requireBind();
      const body = error.response.data as { data?: unknown };
      return Promise.reject(
        requestError(extractErrorMessage(body) || '请先绑定两步验证', 403, body?.data, 403),
      );
    }

    // If no config (e.g. network error) or not 401, handle normally
    if (!originalRequest || error.response?.status !== 401) {
      handleHttpError(error);
      // 透传后端业务 msg，避免上层 catch 只拿到 "Request failed with status code 400"
      const body = error.response?.data as { code?: unknown; data?: unknown } | undefined;
      const backendMsg = extractErrorMessage(body);
      if (backendMsg) {
        const status = error.response?.status;
        const code = typeof body?.code === 'number' ? body.code : status;
        return Promise.reject(requestError(backendMsg, code, body?.data, status));
      }
      return Promise.reject(error);
    }

    // Don't retry auth endpoints
    if (isAuthEndpoint(originalRequest.url)) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    // Already retried → session expired
    if (originalRequest._retry) {
      handleAuthFailure();
      return Promise.reject(new Error('Session expired'));
    }

    // No refresh token → session expired
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) {
      handleAuthFailure();
      return Promise.reject(new Error('No refresh token'));
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
          }
          return service(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    // Start token refresh
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const authStore = useAuthStore();
      const newToken = await authStore.refreshAccessToken();

      processQueue(null, newToken);

      if (originalRequest.headers) {
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
      }
      return service(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      handleAuthFailure();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

/** Handle HTTP errors with user-friendly messages */
function handleHttpError(error: AxiosError) {
  console.error('Response error:', error);

  // 请求显式声明静默时，不弹全局错误，交由上层自行处理
  const silentError = (error.config as AxiosRequestConfig & RequestFlags)?.silentError;
  const redirect = (path: string) => {
    if (!(error.config as AxiosRequestConfig & RequestFlags)?.noErrorRedirect) router.push(path);
  };

  if (error.response) {
    const { status, data } = error.response as { status: number; data?: unknown };
    const errorMsg = extractErrorMessage(data) || getHttpErrorMessage(status);

    if (silentError) {
      // 静默：仅对需要跳转的状态码做路由跳转，不弹 message
      if (status === 403) redirect('/403');
      if (status === 500) redirect('/500');
      return;
    }

    switch (status) {
      case 400:
        message.error(errorMsg || '请求参数错误');
        break;
      case 403:
        message.error(errorMsg || '没有访问权限');
        redirect('/403');
        break;
      case 404:
        message.error(errorMsg || '请求的资源不存在');
        break;
      case 405:
        message.error(errorMsg || '请求方法不允许');
        break;
      case 409:
        message.error(errorMsg || '资源冲突');
        break;
      case 413:
        message.error(errorMsg || '请求内容过大');
        break;
      case 422:
        message.error(errorMsg || '校验未通过');
        break;
      case 429:
        message.error(errorMsg || '请求过于频繁，请稍后重试');
        break;
      case 500:
        message.error(errorMsg || '服务器错误，请稍后重试');
        redirect('/500');
        break;
      case 502:
        message.error(errorMsg || '网关错误');
        break;
      case 503:
        message.error(errorMsg || '服务暂时不可用');
        break;
      case 504:
        message.error(errorMsg || '网关超时');
        break;
      default:
        message.error(errorMsg || '请求失败');
    }
  } else if (error.request) {
    console.error('No response received:', error.request);
    if (!silentError) message.error('网络连接失败，请检查网络');
  } else {
    console.error('Request setup error:', error.message);
    if (!silentError) message.error('请求配置错误');
  }
}

/** Get HTTP status code error message */
function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return '请求参数错误';
    case 401:
      return '未授权';
    case 403:
      return '禁止访问';
    case 404:
      return '资源不存在';
    case 405:
      return '方法不允许';
    case 409:
      return '资源冲突';
    case 413:
      return '请求内容过大';
    case 422:
      return '校验未通过';
    case 429:
      return '请求限流';
    case 500:
      return '服务器内部错误';
    case 502:
      return '网关错误';
    case 503:
      return '服务不可用';
    case 504:
      return '网关超时';
    default:
      return '';
  }
}

export const request = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get(url, config);
  },

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.post(url, data, config);
  },

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.put(url, data, config);
  },

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete(url, config);
  },

  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.patch(url, data, config);
  },
};

export default service;
