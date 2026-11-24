#!/usr/bin/env python3
"""Static compatibility guard for the shared WordRava private-beta v1 contract.

This does not replace integration, penetration, or WordPress runtime tests.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
contract = json.loads((root / "contracts/wordrava-protocol-v1.json").read_text(encoding="utf-8"))
assert contract["schemaVersion"] == "1.1"
assert contract["protocolVersion"] == "1.0"
assert contract["pairing"]["claimEndpoint"] == "POST /api/v1/connectors/claim"
assert contract["usage"]["limitSource"] == "center-plan"
assert contract["operation"]["status"] == "planned-not-exposed"
assert contract["capabilities"]["remoteWriteEnabled"] is False
assert contract["capabilities"]["publicOAuthEnabled"] is False

def contains(file: str, *required: str) -> None:
    body = (root / file).read_text(encoding="utf-8")
    for word in required:
        assert word in body, f"{file}: missing {word!r}"

if (root / "src/WordRavaCenter/Program.cs").exists():
    contains("src/WordRavaCenter/Program.cs",
        'app.MapPost("/api/v1/connectors/claim"',
        'app.MapGet("/api/v1/capabilities"',
        '"0.1.1"', "request.ProtocolVersion", "s.IsBlocked",
        's.OwnerId == owner && !s.IsBlocked')
    contains("web/admin/src/main.tsx", "s.isBlocked", "t.blocked")
elif (root / "wordrava-connector.php").exists():
    contains("wordrava-connector.php",
        "Version: 0.1.1",
        "WORDRAVA_CONNECTOR_PROTOCOL_VERSION",
        "'protocolVersion' => WORDRAVA_CONNECTOR_PROTOCOL_VERSION",
        "'api/v1/connectors/claim'",
        "'remote_write' => false")
elif (root / "src/server.ts").exists():
    contains("src/server.ts",
        "version: '0.1.1'",
        "wordrava_capabilities",
        "'/api/v1/capabilities'",
        "plan-based daily operation quota",
        "error.status === 403")
else:
    raise AssertionError("Unrecognized WordRava repository layout")
print("WordRava protocol 1.0 / contract schema 1.1 static compatibility check passed.")
