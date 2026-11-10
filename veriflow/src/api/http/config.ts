export const axiosConfig = {
  timeout: 10000,
  retryCount: 2,
  refreshEndpoint: '/users/users_config/refresh',
  fallbackUrls: {
    development: 'http://localhost:8000/app/v1',
    production: '/api'
  }
} as const;