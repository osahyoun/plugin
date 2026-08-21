import campaignConfig from "../campaign.config.json";

export interface CampaignEnv {
  CHAMPAIGN_API_HOST?: string;
  VERCEL_SECRET?: string;
  MICROSITE_DEMO_MODE?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  REQUIRE_TURNSTILE?: string;
  REQUIRE_DEVICE_DATA?: string;
}

const bodyLimit = 64 * 1024;
const actionClients = new Map<string, { count: number; resetAt: number }>();
const donationClients = new Map<string, { count: number; resetAt: number }>();

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://js.braintreegateway.com https://assets.braintreegateway.com https://songbird.cardinalcommerce.com https://songbirdstag.cardinalcommerce.com https://challenges.cloudflare.com",
    "connect-src 'self' https://*.braintree-api.com https://*.braintreegateway.com https://api.braintreegateway.com https://client-analytics.braintreegateway.com https://*.cardinalcommerce.com https://challenges.cloudflare.com",
    "frame-src https://assets.braintreegateway.com https://*.braintreegateway.com https://*.cardinalcommerce.com https://challenges.cloudflare.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value?.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isDemo(env: CampaignEnv) {
  return Boolean(campaignConfig.demoMode) || parseBoolean(env.MICROSITE_DEMO_MODE);
}

function json(status: number, value: unknown, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders,
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

export function addSecurityHeaders(response: Response) {
  const secured = new Response(response.body, response);
  for (const [key, value] of Object.entries(securityHeaders)) {
    secured.headers.set(key, value);
  }
  return secured;
}

function publicConfig(env: CampaignEnv) {
  return {
    campaign: campaignConfig.campaign,
    action: {
      ctaLabel: campaignConfig.action.ctaLabel,
      successTitle: campaignConfig.action.successTitle,
      successMessage: campaignConfig.action.successMessage,
    },
    share: campaignConfig.share,
    donation: {
      enabled: campaignConfig.donation.enabled,
      currency: campaignConfig.donation.currency,
      amounts: campaignConfig.donation.amounts,
      defaultAmount: campaignConfig.donation.defaultAmount,
      minimumAmount: campaignConfig.donation.minimumAmount,
      maximumAmount: campaignConfig.donation.maximumAmount,
      monthlyEnabled: campaignConfig.donation.monthlyEnabled,
      heading: campaignConfig.donation.heading,
      message: campaignConfig.donation.message,
    },
    brand: campaignConfig.brand,
    legal: campaignConfig.legal,
    demoMode: isDemo(env),
    turnstile: {
      siteKey: env.TURNSTILE_SITE_KEY || "",
      required: parseBoolean(env.REQUIRE_TURNSTILE),
    },
  };
}

async function readJSON(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > bodyLimit) {
    throw new HttpError(413, "request body is too large");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "request body must be valid JSON");
  }
}

function requestIP(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "cross-origin submission rejected");
  }
}

function enforceRateLimit(
  clients: Map<string, { count: number; resetAt: number }>,
  request: Request,
  limit: number,
) {
  const key = requestIP(request);
  const now = Date.now();
  const current = clients.get(key);
  if (!current || current.resetAt <= now) {
    clients.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new HttpError(429, "too many submissions; please try again shortly");
  }
}

function upstreamBaseURL(env: CampaignEnv) {
  return String(env.CHAMPAIGN_API_HOST || "https://actions.eko.org").replace(/\/+$/, "");
}

function upstreamHeaders(env: CampaignEnv, request: Request) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (env.VERCEL_SECRET) headers.set("X-Vercel-Secret", env.VERCEL_SECRET);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  return headers;
}

function ensureLiveCredentials(env: CampaignEnv) {
  if (!isDemo(env) && !env.VERCEL_SECRET) {
    throw new HttpError(503, "live integration is not configured");
  }
}

function validEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function parseUpstream(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function upstreamResponse(upstream: Response, payload: unknown) {
  const headers = new Headers();
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return json(upstream.status, payload, headers);
}

async function verifyTurnstile(
  request: Request,
  body: Record<string, unknown>,
  env: CampaignEnv,
) {
  const required = parseBoolean(env.REQUIRE_TURNSTILE);
  if (!required && !env.TURNSTILE_SECRET_KEY) return;
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new HttpError(503, "Turnstile is required but not configured");
  }
  if (!body.turnstileToken) {
    throw new HttpError(403, "Please complete the security check");
  }
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: String(body.turnstileToken),
    remoteip: requestIP(request),
  });
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const verification = (await result.json()) as { success?: boolean };
  if (!verification.success) throw new HttpError(403, "Security check failed");
}

