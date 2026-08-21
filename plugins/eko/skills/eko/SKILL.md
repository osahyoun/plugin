---
name: eko
description: Use when campaigners need Codex-native campaign data analysis, fundraising and action outcomes, historical mailing memory, email drafting or review, CTAs, evidence-grounded copy, source-aware reviewer notes, progressive-language-safe campaign outputs, or routing into the campaign microsite workflow.
---

# Eko

Eko is a Codex-native plugin. Do not open or run a web app for this skill. Work
in Codex text, using the campaign data and mailing-memory MCP tools when
available.

For a campaign microsite, landing page, petition action page, sharing journey,
or Braintree donation flow, use `$campaign-microsite-builder`. That dedicated
skill validates the campaigner's existing Prosecco page URL, applies the approved
fast layout, and tests its native petition, sharing, and donation journey before
any approved public campaign launch.

Use this skill when the user asks to:

- draft an activist, nonprofit, or campaign email
- strategize a campaign using similar historical mailings
- answer what has been tried before on an issue, target, tactic, or language
- compare possible CTAs, targets, pressure channels, or mailing angles using past performance signals
- answer quantitative questions about mailing performance, campaign topics, fundraising, donors, or actions
- compare campaign performance across dates, languages, action types, tags, or canonical topics
- turn a rough campaign idea into mailing copy
- produce subject lines, preview text, body copy, evidence maps, or reviewer notes
- review a campaign mailing for target clarity, CTA strength, house voice, evidence support, or progressive language
- create or improve petition/fundraiser email copy
- prepare an existing Prosecco page as a working branded petition → share → donation microsite

## Required Reference Loading

For any substantive draft or review, read these reference files before producing the final answer:

- `references/drafter-workflow.md`
- `references/prompt-templates.md`
- `references/voice-and-language-guide.md`
- `references/campaign-email-structure-requirements.md`

For any substantive draft email, also read:

- `references/example-mailings/index.md`
- `references/example-mailings/killer-ai-petition-2026.md`
- `references/example-mailings/tetley-workers-rights-petition-2014.md`
- `references/example-mailings/mcdonalds-workers-call-in-2014.md`

Use only the relevant sections if the request is narrow.

## Operating Model

Mirror the drafter service pipeline:

1. Intake: normalize the raw brief without inventing facts.
2. Source posture: use supplied URLs or notes; if source discovery is needed and allowed, search for reliable primary or reputable sources. If evidence is missing, draft cautiously and mark the gap.
3. MCP routing: use `campaign_analytics` for quantitative mailing-performance questions, `campaign_outcomes` for donation- or action-event outcomes, `campaign_strategy_memory` for strategy and planning, and `high_performing_examples` for drafting.
4. Voice retrieval: apply the golden style guide and approved voice principles. Use patterns, not copied wording. Calibrate the emotional register from relevant historical examples.
5. Structure: build subject lines, preview text, hook, body flow, CTA, signoff, and optional PS before drafting. The hook should include a grounded emotional stake, not just background. For petition drafts, the outline must follow `references/campaign-email-structure-requirements.md`.
6. Member action evaluation: identify the Target of Change, target specificity, member action, action type, pressure channel, and readiness.
7. Drafting: write source-grounded campaign copy with one clear ask, one main verb, and one decision-maker whenever possible. Use medium-high emotion by default: vivid, human, morally clear, and urgent where the evidence supports it. For petition drafts, include the first petition landing-page CTA after ATL and repeat the same petition CTA in BTL or near the close.
8. Fact check: extract major factual claims and map each to supplied or discovered evidence.
9. Review: flag unsupported claims, generic filler, emotional dryness, CTA weakness, tone drift, target vagueness, and house style misses.
10. Progressive language review: check people-first framing, self-identification, precise terms, active voice, and stigmatizing language.
11. Revision: produce the final campaigner-visible output with safer wording and reviewer notes.

## Mailing Memory MCP

The plugin declares the HTTP MCP server `super-search-mailing-memory` at `https://labs.eko.org/mcp`. It calls that remote server directly and uses OAuth in production.

For campaign strategy, planning, "what have we tried before", CTA strategy, target strategy, sequencing, or campaign angle requests:

