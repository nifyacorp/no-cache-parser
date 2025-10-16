import config from '../../config/config.js';
import { createExternalApiError, createServiceError } from '../../utils/errors/AppError.js';
import logger from '../../utils/logger.js';
import { getOpenAIClient, resolveModel, extractText } from './openaiClient.js';
import { createSystemPrompt, buildContent } from './prompts/openai.js';

const log = logger.child({ module: 'ai-openai' });

const RESPONSE_SCHEMA = {
  name: 'no_cache_matches',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['matches'],
    properties: {
      matches: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'relevance_score'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            relevance_score: { type: ['number', 'string'] },
            url: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            links: {
              anyOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['html'],
                  properties: {
                    html: { type: 'string' }
                  }
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['html', 'pdf'],
                  properties: {
                    html: { type: 'string' },
                    pdf: { type: 'string' }
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
};

function normaliseMatches(result = {}) {
  if (!Array.isArray(result.matches)) {
    result.matches = [];
    return result;
  }
  result.matches = result.matches.map(match => {
    const rawScore = typeof match.relevance_score === 'number'
      ? match.relevance_score
      : parseFloat(match.relevance_score);
    const score = Number.isFinite(rawScore) ? rawScore : 0;
    const normalised = Math.max(0, Math.min(100, score <= 1 ? score * 100 : score));
    return {
      ...match,
      relevance_score: normalised,
      accuracy_score: normalised
    };
  });
  result.matches.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  return result;
}

export async function analyzeWithOpenAI(items, prompt, requestId, options = {}) {
  const client = getOpenAIClient();
  const model = resolveModel();
  const temperature = options.temperature ?? config.services.openai.temperature;
  const maxOutputTokens = options.maxOutputTokens ?? config.services.openai.maxOutputTokens;

  const systemPrompt = createSystemPrompt(prompt);
  const contentPrompt = buildContent(items);

  log.debug('Invoking OpenAI', { requestId, item_count: items.length, model });

  try {
    const textFormat = {
      type: 'json_schema',
      name: RESPONSE_SCHEMA.name,
      schema: RESPONSE_SCHEMA.schema
    };

    const response = await client.responses.create({
      model,
      temperature,
      max_output_tokens: maxOutputTokens,
      text: { format: textFormat },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: contentPrompt }]
        }
      ]
    });

    const text = extractText(response).trim();
    let payload = null;
    if (response?.output_parsed) {
      payload = response.output_parsed;
    } else {
      if (!text) {
        throw createExternalApiError('OpenAI returned empty response', {
          code: 'OPENAI_EMPTY_RESPONSE',
          service: 'openai'
        });
      }
      try {
        payload = JSON.parse(text);
      } catch (err) {
        return {
          matches: [],
          metadata: {
            error: `Failed to parse OpenAI response: ${err.message}`,
            raw_response: text.slice(0, 500),
            model_used: model,
            provider: 'openai'
          }
        };
      }
    }

    const normalised = normaliseMatches(payload);
    normalised.metadata = {
      ...(normalised.metadata || {}),
      provider: 'openai',
      model_used: model,
      token_usage: response.usage || {}
    };
    return normalised;
  } catch (error) {
    log.error('OpenAI analysis failed', { requestId, error: error.message });
    if (error.code || error.status) {
      throw createExternalApiError(`OpenAI API error: ${error.message}`, {
        code: error.code || error.status,
        service: 'openai',
        cause: error
      });
    }
    throw createServiceError('OpenAI analysis failed', { cause: error });
  }
}
