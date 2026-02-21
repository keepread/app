export interface BrowserRenderingConfig {
  enabled: boolean;
  accountId: string;
  apiToken: string;
  timeoutMs: number;
}

export class BrowserRenderingError extends Error {
  public retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "BrowserRenderingError";
    this.retryable = retryable;
  }
}

export async function fetchRenderedHtml(
  url: string,
  config: BrowserRenderingConfig
): Promise<string> {
  if (!config.enabled) {
    throw new BrowserRenderingError("Browser rendering disabled", false);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/browser-rendering/content`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new BrowserRenderingError(
        `Browser rendering HTTP ${response.status}`,
        retryable
      );
    }

    const html = await response.text();
    if (!html) {
      throw new BrowserRenderingError("Empty rendering result", false);
    }
    return html;
  } catch (err) {
    if (err instanceof BrowserRenderingError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new BrowserRenderingError("Browser rendering timeout", true);
    }
    throw new BrowserRenderingError(
      `Browser rendering failed: ${(err as Error).message}`,
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}
