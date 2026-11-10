// src/api/http/https.ts
import axios, { type AxiosRequestConfig } from "axios"
import axiosRetry from "axios-retry"
import { validateUrl } from "./schema"
import { axiosConfig } from "./config"
import { ToastMsgs } from "../toastUtils"
import { useAuthStore } from "../../store/authStore"
import { useAppStore } from "../../store/appStore"
import { getErrorMessage } from "./errorHandler" // ✅ Import the functions

// Extend Axios types
declare module 'axios' {
  interface AxiosRequestConfig {
    skipToast?: boolean;
  }
}

const API_URL = import.meta.env.VITE_API_URL

// Get validated URL with fallback
const getValidatedApiUrl = (): string => {
  try {
    return validateUrl(API_URL)
  } catch (err) {
    ToastMsgs.error(`Invalid API URL in environment configuration`)
    console.error('Invalid API URL:', err)

    const fallback = import.meta.env.DEV
      ? axiosConfig.fallbackUrls.development
      : axiosConfig.fallbackUrls.production

    console.log(`Using fallback: ${fallback}`)
    return fallback
  }
}

// ============================================
// ✅ CREATE AXIOS INSTANCE - COOKIE READY
// ============================================
export const axiosInstance = axios.create({
  baseURL: getValidatedApiUrl(),
  timeout: axiosConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
})

// ============================================
// ✅ RETRY LOGIC (Network errors only)
// ============================================
axiosRetry(axiosInstance, {
  retries: axiosConfig.retryCount,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkError(error) ||
      (error.response?.status || 0) >= 500
  }
})

