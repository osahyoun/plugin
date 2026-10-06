# Ekō Universal Microsite Canvas Contract

## Purpose

Install one reusable Prosecco capability, then create and revise individual campaign
microsites as page data. A campaign iteration updates a versioned page bundle; it does
not add campaign-specific code to Prosecco and does not require an application deploy.

The boundary is deliberate:

- the campaign bundle controls the story and surrounding visual structure
- shared Prosecco components control every action and payment form detail

## Page bundle

The canonical campaign record may produce a bundle shaped like:

```json
{
  "schema_version": 1,
  "revision": 4,
  "html": "<main data-eko-microsite-canvas>...</main>",
  "css": "[data-eko-microsite-canvas] { ... }",
  "behaviours": [
    { "type": "scroll-reveal", "selector": "[data-reveal]" }
  ],
  "journey": "petition_share_donate",
  "components": {
    "petition": { "presentation": "standard" },
    "share": { "presentation": "standard" },
    "donation": { "presentation": "progressive" }
  },
  "assets": []
}
```

The persisted revision must include its creator, creation time, campaign/page
association, content hash, validation result, and previous revision. Publishing a new
revision must invalidate the rendered page cache. Rollback selects a previous validated
revision; it does not reconstruct content from chat history.

## Native component slots

Campaign-specific markup may place only these protected slots:

```html
<eko-petition-slot></eko-petition-slot>
<eko-share-slot></eko-share-slot>
<eko-donation-slot></eko-donation-slot>
```

Prosecco resolves each slot server-side from the associated page. The browser does not
supply a page id, form id, endpoint, merchant account, or field schema. A petition
journey requires exactly one petition slot. Share and donation slots are revealed only
when the shared journey controller reaches their allowed state.

The LLM may choose where a component sits in the campaign story and select an approved
presentation. It may not supply or rewrite the component's internal HTML.

## Form invariants

The petition component always owns:

- fields returned by the associated Prosecco petition
- required state, labels, error summary, field errors, and focus management
- consent and privacy copy
- recognized-member prefill and outstanding-field behaviour
- attribution and tracking fields
- CAPTCHA and repeat-submission protection
- the native Prosecco action endpoint and page-owned form id
- success state and transition into the native share journey

The donation component always owns:

- amount and frequency rules configured on the associated fundraiser
- donor details, validation, consent, errors, and focus management
- currency and merchant-account resolution
- Braintree Hosted Fields, device data, 3-D Secure, and tokenized nonces
- PayPal initialization and availability
- the native Prosecco donation endpoint and page-owned fundraiser form id
- confirmation, receipt language, retry safety, and duplicate-click protection

Generated markup must never contain a petition or donation `<form>`, raw card inputs,
submission endpoints, page/form ids, payment credentials, or merchant-account values.

## Structural control

The LLM controls:

- campaign section order and hierarchy
- copy, evidence, imagery, captions, alt text, and attribution
- placement of the protected component slots
- surrounding calls to action that focus or reveal a native component
- page-level colour, spacing, typography, crop, and motion within Ekō guardrails
- one allowlisted journey and one allowlisted presentation per component

The LLM does not control:

- the order or semantics of fields inside a native component
- required fields, consent, validation, errors, security copy, or submit semantics
- native action/payment requests or success criteria
- whether a protected component can be bypassed, hidden, overlaid, or intercepted

Start with strict presentations:

- petition: `standard`
- share: `standard`
- donation: `progressive`

These are identifiers for reviewed shared templates, not instructions to regenerate a
form. Unknown identifiers fail validation. A new presentation requires ordinary
Prosecco code review and one platform deployment; after that it can be selected by any
campaign bundle without another deployment.

## CSS and behaviour isolation

- Scope all generated CSS to `[data-eko-microsite-canvas]`.
- Expose reviewed design tokens for the surrounding component card, such as spacing,
  radius, colour, and width.
- Protect component internals with a stronger style boundary such as Shadow DOM or a
  dedicated reset layer and reject selectors that target protected nodes.
- Do not execute arbitrary generated same-origin JavaScript.
- Express routine motion and interaction through an allowlisted behaviour manifest
  interpreted by the universal canvas runtime.
- If a future use case requires arbitrary script, run it in a sandbox without access to
  cookies, storage, network credentials, native component DOM, or submission events.
- Respect `prefers-reduced-motion`; never require motion to understand or complete the
  action.

## Image performance invariants

- Use no more than 12 declared image assets in one revision.
- Every `<img>` and its matching asset record must include intrinsic numeric `width`
  and `height` so the browser can reserve space before download.
- Every `<img>` must use `decoding="async"` and an explicit `loading` value.
- For responsive `<picture>` markup, each `<source>` must use `srcset` with exactly
  one declared public HTTPS asset URL plus an optional `media` and `type`; do not use
  `src` on `<source>` or multi-candidate descriptor lists.
- At most one above-fold LCP image may use `loading="eager"`; it must also use
  `fetchpriority="high"`.
- All later images must use `loading="lazy"` and may not use high fetch priority.
- Keep remote image URLs durable, transformed to an appropriate display size, and
  recorded with meaningful alt text and attribution. A large original file is not a
  production-ready asset merely because it is HTTPS.
- The live publish gate must test the staged page's actual transfer size and crops;
  bundle byte limits cannot determine the weight of remote imagery.

## Journey state

For the default `petition_share_donate` journey:

1. The petition component is available.
2. A verified native petition success reveals the share component.
3. The optional donation component becomes available after sharing is presented.
4. Donation success uses the native confirmation state.

Creative elements may respond to high-level read-only events such as
`petition_succeeded`, `share_presented`, and `donation_succeeded`. Generated behaviour
cannot fabricate those events or treat a browser boolean as proof of server success.

## Validation and rollout

Before publish, validate:

- schema version, bundle size, markup allowlist, CSS scoping, behaviour allowlist, and
  asset provenance
- exactly the required slots for the selected journey
- associated native forms and server-owned ids re-resolved from the saved page URL
- keyboard navigation, focus, contrast, motion preference, mobile/desktop crop, links,
  action errors, share URLs, and donation errors
- Lighthouse performance at or above 95, accessibility 100, LCP at or below 2.5s,
  CLS at or below 0.05, TBT at or below 100ms, no third-party scripts before
  interaction, and an initial transfer budget at or below 400KB
- draft/live authorization, revision history, cache invalidation, and rollback

Until Prosecco advertises this universal bundle capability, the plugin may create and
iterate a preview but must report publishing as blocked. It must not add a
campaign-specific branch, stylesheet, script, image, claim, or marker to a shared
Liquid layout as a workaround.
