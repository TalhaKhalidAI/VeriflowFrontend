//import { z, ZodError } from 'zod'
import { ZodError } from 'zod'
/**
 * Validate an absolute HTTP/HTTPS URL or a relative API path.
 */
export function validateUrl(url: string): string {
  const value = url?.trim()

  if (!value) {
    throw new Error('URL is required')
  }

  // Allow relative paths such as /api
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.replace(/\/+$/, '')
  }

  try {
    const parsed = new URL(value)

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed')
    }

    return value.replace(/\/+$/, '')
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`URL validation failed: ${error.message}`)
    }

    throw error
  }
}

/**
 * Safely validate URL without throwing.
 */
export function safeValidateUrl(url: string): string | null {
  try {
    return validateUrl(url)
  } catch {
    return null
  }
}

/**
 * Type guard for URL validation.
 */
export function isValidUrl(url: string): url is string {
  try {
    validateUrl(url)
    return true
  } catch {
    return false
  }
}
