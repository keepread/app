import type {
  DocumentType,
  DocumentLocation,
  OriginType,
  ChannelType,
  IngestionStatus,
} from "./types.js";

// Enum arrays
export const DOCUMENT_TYPES: DocumentType[] = [
  "article",
  "pdf",
  "email",
  "rss",
  "bookmark",
  "post",
];

export const DOCUMENT_LOCATIONS: DocumentLocation[] = [
  "inbox",
  "later",
  "archive",
];

export const ORIGIN_TYPES: OriginType[] = ["subscription", "feed", "manual"];

export const CHANNEL_TYPES: ChannelType[] = [
  "email",
  "rss",
  "api",
  "extension",
];

export const INGESTION_STATUSES: IngestionStatus[] = ["success", "failure"];

// Defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_RETRY_ATTEMPTS = 3;
export const READING_PROGRESS_THRESHOLD = 0.9;

// Sort options for the document list UI
export const SORT_OPTIONS = [
  { value: "saved_at", label: "Date saved", defaultDir: "desc" as const },
  { value: "published_at", label: "Date published", defaultDir: "desc" as const },
  { value: "title", label: "Title A\u2013Z", defaultDir: "asc" as const },
  { value: "reading_time_minutes", label: "Reading time", defaultDir: "asc" as const },
] as const;

// Known email tracking pixel domains
export const TRACKER_DOMAINS = [
  "list-manage.com",
  "open.substack.com",
  "email.mg1.substack.com",
  "clicks.beehiiv.com",
  "track.mailerlite.com",
  "pixel.mailchimp.com",
  "mandrillapp.com",
  "sendgrid.net",
  "sparkpostmail.com",
  "mailgun.org",
  "ct.sendgrid.net",
  "links.buttondown.email",
  "convertkit-mail.com",
  "email-open-log.convertkit.com",
  "tr.sendinblue.com",
  "post.spmailtechnol.com",
];

// Subject line keywords for confirmation email detection
export const CONFIRMATION_KEYWORDS = [
  "confirm",
  "verify",
  "activate",
  "validate",
  "opt-in",
  "optin",
  "double opt-in",
  "subscription confirmation",
  "confirm your email",
  "verify your email",
  "confirm your subscription",
  "please confirm",
  "action required",
];
