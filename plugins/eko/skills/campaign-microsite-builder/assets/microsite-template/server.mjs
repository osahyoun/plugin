import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultRoot = resolve(moduleDirectory);
const bodyLimit = 64 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

const securityHeaders = {
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
    "frame-ancestors 'none'"
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)"
};

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export async function loadDotEnv(rootDirectory = defaultRoot, target = process.env) {
  let raw;
  try {
    raw = await readFile(join(rootDirectory, ".env"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return target;
    }
    throw error;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (target[key] === undefined) {
      target[key] = value;
    }
  }
  return target;
}

export async function loadCampaignConfig(rootDirectory = defaultRoot) {
  const raw = await readFile(join(rootDirectory, "campaign.config.json"), "utf8");
  return JSON.parse(raw);
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders,
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(body);
}

function sendJSON(response, status, value, headers = {}) {
  send(response, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
}

function publicConfig(config, env) {
  return {
    campaign: config.campaign,
    action: {
      ctaLabel: config.action.ctaLabel,
      successTitle: config.action.successTitle,
      successMessage: config.action.successMessage
    },
    share: config.share,
    donation: {
      enabled: config.donation.enabled,
      currency: config.donation.currency,
      amounts: config.donation.amounts,
      defaultAmount: config.donation.defaultAmount,
      minimumAmount: config.donation.minimumAmount,
      maximumAmount: config.donation.maximumAmount,
      monthlyEnabled: config.donation.monthlyEnabled,
      heading: config.donation.heading,
      message: config.donation.message
    },
    brand: config.brand,
    legal: config.legal,
    demoMode: Boolean(config.demoMode) || parseBoolean(env.MICROSITE_DEMO_MODE),
    turnstile: {
      siteKey: env.TURNSTILE_SITE_KEY || "",
      required: parseBoolean(env.REQUIRE_TURNSTILE)
    }
  };
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function renderIndex(rootDirectory, config) {
  const template = await readFile(join(rootDirectory, "public", "index.html"), "utf8");
  return template
    .replaceAll("__CAMPAIGN_TITLE__", escapeHTML(config.campaign.title))
    .replaceAll("__CAMPAIGN_SUMMARY__", escapeHTML(config.campaign.summary));
}

async function readJSONBody(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > bodyLimit) {
      const error = new Error("request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("request body must be valid JSON");
    error.status = 400;
    throw error;
  }
}

function requestIP(request) {
  return (
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket.remoteAddress ||
    ""
  );
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return;
  }
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = forwardedProtocol || (request.socket.encrypted ? "https" : "http");
  const expected = `${protocol}://${request.headers.host}`;
  if (origin !== expected) {
    const error = new Error("cross-origin submission rejected");
    error.status = 403;
    throw error;
  }
}

function createRateLimiter(limit, windowMilliseconds) {
  const clients = new Map();
  return (request) => {
    const key = requestIP(request);
    const now = Date.now();
    const current = clients.get(key);
    if (!current || current.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMilliseconds });
      return;
    }
    current.count += 1;
    if (current.count > limit) {
      const error = new Error("too many submissions; please try again shortly");
      error.status = 429;
      throw error;
    }
  };
}

async function parseUpstream(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function upstreamHeaders(env, request) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (env.VERCEL_SECRET) {
    headers["X-Vercel-Secret"] = env.VERCEL_SECRET;
  }
  if (request.headers.authorization) {
    headers.Authorization = request.headers.authorization;
  }
  return headers;
}

function upstreamBaseURL(env) {
  return String(env.CHAMPAIGN_API_HOST || "https://actions.eko.org").replace(/\/+$/, "");
}

function ensureLiveCredentials(config, env) {
  if (config.demoMode || parseBoolean(env.MICROSITE_DEMO_MODE)) {
    return;
  }
  if (!env.VERCEL_SECRET) {
    const error = new Error("live integration is not configured");
    error.status = 503;
    throw error;
  }
}

function validateEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function verifyTurnstile(request, body, env) {
  const required = parseBoolean(env.REQUIRE_TURNSTILE);
  if (!required && !env.TURNSTILE_SECRET_KEY) {
    return;
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    const error = new Error("Turnstile is required but not configured");
    error.status = 503;
    throw error;
  }
  if (!body.turnstileToken) {
    const error = new Error("Please complete the security check");
    error.status = 403;
    throw error;
  }
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: String(body.turnstileToken),
    remoteip: requestIP(request)
  });
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  const verification = await result.json();
  if (!verification.success) {
    const error = new Error("Security check failed");
    error.status = 403;
    throw error;
  }
}

function passthroughHeaders(upstream) {
  const result = {};
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    result["Set-Cookie"] = setCookie;
  }
  return result;
}

async function handleAction(request, response, config, env) {
  assertSameOrigin(request);
  const body = await readJSONBody(request);
  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    const error = new Error("Please enter your name");
    error.status = 422;
    throw error;
  }
  if (!validateEmail(body.email)) {
    const error = new Error("Please enter a valid email address");
    error.status = 422;
    throw error;
  }
  if (body.consent !== true) {
    const error = new Error("Consent is required");
    error.status = 422;
    throw error;
  }

  if (config.demoMode || parseBoolean(env.MICROSITE_DEMO_MODE)) {
    sendJSON(response, 200, {
      success: true,
      demo: true,
      action: { id: `demo-${Date.now()}` }
    });
    return;
  }

  ensureLiveCredentials(config, env);
  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/pages/${config.action.pageId}/actions`,
    {
      method: "POST",
      headers: upstreamHeaders(env, request),
      body: JSON.stringify({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        country: String(body.country ?? "").trim(),
        consent: true,
        source: String(body.source ?? "campaign-microsite").trim()
      })
    }
  );
  const payload = await parseUpstream(upstream);
  sendJSON(response, upstream.status, payload, passthroughHeaders(upstream));
}

async function handleBraintreeToken(request, response, config, env, url) {
  if (!config.donation.enabled) {
    sendJSON(response, 404, { error: "Donations are not enabled" });
    return;
  }
  const currency = String(url.searchParams.get("currency") || config.donation.currency)
    .trim()
    .toUpperCase();
  if (currency !== config.donation.currency) {
    sendJSON(response, 422, { error: "Unsupported currency" });
    return;
  }

  if (config.demoMode || parseBoolean(env.MICROSITE_DEMO_MODE)) {
    sendJSON(response, 200, { demo: true, token: null });
    return;
  }

  ensureLiveCredentials(config, env);
  const merchant = config.donation.merchantAccounts[currency];
  if (!merchant) {
    sendJSON(response, 503, { error: "Braintree merchant account is not configured" });
    return;
  }
  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/braintree/token?merchantAccountId=${encodeURIComponent(
      merchant
    )}`,
    {
      headers: { Accept: "application/json" }
    }
  );
  const payload = await parseUpstream(upstream);
  sendJSON(response, upstream.status, payload);
}

