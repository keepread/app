import type { EnrichmentIntent } from "@focus-reader/api";
import { getExtractionQueue } from "@/lib/bindings";

export interface FeedPollingQueueCallbacks {
  onLowQuality?: (intent: EnrichmentIntent) => void | Promise<void>;
  onCoverImage?: (userId: string, documentId: string) => void | Promise<void>;
}

export async function createFeedPollingQueueCallbacks(): Promise<FeedPollingQueueCallbacks> {
  const queue = await getExtractionQueue();
  if (!queue) {
    return {};
  }

  const onLowQuality = async (intent: EnrichmentIntent) => {
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
  };

  const onCoverImage = async (userId: string, documentId: string) => {
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
  };

  return { onLowQuality, onCoverImage };
}
