# WordRava for ChatGPT: private beta

This server implements a **limited stateless MCP endpoint** with three read-only tools: `wordrava_list_sites`, `wordrava_my_account`, `wordrava_site_usage`. They delegate authorization to WordRavaCenter.

## Run

1. Install Node.js 22+ and run `npm install`.
2. Provide `WORDRAVA_CENTER_URL` as an HTTPS URL.
3. Run `npm run dev`.
4. Use `npm run build` to typecheck.
5. A developer MCP client must send a WordRavaCenter JWT in an Authorization Bearer header.

**Important:** A short-lived JWT supplied manually by a developer is NOT the required public ChatGPT OAuth authorization flow. ChatGPT app installation, OAuth 2.1 discovery, PKCE, revocation, privacy policy and app review remain to be implemented. Do not publish this MCP endpoint as a production ChatGPT app or enable remote edits.

## API contract

Center:
- `GET /api/v1/me`
- `GET /api/v1/sites`
- `GET /api/v1/usage/{site_id}`

No arbitrary URLs, administrative commands, SQL, shell execution or write tools are exposed. Site authorization is enforced in Center on every request.

## Versions

MCP 0.1.0 is independently versioned from Center API 0.1.0 and WordPress Connector 0.1.0.
