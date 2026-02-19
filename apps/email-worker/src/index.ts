import {
  emailToSubscriptionKey,
  slugToDisplayName,
  extractDomain,
  countWords,
  estimateReadingTime,
  MAX_RETRY_ATTEMPTS,
  evaluateAutoTagRules,
} from "@focus-reader/shared";
import type { AutoTagRule } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  scopeDb,
  getOrCreateSingleUser,
  createDocument,
  getDocument,
  createEmailMeta,
  getEmailMetaByMessageId,
  getEmailMetaByFingerprint,
  incrementDeliveryAttempts,
  createSubscription,
  getSubscriptionByEmail,
  getTagsForSubscription,
  addTagToDocument,
  logIngestionEvent,
  isDomainDenied,
  createAttachment,
} from "@focus-reader/db";
import {
  parseEmail,
  extractMessageId,
  computeFingerprint,
  validateEmail,
  isConfirmationEmail,
  sanitizeHtml,
  rewriteCidUrls,
  htmlToMarkdown,
  extractAttachmentMeta,
  extractCidAttachments,
} from "@focus-reader/parser";

export interface Env {
  FOCUS_DB: D1Database;
  FOCUS_STORAGE: R2Bucket;
  EMAIL_DOMAIN: string;
  COLLAPSE_PLUS_ALIAS: string;
  OWNER_EMAIL?: string;
  AUTH_MODE?: string;
}

async function withRetry<T>(
  maxAttempts: number,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Exponential backoff: 100ms, 400ms, 900ms
        const delay = attempt * attempt * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function streamToArrayBuffer(
  stream: ReadableStream
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
    }
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined.buffer;
}

async function resolveUserId(db: D1Database, env: Env): Promise<string> {
  // For now, resolve to the single/default user.
  // Phase 4 will add subdomain-based routing for multi-user mode.
  const email = env.OWNER_EMAIL || "owner@localhost";
  const user = await getOrCreateSingleUser(db, email);
  return user.id;
}

export default {
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const eventId = crypto.randomUUID();
    const collapsePlus = env.COLLAPSE_PLUS_ALIAS === "true";
    const db = env.FOCUS_DB;

    try {
      // Read raw stream once before retries (streams can only be consumed once)
      const rawBuffer = await streamToArrayBuffer(message.raw);

      // Pre-generate document ID before retries so R2 uploads and DB writes
      // use the same ID across attempts, preventing orphan objects and duplicates
      const documentId = crypto.randomUUID();

      // Resolve user for this email
      const userId = await resolveUserId(db, env);
      const ctx = scopeDb(db, userId);

      await withRetry(MAX_RETRY_ATTEMPTS, () =>
        processEmail(rawBuffer, message.to, env, ctx, eventId, collapsePlus, documentId)
      );
    } catch (err) {
      // Final failure after all retries
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      // Log with a temporary context for error logging
      const userId = await resolveUserId(db, env).catch(() => "00000000-0000-0000-0000-000000000000");
      const ctx = scopeDb(db, userId);
      await logIngestionEvent(ctx, {
        event_id: eventId,
        channel_type: "email",
        status: "failure",
        error_code: "PIPELINE_ERROR",
        error_detail: errorMessage,
        attempts: MAX_RETRY_ATTEMPTS,
      }).catch(() => {
        // Swallow logging errors to avoid masking the original
      });
    }
  },
} satisfies ExportedHandler<Env>;

