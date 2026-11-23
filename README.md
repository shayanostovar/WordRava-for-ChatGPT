# WordRava for ChatGPT

WordRava's MCP server and ChatGPT integration.

This repository exposes authenticated tools to inspect registered WordPress sites and, after explicit approval, safely request changes through [WordRavaCenter](https://github.com/shayanostovar/WordRavaCenter) and the [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector).

**Principles:** OAuth 2.1 / PKCE-compatible authentication; separate read and write tools; tenant-level authorization; no secrets in tools or logs; per-site quota enforced in Center; bilingual user-facing instructions.

**Status:** private-beta foundation under development. Public ChatGPT distribution requires OpenAI review and a publicly reachable HTTPS deployment.
