import { createValidationError } from '../utils/errors/AppError.js';
import { validateAnalyzeRequest } from '../utils/schemas/analyzeRequest.js';

export function validationMiddleware(req, res, next) {
  const payload = req.body || {};
  const result = validateAnalyzeRequest(payload);

  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    return next(
      createValidationError('Invalid analyze request payload', {
        issues
      })
    );
  }

  req.parserRequest = {
    ...result.data,
    metadata: result.data.metadata || {}
  };

  next();
}

export default validationMiddleware;
