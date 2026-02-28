# Email Worker Pipeline

`apps/email-worker/src/index.ts` ingests forwarded newsletters into user-scoped documents.

## Pipeline

1. Read raw stream once into `ArrayBuffer`
2. Resolve routing from recipient address (`parseToAddressRoute`) to user slug + optional alias tag
3. Build `UserScopedDb` context with `scopeDb`
4. Parse MIME via `parseEmail`
5. Deduplicate by message ID, then fingerprint
6. Validate sender/domain against denylist and body quality checks
7. Detect confirmation-email candidates
8. Sanitize HTML content
9. Upload CID attachments to R2 and rewrite inline CID URLs
10. Convert to markdown and compute reading stats
11. Resolve or create subscription
12. Create document + email metadata + attachment metadata
13. Apply inherited subscription tags + optional alias auto-tagging
14. Log ingestion outcome

The full processing block is wrapped by retry with exponential backoff.

## Multi-Tenant Behavior

- Worker resolves target user before document creation
- All primary operations execute using `UserScopedDb`
- Inbound address format supports user slug routing in multi-user mode

## Implementation Pitfalls

- `postal-mime` attachment content can be `string | ArrayBuffer`
- `contentId` often includes angle brackets; normalize before CID map use
- Streams are single-consume; retries must reuse buffered payload
- Failures should still attempt ingestion-log writes without masking original errors