async function handleAction(request: Request, env: CampaignEnv) {
  assertSameOrigin(request);
  enforceRateLimit(actionClients, request, 30);
  const body = await readJSON(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (name.length < 2) {
    throw new HttpError(422, "Please enter your name");
  }
  if (!validEmail(email)) throw new HttpError(422, "Please enter a valid email address");
  if (body.consent !== true) throw new HttpError(422, "Consent is required");

  if (isDemo(env)) {
    return json(200, { success: true, demo: true, action: { id: `demo-${Date.now()}` } });
  }

  ensureLiveCredentials(env);
  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/pages/${campaignConfig.action.pageId}/actions`,
    {
      method: "POST",
      headers: upstreamHeaders(env, request),
      body: JSON.stringify({
        name,
        email: email.toLowerCase(),
        country: String(body.country ?? "").trim(),
        consent: true,
        source: String(body.source ?? "campaign-microsite").trim(),
      }),
    },
  );
  return upstreamResponse(upstream, await parseUpstream(upstream));
}

async function handleToken(request: Request, env: CampaignEnv) {
  if (!campaignConfig.donation.enabled) return json(404, { error: "Donations are not enabled" });
  const currency = String(
    new URL(request.url).searchParams.get("currency") || campaignConfig.donation.currency,
  )
    .trim()
    .toUpperCase();
  if (currency !== campaignConfig.donation.currency) {
    return json(422, { error: "Unsupported currency" });
  }
  if (isDemo(env)) return json(200, { demo: true, token: null });

  ensureLiveCredentials(env);
  const merchant =
    campaignConfig.donation.merchantAccounts[
      currency as keyof typeof campaignConfig.donation.merchantAccounts
    ];
  if (!merchant) return json(503, { error: "Braintree merchant account is not configured" });
  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/braintree/token?merchantAccountId=${encodeURIComponent(merchant)}`,
    { headers: { Accept: "application/json" } },
  );
  return upstreamResponse(upstream, await parseUpstream(upstream));
}

async function handleDonation(request: Request, env: CampaignEnv) {
  assertSameOrigin(request);
  enforceRateLimit(donationClients, request, 10);
  if (!campaignConfig.donation.enabled) throw new HttpError(404, "Donations are not enabled");
  const body = await readJSON(request);
  const member =
    body.member && typeof body.member === "object"
      ? (body.member as Record<string, unknown>)
      : {};
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "").trim().toUpperCase();
  if (
    !Number.isFinite(amount) ||
    amount < campaignConfig.donation.minimumAmount ||
    amount > campaignConfig.donation.maximumAmount
  ) {
    throw new HttpError(
      422,
      `Donation must be between ${campaignConfig.donation.minimumAmount} and ${campaignConfig.donation.maximumAmount}`,
    );
  }
  if (currency !== campaignConfig.donation.currency) {
    throw new HttpError(422, "Unsupported currency");
  }
  if (body.recurring && !campaignConfig.donation.monthlyEnabled) {
    throw new HttpError(422, "Monthly donations are not enabled");
  }
  if (!validEmail(member.email)) {
    throw new HttpError(422, "A valid supporter email is required");
  }

  if (isDemo(env)) {
    return json(200, {
      success: true,
      demo: true,
      transaction: { id: `demo-${Date.now()}` },
    });
  }

  if (typeof body.nonce !== "string" || !body.nonce.trim()) {
    throw new HttpError(422, "Secure payment token is missing");
  }
  ensureLiveCredentials(env);
  await verifyTurnstile(request, body, env);
  if (parseBoolean(env.REQUIRE_DEVICE_DATA, true) && !String(body.deviceData ?? "").trim()) {
    throw new HttpError(422, "Payment risk data is missing; refresh and try again");
  }

  const authenticationId = String(body.authenticationId ?? "").trim();
  const payload = {
    action_pronto: 1,
    amount,
    currency,
    recurring: Boolean(body.recurring),
    store_in_vault: Boolean(body.vault),
    user: {
      name: String(member.name ?? "").trim(),
      email: String(member.email).trim().toLowerCase(),
      country: String(member.country ?? "").trim(),
    },
    payment_method_nonce: body.nonce.trim(),
    device_data: String(body.deviceData ?? ""),
    recaptcha_action: "",
    recaptcha_token: "",
    ...(authenticationId ? { authenticationId, three_d_secure: true } : {}),
  };

  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/payment/braintree/pages/${campaignConfig.donation.pageId}/transaction`,
    {
      method: "POST",
      headers: upstreamHeaders(env, request),
      body: JSON.stringify(payload),
    },
  );
  return upstreamResponse(upstream, await parseUpstream(upstream));
}

export async function handleCampaignAPI(request: Request, env: CampaignEnv) {
  const { pathname } = new URL(request.url);
  try {
    if (request.method === "GET" && pathname === "/health") {
      return json(200, { ok: true, mode: isDemo(env) ? "demo" : "live-integration" });
    }
    if (request.method === "GET" && pathname === "/api/site-config") {
      return json(200, publicConfig(env));
    }
    if (request.method === "POST" && pathname === "/api/action") {
      return await handleAction(request, env);
    }
    if (request.method === "GET" && pathname === "/api/braintree/token") {
      return await handleToken(request, env);
    }
    if (request.method === "POST" && pathname === "/api/braintree") {
      return await handleDonation(request, env);
    }
    if (pathname.startsWith("/api/") || pathname === "/health") {
      return json(405, { error: "Method not allowed" }, { Allow: "GET, POST" });
    }
    return null;
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);
    return json(status, {
      success: false,
      error:
        status >= 500
          ? "The campaign service is temporarily unavailable"
          : error instanceof Error
            ? error.message
            : "Request failed",
    });
  }
}
