import config from '../../config/config.js';
import { createServiceError } from '../../utils/errors/AppError.js';
import logger from '../../utils/logger.js';
import { analyzeWithGemini } from './gemini.js';

const log = logger.child({ module: 'ai-service' });

function limitItems(items = []) {
  const limit = config.ai.maxItemsPerPrompt;
  return items.slice(0, limit).map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    url: item.url,
    links: item.links,
    date: item.date,
    section: item.section,
    category: item.category
  }));
}

export async function analyzeGenericItems(items, prompt, requestId, options = {}) {
  const provider = (options.provider || config.ai.provider || 'gemini').toLowerCase();
  const preparedItems = limitItems(items);

  log.debug('Dispatching AI analysis', {
    provider,
    requestId,
    item_count: preparedItems.length,
    prompt_length: prompt?.length || 0
  });

  switch (provider) {
    case 'gemini':
      return analyzeWithGemini(preparedItems, prompt, requestId, {
        ...options,
        maxItems: config.ai.maxItemsPerPrompt
      });
    default:
      throw createServiceError(`Unsupported AI provider: ${provider}`);
  }
}

export default {
  analyzeGenericItems
};
