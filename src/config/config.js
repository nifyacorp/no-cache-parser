import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

const config = {
  env: { NODE_ENV, IS_PRODUCTION, IS_DEVELOPMENT },
  server: { port: process.env.PORT || 8080 },
  gcp: { projectId: process.env.GOOGLE_CLOUD_PROJECT || '' },
  services: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || ''
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
        keys.slice(0, -1).forEach(k => { cur[k] = cur[k] || {}; cur = cur[k]; });
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
    const value = key.split('.').reduce((o,k)=>o?.[k], config);
    if (!value) missing.push(key);
  });
  return missing;
}

export default config; 