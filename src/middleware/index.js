import { authMiddleware } from './auth.js';
import { validationMiddleware } from './validation.js';
import errorHandler from './errorHandler.js';

export function registerMiddleware(app) {
  return {
    auth: authMiddleware,
    validateRequest: validationMiddleware,
    errorHandler
  };
} 