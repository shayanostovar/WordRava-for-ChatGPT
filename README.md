# WordRava for ChatGPT

WordRava's MCP server and ChatGPT integration.

This repository currently exposes **four read-only authenticated MCP tools** to inspect registered WordPress sites, account identity, plan-driven usage and Center capabilities. Future tools may request explicitly approved changes through [WordRavaCenter](https://github.com/shayanostovar/WordRavaCenter) and the [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector).

**Principles:** OAuth 2.1 / PKCE-compatible authentication; separate read and write tools; tenant-level authorization; no secrets in tools or logs; per-site quota enforced in Center; bilingual user-facing instructions.

**Status:** private-beta MCP 0.1.1, protocol 1.0, **no write tools**. The current bearer-JWT bridge is for developer testing, not public ChatGPT OAuth. Public distribution requires OAuth 2.1/PKCE, security review, privacy disclosures and app review. Blocked accounts and blocked-site usage are denied by Center on each request.
