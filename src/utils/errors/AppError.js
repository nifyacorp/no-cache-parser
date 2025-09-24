export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERROR', details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR'
};

export function createValidationError(msg, details = {}) {
  return new AppError(msg, 400, ErrorTypes.VALIDATION_ERROR, details);
}

export function createAuthenticationError(msg) {
  return new AppError(msg, 401, ErrorTypes.AUTHENTICATION_ERROR);
}

export function createServiceError(msg, details = {}) {
  return new AppError(msg, 500, ErrorTypes.SERVICE_ERROR, details);
}

export function createExternalApiError(msg, details = {}) {
  return new AppError(msg, 503, ErrorTypes.EXTERNAL_API_ERROR, details);
}

export default {
  AppError,
  ErrorTypes,
  createValidationError,
  createAuthenticationError,
  createServiceError,
  createExternalApiError
};
