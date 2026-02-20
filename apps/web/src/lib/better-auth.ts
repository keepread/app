import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { D1Dialect } from "kysely-d1";
import { generateUniqueSlug } from "@focus-reader/db";
import { getDb, getEnv } from "./bindings";

function isHttpsUrl(url: string): boolean {
  return url.startsWith("https://");
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendMagicLinkEmail(input: {
  to: string;
  url: string;
  resendApiKey?: string;
  fromEmail?: string;
}): Promise<void> {
  if (!input.resendApiKey || !input.fromEmail) {
    console.log(`[auth] Magic link for ${input.to}: ${input.url}`);
    return;
  }

  const subject = "Sign in to Focus Reader";
  const text = `Use this link to sign in: ${input.url}\n\nThis link expires in 15 minutes.`;
  const safeUrl = escapeHtml(input.url);
  const html = `<p>Use this link to sign in:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>This link expires in 15 minutes.</p>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.resendApiKey}`,
    },
    body: JSON.stringify({
      from: input.fromEmail,
      to: [input.to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to send magic link email (${response.status}): ${body}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAuth: any = null;

export async function getBetterAuth() {
  if (cachedAuth) return cachedAuth as ReturnType<typeof createAuth>;
  const result = createAuth(await getEnv(), await getDb());
  cachedAuth = result;
  return result;
}

function createAuth(env: Awaited<ReturnType<typeof getEnv>>, db: D1Database) {
  const baseUrl = normalizeBaseUrl(env.BETTER_AUTH_URL || "http://localhost:3000");

  return betterAuth({
    baseURL: baseUrl,
    basePath: "/api/auth",
    secret: env.AUTH_SECRET,
    database: {
      dialect: new D1Dialect({ database: db }),
      type: "sqlite",
    },
    trustedOrigins: [baseUrl],
    rateLimit: {
      enabled: false,
    },
    advanced: {
      useSecureCookies: isHttpsUrl(baseUrl),
      cookies: {
        sessionToken: {
          name: "fr_session",
          attributes: {
            httpOnly: true,
            secure: isHttpsUrl(baseUrl),
            sameSite: "lax",
            path: "/",
          },
        },
      },
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
    user: {
      modelName: "user",
      fields: {
        emailVerified: "email_verified",
        image: "avatar_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        slug: {
          type: "string",
          required: true,
          unique: true,
          input: false,
        },
        is_admin: {
          type: "number",
          required: true,
          input: false,
          defaultValue: 0,
          returned: false,
        },
        is_active: {
          type: "number",
          required: true,
          input: false,
          defaultValue: 1,
          returned: false,
        },
      },
    },
    session: {
      modelName: "session",
      fields: {
        userId: "user_id",
        token: "token_hash",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 7,
    },
    verification: {
      modelName: "verification",
      fields: {
        identifier: "identifier",
        value: "value_hash",
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = String(user.email || "").toLowerCase();
            const slug = await generateUniqueSlug(db, email);

            return {
              data: {
                ...user,
                email,
                slug,
                is_admin: 0,
                is_active: 1,
              },
            };
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail({
            to: email,
            url,
            resendApiKey: env.RESEND_API_KEY,
            fromEmail: env.RESEND_FROM_EMAIL,
          });
        },
      }),
    ],
  });
}
