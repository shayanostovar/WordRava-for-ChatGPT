#!/usr/bin/env python3
import json
from pathlib import Path
repo = Path(__file__).resolve().parents[1]
plugin = json.loads((repo / "marketplace/plugin.json").read_text())
mcp = json.loads((repo / "marketplace/mcp.json").read_text())
server = (repo / "src/server.ts").read_text()
ext = plugin["extensions"]["com.openai"]
assert plugin["name"] == "wordrava"
assert plugin["version"] == "0.2.0"
assert ext["interface"]["capabilities"] == ["Read", "Write"]
assert len(ext["review"]["test_cases"]["positive"]) == 5
assert len(ext["review"]["test_cases"]["negative"]) == 3
cfg = mcp["mcpServers"]["wordrava"]
assert cfg["url"].endswith("/mcp")
assert cfg["extensions"]["com.openai"]["auth"]["type"] == "oauth"
assert cfg["extensions"]["com.openai"]["auth"]["client"]["mode"] == "provided"
assert cfg["extensions"]["com.openai"]["auth"]["client"]["tokenEndpointAuthMethod"] == "none"
assert ".well-known/oauth-protected-resource" in server
assert "/api/v1/oauth/session" in server
assert "registerTool" in server
for tool in ["list_sites", "my_account", "site_usage", "capabilities",
             "site_overview", "list_plugins", "list_menus", "list_content", "get_content",
             "create_draft", "update_draft", "job_status"]:
    assert "wordrava_" + tool in server
for path in ["marketplace/assets/logo.svg", "marketplace/assets/icon.svg"]:
    assert (repo / path).exists()
print("MCP plugin package metadata/security checks passed.")
