import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  MICROSITE_DEMO_MODE: "true",
};

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

function request(path, options) {
  return worker.fetch(new Request(`http://localhost${path}`, options), env, ctx);
}

test("renders the branded campaign page with security headers", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /braintreegateway/);
  const html = await response.text();
  assert.match(html, /eko-logo-purple\.svg/);
  assert.match(html, /id="petition"/);
  assert.match(html, /id="donation-form"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("exposes only the public campaign configuration", async () => {
  const response = await request("/api/site-config");
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /merchantAccounts|pageId|VERCEL_SECRET/);
  assert.equal(JSON.parse(text).demoMode, true);
});

test("runs the demo petition and donation journey", async () => {
  const action = await request("/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
    },
    body: JSON.stringify({
      name: "Test Supporter",
      email: "supporter@example.org",
      country: "GB",
      consent: true,
    }),
  });
  assert.equal(action.status, 200);
  assert.equal((await action.json()).demo, true);

  const donation = await request("/api/braintree", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
    },
    body: JSON.stringify({
      amount: 10,
      currency: "GBP",
      member: { email: "supporter@example.org" },
    }),
  });
  assert.equal(donation.status, 200);
  assert.equal((await donation.json()).demo, true);
});

test("rejects cross-origin submissions", async () => {
  const response = await request("/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({
      name: "Test Supporter",
      email: "supporter@example.org",
      consent: true,
    }),
  });
  assert.equal(response.status, 403);
});
