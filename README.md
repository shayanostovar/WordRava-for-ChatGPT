# WordRava for ChatGPT v1.2.0

WordRava connects WordPress to ChatGPT and Codex through WordRava Center, OAuth authorization code + PKCE and a remote Streamable HTTP MCP server. **By ShayanOstovar**.

## Implemented workflows

- Read connected sites, stable account identity and independent per-site capacity, including successful/reserved/failed counts and the next 00:00 UTC reset.
- Discover a site's installed plugins, active theme, post types, taxonomies and available WordRava permissions. Discovery does not grant access to arbitrary plugin operations.
- Read posts/pages, media, menus and installed themes/plugins.
- Create/update drafts, import an approved HTTPS image, explicitly publish an unchanged draft, update published content and recoverably trash/restore.
- Activate an installed theme/plugin or deactivate an eligible plugin after local administration opt-in and expected-state checks.
- Read and update supported per-post Yoast SEO or All in One SEO fields. Updates bind both the WordPress content revision and an adapter-specific SEO revision.
- Stage a ZIP attached through ChatGPT, inspect plugin/theme metadata and SHA-256, then explicitly approve installation of those exact bytes. Installation refuses overwrite and never activates the package automatically.
- Plan supported operations and poll asynchronous jobs to a verified result.

The public catalog contains **40 named tools** (five builder tools are a separately gated preview). Initial OAuth linking requests read access. Writes require `content:write`, explicit approval and the matching WordPress administrator opt-in. SEO, publication, site administration and code installation have separate local controls. Center feature flags, account/site ownership and native WordPress capabilities are enforced on each operation.

The connector executes jobs by outbound WordPress polling. WP-Cron or manual administration sync must run; queueing is not immediate execution. Read jobs reserve quota and are correctly annotated as stateful even though they do not edit WordPress.

## Scope and limitations

The SEO adapter covers supported post/page metadata; use the returned `supported_fields` before writing. It does not expose global SEO options, sitemaps, arbitrary schema templates or every premium feature. Native Elementor/Divi/Bricks/WPBakery document editing, arbitrary REST/ability dispatch, PHP/shell/SQL execution, permanent deletion and full-site snapshot rollback are not public tools.

ZIP structural inspection is not a malware or licensing guarantee. Package installation adds executable code, requires a separate local opt-in and explicit approval, rechecks the inspected digest/slug/version, refuses existing slugs and leaves the active theme/plugin state unchanged. Staged attachments are site-scoped, limited to 50 MiB and expire after 30 minutes.

## WordPress connection

A published Directory installation already declares the MCP server and OAuth configuration. End users select **Connect**; they do not type a server URL, client ID or scopes.

Install [WordRava Connector](https://wordrava.shayanostovar.com/download), open **WordRava → Quick Connect** as a WordPress administrator, and choose **Continue in browser**. Review the site in Center and explicitly approve the returned request in WordPress administration. Return to ChatGPT and list connected sites to verify completion. Keep the one-time code in that browser flow; never paste it into chat.

Existing-site recovery is ownership-checked. Disabling remote writes or pausing the connector cannot silently grant a new OAuth scope. WordPress credentials and pairing secrets are not inputs to any public tool.

## Build, validate and package

```sh
npm ci --no-audit --no-fund
npm run build
npm test
python3 tests/check_protocol.py
python3 tests/check_marketplace.py
python3 scripts/build_review_fixtures.py
python3 scripts/build_plugin.py
```

The reproducible review bundle is `dist/wordrava-chatgpt-plugin-1.2.0-review-draft.zip`, with both manifests at the archive root and the supplied original ribbon PNG assets. `npm test` exercises actual MCP transport and schemas against a disposable HTTPS Center mock. Connector and Center integration checks cover their corresponding live implementations separately.

Repository release and deployment are separate from OpenAI review and Directory publication. Owner identity, domain verification, reviewer access, a real demo video and the portal's scan remain required. No credentials or review secrets belong in the ZIP.

## Deployment and documentation

Main-branch workflows validate source and publish immutable SHA-tagged GHCR images. Center's restricted deployment workflow selects the approved MCP image. The coordinated application release is 1.2.0; the wire protocol remains 1.0 with shared schema1.3.

- [Runtime integration contract](docs/INTEGRATION.md)
- [English submission guide](docs/MARKETPLACE_RELEASE.md)
- [راهنمای فارسی انتشار](docs/MARKETPLACE_RELEASE_FA.md)
- [v1.1.1 pre-submission audit](docs/PRE_SUBMISSION_AUDIT_1.1.1.md)
- [Plugin metadata](marketplace/plugin.json)
- [MCP and OAuth declaration](marketplace/mcp.json)
- [Center](https://github.com/shayanostovar/WordRavaCenter)
- [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector)

## Release 1.2.0

Bounded native Elementor/Gutenberg preview: read, targeted text/HTML patch, registered Elementor controls, supported structure mutation and latest local snapshot restore. Full builder coverage is not implemented. Requires Center preview enabled after real integration testing and Connector 1.2.0. Supported theme icons and tool invocation metadata do not customize ChatGPT's global reasoning animation.

## Release 1.1.1

Adds concrete SEO adapters and attached ZIP inspection/installation tools; replaces generic public executors with individually reviewed named tools; moves pairing secrets into the browser-only flow; corrects job/upload annotations; declares structured success outputs and machine-readable safe errors; adds a real MCP protocol test suite, exact five-positive/three-negative review scenarios, deterministic review fixtures and bilingual publication guidance.

## Release 1.1.0

Coordinated Center/Connector/MCP version; supplied ribbon branding across marketplace assets; refreshed bilingual Center and administrator-managed WordPress download packages.
