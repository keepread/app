import { pollDueFeeds, processEnrichmentJob } from "@focus-reader/api";
import type { EnrichmentIntent } from "@focus-reader/api";
import type { ExtractionEnrichmentJob } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";

export interface Env {
  FOCUS_DB: D1Database;
  EXTRACTION_QUEUE?: Queue<ExtractionEnrichmentJob>;
  BROWSER_RENDERING_ENABLED?: string;
  BROWSER_RENDERING_ACCOUNT_ID?: string;
  BROWSER_RENDERING_API_TOKEN?: string;
  BROWSER_RENDERING_TIMEOUT_MS?: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const db = env.FOCUS_DB;
    const queue = env.EXTRACTION_QUEUE ?? null;

    const onLowQuality = queue
      ? async (intent: EnrichmentIntent) => {
          try {
            await queue.send({
              job_id: crypto.randomUUID(),
              user_id: intent.userId,
              document_id: intent.documentId,
              url: intent.url,
              source: intent.source,
              attempt: 1,
              enqueued_at: new Date().toISOString(),
            });
            console.log(JSON.stringify({
              event: "ENRICHMENT_QUEUED",
              document_id: intent.documentId,
              source: intent.source,
              score: intent.score,
            }));
          } catch (err) {
            console.warn("Enrichment enqueue failed (non-fatal):", err);
          }
        }
      : undefined;

    const results = await pollDueFeeds(db, undefined, onLowQuality);

    const processed = results.filter((r) => r.success).length;
    const errors = results.length - processed;
    console.log(
      `RSS poll complete: ${processed} feeds processed, ${errors} errors`
    );
  },

  async queue(
    batch: MessageBatch,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    if (env.BROWSER_RENDERING_ENABLED !== "true") {
      for (const msg of batch.messages) msg.ack();
      return;
    }

    const renderConfig = {
      enabled: true,
      accountId: env.BROWSER_RENDERING_ACCOUNT_ID!,
      apiToken: env.BROWSER_RENDERING_API_TOKEN!,
      timeoutMs: parseInt(env.BROWSER_RENDERING_TIMEOUT_MS || "12000", 10),
    };

    for (const msg of batch.messages) {
      const job = msg.body as ExtractionEnrichmentJob;
      try {
        const ctx = scopeDb(env.FOCUS_DB, job.user_id);
        const outcome = await processEnrichmentJob(ctx, job, renderConfig);
        console.log(JSON.stringify({
          event: `ENRICHMENT_${outcome.status.toUpperCase()}`,
          document_id: job.document_id,
          source: job.source,
          score_before: outcome.scoreBefore,
          score_after: outcome.scoreAfter,
          render_latency_ms: outcome.renderLatencyMs,
          attempt: job.attempt,
        }));
        msg.ack();
      } catch (err) {
        console.warn(`Enrichment job failed (retry): ${(err as Error).message}`);
        msg.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;
