#!/usr/bin/env python3
"""Verify the shared cross-repository contract and the public tool boundary."""
import json
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
c = json.loads((root / 'contracts/wordrava-protocol-v1.json').read_text())
version = json.loads((root / 'package.json').read_text())['version']
assert c['schemaVersion'] == '1.3' and c['protocolVersion'] == '1.0'
assert c['centerVersion'] == version == '1.1.1'
assert all(c['releaseComponents'][key] == version for key in ['center', 'wordpressConnector', 'chatgptMcp'])
assert c['pairing']['claimEndpoint'] == 'POST /api/v1/connectors/claim'
assert c['oauth']['token'] == 'POST /oauth/token' and 'content:write' in c['oauth']['scopes']
assert c['capabilities']['enabledByDefault'] is False
assert c['operation']['status'] == 'implemented-controlled-public-release'
assert c['operation']['endpoint'] == 'POST /api/v1/sites/{siteId}/jobs'
assert c['operation']['connectorPoll'] == 'POST /api/v1/connector-jobs/poll'
assert {'seo_read', 'inspect_plugin_zip', 'inspect_theme_zip'} <= set(c['operation']['types']['read'])
assert set(c['operation']['types']['write']) == {'create_draft', 'update_draft', 'publish_draft', 'import_media_url',
    'activate_theme', 'activate_plugin', 'deactivate_plugin', 'update_published', 'trash_content', 'restore_content',
    'seo_update', 'install_plugin_zip', 'install_theme_zip'}
assert c['quickPairing']['version'] == 2 and '/oauth/connect-wordpress' in c['quickPairing']['start']
assert c['operation']['packageLimits']['overwrite'] is False
assert c['operation']['packageLimits']['autoActivate'] is False
assert c['usage']['limitSource'] == 'center-plan'
source = '\n'.join((root / file).read_text() for file in ['src/server.ts', 'src/operations.ts'])
names = set(re.findall(r"registerTool\('([^']+)'", source))
expected = set(c['capabilities']['readOnlyMcpTools'] + c['capabilities']['writeMcpTools'])
assert names == expected and len(names) == c['capabilities']['mcpToolCount'] == 35
assert "version: '1.1.1'" in source
for value in ['securitySchemes', 'content:write', 'mcp/www_authenticate', 'openai/profile', 'openai/fileParams', 'Idempotency-Key']:
    assert value in source
assert 'https://wordrava.shayanostovar.com/mcp' in (root / 'marketplace/mcp.json').read_text()
print('MCP 1.1.1 / protocol1.0 schema1.3: coordinated versions, browser pairing and 35 named-tool contracts passed.')