// ============================================
// ✅ REQUEST INTERCEPTOR
// ============================================
axiosInstance.interceptors.request.use(
  (config) => {
    config.headers['X-Request-ID'] = crypto.randomUUID?.() || Date.now().toString()
    config.headers['X-App-Version'] = import.meta.env.VITE_APP_VERSION || '1.0.0'
    
    // Keep explicit Authorization header if provided (e.g. SLT temp tokens)
    if (!config.headers['Authorization']) {
      const token = useAuthStore.getState().token
      if (token && typeof token === 'string' && token.trim().length > 0) {
        config.headers['Authorization'] = `Bearer ${token.trim()}`
      } else {
        delete config.headers['Authorization']
      }
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// ============================================
// ✅ RESPONSE INTERCEPTOR - FIXED ✅
// ============================================
axiosInstance.interceptors.response.use(
  (response) => {
    // Clear offline status on successful response
    if (useAppStore.getState().isApiOffline) {
      useAppStore.getState().setApiOffline(false);
    }
    // 🚨 GLOBAL SAFETY NET: Prevent fake successes if the API URL is missing 
    // and the frontend static server returns index.html (200 OK) instead of real JSON data.
    if (typeof response.data === 'string' && (response.data.trim().startsWith('<!DOCTYPE html>') || response.data.trim().startsWith('<html'))) {
      return Promise.reject({
        status: 500,
        message: 'Invalid API URL configuration. The server returned an HTML page instead of JSON.',
        code: 'INVALID_API_URL',
      });
    }

    // Success toasts
    if (!response.config.skipToast) {
      const method = response.config.method?.toUpperCase()
      const successMessages: Record<string, string> = {
        'POST': 'Created successfully',
        'PUT': 'Updated successfully',
        'DELETE': 'Deleted successfully',
        'PATCH': 'Updated successfully'
      }
      
      const message = successMessages[method || '']
      // For login endpoints, don't show the generic "Created successfully" toast
      if (message && response.status >= 200 && response.status < 300 && !response.config.url?.includes('login')) {
        ToastMsgs.success(message)
      } else if (response.config.url?.includes('login') && response.status >= 200 && response.status < 300) {
        ToastMsgs.success("Login successful!");
      }
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || ''

    // ============================================
    // 1️⃣ NETWORK ERROR / BACKEND OFFLINE
    // ============================================
    if (!error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      useAppStore.getState().setApiOffline(true, 'Backend API server is currently unreachable. Check network or server status.');
      if (!originalRequest?.skipToast) {
        ToastMsgs.error('Network error. Backend API is currently unreachable.')
      }
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR'
      })
    }

    const status = error.response?.status
    const data = error.response?.data

    if (status === 502 || status === 503 || status === 504) {
      useAppStore.getState().setApiOffline(true, `Backend service temporarily unavailable (HTTP ${status}). Server may be restarting.`);
    } else if (status && status < 500 && useAppStore.getState().isApiOffline) {
      useAppStore.getState().setApiOffline(false);
    }

    // ============================================
    // 2️⃣ USE YOUR ERROR HANDLER ✅
    // ============================================
    // ✅ This handles ALL error formats including 422 with detail array
    const finalMessage = getErrorMessage(status, data)

    // ============================================
    // 3️⃣ SMART 401 HANDLING
    // ============================================
    if (status === 401) {
      // Check for MFA Challenge
      const headers = error.response?.headers || {}
      const rawDetail = data?.detail || data?.error || ''
      const detailStr = typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail)

      const isMFA =
        headers['x-mfa-required'] === 'true' ||
        headers['X-MFA-Required'] === 'true' ||
        detailStr.toLowerCase().includes('mfa code required') ||
        Boolean(data?.mfa_required || data?.error?.mfa_required)

      if (isMFA) {
        let method: 'totp' | 'email' = 'totp'
        const candidateMethod =
          headers['x-mfa-method'] ||
          headers['X-MFA-Method'] ||
          data?.mfa_method ||
          data?.error?.mfa_method

        if (candidateMethod === 'email' || candidateMethod === 'totp') {
          method = candidateMethod
        } else if (detailStr.toLowerCase().includes('method: email') || detailStr.toLowerCase().includes('"email"')) {
          method = 'email'
        }

        const email =
          headers['x-mfa-email'] ||
          headers['X-MFA-Email'] ||
          data?.email ||
          data?.error?.email ||
          undefined

        return Promise.reject({
          status: 401,
          message: typeof rawDetail === 'string' ? rawDetail : (data?.error?.message || data?.detail?.message || 'MFA code required'),
          code: 'MFA_REQUIRED',
          isMFA: true,
          method,
          email,
          response: error.response,
          data: data,
        })
      }

      // Login endpoint
      if (url.includes('/login')) {
        if (!originalRequest?.skipToast) {
          ToastMsgs.error(finalMessage || 'Invalid username or password.')
        }
        return Promise.reject({
          status: 401,
          message: finalMessage || 'Invalid username or password.',
          code: 'INVALID_CREDENTIALS',
          data: data,
          response: error.response,
        })
      }

      // Other auth endpoints
      if (url.includes('/me') || url.includes('/refresh') || url.includes('/logout')) {
        if (!originalRequest?.skipToast) {
          ToastMsgs.error(finalMessage || 'Authentication failed.')
        }
        return Promise.reject({
          status: 401,
          message: finalMessage || 'Authentication failed.',
          code: 'AUTH_FAILED',
          data: data
        })
      }

      // Session expired
      if (!window.location.pathname.includes('/login')) {
        handleLogout()
        ToastMsgs.error('Session expired. Please login again.')
      }
      return Promise.reject({
        status: 401,
        message: 'Session expired',
        code: 'SESSION_EXPIRED',
        data: data
      })
    }

    // ============================================
    // 4️⃣ SHOW TOAST ERROR
    // ============================================
    if (!originalRequest?.skipToast) {
      ToastMsgs.error(finalMessage)
    }

    // ============================================
    // 5️⃣ RETURN ERROR WITH ORIGINAL DATA
    // ============================================
    // ✅ Return the error with the extracted message
    // ✅ Preserve the original data for field-level error extraction
    return Promise.reject({
      status: status,
      message: finalMessage, // ✅ This is ALWAYS a string now
      data: data, // Original error data (preserved for field errors)
      code: data?.code || 'UNKNOWN_ERROR',
      response: error.response,
      // ✅ Also preserve detail for backward compatibility
      detail: data?.detail,
    })
  }
)

// ============================================
// ✅ LOGOUT HELPER
// ============================================
const handleLogout = () => {
  useAuthStore.getState().logout()
  axiosInstance.post('/auth/logout').catch(() => {})
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login'
  }
}

// ============================================
// ✅ HTTP WRAPPER
// ============================================
export const http = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.get<T>(url, config).then(res => res.data),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.post<T>(url, data, config).then(res => res.data),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.put<T>(url, data, config).then(res => res.data),

  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.patch<T>(url, data, config).then(res => res.data),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.delete<T>(url, config).then(res => res.data),

  instance: axiosInstance,
}

// ============================================
// ✅ DEV LOGGING
// ============================================
if (import.meta.env.DEV) {
  axiosInstance.interceptors.request.use(
    (config) => {
      console.group(`🌐 ${config.method?.toUpperCase()} ${config.url}`)
      console.log('Headers:', config.headers)
      console.log('Data:', config.data)
      console.groupEnd()
      return config
    }
  )

  axiosInstance.interceptors.response.use(
    (response) => {
      console.log(`✅ ${response.status} ${response.config.url}`)
      return response
    },
    (error) => {
      console.error(`❌ ${error.response?.status || 'Network'} ${error.config?.url}`)
      console.error('Error:', error.message)
      return Promise.reject(error)
    }
  )
}