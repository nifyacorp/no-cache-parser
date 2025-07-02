import { randomUUID } from 'crypto';
import { publishResults } from '../utils/pubsub.js';
import { parsePage } from '../services/parser/index.js';
import { analyzeGenericItems } from '../services/ai/index.js';

export async function analyzeText(req, res, next) {
  try {
    const { texts, subscription_id, user_id, metadata = {}, source } = req.body;
    const traceId = randomUUID();

    let sourceConfig = source || metadata.source;

    // Subscription-worker must supply `source` for custom types – no DB access here

    if (!sourceConfig?.url) {
      return res.status(400).json({ error: 'source.url missing in request or metadata' });
    }

    // Fetch & parse page
    const parsed = await parsePage(sourceConfig);

    // Analyze each prompt
    const analysisResults = await Promise.all(
      texts.map(prompt => analyzeGenericItems(parsed.items, prompt, req.id))
    );

    const response = {
      trace_id: traceId,
      request: {
        texts,
        subscription_id: subscription_id || '',
        user_id: user_id || ''
      },
      results: {
        boe_info: parsed.source_info,
        query_date: new Date().toISOString().split('T')[0],
        results: analysisResults.map((result, idx) => ({
          prompt: texts[idx],
          matches: result.matches,
          metadata: result.metadata
        }))
      },
      metadata: {
        processing_time_ms: Date.now() - req.startTime,
        total_items_processed: parsed.items.length,
        status: 'success'
      }
    };

    publishResults(response).catch(console.error);
    res.json(response);
  } catch (err) {
    next(err);
  }
} 