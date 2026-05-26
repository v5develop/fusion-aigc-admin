import { message } from 'antdv-next'
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { getToken, getRefreshToken, clearTokens } from '@/utils/storage'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---- Token refresh queue ----
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: Error) => void
}> = []

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

function handleAuthFailure() {
  clearTokens()
  const authStore = useAuthStore()
  authStore.logout()
  if (router.currentRoute.value.path !== '/login') {
    message.error('登录已过期，请重新登录')
    router.push('/login')
  }
}

function isAuthEndpoint(url?: string) {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  )
}

service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token && !isAuthEndpoint(config.url)) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    console.error('Request error:', error)
    message.error('请求发送失败')
    return Promise.reject(error)
  },
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    // Blob responses (file downloads) return the response directly
    if (response.config.responseType === 'blob') {
      return response.data
    }

    const res = response.data

    if (res.code !== undefined && res.code !== 0) {
      const { code, message: msg } = res

      // Auth error: 401 or similar
      if (code === 401) {
        handleAuthFailure()
        const authError = new Error(msg || 'Unauthorized') as Error & { isAuthError: boolean }
        authError.isAuthError = true
        return Promise.reject(authError)
      }

      // Server error: 5xx
      if (code >= 500) {
        message.error(msg || '服务器内部错误')
        return Promise.reject(new Error(msg || 'Server Error'))
      }

      // Rate limit: 429
      if (code === 429) {
        message.error(msg || '请求过于频繁，请稍后重试')
        return Promise.reject(new Error(msg || 'Rate Limited'))
      }

      // Circuit breaker / service degraded
      if (code === 503) {
        message.error(msg || '服务暂时不可用，请稍后重试')
        return Promise.reject(new Error(msg || 'Service Degraded'))
      }

      // Blacklist / access denied: 403
      if (code === 403) {
        message.error(msg || '访问被拒绝')
        return Promise.reject(new Error(msg || 'Access Denied'))
      }

      // Bad request: 400
      if (code === 400) {
        message.error(msg || '请求参数错误')
        return Promise.reject(new Error(msg || 'Bad Request'))
      }

      // Other business errors
      message.error(msg || '请求失败')
      return Promise.reject(new Error(msg || 'Error'))
    }

    return res.data
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // If no config (e.g. network error) or not 401, handle normally
    if (!originalRequest || error.response?.status !== 401) {
      handleHttpError(error)
      return Promise.reject(error)
    }

    // Don't retry auth endpoints
    if (isAuthEndpoint(originalRequest.url)) {
      handleAuthFailure()
      return Promise.reject(error)
    }

    // Already retried → session expired
    if (originalRequest._retry) {
      handleAuthFailure()
      return Promise.reject(new Error('Session expired'))
    }

    // No refresh token → session expired
    const storedRefreshToken = getRefreshToken()
    if (!storedRefreshToken) {
      handleAuthFailure()
      return Promise.reject(new Error('No refresh token'))
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
          }
          return service(originalRequest)
        })
        .catch((err) => {
          return Promise.reject(err)
        })
    }

    // Start token refresh
    originalRequest._retry = true
    isRefreshing = true

    try {
      const authStore = useAuthStore()
      const newToken = await authStore.refreshAccessToken()

      processQueue(null, newToken)

      if (originalRequest.headers) {
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
      }
      return service(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError as Error, null)
      handleAuthFailure()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

/** Handle HTTP errors with user-friendly messages */
function handleHttpError(error: AxiosError) {
  console.error('Response error:', error)

  if (error.response) {
    const { status, data } = error.response as {
      status: number
      data?: { message?: string }
    }
    const errorMsg = data?.message || getHttpErrorMessage(status)

    switch (status) {
      case 400:
        message.error(errorMsg || '请求参数错误')
        break
      case 403:
        message.error(errorMsg || '没有访问权限')
        router.push('/403')
        break
      case 404:
        message.error(errorMsg || '请求的资源不存在')
        break
      case 405:
        message.error(errorMsg || '请求方法不允许')
        break
      case 409:
        message.error(errorMsg || '资源冲突')
        break
      case 429:
        message.error(errorMsg || '请求过于频繁，请稍后重试')
        break
      case 500:
        message.error(errorMsg || '服务器错误，请稍后重试')
        router.push('/500')
        break
      case 502:
        message.error(errorMsg || '网关错误')
        break
      case 503:
        message.error(errorMsg || '服务暂时不可用')
        break
      case 504:
        message.error(errorMsg || '网关超时')
        break
      default:
        message.error(errorMsg || '请求失败')
    }
  } else if (error.request) {
    console.error('No response received:', error.request)
    message.error('网络连接失败，请检查网络')
  } else {
    console.error('Request setup error:', error.message)
    message.error('请求配置错误')
  }
}

/** Get HTTP status code error message */
function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return '请求参数错误'
    case 401:
      return '未授权'
    case 403:
      return '禁止访问'
    case 404:
      return '资源不存在'
    case 405:
      return '方法不允许'
    case 409:
      return '资源冲突'
    case 429:
      return '请求限流'
    case 500:
      return '服务器内部错误'
    case 502:
      return '网关错误'
    case 503:
      return '服务不可用'
    case 504:
      return '网关超时'
    default:
      return ''
  }
}

export const request = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get(url, config)
  },

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.post(url, data, config)
  },

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.put(url, data, config)
  },

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete(url, config)
  },

  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.patch(url, data, config)
  },
}

export default service
