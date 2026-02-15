CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  doc_id UNINDEXED,
  title,
  author,
  plain_text_content,
  tokenize='porter unicode61'
);

-- Backfill existing documents
INSERT INTO document_fts(doc_id, title, author, plain_text_content)
SELECT id, title, COALESCE(author, ''), COALESCE(plain_text_content, '')
FROM document WHERE deleted_at IS NULL;
