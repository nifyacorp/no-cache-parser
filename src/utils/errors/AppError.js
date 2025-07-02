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
  SERVICE_ERROR: 'SERVICE_ERROR'
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