1. Call `campaign_strategy_memory` before recommending a strategy.
2. Pass the campaign brief, strategic question, campaign packet, or rough idea as `brief`.
3. Include `goal` when the user gives an objective such as petition signatures, donations, clickthrough, subject-line planning, awareness, or recruitment.
4. Let the tool infer `goal_metric` unless the user clearly asks for a specific metric.
5. Keep `include_underperformers` enabled unless the user only wants successful examples.
6. Use the returned `strong_analogues`, `lower_performers`, and `performance_benchmark` to identify signals and hypotheses, not proof of causality.
7. Return a strategy answer with the sections from the tool's `strategy_briefing.output_sections` when useful.

For substantive drafting requests:

1. Call `high_performing_examples` before writing the first draft.
2. Pass the campaign brief, campaign packet, source summary, or rough mailing idea as `brief`.
3. Request `limit: 3` unless the user asks for a different number.
4. Choose `goal_metric` from the campaign goal:
   - `action_rate` for petitions, pressure actions, and default campaign mailings.
   - `click_rate` when the main goal is clickthrough to a page.
   - `open_rate` when focusing on subject lines or preview text.
   - `donation_amount` or `orders` for fundraising mailings.
   - `relevance` when close topical similarity matters more than performance.
5. Include `language_code` or `tags` when the user provides them or they are clear from the brief.
6. Use returned examples as a voice and format guide only: paragraph shape, opener style, argument order, CTA placement, subject-line pattern, preview-text pattern, emotional register, urgency level, and signoff rhythm.
7. Never copy distinctive wording, facts, numbers, quotes, campaign claims, or example-specific framing into a new draft.
8. Use the curated static examples in `references/example-mailings/` as fallback and baseline house-format anchors. Prefer live MCP examples when they are more relevant, but always compare the draft structure against at least one curated example.

If the MCP server is unavailable, continue with the static references and add a warning that historical mailing memory was not available.

## Campaign Data MCP

The same `super-search-mailing-memory` MCP server can advertise two constrained,
privacy-safe data tools. Availability is conditional on the production service
having its read-only analytics databases configured.

### Tool routing

Use `campaign_analytics` for aggregate questions about mailings sent during a
date range:

- recipients, opens, clicks, actions, orders, mailing-attributed amount,
  unsubscribes, bounces, and complaints;
- recipient-weighted rates and average donation;
- trends or comparisons by period, campaign, language, action type, subject,
  raw tag, or accepted canonical topic; and
- identifying high-performing mailing cohorts before using `search` or `fetch`
  for specific creative examples.

Use `campaign_outcomes` for questions whose date refers to when a donation or
action happened:

- organisation-wide amount raised, donation records, or unique donors;
- unique action takers and action records;
- donor/action overlap; and
- outcomes attributed to a supported, versioned campaign topic.

Never calculate quantitative totals from semantic `search`,
`high_performing_examples`, or `campaign_strategy_memory` results. Those tools
return selected historical examples, not a complete analytical population. Do
not substitute mailing-attributed amount for event-time giving.

Examples:

- "How much was raised yesterday?" -> `campaign_outcomes` with
  `analysis=giving`, the same inclusive date for `date_from` and `date_to`, and
  `breakdown=none`.
- "How did action rate trend by topic last year?" -> `campaign_analytics` with
  `action_rate`, `recipients`, and `mailings`, grouped by period and topic.
- "Which subject lines did our strongest petitions use?" -> first use
  `campaign_analytics` to identify the relevant cohort, then use `search` or
  `fetch` for representative creative examples.

### Analytical safeguards

1. Resolve relative dates from the current conversation date and state the
   concrete inclusive date range used.
2. Treat outcome dates as UTC unless the tool adds an explicit timezone
   parameter. State this when a local-day boundary could change the answer.
3. Always report the returned freshness, active filters, denominator or cohort
   size, and applicable metric definitions.
4. For a closed-period outcome such as "yesterday", do not call the result
   exact if freshness does not extend beyond the requested period. Label it
   incomplete and explain that a catch-up sync is required.
