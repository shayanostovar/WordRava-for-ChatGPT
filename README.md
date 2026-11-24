# WordRava for ChatGPT and Codex

WordRava Plugin v1.0.2 connects WordPress sites to ChatGPT through your own WordRava Center using an OAuth 2.1 authorization-code + PKCE flow and a remote Streamable HTTP MCP server.

The plugin offers tools to view account identity and sites, plan quotas, site overview, plugins, menus, posts and pages. Initial OAuth linking requests **read-only scopes**; draft-edit permission is requested only when the user elects a write action, and Center has its own separate write kill switch. **Draft-only** create/update tools use an asynchronous, outbound-only WordPress Connector job queue and require WordPress administrator opt-in and explicit user approval. No publishing, deleting or arbitrary code execution.

## Current release state

Code has been prepared for an interoperable private beta; **public distribution is not yet cleared**. OAuth and job processing require coordinated Center 0.2.x and WordPress Connector 0.2.x deployment, staging security tests, public legal URLs, reviewer account, demo recording and OpenAI review. Center private-repo hosted CI has been failing before tests start; its uncompiled releases must not be deployed.

- [MCP implementation](src/server.ts)
- [Portable plugin package](marketplace/plugin.json)
- [MCP server + OAuth declaration](marketplace/mcp.json)
- [Submission and staging runbook](docs/MARKETPLACE_RELEASE.md)
- [Center](https://github.com/shayanostovar/WordRavaCenter)
- [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector)

Run `npm install && npm run build` to typecheck. Run `python3 scripts/build_plugin.py` to assemble a ZIP with both manifests at its root. Keep credentials and review accounts out of source code and ZIPs.

## Passwordless WordPress-first onboarding

Install WordRava on WordPress, open WordRava > Quick Connect as an administrator, generate a 10-minute code, and paste the displayed command into ChatGPT after connecting this MCP server. `wordrava_connect_wordpress` issues an admin-only confirmation link. After the WordPress admin approves, `wordrava_pairing_status` confirms the site and Center activates the account automatically with a Free plan. Center administrators may change account plans; site-specific overrides remain possible. Reconnecting a previously paired site with its existing connector key can recover the original account on a new browser; ChatGPT OAuth must be refreshed afterward. No WordPress password is sent to ChatGPT. These capabilities remain feature-gated until end-to-end tests and a coordinated production deployment are verified.


### Creator and visual identity

WordRava 1.0.2 — **By ShayanOstovar**: https://github.com/shayanostovar. The MCP and ChatGPT marketplace metadata share the gradient W mark with WordPress Connector and Center.


WordRava 1.0.2 retains OAuth least-privilege scopes. WordPress administrators can grant or revoke draft-write permission without re-pairing, but ChatGPT needs content:write OAuth consent for writes.


## WordRava 1.0.2 — ChatGPT-only feature set
Tools: `wordrava_discover_site` inventories installed plugins, active theme,
registered WordPress Abilities with input schemas, REST namespaces, post types
and taxonomies before creating an operation plan. `wordrava_list_media` reads
the Media Library, `wordrava_import_image` imports an approved public HTTPS
image with WordPress-safe request validation and a strict 8 MiB/MIME limit,
and `wordrava_publish_draft` publishes a revision-matched draft only after
the WordPress administrator enables the separate Publish permission and
explicitly approves the operation.

**Not implemented:** Arbitrary plugin Abilities execution, theme editing,
Elementor/Yoast native saves, multipart image bytes streamed from ChatGPT,
bulk Word/PDF-to-website composition, generic SQL access. Discovery does not
grant arbitrary capabilities; future support requires validation and tests.
WordRava currently uses outbound HTTPS WordPress polling and does not require
WordPress to preserve an inbound `Authorization` header.
