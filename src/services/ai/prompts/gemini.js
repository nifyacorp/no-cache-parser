function renderItemsForPrompt(items) {
  return JSON.stringify(
    items.map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      url: item.links?.html || item.url,
      date: item.date,
      section: item.section || item.category || ''
    })),
    null,
    2
  );
}

export function createSystemPrompt(userPrompt) {
  return `You are an analyst that reads arbitrary web content provided by subscription templates.
The goal is to find the most relevant snippets for the user query below.

User query: "${userPrompt}".

Guidelines:
1. Analyse the supplied documents carefully.
2. Score potential matches from 0 to 100 based on how well they answer the user query.
3. Only return matches with a relevance score >= 60.
4. Each match must include: document_type (best-effort), title, notification_title, summary (<= 280 chars), relevance_score (0-100), accuracy_score (0-100), links.html, and optional metadata (issuing_body, section, date).
5. Respond with valid JSON only, no commentary.`;
}

export function createContentPrompt(items, userPrompt, totalCount) {
  return `Documents provided (${items.length} of ${totalCount} total):
${renderItemsForPrompt(items)}

For each entry, evaluate relevance for query "${userPrompt}" and follow the response schema strictly.`;
}

export default {
  createSystemPrompt,
  createContentPrompt
};
