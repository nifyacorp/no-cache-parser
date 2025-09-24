# No-Cache Parser

Configurable parser microservice that ingests arbitrary web sources defined by user templates, enriches the content via Gemini, and emits notifications through the standard parser pipeline.

## Features
- Validates incoming requests with Zod and enforces SSRF guardrails (HTTPS only, configurable allow/deny lists).
- Fetches remote HTML with retry logic and parses it via Cheerio strategy helpers.
- Routes content to Google Gemini with configurable temperature/model parameters.
- Publishes results using the canonical parser Pub/Sub envelope (`subscription-worker` and `notification-worker` remain unchanged).

## Getting Started
```bash
npm install
npm run dev
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `8080`) |
| `PARSER_API_KEY` | Optional bearer token required by subscription-worker |
| `PUBSUB_TOPIC_NAME` | Target Pub/Sub topic for success payloads |
| `PUBSUB_DLQ_TOPIC_NAME` | Optional DLQ topic |
| `GOOGLE_CLOUD_PROJECT` | Required in Cloud Run when loading secrets |
| `GEMINI_API_KEY` | Google Generative AI API key |
| `GEMINI_MODEL` | Gemini model (default `models/gemini-1.5-pro-latest`) |
| `PARSER_ENFORCE_HTTPS` | Force HTTPS sources (default `true`) |
| `PARSER_ALLOWED_HOSTS` | Comma-separated host allowlist |
| `PARSER_BLOCKED_HOSTS` | Comma-separated host denylist |
| `PARSER_FETCH_TIMEOUT_MS` | Fetch timeout (default `15000`) |
| `PARSER_MAX_ITEMS_PER_PAGE` | Hard limit of extracted items per request (default `50`) |

### Request Contract
`POST /api/analyze-text`
```jsonc
{
  "texts": ["Monitor digital policy"],
  "subscription_id": "74be9b1c-...",
  "user_id": "93fb3c5e-...",
  "source": {
    "url": "https://example.org/news",
    "selector": "article"
  },
  "ai": {
    "temperature": 0.2,
    "maxOutputTokens": 4096
  },
  "metadata": {
    "template_id": "digital-policy",
    "source": { "url": "https://example.org/news" }
  }
}
```
- `texts` are the enriched prompts created by `subscription-worker`.
- `source` originates from the subscription template (`subscription_types.source_config`) merged with any per-subscription override.
- `ai` settings are optional overrides layered on top of the template defaults.

### Response
Returns the same envelope expected from other parser services:
```jsonc
{
  "trace_id": "...",
  "processor_type": "no-cache",
  "request": {
    "subscription_id": "...",
    "user_id": "...",
    "texts": ["..."]
  },
  "results": {
    "boe_info": {
      "publication_date": "2025-09-24",
      "source_url": "https://example.org/news"
    },
    "query_date": "2025-09-24",
    "results": [
      {
        "prompt": "Monitor digital policy",
        "matches": [
          { "title": "...", "summary": "...", "relevance_score": 92, "links": { "html": "..." } }
        ]
      }
    ],
    "source_info": {
      "fetched_url": "https://example.org/news",
      "total_items": 12
    }
  }
}
```

## Template Workflow Overview
1. Admins or power users create templates via the backend (`subscription_types` table) or the new frontend templates screen.
2. `subscription-worker` merges template `source_config` with a subscription-specific override and calls the parser endpoint with `source` + `ai` definitions.
3. `no-cache-parser` fetches, parses, and analyzes the content, publishing results to Pub/Sub for `notification-worker` to consume.

For the broader architecture refer to `docs/no-cache-parser-template-plan.md`.
