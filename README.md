# Campaign Assistant

Campaign Assistant is a Codex-native plugin for campaign email drafting and review.

There is no companion web app. The plugin works through the Codex skill at `plugins/campaign-assistant/skills/campaign-assistant/SKILL.md` and can use the production `super-search` HTTP MCP server for historical mailing memory.

## Install

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

If the Codex app is installed but `codex` is not on your shell path, use the bundled macOS binary:

```bash
/Applications/Codex.app/Contents/Resources/codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

After installing the marketplace, restart Codex, open Plugins, select the marketplace, and install `campaign-assistant`. Start a new Codex thread so the skill instructions are loaded.

## What The Plugin Does

- turns rough campaign ideas into evidence-aware campaign email drafts
- helps campaigners strategize using similar high-performing and cautionary historical mailings
- mirrors the staged drafter pipeline
- retrieves a few similar high-performing historical mailings from `super-search`
- includes three curated DB-sourced mailing examples as static draft voice and format anchors
- applies the house golden style guide
- checks target-of-change and member-action readiness
- fact-checks claims against supplied or discovered evidence
- applies progressive language guidance
- returns campaigner-visible output plus warnings and review notes

## Mailing Memory MCP

The plugin points at:

```bash
https://labs.eko.org/mcp
```

For local development, run the server from the `super-search` repo and temporarily point the plugin's `.mcp.json` back to `http://127.0.0.1:8080/mcp`:

```bash
MCP_AUTH_MODE=none go run ./cmd/server
```

The plugin uses:

- `campaign_strategy_memory` for planning, "what have we tried before", target/CTA strategy, and sequencing questions
- `high_performing_examples` for drafting voice and format references
