import { fetchHttp } from '../fetcher/httpFetcher.js';
import { parseHtml } from './html.js';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

const log = logger.child({ module: 'parser-service' });

/**
 * Parse an arbitrary web page according to provided source configuration.
 *
 * @param {Object} source       – configuration for the source
 * @param {String} source.url   – absolute URL to fetch
 * @param {String} [source.selector] – optional CSS selector / XPath expression
 * @param {Object} [source.extract]  – additional extraction instructions
 * @returns {Promise<{items:Array, source_info:Object}>}
 */
export async function parsePage(source) {
  if (!source?.url) throw new Error('source.url required');
  const { url, selector, extract = {}, headers } = source;

  log.debug('Starting page parse', { url, selector });

  const fetched = await fetchHttp(url, { headers });

  const maxItems = extract.maxItems || config.parser.maxItemsPerPage;

  const { items } = parseHtml({
    html: fetched.html,
    url: fetched.source_info.final_url || url,
    selector,
    extract,
    maxItems
  });

  return {
    items,
    source_info: {
      ...fetched.source_info,
      selector: selector || extract.selector,
      total_items: items.length
    }
  };
}

export default parsePage;
