# No-Cache Parser & Template Sharing MVP Plan

## 1. Objectives
- Deliver a configurable parser microservice (`no-cache-parser`) that accepts runtime source definitions, runs Gemini analysis, and publishes the same Pub/Sub envelope used by existing parsers so `notification-worker` remains untouched.
- Enable end users to create, edit, and share subscription templates (private/shared/public) without breaking current subscription flows.
- Extend the database, backend API, and frontend admin UI so templates can be stored, discovered, and executed through the existing pipeline `frontend → backend → subscription-worker → no-cache-parser → notification-worker`.

## 2. Current Baseline
- `boe-parser`, `doga-parser`, etc. expose `/api/analyze-text`, fetch a fixed source, call Gemini, and publish results to Pub/Sub.
- `subscription-worker` loads `subscriptions` joined with `subscription_types`, builds parser requests, and expects parser responses shaped like `boe-parser` output.
- The database already has `subscription_types.visibility` and `owner_user_id` columns but lacks structured storage for dynamic parser configuration.
- The frontend admin has basic create/list screens for subscription types but no UX for template-specific configuration (URL, selectors) or sharing workflows.

## 3. Parser Service Enhancements (no-cache-parser)
### 3.1 Request Contract (HTTP POST `/api/analyze-text`)
```jsonc
{
  "texts": ["Find climate updates", "AI regulations"],
  "subscription_id": "uuid",
  "user_id": "uuid",
  "source": {
    "url": "https://example.com/news",
    "selector": "article",
    "extract": {
      "mode": "html",        // future: rss, json
      "fields": [
        { "name": "title", "selector": "h1", "attr": "text" },
        { "name": "summary", "selector": "p", "attr": "text" }
      ]
    }
  },
  "ai": {
    "provider": "gemini",
    "model": "models/gemini-1.5-pro-latest",
    "temperature": 0.2
  },
  "metadata": { "template_id": "slug", "source": {"url": "..."} }
}
```
- `subscription-worker` will send `source` derived from the template definition (section 4).
- `no-cache-parser` must tolerate legacy requests that only pass `metadata.source` for backward compatibility.

### 3.2 Processing Pipeline
1. **Input validation** (Zod schema mirroring contract above) and authentication middleware (reuse `PARSER_API_KEY`).
2. **Trace ID** generation + structured logging with `request_id` for observability.
3. **Fetcher** (`services/fetcher/httpFetcher.js`)
   - Axios with retry (3× exponential backoff), timeout, `User-Agent` override, gzip support.
   - Capture response metadata (`status`, `content-length`, `last-modified`) for downstream logging.
4. **Parser strategies** (`services/parser`)
   - MVP: HTML extraction using Cheerio; optional CSS selector from template. Auto-split content into items (e.g., by `<article>`, `<li>`, fallback: treat full body as single item).
   - Future hooks for RSS/JSON by adding `mode` switch.
5. **AI analysis** (`services/ai`)
   - Implement `analyzeGenericItems` by delegating to `services/ai/gemini.js` (port from `boe-parser` with generic prompts).
   - Aggregate matches per prompt, include `relevance_score`, `summary`, `links`, `metadata.token_usage`.
6. **Response**: Build payload matching `BoeParserResultMessage` contract with neutral naming (`processor_type: 'no-cache'`).
7. **Pub/Sub publish**: Reuse util to publish to `config.services.pubsub.topicId`, include `status:'success'|'error'`, and on failure publish error envelope.
8. **Observability**: emit structured logs + optional Cloud Monitoring metrics (`processing_time_ms`, `items_processed`, `llm_tokens`).

### 3.3 Error Handling Matrix
| Scenario | HTTP | Pub/Sub status | Retry |
|----------|------|----------------|-------|
| Fetch timeout/5xx | 504 | `status:error`, `reason:fetch_failed` | Retry (fetcher handles)
| Selector returns no items | 422 | `status:error`, `reason:no_items` | No (user must adjust template)
| Gemini quota/429 | 503 | `status:error`, `reason:ai_quota` | Respect `Retry-After`
| Unexpected | 500 | `status:error`, include stack hash | No

