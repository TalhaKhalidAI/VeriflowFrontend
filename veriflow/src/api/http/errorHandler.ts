// src/api/http/errorHandler.ts

// ✅ Define error messages by status code
export const ERROR_MESSAGES: Record<number, string> = {
    400: 'Bad request. Please check your input.',
    401: 'Session expired. Please login again.',
    403: 'You don\'t have permission to perform this action.',
    404: 'Resource not found.',
    405: 'Method not allowed.',
    409: 'Conflict. The resource already exists.',
    422: 'Validation error. Please check your input.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again later.',
    502: 'Bad gateway. Please try again.',
    503: 'Service unavailable. Please try again later.',
    504: 'Gateway timeout. Please try again.',
};

// ✅ Map backend machine error codes from FastAPI main.py exception handlers
const BACKEND_ERROR_CODE_MESSAGES: Record<string, string> = {
    database_unavailable: 'Database is temporarily unavailable. Please try again.',
    database_error: 'Invalid database operation.',
    cache_unavailable: 'Cache service temporarily unavailable.',
    infrastructure_unavailable: 'A required backend service is temporarily unavailable.',
    forbidden: 'You do not have permission to perform this action.',
};

const formatValidationEntry = (entry: any): string => {
    if (!entry) return 'Invalid input';
    if (typeof entry === 'string') return entry;
    const msg = entry.msg || entry.message;
    if (msg) {
        if (Array.isArray(entry.loc) && entry.loc.length > 0) {
            const field = entry.loc[entry.loc.length - 1];
            if (typeof field === 'string' && field !== 'body') {
                return `${field}: ${msg}`;
            }
        }
        return String(msg);
    }
    return JSON.stringify(entry);
};

// ✅ Extract human-readable error message from any FastAPI / custom handler error format
export const extractErrorMessage = (data: any): string => {
    if (typeof data === 'string') return data;
    if (!data) return 'An unknown error occurred';

    // ✅ Handle FastAPI 422 validation errors:
    //    - Default FastAPI shape: { detail: [{ msg, loc, ... }] }
    //    - Custom main.py shape:  { error: "Validation failed", details: [{ msg, loc, ... }], request_id }
    const validationArray = Array.isArray(data.details)
        ? data.details
        : Array.isArray(data.detail)
        ? data.detail
        : Array.isArray(data)
        ? data
        : null;

    if (validationArray && validationArray.length > 0) {
        return formatValidationEntry(validationArray[0]);
    }

    // ✅ Prefer explicit human-readable message/detail before machine error codes
    if (data.message) {
        return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }

    if (data.detail && typeof data.detail === 'string') {
        return data.detail;
    }

    if (data.error) {
        const errStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        return BACKEND_ERROR_CODE_MESSAGES[errStr] || errStr;
    }

    return 'An unknown error occurred';
};

// ✅ Get field-specific errors from validation errors (supports both `detail` and `details`)
export const extractFieldErrors = (data: any): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    if (!data) return fieldErrors;

    const validationArray = Array.isArray(data.details)
        ? data.details
        : Array.isArray(data.detail)
        ? data.detail
        : Array.isArray(data)
        ? data
        : null;

    if (validationArray) {
        validationArray.forEach((item: any) => {
            let field = 'general';
            if (item?.loc && Array.isArray(item.loc)) {
                const lastPath = item.loc[item.loc.length - 1];
                field = typeof lastPath === 'string' ? lastPath : 'general';
            }
            const message = item?.msg || item?.message || 'Invalid value';
            fieldErrors[field] = message;
        });
    }

    return fieldErrors;
};

// ✅ Get error message by status code (with fallback to backend message)
export const getErrorMessage = (status: number, data?: any): string => {
    if (data) {
        const extracted = extractErrorMessage(data);
        if (extracted && extracted !== 'An unknown error occurred') {
            return extracted;
        }
    }

    const predefinedMessage = ERROR_MESSAGES[status];
    if (predefinedMessage) return predefinedMessage;

    return `Request failed with status ${status}`;
};
