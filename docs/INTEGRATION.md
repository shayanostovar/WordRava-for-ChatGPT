# WordRava MCP runtime integration — 1.1.1

This service exposes a stateless Streamable HTTP MCP endpoint. It delegates account, scope and site authorization to WordRava Center on every request. It never accepts an administrator JWT as a substitute for a Center OAuth session.

## Run

Use Node.js 22 or newer, install the lockfile dependencies with `npm ci`, set `WORDRAVA_CENTER_URL`, and run `npm start`. `npm run dev` enables local source watching; `npm run build` type-checks and `npm test` exercises the public MCP protocol.

Center normally requires HTTPS. The sole HTTP exception is the explicitly enabled private Docker address `http://center-api:8080` with `WORDRAVA_ALLOW_INTERNAL_HTTP=true`. URLs containing credentials, queries or fragments are rejected. `WORDRAVA_PUBLIC_ORIGIN` must be a plain HTTPS origin and defaults to the production WordRava host. `PORT` defaults to 3100.

Public routes:

| Route | Behavior |
| --- | --- |
| `POST /mcp` | OAuth-authenticated MCP requests. |
| `GET /health` | Component/version liveness; not a database or WordPress acceptance test. |
| `GET /.well-known/oauth-protected-resource` | Resource, issuer, scopes and public documentation/legal URLs. |
| `GET /.well-known/oauth-protected-resource/mcp` | Same resource metadata for path-aware clients. |

The reverse proxy exposes the health route as `/mcp/health` beside Center's `/health`.

## OAuth and identity

`marketplace/mcp.json` declares the universal production URL and a provided public client (`wordrava-chatgpt`, token authentication `none`). Center implements authorization code + PKCE S256, exact redirect matching, resource/audience checks, refresh rotation and revocation. The MCP server validates `/api/v1/oauth/session` before each request, including tools/list. Tokens must identify an OAuth session and grant `sites:read`.

Initial scopes are `sites:read content:read`. An attempted write without `content:write` returns `isError:true` and `_meta["mcp/www_authenticate"]` for reauthorization. WordPress permissions remain separate from OAuth consent.

`wordrava_my_account` is the profile tool. It returns the stable Center account ID, plus available display email/name. IDs do not derive from email or tokens. General account/site results omit unused owner IDs, plan IDs and creation timestamps.

Connection help describes the browser-only Quick Connect path. Public tools never receive the one-time pairing code. The browser continues through `/oauth/connect-wordpress` and the WordPress administrator confirms the existing request. `wordrava_list_sites` verifies the final connection.

## Public tool boundary

Each public operation has an independent name, input schema, successful output schema, explicit annotations and per-tool OAuth declaration. There are 35 tools. Generic operation executors, arbitrary REST route execution and arbitrary Ability dispatch are intentionally excluded even where older connector internals retain compatibility code.

Pure account/status reads advertise `readOnlyHint:true`. A queued WordPress read persists a Center job and reserves quota, so its hint is false. Overwrites, publication, installed-site administration, SEO writes and package installation carry destructive hints. Temporary file staging is an additive state change. Public source downloads and effects on publicly visible content carry open-world hints.

## Asynchronous job protocol

Named tools submit known operation kinds to `POST /api/v1/sites/{siteId}/jobs`. The connector polls outbound; it executes under the paired WordPress user's native permissions and completes the result. Poll with `wordrava_job_status` or `wordrava_operation_status` until completion.

Successful submission returns `operation`, `job_id`, `status`, optional polling/reuse information and a next step. Use the same `request_id` UUID for a retry of the same approved write; it becomes the `Idempotency-Key` header. Changed content with the same key is a conflict. Do not submit another write merely because a previous job is pending.

Success results are schema-validated in `structuredContent` and also serialized as JSON text. Errors set `isError:true` and serialize `{ "ok": false, "error": { "code": "...", "message": "..." } }` in text content. Error-only structuredContent is deliberately omitted because current SDK clients may validate it against the success schema. Raw HTML, tracebacks and arbitrary error response bodies are never returned.

## SEO payloads

`wordrava_get_seo` submits `seo_read` using `contentType` post/page, positive `itemId`, provider in `title` (`auto`, `yoast`, `aioseo`) and `content:"{}"`. It requires `content:read`. Auto selection cannot silently choose between two active providers.

`wordrava_update_seo` submits `seo_update`, explicit provider, `expectedModifiedGmt`, confirmation and JSON content containing `fields` plus `expected_seo_revision`. The connector checks both revisions and its local SEO/write permissions; published content also requires publication permission.

Normalized fields are title, description, canonical, robots_noindex, robots_nofollow, og_title, og_description, og_image, twitter_title, twitter_description and twitter_image. A provider's `supported_fields` is authoritative. Text/URL overrides may be cleared with an empty string; null writes and unknown keys are rejected. Robot writes are booleans; read values may be null when inherited.

## ZIP file workflow

`wordrava_stage_package` is the native ChatGPT attachment entry point. `_meta["openai/fileParams"]` names the top-level `file` object. Its schema declares required `download_url` and `file_id`, plus optional `mime_type` and `file_name`. Filesystem paths and opaque Library strings are invalid inputs.

The tool sends `{package_type, file}` to the owner-scoped Center stage endpoint. Center bounds the public HTTPS download, validates network destinations/redirects and ZIP structure, stores it temporarily and returns a connector-authenticated source URL, digest, size and 30-minute expiry. The 45-second MCP request deadline accommodates Center's bounded 30-second fetch.

Inspection tools submit `inspect_plugin_zip` / `inspect_theme_zip` with JSON `{source_url}`. Installation tools submit `install_plugin_zip` / `install_theme_zip`, expected slug in `title`, and JSON `{source_url,sha256,expected_version}`. The user must approve the exact inspected package. The worker rechecks downloaded bytes, package identity, local installation opt-ins and native capabilities, refuses an existing directory and never activates it. An expired URL requires restaging and inspection, not bypassing validation.

## Versions and verification

Center, Connector and MCP are coordinated at 1.1.1. The wire protocol remains 1.0 and the shared JSON schema is 1.3. Tests verify that the public tool catalog matches the shared contract. Production readiness still requires deployed OAuth and WordPress workflow evidence; local tests and a healthy process are not marketplace approval.
