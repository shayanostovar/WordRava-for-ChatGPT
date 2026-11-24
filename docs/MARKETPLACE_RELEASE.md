# WordRava ChatGPT + Codex Plugin: submission runbook (v0.2.0)

## Scope actually implemented in the repositories

- Center: OAuth Authorization Code + PKCE-S256, short-lived access JWT, hashed and rotating refresh tokens, stored authorization codes, user blocking and per-session revocation; **feature-flagged OFF until compiled, deployed and tested**.
- MCP: public protected-resource metadata, strict OAuth session validation, stateless Streamable HTTP. Tools: account, sites, plan quota, capabilities, site overview, installed plugins, menus, posts/pages list/get, draft create/update, job status.
- WordPress Connector: outbound poll of owner-authorized job queue with site-specific random key; WordPress admin opt-in for creating/updating **drafts only**. Upgrade 0.1.x pairing without changing site ID. WP-Cron requires traffic or a real cron.
- Writes require OAuth content:write, WordPress opt-in, draft status and user confirmation. **No publishing, deleting, arbitrary PHP, shell, SQL or unrestricted page builder changes.**

## Mandatory live verification BEFORE uploading for review

1. Build/test Center using .NET 10 and disposable PostgreSQL. The Center private repository's GitHub-hosted CI is presently blocked at runner provisioning; **do not deploy uncompiled source**.
2. Install the updated WordRava-only Nginx vhost and run `nginx -t` before a reload; it routes `/oauth/*` and OAuth discovery to Center and protected-resource discovery to MCP.
3. Set Center env `WORDRAVA_PUBLIC_ORIGIN=https://wordrava.shayanostovar.com`, `WORDRAVA_OAUTH_CLIENT_ID=wordrava-chatgpt`, `WORDRAVA_OAUTH_REDIRECT_URIS=<EXACT CALLBACK PROVIDED IN OPENAI PORTAL>`, `WORDRAVA_OAUTH_ENABLED=true` only when deployment is validated, and enable `WORDRAVA_OPERATIONS_ENABLED=true` only after staging acceptance tests. Both flags default to false.
4. Deploy Center 0.2.x first, then MCP 0.2.x. Do not enable the MCP auto-deploy before Center OAuth endpoints and auth gates work.
5. Install/upgrade WordPress Connector 0.2.0 on a TEST WordPress site. Generate new pairing code; click Upgrade Secure Connection to retain existing site ID. Test read jobs; opt in to draft writes only on a staging site.
6. Verify GET `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`; verify an unauthenticated POST `/mcp` yields 401 plus WWW-Authenticate; verify OAuth issuer, resource, audience, S256, code one-time use, refresh rotation, grant revocation, blocked user and cross-tenant denial. Do not log tokens or client secrets.
7. Test the MCP in ChatGPT Plugins with Add custom MCP server, OAuth login, reviewer's connected test WordPress site, and every documented tool. The v0.2.0 job tools are asynchronous: call `wordrava_job_status` after WordPress cron sync.

## Package and submit

- Run `python3 scripts/build_plugin.py` to generate `dist/wordrava-chatgpt-plugin-0.2.0-review-draft.zip`.
- Before publication, replace the provisional W logo with approved branding; check the icon content/contrast.
- **Blocker: public legal pages**. The package lists `/support.html`, `/privacy.html` and `/terms.html` on WordRava's domain. These must be fully authored, legally reviewed, deployed, and publicly reachable. Do not submit broken/placeholder URLs.
- Verify the OpenAI developer/business publisher identity and that the submitting organization has Apps Management Write.
- In <https://platform.openai.com/plugins>, upload the ZIP, connect the MCP server, perform the domain challenge at the exact URL supplied, authenticate using the reviewer account, wait for tool scan, and fix findings.
- Provide a DEDICATED reviewer WordRava login with sample site, staging WordPress test data, no MFA, access to draft tools, demo video URL, exactly 5 positive / 3 negative review tests, and release notes. Enter credentials only in the secure review form, never the ZIP or a Git repo.
- Submit for review; after approval explicitly Publish. Initial approval/public release cannot be completed from repository changes alone.

## Deployment cautions

Never change other Nginx virtual hosts on the shared WordRava VPS. Separate immutable SHA docker images and back up WordRava PostgreSQL before Center rollout. New data stores and migrations need a restore rehearsal; a healthy /health endpoint alone does not verify OAuth or WP writes. Operations have their own feature flag; default OFF. All official submission acceptance criteria must be met.