### 3.4 Configuration & Secrets
- Env vars: `PORT`, `PARSER_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `PUBSUB_PROJECT_ID`, `PUBSUB_TOPIC_ID`, `NODE_ENV`.
- Local dev uses `.env` (ignored) and `npm run dev` with nodemon.
- Cloud Run uses Secret Manager for API keys, same pattern as other parsers.

## 4. Subscription Template Management
### 4.1 Data Model Changes (Postgres / Supabase)
1. **`subscription_types` table** (repurpose as template registry)
   - New columns:
     - `parser_service` (`text`, NOT NULL, default `'boe-parser'`) – identifies downstream microservice.
     - `source_config` (`jsonb`, default `'{}'`) – canonical template definition sent to parsers.
     - `prompt_defaults` (`jsonb`, default `'[]'`) – recommended prompts.
     - `ai_settings` (`jsonb`, default `'{}'`) – temperature/model overrides.
     - `tags` (`text[]`, default `'{}'`) – optional discoverability metadata.
   - Maintain existing `owner_user_id`, `visibility ('private'|'shared'|'public')`, `service_url` (defaults to env for parser) and `metadata` (free-form extras).
   - Indexes:
     - `idx_subscription_types_visibility` on `(visibility)` for public catalog.
     - `idx_subscription_types_owner_visibility` on `(owner_user_id, visibility)`.

2. **`subscriptions` table**
   - New column `config_override jsonb default '{}'` to capture per-user adjustments (custom selectors, prompt tweaks).
   - Ensure migration backfills existing rows with `{}`.

3. **Helper view** `public.subscription_templates_catalog` (optional) that filters `visibility = 'public'` and exposes basic fields for frontend search.

### 4.2 Backend API (Fastify)
- Module: `src/interfaces/http/subscriptionTemplates`
  - `GET /subscription-templates` – paginated list with filters (`visibility`, `owner`, `tags`, search by name/description`). Public endpoint for catalog; private templates require auth & ownership.
  - `POST /subscription-templates` – create template; requires auth; validates payload; auto-generate `id` slug (kebab-case of name + short nanoid) to keep compatibility with existing type IDs.
  - `GET /subscription-templates/:id` – detail with `source_config`, `prompt_defaults`, `ai_settings`.
  - `PATCH /subscription-templates/:id` – update fields; enforce ownership unless admin.
  - `POST /subscription-templates/:id/visibility` – toggle `private/shared/public` (allow admins to publish to public catalog).
  - `POST /subscription-templates/:id/clone` – optional helper to let users fork a public template (creates new row owned by caller with new ID).
- Reuse existing repositories (`SubscriptionTypeRepository`) but extend them to read/write new columns and enforce row-level security through service layer.
- Validation layer: create Zod schemas under `backend/src/interfaces/http/http-schema/subscriptionTemplates` to mirror request/response contracts.

### 4.3 Frontend Admin UX (Vite + React)
1. **Pages**
   - `pages/SubscriptionTemplates.tsx` – list / filter templates (merge with existing `SubscriptionTypes` or new page).
   - `pages/CreateSubscriptionTemplate.tsx` – form capturing Name, Description, Visibility, Source URL, optional CSS selector, default prompts (chips), tags, AI model.
   - `pages/EditSubscriptionTemplate.tsx` – edit existing template, including toggling visibility; show warnings before publishing.
   - Update `CreateSubscription.tsx` to allow selecting a template from catalog; when selected, pre-fill prompts and show source preview.
2. **Components**
   - `components/templates/SourceConfigForm.tsx` – fields for URL, selector, extraction mode.
   - `components/templates/PromptListInput.tsx` – chips-based prompt editor.
   - `components/templates/VisibilityBadge.tsx` – indicates private/shared/public.
3. **State & API hooks**
   - Extend `frontend/src/api/subscriptionTypes.ts` (or create new `subscriptionTemplates.ts`) with CRUD functions calling backend endpoints.
   - `hooks/useSubscriptionTypes` evolves into `useSubscriptionTemplates` returning create/update/delete/list queries (React Query).
4. **Access control**
   - Only template owner or admins see edit/delete buttons.
   - Public templates accessible read-only to all authenticated users; show "Add to my subscriptions" CTA.

