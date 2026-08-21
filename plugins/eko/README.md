# Eko Plugin

Eko is a strict Codex plugin. It runs inside Codex through text prompts, skill
instructions, and the `super-search` HTTP MCP server for privacy-safe campaign
analytics, fundraising outcomes, and mailing memory.

## Plugin Contents

- `.codex-plugin/plugin.json` - plugin manifest
- `.mcp.json` - production HTTP MCP server config for `super-search`
- `skills/eko/SKILL.md` - primary Codex skill
- `skills/eko/references/` - drafter-inspired workflow, prompt templates, and language guidance
- `skills/eko/references/example-mailings/` - curated historical mailing examples for draft voice and format anchors

The main Eko skill works in Codex text. The bundled Campaign Microsite Builder
associates a campaigner-supplied Prosecco page URL with the campaign record and prepares
that existing page for the approved universal Ekō canvas. Campaign-specific story,
imagery, structure, scoped presentation, and allowlisted behaviours live in a versioned
page bundle. Native Prosecco components retain strict control of petition fields,
consent, CAPTCHA, member prefill, sharing, Braintree Hosted Fields, 3-D Secure, PayPal,
and submission endpoints.

The skill explicitly forbids recreating action or payment forms per microsite and
forbids adding campaign-specific branches to Prosecco as a publishing workaround. An
environment that does not yet advertise the universal page-bundle capability can host
a reviewable preview, but is not treated as ready for no-deploy microsite publishing.
A standalone Node package remains available only as an explicit non-production
prototype fallback.

## Campaign Data and Mailing Memory

The plugin expects `super-search` to expose production MCP at:

```bash
https://labs.eko.org/mcp
```

Production access uses OAuth against `labs.eko.org`. Codex should send
campaigners through Google sign-in and the server will only issue MCP tokens
for allowed `eko.org` Workspace accounts.

Recipients do not need to run `super-search` locally or paste a shared bearer token. The installed plugin calls the remote MCP server above and uses the server's OAuth metadata when authentication is required.

For quantitative work, the skill calls `campaign_analytics` for mailing-level
performance and `campaign_outcomes` for event-time fundraising and action
outcomes. When strategizing, it calls `campaign_strategy_memory` to fetch
strong historical analogues, optional lower-performing analogues, benchmarks,
and strategy prompts. When drafting, it calls `high_performing_examples` to
fetch a few similar, high-performing historical mailings as voice and format
references.

The plugin also includes three static DB-sourced examples so drafts still have concrete house-format anchors:

- `killer-ai-petition-2026.md`
- `tetley-workers-rights-petition-2014.md`
- `mcdonalds-workers-call-in-2014.md`

## Usage

After installing the plugin, start a new Codex thread and ask for work such as:

- `Draft a petition email from this campaign brief: ...`
- `Strategize this campaign using similar past mailings: ...`
- `What have we tried before on this issue, and what seemed to perform?`
- `How much was raised yesterday?`
- `Compare action rates by campaign topic over the last year.`
- `Review this mailing draft against the campaign language guide: ...`
- `Turn these source notes into a campaign email with subject lines, preview text, evidence map, and warnings.`
- `Use this Prosecco page to prepare a branded petition microsite with sharing and donations: https://actions.eko.org/en/a/example-campaign`

The skill follows the drafter pipeline: intake, source/evidence prep, mailing memory retrieval, strategy support, voice retrieval, structure, member-action evaluation, drafting, fact check, review, progressive language review, and revision.
