import { fetchHttp } from '../fetcher/httpFetcher.js';
import { parseHtml } from './html.js';

/**
 * Parse an arbitrary web page according to provided source configuration.
 *
 * @param {Object} source       – configuration for the source
 * @param {String} source.url   – absolute URL to fetch
 * @param {String} [source.selector] – optional CSS selector / XPath expression
 * @returns {Promise<{items:Array, source_info:Object}>}
 */
export async function parsePage(source) {
  if (!source?.url) throw new Error('source.url required');
  const { url, selector } = source;

  // Step 1: fetch raw HTML (MVP – only HTTP fetch supported)
  const fetched = await fetchHttp(url);

  // Step 2: parse HTML
  const { items } = parseHtml({ html: fetched.html, url, selector });

  return {
    items,
    source_info: fetched.source_info
  };
} 