### 4.4 Subscription Creation & Execution Flow
1. **Frontend**: When user subscribes, persist `subscription` row referencing template `type_id`, store user-specific overrides in `metadata` and `config_override`.
2. **Backend**: Adjust subscription creation endpoint to validate template exists + visibility allows usage (public or shared within tenant/organisation). Merge `source_config` + overrides before persisting.
3. **subscription-worker**:
   - Update repository query to fetch `parser_service`, `source_config`, `prompt_defaults`, `ai_settings`, `config_override`.
   - Compose parser URL: use template `service_url` if present; fallback to env (`NO_CACHE_PARSER_URL`).
   - Merge configs: `const source = deepMerge(template.source_config, subscription.config_override?.source || {})`.
   - Build request payload with `texts` (enhanced prompts or `subscription.prompts`), `source`, `ai`, `metadata.template_id`.
   - Maintain backward compatibility for fixed parsers (boe/doga) by gating on `parser_service` value.
4. **no-cache-parser**: accept `source` + `ai` data; respond with generic matches; publish message identical to `boe` schema (but `processor_type:'no-cache'`).
5. **notification-worker**: no changes; continues to consume matches.

## 5. Implementation Phases & Ownership
| Phase | Scope | Owners | Dependencies |
|-------|-------|--------|--------------|
| 1 | Finalise DB migrations (`subscription_types`, `subscriptions`), update Supabase schema docs. | Backend | Migration testing |
| 2 | Extend backend repositories/services + expose template CRUD endpoints. | Backend | Phase 1 |
| 3 | Frontend UI for template CRUD & catalog; integrate API hooks. | Frontend | Phase 2 |
| 4 | subscription-worker updates (merge configs, send `source`, handle `parser_service` flag). | Worker team | Phase 1,2 |
| 5 | no-cache-parser AI + fetch pipeline, error handling, Pub/Sub integration. | Parser team | Parallel (requires Phase 4 contract) |
| 6 | End-to-end testing (manual + automated), update docs, readiness review. | QA/All | Phase 3-5 |

## 6. Testing & Verification
- **Unit Tests**
  - Parser: fetcher retries, HTML parsing with selectors, Gemini response normalization.
  - Backend: template validation, visibility rules, merging configs.
  - Frontend: form validation (React Testing Library), API hook mocks.
- **Integration Tests**
  - subscription-worker → no-cache-parser (use nock for HTTP + Pub/Sub emulator).
  - Backend template creation + subscription creation scenarios.
- **Manual QA**
  - Create private template, subscribe, ensure parser receives correct config.
  - Publish template to public catalog, clone as another user.
  - Error paths: invalid selector, Gemini quota (simulate), ensure notifications skip or report gracefully.
- **Tooling**
  - Add fixtures under `testing-tools/templates/` capturing example template JSON.
  - Document curl examples in `docs/api/subscription-templates.md` (new file).

## 7. Documentation & Rollout
- Update `supabase/current_schema.md` after migrations and add migration scripts under `backend/supabase/migrations/`.
- Create onboarding doc for template authors describing JSON schema (`docs/subscription-templates-authoring.md`).
- Update `no-cache-parser/README.md` with new request contract, env vars, and development steps.
- Communicate rollout plan: start with internal beta (`visibility='shared'`), monitor metrics, then open public catalog.

## 8. Risks & Mitigations
- **Selector brittleness**: Provide preview tools in frontend and fallback instructions; consider adding future auto-suggestion via AI.
- **AI cost spikes**: Enforce `max_items` + `limit` per request; surface usage metrics to admins.
- **Security (SSRF)**: Implement URL allowlist/denylist in backend, restrict to https, optional HEAD preflight.
- **Visibility misuse**: Audit logs when templates change visibility; require admin approval for `public`.
- **Backward compatibility**: Gate new logic by `parser_service === 'no-cache'`; legacy parser types remain unchanged.

## 9. Next Steps After MVP
- Add versioning/drafts for templates (track breaking changes).
- Support additional extractor strategies (RSS, JSON API) and scheduling options per template.
- Provide template marketplace landing page with tagging, ratings, and analytics.
- Implement LLM-assisted template creation (auto-determine selectors + sample prompts).
