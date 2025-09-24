import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { createExternalApiError, createServiceError } from '../../utils/errors/AppError.js';
import { getGeminiModel } from './client.js';
import { createSystemPrompt, createContentPrompt } from './prompts/gemini.js';

const log = logger.child({ module: 'ai-gemini' });

function parseGeminiResponse(responseText, requestId) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}$/);
    const payload = jsonMatch ? jsonMatch[0] : responseText;
    const parsed = JSON.parse(payload);
    if (!parsed.matches || !Array.isArray(parsed.matches)) {
      parsed.matches = [];
    }
    return parsed;
  } catch (error) {
    log.error('Failed to parse Gemini response', {
      requestId,
      error: error.message,
      preview: responseText.slice(0, 300)
    });
    throw createServiceError('Failed to parse Gemini response', {
      requestId,
      cause: error
    });
  }
}

function normaliseMatches(matches = []) {
  return matches.map(match => {
    const score = Number.parseFloat(match.relevance_score ?? match.accuracy_score ?? 0);
    const clamped = Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score));
    const title = match.title?.toString().trim() || match.notification_title || 'Resultado';
    const summary = match.summary?.toString().trim() || match.content?.toString().trim() || '';
    const links = typeof match.links === 'object' && match.links !== null ? match.links : {};
    return {
      document_type: match.document_type || match.category || 'generic',
      title,
      notification_title: match.notification_title || title,
      issuing_body: match.issuing_body || match.author || '',
      summary,
      relevance_score: clamped,
      accuracy_score: clamped,
      links,
      source_item_id: match.source_item_id || match.id || null,
      metadata: match.metadata || {},
      dates: match.dates || { publication_date: match.date || null }
    };
  });
}

export async function analyzeWithGemini(items, prompt, requestId, options = {}) {
  const model = getGeminiModel();
  const startTime = Date.now();

  const limitedItems = items.slice(0, options.maxItems ?? config.ai.maxItemsPerPrompt);

  const systemPrompt = createSystemPrompt(prompt);
  const contentPrompt = createContentPrompt(limitedItems, prompt, items.length);

  const generationConfig = {
    temperature: options.temperature ?? config.services.gemini.temperature,
    maxOutputTokens: options.maxOutputTokens ?? config.services.gemini.maxOutputTokens,
    topK: 1,
    topP: 1
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
  ];

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }, { text: contentPrompt }]
        }
      ],
      generationConfig,
      safetySettings
    });

    const response = result.response;
    if (!response) {
      throw createExternalApiError('Gemini API returned no response object', {
        requestId
      });
    }

    const responseText = response.text();
    const parsingTime = Date.now() - startTime;

    log.debug('Gemini response received', {
      requestId,
      chars: responseText.length,
      duration_ms: parsingTime
    });

    const parsed = parseGeminiResponse(responseText, requestId);
    parsed.matches = normaliseMatches(parsed.matches);
    parsed.matches.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

    parsed.metadata = {
      model_used: config.services.gemini.model,
      processing_time_ms: parsingTime,
      finish_reason: response.finishReason,
      safety_ratings: response.safetyRatings,
      usage: response.usageMetadata,
      token_usage: {
        input_tokens: Math.round((systemPrompt.length + contentPrompt.length) / 4),
        output_tokens: Math.round(responseText.length / 4)
      }
    };

    return parsed;
  } catch (error) {
    log.error('Gemini analysis failed', {
      requestId,
      error: error.message
    });

    if (error.code === 'GROUNDING_DATA_SIZE_TOO_LARGE') {
      throw createExternalApiError('Gemini rejected the payload due to size', {
        requestId,
        cause: error
      });
    }

    if (error.code === 'PERMISSION_DENIED' || error.response?.status === 403) {
      throw createExternalApiError('Gemini denied the request; check API key permissions', {
        requestId,
        cause: error
      });
    }

    throw createServiceError(`Gemini analysis failed: ${error.message}`, {
      requestId,
      cause: error
    });
  }
}

export default {
  analyzeWithGemini
};