async function handleDonation(request, response, config, env) {
  assertSameOrigin(request);
  if (!config.donation.enabled) {
    const error = new Error("Donations are not enabled");
    error.status = 404;
    throw error;
  }
  const body = await readJSONBody(request);
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "").trim().toUpperCase();
  if (
    !Number.isFinite(amount) ||
    amount < config.donation.minimumAmount ||
    amount > config.donation.maximumAmount
  ) {
    const error = new Error(
      `Donation must be between ${config.donation.minimumAmount} and ${config.donation.maximumAmount}`
    );
    error.status = 422;
    throw error;
  }
  if (currency !== config.donation.currency) {
    const error = new Error("Unsupported currency");
    error.status = 422;
    throw error;
  }
  if (body.recurring && !config.donation.monthlyEnabled) {
    const error = new Error("Monthly donations are not enabled");
    error.status = 422;
    throw error;
  }
  if (!validateEmail(body.member?.email)) {
    const error = new Error("A valid supporter email is required");
    error.status = 422;
    throw error;
  }

  if (config.demoMode || parseBoolean(env.MICROSITE_DEMO_MODE)) {
    sendJSON(response, 200, {
      success: true,
      demo: true,
      transaction: { id: `demo-${Date.now()}` }
    });
    return;
  }

  if (typeof body.nonce !== "string" || !body.nonce.trim()) {
    const error = new Error("Secure payment token is missing");
    error.status = 422;
    throw error;
  }
  ensureLiveCredentials(config, env);
  await verifyTurnstile(request, body, env);
  if (parseBoolean(env.REQUIRE_DEVICE_DATA, true) && !String(body.deviceData ?? "").trim()) {
    const error = new Error("Payment risk data is missing; refresh and try again");
    error.status = 422;
    throw error;
  }

  const authenticationId = String(body.authenticationId ?? "").trim();
  const payload = {
    action_pronto: 1,
    amount,
    currency,
    recurring: Boolean(body.recurring),
    store_in_vault: Boolean(body.vault),
    user: {
      name: String(body.member.name ?? "").trim(),
      email: body.member.email.trim().toLowerCase(),
      country: String(body.member.country ?? "").trim()
    },
    payment_method_nonce: body.nonce.trim(),
    device_data: String(body.deviceData ?? ""),
    recaptcha_action: "",
    recaptcha_token: "",
    ...(authenticationId ? { authenticationId, three_d_secure: true } : {})
  };

  const upstream = await fetch(
    `${upstreamBaseURL(env)}/api/payment/braintree/pages/${config.donation.pageId}/transaction`,
    {
      method: "POST",
      headers: upstreamHeaders(env, request),
      body: JSON.stringify(payload)
    }
  );
  const result = await parseUpstream(upstream);
  sendJSON(response, upstream.status, result, passthroughHeaders(upstream));
}

function safePublicPath(rootDirectory, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const publicRoot = resolve(rootDirectory, "public");
  const target = resolve(publicRoot, relative);
  if (target !== publicRoot && !target.startsWith(`${publicRoot}${sep}`)) {
    return null;
  }
  return target;
}

async function serveStatic(response, rootDirectory, pathname) {
  const target = safePublicPath(rootDirectory, pathname);
  if (!target) {
    sendJSON(response, 404, { error: "Not found" });
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    }
    const body = await readFile(target);
    send(response, 200, body, {
      "Content-Type": contentTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=3600"
        : "no-store"
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendJSON(response, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

export function createSiteServer({
  rootDirectory = defaultRoot,
  env = process.env,
  configOverride
} = {}) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Node 20 or newer is required for global fetch");
  }
  const limitAction = createRateLimiter(30, 60_000);
  const limitDonation = createRateLimiter(15, 60_000);

  return createServer(async (request, response) => {
    try {
      const config = configOverride ?? (await loadCampaignConfig(rootDirectory));
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (request.method === "GET" && url.pathname === "/health") {
        sendJSON(response, 200, {
          ok: true,
          mode:
            config.demoMode || parseBoolean(env.MICROSITE_DEMO_MODE) ? "demo" : "live-integration"
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/site-config") {
        sendJSON(response, 200, publicConfig(config, env));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/action") {
        limitAction(request);
        await handleAction(request, response, config, env);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/braintree/token") {
        await handleBraintreeToken(request, response, config, env, url);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/braintree") {
        limitDonation(request);
        await handleDonation(request, response, config, env);
        return;
      }
      if (request.method === "GET" && url.pathname === "/") {
        const html = await renderIndex(rootDirectory, config);
        send(response, 200, html, { "Content-Type": "text/html; charset=utf-8" });
        return;
      }
      if (request.method === "GET") {
        await serveStatic(response, rootDirectory, url.pathname);
        return;
      }
      sendJSON(response, 405, { error: "Method not allowed" }, { Allow: "GET, POST" });
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status >= 500) {
        console.error(error);
      }
      if (!response.headersSent) {
        sendJSON(response, status, {
          success: false,
          error: status >= 500 ? "The campaign service is temporarily unavailable" : error.message
        });
      } else {
        response.end();
      }
    }
  });
}

async function main() {
  await loadDotEnv(defaultRoot);
  const port = Number(process.env.PORT || 4173);
  const server = createSiteServer({ rootDirectory: defaultRoot, env: process.env });
  server.listen(port, () => {
    console.log(`Ekō campaign microsite listening on http://localhost:${port}`);
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
