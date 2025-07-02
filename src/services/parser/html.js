import cheerio from 'cheerio';
import crypto from 'crypto';

/**
 * Parse HTML content and return an array of items.
 * Each item represents a DOM element (e.g., article) matching `selector` or <body> fallback.
 *
 * @param {Object} params
 * @param {string} params.html         – HTML string
 * @param {string} params.url          – URL of the source page
 * @param {string} [params.selector]   – CSS selector to target specific elements
 *
 * @returns {{ items: Array<{id:string,title:string,content:string,url:string,date:string}> }}
 */
export function parseHtml({ html, url, selector }) {
  const $ = cheerio.load(html);
  const targetNodes = selector ? $(selector) : $('body');

  const items = [];

  // iterate through matched elements (may be single element if body)
  targetNodes.each((idx, el) => {
    const textContent = $(el).text().trim();
    if (!textContent) return;

    const id = crypto.createHash('sha256').update(textContent).digest('hex');
    const title = $(el).find('h1,h2,h3').first().text().trim().slice(0, 256) || `item-${idx + 1}`;

    items.push({
      id,
      title,
      content: textContent,
      url,
      date: new Date().toISOString()
    });
  });

  // Fallback – if selector/body produced no items, push full text as single item
  if (items.length === 0) {
    const textContent = $('body').text().trim();
    items.push({
      id: crypto.createHash('sha256').update(textContent).digest('hex'),
      title: 'page',
      content: textContent,
      url,
      date: new Date().toISOString()
    });
  }

  return { items };
} 