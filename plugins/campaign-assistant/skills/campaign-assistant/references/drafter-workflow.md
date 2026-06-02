# Drafter Workflow Reference

This reference mirrors the mailing draft workflow used by the drafter service.

## Service Shape

The Go drafting service validates that `campaign_idea` is present, normalizes `campaign_id` from `backend_campaign_id` when needed, then shells into the TypeScript bridge with JSON on stdin. The bridge returns a structured campaign email draft response.

For the Codex plugin, mirror the logic directly in text. Do not claim that the backend bridge ran unless it was actually invoked.

## Request Fields

Normalize from these possible inputs:

- `campaign_id`
- `backend_campaign_id`
- `campaign_type` or `action_type`
- `template_theme` or `theme`
- `title`
- `one_sentence_goal`
- `campaign_idea`
- `target_audience`
- `desired_action`
- `tone_notes`
- `locale`
- `source_urls`
- `allow_source_discovery`
- `source_discovery_query`
- `preferred_source_types`
- `excluded_domains`
- `search_timeframe`
- `optional_constraints`
- `banned_claims`
- `required_points`
- `notes`

## Stage Order

1. **Intake**
   Normalize a raw brief into a campaign brief. Preserve uncertainty. Do not invent missing facts.

2. **Source Discovery**
   If no URLs are supplied and discovery is allowed, find candidate material. Prefer official, primary, regulatory, research, reputable reporting, and direct evidence. Do not optimize only for supportive coverage.

3. **Source Research**
   Convert sources or campaigner notes into structured evidence. Extract concrete facts, short support snippets, reliability notes, contradictions, and risk flags.

4. **Voice Retrieval**
   Apply the canonical golden style guide first. Add style summaries only as supporting patterns. Never copy distinctive historical wording.

5. **Structure**
   Build an email outline before drafting: subject lines, preview text, hook, body sections, CTA, signoff, and optional PS.

6. **Member Action Evaluation**
   Identify the Target of Change, target specificity, member action, member action type, pressure channel, engagement quality, suggested stronger targets, and revision instructions.

7. **Drafting**
   Produce `subject_line_options`, `preview_text_options`, `body_markdown`, `evidence_map`, and `warnings`.

8. **Fact Check**
   Extract fact-like claims and classify each as supported, partially supported, unsupported, or unverifiable. Offer safer rewrites for weak claims.

9. **Review**
   Check unsupported claims, weak transitions, tone drift, golden style misses, house structure misses, target specificity, member action clarity, generic filler, and mechanical preview text.

10. **Progressive Language Review**
    Check people-first framing, self-identification, active voice, precise terms, dignity, and stigmatizing language.

11. **Revision**
    Apply safer rewrites and progressive language changes. Return campaigner-visible email output plus concise reviewer notes.

## Campaign Type Defaults

### Petition

- Default audience: existing supporters likely to take a quick public action.
- Default action: sign the petition.
- Constraints: one public action, one clear decision-maker, concrete and quick rather than symbolic.
- Banned claims: do not claim signing guarantees a policy win; do not imply refusal or bad faith unless sourced.
- Required points: make the action quick and specific; show why pressure now matters; follow the mandatory petition structure from `campaign-email-structure-requirements.md`.
- Preferred sources: official reports, official updates, hearing summaries, research briefs, reputable news.
- Required structure: box text, ATL with 2-4 short paragraphs, first petition landing-page CTA after ATL, BTL with evidence/context, second petition landing-page CTA in BTL or near the close, movement story, and sources.

### Fundraiser

- Default audience: existing supporters likely to make a small or mid-sized gift.
- Default action: make a donation.
- Constraints: respectful, specific, evidence-led fundraising ask.
- Banned claims: do not imply each gift guarantees a precise impact unless sourced; do not overstate urgency.
- Required points: explain why giving now matters; make the donation ask practical and proportionate.
- Preferred sources: official reports, official updates, research briefs, reputable news.

## Template Themes

### Urgent Public Pressure

- Tone: urgent, direct, accountability-focused, evidence-led.
- Hook: immediate pressure on a named decision-maker and one concrete source-backed stake.
- Why now: frame delay as a real problem without overstating evidence.
- CTA: immediate, practical, worth doing today.
- PS: restate urgency in one clear line.

### People-First Local

- Tone: warm, people-first, community-rooted, grounded.
- Hook: human stake and why local communities deserve a practical response.
- Why now: lived consequences and community dignity rather than abstract outrage.
- CTA: useful, collective, respectful.
- PS: end on people affected, not institutional process.

### Hopeful Momentum

- Tone: determined, constructive, forward-looking.
- Hook: a concrete opening that suggests a real chance to move this forward.
- Why now: show why this is a moment to build momentum.
- CTA: next practical step in building momentum.
- PS: reinforce forward movement rather than fear.

## House Email Structure

- Prefer one ask-led subject line and one curiosity-led subject line.
- Keep subject lines short enough for mobile.
- Avoid clickbait that promises facts the email does not deliver.
- Preview text should reinforce either the ask or the stake.
- Lead with one concrete development from a source whenever possible.
- If evidence is thin, lead with a cautious supporter-facing stake.
- Body flow: problem or trigger, why it matters now, one clear ask, collective impact.
- CTA: one verb, named decision-maker where relevant, quick practical action.
- Petition CTA placement: for petition drafts, the same petition ask must appear twice -- once immediately after ATL and once in BTL or near the close.
- Signoff: warm collective signoff.
- PS: only if it adds urgency or reinforces one important point.

## Member Action Evaluation

Treat target readiness as a launch gate:

- `specific`: a named decision-maker or institution with power.
- `generalized`: broad terms such as government, companies, leaders, authorities, regulators, industry, or decision-makers.
- `missing`: no target detected.

Ready campaigns usually have:

- a specific Target of Change
- a clear member action such as sign, email, call, donate, share, reply, join, or attend
- a pressure channel that explains why the action reaches or affects the target

If the target is weak, suggest stronger issue-based targets, for example:

- transport/air quality: Mayor of London, Transport for London, Secretary of State for Transport
- climate/environment/water/nature/planning: Environment Secretary, Environment Agency, Secretary of State for Environment, Food and Rural Affairs
- foreign policy/war/human rights/trade: Foreign Secretary, Prime Minister
- worker/labour/supply chains: Business Secretary, company leadership
- finance/banking/investment: Financial Conduct Authority, company board

## Finalization Gate

Before treating a draft as ready, check:

- usable evidence exists
- CTA is concrete
- member action readiness is `ready`
- review stage completed
- golden style non-negotiables pass
- house style readiness passes
- progressive language review completed
- unsupported claims have safer rewrites
