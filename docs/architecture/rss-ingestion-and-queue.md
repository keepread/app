# RSS Ingestion and Queue

## RSS Scheduled Polling

`apps/rss-worker` scheduled trigger polls due feeds and ingests new items.

High-level flow:

1. Load due feeds (admin query)
2. Process each feed in user-scoped context
3. Create RSS documents and inherit feed tags
4. Record ingestion events and poll health

## Enrichment Queue

Low-quality extraction and image-cache work are queued to `EXTRACTION_QUEUE`.

Queue job types:

- `enrichment` (default): browser-rendering-based enrichment
- `image_cache`: cover image fetch/store job

Queue consumer lives in `apps/rss-worker` and acks/retries jobs.

## Browser Rendering

Enrichment jobs are executed only when `BROWSER_RENDERING_ENABLED=true`.

Relevant env vars:

- `BROWSER_RENDERING_ACCOUNT_ID`
- `BROWSER_RENDERING_API_TOKEN`
- `BROWSER_RENDERING_TIMEOUT_MS`

## Key Files

- `apps/rss-worker/src/index.ts`
- `packages/api/src/feed-polling.ts`
- `packages/api/src/enrichment-consumer.ts`
- `packages/api/src/browser-rendering-client.ts`
