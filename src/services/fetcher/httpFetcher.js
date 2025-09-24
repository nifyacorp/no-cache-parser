import axios from 'axios';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { createServiceError } from '../../utils/errors/AppError.js';
import { assertUrlAllowed } from './urlGuard.js';

const log = logger.child({ module: 'httpFetcher' });

function sanitizeHeaders(headers = {}) {
  const sanitized = { ...headers };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key];
    }
  });
  return sanitized;
}

export async function fetchHttp(url, options = {}) {
  const guard = assertUrlAllowed(url);

  const headers = sanitizeHeaders({
    'User-Agent': config.fetcher.userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...options.headers
  });

  const requestOptions = {
    method: 'GET',
    url,
    timeout: options.timeout ?? config.fetcher.timeoutMs,
    maxRedirects: options.maxRedirects ?? config.fetcher.maxRedirects,
    responseType: 'text',
    decompress: true,
    headers,
    validateStatus: status => status >= 200 && status < 400,
    maxContentLength: config.fetcher.maxContentLengthBytes
  };

  const start = Date.now();

  try {
    const response = await axios(requestOptions);
    const elapsed = Date.now() - start;

    log.debug('Fetched remote document', {
      url,
      status: response.status,
      duration_ms: elapsed,
      content_length: Number(response.headers['content-length'] || 0),
      final_url: response.request?.res?.responseUrl || url
    });

    return {
      html: response.data,
      source_info: {
        fetched_url: url,
        final_url: response.request?.res?.responseUrl || url,
        fetched_at: new Date().toISOString(),
        status: response.status,
        headers: {
          'content-type': response.headers['content-type'],
          'last-modified': response.headers['last-modified'],
          'content-length': response.headers['content-length']
        }
      }
    };
  } catch (error) {
    log.error('Failed to fetch remote document', {
      url,
      duration_ms: Date.now() - start,
      error: error.message,
      status: error.response?.status
    });

    throw createServiceError('Failed to fetch remote content', {
      url,
      cause: error,
      status: error.response?.status
    });
  }
}

export default fetchHttp;
