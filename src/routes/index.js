import { Router } from 'express';
import createAnalyzeRoutes from './analyze.js';

export default function createRoutes(mw) {
  const router = Router();
  router.get('/health', (req,res)=>res.json({status:'ok',timestamp:new Date().toISOString()}));
  router.use('/api', createAnalyzeRoutes(mw));
  return router;
} 