5. Treat suppressed or missing groups as unavailable, never as zero.
6. Use recipient-weighted rates returned by `campaign_analytics`; do not
   average precomputed rates.
7. Topic and raw-tag groups can overlap. Do not sum those rows into an
   organisation-wide total.
8. Keep observational comparisons distinct from causal claims.
9. For substantial quantitative reports, use separate calls for the overview,
   time trend, and relevant driver cuts rather than forcing every grouping into
   one query.
10. If the required data tool is unavailable, say that the aggregate service
    is not configured or reachable. Do not replace it with an estimate from
    mailing memory.

## Strategy Output

When the user asks to strategize rather than draft, default to:

```markdown
## Similar Campaign Memory

- Strong analogues:
- Cautionary analogues:

## Performance Signals

- ...

## What Worked Before

- ...

## Cautions

- ...

## Strategic Options

### Option A: ...

### Option B: ...

## Recommended Direction

...

## Drafting Implications

- Subject/preheader:
- Opening:
- Body structure:
- CTA:
- Evidence needed:

## Open Evidence Gaps

- ...
```

Make clear when a recommendation is inferred from patterns in historical mailings rather than proven by controlled testing.

## Shared Rules

- Never fabricate facts, dates, numbers, quotes, legal findings, source URLs, target responses, or campaign outcomes.
- Preserve campaign intent while keeping claims proportionate to the evidence.
- Treat the canonical golden style guide as higher priority than any single example or user preference.
- Imitate style patterns from approved voice examples, not distinctive wording.
- Treat high-performing historical mailings as directional evidence of format and voice, not as factual sources for the new campaign.
- Treat strategy memory as performance signals and strategic hypotheses, not as deterministic proof that one tactic caused results.
- Treat curated example mailings as format and voice references only. Do not reuse their facts, claims, numbers, targets, worker stories, or distinctive phrases.
- Prefer concrete language over generic activist cliches.
- Avoid dry institutional prose. Make the supported human stakes, target accountability, moral tension, and collective agency visible.
- When evidence is insufficient, soften or remove claims instead of smoothing over the gap.
- Surface uncertainty explicitly when it affects launch risk.
- Keep the ask singular and practical. For non-petition emails, keep the main CTA near the end. For petition emails, follow the required ATL -> first petition link -> BTL -> second petition link structure.
- Use direct second-person language without sounding theatrical or self-congratulatory.
- Make urgency earned by evidence, not inflated rhetoric.
- Keep emotion source-grounded: preserve warmth and urgency without inventing stories, motives, deadlines, or momentum.

## Default Output

Unless the user asks for another format, return:

```markdown
## Final Email

Subject line: ...
Preview text: ...

...

## Alternatives

- Subject line options
- Preview text options

## Evidence Map

| Claim or section | Evidence | Source |
|---|---|---|

## Mailing Memory

- High-performing examples used:
- Strategy memory used:
- Curated example mailings referenced:
- Voice and format patterns borrowed:
- Performance rationale:

## Member Action Readiness

- Target of Change:
- Member action:
- Pressure channel:
- Readiness:

## Reviewer Notes

- ...

## Warnings

- ...
```

If the user asks for JSON, use the campaigner-visible contract:

```json
{
  "campaigner_visible_output": {
    "final_email": {
      "subject_line": "",
      "preview_text": "",
      "body_markdown": "",
      "citations_or_evidence_map": [],
      "reviewer_notes": []
    },
    "subject_line_options": [],
    "preview_text_options": [],
    "mailing_memory": {
      "examples_used": [],
      "strategy_memory_used": [],
      "curated_examples_referenced": [],
      "voice_and_format_patterns": [],
      "performance_rationale": []
    },
    "member_action_summary": {},
    "concise_rationale": [],
    "warnings": []
  }
}
```

## Drafting Boundaries

If the user provides no evidence for factual claims, produce either:

- a cautious draft that avoids unsupported specifics, plus warnings, or
- a short request for the minimum source material needed, if drafting would otherwise mislead.

Do not claim the plugin has run the drafter service. This plugin replicates the drafter workflow and prompt logic inside Codex; it does not call the drafter backend by default.
