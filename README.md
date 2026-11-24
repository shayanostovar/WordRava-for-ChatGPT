# WordRava for ChatGPT and Codex

WordRava Plugin v0.2.0 connects WordPress sites to ChatGPT through your own WordRava Center using an OAuth 2.1 authorization-code + PKCE flow and a remote Streamable HTTP MCP server.

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
