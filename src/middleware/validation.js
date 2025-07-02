import { createValidationError } from '../utils/errors/AppError.js';

export function validationMiddleware(req, res, next) {
  const { texts, source } = req.body;
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return next(createValidationError('texts must be a non-empty array'));
  }
  if (!source?.url) {
    return next(createValidationError('source.url is required'));
  }
  next();
} 