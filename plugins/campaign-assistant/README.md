# Campaign Assistant Plugin

Campaign Assistant is a strict Codex plugin. It runs inside Codex through text prompts, skill instructions, and the `super-search` HTTP MCP server for mailing memory.

## Plugin Contents

- `.codex-plugin/plugin.json` - plugin manifest
- `.mcp.json` - production HTTP MCP server config for `super-search`
- `skills/campaign-assistant/SKILL.md` - primary Codex skill
- `skills/campaign-assistant/references/` - drafter-inspired workflow, prompt templates, and language guidance
- `skills/campaign-assistant/references/example-mailings/` - curated historical mailing examples for draft voice and format anchors

There is no local web app in this plugin.

## Mailing Memory

The plugin expects `super-search` to expose production MCP at:

```bash
https://labs.eko.org/mcp
```

Production access requires a bearer token in:

```bash
EKO_SUPER_SEARCH_MCP_TOKEN
```

The plugin sends that token through the `super-search-mailing-memory` MCP server config.

Recipients do not need to run `super-search` locally. The installed plugin calls the remote MCP server above and sends the bearer token from `EKO_SUPER_SEARCH_MCP_TOKEN`.

For Codex app users who do not use the Codex CLI, run the zip-level helper:

```text
scripts/setup-campaign-assistant-token.command
```

It prompts for the token, stores it locally with restricted permissions, and
sets up a macOS login loader so Codex.app can read `EKO_SUPER_SEARCH_MCP_TOKEN`
after restart.

When strategizing, the skill calls `campaign_strategy_memory` to fetch strong historical analogues, optional lower-performing analogues, benchmarks, and strategy prompts. When drafting, it calls `high_performing_examples` to fetch a few similar, high-performing historical mailings as voice and format references.

The plugin also includes three static DB-sourced examples so drafts still have concrete house-format anchors:

- `killer-ai-petition-2026.md`
- `tetley-workers-rights-petition-2014.md`
- `mcdonalds-workers-call-in-2014.md`

## Usage

After installing the plugin, start a new Codex thread and ask for work such as:

- `Draft a petition email from this campaign brief: ...`
- `Strategize this campaign using similar past mailings: ...`
- `What have we tried before on this issue, and what seemed to perform?`
- `Review this mailing draft against the campaign language guide: ...`
- `Turn these source notes into a campaign email with subject lines, preview text, evidence map, and warnings.`

The skill follows the drafter pipeline: intake, source/evidence prep, mailing memory retrieval, strategy support, voice retrieval, structure, member-action evaluation, drafting, fact check, review, progressive language review, and revision.
