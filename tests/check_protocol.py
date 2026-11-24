#!/usr/bin/env python3
"""Static contract guard. Does not replace live OAuth/WordPress security tests."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
c = json.loads((root / "contracts/wordrava-protocol-v1.json").read_text(encoding="utf-8"))
assert c["schemaVersion"] == "1.2" and c["protocolVersion"] == "1.0"
assert c["centerVersion"] == "1.0.1"
assert c["pairing"]["claimEndpoint"] == "POST /api/v1/connectors/claim"
assert c["oauth"]["token"] == "POST /oauth/token"
assert "content:write" in c["oauth"]["scopes"]
assert c["capabilities"]["enabledByDefault"] is False
assert c["operation"]["status"] == "implemented-feature-flagged-beta"
assert c["operation"]["endpoint"] == "POST /api/v1/sites/{siteId}/jobs"
assert c["operation"]["connectorPoll"] == "POST /api/v1/connector-jobs/poll"
assert c["operation"]["types"]["write"] == ["create_draft", "update_draft"]
assert c["usage"]["limitSource"] == "center-plan"

def contains(path, *values):
    body = (root / path).read_text(encoding="utf-8")
    for word in values:
        assert word in body, f"{path}: missing {word!r}"
contains("src/server.ts",
    "version: '1.0.1'", "wordrava_capabilities",
    "wordrava_list_content", "wordrava_create_draft", "wordrava_job_status",
    "securitySchemes", "content:write", "mcp/www_authenticate",
    "openai/profile", "Idempotency-Key")
contains("marketplace/mcp.json", "https://wordrava.shayanostovar.com/mcp")
print("ChatGPT MCP 1.0.1 / protocol 1.0 OAuth and job contract passed.")
