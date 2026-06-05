# Campaign Assistant

Campaign Assistant is a Codex-native plugin for campaign email drafting and review.

There is no companion web app. The plugin works through the Codex skill at `plugins/campaign-assistant/skills/campaign-assistant/SKILL.md` and can use the production `super-search` HTTP MCP server for historical mailing memory.

## Codex App Setup

After unzipping this repo:

1. Double-click:

```text
Install Campaign Assistant.command
```

2. Paste the Eko `super-search` MCP token when prompted.
3. Fully quit and reopen Codex.
4. Start a new thread and use Campaign Assistant.

The installer does not require the Codex CLI. It registers this folder as a
local Codex marketplace, enables `campaign-assistant`, seeds the local Codex
plugin cache, opens the plugin page when possible, and runs the token setup
helper.

The token is not included in this plugin zip and is not entered in the Add
marketplace dialog.

If macOS blocks the installer, right-click `Install Campaign Assistant.command`,
choose Open, and approve the prompt.

### Manual Codex App Setup

If the installer cannot run, install through the Codex UI:

1. Open Codex app.
2. Open Plugins.
3. Click Add marketplace.
4. Set Source to the unzipped folder, for example:

```text
/Users/you/Downloads/campaign-assistant-codex-plugin
```

5. Leave Git ref as `main` and Sparse paths blank.
6. Click Add marketplace.
7. Install or enable `campaign-assistant`.
8. Double-click:

```text
scripts/setup-campaign-assistant-token.command
```

That helper asks for the Eko `super-search` MCP token, stores it locally in
`~/.codex/campaign-assistant.env`, installs a macOS login loader so Codex can
see the token after future logins, and tells the user to restart Codex.

## CLI Setup

After unzipping this repo, run:

```bash
cd campaign-assistant-codex-plugin
./scripts/codex-campaign-assistant
```

The script will:

- ask for the Eko `super-search` MCP token without echoing it
- add this folder as a Codex plugin marketplace
- open the plugin page in the Codex app on macOS, when possible
- launch the Codex CLI with `EKO_SUPER_SEARCH_MCP_TOKEN` set for that run

To avoid pasting the token every time:

```bash
./scripts/codex-campaign-assistant --save-token
```

That stores the token in `~/.codex/campaign-assistant.env` with restricted file permissions and creates a reusable launcher at `~/.local/bin/codex-campaign-assistant`.

The desktop app launched from Finder or Dock may not inherit shell environment variables. For the first authenticated test, use the Codex CLI launched by this script.

If the plugin was installed before token auth was added, uninstall and reinstall it from the plugin page so Codex picks up the latest MCP config.

## Manual Install

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

If the Codex app is installed but `codex` is not on your shell path, use the bundled macOS binary:

```bash
/Applications/Codex.app/Contents/Resources/codex plugin marketplace add git@github.com:osahyoun/plugin.git
```

After installing the marketplace, restart Codex, open Plugins, select the marketplace, and install `campaign-assistant`. Start a new Codex thread so the skill instructions are loaded.

Set the MCP token before launching Codex:

```bash
export EKO_SUPER_SEARCH_MCP_TOKEN="your-token-here"
codex
```

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

Production mailing memory requires bearer-token auth. The plugin reads the token from:

```bash
EKO_SUPER_SEARCH_MCP_TOKEN
```

Recipients do not need to run `super-search` locally. The installed plugin calls the remote MCP server above and sends the bearer token from `EKO_SUPER_SEARCH_MCP_TOKEN`.

The plugin uses:

- `campaign_strategy_memory` for planning, "what have we tried before", target/CTA strategy, and sequencing questions
- `high_performing_examples` for drafting voice and format references
