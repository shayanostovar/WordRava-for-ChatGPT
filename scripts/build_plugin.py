#!/usr/bin/env python3
"""Build a review ZIP with plugin.json and mcp.json at the archive ROOT."""
import json
import pathlib
import zipfile

def check_schema(manifest, kind):
    # The Personal importer accepts Agent Plugins 1.0.0. Product versioning is
    # independent of this format; newer schema URLs are not forwards-compatible.
    expected = f"https://agent-plugins.org/schemas/1.0.0/{kind}.schema.json"
    if not isinstance(manifest, dict) or manifest.get("$schema") != expected:
        raise ValueError(f"Unsupported {kind} manifest schema; expected {expected}")

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "marketplace"
manifest = json.loads((source / "plugin.json").read_text())
auth = json.loads((source / "mcp.json").read_text())
check_schema(manifest, "plugin")
check_schema(auth, "mcp")
version = json.loads((root / "package.json").read_text())["version"]
assert manifest["name"] == "wordrava" and manifest["version"] == version
assert auth["mcpServers"]["wordrava"]["type"] == "streamable-http"
assert auth["mcpServers"]["wordrava"]["url"] == "https://wordrava.shayanostovar.com/mcp"
review = manifest["extensions"]["com.openai"]["review"]["test_cases"]
assert len(review["positive"]) == 5 and len(review["negative"]) == 3
paths = ["plugin.json", "mcp.json", "assets/logo.png", "assets/icon.png"]
dest = root / "dist" / f"wordrava-chatgpt-plugin-{version}-review-draft.zip"
dest.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for file in paths:
        entry = zipfile.ZipInfo(file, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        z.writestr(entry, (source / file).read_bytes())
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert "plugin.json" in z.namelist() and "mcp.json" in z.namelist()
    check_schema(json.loads(z.read("plugin.json")), "plugin")
    check_schema(json.loads(z.read("mcp.json")), "mcp")
print(f"Review draft ZIP: {dest}")

