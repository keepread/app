/**
 * Reading-mode pipeline integration test.
 * Fetches live URLs, runs the extraction + quality-scoring pipeline,
 * and optionally re-extracts via Cloudflare Browser Rendering when
 * static fetch quality is low — mirroring the enrichment path in prod.
 *
 * Required env vars (add to .dev.vars — see .dev.vars.example):
 *   BROWSER_RENDERING_ENABLED   - "true" to enable rendered fetches
 *   BROWSER_RENDERING_ACCOUNT_ID - Cloudflare account ID
 *   BROWSER_RENDERING_API_TOKEN  - Cloudflare API token
 *   BROWSER_RENDERING_TIMEOUT_MS - timeout for rendered fetch (default 12000)
 *
 * Usage:
 *   pnpm test:reading-mode-pipeline
 */

import { readFile } from "node:fs/promises";
import { extractArticle, extractMetadata } from "../packages/parser/src/index.js";
import {
  fetchRenderedHtml,
  BrowserRenderingError,
  scoreExtraction,
  shouldEnrich,
  isImprovement,
} from "../packages/api/src/index.js";
import type { ExtractionScoreInput } from "../packages/api/src/extraction-quality.js";

// ── ANSI helpers ────────────────────────────────────────────────────
const useColor = !process.env.NO_COLOR;
const s = (code: string) => (useColor ? code : "");
const a = {
  reset:  s("\x1b[0m"),
  bold:   s("\x1b[1m"),
  dim:    s("\x1b[2m"),
  green:  s("\x1b[32m"),
  red:    s("\x1b[31m"),
  yellow: s("\x1b[33m"),
  cyan:   s("\x1b[36m"),
};

// ── Types ───────────────────────────────────────────────────────────
interface UrlCheck {
  url: string;
  minWords?: number;
  expectTitleNotUrl?: boolean;
}

interface ExtractionResult {
  title: string;
  score: number;
  wordCount: number;
  htmlLength: number;
  readabilitySucceeded: boolean;
}

interface Report {
  url: string;
  static: ExtractionResult | null;
  rendered: ExtractionResult | null;
  shouldEnrichFromStatic: boolean;
  usedRendered: boolean;
  pass: boolean;
  reasons: string[];
  error: string | null;
}

// ── CLI arg parsing ─────────────────────────────────────────────────
function getArgValue(name: string): string | null {
  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx < 0) return null;
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

// ── Fetch with timeout ──────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(message));
      });
    }),
  ]);
}

