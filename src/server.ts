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
const publicOrigin = (process.env.WORDRAVA_PUBLIC_ORIGIN || 'https://wordrava.shayanostovar.com').replace(/\/$/, '');
const origin = new URL(publicOrigin);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('WORDRAVA_PUBLIC_ORIGIN must be a plain HTTPS origin.');
}
const resource = publicOrigin + '/mcp';
const protectedResourceMetadata = publicOrigin + '/.well-known/oauth-protected-resource';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', component: 'mcp', version: '0.2.0' }));

// OAuth 2.1 / RFC 9728 protected-resource metadata. Nginx routes this path to MCP.
const metadata = {
  resource,
  authorization_servers: [publicOrigin],
  scopes_supported: ['sites:read', 'content:read', 'content:write'],
};
app.get('/.well-known/oauth-protected-resource', (_req, res) => res.json(metadata));
app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => res.json(metadata));

class CenterHttpError extends Error {
  constructor(public readonly status: number) { super(`Center returned HTTP ${status}`); }
}
async function centerPost<T>(
  path: string, token: string, payload: Record<string, unknown>, idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!response.ok) throw new CenterHttpError(response.status);
  return await response.json() as T;
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
function bearer(req: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.header('authorization') ?? '');
  return match?.[1] ?? null;
}
function challenge(res: Response, status = 401, error = 'invalid_token') {
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${protectedResourceMetadata}", scope="sites:read content:read", error="${error}"`);
  return res.status(status).json({ error, message: 'Connect your WordRava account using OAuth 2.1.' });
}
type Session = { owner_id: string, scope: string, token_type: 'oauth' };
async function validateSession(token: string): Promise<Session> {
  const session = await centerGet<Session>('/api/v1/oauth/session', token);
  const granted = (session.scope || '').split(' ');
  if (session.token_type !== 'oauth' || !granted.includes('sites:read')) {
    throw new CenterHttpError(403);
  }
  return session;
}
function good(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}
function bad(message: string) {
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
}
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const externalReadAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
function createServer(token: string, session: Session): McpServer {
  const server = new McpServer({ name: 'WordRava', version: '0.2.0' });
  server.registerTool('wordrava_list_sites', {
    description: 'List only the WordPress sites in the signed-in WordRava account, including whether each site is blocked. Does not query site content.',
    inputSchema: {}, annotations: readAnnotations,
  }, async () => {
    try { return good(await centerGet<unknown[]>('/api/v1/sites', token)); }
    catch { return bad('Unable to retrieve your WordRava sites.'); }
  });
  server.registerTool('wordrava_my_account', {
    description: 'Read the identity and role of the WordRava account that authenticated this plugin. No password or tokens.',
    inputSchema: {}, annotations: readAnnotations,
  }, async () => {
    try { return good(await centerGet<unknown>('/api/v1/me', token)); }
    catch { return bad('Unable to retrieve your WordRava account.'); }
  });
  server.registerTool('wordrava_site_usage', {
    description: 'Read the current UTC-day quota of a WordRava site (limit set by its plan). A blocked site is unavailable.',
    inputSchema: { site_id: z.string().uuid() }, annotations: readAnnotations,
  }, async ({ site_id }) => {
    try { return good(await centerGet<unknown>(`/api/v1/usage/${site_id}`, token)); }
    catch { return bad('Site is blocked, unavailable, or not owned by your WordRava account.'); }
  });
  server.registerTool('wordrava_capabilities', {
    description: 'Read the current supported WordRava features and protocol. Use to check whether content operations are enabled before trying them.',
    inputSchema: {}, annotations: readAnnotations,
  }, async () => {
    try { return good(await centerGet<unknown>('/api/v1/capabilities', token)); }
    catch { return bad('Unable to retrieve current WordRava capabilities.'); }
  });
  // WordPress operations are asynchronous: the connector retrieves jobs from Center
  // over outbound HTTPS and sends results back. ChatGPT polls wordrava_job_status.
  const can = (scope: string) => session.scope.split(' ').includes(scope);
  const submit = async (site_id: string, input: Record<string, unknown>, write: boolean, request_id?: string) => {
    if (!can(write ? 'content:write' : 'content:read')) return bad(`Missing OAuth permission: ${write ? 'content:write' : 'content:read'}. Reconnect WordRava with the required scope.`);
    try {
      const job = await centerPost<unknown>(`/api/v1/sites/${site_id}/jobs`, token, input, request_id);
      return good({ operation: 'queued', ...(job as object), next_step: 'Use wordrava_job_status with the returned job_id. The WordPress connector runs by WP-Cron or manual sync.' });
    } catch (error) {
      if (error instanceof CenterHttpError && error.status === 503) return bad('Operations are not enabled on this WordRava Center yet.');
      if (error instanceof CenterHttpError && error.status === 409) return bad('Reconnect the WordPress Connector to enable secure operations.');
      if (error instanceof CenterHttpError && error.status === 429) return bad('Site daily quota or pending job capacity is exhausted.');
      return bad('WordRava rejected the request; verify your site ownership, scope and operation arguments.');
    }
  };
  server.registerTool('wordrava_site_overview', {
    description: 'Queue a read-only WordPress site overview (site name, WordPress version and active theme). Returns an asynchronous job ID.',
    inputSchema: { site_id: z.string().uuid() }, annotations: externalReadAnnotations,
  }, async ({ site_id }) => submit(site_id, { kind: 'site_overview', contentType: 'post' }, false));
  server.registerTool('wordrava_list_plugins', {
    description: 'Queue a read-only list of installed plugins and activation status for a connected site. Returns an asynchronous job ID.',
    inputSchema: { site_id: z.string().uuid() }, annotations: externalReadAnnotations,
  }, async ({ site_id }) => submit(site_id, { kind: 'list_plugins', contentType: 'post' }, false));
  server.registerTool('wordrava_list_menus', {
    description: 'Queue read-only WordPress menu names and links for a connected site. Returns an asynchronous job ID.',
    inputSchema: { site_id: z.string().uuid() }, annotations: externalReadAnnotations,
  }, async ({ site_id }) => submit(site_id, { kind: 'list_menus', contentType: 'post' }, false));
  server.registerTool('wordrava_list_content', {
    description: 'Queue read-only listing of the latest 20 WordPress posts or pages. No content edits. Returns an asynchronous job ID.',
    inputSchema: { site_id: z.string().uuid(), content_type: z.enum(['post', 'page']) }, annotations: externalReadAnnotations,
  }, async ({ site_id, content_type }) => submit(site_id, { kind: 'list_content', contentType: content_type }, false));
  server.registerTool('wordrava_get_content', {
    description: 'Queue a read-only fetch of one WordPress post/page, including its modified_gmt revision. Returns an asynchronous job ID.',
    inputSchema: { site_id: z.string().uuid(), content_type: z.enum(['post', 'page']), item_id: z.number().int().positive() }, annotations: externalReadAnnotations,
  }, async ({ site_id, content_type, item_id }) => submit(site_id, { kind: 'get_content', contentType: content_type, itemId: item_id }, false));
  server.registerTool('wordrava_create_draft', {
    description: 'Create a WordPress DRAFT post/page only, after user approval and WordPress-side opt-in. Never publish. Enqueues an asynchronous job.',
    inputSchema: { site_id: z.string().uuid(), content_type: z.enum(['post', 'page']), title: z.string().min(1).max(200), content: z.string().max(100000),
      user_confirmed: z.literal(true).describe('Must be true only after user explicitly approves the exact draft content.'), request_id: z.string().uuid().describe('Stable idempotency UUID; reuse on retries.') },
    annotations: writeAnnotations,
  }, async ({ site_id, content_type, title, content, user_confirmed, request_id }) => submit(site_id,
    { kind: 'create_draft', contentType: content_type, title, content, confirmChanges: user_confirmed }, true, request_id));
  server.registerTool('wordrava_update_draft', {
    description: 'Update an existing DRAFT only. Requires exact modified_gmt revision, explicit approval and WordPress-side opt-in. Never publish or delete.',
    inputSchema: { site_id: z.string().uuid(), content_type: z.enum(['post', 'page']), item_id: z.number().int().positive(),
      title: z.string().min(1).max(200), content: z.string().max(100000), expected_modified_gmt: z.string().min(10).max(40),
      user_confirmed: z.literal(true), request_id: z.string().uuid() }, annotations: writeAnnotations,
  }, async ({ site_id, content_type, item_id, title, content, expected_modified_gmt, user_confirmed, request_id }) => submit(site_id,
    { kind: 'update_draft', contentType: content_type, itemId: item_id, title, content, expectedModifiedGmt: expected_modified_gmt,
      confirmChanges: user_confirmed }, true, request_id));
  server.registerTool('wordrava_job_status', {
    description: 'Read the status and sanitized result of a queued WordPress operation. Use the job ID returned by a previous read or draft tool.',
    inputSchema: { site_id: z.string().uuid(), job_id: z.string().uuid() }, annotations: readAnnotations,
  }, async ({ site_id, job_id }) => {
    if (!can('content:read')) return bad('Missing OAuth content:read permission.');
    try { return good(await centerGet<unknown>(`/api/v1/sites/${site_id}/jobs/${job_id}`, token)); }
    catch { return bad('Job is not available to your WordRava account or the site has been blocked.'); }
  });
  return server;
}

app.post('/mcp', async (req: Request, res: Response) => {
  const token = bearer(req);
  if (!token) { challenge(res); return; }
  let session: Session;
  try {
    session = await validateSession(token);
  } catch (error) {
    if (error instanceof CenterHttpError && error.status === 403) challenge(res, 403, 'insufficient_scope');
    else challenge(res);
    return;
  }
  if (!isInitializeRequest(req.body) && !req.body?.jsonrpc) {
    res.status(400).json({ error: 'Invalid MCP request' }); return;
  }
  const server = createServer(token, session);
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
app.get('/mcp', (_req, res) => { challenge(res); });
app.delete('/mcp', (_req, res) => res.status(405).send('Stateless MCP: DELETE is not supported'));

const port = Number(process.env.PORT ?? '3100');
app.listen(port, '0.0.0.0', () => console.log(`WordRava MCP OAuth endpoint listening on :${port}`));