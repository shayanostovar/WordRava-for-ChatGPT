import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const center = process.env.WORDRAVA_CENTER_URL;
if (!center || !center.startsWith('https://')) {
  throw new Error('WORDRAVA_CENTER_URL must be an HTTPS URL.');
}
const base = center.replace(/\/$/, '');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', component: 'mcp', version: '0.1.0' }));

async function centerGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(base + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Center returned HTTP ${response.status}`);
  return await response.json() as T;
}
function getBearer(req: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.header('authorization') ?? '');
  return match?.[1] ?? null;
}
function makeServer(token: string): McpServer {
  const server = new McpServer({ name: 'WordRava', version: '0.1.0' });
  server.tool('wordrava_list_sites',
    'List only the WordPress sites connected to the signed-in WordRava account. Read-only.',
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
    'Check daily site operation quota (200 successful operations per UTC day on the Free plan). Read-only.',
    { site_id: z.string().uuid() }, async ({ site_id }) => {
      try {
        const usage = await centerGet<unknown>(`/api/v1/usage/${site_id}`, token);
        return { content: [{ type: 'text' as const, text: JSON.stringify(usage) }] };
      } catch {
        return { isError: true, content: [{ type: 'text' as const, text: 'Site was not found or quota is unavailable.' }] };
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
  } catch { res.status(401).json({ error: 'Invalid WordRava authentication' }); return; }
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
