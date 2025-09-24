import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

const log = logger.child({ module: 'ai-client' });

let geminiModel = null;

export function getGeminiModel() {
  if (geminiModel) return geminiModel;
  if (!config.services.gemini.apiKey) {
    throw new Error('Gemini API key not configured.');
  }
  const genAI = new GoogleGenerativeAI(config.services.gemini.apiKey);
  geminiModel = genAI.getGenerativeModel({ model: config.services.gemini.model });
  log.info('Gemini client initialised', { model: config.services.gemini.model });
  return geminiModel;
}

export function resetClients() {
  geminiModel = null;
}

export default {
  getGeminiModel,
  resetClients
};
