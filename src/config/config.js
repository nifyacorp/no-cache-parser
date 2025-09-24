import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.toLowerCase());
}

const config = {
  env: { NODE_ENV, IS_PRODUCTION, IS_DEVELOPMENT },
  server: { port: process.env.PORT || 8080 },
  gcp: { projectId: process.env.GOOGLE_CLOUD_PROJECT || '' },
  services: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'models/gemini-1.5-pro-latest',
      temperature: parseNumber(process.env.GEMINI_TEMPERATURE, 0.2),
      maxOutputTokens: parseNumber(process.env.GEMINI_MAX_OUTPUT_TOKENS, 8192),
      maxInputTokens: parseNumber(process.env.GEMINI_MAX_INPUT_TOKENS, 60000)
    },
    pubsub: {
      topicId: process.env.PUBSUB_TOPIC_NAME || 'custom-notifications',
      errorTopicId: process.env.PUBSUB_DLQ_TOPIC_NAME || 'custom-notifications-dlq'
    }
  },
  auth: {
    apiKey: process.env.PARSER_API_KEY || '',
    apiKeySecretName: 'PARSER_API_KEY'
  },
  security: {
    enforceHttps: (process.env.PARSER_ENFORCE_HTTPS || 'true').toLowerCase() !== 'false',
    allowLocalhost: (process.env.PARSER_ALLOW_LOCALHOST || 'false').toLowerCase() === 'true',
    allowedHosts: parseList(process.env.PARSER_ALLOWED_HOSTS),
    blockedHosts: parseList(process.env.PARSER_BLOCKED_HOSTS)
  },
  fetcher: {
    timeoutMs: parseNumber(process.env.PARSER_FETCH_TIMEOUT_MS, 15000),
    maxRedirects: parseNumber(process.env.PARSER_FETCH_MAX_REDIRECTS, 3),
    userAgent:
      process.env.PARSER_USER_AGENT ||
      'Nifya-No-Cache-Parser/1.0 (+https://nifya.app)',
    maxContentLengthBytes: parseNumber(process.env.PARSER_MAX_CONTENT_BYTES, 2 * 1024 * 1024)
  },
  parser: {
    maxItemsPerPage: parseNumber(process.env.PARSER_MAX_ITEMS_PER_PAGE, 50),
    fallbackSelector: process.env.PARSER_FALLBACK_SELECTOR || 'article, li, section'
  },
  ai: {
    maxItemsPerPrompt: parseNumber(process.env.AI_MAX_ITEMS_PER_PROMPT, 20),
    maxCharactersPerItem: parseNumber(process.env.AI_MAX_CHARS_PER_ITEM, 4000),
    provider: process.env.AI_PROVIDER || 'gemini'
  },
  database: {
    url: process.env.DATABASE_URL || ''
  }
};

export async function loadSecrets() {
  const client = new SecretManagerServiceClient();
  const toFetch = [];
  if (!config.auth.apiKey) toFetch.push(['auth.apiKey', 'PARSER_API_KEY']);
  if (!config.services.gemini.apiKey) toFetch.push(['services.gemini.apiKey', 'GEMINI_API_KEY']);

  if (toFetch.length === 0) return;
  const projectId = config.gcp.projectId;
  if (!projectId) return;

  for (const [path, secretName] of toFetch) {
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretName}/versions/latest`
      });
      const value = version.payload?.data?.toString('utf8');
      if (value) {
        const keys = path.split('.');
        let cur = config;
        for (const key of keys.slice(0, -1)) {
          cur[key] = cur[key] || {};
          cur = cur[key];
        }
        cur[keys[keys.length - 1]] = value;
      }
    } catch (e) {
      console.warn('Secret fetch failed', secretName, e.message);
    }
  }
}

export function validateConfig() {
  const required = ['services.pubsub.topicId'];
  const missing = [];
  required.forEach(key => {
    const value = key
      .split('.')
      .reduce((o, k) => (o ? o[k] : undefined), config);
    if (!value) missing.push(key);
  });
  if (!config.services.gemini.apiKey) {
    missing.push('services.gemini.apiKey');
  }
  return missing;
}

export default config;
