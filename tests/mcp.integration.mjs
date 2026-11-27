import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const siteId = 'b2b8ee31-0711-4ca7-91df-28b941806abe';
const jobId = '23ceff51-3520-4dd1-9835-b414b817a3c5';
const requestId = '985e4ba0-b581-41c3-adfe-17af8ec7551f';
const revision = '2026-11-26T12:00:00';
const digest = 'a'.repeat(64);
const source = 'https://packages.example.test/review.zip';
const quota = {
  site_id: siteId, site_name: 'Review site', site_url: 'https://example.test',
  plan_id: requestId, plan: 'Free', plan_source: 'default', used: 2, reserved: 1,
  failed: 0, effective_used: 3, limit: 200, remaining: 197,
  resets_at_utc: '2026-11-27T00:00:00Z', measured_at_utc: '2026-11-26T12:00:00Z',
  timezone: 'UTC', quota_policy: 'per_site', accounting: 'Success counts; pending reserves.',
};

test('MCP protocol, reviewed schemas, scope boundaries and package/SEO contracts', async t => {
  const temp = mkdtempSync(join(tmpdir(), 'wordrava-mcp-test-'));
  const key = join(temp, 'key.pem'), cert = join(temp, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout', key, '-out', cert], { stdio: 'pipe' });
  const requests = [];
  const center = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    requests.push({ path: req.url, method: req.method, body, idempotency: req.headers['idempotency-key'] });
    const reply = (data, status = 200) => {
      res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
    };
    if (req.url === '/api/v1/oauth/session') {
      if (req.headers.authorization === 'Bearer expired') return reply({ error: 'invalid_token' }, 401);
      const scope = req.headers.authorization === 'Bearer readonly' ? 'sites:read content:read'
        : req.headers.authorization === 'Bearer sitesonly' ? 'sites:read' : 'sites:read content:read content:write';
      return reply({ owner_id: requestId, scope, token_type: 'oauth' });
    }
    if (req.url === '/api/v1/sites') return reply([{ id: siteId, url: 'https://example.test', name: 'Review site',
      wordPressVersion: '6.8', connectorVersion: '1.2.0', isBlocked: false,
      createdAt: 'internal timestamp', ownerId: 'must-not-leak' }]);
    if (req.url === '/api/v1/me') return reply({ id: requestId, email: 'review@example.test', role: 'Admin', isActivated: true });
    if (req.url === `/api/v1/usage/${siteId}`) return reply(quota);
    if (req.url === '/api/v1/account/usage') return reply({ ...quota, sites: [quota], site_count: 1,
      owner_id: 'must-not-leak', note: 'Independent site limits.' });
    if (req.url === '/api/v1/capabilities') return reply({ center_version: '1.2.0', protocol_version: '1.0',
      quota_source: 'site_plan', site_blocking: true, user_blocking: true, remote_write_enabled: true,
      connector_async_operations: true, connector_execution_mode: 'outbound_polling',
      immediate_execution_supported: false, public_oauth_enabled: true, quick_pairing_enabled: true,
      passwordless_oauth_enabled: true, release_sha: 'internal-build-id' });
    if (req.url === `/api/v1/sites/${siteId}/packages/stage`) {
      if (body.file.file_name === 'expired.zip') return reply({ error: 'package_source_expired' }, 410);
      return reply({ package_id: 'internal-staging-id', source_url: source, sha256: digest, size_bytes: 2500,
        file_name: 'review.zip', package_type: body.package_type,
        expires_at_utc: '2026-11-26T12:30:00Z', expires_in: 1800 });
    }
    if (req.url === `/api/v1/sites/${siteId}/jobs` && req.method === 'POST') {
      if (body.kind === 'seo_update' && JSON.parse(body.content).fields.title === 'CONFLICT') {
        return reply({ error: 'seo_revision_conflict' }, 409);
      }
      if (body.kind === 'seo_update' && JSON.parse(body.content).fields.title === 'RAW_SECRET') {
        res.writeHead(500, { 'content-type': 'text/html' });
        return res.end('<html>private stack trace and token=must-not-leak</html>');
      }
      return reply({ job_id: jobId, status: 'pending', poll_after_seconds: 10 }, 202);
    }
    if (req.url === `/api/v1/sites/${siteId}/jobs/${jobId}`) return reply({ job_id: jobId,
      kind: 'seo_read', status: 'succeeded', result: JSON.stringify({ provider: 'yoast', seo_revision: digest }),
      execution_mode: 'outbound_polling', pending_seconds: null, next_action: null,
      created_at: 'internal timestamp', finished_at: 'internal timestamp' });
    if (req.url === `/api/v1/sites/${siteId}/operations`) return reply({ version: '1.2.0', site_id: siteId,
      read: [{ kind: 'seo_read', scope: 'content:read', requires_confirmation: false }],
      write: [{ kind: 'seo_update', scope: 'content:write', requires_confirmation: true,
        needs_revision: true, wordpress_opt_in: 'allow_seo' }], workflow: 'Read, approve, call named tool, poll.' });
    if (req.url.startsWith('/api/v1/pairing/status/')) return reply({ status: 'pending', site_id: null });
    return reply({ error: 'not_found' }, 404);
  });
  await new Promise(resolve => center.listen(0, '127.0.0.1', resolve));
  const portProbe = http.createServer();
  await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port),
      WORDRAVA_CENTER_URL: `https://127.0.0.1:${center.address().port}`, NODE_EXTRA_CA_CERTS: cert },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childLog = ''; child.stdout.on('data', b => childLog += b); child.stderr.on('data', b => childLog += b);
  const clients = [];
  t.after(async () => {
    for (const client of clients) await client.close();
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    center.closeAllConnections(); await new Promise(resolve => center.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  });
  const endpoint = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(endpoint + '/health')).ok) break; } catch {}
    if (attempt > 100 || child.exitCode !== null) throw new Error(`MCP did not start: ${childLog}`);
    await delay(50);
  }
  const connect = async token => {
    const client = new Client({ name: 'wordrava-contract-test', version: '1.2.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint + '/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }));
    clients.push(client); return client;
  };
  const full = await connect('full'), read = await connect('readonly'), sites = await connect('sitesonly');
  const { tools } = await full.listTools();
  const byName = Object.fromEntries(tools.map(tool => [tool.name, tool]));
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/tool-catalog-1.2.0.json', JSON.stringify(tools, null, 2) + '\n');
  const call = (name, args = {}, client = full) => client.callTool({ name, arguments: args });
  const errorOf = result => JSON.parse(result.content[0].text).error;
  const postCount = () => requests.filter(r => r.method === 'POST').length;

  await t.test('unlinked clients get an OAuth discovery challenge and matching health', async () => {
    const response = await fetch(endpoint + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
    assert.equal(response.status, 401); assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
    assert.equal((await (await fetch(endpoint + '/health')).json()).version, '1.2.0');
    const metadata = await (await fetch(endpoint + '/.well-known/oauth-protected-resource')).json();
    assert.equal(metadata.resource, 'https://wordrava.shayanostovar.com/mcp');
    assert.ok(metadata.resource_policy_uri.endsWith('/privacy'));
  });
  await t.test('all reviewed tools have explicit annotations, output schemas and OAuth metadata', () => {
    for (const tool of tools) {
      for (const hint of ['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint']) {
        assert.equal(typeof tool.annotations[hint], 'boolean', `${tool.name}: ${hint}`);
      }
      assert.equal(tool.outputSchema.type, 'object', tool.name);
      assert.ok(tool._meta.securitySchemes.some(auth => auth.type === 'oauth2'), tool.name);
      assert.ok(!JSON.stringify(tool.inputSchema).includes('pairing_code'), tool.name);
      assert.ok(!('outputSchema' in tool.inputSchema.properties), `${tool.name}: schema leaked into inputs`);
    }
    for (const removed of ['wordrava_execute_read', 'wordrava_execute_write', 'wordrava_connect_wordpress',
      'wordrava_read_rest_route', 'wordrava_run_read_ability']) assert.equal(byName[removed], undefined);
    for (const name of ['wordrava_get_seo', 'wordrava_inspect_plugin_zip', 'wordrava_list_content']) {
      assert.equal(byName[name].annotations.readOnlyHint, false, 'Queueing persists state');
    }
    for (const name of ['wordrava_update_seo', 'wordrava_install_plugin_zip', 'wordrava_install_theme_zip',
      'wordrava_update_draft', 'wordrava_publish_draft']) assert.equal(byName[name].annotations.destructiveHint, true);
    assert.equal(byName.wordrava_my_account._meta['openai/profile'], true);
  });
  await t.test('native file descriptor declares exactly the supported required file fields', () => {
    const stage = byName.wordrava_stage_package;
    assert.deepEqual(stage._meta['openai/fileParams'], ['file']);
    assert.deepEqual(stage.inputSchema.properties.file.required.sort(), ['download_url', 'file_id']);
    assert.deepEqual(Object.keys(stage.inputSchema.properties.file.properties).sort(),
      ['download_url', 'file_id', 'file_name', 'mime_type']);
    assert.equal(stage.annotations.readOnlyHint, false); assert.equal(stage.annotations.openWorldHint, true);
  });
  await t.test('account and status responses minimize internal identifiers and timestamps', async () => {
    const result = await call('wordrava_list_sites');
    assert.equal(result.structuredContent.items[0].id, siteId);
    assert.equal(result.structuredContent.items[0].ownerId, undefined);
    assert.equal(result.structuredContent.items[0].createdAt, undefined);
    const account = await call('wordrava_account_usage');
    assert.equal(account.structuredContent.owner_id, undefined);
    assert.equal(account.structuredContent.sites[0].plan_id, undefined);
    assert.equal(account.structuredContent.remaining, 197);
    const profile = await call('wordrava_my_account');
    assert.equal(profile.structuredContent.id, requestId); assert.equal(profile.structuredContent.role, undefined);
    const job = await call('wordrava_job_status', { site_id: siteId, job_id: jobId });
    assert.equal(job.structuredContent.status, 'succeeded'); assert.equal(job.structuredContent.created_at, undefined);
    assert.equal((await call('wordrava_capabilities')).structuredContent.release_sha, undefined);
    assert.ok((await call('wordrava_connection_help')).structuredContent.steps.length >= 3);
  });
  await t.test('read operations use content scope and known exact job contracts', async () => {
    const denied = await call('wordrava_get_seo', { site_id: siteId, content_type: 'post', item_id: 12 }, sites);
    assert.equal(errorOf(denied).code, 'insufficient_scope');
    const result = await call('wordrava_get_seo', { site_id: siteId, content_type: 'post', item_id: 12 }, read);
    assert.equal(result.structuredContent.job_id, jobId);
    assert.deepEqual(requests.findLast(r => r.method === 'POST').body,
      { kind: 'seo_read', contentType: 'post', itemId: 12, title: 'auto', content: '{}' });
    assert.equal((await call('wordrava_plan_operation', { site_id: siteId })).structuredContent.write[0].kind, 'seo_update');
  });
  await t.test('content and media pagination forward exact bounded parameters', async () => {
    const result = await call('wordrava_list_content', { site_id: siteId, content_type: 'page', page: 2, per_page: 24, language: 'en' }, read);
    assert.equal(result.structuredContent.job_id, jobId);
    let request = requests.findLast(r => r.method === 'POST');
    assert.equal(request.body.kind, 'list_content');
    assert.deepEqual(JSON.parse(request.body.content), { page: 2, per_page: 24, language: 'en' });
    await call('wordrava_list_media', { site_id: siteId, page: 2 }, read);
    request = requests.findLast(r => r.method === 'POST');
    assert.equal(request.body.kind, 'list_media');
    assert.deepEqual(JSON.parse(request.body.content), { page: 2 });
    const before = postCount();
    for (const invalid of [{ page: 0 }, { per_page: 51 }, { language: '../de' }, { page: 1.5 }]) {
      const bad = await call('wordrava_list_content', { site_id: siteId, content_type: 'page', ...invalid }, read);
      assert.equal(bad.isError, true);
    }
    assert.equal(postCount(), before);
  });
  await t.test('native appearance and Polylang tools use typed jobs, revisions and explicit scope', async () => {
    const theme={site_id:siteId,stylesheet:'child-theme'};
    const approved={expected_revision:digest,user_confirmed:true,request_id:requestId};
    const css={...theme,...approved,css:'.site { color: red; }'};
    const denied=await call('wordrava_update_custom_css',css,read);
    assert.equal(errorOf(denied).code,'insufficient_scope');
    const readResult=await call('wordrava_read_theme_appearance',{site_id:siteId},read);
    assert.equal(readResult.structuredContent.job_id,jobId);
    assert.equal(requests.findLast(r=>r.method==='POST').body.kind,'theme_read');
    const result=await call('wordrava_update_custom_css',css);
    assert.equal(result.structuredContent.job_id,jobId);
    let request=requests.findLast(r=>r.method==='POST');
    assert.equal(request.idempotency,requestId);
    assert.equal(request.body.kind,'theme_css_update');
    assert.deepEqual(JSON.parse(request.body.content),{stylesheet:'child-theme',expected_revision:digest,css:css.css});
    const poly={site_id:siteId,content_type:'page',item_id:12,target_id:13,
      ...approved,expected_target_revision:digest};
    await call('wordrava_link_polylang_translations',poly);
    request=requests.findLast(r=>r.method==='POST');
    assert.equal(request.body.kind,'polylang_link');
    assert.equal(request.body.itemId,12);
    assert.deepEqual(JSON.parse(request.body.content),{target_id:13,expected_revision:digest,expected_target_revision:digest});
    const before=postCount();
    assert.equal((await call('wordrava_update_custom_css',{...css,css:'</style><script>x</script>'})).isError,true);
    assert.equal((await call('wordrava_update_custom_css',{...css,stylesheet:'../other'})).isError,true);
    assert.equal((await call('wordrava_update_theme_identity',{...theme,...approved,field:'admin_email',value:'x'})).isError,true);
    assert.equal((await call('wordrava_update_theme_part',{...theme,...approved,slug:'header',markup:'<?php echo 1; ?>'})).isError,true);
    assert.equal((await call('wordrava_link_polylang_translations',{...poly,target_id:12})).isError,true);
    assert.equal(postCount(),before);
  });
  await t.test('SEO writes preserve revisions and idempotency; malformed/unknown fields fail closed', async () => {
    const args = { site_id: siteId, content_type: 'post', item_id: 12, provider: 'yoast',
      fields: { title: 'Reviewed title', canonical: '', robots_noindex: false }, expected_modified_gmt: revision,
      expected_seo_revision: digest, user_confirmed: true, request_id: requestId };
    const before = postCount();
    const denied = await call('wordrava_update_seo', args, read);
    assert.equal(denied.isError, true); assert.match(denied._meta['mcp/www_authenticate'][0], /content:write/);
    assert.equal(postCount(), before);
    const result = await call('wordrava_update_seo', args);
    assert.equal(result.isError, undefined);
    const request = requests.findLast(r => r.method === 'POST');
    assert.equal(request.idempotency, requestId); assert.equal(request.body.expectedModifiedGmt, revision);
    assert.deepEqual(JSON.parse(request.body.content), { fields: args.fields, expected_seo_revision: digest });
    for (const fields of [{ arbitrary_meta: 'x' }, {}, { robots_noindex: 'false' },
      { canonical: 'http://example.test' }, { og_image: null }]) {
      const count = postCount(); const result = await call('wordrava_update_seo', { ...args, fields });
      assert.equal(result.isError, true); assert.equal(postCount(), count);
    }
    const conflict = await call('wordrava_update_seo', { ...args, fields: { title: 'CONFLICT' } });
    assert.equal(errorOf(conflict).code, 'seo_revision_conflict');
    assert.equal(errorOf(conflict).http_status, 409);
    const raw = await call('wordrava_update_seo', { ...args, fields: { title: 'RAW_SECRET' } });
    assert.equal(errorOf(raw).code, 'center_http_500');
    assert.ok(!JSON.stringify(raw).includes('must-not-leak'));
  });
  await t.test('attached ZIP staging is scoped, bounded-schema and produces temporary inspection input', async () => {
    const args = { site_id: siteId, package_type: 'plugin', file: {
      download_url: source, file_id: 'file_review', mime_type: 'application/zip', file_name: 'review.zip' } };
    const before = postCount();
    assert.equal((await call('wordrava_stage_package', args, read)).isError, true);
    assert.equal(postCount(), before);
    const result = await call('wordrava_stage_package', args);
    assert.equal(result.structuredContent.source_url, source); assert.equal(result.structuredContent.expires_in, 1800);
    assert.equal(result.structuredContent.package_id, undefined);
    assert.deepEqual(requests.findLast(r => r.method === 'POST').body, { package_type: 'plugin', file: args.file });
    for (const file of ['/workspace/test.zip', { download_url: source },
      { ...args.file, download_url: 'http://localhost/test.zip' }, { ...args.file, extra: 'unused context' }]) {
      const count = postCount(); assert.equal((await call('wordrava_stage_package', { ...args, file })).isError, true);
      assert.equal(postCount(), count);
    }
    const expired = await call('wordrava_stage_package', { ...args, file: { ...args.file, file_name: 'expired.zip' } });
    assert.equal(errorOf(expired).code, 'package_source_expired');
  });
  await t.test('package installation binds approved exact bytes and identity; no activation is implied', async () => {
    for (const type of ['plugin', 'theme']) {
      const inspect = await call(`wordrava_inspect_${type}_zip`, { site_id: siteId, source_url: source });
      assert.equal(inspect.isError, undefined);
      assert.deepEqual(JSON.parse(requests.findLast(r => r.method === 'POST').body.content), { source_url: source });
      const args = { site_id: siteId, source_url: source, sha256: digest, expected_slug: 'review-package',
        expected_version: '1.0.0', user_confirmed: true, request_id: requestId };
      const result = await call(`wordrava_install_${type}_zip`, args);
      assert.equal(result.isError, undefined);
      const request = requests.findLast(r => r.method === 'POST');
      assert.equal(request.idempotency, requestId); assert.equal(request.body.title, 'review-package');
      assert.equal(request.body.confirmChanges, true); assert.equal(request.body.kind, `install_${type}_zip`);
      assert.deepEqual(JSON.parse(request.body.content), { source_url: source, sha256: digest, expected_version: '1.0.0' });
      for (const invalid of [{ user_confirmed: false }, { sha256: 'a' }, { expected_slug: '../bad' },
        { source_url: 'https://user:password@example.test/x.zip' }, { request_id: undefined },
        { expected_version: '1.1.1\n' }, { expected_slug: 'review\n' }, { sha256: digest + '\n' }]) {
        const count = postCount();
        assert.equal((await call(`wordrava_install_${type}_zip`, { ...args, ...invalid })).isError, true);
        assert.equal(postCount(), count);
      }
    }
  });
});
