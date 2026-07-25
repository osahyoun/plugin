# Eko

Eko is a Codex-native plugin for campaign analytics, historical mailing memory,
campaign email drafting, and review.

There is no companion web app. The plugin works through the Codex skill at
`plugins/eko/skills/eko/SKILL.md` and uses the production `super-search` HTTP
MCP server for privacy-safe analytics, fundraising outcomes, and historical
mailing memory.

## Codex App Setup

After unzipping this repo:

1. Double-click:

```text
Install Eko.command
```

2. Fully quit and reopen Codex.
3. Start a new thread and use Eko.
4. Sign in with an allowed Eko Google Workspace account when campaign data or mailing memory first requires authentication.

The installer does not require the Codex CLI. It registers this folder as a
local Codex marketplace, enables `eko`, seeds the local Codex
plugin cache, and opens the plugin page when possible.

If macOS blocks the installer, right-click `Install Eko.command`,
choose Open, and approve the prompt.

### Manual Codex App Setup

If the installer cannot run, install through the Codex UI:

1. Open Codex app.
2. Open Plugins.
3. Click Add marketplace.
4. Set Source to the unzipped folder, for example:

```text
/Users/you/Downloads/eko-codex-plugin
```

5. Leave Git ref as `main` and Sparse paths blank.
6. Click Add marketplace.
7. Install or enable `eko`.
8. Start a new thread and sign in when mailing memory first requires authentication.

## CLI Setup

After unzipping this repo, run:

```bash
cd eko-codex-plugin
./scripts/codex-eko
```

The script will:

- add this folder as a Codex plugin marketplace
- open the plugin page in the Codex app on macOS, when possible
- launch the Codex CLI when requested

## Manual Install

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

If the Codex app is installed but `codex` is not on your shell path, use the bundled macOS binary:

```bash
/Applications/Codex.app/Contents/Resources/codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

After installing the marketplace, restart Codex, open Plugins, select the marketplace, and install `eko`. Start a new Codex thread so the skill instructions are loaded.

## What The Plugin Does

- turns rough campaign ideas into evidence-aware campaign email drafts
- answers aggregate questions about mailing performance, topics, fundraising,
  donors, and actions through constrained privacy-safe tools
- helps campaigners strategize using similar high-performing and cautionary historical mailings
- mirrors the staged drafter pipeline
- retrieves a few similar high-performing historical mailings from `super-search`
- includes three curated DB-sourced mailing examples as static draft voice and format anchors
- applies the house golden style guide
- checks target-of-change and member-action readiness
- fact-checks claims against supplied or discovered evidence
- applies progressive language guidance
- returns campaigner-visible output plus warnings and review notes

## Campaign Data and Mailing Memory MCP

The plugin points at:

```bash
https://labs.eko.org/mcp
```

Production campaign data and mailing memory use OAuth against `labs.eko.org`. Recipients do not
need to run `super-search` locally or handle a shared bearer token. When
authentication is required, Codex should send the user through Google sign-in;
the server restricts access to allowed Eko Workspace accounts.

The plugin uses:

- `campaign_analytics` for aggregate mailing-performance trends and comparisons
- `campaign_outcomes` for event-time giving, donor, and action outcomes
- `campaign_strategy_memory` for planning, "what have we tried before", target/CTA strategy, and sequencing questions
- `high_performing_examples` for drafting voice and format references

The two analytics tools are advertised only when their read-only databases are
configured and healthy on the production MCP service. Raw SQL, supporter
records, and database credentials are never exposed to the plugin.
