# WordRava for ChatGPT v1.1.0

WordRava connects WordPress to ChatGPT through WordRava Center, OAuth authorization code + PKCE and a remote Streamable HTTP MCP server. **By ShayanOstovar**.

## Implemented tools

- Account identity, connected sites, effective per-site plans and live usage, including successful/reserved/failed counts and the next 00:00 UTC reset.
- Discovery of a site's plugins, theme, post types, taxonomies, REST namespaces, abilities and permission levels.
- Read posts/pages, media, menus, installed plugins/themes and site information.
- Read discovered WordPress REST routes and run explicitly read-only, non-destructive registered abilities through their native permission checks.
- Create/update drafts, import an approved HTTPS image, publish an approved unchanged draft, update published content and use recoverable trash/restore.
- Activate an already-installed theme or plugin, or deactivate an installed plugin, after site-administration opt-in and expected-state checks.
- Plan supported operations and inspect asynchronous operation results.

Initial OAuth linking requests read-only scopes. Writes require `content:write`, explicit approval and the corresponding WordPress administrator opt-in. Publication and site administration are distinct permissions. Center feature flags and tenant authorization are enforced on each call.

Dedicated Elementor/Divi/Bricks/WPBakery document editing adapters, native Yoast saves, arbitrary plugin/theme installation, PHP/shell/SQL execution, direct image bytes from ChatGPT and full-site snapshot rollback are not implemented. Discovery of a plugin does not imply editing support.

## WordPress-first onboarding

Install [WordRava Connector](https://wordrava.shayanostovar.com/download), open **WordRava → Quick Connect** as a WordPress administrator and generate the short-lived code. After connecting the MCP server, paste the displayed command into ChatGPT. Open the returned administrator-only confirmation link and approve. Pairing status confirms completion; the Center account activates with its assigned plan.

Existing-key recovery is ownership-checked. Pausing the connector or disabling remote writes does not silently grant a new OAuth scope. No WordPress password is sent to ChatGPT.

## Build, validate and package

```sh
npm install --no-audit --no-fund
npm run build
python3 tests/check_protocol.py
python3 tests/check_marketplace.py
python3 scripts/build_plugin.py
```

The review bundle is `dist/wordrava-chatgpt-plugin-1.1.0-review-draft.zip`, with both manifests at its root. The supplied WordRava PNG mark is used in the marketplace assets. Do not include credentials or reviewer secrets.

This is a private-beta integration. A successful repository release or deployment does not constitute OpenAI review or approval.

## Deployment

Main-branch CI validates source and publishes immutable SHA-tagged GHCR images. Center's existing restricted deployment workflow synchronizes the approved MCP image. Release tags and review-bundle filenames derive from the package version. The public readiness script checks the current coordinated version and OAuth metadata after rollout.

- [MCP implementation](src/server.ts)
- [Plugin metadata](marketplace/plugin.json)
- [MCP and OAuth declaration](marketplace/mcp.json)
- [Submission runbook](docs/MARKETPLACE_RELEASE.md)
- [Center](https://github.com/shayanostovar/WordRavaCenter)
- [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector)

## Release 1.1.0

Coordinated Center/Connector/MCP version; supplied ribbon branding across marketplace assets; corrected capability metadata and stale release paths. Existing account quotas, permissions, confirmation gates and operation behavior are preserved.
