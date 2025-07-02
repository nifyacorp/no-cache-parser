import config from '../config/config.js';
import { createAuthenticationError } from '../utils/errors/AppError.js';

export function authMiddleware(req, res, next) {
  const expected = config.auth.apiKey;
  if (!expected) return next(); // open if no key set
  const header = req.headers['authorization'] || '';
  if (header === `Bearer ${expected}`) return next();
  return next(createAuthenticationError('Invalid API key'));
} 