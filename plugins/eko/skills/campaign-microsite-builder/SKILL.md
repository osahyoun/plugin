---
name: campaign-microsite-builder
description: Build, test, and prepare production-capable Ekō campaign microsites on an existing Prosecco campaign page using the approved universal canvas, native petition and donation components, post-action sharing, and existing Prosecco APIs. Use when a campaigner supplies a Prosecco page link and asks for a microsite, campaign landing page, petition page, action-to-share journey, fundraising follow-up, branded campaign site, iteration, or launch review.
---

# Campaign Microsite Builder

Build the microsite on the campaigner's existing Prosecco page. The page URL is the
canonical action association: resolve it through Prosecco's current page API and retain
the returned page and form identifiers server-side. The campaign-specific story and
visual structure belong in a versioned page bundle rendered by the approved universal
canvas. The universal Prosecco layout owns the native petition, sharing, and donation
components. Do not create a parallel action form, payment service, campaign-specific
Liquid layout, or OpenAI Sites project by default.

## Universal Canvas Boundary

Read [references/universal-canvas-contract.md](references/universal-canvas-contract.md)
before preparing microsite structure or changing a published microsite.

- Generate the campaign story, imagery, content hierarchy, component placement, and
  page-scoped presentation.
- Place only the approved petition, share, and donation slots in campaign-specific
  markup. Never generate the protected form interiors.
- Select only allowlisted journey and presentation variants. Prosecco must reject an
  unknown slot, variant, duplicate required slot, or invalid journey.
- Keep page ids, form ids, fields, consent, CAPTCHA, member prefill, API endpoints,
  payment tokenization, 3-D Secure, PayPal, and success state inside shared Prosecco
  components.
- Use declarative, allowlisted behaviours for scroll reveals, transitions, sticky
  panels, and similar creative effects. Do not publish arbitrary same-origin JavaScript
  that can inspect or mutate protected action or payment components.
- Treat each microsite update as a versioned page-bundle revision with preview,
  validation, audit history, and rollback. Once the canvas capability is installed,
  ordinary campaign iteration must not require a Prosecco application deployment.

The universal page-bundle publish contract is a required platform capability. If the
connected Prosecco environment does not advertise that capability, create or update a
reviewable preview and report the publish blocker. Do not compensate by hardwiring
campaign-specific markup, CSS, JavaScript, claims, images, or feature flags into the
shared Prosecco application.

## Required Context

Establish these values from the campaign record or the campaigner:

- the full Prosecco campaign page URL; ask for this before preparing a publish
- campaign title, headline, summary, target, petition demand, and locale
- evidence-backed context and two or three proof points
- preferred hero image and meaningful alt text
- share title, share text, and the canonical public campaign URL
- whether the existing page includes a fundraiser, its currency, and whether recurring
  giving is intended
- any campaign-specific style notes that fit the approved Ekō system

Use the approved Ekō logo, colours, type, footer links, and social links. Do not ask
the campaigner for a numeric page id or form id when a page URL is available.

## Workflow

1. Read [references/brand-guidelines.md](references/brand-guidelines.md).
2. Read [references/integration-contract.md](references/integration-contract.md) before
   changing page association, forms, API routes, payment fields, imagery, or publish
   configuration.
3. Ground factual page copy in approved evidence. Do not invent urgency, impact,
   targets, quotes, statistics, or outcomes.
4. Associate the campaign record with the supplied page using
   `associate_prosecco_page`:

   - pass `campaign_id`, the current `base_version`, and `prosecco_page_url`
   - let the backend validate the configured origin and `/a/{slug}` or
     `/{locale}/a/{slug}` path
   - let it resolve `GET /api/pages/{slug}.json`; never scrape action ids from HTML
   - require a petition with a `form_id` that is not explicitly inactive
   - show the campaigner the resolved page title/slug, action state, and selected fast
     layout before any publish
   - the campaigner's supplied URL authorizes saving that association to an unbound
     campaign record; ask before replacing a different saved production page URL

5. Keep the primary journey singular: sign first, share second, and only then show the
   donation ask when the associated Prosecco page supports it. Express this with the
   approved canvas slots and journey enum, never a replacement form.
