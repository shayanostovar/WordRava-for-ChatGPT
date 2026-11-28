#!/usr/bin/env python3
"""Verify the shared cross-repository contract and the public tool boundary."""
import json
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
c = json.loads((root / 'contracts/wordrava-protocol-v1.json').read_text())
version = json.loads((root / 'package.json').read_text())['version']
assert c['schemaVersion'] == '1.3' and c['protocolVersion'] == '1.0'
assert c['centerVersion'] == version == '1.4.4'
assert all(c['releaseComponents'][key] == version for key in ['center', 'chatgptMcp'])
assert c['releaseComponents']['wordpressConnector'] == c['cloudRelease']['connectorArchive'] == '1.3.1'
assert c['pairing']['claimEndpoint'] == 'POST /api/v1/connectors/claim'
assert c['oauth']['token'] == 'POST /oauth/token' and 'content:write' in c['oauth']['scopes']
assert c['capabilities']['enabledByDefault'] is False
assert c['operation']['status'] == 'implemented-controlled-public-release'
assert c['operation']['endpoint'] == 'POST /api/v1/sites/{siteId}/jobs'
assert c['operation']['connectorPoll'] == 'POST /api/v1/connector-jobs/poll'
assert {'seo_read'} <= set(c['operation']['types']['read'])
assert set(c['operation']['types']['write']) == {'create_draft', 'update_draft', 'publish_draft', 'import_media_url', 'activate_theme', 'activate_plugin', 'deactivate_plugin', 'update_published', 'trash_content', 'restore_content', 'seo_update', 'builder_patch', 'builder_control', 'builder_structure', 'builder_restore', 'theme_identity_update', 'theme_css_update', 'theme_css_restore', 'theme_part_update', 'theme_part_restore', 'polylang_set_language', 'polylang_link'}
assert 'builder_read' in c['operation']['types']['read']
assert c['quickPairing']['version'] == 2 and '/oauth/connect-wordpress' in c['quickPairing']['start']
assert c['usage']['limitSource'] == 'center-plan'
source = '\n'.join((root / file).read_text() for file in ['src/server.ts', 'src/operations.ts'])
names = set(re.findall(r"registerTool\('([^']+)'", source))
expected = set(c['capabilities']['readOnlyMcpTools'] + c['capabilities']['writeMcpTools'])
universal_names = {'wordrava_deep_discover','wordrava_capability_catalog','wordrava_capability_details','wordrava_list_resources'}
adapter_contract = json.loads((root / 'contracts/plugin-adapters-development-v1.json').read_text())
adapter_names = {op['tool'] for op in adapter_contract['operations']}
assert adapter_contract['production_enabled'] is False
assert names == expected | universal_names | adapter_names and len(expected) == c['capabilities']['mcpToolCount'] == 46
assert "process.env.WORDRAVA_PLUGIN_ADAPTERS_DEV === 'true' && process.env.NODE_ENV === 'development'" in source
assert "WORDRAVA_UNIVERSAL_DISCOVERY_ENABLED === 'true'" in source
assert "version: '1.4.4'" in source
for value in ['securitySchemes', 'content:write', 'mcp/www_authenticate', 'openai/profile', 'Idempotency-Key']:
    assert value in source
assert 'https://wordrava.shayanostovar.com/mcp' in (root / 'marketplace/mcp.json').read_text()
print('MCP 1.4.4 / protocol1.0 schema1.3: coordinated versions, browser pairing and 46 named-tool contracts passed.')

assert ["theme_read","theme_parts_list","theme_part_read","polylang_read"] == c['operation']['types']['read'][-4:]
assert c['operation']['compatibilityDevelopment']['minimumConnectorVersion'] == '1.2.3'
assert c['operation']['compatibilityDevelopment']['status'] == 'development-unreleased'

from check_compatibility_gate import validate as validate_compatibility
validate_compatibility(root, inventory_only=True)

assert c['packageStaging']['status'] == 'retired'
assert c['operation']['humanApproval']['minimumConnectorVersion'] == '1.3.0'
assert not {'rest_read','run_read_ability','install_plugin_zip','install_theme_zip','inspect_plugin_zip','inspect_theme_zip'}.intersection(c['operation']['types']['read'] + c['operation']['types']['write'])

assert c['usage']['freeDailyLimitDefault'] == 120
