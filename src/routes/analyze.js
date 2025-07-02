import { Router } from 'express';
import { analyzeText } from '../controllers/analyze.js';

export default function createAnalyzeRoutes(mw) {
  const r = Router();
  r.post('/analyze-text', mw.auth, mw.validateRequest, analyzeText);
  return r;
} 