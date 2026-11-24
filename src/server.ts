import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const center = process.env.WORDRAVA_CENTER_URL;
if (!center) throw new Error('WORDRAVA_CENTER_URL is required.');
const parsedCenterUrl = new URL(center);
const internalAllowed = process.env.WORDRAVA_ALLOW_INTERNAL_HTTP === 'true' &&
  parsedCenterUrl.protocol === 'http:' && parsedCenterUrl.hostname === 'center-api' &&
  (parsedCenterUrl.port === '' || parsedCenterUrl.port === '8080');
if (parsedCenterUrl.protocol !== 'https:' && !internalAllowed) {
  throw new Error('Center requires HTTPS, except the explicitly enabled center-api Docker network address.');
}
if (parsedCenterUrl.username || parsedCenterUrl.password || parsedCenterUrl.search || parsedCenterUrl.hash) {
  throw new Error('Center URL must not contain credentials, query, or fragment.');
}
const base = center.replace(/\/$/, '');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', component: 'mcp', version: '0.1.1' }));

class CenterHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Center returned HTTP ${status}`);
  }
}
async function centerGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(base + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!response.ok) throw new CenterHttpError(response.status);
  return await response.json() as T;
}
function getBearer(req: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.header('authorization') ?? '');
  return match?.[1] ?? null;
}
function makeServer(token: string): McpServer {
  const server = new McpServer({ name: 'WordRava', version: '0.1.1' });
  server.tool('wordrava_list_sites',
    'List WordPress sites owned by your WordRava account, including whether each site is blocked. Read-only; blocked sites cannot perform operations.',
    {}, async () => {
      try {
        const sites = await centerGet<unknown[]>('/api/v1/sites', token);
        return { content: [{ type: 'text' as const, text: JSON.stringify(sites) }] };
      } catch {
        return { isError: true, content: [{ type: 'text' as const, text: 'Unable to retrieve your connected sites.' }] };
      }
    }
  );
  server.tool('wordrava_my_account',
    'Get WordRava account identity and role; no password or secret data.',
    {}, async () => {
      try {
        const account = await centerGet<unknown>('/api/v1/me', token);
        return { content: [{ type: 'text' as const, text: JSON.stringify(account) }] };
      } catch {
        return { isError: true, content: [{ type: 'text' as const, text: 'Unable to retrieve account.' }] };
      }
    }
  );
  server.tool('wordrava_site_usage',
    'Check the current plan-based daily operation quota of a site. Free defaults to 200 successful operations per UTC day; admins may change plan limits. Blocked sites cannot use quota. Read-only.',
    { site_id: z.string().uuid() }, async ({ site_id }) => {
      try {
        const usage = await centerGet<unknown>(`/api/v1/usage/${site_id}`, token);
        return { content: [{ type: 'text' as const, text: JSON.stringify(usage) }] };
      } catch {
        return { isError: true, content: [{ type: 'text' as const, text: 'Site is blocked, unavailable, or you do not have access to its quota.' }] };
      }
    }
  );
  server.tool('wordrava_capabilities',
    'Show the currently supported WordRava Center protocol, plan/quota capabilities and beta limitations. Read-only.',
    {}, async () => {
      try {
        const capabilities = await centerGet<unknown>('/api/v1/capabilities', token);
        return { content: [{ type: 'text' as const, text: JSON.stringify(capabilities) }] };
      } catch {
        return { isError: true, content: [{ type: 'text' as const, text: 'Unable to retrieve current Center capabilities.' }] };
      }
    }
  );
  return server;
}

// Beta-only bearer bridge: not a public ChatGPT OAuth implementation.
// A production ChatGPT app must implement OAuth 2.1/PKCE discovery and token verification.
app.post('/mcp', async (req: Request, res: Response) => {
  const token = getBearer(req);
  if (!token) { res.status(401).json({ error: 'Bearer authentication required' }); return; }
  try {
    await centerGet('/api/v1/me', token);
  } catch (error) {
    const blocked = error instanceof CenterHttpError && error.status === 403;
    res.status(blocked ? 403 : 401).json({ error: blocked ? 'WordRava account is blocked or revoked' : 'Invalid WordRava authentication' });
    return;
  }
  if (!isInitializeRequest(req.body) && !req.body?.jsonrpc) {
    res.status(400).json({ error: 'Invalid MCP request' }); return;
  }
  const server = makeServer(token);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
  } finally {
    res.on('close', () => { void transport.close(); void server.close(); });
  }
});
app.get('/mcp', (_req, res) => res.status(405).send('Stateless MCP: use POST'));
app.delete('/mcp', (_req, res) => res.status(405).send('Stateless MCP: use POST'));

const port = Number(process.env.PORT ?? '3100');
app.listen(port, '0.0.0.0', () => console.log(`WordRava MCP beta listening on :${port}`));