async function processEmail(
  rawBuffer: ArrayBuffer,
  recipientAddress: string,
  env: Env,
  ctx: UserScopedDb,
  eventId: string,
  collapsePlus: boolean,
  documentId: string
): Promise<void> {
  const db = ctx.db;

  // Step 1: Parse MIME
  const parsed = await parseEmail(rawBuffer);

  // Step 2: Extract recipient and subscription key
  const subscriptionKey = emailToSubscriptionKey(
    recipientAddress,
    collapsePlus
  );

  // Step 3: Deduplicate (child entity queries use raw db)
  const messageId = extractMessageId(parsed.headers);

  if (messageId) {
    const existingByMsgId = await getEmailMetaByMessageId(db, messageId);
    if (existingByMsgId) {
      await incrementDeliveryAttempts(db, existingByMsgId.document_id);
      await logIngestionEvent(ctx, {
        event_id: eventId,
        document_id: existingByMsgId.document_id,
        channel_type: "email",
        status: "success",
      });
      return;
    }
  }

  const date = parsed.date ? new Date(parsed.date) : new Date();
  // Use text/plain for fingerprint; fall back to HTML body to avoid
  // false-collapsing distinct HTML-only emails into a single fingerprint
  const fingerprintBody = parsed.text || parsed.html || "";
  const fingerprint = await computeFingerprint(
    recipientAddress,
    parsed.from.address,
    parsed.subject,
    date,
    fingerprintBody
  );

  const existingByFp = await getEmailMetaByFingerprint(db, fingerprint);
  if (existingByFp) {
    await incrementDeliveryAttempts(db, existingByFp.document_id);
    await logIngestionEvent(ctx, {
      event_id: eventId,
      document_id: existingByFp.document_id,
      channel_type: "email",
      status: "success",
    });
    return;
  }

  // Step 4: Validate
  // Fetch denied domains from D1
  const senderDomain = extractDomain(
    `https://${parsed.from.address.split("@")[1] || ""}`
  );
  const deniedDomains: string[] = [];
  // Check if sender domain is denied
  if (senderDomain && (await isDomainDenied(ctx, senderDomain))) {
    deniedDomains.push(senderDomain);
  }
  const validation = validateEmail(parsed, deniedDomains);

  // Step 5: Detect confirmation
  const isConfirmation = isConfirmationEmail(parsed);

  // Step 6: documentId is pre-generated before the retry loop (passed in)
  // Check if a previous retry partially completed (document exists but email_meta doesn't)
  const existingDoc = await getDocument(ctx, documentId);
  if (existingDoc) {
    // Document was created by a previous attempt — check if email_meta exists
    const existingMeta = messageId
      ? await getEmailMetaByMessageId(db, messageId)
      : await getEmailMetaByFingerprint(db, fingerprint);
    if (existingMeta) {
      // Fully completed in a previous attempt, nothing to do
      return;
    }
    // Document exists but email_meta doesn't — skip to email_meta creation below
    // (handled by the INSERT OR IGNORE pattern on document creation)
  }

  // Step 7: Sanitize HTML
  const sanitizedHtml = parsed.html ? sanitizeHtml(parsed.html) : null;

  // Step 8: Upload CID images to R2
  const cidAttachments = extractCidAttachments(parsed.attachments);
  const cidMap = new Map<string, string>();

  for (const cidAtt of cidAttachments) {
    const storageKey = `attachments/${documentId}/${cidAtt.contentId}`;
    try {
      const body =
        typeof cidAtt.content === "string"
          ? new TextEncoder().encode(cidAtt.content)
          : new Uint8Array(cidAtt.content);
      await env.FOCUS_STORAGE.put(storageKey, body, {
        httpMetadata: { contentType: cidAtt.contentType },
      });
      cidMap.set(cidAtt.contentId, storageKey);
    } catch {
      // Log warning but continue -- broken refs are acceptable
      console.warn(
        `Failed to upload CID attachment ${cidAtt.contentId} for document ${documentId}`
      );
    }
  }

  // Step 9: Rewrite CID URLs
  const finalHtml =
    sanitizedHtml && cidMap.size > 0
      ? rewriteCidUrls(sanitizedHtml, documentId, cidMap)
      : sanitizedHtml;

  // Step 10: Convert to Markdown
  const markdownContent = finalHtml ? htmlToMarkdown(finalHtml) : null;

  // Step 11: Compute word count / reading time
  const plainText = parsed.text || markdownContent || "";
  const wordCount = countWords(plainText);
  const readingTime = estimateReadingTime(wordCount);

  // Step 12: Look up or auto-create subscription
  const pseudoEmail = `${subscriptionKey}@${env.EMAIL_DOMAIN}`;
  let subscription = await getSubscriptionByEmail(ctx, pseudoEmail);
  if (!subscription) {
    subscription = await createSubscription(ctx, {
      pseudo_email: pseudoEmail,
      display_name: slugToDisplayName(subscriptionKey),
      sender_address: parsed.from.address,
      sender_name: parsed.from.name || null,
    });
  }

  // Step 13: Create Document (skip if already exists from a partial retry)
  if (!existingDoc) {
    await createDocument(ctx, {
      id: documentId,
      type: "email",
      title: parsed.subject || "(No subject)",
      author: parsed.from.name || parsed.from.address,
      site_name: subscription.display_name,
      html_content: finalHtml,
      markdown_content: markdownContent,
      plain_text_content: parsed.text || null,
      word_count: wordCount,
      reading_time_minutes: readingTime,
      location: "inbox",
      origin_type: "subscription",
      source_id: subscription.id,
      published_at: parsed.date || null,
    });
  }

  // Step 14: Create EmailMeta (child entity — uses raw db)
  await createEmailMeta(db, {
    document_id: documentId,
    message_id: messageId,
    fingerprint,
    from_address: parsed.from.address,
    from_name: parsed.from.name || null,
    raw_headers: JSON.stringify(parsed.headers),
    is_rejected: validation.isRejected ? 1 : 0,
    rejection_reason: validation.rejectionReason,
    needs_confirmation: isConfirmation ? 1 : 0,
    delivery_attempts: 1,
  });

  // Step 15: Create Attachments (child entity — uses raw db)
  const allAttachmentMeta = extractAttachmentMeta(parsed.attachments);
  for (const att of allAttachmentMeta) {
    const cidStorageKey = att.contentId
      ? cidMap.get(att.contentId) || null
      : null;
    await createAttachment(db, {
      document_id: documentId,
      filename: att.filename,
      content_type: att.contentType,
      size_bytes: att.sizeBytes,
      content_id: att.contentId,
      storage_key: cidStorageKey,
    });
  }

  // Step 16a: Evaluate subscription auto-tag rules
  if (subscription.auto_tag_rules) {
    const rules: AutoTagRule[] = JSON.parse(subscription.auto_tag_rules);
    const matchedTagIds = evaluateAutoTagRules(rules, {
      title: parsed.subject || "(No subject)",
      author: parsed.from.name || parsed.from.address,
      url: null,
      plain_text_content: parsed.text || null,
      from_address: parsed.from.address,
    });
    for (const tagId of matchedTagIds) {
      await addTagToDocument(ctx, documentId, tagId);
    }
  }

  // Step 16: Inherit subscription tags
  const subTags = await getTagsForSubscription(ctx, subscription.id);
  for (const tag of subTags) {
    await addTagToDocument(ctx, documentId, tag.id);
  }

  // Step 17: Log ingestion
  await logIngestionEvent(ctx, {
    event_id: eventId,
    document_id: documentId,
    channel_type: "email",
    status: "success",
  });
}
