#!/usr/bin/env python3
"""Local package checks against public submission rules; not an OpenAI approval."""
import hashlib
import json
import re
import struct
import sys
from pathlib import Path
from urllib.parse import urlsplit

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo / "scripts"))
from validate_package import PACKAGE_PATHS, validate_package
plugin = json.loads((repo / "marketplace/plugin.json").read_text())
mcp = json.loads((repo / "marketplace/mcp.json").read_text())
package = json.loads((repo / "package.json").read_text())
validate_package({name: (repo / "marketplace" / name).read_bytes() for name in PACKAGE_PATHS}, package["version"])
source = "\n".join((repo / file).read_text() for file in ["src/server.ts", "src/operations.ts"])
names = set(re.findall(r"registerTool\('([^']+)'", source))
ext = plugin["extensions"]["com.openai"]
ui, review = ext["interface"], ext["review"]
assert plugin["name"] == "wordrava" and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", plugin["name"])
assert plugin["version"] == package["version"] == "1.2.0"
assert plugin.get("$schema") == "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "Unsupported plugin manifest schema"
assert mcp.get("$schema") == "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", "Unsupported MCP manifest schema"
for field, maximum in {"displayName": 30, "shortDescription": 30, "developerName": 80, "longDescription": 4000}.items():
    text = ui[field]
    assert isinstance(text, str) and text.strip() and len(text) <= maximum, field
    if field != "longDescription": assert "\n" not in text and "\r" not in text
for field in ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]:
    url = urlsplit(ui[field])
    assert url.scheme == "https" and url.hostname and not url.username and not url.password
    assert len(ui[field]) <= 1024
prompts = ui.get("defaultPrompt", [])
assert len(prompts) <= 3 and len(set(prompts)) == len(prompts)
assert all(0 < len(text) <= 128 and "\n" not in text and "@" not in text for text in prompts)
assert len(ui["capabilities"]) <= 20 and all(0 < len(text) <= 120 for text in ui["capabilities"])
assert len(review["test_cases"]["positive"]) == 5
assert len(review["test_cases"]["negative"]) == 3
assert ext["publication"]["release_notes"].strip()
for group, cases in review["test_cases"].items():
    for case in cases:
        assert case["description"].strip() and case["prompt"].strip()
        if group == "positive":
            assert case["expected_behavior"].strip()
            assert set(case["tools_triggered"].split(", ")) <= names
        for url in case.get("file_attachment_urls", []):
            assert url.startswith("https://raw.githubusercontent.com/shayanostovar/WordRava-for-ChatGPT/main/review/fixtures/")
            assert (repo / "review/fixtures" / url.rsplit("/", 1)[1]).is_file()
assert not {"test_credentials", "reviewer_instructions"} & review.keys()
assert not {"apps", "hooks"} & ext.keys()
for translation in ext["publication"]["translations"].values():
    assert 0 < len(translation["subtitle"]) <= 30
    assert 0 < len(translation["description"]) <= 4000
assert set(mcp["mcpServers"]) == {"wordrava"}
cfg = mcp["mcpServers"]["wordrava"]
assert cfg["type"] == "streamable-http" and cfg["url"] == "https://wordrava.shayanostovar.com/mcp"
auth = cfg["extensions"]["com.openai"]["auth"]
assert auth["type"] == "oauth"
assert auth["client"] == {"mode": "provided", "clientId": "wordrava-chatgpt", "tokenEndpointAuthMethod": "none"}
assert auth["baseScopes"] == ["sites:read", "content:read"]
assert auth["resource"] == cfg["url"] and auth["authorizationServerBase"] == "https://wordrava.shayanostovar.com"
assert not cfg.get("headers") and "clientSecret" not in json.dumps(mcp)
assert len(names) == 46
for removed in ["wordrava_execute_read", "wordrava_execute_write", "wordrava_connect_wordpress",
                "wordrava_read_rest_route", "wordrava_run_read_ability", "wordrava_stage_package", "wordrava_inspect_plugin_zip", "wordrava_inspect_theme_zip", "wordrava_install_plugin_zip", "wordrava_install_theme_zip"]:
    assert removed not in names
for name in ["connection_help", "get_seo", "update_seo"]:
    assert "wordrava_" + name in names
for field in [".well-known/oauth-protected-resource", "securitySchemes", "mcp/www_authenticate",
              "openai/profile", "Idempotency-Key"]:
    assert field in source
for field in ["logo", "composerIcon"]:
    path = repo / "marketplace" / ui[field].removeprefix("./")
    raw = path.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) <= 5 * 1024 * 1024
    width, height = struct.unpack(">II", raw[16:24])
    assert width == height and 48 <= width <= 4096
    assert hashlib.sha256(raw).hexdigest() == "aab2538babaceec8fe09363a9dec59a6e332e208c2959993e155db4fac2f7264"
print("Public plugin metadata checks passed: 46 named tools, 5 positive/3 negative cases, OAuth schema and original logo.")
print("Owner identity, domain challenge, reviewer credentials/video and the OpenAI scan remain external review steps.")
