/**
 * Shared schema definitions for Pub/Sub messages published by the
 * configurable no-cache parser. The structure mirrors the legacy BOE parser
 * envelope so downstream consumers can reuse the same validation logic.
 */

/**
 * Validates a parser result message.
 *
 * @param {Object} message - Message object to validate.
 * @returns {boolean} True if valid; throws error if invalid.
 */
export function validateBoeParserMessage(message) {
  if (!message) throw new Error('Message cannot be null or undefined');
  if (!message.trace_id) throw new Error('Missing required field: trace_id');

  if (!message.request) throw new Error('Missing required field: request');
  if (typeof message.request.subscription_id !== 'string' || message.request.subscription_id.length === 0) {
    throw new Error('request.subscription_id must be a non-empty string');
  }
  if (typeof message.request.user_id !== 'string' || message.request.user_id.length === 0) {
    throw new Error('request.user_id must be a non-empty string');
  }
  if (!Array.isArray(message.request.texts)) {
    throw new Error('request.texts must be an array');
  }

  if (!message.results) throw new Error('Missing required field: results');
  if (!message.results.boe_info) throw new Error('Missing required field: results.boe_info');
  if (!message.results.query_date) throw new Error('Missing required field: results.query_date');
  if (!Array.isArray(message.results.results)) {
    throw new Error('results.results must be an array');
  }

  if (!message.metadata) throw new Error('Missing required field: metadata');
  if (typeof message.metadata.processing_time_ms !== 'number') {
    throw new Error('metadata.processing_time_ms must be a number');
  }
  if (typeof message.metadata.total_items_processed !== 'number') {
    throw new Error('metadata.total_items_processed must be a number');
  }
  if (typeof message.metadata.status !== 'string') {
    throw new Error('metadata.status must be a string');
  }

  return true;
}

/**
 * Creates a default parser message structure with placeholder values.
 *
 * @returns {Object} Default message structure.
 */
export function createDefaultBoeParserMessage() {
  return {
    trace_id: '',
    request: {
      subscription_id: '',
      user_id: '',
      texts: []
    },
    results: {
      boe_info: {
        publication_date: '',
        source_url: ''
      },
      query_date: '',
      results: []
    },
    metadata: {
      processing_time_ms: 0,
      total_items_processed: 0,
      status: 'success'
    }
  };
}

export default {
  validateBoeParserMessage,
  createDefaultBoeParserMessage
};
