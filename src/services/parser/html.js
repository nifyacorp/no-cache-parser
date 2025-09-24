import cheerio from 'cheerio';
import crypto from 'crypto';
import config from '../../config/config.js';

function extractFieldValue($context, field = {}) {
  const { selector, attr = 'text', fallback } = field;
  if (!selector) {
    return fallback || '';
  }

  const node = $context.find(selector).first();
  if (!node || node.length === 0) {
    return fallback || '';
  }

  if (attr === 'text') return node.text().trim();
  if (attr === 'html') return node.html()?.trim() || '';
  return node.attr(attr) || fallback || '';
}

function normalizeLinks(item, $element) {
  const link = $element.find('a[href]').first();
  const href = link.attr('href');
  if (!href) return { html: item.url }; // fallback to source URL

  try {
    const resolved = new URL(href, item.url).toString();
    return { html: resolved };
  } catch (err) {
    return { html: item.url };
  }
}

function clampContent(content, maxChars) {
  if (!content) return '';
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}…`;
}

/**
 * Parse HTML content and return an array of items.
 * Each item represents a DOM element (e.g., article) matching `selector` or <body> fallback.
 *
 * @param {Object} params
 * @param {string} params.html         – HTML string
 * @param {string} params.url          – URL of the source page
 * @param {string} [params.selector]   – CSS selector to target specific elements
 * @param {Object} [params.extract]    – extraction instructions (fields, maxItems, etc.)
 * @param {number} [params.maxItems]   – hard limit on extracted items
 *
 * @returns {{ items: Array<{id:string,title:string,content:string,url:string,date:string,summary:string,links:Object}> }}
 */
export function parseHtml({ html, url, selector, extract = {}, maxItems }) {
  const $ = cheerio.load(html);
  const primarySelector = selector || extract.selector;
  let targetNodes = primarySelector ? $(primarySelector) : $('body');

  if (!primarySelector && targetNodes.length === 1) {
    // attempt to expand using fallback selectors to split page into items
    targetNodes = $(config.parser.fallbackSelector);
  }

  const items = [];
  const limit = Math.min(maxItems || Infinity, config.parser.maxItemsPerPage);

  targetNodes.each((idx, el) => {
    if (items.length >= limit) return false; // break

    const $el = $(el);
    const textContent = $el.text().replace(/\s+/g, ' ').trim();
    if (!textContent) return; // skip empty nodes

    const fields = Array.isArray(extract.fields) ? extract.fields : [];
    const extracted = fields.reduce((acc, field) => {
      if (!field?.name) return acc;
      acc[field.name] = extractFieldValue($el, field);
      return acc;
    }, {});

    const hashBase = `${textContent.slice(0, 1024)}::${url}`;
    const id = crypto.createHash('sha256').update(hashBase).digest('hex');

    const defaultTitle = $el.find('h1,h2,h3').first().text().trim();
    const content = extracted.content || textContent;

    const item = {
      id,
      url,
      title: extracted.title || defaultTitle || `item-${items.length + 1}`,
      summary: extracted.summary || clampContent(textContent, 320),
      content,
      date: extracted.date || new Date().toISOString(),
      section: extracted.section || '',
      category: extracted.category || '',
      raw: extract.includeRawHtml ? $el.html() : undefined
    };

    item.links = extracted.links
      ? extracted.links
      : normalizeLinks(item, $el);

    items.push(item);
    return undefined;
  });

  if (items.length === 0) {
    const textContent = $('body').text().trim();
    const id = crypto.createHash('sha256').update(`${textContent.slice(0, 1024)}::${url}`).digest('hex');
    items.push({
      id,
      url,
      title: 'page',
      summary: clampContent(textContent, 320),
      content: clampContent(textContent, config.ai.maxCharactersPerItem),
      date: new Date().toISOString(),
      links: { html: url }
    });
  }

  const normalized = items.map(item => ({
    ...item,
    content: clampContent(item.content, config.ai.maxCharactersPerItem),
    summary: clampContent(item.summary, 320)
  }));

  return { items: normalized.slice(0, limit) };
}

export default parseHtml;