async function fetchPageHtml(url: string, timeoutMs: number): Promise<string> {
  const promise = fetch(url, {
    headers: {
      "User-Agent": "FocusReaderHarness/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  const response = await withTimeout(
    promise,
    timeoutMs,
    `Fetch timeout after ${timeoutMs}ms`,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

// ── Extraction ──────────────────────────────────────────────────────
function runExtraction(html: string, url: string): ExtractionResult {
  const article = extractArticle(html, url);
  const meta = extractMetadata(html, url);
  const title = article.title || meta.title || url;
  const plainText =
    article.markdownContent?.replace(/[#*_`\[\]()>~-]/g, "").trim() || null;

  const input: ExtractionScoreInput = {
    title,
    url,
    htmlContent: article.htmlContent || null,
    plainTextContent: plainText,
    author: article.author || meta.author,
    siteName: article.siteName || meta.siteName,
    publishedDate: meta.publishedDate,
    coverImageUrl: meta.ogImage,
    excerpt: article.excerpt || meta.description,
    wordCount: article.wordCount,
    readabilitySucceeded: article.readabilitySucceeded,
  };
  const score = scoreExtraction(input);

  return {
    title,
    score,
    wordCount: article.wordCount,
    htmlLength: article.htmlContent.length,
    readabilitySucceeded: article.readabilitySucceeded,
  };
}

// ── Evaluation ──────────────────────────────────────────────────────
function evaluate(
  check: UrlCheck,
  chosen: ExtractionResult | null,
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!chosen) {
    reasons.push("no extraction result");
    return { pass: false, reasons };
  }

  const minWords = check.minWords ?? 80;
  if (chosen.wordCount < minWords) {
    reasons.push(`word count ${chosen.wordCount} < min ${minWords}`);
  }

  if (check.expectTitleNotUrl !== false && chosen.title.trim() === check.url.trim()) {
    reasons.push("title fell back to raw URL");
  }

  return { pass: reasons.length === 0, reasons };
}

// ── Pretty output ───────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return a.green;
  if (score >= 50) return a.yellow;
  return a.red;
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

function fmtScore(result: ExtractionResult): string {
  return `score ${scoreColor(result.score)}${result.score}${a.reset} ${a.dim}\u00b7 ${result.wordCount} words${a.reset}`;
}

function printReport(report: Report, canRender: boolean): void {
  const icon = report.pass
    ? `${a.green}\u2713${a.reset}`
    : `${a.red}\u2717${a.reset}`;

  console.log(`  ${icon}  ${cleanUrl(report.url)}`);

  const hasRendered = report.rendered !== null;
  if (hasRendered && report.static) {
    console.log(`     ${a.dim}plain-fetch:${a.reset} ${fmtScore(report.static)} ${a.dim}\u2192${a.reset} ${a.dim}browser-rendered:${a.reset} ${fmtScore(report.rendered!)}`);
  } else if (report.static) {
    console.log(`     ${a.dim}plain-fetch:${a.reset} ${fmtScore(report.static)}`);
  }

  for (const reason of report.reasons) {
    console.log(`     ${a.dim}\u21b3 ${reason}${a.reset}`);
  }
  if (report.error) {
    console.log(`     ${a.dim}\u21b3 ${report.error}${a.reset}`);
  }
  if (!report.pass && report.shouldEnrichFromStatic && !canRender) {
    console.log(`     ${a.yellow}\u21b3 needs browser rendering (configure BROWSER_RENDERING_* in .env)${a.reset}`);
  }
  if (hasRendered && !report.usedRendered) {
    console.log(`     ${a.yellow}\u21b3 browser rendering didn't improve extraction${a.reset}`);
  }
  if (hasRendered && report.usedRendered && report.static) {
    console.log(`     ${a.green}\u21b3 browser rendering improved extraction (${report.static.score} \u2192 ${report.rendered!.score})${a.reset}`);
  }
  console.log();
}

function printSummary(reports: Report[]): void {
  const passed = reports.filter((r) => r.pass).length;
  const failed = reports.length - passed;

  console.log(`${a.dim}${"─".repeat(50)}${a.reset}`);

  if (failed === 0) {
    console.log(`  ${a.green}${passed} passed${a.reset} ${a.dim}\u00b7 ${reports.length} total${a.reset}`);
  } else {
    console.log(`  ${a.green}${passed} passed${a.reset} ${a.dim}\u00b7${a.reset} ${a.red}${failed} failed${a.reset} ${a.dim}\u00b7 ${reports.length} total${a.reset}`);
  }
  console.log();
}

// ── Main ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const configPath = getArgValue("--config") || "scripts/reading-mode-pipeline-urls.json";
  const fetchTimeoutMs = parseInt(getArgValue("--fetch-timeout-ms") || "15000", 10);
  const forceRender = hasFlag("--force-render");

  const browserEnabled = process.env.BROWSER_RENDERING_ENABLED === "true";
  const browserAccountId = process.env.BROWSER_RENDERING_ACCOUNT_ID || "";
  const browserApiToken = process.env.BROWSER_RENDERING_API_TOKEN || "";
  const browserTimeoutMs = parseInt(process.env.BROWSER_RENDERING_TIMEOUT_MS || "12000", 10);

  const configRaw = await readFile(configPath, "utf-8");
  const config: { urls: UrlCheck[] } = JSON.parse(configRaw);
  if (!Array.isArray(config.urls) || config.urls.length === 0) {
    throw new Error(`No URLs found in ${configPath}`);
  }

  const canRender = browserEnabled && !!browserAccountId && !!browserApiToken;

  const rendering = canRender
    ? `${a.green}on${a.reset}`
    : `${a.yellow}off${a.reset}`;

  console.log();
  console.log(`${a.bold}Reading Mode Pipeline${a.reset}`);
  console.log(`  ${a.dim}${config.urls.length} urls \u00b7 rendering ${a.reset}${rendering} ${a.dim}\u00b7 timeout ${fetchTimeoutMs}ms${a.reset}`);
  console.log(`${a.dim}${"─".repeat(50)}${a.reset}`);
  console.log();

  const reports: Report[] = [];

  for (const check of config.urls) {
    const report: Report = {
      url: check.url,
      static: null,
      rendered: null,
      shouldEnrichFromStatic: false,
      usedRendered: false,
      pass: false,
      reasons: [],
      error: null,
    };

    try {
      const staticHtml = await fetchPageHtml(check.url, fetchTimeoutMs);
      report.static = runExtraction(staticHtml, check.url);
      report.shouldEnrichFromStatic = shouldEnrich(report.static.score, { hasUrl: true });

      const shouldRunRender = forceRender || report.shouldEnrichFromStatic;

      if (canRender && shouldRunRender) {
        const renderedHtml = await fetchRenderedHtml(check.url, {
          enabled: true,
          accountId: browserAccountId,
          apiToken: browserApiToken,
          timeoutMs: browserTimeoutMs,
        });
        report.rendered = runExtraction(renderedHtml, check.url);

        report.usedRendered = isImprovement(
          report.static.score,
          report.rendered.score,
          report.static.htmlLength > 0,
          report.rendered.htmlLength > 0,
        );
      }

      const chosen = report.usedRendered && report.rendered ? report.rendered : report.static;
      const evalResult = evaluate(check, chosen);
      report.pass = evalResult.pass;
      report.reasons = evalResult.reasons;
    } catch (error) {
      if (error instanceof BrowserRenderingError) {
        report.error = `browser rendering: ${error.message}`;
      } else {
        report.error = error instanceof Error ? error.message : String(error);
      }
      report.pass = false;
      report.reasons.push("execution error");
    }

    reports.push(report);
    printReport(report, canRender);
  }

  printSummary(reports);

  const failed = reports.filter((r) => !r.pass);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
