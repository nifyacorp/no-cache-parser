import OpenAI from 'openai';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

const log = logger.child({ module: 'ai-openai-client' });
let clientInstance = null;

export function getOpenAIClient() {
  if (clientInstance) return clientInstance;
  if (!config.services.openai.apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  clientInstance = new OpenAI({ apiKey: config.services.openai.apiKey });
  log.info('OpenAI client initialised', { model: config.services.openai.model });
  return clientInstance;
}

export function resolveModel() {
  return config.services.openai.model || 'gpt-5-mini-2025-08-07';
}

export function extractText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (part?.type === 'output_text' && typeof part.text === 'string') {
            return part.text;
          }
          if (part?.type === 'text' && typeof part.text === 'string') {
            return part.text;
          }
        }
      }
    }
  }
  return '';
}
