# OpenAI Sites deployment

Use the bundled Sites building and hosting skills for every generated project. The
generator creates a Vinext app with a Cloudflare Worker API and
`.openai/hosting.json`.

## Project and source

1. Read `.openai/hosting.json`.
2. If `project_id` exists, reuse it exactly. Otherwise create the site once and write
   the returned opaque id to `project_id` immediately.
3. Keep the generated site in its own Git repository. Commit the exact tested source
   state and push that commit to the Sites source repository using a short-lived
   credential. Never persist or print the credential.
4. Build and package the same commit with the Sites packaging script. The archive and
   `commit_sha` must identify the same source state.
5. Save a site version from that commit and archive. Deploy only the saved version.

Do not create a second Sites project for the same local directory. Never invent,
transform, or substitute a project, version, or deployment id.

## Runtime environment

Store production values with the Sites environment-variable controls:

- `CHAMPAIGN_API_HOST`: non-secret upstream origin
- `VERCEL_SECRET`: secret
- `MICROSITE_DEMO_MODE`: `true` for previews; `false` only after live approval
- `TURNSTILE_SITE_KEY`: non-secret browser key
- `TURNSTILE_SECRET_KEY`: secret
- `REQUIRE_TURNSTILE`: `true` for live donation traffic
- `REQUIRE_DEVICE_DATA`: `true`

Do not store these values in `.openai/hosting.json`. Deploy a new saved version after
an environment revision so the production deployment receives it.

## Access and launch

Prefer an owner-only deployment for the first hosted preview. Use the private deploy
path only after verifying that the current caller is the sole allowed viewer and no
groups have access. A public/shared deployment or access change requires explicit
approval because every Sites deployment URL is production.

Poll non-terminal deployments to completion. On success, return the production URL and
open it in Codex for a petition → share → donation smoke test. Keep demo mode or
Braintree sandbox enabled until the campaigner explicitly approves the live switch.
