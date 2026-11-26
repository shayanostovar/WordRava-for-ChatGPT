# WordRava ChatGPT plugin: submission runbook (v1.1.0)

## Current implementation

Center handles OAuth authorization code + PKCE-S256, token/session validation, quotas and audit records. MCP exposes tools for discovery, content, media, site inspection, approved content changes and activation of installed themes/plugins. WordPress executes allowlisted jobs through outbound HTTPS polling under the paired administrator's permissions.

Writes require OAuth `content:write`, the matching WordPress opt-in and per-operation confirmation. Publication and site administration have separate grants. Dedicated builder-editing adapters, permanent deletion, arbitrary installation and PHP/shell/SQL execution are not implemented.

## Verify before submission

1. Run the repositories' build, protocol, package and security checks. Run Center acceptance tests with disposable PostgreSQL before production rollout.
2. Deploy coordinated Center, MCP and Connector 1.1.0 using the existing WordRava-only deployment path. Verify immutable source SHAs and health versions.
3. Verify OAuth issuer, callback, resource/audience, PKCE S256, one-time authorization codes, refresh rotation, session revocation, blocked-user rejection and cross-tenant denial. Never record access tokens or client secrets.
4. Install the connector on a dedicated reviewer WordPress site. Pair using Quick Connect. Test reads first, then each permitted write with explicit approval.
5. Poll asynchronous jobs to completion and inspect the actual WordPress result. Check conflict and replay behavior. Test that each permission can be revoked.
6. Verify public privacy, terms and support pages and their accuracy. The readiness script checks HTTP endpoints; it cannot substitute for legal review or authenticated acceptance testing.
7. Verify all six positive and three negative scenarios in `marketplace/plugin.json` against the installed deployment.

## Package and submit

Run `python3 scripts/build_plugin.py` to create `dist/wordrava-chatgpt-plugin-1.1.0-review-draft.zip`. It includes the supplied WordRava ribbon PNG logo and both manifests at the archive root.

Use the current OpenAI submission UI to complete domain verification, OAuth configuration, tool scan and reviewer information. Keep reviewer credentials in the secure submission form; never add them to Git or the ZIP. Provide a dedicated demo site and recording. Address review findings before submitting.

Repository release, package creation and service deployment do not imply an approved public marketplace listing.

## Deployment scope

Use only WordRava's existing service and Nginx configuration on the shared VPS. Retain immutable images and the documented database backup/restore path. A healthy `/health` endpoint confirms the process and version, not end-to-end WordPress authorization.