6. Use the page's native editable content and its selected campaign image. For imagery:

   - accept a campaigner-uploaded image when the chat client exposes the file bytes;
     attach it with `attach_campaign_image`, include its real MIME type, file name,
     bytes, provenance, and campaign-specific alt text, then select it for the hero
   - accept a stable, licensed HTTPS image URL
   - use `search_unsplash_images` only when the campaigner wants stock-photo options;
     Unsplash is optional, not required
   - if the chat client does not expose uploaded file bytes to the tool, say so and ask
     for a stable image URL or offer Unsplash instead of pretending a temporary chat
     attachment can be published
   - preserve the existing Prosecco primary image as the fallback

7. Validate the campaign and review the rendered Prosecco draft at mobile and desktop
   widths. Check keyboard navigation, visible focus, image crop and alt text, action
   errors, consent, the post-action transition, share URLs, donation errors, the logo,
   all footer/social links, and the no-JavaScript message.
8. Use `publish_prosecco_draft` only after the campaigner explicitly asks and only when
   the re-resolved page is not already published. Prosecco's draft-export operation
   updates the existing page in place, so a draft operation must refuse a published
   page rather than silently editing it live. Publishing must re-resolve the saved page
   URL, target that same page id, select the approved universal canvas, and submit a
   versioned page bundle through the advertised Prosecco capability. Never deploy the
   Prosecco application as part of an ordinary campaign publish.
9. Exercise petition and donation submissions only against approved test/sandbox pages.
   Never create a real signature or donation during testing without explicit approval.
10. Use the explicit live-publish operation for an already-published page or for final
    promotion, and only after validation, content approval, accessibility review, link
    checks, anti-abuse configuration, and an approved production-like smoke test. A
    Prosecco draft or preview is not a public launch.

## Current Prosecco Contract

- Resolve association: `GET /api/pages/{slug}.json`
- Petition submit: `POST /api/pages/{pageId}/actions`
- Braintree token: `GET /api/payment/braintree/token?currency={currency}`
- Donation submit: `POST /api/payment/braintree/pages/{pageId}/transaction`
- Draft update: `POST /api/pages/draft_export` with the resolved page id and explicit
  universal canvas title
- Canvas capability: the page API or a dedicated capabilities response must advertise
  versioned microsite-bundle support before the plugin publishes campaign-specific
  structure or presentation

Use the form fields and `petition.form_id` returned for the associated page. The server
must verify that a submitted form belongs to the page. Do not invent replacement API
routes or browser-owned page identifiers.

## Safety Gates

- Treat the supplied Prosecco page URL as the source of truth and re-resolve it before
  every publish; reject unconfigured origins and unrelated paths.
- Refuse draft publishing when the associated page is already published. Updating a
  live page requires the explicit live-publish path and the campaigner's approval.
- Never embed API secrets, Braintree private keys, access tokens, or raw card data.
- Use Braintree Hosted Fields, device data, and 3-D Secure. Derive the server-side
  3-D Secure state from the verified authentication id, not a browser boolean.
- Enforce the approved CAPTCHA/anti-abuse control on action and live donation paths.
- Keep page id, form id, layout title, currency rules, and merchant-account mapping
  server-owned.
- Never emit a campaign-specific `<form>` element for petition or payment submission.
- Never allow generated CSS or behaviours to hide, reorder, replace, or intercept
  required fields, consent, errors, security messaging, or submit controls inside a
  protected native component.
- Prevent repeat clicks while a request is pending and return safe, actionable errors.
- Do not claim live readiness while any page association, action form, CAPTCHA,
  Braintree, branding, link, accessibility, or production smoke-test gate is unresolved.
- Require explicit approval before modifying an existing published page, publishing
  live, changing production page associations, or sending a real action/payment.

## Campaigner Support

- Ask only for missing launch-critical inputs; the Prosecco page link is the first one.
- Show the associated page and working draft early, then collect concrete feedback.
- Explain the difference between code-ready, sandbox-verified, and live-verified.
- Return the associated page URL, resolved slug/id, form id, layout title, draft URL,
  validation result, imagery provenance, and remaining launch blockers.

## Bundled Resources

- `references/brand-guidelines.md`: minimum Ekō brand, imagery, and navigation rules.
- `references/integration-contract.md`: the current Prosecco page, petition, sharing,
  and Braintree boundaries.
- `references/universal-canvas-contract.md`: the page-bundle, native-slot, presentation,
  iteration, and rollout contract.
- `scripts/create-microsite.mjs` and `assets/`: legacy standalone preview tooling. Use
  only when the campaigner explicitly asks for a non-Prosecco prototype; it is not the
  production default and must not be represented as the associated live action page.
