import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { createSiteServer, loadCampaignConfig } from "../server.mjs";

const rootDirectory = resolve(".");
const upstreamRequests = [];
let upstream;
let site;
let baseURL;
let config;

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

before(async () => {
  config = await loadCampaignConfig(rootDirectory);
  config = structuredClone(config);
  config.demoMode = false;
  upstream = createServer(async (request, response) => {
    const body = request.method === "POST" ? await readBody(request) : {};
    upstreamRequests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body
    });

    response.setHeader("Content-Type", "application/json");
    if (request.url?.startsWith("/api/braintree/token")) {
      response.end(JSON.stringify({ token: "sandbox-client-token" }));
      return;
    }
    if (request.url?.includes("/actions")) {
      response.setHeader("Set-Cookie", "supporter=1; Path=/; HttpOnly");
      response.end(JSON.stringify({ success: true, id: "action-1" }));
      return;
    }
    if (request.url?.includes("/transaction")) {
      response.end(JSON.stringify({ success: true, transaction: { id: "txn-1" } }));
      return;
    }
    response.writeHead(404);
    response.end(JSON.stringify({ error: "not found" }));
  });
  const upstreamURL = await listen(upstream);

  site = createSiteServer({
    rootDirectory,
    configOverride: config,
    env: {
      CHAMPAIGN_API_HOST: upstreamURL,
      VERCEL_SECRET: "test-server-secret",
      MICROSITE_DEMO_MODE: "false",
      REQUIRE_TURNSTILE: "false",
      REQUIRE_DEVICE_DATA: "true"
    }
  });
  baseURL = await listen(site);
});

after(async () => {
  await Promise.all([
    new Promise((resolveClose) => site.close(resolveClose)),
    new Promise((resolveClose) => upstream.close(resolveClose))
  ]);
});

test("serves branded campaign HTML and hides server-owned ids", async () => {
  const page = await fetch(baseURL);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, new RegExp(config.campaign.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /eko-logo-purple\.svg/);
  assert.match(page.headers.get("content-security-policy"), /braintreegateway/);

  const publicResponse = await fetch(`${baseURL}/api/site-config`);
  const publicText = await publicResponse.text();
  assert.equal(publicResponse.status, 200);
  assert.doesNotMatch(publicText, new RegExp(String(config.action.pageId)));
  assert.doesNotMatch(publicText, new RegExp(String(config.donation.pageId)));
  for (const merchant of Object.values(config.donation.merchantAccounts)) {
    assert.doesNotMatch(publicText, new RegExp(merchant));
  }
});

test("proxies a validated petition to the configured action page", async () => {
  const response = await fetch(`${baseURL}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Supporter",
      email: "supporter@example.org",
      country: "GB",
      consent: true
    })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);

  const request = upstreamRequests.find((item) => item.url?.includes("/actions"));
  assert.equal(
    request.url,
    `/api/pages/${config.action.pageId}/actions`
  );
  assert.equal(request.headers["x-vercel-secret"], "test-server-secret");
  assert.equal(request.body.email, "supporter@example.org");
  assert.equal(request.body.consent, true);
});

test("gets the configured Braintree merchant token", async () => {
  const response = await fetch(
    `${baseURL}/api/braintree/token?currency=${config.donation.currency}`
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).token, "sandbox-client-token");

  const merchant = config.donation.merchantAccounts[config.donation.currency];
  const request = upstreamRequests.find((item) =>
    item.url?.startsWith("/api/braintree/token")
  );
  assert.equal(
    request.url,
    `/api/braintree/token?merchantAccountId=${encodeURIComponent(merchant)}`
  );
});

test("proxies only a tokenized Braintree donation to the configured page", async () => {
  const response = await fetch(`${baseURL}/api/braintree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: config.donation.defaultAmount,
      currency: config.donation.currency,
      recurring: false,
      vault: false,
      member: {
        name: "Test Supporter",
        email: "supporter@example.org",
        country: "GB"
      },
      nonce: "fake-valid-nonce",
      authenticationId: "three-ds-auth",
      deviceData: "{\"correlation_id\":\"test-device\"}"
    })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);

  const request = upstreamRequests.find((item) => item.url?.includes("/transaction"));
  assert.equal(
    request.url,
    `/api/payment/braintree/pages/${config.donation.pageId}/transaction`
  );
  assert.equal(request.headers["x-vercel-secret"], "test-server-secret");
  assert.equal(request.body.payment_method_nonce, "fake-valid-nonce");
  assert.equal(request.body.three_d_secure, true);
  assert.equal(request.body.action_pronto, 1);
  assert.equal(request.body.card_number, undefined);
  assert.equal(request.body.cvv, undefined);
});

test("rejects an out-of-range donation before it reaches the upstream", async () => {
  const requestCount = upstreamRequests.length;
  const response = await fetch(`${baseURL}/api/braintree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: config.donation.maximumAmount + 1,
      currency: config.donation.currency,
      member: { email: "supporter@example.org" },
      nonce: "fake-valid-nonce"
    })
  });
  assert.equal(response.status, 422);
  assert.equal(upstreamRequests.length, requestCount);
});
