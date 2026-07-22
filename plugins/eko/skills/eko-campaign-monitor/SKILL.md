---
name: eko-campaign-monitor
description: Use when campaigners want daily, recurring, or one-off monitoring updates for an Eko campaign, petition, fundraiser, or email draft. Creates a tailored monitoring prompt from the mailing draft, including target, demand, sources, evidence gaps, search queries, risk checks, and campaigner-ready briefing format; can hand off to Codex automations when the user asks to schedule notifications.
---

# Eko Campaign Monitor

Use this skill when the user asks to monitor a campaign, create a daily alert, track news, watch for updates, set up recurring notifications, or generate a reusable monitoring prompt for an Eko mailing or campaign draft.

This skill creates the monitoring workflow and prompt. It does not itself wake up on a schedule. When the user asks to schedule reminders or notifications, use the available Codex automation tools instead of only returning prompt text.

## Workflow

1. Read the available campaign email, petition draft, campaign brief, source map, or strategy notes.
2. Extract a monitoring profile:
   - campaign title
   - campaign goal
   - action type
   - target of change
   - escalation targets
   - demanded action
   - pressure channel
   - email angle
   - priority sources already used
   - core factual claims
   - evidence gaps and launch risks
   - named organizations, people, regulators, partners, and opponents
   - geography, language, and date window
3. Build search queries from the target, demand, issue terms, campaign angle, named people, and evidence gaps.
4. Generate a campaign-specific daily monitoring prompt.
5. If the user asks to schedule the monitor, search for the automation tool first and use it when available. Default to the user's timezone and a weekday morning cadence unless the user gives a different cadence.
6. If automation tools are unavailable, return the prompt and a clear note that it can be run manually or scheduled later.

## Extraction Rules

- Keep one primary target of change. Put secondary decision-makers under escalation targets.
- Preserve uncertainty. If a target, source, or deadline is inferred from the draft rather than explicit, label it as inferred.
- Convert campaign claims into monitored claims so future updates can strengthen, weaken, or contradict them.
- Prefer precise search terms over broad issue phrases.
- Include official sources, reputable media, partner/NGO sources, regulatory sources, investor sources, and opposition/corporate PR sources where relevant.
- Treat historical mailing memory as strategy context only. Do not use past mailings as factual evidence for current campaign developments.
- Do not invent facts, quotes, dates, sources, outcomes, partners, or deadlines.

## Output Format

Return these sections unless the user asks for JSON or another format:

````markdown
## Campaign Monitor

- Monitor name:
- Recommended cadence:
- Delivery:
- Primary target:
- Demand:
- Pressure channel:
- Email angle:

## Search Focus

- Priority sources:
- Cautious sources:
- Named entities to watch:

## Search Queries

- ...

## Daily Monitor Prompt

```text
...
```

## Evidence Gaps To Watch

- ...

## Scheduling Note

...
````

If an automation is successfully created, include the automation name, cadence, delivery destination, and what it will report.

## Daily Monitor Prompt Template

Use this template and fill every placeholder from the monitoring profile. Remove irrelevant lines rather than leaving empty placeholders.

```text
Daily campaign monitor: {{campaign_title}}

Date: {{today}}

Campaign goal:
{{campaign_goal}}

Current email angle:
{{email_angle}}

Primary target:
{{target_of_change}}

Escalation targets:
{{escalation_targets}}

Demand:
{{demand}}

Pressure channel:
{{pressure_channel}}

Core factual claims to monitor:
{{monitored_claims}}

Known source base:
{{known_sources}}

Known evidence gaps:
{{evidence_gaps}}

Check for new developments from the last 24-48 hours relevant to this campaign.

Prioritize:
- Official statements, reports, filings, policy updates, or leadership comments from {{target_org}}
- Reputable news coverage about {{issue_terms}}
- Partner, NGO, union, community, investor, or coalition updates relevant to {{demand}}
- Regulatory, legal, parliamentary, shareholder, industry, or market developments that affect the campaign's theory of change
- New evidence that strengthens, weakens, or complicates the draft's factual claims

Use these search queries:
{{search_queries}}

Return a concise campaigner briefing:

1. Topline
- Mark as: No update / Watch / Useful for copy / Urgent
- One sentence explaining why

2. New Developments
- Date
- Source
- Link
- What changed
- Why it matters for the campaign

3. Campaign Implications
- Does this affect the target, demand, pressure channel, urgency, or email angle?
- Is there a new hook for email, social, petition page, press, or delivery?

4. Evidence Map
- Claim:
- Supporting source:
- Reliability:
- Safe campaign wording:

5. Risks and Gaps
- Flag weak sourcing, stale news, corporate PR framing, advocacy-only claims, unclear dates, contradictions, or claims that need verification.

6. Recommended Next Step
- Hold / update copy / prepare rapid response / contact partner / add source / escalate pressure.

Rules:
- Do not invent facts, quotes, dates, sources, or campaign outcomes.
- Distinguish official claims, media reporting, partner analysis, and opposition/corporate PR.
- Prefer cautious wording when evidence is incomplete.
- If nothing meaningful changed, say so clearly and include only the most relevant monitoring result.
```

## Scheduling Behavior

When the user asks to schedule daily notifications or recurring updates:

- Search for the Codex automation tool before responding.
- Use the generated daily monitor prompt as the automation instruction.
- Include the monitor profile in the automation prompt so the future run has enough context without relying on conversation memory.
- Default cadence: every weekday at 9:00 AM in the user's timezone.
- Default delivery: this Codex thread.
- If the user gives a different cadence, timezone, or destination, use that instead.
- If scheduling fails or no automation tool is available, return the manual prompt and explain that the schedule was not created.

## Example: Coca-Cola Reusable Packaging

For a draft asking Coca-Cola to reinstate its reusable packaging target:

- Primary target: Coca-Cola CEO Henrique Braun
- Escalation targets: Executive Chairman James Quincey and the board
- Demand: reinstate the 25% reusable packaging by 2030 target
- Pressure channel: brand reputation and executive accountability
- Email angle: Coca-Cola promised reuse, then dropped the measurable target
- Priority sources: Coca-Cola statements, investor materials, Break Free From Plastic, Grist, Oceana, As You Sow, Green Century, plastics treaty and packaging regulation coverage
- Evidence gaps: current leadership ownership of packaging strategy, partner/community testimony, decision window for delivery or escalation
