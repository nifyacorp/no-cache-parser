import { PubSub } from '@google-cloud/pubsub';
import config from '../config/config.js';
import { validateBoeParserMessage } from './schemas/pubsubMessages.js';

let client;
function getClient() {
  if (!client) client = new PubSub({ projectId: config.gcp.projectId || undefined });
  return client;
}

function getTopic() {
  const name = config.services.pubsub.topicId;
  if (!name) throw new Error('PUBSUB_TOPIC_NAME not set');
  return getClient().topic(name);
}

export async function publishResults(payload) {
  validateBoeParserMessage(payload);
  const dataBuffer = Buffer.from(JSON.stringify(payload));
  const msgId = await getTopic().publishMessage({ data: dataBuffer, attributes: { traceId: payload.trace_id || '' } });
  console.log('Published message', msgId);
  return msgId;
} 