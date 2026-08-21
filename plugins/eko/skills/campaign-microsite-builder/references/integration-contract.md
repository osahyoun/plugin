# Prosecco Campaign Microsite Integration Contract

## Existing-page architecture

The production microsite is an existing Prosecco campaign page rendered with the
approved fast Liquid layout. The campaigner supplies its public page URL; the backend
validates and resolves that URL, stores the resulting identifiers, and targets the same
page when a draft is prepared.

1. Accept a full configured Prosecco URL whose path is `/a/{slug}` or
   `/{locale}/a/{slug}`.
2. Resolve the slug through `GET /api/pages/{slug}.json`.
3. Require a returned petition `form_id` and reject an explicitly inactive petition.
4. Store `page_url`, `page_id`, `page_slug`, `form_id`, `publish_status`, and the fast
   layout title in the campaign's Prosecco publish target.
5. Re-resolve the saved URL immediately before publishing so stale or manually changed
   identifiers cannot redirect the update.
6. Update the page through the existing `POST /api/pages/draft_export` endpoint with
   that page id and the configured universal canvas title.
7. Publish campaign-specific structure and presentation only when Prosecco advertises
   support for a validated, versioned microsite page bundle.

Do not create a second action page or accept a free-form numeric id from the browser.
Do not add a campaign-specific conditional, stylesheet, controller branch, or Liquid
layout to the Prosecco application. If the bundle capability is unavailable, keep the
work in preview and report the platform blocker.

## Universal canvas

The approved Liquid/Rails layout is shared infrastructure. It renders a validated
campaign page bundle and replaces its protected petition, share, and donation slots
with native Prosecco components. The campaign bundle may control the surrounding
content hierarchy, imagery, placement, scoped CSS, and allowlisted declarative
behaviours. It may not contain a petition or payment form.

Use the detailed rules in `universal-canvas-contract.md`. In particular:

- native component interiors come from shared reviewed templates
- presentation choices are allowlisted enum values, not generated form markup
- generated CSS cannot target protected component internals
- generated behaviour cannot intercept submissions or fabricate success
- each update creates an auditable page revision with rollback
- ordinary campaign iteration does not deploy the Prosecco application

## Petition journey

The fast layout renders the fields returned by the associated page and submits to
Prosecco's existing action route:

```text
POST /api/pages/{pageId}/actions
```

The payload includes the page's own `petition.form_id`, consent state, the configured
petition fields, approved attribution/tracking fields, and the active CAPTCHA token.
The server verifies the form belongs to the route's page before forwarding the action.
After success the same page reveals sharing, followed by the optional donation ask.

## Donation journey

The fast layout uses the existing Prosecco Braintree routes:

```text
GET  /api/payment/braintree/token?currency={currency}
POST /api/payment/braintree/pages/{pageId}/transaction
```

Braintree Hosted Fields keeps PAN, CVV, and expiry out of Prosecco-controlled inputs.
The browser sends the tokenized nonce, device data, verified 3-D Secure authentication
id, member data, amount, currency, recurring choice, consent, and CAPTCHA token. The
server derives 3-D Secure state from the authentication id, validates the page-owned
payment configuration, and returns safe JSON errors.

Never add ordinary card-number fields or a separate payment proxy for this workflow.

## Server-owned values

- allowed Prosecco origins and API base URL
- associated page id, slug, URL, and petition form id
- `EKO_PROSECCO_FAST_LAYOUT_TITLE` (default `Fast Petition Campaign`)
- currency and merchant-account rules
- CAPTCHA and Braintree credentials
- production publish authorization

The browser may not override page ids, form ids, layout titles, or merchant accounts.

The page bundle may not override field order, required state, consent, CAPTCHA,
validation, error handling, recognized-member prefill, endpoints, payment methods,
tokenization, success criteria, or journey gates inside a protected component.

## Imagery

Use, in order of preference:

1. a campaigner-uploaded file whose actual bytes can be attached durably
2. a stable licensed HTTPS asset URL with recorded provenance
3. an explicitly selected Unsplash result with attribution
4. the page's existing Prosecco primary image

Temporary chat URLs and local file paths are not production assets. Always store useful
alt text and verify crop/focal behavior at mobile and desktop widths.

## Launch states

- Code-ready: implementation and automated tests pass; no environment claim is made.
- Sandbox-verified: association, action, CAPTCHA, sharing, tokenization, 3-D Secure,
  device data, and donation errors have been exercised on approved test pages.
- Live-verified: production page association, approved copy/evidence, real assets,
  branding and links, accessibility, monitoring, anti-abuse posture, and an approved
  production-like smoke test are complete.
