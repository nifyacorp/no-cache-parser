import { randomUUID } from 'crypto';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { publishResults } from '../utils/pubsub.js';
import { parsePage } from '../services/parser/index.js';
import { analyzeGenericItems } from '../services/ai/index.js';

const log = logger.child({ controller: 'analyze' });

export async function analyzeText(req, res, next) {
  const traceId = randomUUID();
  const requestLogger = log.child({ traceId, requestId: req.id });

  try {
    const payload = req.parserRequest || req.body;
    const {
      texts,
      subscription_id: subscriptionId,
      user_id: userId,
      source,
      metadata = {},
      ai = {}
    } = payload;

    const effectiveUserId = userId || metadata.user_id || '';
    const effectiveSubscriptionId = subscriptionId || metadata.subscription_id || '';
    const templateId = metadata.template_id || null;

    requestLogger.info('Starting generic analysis', {
      prompts: texts.length,
      url: source.url,
      templateId
    });

    const parsed = await parsePage(source);

    requestLogger.debug('Source parsed', {
      items_extracted: parsed.items.length,
      selector: source.selector || source.extract?.selector
    });

    const aiOptions = {
      provider: ai.provider || config.ai.provider,
      temperature: ai.temperature ?? config.services.openai.temperature,
      maxOutputTokens: ai.maxOutputTokens ?? config.services.openai.maxOutputTokens
    };

    const analysisResults = await Promise.all(
      texts.map(prompt => analyzeGenericItems(parsed.items, prompt, req.id, aiOptions))
    );

    const response = {
      trace_id: traceId,
      processor_type: 'no-cache',
      request: {
        texts,
        subscription_id: effectiveSubscriptionId,
        user_id: effectiveUserId,
        template_id: templateId
      },
      results: {
        boe_info: {
          publication_date: new Date().toISOString().split('T')[0],
          source_url: source.url,
          processor: 'no-cache'
        },
        query_date: new Date().toISOString().split('T')[0],
        results: analysisResults.map((result, idx) => ({
          prompt: texts[idx],
          matches: result.matches || [],
          metadata: result.metadata || {}
        })),
        source_info: parsed.source_info
      },
      metadata: {
        status: 'success',
        processing_time_ms: Date.now() - req.startTime,
        total_items_processed: parsed.items.length
      }
    };

    publishResults(response).catch(err => {
      requestLogger.error('Failed to publish Pub/Sub message', {
        error: err.message
      });
    });

    return res.json(response);
  } catch (error) {
    log.error('Analyze request failed', {
      traceId,
      error: error.message
    });

    return next(error);
  }
}

export default analyzeText;
