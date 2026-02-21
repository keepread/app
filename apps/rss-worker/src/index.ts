import { pollDueFeeds, processEnrichmentJob, cacheDocumentCoverImage } from "@focus-reader/api";
import type { EnrichmentIntent } from "@focus-reader/api";
import type { ExtractionEnrichmentJob } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";

export interface Env {
  FOCUS_DB: D1Database;
  FOCUS_STORAGE: R2Bucket;
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

    const onCoverImage = queue
      ? async (userId: string, documentId: string) => {
          try {
            await queue.send({
              job_id: crypto.randomUUID(),
              user_id: userId,
              document_id: documentId,
              url: "",
              source: "rss_full_content",
              attempt: 1,
              enqueued_at: new Date().toISOString(),
              job_type: "image_cache",
            });
            console.log(JSON.stringify({
              event: "IMAGE_CACHE_QUEUED",
              document_id: documentId,
            }));
          } catch (err) {
            console.warn("Image cache enqueue failed (non-fatal):", err);
          }
        }
      : undefined;

    const results = await pollDueFeeds(db, undefined, onLowQuality, onCoverImage);

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
    for (const msg of batch.messages) {
      const job = msg.body as ExtractionEnrichmentJob;
      const jobType = job.job_type || "enrichment";

      if (jobType === "image_cache") {
        try {
          const ctx = scopeDb(env.FOCUS_DB, job.user_id);
          const result = await cacheDocumentCoverImage(ctx, env.FOCUS_STORAGE, job.document_id);
          console.log(JSON.stringify({
            event: `IMAGE_CACHE_${result.status.toUpperCase()}`,
            document_id: job.document_id,
          }));
          msg.ack();
        } catch (err) {
          console.warn(`Image cache job failed (retry): ${(err as Error).message}`);
          msg.retry();
        }
        continue;
      }

      // Enrichment jobs require browser rendering
      if (env.BROWSER_RENDERING_ENABLED !== "true") {
        msg.ack();
        continue;
      }

      const renderConfig = {
        enabled: true,
        accountId: env.BROWSER_RENDERING_ACCOUNT_ID!,
        apiToken: env.BROWSER_RENDERING_API_TOKEN!,
        timeoutMs: parseInt(env.BROWSER_RENDERING_TIMEOUT_MS || "12000", 10),
      };

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

        // Cache cover image after successful enrichment
        if (outcome.status === "applied") {
          try {
            await cacheDocumentCoverImage(ctx, env.FOCUS_STORAGE, job.document_id);
          } catch {
            // Non-fatal: image caching failure doesn't affect enrichment
          }
        }

        msg.ack();
      } catch (err) {
        console.warn(`Enrichment job failed (retry): ${(err as Error).message}`);
        msg.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;
