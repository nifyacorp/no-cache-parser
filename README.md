# No-Cache Parser

Configurable generic parser for user-defined subscription types.

## Quick start
```bash
# build & run locally
npm install
npm start
```

Environment variables:
- `PORT` (default 8080)
- `PARSER_API_KEY` (optional auth)
- `DATABASE_URL` (optional Postgres read-only conn, used to resolve subscription type metadata)
- `PUBSUB_TOPIC_NAME` (required) / `PUBSUB_DLQ_TOPIC_NAME`
- `GOOGLE_CLOUD_PROJECT` (production)

Deploy to Cloud Run as any other parser service.

Endpoint: `POST /api/analyze-text` identical to BOE parser contract **but** for custom types the orchestrator must include a `source` object, e.g.:

```jsonc
{
  "texts": ["my prompt"],
  "subscription_id": "my-sub-type",
  "source": { "url": "https://example.com/feed" }
}
```

For details see `docs/custom_template_parser_backend_plan.md`. 