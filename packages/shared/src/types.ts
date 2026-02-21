// --- Union types ---

export type DocumentType =
  | "article"
  | "pdf"
  | "email"
  | "rss"
  | "bookmark"
  | "post";

export type DocumentLocation = "inbox" | "later" | "archive";

export type OriginType = "subscription" | "feed" | "manual";

export type ChannelType = "email" | "rss" | "api" | "extension";

export type IngestionStatus = "success" | "failure";

// --- User entity ---

export interface User {
  id: string;
  email: string;
  email_verified: number;
  slug: string;
  name: string | null;
  avatar_url: string | null;
  is_admin: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// --- Core entity interfaces ---
// D1 conventions: number for booleans, string for timestamps

export interface Document {
  id: string;
  user_id: string;
  type: DocumentType;
  url: string | null;
  title: string;
  author: string | null;
  author_url: string | null;
  site_name: string | null;
  excerpt: string | null;
  word_count: number;
  reading_time_minutes: number;
  cover_image_url: string | null;
  html_content: string | null;
  markdown_content: string | null;
  plain_text_content: string | null;
  location: DocumentLocation;
  is_read: number;
  is_starred: number;
  reading_progress: number;
  last_read_at: string | null;
  saved_at: string;
  published_at: string | null;
  lang: string | null;
  updated_at: string;
  deleted_at: string | null;
  source_id: string | null;
  origin_type: OriginType;
}

export interface DocumentEmailMeta {
  document_id: string;
  message_id: string | null;
  fingerprint: string | null;
  from_address: string;
  from_name: string | null;
  raw_headers: string | null;
  is_rejected: number;
  rejection_reason: string | null;
  needs_confirmation: number;
  delivery_attempts: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  pseudo_email: string;
  display_name: string;
  sender_address: string | null;
  sender_name: string | null;
  is_active: number;
  auto_tag_rules: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  document_id: string;
  filename: string | null;
  content_type: string;
  size_bytes: number;
  content_id: string | null;
  storage_key: string | null;
  created_at: string;
}

export interface Denylist {
  id: string;
  user_id: string;
  domain: string;
  reason: string | null;
  created_at: string;
}

export interface IngestionLog {
  id: string;
  user_id: string;
  event_id: string;
  document_id: string | null;
  channel_type: ChannelType;
  received_at: string;
  status: IngestionStatus;
  error_code: string | null;
  error_detail: string | null;
  attempts: number;
}

// --- Future entities (interfaces defined now, tables created in migration) ---

export interface Feed {
  id: string;
  user_id: string;
  feed_url: string;
  site_url: string | null;
  title: string;
  description: string | null;
  icon_url: string | null;
  last_fetched_at: string | null;
  fetch_interval_minutes: number;
  is_active: number;
  fetch_full_content: number;
  auto_tag_rules: string | null;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentPdfMeta {
  document_id: string;
  page_count: number;
  file_size_bytes: number;
  storage_key: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  document_id: string;
  text: string;
  note: string | null;
  color: string;
  position_selector: string | null;
  position_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedToken {
  id: string;
  user_id: string;
  token_hash: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface SavedView {
  id: string;
  user_id: string;
  name: string;
  query_ast_json: string;
  sort_json: string | null;
  is_system: number;
  pinned_order: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserPreferences {
  id: string;
  schema_version: number;
  theme: string;
  font_family: string | null;
  font_size: number | null;
  line_height: number | null;
  content_width: number | null;
  shortcut_map_json: string | null;
  view_mode_prefs_json: string | null;
  updated_at: string;
}

export interface UpdateUserPreferencesInput {
  theme?: string;
  font_family?: string | null;
  font_size?: number | null;
  line_height?: number | null;
  content_width?: number | null;
  shortcut_map_json?: string | null;
  view_mode_prefs_json?: string | null;
}

export interface IngestionReportDaily {
  user_id: string;
  report_date: string;
  total_events: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  computed_at: string;
}

// --- Join table types ---

export interface DocumentTag {
  document_id: string;
  tag_id: string;
}

export interface SubscriptionTag {
  subscription_id: string;
  tag_id: string;
}

export interface FeedTag {
  feed_id: string;
  tag_id: string;
}

export interface HighlightTag {
  highlight_id: string;
  tag_id: string;
}

export interface CollectionDocument {
  collection_id: string;
  document_id: string;
  sort_order: number;
  added_at: string;
}

// --- Input types (for create operations) ---

export interface CreateDocumentInput {
  id?: string;
  type: DocumentType;
  url?: string | null;
  title: string;
  author?: string | null;
  author_url?: string | null;
  site_name?: string | null;
  excerpt?: string | null;
  word_count?: number;
  reading_time_minutes?: number;
  cover_image_url?: string | null;
  html_content?: string | null;
  markdown_content?: string | null;
  plain_text_content?: string | null;
  location?: DocumentLocation;
  source_id?: string | null;
  origin_type: OriginType;
  published_at?: string | null;
  lang?: string | null;
}

export interface CreateEmailMetaInput {
  document_id: string;
  message_id?: string | null;
  fingerprint?: string | null;
  from_address: string;
  from_name?: string | null;
  raw_headers?: string | null;
  is_rejected?: number;
  rejection_reason?: string | null;
  needs_confirmation?: number;
  delivery_attempts?: number;
}

export interface CreateSubscriptionInput {
  id?: string;
  pseudo_email: string;
  display_name: string;
  sender_address?: string | null;
  sender_name?: string | null;
  is_active?: number;
  auto_tag_rules?: string | null;
}

export interface CreateIngestionLogInput {
  event_id: string;
  document_id?: string | null;
  channel_type: ChannelType;
  status: IngestionStatus;
  error_code?: string | null;
  error_detail?: string | null;
  attempts?: number;
}

export interface CreateAttachmentInput {
  id?: string;
  document_id: string;
  filename?: string | null;
  content_type: string;
  size_bytes: number;
  content_id?: string | null;
  storage_key?: string | null;
}

export interface CreateDenylistInput {
  domain: string;
  reason?: string | null;
}

export interface CreatePdfMetaInput {
  document_id: string;
  page_count: number;
  file_size_bytes: number;
  storage_key: string;
}

export interface CreateFeedInput {
  id?: string;
  feed_url: string;
  site_url?: string | null;
  title: string;
  description?: string | null;
  icon_url?: string | null;
  fetch_interval_minutes?: number;
  fetch_full_content?: number;
  auto_tag_rules?: string | null;
}

export interface UpdateFeedInput {
  title?: string;
  description?: string | null;
  icon_url?: string | null;
  fetch_interval_minutes?: number;
  is_active?: number;
  fetch_full_content?: number;
  auto_tag_rules?: string | null;
}

export interface FeedWithStats extends Feed {
  documentCount: number;
  unreadCount: number;
}

export interface CreateTagInput {
  name: string;
  color?: string | null;
  description?: string | null;
}

// --- API query / response types ---

export type SortField = "saved_at" | "published_at" | "title" | "reading_time_minutes";
export type SortDirection = "asc" | "desc";

export interface ListDocumentsQuery {
  status?: "read" | "unread";
  location?: DocumentLocation;
  tagId?: string;
  subscriptionId?: string;
  feedId?: string;
  type?: DocumentType;
  search?: string;
  sortBy?: SortField;
  sortDir?: SortDirection;
  cursor?: string;
  limit?: number;
  isStarred?: boolean;
  savedAfter?: string;
  savedBefore?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  total: number;
}

export interface DocumentWithTags extends Document {
  tags: Tag[];
  subscription?: Subscription;
  emailMeta?: DocumentEmailMeta;
}

export interface SubscriptionWithStats extends Subscription {
  documentCount: number;
  unreadCount: number;
}

export interface TagWithCount extends Tag {
  documentCount: number;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}

export interface CreateSavedViewInput {
  name: string;
  query_ast_json: string;
  sort_json?: string | null;
  is_system?: number;
  pinned_order?: number | null;
}

export interface UpdateSavedViewInput {
  name?: string;
  query_ast_json?: string;
  sort_json?: string | null;
  pinned_order?: number | null;
}

export interface ViewQueryAst {
  filters: ViewFilter[];
  combinator: "and" | "or";
}

export interface ViewFilter {
  field:
    | "type"
    | "location"
    | "is_read"
    | "is_starred"
    | "tag"
    | "source_id"
    | "author"
    | "domain"
    | "word_count"
    | "reading_time"
    | "saved_after"
    | "saved_before";
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "in";
  value: string | number | string[];
}

export interface ViewSortConfig {
  field: "saved_at" | "published_at" | "title" | "reading_time_minutes";
  direction: "asc" | "desc";
}

// --- Highlight types ---

export type HighlightColor = "#FFFF00" | "#90EE90" | "#87CEEB" | "#DDA0DD" | "#FF6B6B";

export interface PositionSelector {
  type: "TextPositionSelector";
  cssSelector: string;
  startOffset: number;
  endOffset: number;
  surroundingText: {
    prefix: string;
    exact: string;
    suffix: string;
  };
}

export interface CreateHighlightInput {
  id?: string;
  document_id: string;
  text: string;
  note?: string | null;
  color?: string;
  position_selector?: string | null;
  position_percent?: number;
}

export interface UpdateHighlightInput {
  text?: string;
  note?: string | null;
  color?: string;
}

export interface HighlightWithTags extends Highlight {
  tags: Tag[];
}

export interface HighlightWithDocument extends HighlightWithTags {
  document: Pick<Document, "id" | "title" | "url" | "author" | "type">;
}

// --- Collection types ---

export interface CreateCollectionInput {
  id?: string;
  name: string;
  description?: string | null;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
}

export interface CollectionWithCount extends Collection {
  documentCount: number;
}

export interface CollectionWithDocuments extends Collection {
  documents: (DocumentWithTags & { sort_order: number; added_at: string })[];
}

// --- Update input types ---

export interface UpdateDocumentInput {
  title?: string;
  location?: DocumentLocation;
  is_read?: number;
  is_starred?: number;
  reading_progress?: number;
  last_read_at?: string | null;
}

export interface UpdateSubscriptionInput {
  display_name?: string;
  is_active?: number;
  auto_tag_rules?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
  description?: string | null;
}
